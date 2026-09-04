// @vitest-environment jsdom
// Export-package regression suite: the readiness computation shared by the
// button and the click handler, the visible blocker diagnostics, and the
// resilient ZIP assembly + browser download.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID, webcrypto } from 'node:crypto'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import JSZip from 'jszip'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
if (!globalThis.crypto) globalThis.crypto = webcrypto
if (!globalThis.crypto.randomUUID) globalThis.crypto.randomUUID = randomUUID

// jsdom has no real canvas; composition correctness is covered by
// compositor.test.js. Mocked here so full generation flows run to completion.
vi.mock('./lib/compositor', () => ({
  composeSlideDataUrl: vi.fn(async () => ({ blob: new Blob(['composed'], { type: 'image/png' }), dataUrl: 'data:image/png;base64,QUFB' })),
  composeContactSheet: vi.fn(async () => new Blob(['sheet'], { type: 'image/png' })),
  loadImage: vi.fn(async () => ({})),
}))

const { default: App } = await import('./App.jsx')
const { composeContactSheet } = await import('./lib/compositor')

function setFieldValue(element, value) {
  const proto = element instanceof window.HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(element, value)
  element.dispatchEvent(new window.Event('input', { bubbles: true }))
}

const findButton = (text) => [...document.querySelectorAll('button')].find((button) => button.textContent.includes(text))
const exportButton = () => findButton('Export package')
const blockerPanel = () => document.querySelector('[data-testid="export-blockers"]')
const noticeText = () => document.querySelector('[role="status"]')?.textContent || ''
const checkboxes = () => [...document.querySelectorAll('input[type="checkbox"]')]
const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 25)))

// jsdom blobs have no arrayBuffer(); FileReader is the supported read path.
const blobBytes = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = () => reject(reader.error)
  reader.readAsArrayBuffer(blob)
})

async function generateAllFrames() {
  await act(async () => setFieldValue(document.querySelector('input[aria-label="OpenRouter API key"]'), 'sk-or-test'))
  await act(async () => findButton('Generate finished slides').click())
  for (let attempt = 0; attempt < 40 && checkboxes().length < 5; attempt += 1) await flush()
  expect(checkboxes()).toHaveLength(5)
}

async function approveAllFrames() {
  for (const box of checkboxes()) await act(async () => box.click())
  expect(checkboxes().every((box) => box.checked)).toBe(true)
}

// The default starter topic produces an 18-word Implication slide that fails
// the quality gate's readable-word check; a short topic keeps every generated
// slide inside 4-16 words so export readiness depends only on renders and
// approvals. Regenerating the local draft applies the new brief.
async function useGatePassingBrief() {
  await act(async () => setFieldValue(document.querySelector('#topic'), 'content engines'))
  await act(async () => findButton('Generate local fallback').click())
}

describe('export package readiness and download', () => {
  let container, root, createdBlobs, downloads

  beforeEach(async () => {
    createdBlobs = []
    downloads = []
    if (!URL.createObjectURL) URL.createObjectURL = () => {}
    if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {}
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => { createdBlobs.push(blob); return `blob:mock-${createdBlobs.length}` })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(window.HTMLAnchorElement.prototype, 'click').mockImplementation(function () { downloads.push(this.download) })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root.render(<App />))
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('exports a complete ZIP package once all frames are current and every slide is approved', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ b64_json: 'YWJj' }] }) })))
    await useGatePassingBrief()
    await generateAllFrames()
    await approveAllFrames()

    expect(blockerPanel()).toBeNull()
    const button = exportButton()
    expect(button.disabled).toBe(false)
    await act(async () => button.click())
    for (let attempt = 0; attempt < 40 && !downloads.length; attempt += 1) await flush()

    expect(downloads).toEqual(['slideshow-upload-package.zip'])
    expect(noticeText()).toMatch(/5 composed slides .* were exported/)

    const zipBlob = createdBlobs.at(-1)
    expect(zipBlob).toBeInstanceOf(Blob)
    const zip = await JSZip.loadAsync(await blobBytes(zipBlob))
    for (const id of [1, 2, 3, 4, 5]) {
      expect(zip.file(`slides/slide-0${id}.png`), `slide-0${id}.png`).toBeTruthy()
      expect(zip.file(`slides/slide-0${id}-prompt.txt`), `slide-0${id}-prompt.txt`).toBeTruthy()
    }
    expect(zip.file('contact-sheet.png')).toBeTruthy()
    const manifest = await zip.file('slideshow-package.md').async('string')
    expect(manifest).toContain('## Slides')
    expect(manifest).toContain('Ready for manual review')
  }, 20000)

  it('regression: approving every slide while the quality gate fails shows the exact gate blocker instead of a silently dead button', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ b64_json: 'YWJj' }] }) })))
    // Default starter brief: slide 3 has 18 words, so the gate fails while
    // every frame can still be generated and approved.
    await generateAllFrames()
    await approveAllFrames()

    expect(exportButton().disabled).toBe(true)
    const panel = blockerPanel()
    expect(panel).toBeTruthy()
    expect(panel.textContent).toContain('Quality gate: Copy is 4 to 16 readable words')
    expect(panel.textContent).not.toContain('no finished frame')
    expect(panel.textContent).not.toContain('Reviewed and approved')
  }, 20000)

  it('lists missing frames and the failing gate check before anything was generated', () => {
    expect(exportButton().disabled).toBe(true)
    const panel = blockerPanel()
    expect(panel.textContent).toContain('Quality gate: Copy is 4 to 16 readable words')
    expect(panel.textContent).toContain('Slides 1, 2, 3, 4, 5: no finished frame yet')
  })

  it('blocks with a per-slide approval list until every finished frame is reviewed, then unblocks', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ b64_json: 'YWJj' }] }) })))
    await useGatePassingBrief()
    await generateAllFrames()

    expect(exportButton().disabled).toBe(true)
    expect(blockerPanel().textContent).toContain('Slides 1, 2, 3, 4, 5: check “Reviewed and approved”')

    for (const box of checkboxes().slice(0, 4)) await act(async () => box.click())
    expect(blockerPanel().textContent).toContain('Slide 5: check “Reviewed and approved”')
    expect(blockerPanel().textContent).not.toContain('Slides 1')

    await act(async () => checkboxes()[4].click())
    expect(blockerPanel()).toBeNull()
    expect(exportButton().disabled).toBe(false)
  }, 20000)

  it('marks a slide stale when its copy is edited after rendering and blocks export for that slide alone', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ b64_json: 'YWJj' }] }) })))
    await useGatePassingBrief()
    await generateAllFrames()
    await approveAllFrames()
    expect(exportButton().disabled).toBe(false)

    await act(async () => setFieldValue(document.querySelector('#slide-1'), 'Completely rewritten hook copy for this test'))

    expect(exportButton().disabled).toBe(true)
    const panel = blockerPanel()
    expect(panel.textContent).toContain('Slide 1: the copy, visual direction, image style, or design preset changed after the last render')
    expect(panel.textContent).not.toContain('Slide 2')
  }, 20000)

  it('still exports a valid package when the contact sheet cannot be rendered', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ b64_json: 'YWJj' }] }) })))
    await useGatePassingBrief()
    await generateAllFrames()
    await approveAllFrames()

    composeContactSheet.mockRejectedValueOnce(new Error('canvas exploded'))
    await act(async () => exportButton().click())
    for (let attempt = 0; attempt < 40 && !downloads.length; attempt += 1) await flush()

    expect(downloads).toEqual(['slideshow-upload-package.zip'])
    expect(noticeText()).toContain('the contact sheet could not be rendered and was left out')
    const zip = await JSZip.loadAsync(await blobBytes(createdBlobs.at(-1)))
    expect(zip.file('contact-sheet.png')).toBeNull()
    expect(zip.file('slides/slide-01.png')).toBeTruthy()
  }, 20000)

  it('reports the real failure when the browser download cannot be created, with no false success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ b64_json: 'YWJj' }] }) })))
    await useGatePassingBrief()
    await generateAllFrames()
    await approveAllFrames()

    URL.createObjectURL.mockImplementation(() => { throw new Error('object URLs unavailable') })
    await act(async () => exportButton().click())
    for (let attempt = 0; attempt < 40 && !/Export failed/.test(noticeText()); attempt += 1) await flush()

    expect(downloads).toEqual([])
    expect(noticeText()).toContain('Export failed:')
    expect(noticeText()).toContain('No package was downloaded.')
    expect(noticeText()).not.toContain('reducing the slide count')
  }, 20000)
})
