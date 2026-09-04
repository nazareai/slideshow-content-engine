import { describe, expect, it, vi } from 'vitest'
import { buildImagePrompt, buildVisualBible, generateImage, imageExtension, parseImageResponse } from './imageApi'
import { IMAGE_STYLES, resolveImageStyle } from './imageStyles'
import { parseStoryResponse } from './textApi'

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

// Regression guard for the authoritative-medium fix: assertions run against the
// request body actually posted to the Muse endpoint, not an intermediate string.
describe('final Muse request body is style-authoritative', () => {
  const project = { topic: 'content quality', audience: 'solo founders' }
  // The only photography wording buildImagePrompt itself contributes is this
  // protective negation; everything else must come from the style directive.
  const MEDIUM_GUARD = 'do not fall back to generic photography'
  const photographyLanguage = /photograph|photoreal|camera|lens\b|bokeh|dslr|f\/\d/i

  const sentMusePrompt = async (styleSelection, visual) => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ b64_json: 'YWJj' }] }) })
    const prompt = buildImagePrompt({ role: 'Hook', visual }, project, undefined, styleSelection)
    await generateImage({ apiKey: 'test-key', prompt, fetchImpl })
    return JSON.parse(fetchImpl.mock.calls[0][1].body).prompt
  }
  const outsideStyleDirective = (body, styleSelection) =>
    body.split(resolveImageStyle(styleSelection).directive).join(' ').split(MEDIUM_GUARD).join(' ')

  it('sends Surreal Brainrot, Cartoon Pop, Clay & Toy 3D, and Retro Pixel payloads free of global photography language', async () => {
    const mediumNativeVisuals = {
      'surreal-brainrot': 'A towering sneaker-toad hybrid mascot looming over a supermarket parking lot shrine',
      'cartoon-pop': 'A cel-shaded founder character slumped over a giant flatlining chart counter',
      'clay-toy-3d': 'A clay founder figurine at a tiny felt desk buried in miniature paper stacks',
      'retro-pixel': 'A pixel-sprite founder pausing on a tiled platform under an indigo dithered sky',
    }
    for (const [id, visual] of Object.entries(mediumNativeVisuals)) {
      const style = IMAGE_STYLES.find((entry) => entry.id === id)
      const body = await sentMusePrompt(id, visual)
      expect(body, id).toContain(style.directive.medium)
      expect(body, id).not.toContain('Create one photorealistic vertical photograph')
      expect(body, id).not.toContain('concrete photorealistic vertical scene')
      expect(outsideStyleDirective(body, id), id).not.toMatch(photographyLanguage)
    }
  })

  it('sends capture payloads that stay photographic via their own medium', async () => {
    expect(await sentMusePrompt('creator-candid', 'A founder at a cluttered desk at night')).toContain('smartphone main camera')
    expect(await sentMusePrompt('direct-flash', 'A founder caught mid-turn in a dark hallway')).toContain('hard on-camera flash')
    expect(await sentMusePrompt('cinematic', 'A founder silhouetted against a rain-streaked window')).toContain('photorealistic film still')
  })

  it('lets a custom style put photography language in the payload only because the user asked for it', async () => {
    const body = await sentMusePrompt({ styleId: 'custom', customText: 'grainy 35mm street photography, harsh daylight' }, 'A founder crossing an empty intersection')
    expect(body).toContain('grainy 35mm street photography, harsh daylight')
  })

  it('carries story visual directions through to Muse payloads with zero global photography leakage (full pipeline)', async () => {
    const hooks = Array.from({ length: 5 }, (_, index) => ({ text: `Hook candidate number ${index} for the saga`, score: 60 + index }))
    const story = parseStoryResponse({ choices: [{ message: { content: JSON.stringify({
      hooks,
      selectedHook: hooks[4].text,
      slides: [
        { role: 'Hook', text: 'The parking lot chose its own legendary guardian', visual: 'A giant sneaker-toad hybrid mascot towering over a supermarket parking lot shrine', layout: 'impact-stack', emphasis: 'guardian', focalPoint: { x: 0.5, y: 0.6 } },
        { role: 'Context', text: 'Every visitor left an offering at dawn', visual: 'Rows of tiny glowing offerings stacked before the melted-render mascot', layout: 'editorial-split', emphasis: 'offering', focalPoint: { x: 0.5, y: 0.35 } },
        { role: 'Tension', text: 'Then the shrine went completely silent', visual: 'The empty shrine arena under a clipped radioactive-green sky', layout: 'tension-rail', emphasis: 'silent', focalPoint: { x: 0.7, y: 0.4 } },
        { role: 'Shift', text: 'The guardian had simply changed arenas', visual: 'The hybrid mascot posed tiny on a dinner plate in a classroom', layout: 'spotlight-reveal', emphasis: 'arenas', focalPoint: { x: 0.5, y: 0.3 } },
        { role: 'Payoff', text: 'The lore was fake, the lesson was real', visual: 'Awed onlookers bowing before the deadpan mascot in a bathroom arena', layout: 'takeaway-ledger', emphasis: 'lesson', focalPoint: { x: 0.5, y: 0.3 } },
      ],
      caption: 'Fake lore, real lesson.',
    }) } }] }, 5)

    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ b64_json: 'YWJj' }] }) })
    const bible = buildVisualBible(project, 'surreal-brainrot')
    for (const storySlide of story.slides) {
      const prompt = buildImagePrompt(storySlide, project, bible, 'surreal-brainrot')
      await generateImage({ apiKey: 'test-key', prompt, fetchImpl })
    }

    expect(fetchImpl).toHaveBeenCalledTimes(5)
    for (const [, request] of fetchImpl.mock.calls) {
      const body = JSON.parse(request.body).prompt
      expect(body).toContain(IMAGE_STYLES.find((entry) => entry.id === 'surreal-brainrot').directive.medium)
      expect(outsideStyleDirective(body, 'surreal-brainrot')).not.toMatch(photographyLanguage)
    }
  })
})
