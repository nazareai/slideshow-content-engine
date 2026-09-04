import { describe, expect, it, vi } from 'vitest'
import { buildImagePrompt, buildVisualBible, generateImage, imageExtension, parseImageResponse } from './imageApi'
import { IMAGE_STYLES, resolveImageStyle } from './imageStyles'

describe('OpenRouter image generation', () => {
  it('builds a 9:16 prompt without asking the model for text', () => {
    const prompt = buildImagePrompt({ role: 'Hook', visual: 'A founder staring at a silent analytics dashboard at night' }, { topic: 'content quality', audience: 'solo founders' })
    expect(prompt).toContain('Aspect ratio 9:16')
    expect(prompt).toContain('A founder staring at a silent analytics dashboard at night')
    expect(prompt).toContain('No typography')
  })

  it('uses one explicit visual bible across a series for continuity', () => {
    const bible = buildVisualBible({ topic: 'content quality', audience: 'solo founders' })
    const first = buildImagePrompt({ role: 'Hook', visual: 'A founder at a laptop' }, { topic: 'content quality', audience: 'solo founders' }, bible)
    const second = buildImagePrompt({ role: 'Payoff', visual: 'A reviewed draft on a desk' }, { topic: 'content quality', audience: 'solo founders' }, bible)
    expect(bible).toContain('consistent visual density and palette')
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

describe('image style directives in prompts', () => {
  const slide = { role: 'Hook', visual: 'A founder staring at a silent analytics dashboard at night' }
  const project = { topic: 'content quality', audience: 'solo founders' }
  const fixedStyles = IMAGE_STYLES.filter((style) => !style.editable)

  it('embeds every selected style directive and yields materially different prompts per style', () => {
    const prompts = fixedStyles.map((style) => buildImagePrompt(slide, project, undefined, style.id))
    prompts.forEach((prompt, index) => {
      const style = fixedStyles[index]
      expect(prompt, style.id).toContain(resolveImageStyle(style.id).directive)
      // The directive carries the full material change: medium and negatives included.
      expect(prompt, `${style.id} medium`).toContain(style.directive.medium)
      expect(prompt, `${style.id} negatives`).toContain(style.directive.negative)
      expect(prompt, `${style.id} palette`).toContain(style.directive.palette)
    })
    expect(new Set(prompts).size).toBe(fixedStyles.length)
  })

  it('no longer forces every style into photography — the medium comes from the style', () => {
    const cartoon = buildImagePrompt(slide, project, undefined, 'cartoon-pop')
    expect(cartoon).not.toContain('Create one photorealistic vertical photograph')
    expect(cartoon).toContain('flat 2D digital cartoon illustration')
    expect(cartoon).toContain('do not fall back to generic photography')

    const brainrot = buildImagePrompt(slide, project, undefined, 'surreal-brainrot')
    expect(brainrot).toMatch(/hybrid/i)
    expect(brainrot).toMatch(/lore|saga/i)

    // Capture styles still read as photography — via their own medium, not a global default.
    const candid = buildImagePrompt(slide, project, undefined, 'creator-candid')
    expect(candid).toContain('smartphone main camera')
  })

  it('does not globally ban the mechanics meme-native styles are made of', () => {
    const cursed = buildImagePrompt(slide, project, undefined, 'cursed-collage')
    expect(cursed).toContain('mixed-media digital collage')
    expect(cursed).not.toMatch(/No [^.]*collages/)
    // But lettering stays universally banned — the app composites approved text locally.
    expect(cursed).toContain('No typography, lettering, captions')
    const fried = buildImagePrompt(slide, project, undefined, 'deep-fried')
    expect(fried).toContain('recompressed until it crunches')
  })

  it('embeds the style in the visual bible so the whole series inherits it', () => {
    for (const style of fixedStyles) {
      const bible = buildVisualBible(project, style.id)
      expect(bible).toContain(resolveImageStyle(style.id).directive)
      expect(bible).toContain('consistent visual density and palette')
    }
  })

  it('preserves 9:16 framing, text-safe negative space, and the no-typography rule for every style', () => {
    for (const style of IMAGE_STYLES) {
      const prompt = buildImagePrompt(slide, project, undefined, { styleId: style.id, customText: 'neon grunge night market' })
      expect(prompt, style.id).toContain('Aspect ratio 9:16')
      expect(prompt, style.id).toContain('text-safe negative space')
      expect(prompt, style.id).toContain('No typography')
    }
  })

  it('routes the Custom style direction into the bible and every prompt', () => {
    const selection = { styleId: 'custom', customText: 'wet-plate collodion portraits with scratched emulsion' }
    const bible = buildVisualBible(project, selection)
    expect(bible).toContain('wet-plate collodion portraits with scratched emulsion')
    expect(buildImagePrompt(slide, project, bible, selection)).toContain('wet-plate collodion portraits with scratched emulsion')
    expect(buildImagePrompt(slide, project, undefined, selection)).toContain('wet-plate collodion portraits with scratched emulsion')
  })

  it('defaults to Creator Candid instead of any generic professional look', () => {
    const prompt = buildImagePrompt(slide, project)
    expect(prompt).toContain('Creator Candid image style')
    expect(prompt).not.toMatch(/professional/i)
  })
})
