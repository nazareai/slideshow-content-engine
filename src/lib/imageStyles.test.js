import { describe, expect, it } from 'vitest'
import { LAYOUT_IDS, STYLE_PRESETS, getPreset } from './artDirection'
import {
  CUSTOM_STYLE_PLACEHOLDER, DEFAULT_IMAGE_STYLE_ID, IMAGE_STYLE_FIELDS, IMAGE_STYLE_IDS,
  IMAGE_STYLES, getImageStyle, resolveImageStyle, styleDirective,
} from './imageStyles'

const fixedStyles = IMAGE_STYLES.filter((style) => !style.editable)

describe('image generation styles', () => {
  it('offers exactly the required viral styles plus Custom, none named Professional', () => {
    expect(IMAGE_STYLES.map((style) => style.name)).toEqual([
      'Creator Candid', 'Cinematic', 'Flash Editorial', 'Documentary',
      'Y2K Internet', 'Luxury Minimal', 'Surreal Meme', 'Custom',
    ])
    expect(IMAGE_STYLES.some((style) => /professional/i.test(style.name))).toBe(false)
    expect(IMAGE_STYLES.filter((style) => style.editable)).toHaveLength(1)
  })

  it('gives every fixed style a complete structured directive across all six axes', () => {
    for (const style of fixedStyles) {
      for (const field of IMAGE_STYLE_FIELDS) {
        expect(style.directive[field], `${style.id}.${field}`).toBeTruthy()
        expect(style.directive[field].length, `${style.id}.${field} depth`).toBeGreaterThan(40)
      }
      expect(style.tagline).toBeTruthy()
      expect(style.swatch).toHaveLength(3)
    }
  })

  it('keeps the styles materially distinct on every single axis, not just overall', () => {
    for (const field of IMAGE_STYLE_FIELDS) {
      const values = fixedStyles.map((style) => style.directive[field])
      expect(new Set(values).size, `distinct ${field}`).toBe(fixedStyles.length)
    }
    const directives = fixedStyles.map((style) => styleDirective(style))
    expect(new Set(directives).size).toBe(fixedStyles.length)
    directives.forEach((directive, index) => {
      expect(directive).toContain(`${fixedStyles[index].name} image style`)
      expect(directive).toContain('Subject treatment:')
      expect(directive).toContain('Lighting:')
      expect(directive).toContain('Camera and lens:')
      expect(directive).toContain('Texture and color grade:')
      expect(directive).toContain('Composition:')
    })
  })

  it('routes the editable Custom text verbatim into the directive', () => {
    const custom = resolveImageStyle({ styleId: 'custom', customText: '  Shot on a disposable camera at a wedding, harsh flash, red-cup chaos  ' })
    expect(custom.id).toBe('custom')
    expect(custom.custom).toBe('Shot on a disposable camera at a wedding, harsh flash, red-cup chaos')
    expect(custom.directive).toContain('Shot on a disposable camera at a wedding, harsh flash, red-cup chaos')
  })

  it('still produces a workable non-generic directive when Custom is left blank', () => {
    const blank = resolveImageStyle({ styleId: 'custom', customText: '   ' })
    expect(blank.directive.length).toBeGreaterThan(40)
    expect(blank.directive).not.toMatch(/professional/i)
    expect(CUSTOM_STYLE_PLACEHOLDER.length).toBeGreaterThan(20)
  })

  it('falls back to the default style for unknown selections and stays idempotent', () => {
    expect(getImageStyle('does-not-exist').id).toBe(DEFAULT_IMAGE_STYLE_ID)
    expect(resolveImageStyle().id).toBe(DEFAULT_IMAGE_STYLE_ID)
    expect(resolveImageStyle('cinematic').id).toBe('cinematic')
    const once = resolveImageStyle({ styleId: 'custom', customText: 'lomo fisheye chaos' })
    expect(resolveImageStyle(once)).toEqual(once)
  })

  it('is a fully independent axis from the slide design/layout presets', () => {
    const layoutPresetIds = STYLE_PRESETS.map((preset) => preset.id)
    expect(IMAGE_STYLE_IDS.filter((id) => layoutPresetIds.includes(id))).toEqual([])
    expect(IMAGE_STYLE_IDS.filter((id) => LAYOUT_IDS.includes(id))).toEqual([])
    // Resolving image styles must not disturb the design preset registry.
    const before = JSON.stringify(STYLE_PRESETS)
    IMAGE_STYLE_IDS.forEach((id) => resolveImageStyle(id))
    expect(JSON.stringify(STYLE_PRESETS)).toBe(before)
    expect(getPreset('zine').id).toBe('zine')
  })
})
