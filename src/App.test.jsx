// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID, webcrypto } from 'node:crypto'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { resolveImageStyle } from './lib/imageStyles'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
if (!globalThis.crypto) globalThis.crypto = webcrypto
if (!globalThis.crypto.randomUUID) globalThis.crypto.randomUUID = randomUUID

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

  it('offers all eight image styles as a control separate from the slide design preset', () => {
    const styleGroup = imageStyleGroup()
    const designGroup = designPresetGroup()
    expect(styleGroup).toBeTruthy()
    expect(designGroup).toBeTruthy()
    expect(styleGroup).not.toBe(designGroup)
    const styleNames = ['Creator Candid', 'Cinematic', 'Flash Editorial', 'Documentary', 'Y2K Internet', 'Luxury Minimal', 'Surreal Meme', 'Custom']
    expect(styleGroup.querySelectorAll('[role="radio"]')).toHaveLength(8)
    styleNames.forEach((name) => expect(byRole(styleGroup, name), name).toBeTruthy())
    expect(styleGroup.textContent).not.toMatch(/professional/i)
  })

  it('places the image style selector before the image generation control', () => {
    const styleGroup = imageStyleGroup()
    const button = generateButton()
    expect(button).toBeTruthy()
    expect(styleGroup.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps image style and slide design preset selections independent', async () => {
    await act(async () => byRole(imageStyleGroup(), 'Y2K Internet').click())
    expect(byRole(imageStyleGroup(), 'Y2K Internet').getAttribute('aria-checked')).toBe('true')
    expect(byRole(designPresetGroup(), 'Bold Impact').getAttribute('aria-checked')).toBe('true')

    await act(async () => byRole(designPresetGroup(), 'Zine Punch').click())
    expect(byRole(designPresetGroup(), 'Zine Punch').getAttribute('aria-checked')).toBe('true')
    expect(byRole(imageStyleGroup(), 'Y2K Internet').getAttribute('aria-checked')).toBe('true')
  })

  it('sends the style selected before generation inside the actual image request', async () => {
    const fetchSpy = vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ b64_json: 'YWJj' }] }) }))
    vi.stubGlobal('fetch', fetchSpy)

    await act(async () => byRole(imageStyleGroup(), 'Y2K Internet').click())
    await act(async () => setFieldValue(document.querySelector('input[aria-label="OpenRouter API key"]'), 'sk-or-test'))
    await act(async () => generateButton().click())
    await flush()

    expect(fetchSpy).toHaveBeenCalled()
    const [url, request] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://openrouter.ai/api/v1/images')
    const body = JSON.parse(request.body)
    expect(body.prompt).toContain(resolveImageStyle('y2k-internet').directive)
    expect(body.prompt).toContain('Aspect ratio 9:16')
    expect(body.prompt).toContain('text-safe negative space')
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
