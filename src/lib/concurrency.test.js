import { describe, expect, it, vi } from 'vitest'
import { mapWithConcurrency } from './concurrency'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

describe('bounded-concurrency mapper', () => {
  it('never exceeds the concurrency cap while still overlapping work', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const worker = vi.fn(async () => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await sleep(20)
      inFlight -= 1
    })
    await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8], worker, { concurrency: 3 })
    expect(worker).toHaveBeenCalledTimes(8)
    expect(maxInFlight).toBe(3)
  })

  it('preserves input order in the result array even when completion order reverses', async () => {
    const completionOrder = []
    const results = await mapWithConcurrency([50, 30, 10], async (delay, index) => {
      await sleep(delay)
      completionOrder.push(index)
      return `item-${index}`
    }, { concurrency: 3 })
    expect(completionOrder).toEqual([2, 1, 0])
    expect(results.map((entry) => entry.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled'])
    expect(results.map((entry) => entry.value)).toEqual(['item-0', 'item-1', 'item-2'])
    expect(results.map((entry) => entry.index)).toEqual([0, 1, 2])
  })

  it('dispatches every item exactly once — no duplicates under contention', async () => {
    const seen = new Map()
    await mapWithConcurrency(Array.from({ length: 20 }, (_, index) => index), async (item) => {
      seen.set(item, (seen.get(item) || 0) + 1)
      await sleep(1)
    }, { concurrency: 7 })
    expect(seen.size).toBe(20)
    expect([...seen.values()].every((count) => count === 1)).toBe(true)
  })

  it('isolates failures per item instead of rejecting the batch', async () => {
    const results = await mapWithConcurrency(['ok', 'boom', 'ok'], async (item) => {
      await sleep(5)
      if (item === 'boom') throw new Error('worker exploded')
      return item
    }, { concurrency: 2 })
    expect(results[0]).toMatchObject({ status: 'fulfilled', value: 'ok' })
    expect(results[1].status).toBe('rejected')
    expect(results[1].reason.message).toBe('worker exploded')
    expect(results[2]).toMatchObject({ status: 'fulfilled', value: 'ok' })
  })

  it('stops dispatching once the signal aborts and marks undispatched items cancelled', async () => {
    const controller = new AbortController()
    const worker = vi.fn(async (_, index) => {
      if (index === 0) controller.abort()
      await sleep(5)
      return index
    })
    const results = await mapWithConcurrency([0, 1, 2, 3, 4], worker, { concurrency: 1, signal: controller.signal })
    expect(worker).toHaveBeenCalledTimes(1)
    expect(results[0].status).toBe('fulfilled')
    expect(results.slice(1).every((entry) => entry.status === 'cancelled')).toBe(true)
  })

  it('measures elapsed time: the pool beats the serial baseline on identical delayed work', async () => {
    const items = Array.from({ length: 6 }, (_, index) => index)
    const delay = 30
    const worker = async () => { await sleep(delay) }

    const serialStart = performance.now()
    await mapWithConcurrency(items, worker, { concurrency: 1 })
    const serialElapsed = performance.now() - serialStart

    const pooledStart = performance.now()
    await mapWithConcurrency(items, worker, { concurrency: 3 })
    const pooledElapsed = performance.now() - pooledStart

    // 6 × 30ms: serial ≈ 180ms, pool of 3 ≈ 60ms. Wide margin against CI jitter.
    console.info(`[measure] ${items.length} items × ${delay}ms: serial ${serialElapsed.toFixed(0)}ms vs pooled(3) ${pooledElapsed.toFixed(0)}ms — ${(serialElapsed / pooledElapsed).toFixed(1)}× speedup`)
    expect(pooledElapsed).toBeLessThan(serialElapsed * 0.75)
    expect(serialElapsed).toBeGreaterThanOrEqual(items.length * delay * 0.9)
  })
})
