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
const imageStyleGroup = () => document.querySelector('#image-style-controls')
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

  it('offers independent medium and treatment controls, including cartoon plus brainrot', async () => {
    const mediumGroup = document.querySelector('[role="radiogroup"][aria-label="Rendering medium"]')
    const treatmentGroup = document.querySelector('[role="radiogroup"][aria-label="Visual treatment"]')
    expect(mediumGroup).toBeTruthy()
    expect(treatmentGroup).toBeTruthy()
    expect(byRole(mediumGroup, 'Flat 2D Cartoon')).toBeTruthy()
    expect(byRole(treatmentGroup, 'Surreal Brainrot')).toBeTruthy()
    await act(async () => byRole(mediumGroup, 'Flat 2D Cartoon').click())
    await act(async () => byRole(treatmentGroup, 'Surreal Brainrot').click())
    expect(byRole(mediumGroup, 'Flat 2D Cartoon').getAttribute('aria-checked')).toBe('true')
    expect(byRole(treatmentGroup, 'Surreal Brainrot').getAttribute('aria-checked')).toBe('true')
    expect(document.body.textContent).toContain('Flat 2D Cartoon + Surreal Brainrot')
  })

  it('places both style axes before image generation and keeps slide design independent', async () => {
    const controls = imageStyleGroup()
    const button = generateButton()
    expect(controls.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await act(async () => byRole(document.querySelector('[aria-label="Rendering medium"]'), 'Flat 2D Cartoon').click())
    await act(async () => byRole(designPresetGroup(), 'Zine Punch').click())
    expect(byRole(designPresetGroup(), 'Zine Punch').getAttribute('aria-checked')).toBe('true')
    expect(byRole(document.querySelector('[aria-label="Rendering medium"]'), 'Flat 2D Cartoon').getAttribute('aria-checked')).toBe('true')
  })

  it('sends cartoon plus brainrot in the exact final image payload without photographic or generic 3D leakage', async () => {
    const fetchSpy = vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ b64_json: 'YWJj' }] }) }))
    vi.stubGlobal('fetch', fetchSpy)
    await act(async () => byRole(document.querySelector('[aria-label="Rendering medium"]'), 'Flat 2D Cartoon').click())
    await act(async () => byRole(document.querySelector('[aria-label="Visual treatment"]'), 'Surreal Brainrot').click())
    await act(async () => setFieldValue(document.querySelector('input[aria-label="OpenRouter API key"]'), 'sk-or-test'))
    await act(async () => generateButton().click())
    for (let attempt = 0; attempt < 40 && fetchSpy.mock.calls.length < 5; attempt += 1) await flush()
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
    expect(body.prompt).toContain('Flat 2D Cartoon + Surreal Brainrot')
    expect(body.prompt).toContain('absurd hybrid mascot')
    expect(body.prompt).toContain('flat 2D')
    expect(body.prompt).toContain('no 3D')
    expect(body.prompt).not.toMatch(/photorealistic vertical photograph/i)
    expect(fetchSpy).toHaveBeenCalledTimes(5)
  })

  it('sends both medium and treatment contracts inside the story request', async () => {
    const hooks = Array.from({ length: 5 }, (_, index) => ({ text: `Hook candidate number ${index} for this story`, score: 60 + index }))
    const slides = [
      { role: 'Hook', text: 'The mascot ate the dashboard again', visual: 'A flat mascot swallowing a dashboard', layout: 'impact-stack', emphasis: 'ate', focalPoint: { x: .5, y: .6 } },
      { role: 'Context', text: 'Every chart became forbidden lore', visual: 'Flat charts orbit a mascot shrine', layout: 'editorial-split', emphasis: 'lore', focalPoint: { x: .5, y: .35 } },
      { role: 'Tension', text: 'Nobody could explain the numbers', visual: 'Flat figures point at impossible numbers', layout: 'tension-rail', emphasis: 'explain', focalPoint: { x: .7, y: .4 } },
      { role: 'Shift', text: 'One cursed metric finally worked', visual: 'A flat glowing metric appears', layout: 'spotlight-reveal', emphasis: 'worked', focalPoint: { x: .5, y: .3 } },
      { role: 'Payoff', text: 'Absurdity made the lesson stick', visual: 'A flat mascot crowns the metric', layout: 'takeaway-ledger', emphasis: 'stick', focalPoint: { x: .5, y: .3 } },
    ]
    const response = { hooks, selectedHook: hooks[4].text, slides, caption: 'The weird metric won.' }
    const fetchSpy = vi.fn(async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(response) } }] }) }))
    vi.stubGlobal('fetch', fetchSpy)
    await act(async () => byRole(document.querySelector('[aria-label="Rendering medium"]'), 'Flat 2D Cartoon').click())
    await act(async () => byRole(document.querySelector('[aria-label="Visual treatment"]'), 'Surreal Brainrot').click())
    await act(async () => setFieldValue(document.querySelector('input[aria-label="OpenRouter API key"]'), 'sk-or-test'))
    await act(async () => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Generate AI hooks + story')).click())
    await flush()
    const prompt = JSON.parse(fetchSpy.mock.calls[0][1].body).messages[0].content
    expect(prompt).toContain('Flat 2D Cartoon + Surreal Brainrot')
    expect(prompt).toContain('absurd hybrid mascot')
    expect(prompt).toContain('Never use camera, lens, photorealistic, CGI')
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

})
