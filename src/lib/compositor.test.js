import { describe, expect, it } from 'vitest'
import { LAYOUT_IDS, STYLE_PRESETS, validateDirection } from './artDirection'
import { composeContactSheet, composeSlide, fitText, layoutSlideText, textSafeArea } from './compositor'

const measure = (text, size) => String(text).length * size * 0.55

function planFor(layoutId, presetId, overrides = {}) {
  const slide = { role: 'Evidence', text: overrides.text ?? 'Publishing worked but taste was the bottleneck' }
  const direction = validateDirection({ layout: layoutId, focalPoint: overrides.focalPoint ?? { x: 0.5, y: 0.3 }, mirror: overrides.mirror }, slide)
  return layoutSlideText({ text: slide.text, role: slide.role, direction, preset: presetId, measure, index: overrides.index ?? 1, total: overrides.total ?? 6 })
}

function recordingCanvas() {
  const calls = []
  const state = { font: '700 60px sans-serif' }
  const gradient = { addColorStop: () => {} }
  const context = new Proxy({}, {
    get(_, prop) {
      if (prop === 'measureText') return (text) => ({ width: measure(text, parseFloat(state.font.match(/(\d+(?:\.\d+)?)px/)?.[1] || 16)) })
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return (...args) => { calls.push([prop, ...args]); return gradient }
      }
      return (...args) => { calls.push([prop, ...args.filter((arg) => typeof arg !== 'object' || arg === null)]) }
    },
    set(_, prop, value) {
      if (prop === 'font') state.font = value
      calls.push([`set:${String(prop)}`, typeof value === 'object' ? '[gradient]' : value])
      return true
    },
  })
  const canvas = { width: 0, height: 0, getContext: () => context, toBlob: (callback) => callback(new Blob(['png'], { type: 'image/png' })) }
  return { canvas, calls }
}

const image = { naturalWidth: 1080, naturalHeight: 1920 }

describe('art-directed compositor', () => {
  it('keeps every copy line inside the TikTok text safe area for all layouts and presets', () => {
    for (const layoutId of LAYOUT_IDS) {
      for (const preset of STYLE_PRESETS) {
        const plan = planFor(layoutId, preset.id)
        for (const line of plan.lines) {
          expect(line.x, `${layoutId}/${preset.id} left`).toBeGreaterThanOrEqual(textSafeArea.left)
          expect(line.x + line.width, `${layoutId}/${preset.id} right`).toBeLessThanOrEqual(textSafeArea.right)
          expect(line.y, `${layoutId}/${preset.id} top`).toBeGreaterThanOrEqual(textSafeArea.top)
          expect(line.y + plan.lineHeight, `${layoutId}/${preset.id} bottom`).toBeLessThanOrEqual(textSafeArea.bottom)
        }
        expect(plan.blockBottom, `${layoutId}/${preset.id} block bottom`).toBeLessThanOrEqual(textSafeArea.bottom)
      }
    }
  })

  it('clamps dynamic position and offsets to the safe area at every extreme', () => {
    for (const position of ['top', 'center', 'bottom']) {
      for (const offsetX of [-999, 999]) {
        for (const offsetY of [-999, 999]) {
          const slide = { role: 'Evidence', text: 'Move this overlay away from the important subject' }
          const direction = validateDirection({ layout: 'editorial-split' }, slide)
          const plan = layoutSlideText({ text: slide.text, role: slide.role, direction, preset: 'impact', measure, overlaySettings: { position, offsetX, offsetY, textScale: 1.35 } })
          for (const line of plan.lines) {
            expect(line.x).toBeGreaterThanOrEqual(textSafeArea.left)
            expect(line.x + line.width).toBeLessThanOrEqual(textSafeArea.right)
            expect(line.y).toBeGreaterThanOrEqual(textSafeArea.top)
            expect(line.y + plan.lineHeight).toBeLessThanOrEqual(textSafeArea.bottom)
          }
        }
      }
    }
  })

  it('paints an optional background with configured opacity and padding', async () => {
    const recording = recordingCanvas()
    const slide = { role: 'Evidence', text: 'Readable text', overlay: { backgroundEnabled: true, backgroundOpacity: 0.4, backgroundPadding: 48 } }
    await composeSlide({ image, slide, direction: validateDirection({ layout: 'evidence-card' }, slide), preset: 'impact', canvas: recording.canvas })
    expect(recording.calls).toContainEqual(['set:globalAlpha', 0.4])
    expect(recording.calls.some(([name]) => name === 'fillRect')).toBe(true)
  })

  it('keeps mirrored compositions inside the safe area too', () => {
    const plan = planFor('tension-rail', 'zine', { mirror: true })
    for (const line of plan.lines) {
      expect(line.x).toBeGreaterThanOrEqual(textSafeArea.left)
      expect(line.x + line.width).toBeLessThanOrEqual(textSafeArea.right)
    }
  })

  it('produces materially different text frames across the seven layouts', () => {
    const frames = LAYOUT_IDS.map((layoutId) => {
      const plan = planFor(layoutId, 'impact')
      return JSON.stringify({ x: plan.frame.x, maxWidth: plan.frame.maxWidth, align: plan.frame.align, anchor: plan.frame.anchor, yTop: plan.frame.yTop })
    })
    expect(new Set(frames).size).toBe(LAYOUT_IDS.length)
  })

  it('places the copy in the counter-focal half for spotlight reveals', () => {
    const lowFocal = planFor('spotlight-reveal', 'impact', { focalPoint: { x: 0.5, y: 0.2 } })
    const highFocal = planFor('spotlight-reveal', 'impact', { focalPoint: { x: 0.5, y: 0.8 } })
    expect(lowFocal.blockTop).toBeGreaterThan(900)
    expect(highFocal.blockBottom).toBeLessThan(1000)
  })

  it('locates the emphasis span on the rendered line so accents can be painted under it', () => {
    const plan = planFor('evidence-card', 'impact', { text: 'Publishing worked but taste was the bottleneck' })
    expect(plan.emphasisSpan).toBeTruthy()
    expect(plan.emphasisSpan.text.toLowerCase()).toBe('bottleneck')
    const line = plan.lines[plan.emphasisSpan.lineIndex]
    expect(plan.emphasisSpan.x).toBeGreaterThanOrEqual(line.x)
    expect(plan.emphasisSpan.x + plan.emphasisSpan.width).toBeLessThanOrEqual(line.x + line.width + 1)
  })

  it('applies preset typography: uppercase transforms and scaled font ranges', () => {
    const impact = planFor('impact-stack', 'impact', { text: 'the quiet metric' })
    const docu = planFor('impact-stack', 'docu', { text: 'the quiet metric' })
    expect(impact.lines.every((line) => line.text === line.text.toUpperCase())).toBe(true)
    expect(docu.lines.some((line) => line.text !== line.text.toUpperCase())).toBe(true)
    expect(docu.fontSize).toBeLessThan(impact.fontSize)
  })

  it('fits worst-case gate-legal copy (110 chars) in every layout and preset, even with wide heavy type', () => {
    const worst = 'For solo founders, this is a reason to question the usual approach to building an autonomous content engine.'
    expect(worst.length).toBeLessThanOrEqual(110)
    const heavyMeasure = (text, size) => String(text).length * size * 0.62
    for (const layoutId of LAYOUT_IDS) {
      for (const preset of STYLE_PRESETS) {
        const direction = validateDirection({ layout: layoutId }, { role: 'Evidence', text: worst })
        expect(() => layoutSlideText({ text: worst, role: 'Evidence', direction, preset: preset.id, measure: heavyMeasure, index: 2, total: 7 }), `${layoutId}/${preset.id}`).not.toThrow()
      }
    }
  })

  it('rejects paragraph-sized copy instead of clipping or shrinking below readability', () => {
    const paragraph = Array.from({ length: 90 }, (_, index) => `word${index}`).join(' ')
    expect(() => fitText(paragraph, measure, { maxWidth: 864, maxLines: 5, fontRange: [58, 92], lineHeight: 1.1 })).toThrow('too long')
    expect(() => planFor('takeaway-ledger', 'impact', { text: paragraph })).toThrow('too long')
  })

  it('respects the frame height budget when fitting text', () => {
    const fitted = fitText('Four short words here', measure, { maxWidth: 864, maxLines: 4, fontRange: [40, 100], lineHeight: 1.2, maxHeight: 120 })
    expect(fitted.lines.length * fitted.lineHeight).toBeLessThanOrEqual(120)
  })

  it('renders deterministically: identical input produces the identical draw sequence', async () => {
    const first = recordingCanvas()
    const second = recordingCanvas()
    const slide = { role: 'Hook', text: 'The pipeline worked. The posts still failed.' }
    const direction = validateDirection({ layout: 'impact-stack', focalPoint: { x: 0.5, y: 0.6 } }, slide)
    await composeSlide({ image, slide, direction, preset: 'zine', index: 0, total: 5, canvas: first.canvas })
    await composeSlide({ image, slide, direction, preset: 'zine', index: 0, total: 5, canvas: second.canvas })
    expect(JSON.stringify(first.calls)).toBe(JSON.stringify(second.calls))
    expect(first.calls.some(([name]) => name === 'drawImage')).toBe(true)
    expect(first.calls.filter(([name]) => name === 'fillText').length).toBeGreaterThan(0)
  })

  it('branches into layout-specific painting: spotlight uses a radial scrim, the CTA draws its frame', async () => {
    const spotlight = recordingCanvas()
    await composeSlide({ image, slide: { role: 'Shift', text: 'So I stopped scaling output everywhere' }, direction: validateDirection({ layout: 'spotlight-reveal' }, { role: 'Shift', text: 'So I stopped scaling output everywhere' }), preset: 'impact', index: 4, total: 6, canvas: spotlight.canvas })
    expect(spotlight.calls.some(([name]) => name === 'createRadialGradient')).toBe(true)

    const cta = recordingCanvas()
    await composeSlide({ image, slide: { role: 'CTA', text: 'Save this before your next decision' }, direction: validateDirection({ layout: 'cta-stamp' }, { role: 'CTA', text: 'Save this before your next decision' }), preset: 'impact', index: 5, total: 6, canvas: cta.canvas })
    expect(cta.calls.filter(([name]) => name === 'strokeRect').length).toBeGreaterThanOrEqual(2)
    expect(cta.calls.some(([name]) => name === 'rotate')).toBe(true)
  })

  it('crops toward the declared focal point instead of always center-cropping', async () => {
    const wide = { naturalWidth: 4000, naturalHeight: 1920 }
    const left = recordingCanvas()
    const slide = { role: 'Evidence', text: 'Publishing worked but taste was the bottleneck' }
    await composeSlide({ image: wide, slide, direction: validateDirection({ layout: 'evidence-card', focalPoint: { x: 0.15, y: 0.5 } }, slide), preset: 'impact', canvas: left.canvas })
    const right = recordingCanvas()
    await composeSlide({ image: wide, slide, direction: validateDirection({ layout: 'evidence-card', focalPoint: { x: 0.85, y: 0.5 } }, slide), preset: 'impact', canvas: right.canvas })
    const sx = (calls) => calls.find(([name]) => name === 'drawImage')[1]
    expect(sx(left.calls)).toBeLessThan(sx(right.calls))
  })

  it('still exports a 1080x1920 PNG blob through the legacy text-only call path', async () => {
    const { canvas } = recordingCanvas()
    const blob = await composeSlide({ image, text: 'The pipeline worked. The posts still failed.', canvas })
    expect(blob.type).toBe('image/png')
    expect(canvas.width).toBe(1080)
    expect(canvas.height).toBe(1920)
  })

  it('assembles a labeled contact sheet grid from composed frames', async () => {
    const { canvas, calls } = recordingCanvas()
    const items = Array.from({ length: 6 }, (_, index) => ({ image: { width: 1080, height: 1920 }, label: `0${index + 1} · role · layout` }))
    const blob = await composeContactSheet({ items, title: 'Proof sheet', canvas })
    expect(blob.type).toBe('image/png')
    expect(calls.filter(([name]) => name === 'drawImage').length).toBe(6)
    expect(calls.filter(([name]) => name === 'fillText').length).toBeGreaterThanOrEqual(7)
    expect(canvas.width).toBeGreaterThan(1000)
  })
})
