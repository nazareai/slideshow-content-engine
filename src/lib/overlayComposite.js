// The overlay is ONE composited object: the copy block and the panel painted
// beneath it. Everything that decides where that object sits, how big it is,
// and whether a stored render of it is still valid lives here — so the
// geometry that paints a frame and the key that decides whether a frame is
// stale can never drift apart.
import { canvasSpec } from './artDirection'

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const finite = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback)

export const OVERLAY_POSITIONS = Object.freeze(['auto', 'top', 'center', 'bottom'])

export const OVERLAY_BOUNDS = Object.freeze({
  offsetX: Object.freeze([-320, 320]),
  offsetY: Object.freeze([-560, 560]),
  backgroundOpacity: Object.freeze([0, 1]),
  backgroundPadding: Object.freeze([0, 96]),
  textScale: Object.freeze([0.7, 1.35]),
})

export const DEFAULT_OVERLAY_SETTINGS = Object.freeze({
  position: 'auto',
  offsetX: 0,
  offsetY: 0,
  backgroundEnabled: false,
  backgroundOpacity: 0.72,
  backgroundPadding: 32,
  textScale: 1,
})

// One normalization for both the renderer and the freshness key. An explicit
// 0 must survive (hence the finite check rather than `||`), and an omitted
// field must resolve to the documented default rather than to zero.
export function normalizeOverlaySettings(value) {
  const settings = value || {}
  const bounded = (key) => clamp(finite(settings[key], DEFAULT_OVERLAY_SETTINGS[key]), ...OVERLAY_BOUNDS[key])
  return {
    position: OVERLAY_POSITIONS.includes(settings.position) ? settings.position : DEFAULT_OVERLAY_SETTINGS.position,
    offsetX: bounded('offsetX'),
    offsetY: bounded('offsetY'),
    backgroundEnabled: Boolean(settings.backgroundEnabled),
    backgroundOpacity: bounded('backgroundOpacity'),
    backgroundPadding: bounded('backgroundPadding'),
    textScale: bounded('textScale'),
  }
}

// Stable identity of one slide's composite layout. Any change that moves or
// resizes the composite changes this string, which is what invalidates the
// slide's approval and marks its composed asset stale.
export function overlaySettingsKey(value) {
  return JSON.stringify(normalizeOverlaySettings(value))
}

// Chrome is the space each composition reserves around the copy for its own
// furniture — kicker, accent rule, index badge, source footer. The panel is
// the copy box grown by this chrome, so it travels and resizes with the copy
// instead of sitting at a hardcoded y. The numbers reproduce each shipped
// composition's original fixed geometry exactly at default overlay settings.
//
//   band  — full-bleed strip (editorial panel, ledger panel)
//   card  — floating panel that hugs the copy (field-note card)
//   scrim — gradient/wash extent rather than an opaque fill
//
// `bleedTop`/`bleedBottom` are how far past its own copy frame a composition
// is designed to run before it should bleed off the canvas instead of leaving
// a sliver against the reserved zone. The test is applied to the copy frame
// *translated with the composite*, which is what makes the default renders
// pixel-identical while a displaced composite lets go of the edge it left.
export const PANEL_CHROME = Object.freeze({
  'impact-stack': Object.freeze({ mode: 'scrim', top: 420, bottom: 0, left: 0, right: 0, bleedTop: 0, bleedBottom: 104 }),
  'editorial-split': Object.freeze({ mode: 'band', top: 130, bottom: 92, left: 0, right: 0, bleedTop: 0, bleedBottom: 92 }),
  'evidence-card': Object.freeze({ mode: 'card', top: 84, bottom: 92, left: 0, right: 0, bleedTop: 0, bleedBottom: 0 }),
  'tension-rail': Object.freeze({ mode: 'scrim', top: 90, bottom: 120, left: 30, right: 18, bleedTop: 0, bleedBottom: 0 }),
  'spotlight-reveal': Object.freeze({ mode: 'scrim', top: 200, bottom: 160, left: 0, right: 0, bleedTop: 0, bleedBottom: 0 }),
  'takeaway-ledger': Object.freeze({ mode: 'band', top: 106, bottom: 92, left: 0, right: 0, bleedTop: 0, bleedBottom: 92 }),
  'cta-stamp': Object.freeze({ mode: 'scrim', top: 170, bottom: 140, left: 0, right: 0, bleedTop: 0, bleedBottom: 0 }),
})

// A hugging card must still be wide enough to hold its own source footer.
const CARD_MIN_CONTENT_WIDTH = 440

// Pure geometry for the whole composite. Given the laid-out copy lines and the
// slide's overlay settings, produce the copy box, the panel actually painted
// beneath it, and the optional explicit text backdrop. Painters consume only
// this — they must never re-derive a panel from static frame constants, which
// is precisely what left the panel behind when the copy moved.
export function composeOverlayGeometry({
  layoutId,
  frame = {},
  frameSpan,
  lines = [],
  blockTop = 0,
  blockBottom = 0,
  overlay,
  canvas = canvasSpec,
  safe = canvasSpec.safe,
}) {
  const chrome = PANEL_CHROME[layoutId] || PANEL_CHROME['editorial-split']
  const settings = normalizeOverlaySettings(overlay)

  // The padding control is a delta around its neutral default, so the shipped
  // compositions keep their original geometry at rest while the slider still
  // visibly grows and shrinks the real panel in both directions.
  const padDelta = settings.backgroundPadding - DEFAULT_OVERLAY_SETTINGS.backgroundPadding
  const framePad = finite(frame.pad, 0)
  const inset = (base) => Math.max(0, base + framePad + padDelta)

  const anchorX = finite(frame.x, 0)
  const text = lines.length
    ? {
      left: Math.min(...lines.map((line) => line.x)),
      right: Math.max(...lines.map((line) => line.x + line.width)),
      top: blockTop,
      bottom: blockBottom,
    }
    : { left: anchorX, right: anchorX, top: blockTop, bottom: blockBottom }

  const contentRight = chrome.mode === 'card'
    ? Math.max(text.right, text.left + Math.min(finite(frame.maxWidth, CARD_MIN_CONTENT_WIDTH), CARD_MIN_CONTENT_WIDTH))
    : text.right

  const edge = {
    left: text.left - inset(chrome.left),
    right: contentRight + inset(chrome.right),
    top: text.top - inset(chrome.top),
    bottom: text.bottom + inset(chrome.bottom),
  }

  // Bleed is decided from the copy frame carried along with the composite, not
  // from the copy box: a composition sitting where its layout put it keeps
  // running off the canvas edge exactly as designed, while a composite the
  // reviewer has moved away from that edge lets go of it and gives the image
  // region back — which is the whole point of moving it.
  const span = frameSpan || { top: finite(frame.yTop, blockTop), bottom: finite(frame.yBottom, blockBottom) }
  const bleedTop = chrome.mode !== 'card' && span.top - chrome.bleedTop <= safe.top
  const bleedBottom = chrome.mode !== 'card' && span.bottom + chrome.bleedBottom >= safe.bottom
  const spanTop = bleedTop ? 0 : clamp(edge.top, 0, canvas.height)
  const spanBottom = bleedBottom ? canvas.height : clamp(edge.bottom, 0, canvas.height)

  const left = chrome.mode === 'band' ? 0 : clamp(edge.left, 0, canvas.width)
  const right = chrome.mode === 'band' ? canvas.width : clamp(edge.right, 0, canvas.width)
  const top = chrome.mode === 'card' ? clamp(edge.top, 0, canvas.height) : spanTop
  const bottom = chrome.mode === 'card' ? clamp(edge.bottom, 0, canvas.height) : spanBottom
  const panel = { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }

  // Gradient scrims need a direction, not just an extent: `from` is the
  // transparent end and `to` the dark end, so a composite lifted to the top of
  // the frame darkens upward instead of darkening the image below it.
  const scrim = bleedTop && !bleedBottom ? { from: bottom, to: top } : { from: top, to: bottom }

  let backdrop = null
  if (settings.backgroundEnabled && lines.length) {
    const left = clamp(text.left - settings.backgroundPadding, safe.left, safe.right)
    const right = clamp(text.right + settings.backgroundPadding, safe.left, safe.right)
    const top = clamp(text.top - settings.backgroundPadding, safe.top, safe.bottom)
    const bottom = clamp(text.bottom + settings.backgroundPadding, safe.top, safe.bottom)
    backdrop = { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }
  }

  return { mode: chrome.mode, chrome, settings, text, edge, panel, backdrop, scrim, bleedTop, bleedBottom }
}
