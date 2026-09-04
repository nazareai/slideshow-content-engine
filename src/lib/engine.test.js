import { describe, expect, it } from 'vitest'
import { ensureZipFilename, isRenderCurrent, makeSlides, runQualityGate, scoreIdea, sequenceIsDiverse, slideToSvg, toMarkdown } from './engine'
import { resolveImageStyle } from './imageStyles'

const input = { topic: 'SEO', audience: 'founders', angle: 'Why qualified search traffic suddenly stalls', observation: 'Three pages ranked, but none converted.', slideCount: 7 }
const validProject = () => ({ title: input.angle, audience: input.audience, observation: input.observation, source: 'https://example.com', slides: makeSlides(input), caption: 'A practical test worth saving.', stale: false })

describe('content engine', () => {
  it('forces the exported package extension to .zip', () => {
    expect(ensureZipFilename('slideshow-upload-package')).toBe('slideshow-upload-package.zip')
    expect(ensureZipFilename('slideshow-upload-package.zfo')).toBe('slideshow-upload-package.zip')
    expect(ensureZipFilename('slideshow-upload-package.zip')).toBe('slideshow-upload-package.zip')
  })

  it.each([4, 5, 6, 7, 8, 9, 10])('generates a complete %i-slide arc ending in a CTA', (count) => {
    const slides = makeSlides({ ...input, slideCount: count })
    expect(slides).toHaveLength(count)
    expect(slides.at(-1).role).toBe('CTA')
  })

  it.each([4, 5, 6, 7, 8, 9, 10])('art-directs every slide of a %i-slide arc with a diverse layout rhythm', (count) => {
    const slides = makeSlides({ ...input, slideCount: count })
    expect(slides.every((slide) => slide.direction?.layout && slide.direction.focalPoint && slide.direction.emphasis)).toBe(true)
    const layouts = slides.map((slide) => slide.direction.layout)
    layouts.forEach((layout, index) => { if (index > 0) expect(layout).not.toBe(layouts[index - 1]) })
    expect(new Set(layouts).size).toBeGreaterThanOrEqual(Math.min(5, count))
    expect(slides.at(-1).direction.layout).toBe('cta-stamp')
    expect(slides[0].direction.layout).toBe('impact-stack')
  })

  it('fails the quality gate when compositions repeat instead of alternating', () => {
    const project = validProject()
    project.slides = project.slides.map((slide) => ({ ...slide, direction: { ...slide.direction, layout: 'evidence-card' } }))
    expect(sequenceIsDiverse(project.slides)).toBe(false)
    const gate = runQualityGate(project)
    expect(gate.passed).toBe(false)
    expect(gate.failures.some((failure) => failure.includes('diverse'))).toBe(true)
  })

  it('treats a render as current only when copy, visual, layout, and preset all match', () => {
    const slide = { text: 'The observed slide copy', visual: 'One scene', direction: { layout: 'evidence-card' } }
    const rendered = { composedBlob: {}, renderedText: 'The observed slide copy', renderedVisual: 'One scene', renderedPreset: 'impact', renderedLayout: 'evidence-card' }
    expect(isRenderCurrent(slide, rendered, 'impact')).toBe(true)
    expect(isRenderCurrent(slide, rendered, 'zine')).toBe(false)
    expect(isRenderCurrent(slide, { ...rendered, renderedText: 'Edited copy' }, 'impact')).toBe(false)
    expect(isRenderCurrent(slide, { ...rendered, renderedVisual: 'Other scene' }, 'impact')).toBe(false)
    expect(isRenderCurrent(slide, { ...rendered, renderedLayout: 'impact-stack' }, 'impact')).toBe(false)
    expect(isRenderCurrent(slide, { ...rendered, composedBlob: null }, 'impact')).toBe(false)
    expect(isRenderCurrent(slide, undefined, 'impact')).toBe(false)
  })

  it('marks renders stale when the image-style directive changes, without breaking the legacy check', () => {
    const slide = { text: 'The observed slide copy', visual: 'One scene', direction: { layout: 'evidence-card' } }
    const cinematic = resolveImageStyle('cinematic')
    const rendered = { composedBlob: {}, renderedText: 'The observed slide copy', renderedVisual: 'One scene', renderedPreset: 'impact', renderedLayout: 'evidence-card', renderedStyleDirective: cinematic.directive }
    expect(isRenderCurrent(slide, rendered, 'impact', cinematic.directive)).toBe(true)
    expect(isRenderCurrent(slide, rendered, 'impact', resolveImageStyle('y2k-internet').directive)).toBe(false)
    expect(isRenderCurrent(slide, rendered, 'impact', resolveImageStyle({ styleId: 'custom', customText: 'edited direction' }).directive)).toBe(false)
    expect(isRenderCurrent(slide, rendered, 'impact')).toBe(true)
  })

  it('persists the selected image style through the exported manifest', () => {
    const project = validProject()
    project.imageStyle = resolveImageStyle('y2k-internet')
    const markdown = toMarkdown(project)
    expect(markdown).toContain('## Image style')
    expect(markdown).toContain('Y2K Internet')
    expect(markdown).toContain('digicam')
    project.imageStyle = resolveImageStyle({ styleId: 'custom', customText: 'infrared film in a greenhouse' })
    const customMarkdown = toMarkdown(project)
    expect(customMarkdown).toContain('custom direction: infrared film in a greenhouse')
    expect(customMarkdown).toContain('infrared film in a greenhouse')
  })

  it('records the composition and emphasis in the exported manifest', () => {
    const markdown = toMarkdown(validProject())
    expect(markdown).toContain('_Composition: impact-stack')
    expect(markdown).toContain('emphasis:')
  })
  it('rewards specificity, tension, and sourced observations', () => {
    expect(scoreIdea({ hook: 'I wasted 14 days before fixing this', observation: 'Bounce rate rose 20%', source: 'https://example.com', visualPotential: 5, novelty: 5 })).toBeGreaterThan(90)
    expect(scoreIdea({ hook: 'A button color study', visualPotential: 3, novelty: 3 })).toBeLessThan(70)
  })
  it('exports a passing package with research provenance', () => {
    expect(runQualityGate(validProject()).passed).toBe(true)
    expect(toMarkdown(validProject())).toContain('https://example.com')
  })
  it.each([
    ['blank hook', (p) => { p.slides[0].text = '  ' }],
    ['blank later slide', (p) => { p.slides[3].text = '' }],
    ['blank visual', (p) => { p.slides[2].visual = ' ' }],
    ['long copy', (p) => { p.slides[1].text = 'x'.repeat(111) }],
    ['unrenderable long token', (p) => { p.slides[1].text = 'x'.repeat(25) }],
    ['paragraph-sized overlay', (p) => { p.slides[1].text = Array.from({ length: 20 }, () => 'tiny').join(' ') }],
    ['too terse overlay', (p) => { p.slides[1].text = 'Only three words' }],
    ['empty caption', (p) => { p.caption = '' }],
    ['missing observation', (p) => { p.observation = '' }],
    ['missing source', (p) => { p.source = '' }],
    ['stale brief', (p) => { p.stale = true }],
  ])('rejects %s', (_, mutate) => {
    const project = validProject(); mutate(project)
    expect(runQualityGate(project).passed).toBe(false)
  })
  it('produces a TikTok-sized editable SVG', () => {
    const svg = slideToSvg(validProject().slides[0], 7)
    expect(svg).toContain('width="1080" height="1920"')
    expect(svg).toContain('EDITABLE SLIDE ASSET')
  })
})
