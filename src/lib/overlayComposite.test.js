// Regression suite for the composited overlay object.
//
// The defect these cover: the overlay controls moved and resized the copy
// while every painter derived its backing panel from static frame constants
// (`frame.panelTop`, `frame.x`, `frame.maxWidth`). The panel therefore stayed
// where the layout had put it, kept covering the focal region the reviewer was
// trying to uncover, and never responded to padding or text size. A second
// defect let that divergence ship: the freshness key and the renderer each
// normalized overlay settings on their own, so a composite change could leave
// an approved, stale frame in the export.
//
// Assertions run against the recorded draw calls, not just the plan, so they
// describe what is actually painted into the preview and the exported PNG.
import { describe, expect, it } from 'vitest'
import { canvasSpec, getPreset, LAYOUT_IDS, STYLE_PRESETS, validateDirection } from './artDirection'
// Deliberately imported from the two shipping entry points rather than from the
// shared module: the renderer's normalization and the engine's freshness key
// are the pair that drifted, and only these imports can prove they agree.
import { composeSlide, DEFAULT_OVERLAY_SETTINGS, layoutSlideText, normalizeOverlaySettings, textSafeArea } from './compositor'
import { isRenderCurrent, overlaySettingsKey } from './engine'
import { composeOverlayGeometry, PANEL_CHROME } from './overlayComposite'

const COPY = 'Publishing worked but taste was the bottleneck'
const measure = (text, size) => String(text).length * size * 0.55
const image = { naturalWidth: 1080, naturalHeight: 1920 }

// Compositions that paint an opaque panel behind the copy — the surfaces the
// reviewer was complaining about.
const PANEL_LAYOUTS = ['editorial-split', 'takeaway-ledger', 'evidence-card']

// Records draw calls and, critically, the fill style in force for each one, so
// a test can pick out the panel fill rather than guessing at rectangles.
function recordingCanvas() {
  const calls = []
  const state = { font: '700 60px sans-serif', fillStyle: null }
  const gradient = { addColorStop: () => {} }
  const context = new Proxy({}, {
    get(_, prop) {
      if (prop === 'measureText') return (text) => ({ width: measure(text, parseFloat(state.font.match(/(\d+(?:\.\d+)?)px/)?.[1] || 16)) })
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return (...args) => { calls.push({ op: prop, fillStyle: state.fillStyle, args }); return gradient }
      }
      return (...args) => calls.push({ op: String(prop), fillStyle: state.fillStyle, args: args.filter((arg) => typeof arg !== 'object' || arg === null) })
    },
    set(_, prop, value) {
      if (prop === 'font') state.font = value
      if (prop === 'fillStyle') state.fillStyle = typeof value === 'object' ? '[gradient]' : value
      calls.push({ op: `set:${String(prop)}`, args: [typeof value === 'object' ? '[gradient]' : value] })
      return true
    },
  })
  return { canvas: { width: 0, height: 0, getContext: () => context, toBlob: (callback) => callback(new Blob(['png'], { type: 'image/png' })) }, calls }
}

function planFor(layoutId, overlay, { presetId = 'impact', text = COPY, mirror = false } = {}) {
  const slide = { role: 'Evidence', text, overlay }
  const direction = validateDirection({ layout: layoutId, focalPoint: { x: 0.5, y: 0.3 }, mirror }, slide)
  return layoutSlideText({ text, role: slide.role, direction, preset: presetId, measure, index: 1, total: 6, overlaySettings: overlay })
}

// Renders a slide through the real compositor and returns both the plan and
// the rectangle actually filled with the preset's panel colour. The `impact`
// preset has a zero panel radius, so the panel lands as a single fillRect.
async function render(layoutId, overlay, { presetId = 'impact', text = COPY, mirror = false } = {}) {
  const slide = { role: 'Evidence', text, overlay }
  const direction = validateDirection({ layout: layoutId, focalPoint: { x: 0.5, y: 0.3 }, mirror }, slide)
  const recording = recordingCanvas()
  await composeSlide({ image, slide, direction, preset: presetId, index: 1, total: 6, canvas: recording.canvas })
  const paper = getPreset(presetId).palette.paper
  const painted = recording.calls
    .filter((call) => call.op === 'fillRect' && call.fillStyle === paper)
    .map(({ args: [x, y, width, height] }) => ({ x, y, width, height }))
  return { plan: planFor(layoutId, overlay, { presetId, text, mirror }), painted, calls: recording.calls }
}

const boxOf = (plan) => plan.composite.panel
const textBox = (plan) => plan.composite.text

describe('large layout panel controls', () => {
  it('resizes the takeaway-ledger full-width panel independently from text geometry', () => {
    const base = planFor('takeaway-ledger', { panelTop: 59 })
    const smaller = planFor('takeaway-ledger', { panelTop: 75 })

    expect(base.composite.panel).toMatchObject({ x: 0, y: 1133, width: 1080, height: 787 })
    expect(smaller.composite.panel).toMatchObject({ x: 0, y: 1440, width: 1080, height: 480 })
    expect(smaller.lines.map(({ text, x, y }) => ({ text, x, y }))).toEqual(
      base.lines.map(({ text, x, y }) => ({ text, x, y })),
    )
  })

  it('paints the requested large-panel bounds, color and opacity', async () => {
    const overlay = { panelTop: 70, panelColor: '#112233', panelOpacity: 0.4 }
    const { plan, calls } = await render('takeaway-ledger', overlay)
    const panel = plan.composite.panel
    const alphaAt = calls.findIndex((call) => call.op === 'set:globalAlpha' && call.args[0] === 0.4)

    expect(panel).toMatchObject({ x: 0, y: 1344, width: 1080, height: 576 })
    expect(alphaAt).toBeGreaterThanOrEqual(0)
    expect(calls.slice(alphaAt).some((call) => call.op === 'fillRect' && call.fillStyle === '#112233' &&
      call.args[0] === panel.x && call.args[1] === panel.y &&
      call.args[2] === panel.width && call.args[3] === panel.height)).toBe(true)
  })

  it('includes large-panel appearance in the render freshness key', () => {
    const base = overlaySettingsKey({ panelEnabled: true, panelTop: 59, panelOpacity: 1, panelColor: '#f7f5f0' })
    expect(overlaySettingsKey({ panelEnabled: false, panelTop: 59, panelOpacity: 1, panelColor: '#f7f5f0' })).not.toBe(base)
    expect(overlaySettingsKey({ panelEnabled: true, panelTop: 70, panelOpacity: 1, panelColor: '#f7f5f0' })).not.toBe(base)
    expect(overlaySettingsKey({ panelEnabled: true, panelTop: 59, panelOpacity: 0.4, panelColor: '#f7f5f0' })).not.toBe(base)
    expect(overlaySettingsKey({ panelEnabled: true, panelTop: 59, panelOpacity: 1, panelColor: '#112233' })).not.toBe(base)
  })
})

describe('overlay settings normalization', () => {
  it('resolves an unset overlay to the documented defaults instead of to zero', () => {
    expect(normalizeOverlaySettings(undefined)).toEqual(DEFAULT_OVERLAY_SETTINGS)
    expect(normalizeOverlaySettings({})).toEqual(DEFAULT_OVERLAY_SETTINGS)
  })

  it('keeps an explicit zero and clamps every control to its published bounds', () => {
    expect(normalizeOverlaySettings({ backgroundOpacity: 0 }).backgroundOpacity).toBe(0)
    expect(normalizeOverlaySettings({ backgroundPadding: 0 }).backgroundPadding).toBe(0)
    const wild = normalizeOverlaySettings({ position: 'sideways', offsetX: 9e9, offsetY: -9e9, backgroundOpacity: 4, backgroundPadding: 500, textScale: 12 })
    expect(wild).toEqual({ ...DEFAULT_OVERLAY_SETTINGS, position: 'auto', offsetX: 320, offsetY: -560, backgroundOpacity: 1, backgroundPadding: 96, textScale: 1.35 })
    expect(normalizeOverlaySettings({ offsetX: 'nonsense', textScale: NaN })).toEqual(DEFAULT_OVERLAY_SETTINGS)
  })

  // Regression: the renderer and the freshness key used to normalize
  // separately, so `{}` rendered with padding 0 but was keyed as padding 32 —
  // two settings that paint different panels shared one key.
  it('gives two overlays that paint different panels two different freshness keys', () => {
    const variants = [
      {}, { backgroundPadding: 0 }, { backgroundPadding: 96 }, { backgroundOpacity: 0 },
      { position: 'top' }, { position: 'bottom' }, { offsetX: 120 }, { offsetY: -240 },
      { textScale: 0.7 }, { textScale: 1.35 }, { backgroundEnabled: true },
    ]
    const seen = new Map()
    for (const overlay of variants) {
      const key = overlaySettingsKey(overlay)
      const panel = JSON.stringify(boxOf(planFor('editorial-split', overlay))) + JSON.stringify(boxOf(planFor('evidence-card', overlay)))
      if (seen.has(key)) expect(seen.get(key), `"${JSON.stringify(overlay)}" shares a key with a different panel`).toBe(panel)
      seen.set(key, panel)
    }
    expect(overlaySettingsKey({})).toBe(overlaySettingsKey(DEFAULT_OVERLAY_SETTINGS))
    expect(overlaySettingsKey({ backgroundPadding: 0 })).not.toBe(overlaySettingsKey({}))
  })
})

describe('the panel travels with the copy', () => {
  it.each(PANEL_LAYOUTS)('%s: moving the copy up moves the painted panel up by the same distance', async (layoutId) => {
    const before = await render(layoutId, {})
    const after = await render(layoutId, { position: 'top', offsetY: -400 })

    expect(before.painted).toHaveLength(1)
    expect(after.painted).toHaveLength(1)

    const copyShift = textBox(after.plan).top - textBox(before.plan).top
    expect(copyShift, 'the copy must actually have moved').toBeLessThan(-200)
    // The defect: this delta was exactly 0 for all three compositions.
    expect(after.painted[0].y - before.painted[0].y).toBe(copyShift)
    expect(after.painted[0]).toEqual(boxOf(after.plan))
  })

  it.each(PANEL_LAYOUTS)('%s: lifting the copy releases the image region the panel used to cover', async (layoutId) => {
    const before = await render(layoutId, {})
    const after = await render(layoutId, { position: 'top', offsetY: -400 })
    const releasedFrom = after.painted[0].y + after.painted[0].height
    const coveredBefore = before.painted[0].y + before.painted[0].height

    expect(releasedFrom, 'the moved panel must stop short of where it used to end').toBeLessThan(coveredBefore)
    expect(coveredBefore - releasedFrom).toBeGreaterThan(300)
  })

  it('evidence-card: a horizontal offset carries the floating card with the copy', async () => {
    const before = await render('evidence-card', {})
    const after = await render('evidence-card', { offsetX: 300 })
    const copyShift = textBox(after.plan).left - textBox(before.plan).left

    expect(copyShift).toBeGreaterThan(100)
    // The defect: card x was pinned to `frame.x - pad` and never moved.
    expect(after.painted[0].x - before.painted[0].x).toBeCloseTo(copyShift, 6)
  })

  it('tension-rail: the darkened edge follows the copy across the frame', async () => {
    const sideOf = ({ calls }) => {
      const [x0] = calls.find((call) => call.op === 'createLinearGradient').args
      return x0 === 0 ? 'left' : 'right'
    }
    expect(sideOf(await render('tension-rail', {}))).toBe('left')
    expect(sideOf(await render('tension-rail', { offsetX: 320 }))).toBe('right')
    expect(sideOf(await render('tension-rail', {}, { mirror: true }))).toBe('right')
  })

  it('impact-stack: lifting the copy lifts the base scrim instead of darkening the image below it', async () => {
    const scrimOf = (plan) => plan.composite.scrim
    const resting = scrimOf(planFor('impact-stack', {}))
    const lifted = scrimOf(planFor('impact-stack', { position: 'top', offsetY: -560 }))

    expect(resting.to).toBe(canvasSpec.height)
    expect(Math.max(lifted.from, lifted.to)).toBeLessThan(canvasSpec.height)
    expect(lifted.to).toBeLessThan(lifted.from)
  })
})

describe('the panel resizes with the composite', () => {
  it.each(PANEL_LAYOUTS)('%s: panel padding grows and shrinks the painted panel', async (layoutId) => {
    const tight = await render(layoutId, { backgroundPadding: 0 })
    const rest = await render(layoutId, {})
    const loose = await render(layoutId, { backgroundPadding: 96 })
    const area = ({ painted }) => painted[0].width * painted[0].height

    // The defect: padding only ever touched an ad-hoc text backdrop, so all
    // three of these areas were identical.
    expect(area(tight)).toBeLessThan(area(rest))
    expect(area(rest)).toBeLessThan(area(loose))
    for (const rendered of [tight, rest, loose]) expect(rendered.painted[0]).toEqual(boxOf(rendered.plan))
  })

  it('evidence-card: text size resizes the card, not only the glyphs', async () => {
    const small = await render('evidence-card', { textScale: 0.7 })
    const large = await render('evidence-card', { textScale: 1.35 })

    expect(small.plan.fontSize).toBeLessThan(large.plan.fontSize)
    expect(small.painted[0].height).toBeLessThan(large.painted[0].height)
  })

  it('editorial-split: text size resizes the band once the copy is bottom-anchored', async () => {
    const small = await render('editorial-split', { position: 'bottom', textScale: 0.7 })
    const large = await render('editorial-split', { position: 'bottom', textScale: 1.35 })

    expect(small.plan.fontSize).toBeLessThan(large.plan.fontSize)
    expect(large.painted[0].height).toBeGreaterThan(small.painted[0].height)
  })

  it('paints the explicit text backdrop at the composite backdrop bounds', async () => {
    const overlay = { backgroundEnabled: true, backgroundOpacity: 0.4, backgroundPadding: 64 }
    const { plan, calls } = await render('spotlight-reveal', overlay)
    const backdrop = plan.composite.backdrop
    const alphaAt = calls.findIndex((call) => call.op === 'set:globalAlpha' && call.args[0] === 0.4)

    expect(alphaAt).toBeGreaterThanOrEqual(0)
    expect(calls.slice(alphaAt).some((call) => call.op === 'fillRect' &&
      call.args[0] === backdrop.x && call.args[1] === backdrop.y &&
      call.args[2] === backdrop.width && call.args[3] === backdrop.height)).toBe(true)
    expect(planFor('spotlight-reveal', { backgroundEnabled: false }).composite.backdrop).toBeNull()
  })
})

describe('the composite stays inside its bounds', () => {
  const extremes = []
  for (const position of ['auto', 'top', 'center', 'bottom']) {
    for (const offsetX of [-999, 0, 999]) {
      for (const offsetY of [-999, 0, 999]) {
        for (const backgroundPadding of [0, 96]) {
          for (const textScale of [0.7, 1.35]) {
            extremes.push({ position, offsetX, offsetY, backgroundPadding, textScale, backgroundEnabled: true })
          }
        }
      }
    }
  }

  it('clamps copy, panel, and backdrop for every layout, preset, and control extreme', () => {
    for (const layoutId of LAYOUT_IDS) {
      for (const preset of STYLE_PRESETS) {
        for (const overlay of extremes) {
          const label = `${layoutId}/${preset.id}/${JSON.stringify(overlay)}`
          const plan = planFor(layoutId, overlay, { presetId: preset.id })
          const { panel, text, backdrop } = plan.composite

          for (const line of plan.lines) {
            expect(line.x, `${label} copy left`).toBeGreaterThanOrEqual(textSafeArea.left)
            expect(line.x + line.width, `${label} copy right`).toBeLessThanOrEqual(textSafeArea.right)
            expect(line.y, `${label} copy top`).toBeGreaterThanOrEqual(textSafeArea.top)
            expect(line.y + plan.lineHeight, `${label} copy bottom`).toBeLessThanOrEqual(textSafeArea.bottom)
          }

          expect(panel.x, `${label} panel left`).toBeGreaterThanOrEqual(0)
          expect(panel.y, `${label} panel top`).toBeGreaterThanOrEqual(0)
          expect(panel.x + panel.width, `${label} panel right`).toBeLessThanOrEqual(canvasSpec.width)
          expect(panel.y + panel.height, `${label} panel bottom`).toBeLessThanOrEqual(canvasSpec.height)

          // One composited object: the copy can never sit outside its panel.
          expect(text.left, `${label} copy escapes panel left`).toBeGreaterThanOrEqual(panel.x)
          expect(text.right, `${label} copy escapes panel right`).toBeLessThanOrEqual(panel.x + panel.width)
          expect(text.top, `${label} copy escapes panel top`).toBeGreaterThanOrEqual(panel.y)
          expect(text.bottom, `${label} copy escapes panel bottom`).toBeLessThanOrEqual(panel.y + panel.height)

          expect(backdrop.x, `${label} backdrop left`).toBeGreaterThanOrEqual(textSafeArea.left)
          expect(backdrop.x + backdrop.width, `${label} backdrop right`).toBeLessThanOrEqual(textSafeArea.right)
          expect(backdrop.y, `${label} backdrop top`).toBeGreaterThanOrEqual(textSafeArea.top)
          expect(backdrop.y + backdrop.height, `${label} backdrop bottom`).toBeLessThanOrEqual(textSafeArea.bottom)
        }
      }
    }
  })

  it('degrades to a usable box when a layout is unknown or no copy was laid out', () => {
    const geometry = composeOverlayGeometry({ layoutId: 'not-a-layout', frame: { x: 400, yTop: 300, yBottom: 900 }, lines: [], blockTop: 300, blockBottom: 300, overlay: {} })
    expect(geometry.mode).toBe(PANEL_CHROME['editorial-split'].mode)
    expect(geometry.text).toEqual({ left: 400, right: 400, top: 300, bottom: 300 })
    expect(geometry.backdrop).toBeNull()
    expect(geometry.panel.width).toBe(canvasSpec.width)
  })
})

describe('preview and export share one composite geometry', () => {
  it.each(PANEL_LAYOUTS)('%s: the painted panel is exactly the panel in the plan', async (layoutId) => {
    for (const overlay of [{}, { position: 'top', offsetY: -320 }, { offsetX: 240, backgroundPadding: 80 }, { position: 'bottom', textScale: 1.2 }]) {
      const { plan, painted } = await render(layoutId, overlay)
      expect(painted, `${layoutId} ${JSON.stringify(overlay)}`).toEqual([boxOf(plan)])
    }
  })

  // The exported ZIP stores the very blob the preview displays, so parity is
  // guaranteed by the render being a pure function of the slide. This pins
  // that purity for a moved and resized composite.
  it('renders an identical draw sequence for the same slide every time', async () => {
    const overlay = { position: 'top', offsetY: -260, offsetX: 180, backgroundEnabled: true, backgroundPadding: 88, backgroundOpacity: 0.55, textScale: 1.2 }
    const first = await render('editorial-split', overlay)
    const second = await render('editorial-split', overlay)
    expect(JSON.stringify(second.calls)).toBe(JSON.stringify(first.calls))
    expect(first.calls.some((call) => call.op === 'drawImage')).toBe(true)
  })

  it('renders a different composite once the overlay changes, so a stale export is impossible', async () => {
    const before = await render('takeaway-ledger', {})
    const after = await render('takeaway-ledger', { position: 'top', offsetY: -300 })
    expect(JSON.stringify(after.calls)).not.toBe(JSON.stringify(before.calls))
    expect(overlaySettingsKey({ position: 'top', offsetY: -300 })).not.toBe(overlaySettingsKey({}))
  })
})

describe('a composite change invalidates approval and the stored frame', () => {
  const slide = { text: COPY, visual: 'One scene', direction: { layout: 'editorial-split' } }
  const renderedFor = (overlay) => ({
    composedBlob: {}, renderedText: slide.text, renderedVisual: slide.visual,
    renderedPreset: 'impact', renderedLayout: 'editorial-split', renderedOverlayKey: overlaySettingsKey(overlay),
  })

  it.each([
    ['position', { position: 'bottom' }],
    ['horizontal offset', { offsetX: 96 }],
    ['vertical offset', { offsetY: -160 }],
    ['background toggle', { backgroundEnabled: true }],
    ['background opacity', { backgroundOpacity: 0.3 }],
    ['panel padding', { backgroundPadding: 8 }],
    ['text size', { textScale: 1.25 }],
  ])('changing %s marks the stored frame stale', (_, patch) => {
    const rendered = renderedFor({})
    expect(isRenderCurrent({ ...slide, overlay: {} }, rendered, 'impact')).toBe(true)
    expect(isRenderCurrent({ ...slide, overlay: patch }, rendered, 'impact')).toBe(false)
  })

  it('accepts the frame again once it is re-rendered with the new composite', () => {
    const moved = { position: 'top', offsetY: -400, backgroundPadding: 64 }
    expect(isRenderCurrent({ ...slide, overlay: moved }, renderedFor(moved), 'impact')).toBe(true)
    expect(isRenderCurrent({ ...slide, overlay: moved }, renderedFor({}), 'impact')).toBe(false)
  })
})
