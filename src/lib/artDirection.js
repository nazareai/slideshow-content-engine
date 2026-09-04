// Visual direction system: narrative-role-driven compositions, style presets,
// and deterministic validation of model-supplied art-direction metadata.

const clean = (value) => String(value ?? '').trim()
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

// TikTok-safe canvas geometry for 1080x1920 output. The right rail is reserved
// for the like/comment/share/save action stack, the bottom for caption + sound.
export const canvasSpec = Object.freeze({
  width: 1080,
  height: 1920,
  safe: Object.freeze({ top: 228, bottom: 1552, left: 72, right: 936 }),
})

export const NARRATIVE_ROLES = Object.freeze(['hook', 'setup', 'evidence', 'tension', 'reveal', 'takeaway', 'cta'])

const roleAliases = {
  hook: 'hook', opener: 'hook', 'pattern interrupt': 'hook',
  setup: 'setup', context: 'setup', background: 'setup', premise: 'setup', implication: 'setup',
  evidence: 'evidence', observation: 'evidence', proof: 'evidence', data: 'evidence', example: 'evidence', measurement: 'evidence', 'field note': 'evidence',
  tension: 'tension', risk: 'tension', problem: 'tension', conflict: 'tension', question: 'tension', mistake: 'tension',
  reveal: 'reveal', shift: 'reveal', turn: 'reveal', insight: 'reveal', 'aha': 'reveal', answer: 'reveal',
  takeaway: 'takeaway', payoff: 'takeaway', lesson: 'takeaway', rule: 'takeaway', 'next step': 'takeaway', summary: 'takeaway', result: 'takeaway',
  cta: 'cta', 'call to action': 'cta', close: 'cta', save: 'cta',
}

export function normalizeRole(role) {
  const value = clean(role).toLowerCase()
  if (roleAliases[value]) return roleAliases[value]
  for (const [alias, canonical] of Object.entries(roleAliases)) {
    if (value.includes(alias)) return canonical
  }
  return 'setup'
}

// Seven materially distinct compositions. `zone`/`align`/`measure` are the
// shared numeric contract the compositor and tests introspect; the compositor
// branches on `id` for the treatment itself.
export const LAYOUTS = Object.freeze({
  'impact-stack': Object.freeze({
    id: 'impact-stack', role: 'hook', zone: 'top', align: 'left',
    maxWidthRatio: 1, fontRange: Object.freeze([68, 148]), maxLines: 6, lineHeight: 1.02,
    blurb: 'Full-bleed image, oversized stacked display type pinned to the top, heavy base scrim, big index numeral, swipe cue.',
  }),
  'editorial-split': Object.freeze({
    id: 'editorial-split', role: 'setup', zone: 'lower-third', align: 'left',
    maxWidthRatio: 0.94, fontRange: Object.freeze([46, 76]), maxLines: 5, lineHeight: 1.14,
    blurb: 'Asymmetric magazine split: image on top, solid editorial panel holding the copy with a kicker and accent rule.',
  }),
  'evidence-card': Object.freeze({
    id: 'evidence-card', role: 'evidence', zone: 'middle', align: 'left',
    maxWidthRatio: 0.78, fontRange: Object.freeze([48, 72]), maxLines: 6, lineHeight: 1.16,
    blurb: 'Offset field-note card floated left of the rail with a quote tick, emphasis underline, and source footer.',
  }),
  'tension-rail': Object.freeze({
    id: 'tension-rail', role: 'tension', zone: 'middle', align: 'left',
    maxWidthRatio: 0.62, fontRange: Object.freeze([46, 84]), maxLines: 7, lineHeight: 1.1,
    blurb: 'Side scrim pulling the frame dark from one edge, narrow ragged column hugging the rail, vertical accent bar.',
  }),
  'spotlight-reveal': Object.freeze({
    id: 'spotlight-reveal', role: 'reveal', zone: 'counter-focal', align: 'left',
    maxWidthRatio: 0.88, fontRange: Object.freeze([48, 108]), maxLines: 6, lineHeight: 1.05,
    blurb: 'Focal-point-aware radial spotlight; copy sits in the counter-focal half with the emphasis line in accent color.',
  }),
  'takeaway-ledger': Object.freeze({
    id: 'takeaway-ledger', role: 'takeaway', zone: 'bottom', align: 'left',
    maxWidthRatio: 0.92, fontRange: Object.freeze([46, 74]), maxLines: 5, lineHeight: 1.15,
    blurb: 'Bottom-anchored ledger panel with an index badge, divider rule, and the takeaway set like a pull quote.',
  }),
  'cta-stamp': Object.freeze({
    id: 'cta-stamp', role: 'cta', zone: 'middle', align: 'center',
    maxWidthRatio: 0.8, fontRange: Object.freeze([46, 88]), maxLines: 6, lineHeight: 1.1,
    blurb: 'Framed closing card with a rotated stamp chip, bookmark glyph, and series footer — a poster, not a caption.',
  }),
})

export const LAYOUT_IDS = Object.freeze(Object.keys(LAYOUTS))

const roleToLayout = {
  hook: 'impact-stack', setup: 'editorial-split', evidence: 'evidence-card',
  tension: 'tension-rail', reveal: 'spotlight-reveal', takeaway: 'takeaway-ledger', cta: 'cta-stamp',
}

export function layoutForRole(role) {
  return roleToLayout[normalizeRole(role)] || 'editorial-split'
}

// Style presets materially change typography and composition treatment, not
// just colors: font stack, casing, leading, panel geometry, emphasis mode,
// scrim weight, and texture all shift together.
export const STYLE_PRESETS = Object.freeze([
  Object.freeze({
    id: 'impact', name: 'Bold Impact',
    blurb: 'Condensed 900-weight caps, hard panels, deep scrims, highlight-box emphasis.',
    display: Object.freeze({ family: "'Helvetica Neue', Helvetica, 'Arial Narrow', Arial, sans-serif", weight: 900, transform: 'upper', letterSpacing: '-1px' }),
    kicker: Object.freeze({ family: "'Helvetica Neue', Arial, sans-serif", weight: 700, size: 30, letterSpacing: '5px' }),
    sizeScale: 1, lineHeightScale: 1, paddingScale: 1,
    panel: Object.freeze({ radius: 0, rotation: 0 }),
    emphasis: 'highlight', grainAlpha: 0.05, scrimBoost: 1,
    palette: Object.freeze({ paper: '#f4f1ea', ink: '#141414', accent: '#ffdc36', accentInk: '#141414' }),
  }),
  Object.freeze({
    id: 'zine', name: 'Zine Punch',
    blurb: 'Riso-zine energy: rotated panels, tape chips, outline-stroke emphasis, heavy grain.',
    display: Object.freeze({ family: "'Arial Black', 'Helvetica Neue', Arial, sans-serif", weight: 900, transform: 'upper', letterSpacing: '0px' }),
    kicker: Object.freeze({ family: "'Courier New', monospace", weight: 700, size: 30, letterSpacing: '3px' }),
    sizeScale: 1.02, lineHeightScale: 1.04, paddingScale: 0.92,
    panel: Object.freeze({ radius: 4, rotation: -1.6 }),
    emphasis: 'stroke', grainAlpha: 0.1, scrimBoost: 1.08,
    palette: Object.freeze({ paper: '#f6f2e8', ink: '#101014', accent: '#ff4d3d', accentInk: '#fffdf6' }),
  }),
  Object.freeze({
    id: 'docu', name: 'Quiet Documentary',
    blurb: 'Georgia serif in sentence case, generous air, thin rules, underline emphasis, soft light scrims.',
    display: Object.freeze({ family: "Georgia, 'Times New Roman', serif", weight: 700, transform: 'none', letterSpacing: '0px' }),
    kicker: Object.freeze({ family: "'Helvetica Neue', Arial, sans-serif", weight: 600, size: 26, letterSpacing: '6px' }),
    sizeScale: 0.86, lineHeightScale: 1.18, paddingScale: 1.22,
    panel: Object.freeze({ radius: 22, rotation: 0 }),
    emphasis: 'underline', grainAlpha: 0.03, scrimBoost: 0.88,
    palette: Object.freeze({ paper: '#f7f4ee', ink: '#1b1a17', accent: '#c65f33', accentInk: '#f7f4ee' }),
  }),
  Object.freeze({
    id: 'log', name: 'Field Log',
    blurb: 'Monospace terminal log: bracketed labels, boxed emphasis, ruled grid marks, utilitarian spacing.',
    display: Object.freeze({ family: "Menlo, 'Courier New', monospace", weight: 700, transform: 'upper', letterSpacing: '0px' }),
    kicker: Object.freeze({ family: "Menlo, 'Courier New', monospace", weight: 700, size: 26, letterSpacing: '2px' }),
    sizeScale: 0.78, lineHeightScale: 1.22, paddingScale: 1.05,
    panel: Object.freeze({ radius: 2, rotation: 0 }),
    emphasis: 'box', grainAlpha: 0.04, scrimBoost: 1.02,
    palette: Object.freeze({ paper: '#eef0e9', ink: '#15170f', accent: '#b5e941', accentInk: '#15170f' }),
  }),
])

export const DEFAULT_PRESET_ID = 'impact'

export function getPreset(id) {
  return STYLE_PRESETS.find((preset) => preset.id === clean(id)) || STYLE_PRESETS[0]
}

const focalDefaults = {
  'impact-stack': { x: 0.5, y: 0.62 }, 'editorial-split': { x: 0.5, y: 0.34 },
  'evidence-card': { x: 0.68, y: 0.3 }, 'tension-rail': { x: 0.72, y: 0.45 },
  'spotlight-reveal': { x: 0.5, y: 0.3 }, 'takeaway-ledger': { x: 0.5, y: 0.32 }, 'cta-stamp': { x: 0.5, y: 0.5 },
}

export function deriveEmphasis(text) {
  const words = clean(text).split(/\s+/).map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')).filter(Boolean)
  if (!words.length) return ''
  const strong = words.filter((word) => word.length >= 5)
  return (strong.length ? strong[strong.length - 1] : words[words.length - 1])
}

function normalizeFocalPoint(raw, layout) {
  const fallback = focalDefaults[layout] || { x: 0.5, y: 0.4 }
  const x = Number(raw?.x)
  const y = Number(raw?.y)
  return {
    x: Number.isFinite(x) ? clamp(x, 0.12, 0.88) : fallback.x,
    y: Number.isFinite(y) ? clamp(y, 0.12, 0.88) : fallback.y,
  }
}

// Validate one slide's model-supplied metadata into a renderable direction.
// Invalid or missing fields are derived deterministically — never rejected —
// so a weaker text model still produces a fully art-directed sequence.
export function validateDirection(raw, slide = {}) {
  const requested = clean(raw?.layout).toLowerCase()
  const layout = LAYOUT_IDS.includes(requested) ? requested : layoutForRole(slide.role)
  const text = clean(slide.text)
  const requestedEmphasis = clean(raw?.emphasis)
  const emphasisValid = requestedEmphasis && requestedEmphasis.split(/\s+/).length <= 3 &&
    text.toLowerCase().includes(requestedEmphasis.toLowerCase())
  return {
    layout,
    focalPoint: normalizeFocalPoint(raw?.focalPoint, layout),
    emphasis: emphasisValid ? requestedEmphasis : deriveEmphasis(text),
    mirror: raw?.mirror === true,
  }
}

// Assign directions across a sequence and enforce rhythm: no layout twice in a
// row, and at least min(5, n) distinct layouts overall. Repeated layouts first
// mirror (flip composition side), then get swapped for an unused archetype.
export function planDirections(slides = []) {
  const directions = slides.map((slide) => validateDirection(slide.direction ?? slide, slide))
  const total = directions.length
  const targetDistinct = Math.min(5, total)

  for (let index = 1; index < total; index += 1) {
    if (directions[index].layout === directions[index - 1].layout) {
      const usedSoFar = new Set(directions.map((direction) => direction.layout))
      const candidates = LAYOUT_IDS.filter((id) => id !== directions[index].layout &&
        id !== directions[index - 1]?.layout && id !== directions[index + 1]?.layout &&
        id !== 'impact-stack' && id !== 'cta-stamp')
      const replacement = candidates.find((id) => !usedSoFar.has(id)) || candidates[0]
      if (replacement) directions[index] = { ...directions[index], layout: replacement, focalPoint: normalizeFocalPoint(directions[index].focalPoint, replacement) }
    }
  }

  const used = () => new Set(directions.map((direction) => direction.layout))
  if (used().size < targetDistinct) {
    const counts = {}
    directions.forEach((direction) => { counts[direction.layout] = (counts[direction.layout] || 0) + 1 })
    for (let index = 1; index < total - 1 && used().size < targetDistinct; index += 1) {
      if (counts[directions[index].layout] > 1) {
        const unused = LAYOUT_IDS.find((id) => !used().has(id) && id !== directions[index - 1]?.layout && id !== directions[index + 1]?.layout)
        if (unused) {
          counts[directions[index].layout] -= 1
          counts[unused] = 1
          directions[index] = { ...directions[index], layout: unused, focalPoint: normalizeFocalPoint(directions[index].focalPoint, unused) }
        }
      }
    }
  }

  const seen = {}
  return directions.map((direction) => {
    seen[direction.layout] = (seen[direction.layout] || 0) + 1
    return { ...direction, mirror: seen[direction.layout] % 2 === 0 }
  })
}

export function describeDirection(direction) {
  const layout = LAYOUTS[direction?.layout]
  if (!layout) return 'Unplanned composition'
  return `${layout.id}${direction.mirror ? ' (mirrored)' : ''} · emphasis “${direction.emphasis || '—'}”`
}
