import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_TEXT_MODEL, generateStory, parseStoryResponse } from './textApi'
import { IMAGE_STYLES } from './imageStyles'

const validStory = {
  hooks: [
    { text: 'I automated distribution before the content deserved it', score: 94 },
    { text: 'The pipeline worked. The posts still failed.', score: 89 },
    { text: 'Automation exposed the weak part of my content system', score: 87 },
    { text: 'The drafts shipped faster than anyone wanted them', score: 84 },
    { text: 'My publishing bottleneck was never publishing', score: 82 },
  ],
  selectedHook: 'I automated distribution before the content deserved it',
  slides: [
    { role: 'Hook', text: 'I automated distribution before the content deserved it', visual: 'Founder looking at an empty analytics dashboard at night', layout: 'impact-stack', emphasis: 'deserved', focalPoint: { x: 0.5, y: 0.55 } },
    { role: 'Context', text: 'The pipeline shipped every draft on time.', visual: 'Automated conveyor moving identical paper sheets', layout: 'editorial-split', emphasis: 'pipeline', focalPoint: { x: 0.5, y: 0.35 } },
    { role: 'Tension', text: 'Nobody wanted to save any of them.', visual: 'Phone screen with flat save activity beside discarded notes', layout: 'tension-rail', emphasis: 'Nobody', focalPoint: { x: 0.7, y: 0.4 } },
    { role: 'Evidence', text: 'Publishing worked. Taste was the bottleneck.', visual: 'Two labeled workshop stations, one moving and one stalled', layout: 'evidence-card', emphasis: 'bottleneck', focalPoint: { x: 0.6, y: 0.3 } },
    { role: 'Shift', text: 'So I stopped scaling output.', visual: 'Hand switching off a large production machine', layout: 'spotlight-reveal', emphasis: 'stopped', focalPoint: { x: 0.5, y: 0.3 } },
    { role: 'Payoff', text: 'Now every idea must earn distribution.', visual: 'Single marked card passing through a quality gate', layout: 'takeaway-ledger', emphasis: 'earn', focalPoint: { x: 0.5, y: 0.3 } },
  ],
  caption: 'Distribution cannot rescue weak content. Build the taste loop first.'
}

describe('OpenRouter text generation', () => {
  it('defaults to the requested GPT-5.6 Luna model and returns a complete story', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(validStory) } }] }),
    })

    const story = await generateStory({
      apiKey: 'test-key', model: DEFAULT_TEXT_MODEL, topic: 'content automation', audience: 'founders',
      angle: validStory.selectedHook, observation: 'The pipe worked but drafts were weak.', source: 'Build notes', slideCount: 6, fetchImpl,
    })

    expect(DEFAULT_TEXT_MODEL).toBe('openai/gpt-5.6-luna')
    expect(story.slides).toHaveLength(6)
    expect(fetchImpl).toHaveBeenCalledWith('https://openrouter.ai/api/v1/chat/completions', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('openai/gpt-5.6-luna'),
    }))
    const requestBody = JSON.parse(fetchImpl.mock.calls[0][1].body)
    expect(requestBody.response_format.json_schema.schema.properties.slides.items.required).toEqual(expect.arrayContaining(['layout', 'emphasis', 'focalPoint']))
    expect(requestBody.response_format.json_schema.schema.properties.slides.items.properties.layout.enum).toContain('impact-stack')
    expect(requestBody.messages[0].content).toContain('focalPoint')
  })

  it('attaches validated art direction to every slide from the model metadata', () => {
    const story = parseStoryResponse({ choices: [{ message: { content: JSON.stringify(validStory) } }] }, 6)
    expect(story.slides.every((slide) => slide.direction?.layout && slide.direction.focalPoint && typeof slide.direction.mirror === 'boolean')).toBe(true)
    expect(story.slides[0].direction.layout).toBe('impact-stack')
    expect(story.slides[3].direction.emphasis).toBe('bottleneck')
    expect(story.slides[2].direction.focalPoint).toEqual({ x: 0.7, y: 0.4 })
  })

  it('derives art direction instead of failing when the model returns junk metadata', () => {
    const junk = {
      ...validStory,
      slides: validStory.slides.map((slide) => ({ ...slide, layout: 'centered-text-box', emphasis: 'wordnotinslide', focalPoint: { x: 40, y: -2 } })),
    }
    const story = parseStoryResponse({ choices: [{ message: { content: JSON.stringify(junk) } }] }, 6)
    expect(story.slides[0].direction.layout).toBe('impact-stack')
    story.slides.forEach((slide) => {
      expect(slide.direction.focalPoint.x).toBeLessThanOrEqual(0.88)
      expect(slide.direction.focalPoint.y).toBeGreaterThanOrEqual(0.12)
      expect(slide.text.toLowerCase()).toContain(slide.direction.emphasis.toLowerCase())
    })
  })

  it('repairs a monotone layout sequence into a diverse, non-repeating rhythm', () => {
    const monotone = {
      ...validStory,
      slides: validStory.slides.map((slide) => ({ ...slide, layout: 'editorial-split' })),
    }
    const story = parseStoryResponse({ choices: [{ message: { content: JSON.stringify(monotone) } }] }, 6)
    const layouts = story.slides.map((slide) => slide.direction.layout)
    layouts.forEach((layout, index) => { if (index > 0) expect(layout).not.toBe(layouts[index - 1]) })
    expect(new Set(layouts).size).toBeGreaterThanOrEqual(5)
  })

  it('rejects malformed output instead of silently using incomplete slides', () => {
    expect(() => parseStoryResponse({ choices: [{ message: { content: '{"slides":[]}' } }] }, 6)).toThrow('complete story')
  })

  it('rejects too few hooks, invalid scores, and paragraph-sized slide copy', () => {
    expect(() => parseStoryResponse({ choices: [{ message: { content: JSON.stringify({ ...validStory, hooks: validStory.hooks.slice(0, 2) }) } }] }, 6)).toThrow('complete story')
    const badScore = { ...validStory, hooks: Array.from({ length: 5 }, (_, index) => ({ text: `Hook ${index}`, score: index === 0 ? 101 : 80 })) }
    expect(() => parseStoryResponse({ choices: [{ message: { content: JSON.stringify(badScore) } }] }, 6)).toThrow('complete story')
    const paragraph = { ...validStory, hooks: Array.from({ length: 5 }, (_, index) => ({ text: `Hook ${index}`, score: 80 })), slides: validStory.slides.map((slide, index) => index ? slide : { ...slide, text: Array.from({ length: 20 }, () => 'word').join(' ') }) }
    expect(() => parseStoryResponse({ choices: [{ message: { content: JSON.stringify(paragraph) } }] }, 6)).toThrow('complete story')
    const wide = { ...validStory, slides: validStory.slides.map((slide, index) => index ? slide : { ...slide, text: Array.from({ length: 16 }, () => 'abcdefghijklmnopqrstuvwx').join(' ') }) }
    expect(() => parseStoryResponse({ choices: [{ message: { content: JSON.stringify(wide) } }] }, 6)).toThrow('complete story')
  })

  it('rejects a selected hook that is not the highest-scoring returned hook', () => {
    const wrong = { ...validStory, selectedHook: validStory.hooks[1].text }
    expect(() => parseStoryResponse({ choices: [{ message: { content: JSON.stringify(wrong) } }] }, 6)).toThrow('complete story')
  })

  it('times out stalled requests with a retryable error', async () => {
    const fetchImpl = vi.fn((_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))))
    await expect(generateStory({ apiKey: 'test-key', model: DEFAULT_TEXT_MODEL, slideCount: 6, timeoutMs: 1, fetchImpl })).rejects.toThrow('timed out')
  })

  it('refuses a missing API key before network access', async () => {
    const fetchImpl = vi.fn()
    await expect(generateStory({ apiKey: '', model: DEFAULT_TEXT_MODEL, slideCount: 6, fetchImpl })).rejects.toThrow('API key')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('image style is authoritative in the story request body', () => {
  const styleById = (id) => IMAGE_STYLES.find((style) => style.id === id)
  // Sends a real generateStory call through a mocked fetch and returns the
  // system prompt exactly as it left for OpenRouter.
  const sentSystemPrompt = async (imageStyle) => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(validStory) } }] }) })
    await generateStory({ apiKey: 'test-key', topic: 'content automation', audience: 'founders', angle: 'x', observation: 'o', source: 's', slideCount: 6, imageStyle, fetchImpl })
    return JSON.parse(fetchImpl.mock.calls[0][1].body).messages[0].content
  }

  it('briefs Luna in each illustrated and meme medium with zero photorealistic default', async () => {
    for (const id of ['surreal-brainrot', 'cartoon-pop', 'clay-toy-3d', 'retro-pixel']) {
      const style = styleById(id)
      const sys = await sentSystemPrompt(id)
      expect(sys, id).toContain(style.directive.medium)
      expect(sys, id).toContain(style.directive.subject)
      expect(sys, id).not.toContain('concrete photorealistic vertical scene')
      expect(sys, id).not.toMatch(/photorealistic/i)
      expect(sys, id).toContain('never describe a scene as a real photograph')
    }
  })

  it('keeps capture styles fully photographic through their own medium', async () => {
    expect(await sentSystemPrompt('creator-candid')).toContain('smartphone main camera')
    expect(await sentSystemPrompt('direct-flash')).toContain('hard on-camera flash')
    const cinematic = await sentSystemPrompt('cinematic')
    expect(cinematic).toContain('photorealistic film still')
    expect(cinematic).toContain('These frames are real photography')
  })

  it('defaults to the capture default style when no image style is supplied', async () => {
    const sys = await sentSystemPrompt(undefined)
    expect(sys).toContain('smartphone main camera')
    expect(sys).toContain('These frames are real photography')
  })

  it('lets a custom style drive the medium verbatim — photography only if the user wrote it', async () => {
    const embroidered = await sentSystemPrompt({ styleId: 'custom', customText: 'everything embroidered in thick thread on stretched linen' })
    expect(embroidered).toContain('everything embroidered in thick thread on stretched linen')
    expect(embroidered).not.toMatch(/photorealistic/i)
    expect(embroidered).toContain('only use real-camera photography language if the direction itself asks for it')

    const filmic = await sentSystemPrompt({ styleId: 'custom', customText: 'grainy 35mm street photography, harsh daylight' })
    expect(filmic).toContain('grainy 35mm street photography, harsh daylight')
  })
})
