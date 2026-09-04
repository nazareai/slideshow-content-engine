// @vitest-environment jsdom
// App-level regression for the composited overlay controls: a control change
// must recompose the frame, drop that slide's approval, block export until it
// is reviewed again, and put the exact frame shown in the preview into the
// exported ZIP. Geometry itself is covered by lib/overlayComposite.test.js.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID, webcrypto } from 'node:crypto'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import JSZip from 'jszip'
import { overlaySettingsKey } from './lib/engine'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
if (!globalThis.crypto) globalThis.crypto = webcrypto
if (!globalThis.crypto.randomUUID) globalThis.crypto.randomUUID = randomUUID

// jsdom has no real canvas. The stand-in composes a frame whose bytes encode
// the composite it was asked to paint, which is what lets this suite prove the
// exported PNG is the frame the reviewer approved rather than a stale one.
vi.mock('./lib/compositor', async () => {
  const { overlaySettingsKey: keyOf } = await import('./lib/engine')
  return {
    composeSlideDataUrl: vi.fn(async ({ slide }) => {
      const blob = new Blob([`frame(${slide?.id ?? '?'}):${keyOf(slide?.overlay)}`], { type: 'image/png' })
      return { blob, dataUrl: URL.createObjectURL(blob) }
    }),
    composeContactSheet: vi.fn(async () => new Blob(['sheet'], { type: 'image/png' })),
    loadImage: vi.fn(async () => ({})),
  }
})

const { default: App } = await import('./App.jsx')

function setFieldValue(element, value) {
  const proto = element instanceof window.HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype
    : element instanceof window.HTMLSelectElement ? window.HTMLSelectElement.prototype
      : window.HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(element, value)
  element.dispatchEvent(new window.Event(element instanceof window.HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
}

const findButton = (text) => [...document.querySelectorAll('button')].find((button) => button.textContent.includes(text))
const exportButton = () => findButton('Export package')
const blockerPanel = () => document.querySelector('[data-testid="export-blockers"]')
const checkboxes = () => [...document.querySelectorAll('input[type="checkbox"]')]
const control = (label) => document.querySelector(`[aria-label="${label}"]`)
const slideImage = (id) => document.querySelector(`img[alt="Finished slide ${id} with generated visual and text overlay"]`)
const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 25)))

const blobBytes = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = () => reject(reader.error)
  reader.readAsArrayBuffer(blob)
})
const blobText = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = () => reject(reader.error)
  reader.readAsText(blob)
})

describe('per-slide composite overlay controls', () => {
  let container, root, blobsByUrl, downloads

  beforeEach(async () => {
    blobsByUrl = new Map()
    downloads = []
    if (!URL.createObjectURL) URL.createObjectURL = () => {}
    if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {}
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      const url = `blob:mock-${blobsByUrl.size + 1}`
      blobsByUrl.set(url, blob)
      return url
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(window.HTMLAnchorElement.prototype, 'click').mockImplementation(function () { downloads.push(this.download) })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ b64_json: 'YWJj' }] }) })))
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root.render(<App />))

    // A short topic keeps every generated slide inside the gate's 4-16 word
    // rule, so readiness turns only on renders and approvals.
    await act(async () => setFieldValue(document.querySelector('#topic'), 'content engines'))
    await act(async () => findButton('Generate local fallback').click())
    await act(async () => setFieldValue(document.querySelector('input[aria-label="OpenRouter API key"]'), 'sk-or-test'))
    await act(async () => findButton('Generate finished slides').click())
    for (let attempt = 0; attempt < 40 && checkboxes().length < 5; attempt += 1) await flush()
    for (const box of checkboxes()) await act(async () => box.click())
    expect(exportButton().disabled).toBe(false)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it.each([
    ['vertical offset', () => setFieldValue(control('Slide 1 vertical offset'), '-320')],
    ['horizontal offset', () => setFieldValue(control('Slide 1 horizontal offset'), '240')],
    ['text position', () => setFieldValue(control('Slide 1 text position'), 'top')],
    ['panel padding', () => setFieldValue(control('Slide 1 panel padding'), '96')],
    ['text size', () => setFieldValue(control('Slide 1 text size'), '1.3')],
    ['background toggle', () => control('Slide 1 tight text background').click()],
  ])('changing the %s clears that slide\'s approval and blocks export until it is reviewed again', async (_, change) => {
    await act(async () => change())

    expect(checkboxes()[0].checked, 'the moved slide must lose its approval').toBe(false)
    expect(checkboxes().slice(1).every((box) => box.checked), 'other slides keep theirs').toBe(true)
    expect(exportButton().disabled).toBe(true)

    for (let attempt = 0; attempt < 20 && !/Slide 1: check/.test(blockerPanel()?.textContent || ''); attempt += 1) await flush()
    expect(blockerPanel().textContent).toContain('Slide 1: check “Reviewed and approved”')
    expect(blockerPanel().textContent).not.toContain('Slide 2')

    await act(async () => checkboxes()[0].click())
    expect(blockerPanel()).toBeNull()
    expect(exportButton().disabled).toBe(false)
  }, 20000)

  it('recomposes the preview from the stored image without spending another image credit', async () => {
    const before = slideImage(1).src
    const fetchCalls = globalThis.fetch.mock.calls.length

    await act(async () => setFieldValue(control('Slide 1 vertical offset'), '-320'))
    for (let attempt = 0; attempt < 20 && slideImage(1).src === before; attempt += 1) await flush()

    expect(slideImage(1).src).not.toBe(before)
    expect(await blobText(blobsByUrl.get(slideImage(1).src))).toBe(`frame(1):${overlaySettingsKey({ offsetY: -320 })}`)
    expect(globalThis.fetch.mock.calls.length, 'no new provider request').toBe(fetchCalls)
    expect(slideImage(2).src, 'untouched slides keep their frame').toBeTruthy()
  }, 20000)

  it('exports the exact frame shown in the preview after the composite is moved and resized', async () => {
    await act(async () => setFieldValue(control('Slide 1 vertical offset'), '-320'))
    await flush()
    await act(async () => setFieldValue(control('Slide 1 panel padding'), '96'))
    for (let attempt = 0; attempt < 20 && checkboxes()[0].checked === false && !/Slide 1: check/.test(blockerPanel()?.textContent || ''); attempt += 1) await flush()
    await act(async () => checkboxes()[0].click())
    expect(exportButton().disabled).toBe(false)

    const previewed = await blobText(blobsByUrl.get(slideImage(1).src))
    await act(async () => exportButton().click())
    for (let attempt = 0; attempt < 40 && !downloads.length; attempt += 1) await flush()

    expect(downloads).toEqual(['slideshow-upload-package.zip'])
    const zipUrl = [...blobsByUrl.keys()].at(-1)
    const zip = await JSZip.loadAsync(await blobBytes(blobsByUrl.get(zipUrl)))
    const exported = await zip.file('slides/slide-01.png').async('string')

    expect(exported).toBe(previewed)
    expect(exported).toBe(`frame(1):${overlaySettingsKey({ offsetY: -320, backgroundPadding: 96 })}`)
    // Slides nobody touched must still carry their original composite.
    expect(await zip.file('slides/slide-02.png').async('string')).toBe(`frame(2):${overlaySettingsKey({})}`)
  }, 20000)

  it('refuses to export a frame whose composite changed while the package was being assembled', async () => {
    await act(async () => setFieldValue(control('Slide 1 vertical offset'), '-320'))
    expect(exportButton().disabled).toBe(true)

    // Clicking through the disabled state must still be refused by the handler.
    await act(async () => exportButton().click())
    await flush()
    expect(downloads).toEqual([])
    expect(document.querySelector('[role="status"]').textContent).toMatch(/Export is blocked|overlay updated/)
  }, 20000)
})
