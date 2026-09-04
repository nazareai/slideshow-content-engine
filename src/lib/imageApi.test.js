import { describe, expect, it, vi } from 'vitest'
import { buildImagePrompt, buildVisualBible, generateImage, imageExtension, parseImageResponse } from './imageApi'

describe('OpenRouter image generation', () => {
  it('builds a photographic 9:16 prompt without asking the model for text', () => {
    const prompt = buildImagePrompt({ role: 'Hook', visual: 'A founder staring at a silent analytics dashboard at night' }, { topic: 'content quality', audience: 'solo founders' })
    expect(prompt).toContain('Aspect ratio 9:16')
    expect(prompt).toContain('A founder staring at a silent analytics dashboard at night')
    expect(prompt).toContain('No typography')
  })

  it('uses one explicit visual bible across a series for continuity', () => {
    const bible = buildVisualBible({ topic: 'content quality', audience: 'solo founders' })
    const first = buildImagePrompt({ role: 'Hook', visual: 'A founder at a laptop' }, { topic: 'content quality', audience: 'solo founders' }, bible)
    const second = buildImagePrompt({ role: 'Payoff', visual: 'A reviewed draft on a desk' }, { topic: 'content quality', audience: 'solo founders' }, bible)
    expect(bible).toContain('consistent visual density and color grade')
    expect(first).toContain(bible)
    expect(second).toContain(bible)
  })

  it('times out stalled image requests', async () => {
    const fetchImpl = vi.fn((_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))))
    await expect(generateImage({ apiKey: 'test-key', prompt: 'scene', timeoutMs: 1, fetchImpl })).rejects.toThrow('timed out')
  })

  it('parses buffered base64 images', () => {
    expect(parseImageResponse({ data: [{ b64_json: 'YWJj', media_type: 'image/webp' }] })).toEqual({ dataUrl: 'data:image/webp;base64,YWJj', mediaType: 'image/webp', cost: null })
  })

  it('rejects successful responses that contain no image', () => {
    expect(() => parseImageResponse({ data: [] })).toThrow('no image data')
  })

  it('calls the documented endpoint with bearer authorization', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ b64_json: 'YWJj' }] }) })
    await generateImage({ apiKey: 'test-key', prompt: 'specific scene', fetchImpl })
    expect(fetchImpl).toHaveBeenCalledWith('https://openrouter.ai/api/v1/images', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer test-key' }) }))
  })

  it('fails loudly on authentication or API errors', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'Unauthorized' })
    await expect(generateImage({ apiKey: 'bad-key', prompt: 'scene', fetchImpl })).rejects.toThrow('401')
  })

  it('refuses missing credentials before network access', async () => {
    const fetchImpl = vi.fn()
    await expect(generateImage({ apiKey: '', prompt: 'scene', fetchImpl })).rejects.toThrow('API key')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('completes the buffered client path under 200ms with an immediate API response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ b64_json: 'YWJj' }] }) })
    const started = performance.now()
    await generateImage({ apiKey: 'test-key', prompt: 'specific scene', fetchImpl })
    expect(performance.now() - started).toBeLessThan(200)
  })

  it('uses valid file extensions', () => {
    expect(imageExtension('image/webp')).toBe('webp')
    expect(imageExtension('image/jpeg')).toBe('jpg')
    expect(imageExtension()).toBe('png')
  })
})
