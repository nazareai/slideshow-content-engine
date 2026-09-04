// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID, webcrypto } from 'node:crypto'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { resolveImageStyle } from './lib/imageStyles'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
if (!globalThis.crypto) globalThis.crypto = webcrypto
if (!globalThis.crypto.randomUUID) globalThis.crypto.randomUUID = randomUUID

// jsdom has no real canvas: the production compositor would await image
// decodes that never happen and stall every pool lane after its first frame.
// Composition correctness is covered by compositor.test.js; here it is mocked
// so app-level generation flows can run to completion.
vi.mock('./lib/compositor', () => ({
  composeSlideDataUrl: vi.fn(async () => ({ blob: new Blob(['composed']), dataUrl: 'data:image/png;base64,QUFB' })),
  composeContactSheet: vi.fn(async () => new Blob(['sheet'])),
  loadImage: vi.fn(async () => ({})),
}))

const { default: App } = await import('./App.jsx')

function setFieldValue(element, value) {
  const proto = element instanceof window.HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(element, value)
  element.dispatchEvent(new window.Event('input', { bubbles: true }))
}

const byRole = (group, name) => [...group.querySelectorAll('[role="radio"]')].find((radio) => radio.textContent.includes(name))
const generateButton = () => [...document.querySelectorAll('button')].find((button) => button.textContent.includes('Generate finished slides'))
const imageStyleGroup = () => document.querySelector('[role="radiogroup"][aria-label="Image generation style"]')
const designPresetGroup = () => document.querySelector('[role="radiogroup"][aria-label="Slide design preset"]')
const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 25)))

describe('image style selection in the app', () => {
  let container, root

  beforeEach(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root.render(<App />))
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  it('offers the full TikTok-native taxonomy as a control separate from the slide design preset', () => {
    const styleGroup = imageStyleGroup()
    const designGroup = designPresetGroup()
    expect(styleGroup).toBeTruthy()
    expect(designGroup).toBeTruthy()
    expect(styleGroup).not.toBe(designGroup)
    const styleNames = [
      'Creator Candid', 'Direct Flash', 'Cinematic',
      'Flat 2D Cartoon', 'Hand-Drawn Doodle', 'Comic Ink & Halftone', 'Cut-Paper Collage', 'Clay & Toy 3D', 'Retro Pixel Art',
      'Surreal Brainrot', 'Deep-Fried Meme', 'Cursed Collage', 'Y2K Web Chaos',
      'Custom',
    ]
    expect(styleGroup.querySelectorAll('[role="radio"]')).toHaveLength(14)
    styleNames.forEach((name) => expect(byRole(styleGroup, name), name).toBeTruthy())
    expect(styleGroup.textContent).not.toMatch(/professional/i)
  })

  it('shows the choices grouped by category, each with a visual swatch and a description', () => {
    const styleGroup = imageStyleGroup()
    for (const groupId of ['capture', 'illustrated', 'meme', 'custom']) {
      expect(styleGroup.querySelector(`[data-style-group="${groupId}"]`), groupId).toBeTruthy()
    }
    expect(styleGroup.textContent).toContain('Capture')
    expect(styleGroup.textContent).toContain('Illustration & transformation')
    expect(styleGroup.textContent).toContain('Meme-native')
    for (const radio of styleGroup.querySelectorAll('[role="radio"]')) {
      const swatch = radio.querySelector('span[aria-hidden="true"]')
      expect(swatch, radio.textContent).toBeTruthy()
      expect(swatch.getAttribute('style')).toContain('linear-gradient')
      expect(radio.querySelectorAll('p')[1].textContent.length).toBeGreaterThan(20)
    }
  })

  it('places the image style selector before the image generation control', () => {
    const styleGroup = imageStyleGroup()
    const button = generateButton()
    expect(button).toBeTruthy()
    expect(styleGroup.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps image style and slide design preset selections independent', async () => {
    await act(async () => byRole(imageStyleGroup(), 'Flat 2D Cartoon').click())
    expect(byRole(imageStyleGroup(), 'Flat 2D Cartoon').getAttribute('aria-checked')).toBe('true')
    expect(byRole(designPresetGroup(), 'Bold Impact').getAttribute('aria-checked')).toBe('true')

    await act(async () => byRole(designPresetGroup(), 'Zine Punch').click())
    expect(byRole(designPresetGroup(), 'Zine Punch').getAttribute('aria-checked')).toBe('true')
    expect(byRole(imageStyleGroup(), 'Flat 2D Cartoon').getAttribute('aria-checked')).toBe('true')
  })

  it('sends the style selected before generation inside the actual image request', async () => {
    const fetchSpy = vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ b64_json: 'YWJj' }] }) }))
    vi.stubGlobal('fetch', fetchSpy)

    await act(async () => byRole(imageStyleGroup(), 'Surreal Brainrot').click())
    await act(async () => setFieldValue(document.querySelector('input[aria-label="OpenRouter API key"]'), 'sk-or-test'))
    await act(async () => generateButton().click())
    await flush()

    expect(fetchSpy).toHaveBeenCalled()
    const [url, request] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://openrouter.ai/api/v1/images')
    const body = JSON.parse(request.body)
    expect(body.prompt).toContain(resolveImageStyle('surreal-brainrot').directive)
    expect(body.prompt).toContain('Aspect ratio 9:16')
    expect(body.prompt).toContain('text-safe negative space')
    expect(body.prompt).not.toContain('Create one photorealistic vertical photograph')
  })

  it('sends the selected style medium inside the actual story request, replacing the photorealistic default', async () => {
    const hooks = Array.from({ length: 5 }, (_, index) => ({ text: `Hook candidate number ${index} for this story`, score: 60 + index }))
    const storyResponse = {
      hooks,
      selectedHook: hooks[4].text,
      slides: [
        { role: 'Hook', text: 'The dashboard sprite finally stopped blinking', visual: 'A pixel-sprite founder frozen before a dark tiled dashboard wall', layout: 'impact-stack', emphasis: 'blinking', focalPoint: { x: 0.5, y: 0.6 } },
        { role: 'Context', text: 'Every level shipped exactly on schedule', visual: 'A conveyor of identical pixel crates rolling across a platform', layout: 'editorial-split', emphasis: 'schedule', focalPoint: { x: 0.5, y: 0.35 } },
        { role: 'Tension', text: 'No player ever saved the game', visual: 'An untouched glowing save-point orb in an empty pixel corridor', layout: 'tension-rail', emphasis: 'saved', focalPoint: { x: 0.7, y: 0.4 } },
        { role: 'Shift', text: 'So the sprite rebuilt one single level', visual: 'The founder sprite placing one glowing tile with care', layout: 'spotlight-reveal', emphasis: 'single', focalPoint: { x: 0.5, y: 0.3 } },
        { role: 'Payoff', text: 'One earned level beats ten empty worlds', visual: 'A small finished pixel level shining under an indigo sky', layout: 'takeaway-ledger', emphasis: 'earned', focalPoint: { x: 0.5, y: 0.3 } },
      ],
      caption: 'Ship one level players actually save.',
    }
    const fetchSpy = vi.fn(async (url) => url.includes('/chat/completions')
      ? { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(storyResponse) } }] }) }
      : { ok: true, json: async () => ({ data: [{ b64_json: 'YWJj' }] }) })
    vi.stubGlobal('fetch', fetchSpy)

    await act(async () => byRole(imageStyleGroup(), 'Retro Pixel Art').click())
    await act(async () => setFieldValue(document.querySelector('input[aria-label="OpenRouter API key"]'), 'sk-or-test'))
    const storyButton = [...document.querySelectorAll('button')].find((button) => button.textContent.includes('Generate AI hooks + story'))
    await act(async () => storyButton.click())
    await flush()

    const storyCall = fetchSpy.mock.calls.find(([url]) => url.includes('/chat/completions'))
    expect(storyCall).toBeTruthy()
    const systemPrompt = JSON.parse(storyCall[1].body).messages[0].content
    expect(systemPrompt).toContain('Chunky low-resolution pixel art')
    expect(systemPrompt).not.toMatch(/photorealistic/i)
    expect(systemPrompt).not.toContain('concrete photorealistic vertical scene')
  })

  it('generates independent frames in parallel with bounded concurrency and one exact payload per frame', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const prompts = []
    const fetchSpy = vi.fn(async (_url, request) => {
      prompts.push(JSON.parse(request.body).prompt)
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 40))
      inFlight -= 1
      return { ok: true, json: async () => ({ data: [{ b64_json: 'YWJj' }] }) }
    })
    vi.stubGlobal('fetch', fetchSpy)

    await act(async () => byRole(imageStyleGroup(), 'Flat 2D Cartoon').click())
    await act(async () => setFieldValue(document.querySelector('input[aria-label="OpenRouter API key"]'), 'sk-or-test'))
    await act(async () => generateButton().click())
    for (let attempt = 0; attempt < 40 && (fetchSpy.mock.calls.length < 5 || inFlight > 0); attempt += 1) await flush()
    await flush()

    expect(fetchSpy).toHaveBeenCalledTimes(5) // one call per slide, never duplicated
    expect(new Set(prompts).size).toBe(5) // five distinct per-frame payloads
    prompts.forEach((prompt) => expect(prompt).toContain(resolveImageStyle('cartoon-pop').directive))
    expect(maxInFlight).toBeGreaterThanOrEqual(2) // frames really overlapped …
    expect(maxInFlight).toBeLessThanOrEqual(3) // … but stayed under the pool cap
  })

  it('cancelling an in-progress run stops undispatched frames and reports the cancellation', async () => {
    const fetchSpy = vi.fn((_url, { signal }) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve({ ok: true, json: async () => ({ data: [{ b64_json: 'YWJj' }] }) }), 500)
      signal?.addEventListener('abort', () => { clearTimeout(timer); reject(Object.assign(new Error('aborted'), { name: 'AbortError' })) })
    }))
    vi.stubGlobal('fetch', fetchSpy)

    await act(async () => setFieldValue(document.querySelector('input[aria-label="OpenRouter API key"]'), 'sk-or-test'))
    await act(async () => generateButton().click())
    const cancelButton = [...document.querySelectorAll('button')].find((button) => button.textContent === 'Cancel')
    expect(cancelButton).toBeTruthy()
    await act(async () => cancelButton.click())
    for (let attempt = 0; attempt < 40 && !/cancelled/i.test(document.querySelector('[role="status"]')?.textContent || ''); attempt += 1) await flush()

    expect(document.querySelector('[role="status"]').textContent).toMatch(/cancelled/i)
    expect(fetchSpy.mock.calls.length).toBeLessThanOrEqual(3) // only the in-flight pool was ever dispatched
  })

  it('exposes an editable Custom direction and uses it in generation prompts', async () => {
    const fetchSpy = vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ b64_json: 'YWJj' }] }) }))
    vi.stubGlobal('fetch', fetchSpy)

    expect(document.querySelector('#custom-style')).toBeNull()
    await act(async () => byRole(imageStyleGroup(), 'Custom').click())
    const customField = document.querySelector('#custom-style')
    expect(customField).toBeTruthy()

    await act(async () => setFieldValue(customField, 'shot through a rain-covered fish tank, green sodium light'))
    await act(async () => setFieldValue(document.querySelector('input[aria-label="OpenRouter API key"]'), 'sk-or-test'))
    await act(async () => generateButton().click())
    await flush()

    expect(fetchSpy).toHaveBeenCalled()
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
    expect(body.prompt).toContain('shot through a rain-covered fish tank, green sodium light')
  })
})
