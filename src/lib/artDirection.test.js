import { describe, expect, it } from 'vitest'
import {
  canvasSpec, deriveEmphasis, getPreset, LAYOUT_IDS, LAYOUTS, layoutForRole,
  normalizeRole, planDirections, STYLE_PRESETS, validateDirection,
} from './artDirection'

const story = (layouts) => layouts.map((layout, index) => ({
  id: index + 1, role: 'Evidence', text: `Slide number ${index + 1} makes one sharp specific point`, direction: { layout },
}))

describe('visual direction system', () => {
  it('ships at least five materially distinct composition archetypes', () => {
    expect(LAYOUT_IDS.length).toBeGreaterThanOrEqual(5)
    const zones = new Set(LAYOUT_IDS.map((id) => `${LAYOUTS[id].zone}|${LAYOUTS[id].align}|${LAYOUTS[id].maxWidthRatio}`))
    expect(zones.size).toBe(LAYOUT_IDS.length)
  })

  it('maps every narrative role, including model synonyms, onto a composition', () => {
    expect(layoutForRole('Hook')).toBe('impact-stack')
    expect(layoutForRole('Context')).toBe('editorial-split')
    expect(layoutForRole('Observation')).toBe('evidence-card')
    expect(layoutForRole('Risk')).toBe('tension-rail')
    expect(layoutForRole('Shift')).toBe('spotlight-reveal')
    expect(layoutForRole('Payoff')).toBe('takeaway-ledger')
    expect(layoutForRole('CTA')).toBe('cta-stamp')
    expect(normalizeRole('Pattern Interrupt')).toBe('hook')
    expect(normalizeRole('something unknown')).toBe('setup')
  })

  it('offers style presets that change typography and composition, not only colors', () => {
    expect(STYLE_PRESETS.length).toBeGreaterThanOrEqual(3)
    const families = new Set(STYLE_PRESETS.map((preset) => preset.display.family))
    const casings = new Set(STYLE_PRESETS.map((preset) => preset.display.transform))
    const emphases = new Set(STYLE_PRESETS.map((preset) => preset.emphasis))
    const geometry = new Set(STYLE_PRESETS.map((preset) => `${preset.sizeScale}|${preset.lineHeightScale}|${preset.paddingScale}|${preset.panel.rotation}`))
    expect(families.size).toBe(STYLE_PRESETS.length)
    expect(casings.size).toBeGreaterThan(1)
    expect(emphases.size).toBeGreaterThanOrEqual(3)
    expect(geometry.size).toBe(STYLE_PRESETS.length)
    expect(getPreset('nonsense').id).toBe(STYLE_PRESETS[0].id)
  })

  it('validates model metadata: clamps focal points, rejects unknown layouts, verifies emphasis', () => {
    const slide = { role: 'Tension', text: 'Nobody wanted to save any of them' }
    const direction = validateDirection({ layout: 'made-up-layout', emphasis: 'absent', focalPoint: { x: 9, y: -3 } }, slide)
    expect(direction.layout).toBe('tension-rail')
    expect(direction.focalPoint.x).toBeLessThanOrEqual(0.88)
    expect(direction.focalPoint.y).toBeGreaterThanOrEqual(0.12)
    expect(slide.text.toLowerCase()).toContain(direction.emphasis.toLowerCase())
    const kept = validateDirection({ layout: 'impact-stack', emphasis: 'save', focalPoint: { x: 0.4, y: 0.6 } }, slide)
    expect(kept).toMatchObject({ layout: 'impact-stack', emphasis: 'save', focalPoint: { x: 0.4, y: 0.6 } })
  })

  it('derives a meaningful emphasis word deterministically', () => {
    expect(deriveEmphasis('Publishing worked. Taste was the bottleneck.')).toBe('bottleneck')
    expect(deriveEmphasis('One two')).toBe('two')
    expect(deriveEmphasis('')).toBe('')
  })

  it('never repeats a layout back-to-back even when the model returns one layout for all slides', () => {
    const directions = planDirections(story(Array.from({ length: 7 }, () => 'editorial-split')))
    directions.forEach((direction, index) => {
      if (index > 0) expect(direction.layout).not.toBe(directions[index - 1].layout)
    })
  })

  it('guarantees at least five distinct compositions across a monotone six-slide sequence', () => {
    const directions = planDirections(story(Array.from({ length: 6 }, () => 'evidence-card')))
    expect(new Set(directions.map((direction) => direction.layout)).size).toBeGreaterThanOrEqual(5)
  })

  it('keeps role-correct layouts untouched when the sequence is already diverse', () => {
    const slides = [
      { role: 'Hook', text: 'Hook copy with enough words here', direction: { layout: 'impact-stack' } },
      { role: 'Context', text: 'Context copy with enough words here', direction: { layout: 'editorial-split' } },
      { role: 'Evidence', text: 'Evidence copy with enough words here', direction: { layout: 'evidence-card' } },
      { role: 'Tension', text: 'Tension copy with enough words here', direction: { layout: 'tension-rail' } },
      { role: 'Shift', text: 'Shift copy with enough words here', direction: { layout: 'spotlight-reveal' } },
      { role: 'CTA', text: 'CTA copy with enough words here', direction: { layout: 'cta-stamp' } },
    ]
    const directions = planDirections(slides)
    expect(directions.map((direction) => direction.layout)).toEqual(['impact-stack', 'editorial-split', 'evidence-card', 'tension-rail', 'spotlight-reveal', 'cta-stamp'])
  })

  it('mirrors the second occurrence of a repeated layout for slide-to-slide rhythm', () => {
    const slides = story(['evidence-card', 'tension-rail', 'evidence-card', 'spotlight-reveal', 'editorial-split', 'takeaway-ledger', 'evidence-card'])
    const directions = planDirections(slides)
    const evidence = directions.filter((direction) => direction.layout === 'evidence-card')
    if (evidence.length > 1) expect(evidence[1].mirror).toBe(true)
    expect(directions[0].mirror).toBe(false)
  })

  it('publishes the TikTok-safe text region used by every composition', () => {
    expect(canvasSpec.width).toBe(1080)
    expect(canvasSpec.height).toBe(1920)
    expect(canvasSpec.safe.top).toBeGreaterThanOrEqual(200)
    expect(canvasSpec.safe.bottom).toBeLessThanOrEqual(1600)
    expect(canvasSpec.safe.right).toBeLessThanOrEqual(960)
  })
})
