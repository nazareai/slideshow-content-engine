import { describe, expect, it, vi } from 'vitest'
import { buildImagePrompt, buildVisualBible, generateImage, generateSlideImages, imageExtension, IMAGE_GENERATION_CONCURRENCY, parseImageResponse, planImagePrompts } from './imageApi'
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
    expect(cartoon).toContain('flat 2D cel-animation cartoon still')
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
  // The only medium wording buildImagePrompt itself contributes is this
  // protective negation; everything else must come from the style directive.
  const MEDIUM_GUARD = 'Render the frame strictly in the medium the style directive defines — if the style is drawn, printed, cut from paper, pixelated, sculpted, or meme-native, do not fall back to generic photography or 3D rendering.'
  const photographyLanguage = /photograph|photoreal|camera|lens\b|bokeh|dslr|f\/\d/i
  const dimensionalLanguage = /\b3D\b|CGI|\brender/i

  const sentMusePrompt = async (styleSelection, visual) => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ b64_json: 'YWJj' }] }) })
    const prompt = buildImagePrompt({ role: 'Hook', visual }, project, undefined, styleSelection)
    await generateImage({ apiKey: 'test-key', prompt, fetchImpl })
    return JSON.parse(fetchImpl.mock.calls[0][1].body).prompt
  }
  // Strip every style-owned segment (directive, closing hard-constraint block,
  // medium guard) so what remains is exactly the wrapper's own contribution.
  const outsideStyleDirective = (body, styleSelection) => {
    const resolved = resolveImageStyle(styleSelection)
    const fixed = IMAGE_STYLES.find((entry) => entry.id === resolved.id && !entry.editable)
    const styleOwned = [resolved.directive, MEDIUM_GUARD]
    if (fixed) styleOwned.push(`Final hard constraints for this ${fixed.name} frame — ${fixed.directive.negative}`)
    return styleOwned.reduce((rest, segment) => rest.split(segment).join(' '), body)
  }

  it('sends every cartoon-family payload with its own medium and zero photography language outside the style directive', async () => {
    const mediumNativeVisuals = {
      'cartoon-pop': 'A cel-shaded founder character slumped over a giant flatlining chart counter',
      'hand-doodle': 'A scribbled stick-figure founder sinking under a wobbly pile of crossed-out drafts',
      'comic-ink': 'An inked founder mid-shout as speed lines burst from a collapsing chart tower',
      'paper-collage': 'A torn-paper founder figure glued beside a zigzag construction-paper chart',
      'retro-pixel': 'A pixel-sprite founder pausing on a tiled platform under an indigo dithered sky',
      'clay-toy-3d': 'A clay founder figurine at a tiny felt desk buried in miniature paper stacks',
      'surreal-brainrot': 'A towering sneaker-toad hybrid mascot looming over a supermarket parking lot shrine',
    }
    const sentMediums = []
    for (const [id, visual] of Object.entries(mediumNativeVisuals)) {
      const style = IMAGE_STYLES.find((entry) => entry.id === id)
      const body = await sentMusePrompt(id, visual)
      sentMediums.push(style.directive.medium)
      expect(body, id).toContain(style.directive.medium)
      expect(body, id).not.toContain('Create one photorealistic vertical photograph')
      expect(body, id).not.toContain('concrete photorealistic vertical scene')
      expect(outsideStyleDirective(body, id), id).not.toMatch(photographyLanguage)
      // Every fixed style closes the payload with its own hard negative block.
      expect(body.endsWith(style.directive.negative), `${id} ends with its negatives`).toBe(true)
    }
    // Medium separation is real, not label-deep: no two payloads share a medium.
    expect(new Set(sentMediums).size).toBe(Object.keys(mediumNativeVisuals).length)
  })

  it('keeps the wrapper free of 3D/CGI/render language for the five flat cartoon media', async () => {
    const flatVisuals = {
      'cartoon-pop': 'A flat cel founder character frozen before a giant zero counter',
      'hand-doodle': 'A ballpoint doodle founder circled twice beside an angry margin note',
      'comic-ink': 'A halftone-shaded founder clenching a fist inside a tilted panel',
      'paper-collage': 'A construction-paper founder under a fringed paper sun',
      'retro-pixel': 'A pixel founder sprite idling beside a glowing save point',
    }
    for (const [id, visual] of Object.entries(flatVisuals)) {
      const style = IMAGE_STYLES.find((entry) => entry.id === id)
      const body = await sentMusePrompt(id, visual)
      expect(outsideStyleDirective(body, id), id).not.toMatch(dimensionalLanguage)
      // And the style's own negatives ban the full 3D vocabulary set.
      for (const banned of [/\b3D\b/, /CGI/i, /clay/i, /plastic/i, /photoreal/i, /camera/i, /lens/i]) {
        expect(style.directive.negative, `${id} bans ${banned}`).toMatch(banned)
      }
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

// The user-visible fix: independent frames must not be generated one by one.
// These tests drive generateSlideImages with delayed mocks and inspect the
// exact per-frame Muse payloads, concurrency profile, and result ordering.
describe('bounded parallel slide generation', () => {
  const project = { topic: 'content quality', audience: 'solo founders' }
  const slides = [
    { id: 1, role: 'Hook', visual: 'A flat cel founder frozen before a giant zero counter' },
    { id: 2, role: 'Context', visual: 'A flat two-tone room stacked with identical draft cards' },
    { id: 3, role: 'Tension', visual: 'A starburst wall cracking behind the founder character' },
    { id: 4, role: 'Shift', visual: 'One draft card glowing against a flat cobalt field' },
    { id: 5, role: 'CTA', visual: 'The founder character holding up a single finished card' },
  ]
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  const makePlans = () => planImagePrompts({ slides, project, styleSelection: 'cartoon-pop' })

  // Delayed mock endpoint: records concurrency profile and which plan each
  // request body belongs to, so ordering and payload fidelity are checkable.
  const makeDelayedFetch = (plans, { delayFor = () => 25, failIndexes = [] } = {}) => {
    let inFlight = 0
    let maxInFlight = 0
    const postedPrompts = []
    const fetchImpl = vi.fn(async (_url, request) => {
      const { prompt } = JSON.parse(request.body)
      const planIndex = plans.findIndex((plan) => plan.prompt === prompt)
      postedPrompts.push(prompt)
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await sleep(delayFor(planIndex))
      inFlight -= 1
      if (failIndexes.includes(planIndex)) return { ok: false, status: 500, text: async () => `mock failure for plan ${planIndex}` }
      return { ok: true, json: async () => ({ data: [{ b64_json: `frame-${planIndex}` }] }) }
    })
    return { fetchImpl, stats: () => ({ maxInFlight, postedPrompts }) }
  }

  it('plans one exact provider prompt per slide, in slide order', () => {
    const plans = makePlans()
    expect(plans.map((plan) => plan.slideId)).toEqual([1, 2, 3, 4, 5])
    expect(new Set(plans.map((plan) => plan.prompt)).size).toBe(5)
    plans.forEach((plan, index) => {
      expect(plan.index).toBe(index)
      expect(plan.prompt).toContain(slides[index].visual)
      expect(plan.prompt).toContain(resolveImageStyle('cartoon-pop').directive)
    })
  })

  it('overlaps requests up to the pool cap and returns results in plan order despite reversed completion order', async () => {
    const plans = makePlans()
    // Earlier frames are the slowest, so completion order is reversed.
    const { fetchImpl, stats } = makeDelayedFetch(plans, { delayFor: (index) => 90 - index * 18 })
    const landed = []
    const results = await generateSlideImages({ plans, apiKey: 'test-key', fetchImpl, onFrame: (frame) => { landed.push(frame.slideId) } })

    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled', 'fulfilled', 'fulfilled'])
    expect(results.map((result) => result.slideId)).toEqual([1, 2, 3, 4, 5])
    results.forEach((result, index) => {
      expect(result.dataUrl, `frame ${index} got its own image`).toContain(`base64,frame-${index}`)
    })
    expect(landed).not.toEqual([1, 2, 3, 4, 5]) // frames really landed out of order
    expect(stats().maxInFlight).toBeGreaterThanOrEqual(2)
    expect(stats().maxInFlight).toBeLessThanOrEqual(IMAGE_GENERATION_CONCURRENCY)
  })

  it('posts each planned payload exactly once — no duplicate provider calls', async () => {
    const plans = makePlans()
    const { fetchImpl, stats } = makeDelayedFetch(plans, { delayFor: () => 10 })
    await generateSlideImages({ plans, apiKey: 'test-key', fetchImpl })
    expect(fetchImpl).toHaveBeenCalledTimes(5)
    expect([...stats().postedPrompts].sort()).toEqual(plans.map((plan) => plan.prompt).sort())
    expect(new Set(stats().postedPrompts).size).toBe(5)
  })

  it('records a per-frame failure without blocking or discarding the other frames', async () => {
    const plans = makePlans()
    const { fetchImpl } = makeDelayedFetch(plans, { delayFor: () => 10, failIndexes: [2] })
    const results = await generateSlideImages({ plans, apiKey: 'test-key', fetchImpl })

    expect(fetchImpl).toHaveBeenCalledTimes(5) // the old serial loop stopped at the first failure
    expect(results[2].status).toBe('rejected')
    expect(results[2].slideId).toBe(3)
    expect(results[2].reason.message).toContain('500')
    for (const index of [0, 1, 3, 4]) expect(results[index].status, `frame ${index}`).toBe('fulfilled')
  })

  it('counts an onFrame compositing failure against that frame only', async () => {
    const plans = makePlans()
    const { fetchImpl } = makeDelayedFetch(plans, { delayFor: () => 5 })
    const results = await generateSlideImages({
      plans, apiKey: 'test-key', fetchImpl,
      onFrame: (frame) => { if (frame.slideId === 2) throw new Error('compose blew up') },
    })
    expect(results[1].status).toBe('rejected')
    expect(results[1].reason.message).toBe('compose blew up')
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(4)
  })

  it('cancellation stops undispatched frames before they are billed and keeps finished frames', async () => {
    const plans = makePlans()
    const controller = new AbortController()
    const { fetchImpl } = makeDelayedFetch(plans, { delayFor: () => 20 })
    const results = await generateSlideImages({
      plans, apiKey: 'test-key', fetchImpl, concurrency: 1, signal: controller.signal,
      onFrame: (frame) => { if (frame.slideId === 1) controller.abort() },
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1) // frames 2-5 were never dispatched
    expect(results[0].status).toBe('fulfilled')
    expect(results.slice(1).map((result) => result.status)).toEqual(['cancelled', 'cancelled', 'cancelled', 'cancelled'])
  })

  it('cancellation aborts in-flight requests and reports them as cancelled, not failed', async () => {
    const plans = makePlans()
    const controller = new AbortController()
    const fetchImpl = vi.fn((_url, { signal }) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve({ ok: true, json: async () => ({ data: [{ b64_json: 'YWJj' }] }) }), 500)
      signal.addEventListener('abort', () => { clearTimeout(timer); reject(Object.assign(new Error('aborted'), { name: 'AbortError' })) })
    }))
    const pending = generateSlideImages({ plans, apiKey: 'test-key', fetchImpl, signal: controller.signal })
    await sleep(20)
    controller.abort()
    const results = await pending
    expect(results.every((result) => result.status === 'cancelled')).toBe(true)
    expect(results.some((result) => result.status === 'rejected')).toBe(false)
  })

  it('finishes measurably faster than the serial baseline on identical delayed frames', async () => {
    const plans = makePlans()
    const frameDelay = 40

    const serialFetch = makeDelayedFetch(plans, { delayFor: () => frameDelay }).fetchImpl
    const serialStart = performance.now()
    await generateSlideImages({ plans, apiKey: 'test-key', fetchImpl: serialFetch, concurrency: 1 })
    const serialElapsed = performance.now() - serialStart

    const pooledFetch = makeDelayedFetch(plans, { delayFor: () => frameDelay }).fetchImpl
    const pooledStart = performance.now()
    await generateSlideImages({ plans, apiKey: 'test-key', fetchImpl: pooledFetch, concurrency: IMAGE_GENERATION_CONCURRENCY })
    const pooledElapsed = performance.now() - pooledStart

    // 5 frames × 40ms: serial ≈ 200ms, pool of 3 ≈ 80ms. Generous margin for CI.
    console.info(`[measure] ${plans.length} mocked frames × ${frameDelay}ms: serial ${serialElapsed.toFixed(0)}ms vs pooled(${IMAGE_GENERATION_CONCURRENCY}) ${pooledElapsed.toFixed(0)}ms — ${(serialElapsed / pooledElapsed).toFixed(1)}× speedup`)
    expect(pooledElapsed).toBeLessThan(serialElapsed * 0.75)
  })
})
