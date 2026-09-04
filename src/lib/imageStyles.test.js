import { describe, expect, it } from 'vitest'
import { LAYOUT_IDS, STYLE_PRESETS, getPreset } from './artDirection'
import {
  CUSTOM_STYLE_PLACEHOLDER, DEFAULT_IMAGE_STYLE_ID, IMAGE_STYLE_FIELDS, IMAGE_STYLE_GROUPS,
  IMAGE_MEDIA, IMAGE_TREATMENTS, IMAGE_STYLE_IDS, IMAGE_STYLES, getImageStyle, resolveImageStyle, storySceneBrief, styleDirective, stylesInGroup,
} from './imageStyles'

const fixedStyles = IMAGE_STYLES.filter((style) => !style.editable)
const byId = (id) => IMAGE_STYLES.find((style) => style.id === id)

describe('TikTok-native image style taxonomy', () => {
  it('offers every required TikTok-native style plus capture styles and Custom', () => {
    expect(IMAGE_STYLES.map((style) => style.name)).toEqual([
      'Creator Candid', 'Direct Flash', 'Cinematic',
      'Flat 2D Cartoon', 'Hand-Drawn Doodle', 'Comic Ink & Halftone', 'Cut-Paper Collage', 'Clay & Toy 3D', 'Retro Pixel Art',
      'Surreal Brainrot', 'Deep-Fried Meme', 'Cursed Collage', 'Y2K Web Chaos',
      'Custom',
    ])
    expect(IMAGE_STYLES.some((style) => /professional/i.test(style.name))).toBe(false)
    expect(IMAGE_STYLES.filter((style) => style.editable)).toHaveLength(1)
  })

  it('offers a researched breadth of independently composable media and treatments', () => {
    expect(IMAGE_MEDIA.length).toBeGreaterThanOrEqual(17)
    expect(IMAGE_TREATMENTS.length).toBeGreaterThanOrEqual(16)
    expect(IMAGE_MEDIA.map((item) => item.name)).toEqual(expect.arrayContaining(['Anime Cel', 'Watercolor Storybook', 'Boxed Action Figure', 'PS2-Era Game Render']))
    expect(IMAGE_TREATMENTS.map((item) => item.name)).toEqual(expect.arrayContaining(['Italian Brainrot Lore', 'Analog VHS', 'Dreamcore', 'Maximalist Scrapbook']))
  })

  it('composes Flat 2D Cartoon with Surreal Brainrot while keeping the medium authoritative', () => {
    const style = resolveImageStyle({ mediumId: 'flat-2d', treatmentId: 'brainrot' })
    expect(style.name).toBe('Flat 2D Cartoon + Surreal Brainrot')
    expect(style.directive).toContain('completely flat 2D')
    expect(style.directive).toContain('absurd hybrid mascot')
    expect(style.directive).toContain('no 3D')
    expect(style.directive).toContain('no photorealism')
    expect(storySceneBrief({ mediumId: 'flat-2d', treatmentId: 'brainrot' })).toContain('Never use camera, lens, photorealistic, CGI')
  })

  it('organizes styles into the researched groups: Capture, Illustration/Transformation, Meme-native', () => {
    expect(IMAGE_STYLE_GROUPS.map((group) => group.id)).toEqual(['capture', 'illustrated', 'meme', 'custom'])
    const groupIds = IMAGE_STYLE_GROUPS.map((group) => group.id)
    for (const style of IMAGE_STYLES) expect(groupIds, style.id).toContain(style.group)

    expect(stylesInGroup('capture').map((style) => style.id)).toEqual(['creator-candid', 'direct-flash', 'cinematic'])
    expect(stylesInGroup('illustrated').map((style) => style.id)).toEqual(['cartoon-pop', 'hand-doodle', 'comic-ink', 'paper-collage', 'clay-toy-3d', 'retro-pixel'])
    expect(stylesInGroup('meme').map((style) => style.id)).toEqual(['surreal-brainrot', 'deep-fried', 'cursed-collage', 'y2k-web-chaos'])
    expect(stylesInGroup('custom').map((style) => style.id)).toEqual(['custom'])
    // Meme-native + illustrated must outweigh capture: the selector cannot be photography-heavy again.
    expect(stylesInGroup('illustrated').length + stylesInGroup('meme').length).toBeGreaterThan(stylesInGroup('capture').length)
  })

  it('gives every fixed style a complete directive across medium, subject, scene, composition, texture, palette, and negatives', () => {
    expect(IMAGE_STYLE_FIELDS).toEqual(['medium', 'subject', 'scene', 'composition', 'texture', 'palette', 'negative'])
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
      expect(directive).toContain('Medium:')
      expect(directive).toContain('Subject treatment:')
      expect(directive).toContain('Scene:')
      expect(directive).toContain('Composition:')
      expect(directive).toContain('Texture:')
      expect(directive).toContain('Palette:')
      expect(directive).toContain('Avoid:')
    })
  })

  it('keeps a text-safe overlay zone in every fixed style composition', () => {
    for (const style of fixedStyles) {
      expect(style.directive.composition, style.id).toMatch(/overlay/i)
    }
  })

  it('encodes Surreal Brainrot as hybrid absurdity with pseudo-lore, wrong scale, and internet rot — not generic neon surrealism', () => {
    const brainrot = byId('surreal-brainrot').directive
    expect(brainrot.subject).toMatch(/hybrid|fused/i)
    expect(brainrot.subject).toMatch(/saga|legend|lore/i)
    expect(brainrot.scene).toMatch(/lore|backstory|mythic|shrine/i)
    expect(brainrot.composition).toMatch(/towering|tiny|scale/i)
    expect(brainrot.texture).toMatch(/jpeg|recompress|screenshot/i)
    expect(brainrot.negative).toMatch(/dreamlike|neon/i)
    expect(styleDirective(byId('surreal-brainrot'))).toMatch(/played completely straight/i)
  })

  it('makes Flat 2D Cartoon unmistakably flat cel animation and hostile to photorealism', () => {
    const cartoon = byId('cartoon-pop').directive
    expect(cartoon.medium).toMatch(/2D/)
    expect(cartoon.medium).toMatch(/cel-animation|cartoon/i)
    expect(cartoon.medium).toMatch(/never a photograph/i)
    expect(cartoon.medium).toMatch(/never a 3D render/i)
    expect(cartoon.subject).toMatch(/outline/i)
    expect(cartoon.negative).toMatch(/no photographic elements/i)
    expect(cartoon.negative).toMatch(/no 3D/i)
  })

  // The direct user correction this taxonomy answers: "cartoonish" outputs all
  // converged on one glossy 3D look. Seven cartoon families must be genuinely
  // different rendering media, and every flat medium must ban the vocabulary
  // that drags image models back to 3D/CGI/photo territory.
  describe('cartoon families are distinct rendering media', () => {
    const FAMILY_MEDIUM_TOKENS = {
      'cartoon-pop': /flat 2D cel-animation/i,
      'hand-doodle': /hand-drawn doodle.*marker and ballpoint/i,
      'comic-ink': /comic-book panel.*ink and halftone/i,
      'paper-collage': /cut-paper and sticker collage/i,
      'retro-pixel': /low-resolution pixel art/i,
      'clay-toy-3d': /stop-motion-style 3D.*clay/i,
      'surreal-brainrot': /3D-render-style/i,
    }
    const FLAT_FAMILY_IDS = ['cartoon-pop', 'hand-doodle', 'comic-ink', 'paper-collage', 'retro-pixel']
    const BANNED_IN_FLAT_MEDIA = [/\b3D\b/, /CGI/i, /clay/i, /plastic/i, /photoreal/i, /camera/i, /lens/i]

    it('covers all seven required families with pairwise-distinct medium definitions', () => {
      const mediums = Object.keys(FAMILY_MEDIUM_TOKENS).map((id) => byId(id).directive.medium)
      expect(new Set(mediums).size).toBe(7)
      for (const [id, token] of Object.entries(FAMILY_MEDIUM_TOKENS)) {
        expect(byId(id).directive.medium, id).toMatch(token)
      }
    })

    it('gives every flat 2D family explicit bans on 3D, CGI, clay, plastic, photorealism, camera, and lens language', () => {
      for (const id of FLAT_FAMILY_IDS) {
        const negative = byId(id).directive.negative
        for (const banned of BANNED_IN_FLAT_MEDIA) {
          expect(negative, `${id} must forbid ${banned}`).toMatch(banned)
        }
      }
    })

    it('names the medium in every selector name or tagline so users understand it before generating', () => {
      expect(byId('cartoon-pop').name).toMatch(/flat 2d/i)
      expect(byId('hand-doodle').name).toMatch(/hand-drawn|doodle/i)
      expect(byId('comic-ink').name).toMatch(/comic/i)
      expect(byId('paper-collage').name).toMatch(/paper/i)
      expect(byId('retro-pixel').name).toMatch(/pixel/i)
      expect(byId('clay-toy-3d').name).toMatch(/clay.*3d/i)
      for (const id of FLAT_FAMILY_IDS) {
        expect(byId(id).tagline, id).toMatch(/never 3D/i)
      }
      expect(byId('clay-toy-3d').tagline).toMatch(/deliberately 3D/i)
    })

    it('keeps only the clay preset three-dimensional among the illustrated group', () => {
      for (const style of stylesInGroup('illustrated')) {
        if (style.id === 'clay-toy-3d') continue
        expect(style.directive.negative, style.id).toMatch(/no 3D/i)
      }
    })
  })

  it('gives each remaining meme and transformation style its defining mechanics', () => {
    expect(byId('clay-toy-3d').directive.medium).toMatch(/clay/i)
    expect(byId('clay-toy-3d').directive.subject).toMatch(/fingerprint/i)
    expect(byId('retro-pixel').directive.medium).toMatch(/pixel/i)
    expect(byId('retro-pixel').directive.texture).toMatch(/dither/i)
    expect(byId('deep-fried').directive.texture).toMatch(/jpeg|macroblock/i)
    expect(byId('deep-fried').directive.palette).toMatch(/nuked|clipped/i)
    expect(byId('cursed-collage').directive.medium).toMatch(/collage/i)
    expect(byId('cursed-collage').directive.texture).toMatch(/cut-line|seam|halo/i)
    expect(byId('y2k-web-chaos').directive.medium).toMatch(/chrome|web-graphics/i)
    expect(byId('y2k-web-chaos').directive.scene).toMatch(/checkerboard|gradient/i)
  })

  it('never imitates living artists or protected studio and franchise names', () => {
    const banned = /pixar|disney|ghibli|aardman|dreamworks|laika|nintendo|pok[eé]mon|minecraft|roblox|skibidi|shrek|beeple|murakami|kaws|banksy|lego/i
    expect(JSON.stringify(IMAGE_STYLES)).not.toMatch(banned)
    expect(JSON.stringify(IMAGE_STYLE_GROUPS)).not.toMatch(banned)
  })

  it('routes the editable Custom text verbatim into the directive', () => {
    const custom = resolveImageStyle({ styleId: 'custom', customText: '  Everything knitted from wool yarn, macro fibers visible, one knitted mascot centered  ' })
    expect(custom.id).toBe('custom')
    expect(custom.custom).toBe('Everything knitted from wool yarn, macro fibers visible, one knitted mascot centered')
    expect(custom.directive).toContain('Everything knitted from wool yarn, macro fibers visible, one knitted mascot centered')
  })

  it('still produces a workable, medium-agnostic directive when Custom is left blank', () => {
    const blank = resolveImageStyle({ styleId: 'custom', customText: '   ' })
    expect(blank.directive.length).toBeGreaterThan(40)
    expect(blank.directive).not.toMatch(/professional/i)
    expect(blank.directive).not.toMatch(/photorealistic/i)
    expect(blank.directive).toMatch(/text-safe/i)
    expect(CUSTOM_STYLE_PLACEHOLDER.length).toBeGreaterThan(20)
  })

  it('falls back to the default style for unknown selections and stays idempotent', () => {
    expect(getImageStyle('does-not-exist').id).toBe(DEFAULT_IMAGE_STYLE_ID)
    expect(resolveImageStyle().id).toBe(DEFAULT_IMAGE_STYLE_ID)
    expect(resolveImageStyle('surreal-brainrot').id).toBe('surreal-brainrot')
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
