// Bounded-concurrency mapper for independent async work (per-frame image
// generation). Guarantees that matter here:
//   - at most `concurrency` workers run at once (provider rate-limit ceiling)
//   - each item is dispatched exactly once — no duplicate provider calls
//   - the result array preserves input order regardless of completion order
//   - one item's failure never rejects the batch; it is recorded per item
//   - an aborted signal stops dispatching new items; in-flight items settle
//     on their own (their fetches receive the same signal upstream) and items
//     never dispatched come back as { status: 'cancelled' }
export async function mapWithConcurrency(items = [], worker, { concurrency = 3, signal } = {}) {
  const results = items.map((_, index) => ({ status: 'cancelled', index }))
  let nextIndex = 0

  const lane = async () => {
    // Synchronous claim of nextIndex (no await between read and increment)
    // is what makes duplicate dispatch impossible.
    while (nextIndex < items.length && !signal?.aborted) {
      const index = nextIndex
      nextIndex += 1
      try {
        results[index] = { status: 'fulfilled', value: await worker(items[index], index), index }
      } catch (reason) {
        results[index] = { status: 'rejected', reason, index }
      }
    }
  }

  const lanes = Math.max(1, Math.min(Math.floor(concurrency) || 1, items.length))
  await Promise.all(Array.from({ length: lanes }, lane))
  return results
}
