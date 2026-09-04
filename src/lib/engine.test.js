import { describe, expect, it } from 'vitest'
import { computeExportReadiness, ensureZipFilename, isRenderCurrent, makeSlides, overlaySettingsKey, runQualityGate, scoreIdea, sequenceIsDiverse, slideToSvg, toMarkdown } from './engine'
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

  it('marks a render stale whenever its per-slide overlay layout changes', () => {
    const slide = { text: 'The observed slide copy', visual: 'One scene', direction: { layout: 'evidence-card' }, overlay: { position: 'top', offsetX: 0 } }
    const rendered = { composedBlob: {}, renderedText: slide.text, renderedVisual: slide.visual, renderedPreset: 'impact', renderedLayout: 'evidence-card', renderedOverlayKey: overlaySettingsKey({ position: 'top', offsetX: 0 }) }
    expect(isRenderCurrent(slide, rendered, 'impact')).toBe(true)
    expect(isRenderCurrent({ ...slide, overlay: { ...slide.overlay, position: 'bottom' } }, rendered, 'impact')).toBe(false)
    expect(isRenderCurrent({ ...slide, overlay: { ...slide.overlay, backgroundEnabled: true } }, rendered, 'impact')).toBe(false)
  })

  it('marks renders stale when the image-style directive changes, without breaking the legacy check', () => {
    const slide = { text: 'The observed slide copy', visual: 'One scene', direction: { layout: 'evidence-card' } }
    const cinematic = resolveImageStyle('cinematic')
    const rendered = { composedBlob: {}, renderedText: 'The observed slide copy', renderedVisual: 'One scene', renderedPreset: 'impact', renderedLayout: 'evidence-card', renderedStyleDirective: cinematic.directive }
    expect(isRenderCurrent(slide, rendered, 'impact', cinematic.directive)).toBe(true)
    expect(isRenderCurrent(slide, rendered, 'impact', resolveImageStyle('y2k-web-chaos').directive)).toBe(false)
    expect(isRenderCurrent(slide, rendered, 'impact', resolveImageStyle({ styleId: 'custom', customText: 'edited direction' }).directive)).toBe(false)
    expect(isRenderCurrent(slide, rendered, 'impact')).toBe(true)
  })

  it('persists the selected image style through the exported manifest', () => {
    const project = validProject()
    project.imageStyle = resolveImageStyle('surreal-brainrot')
    const markdown = toMarkdown(project)
    expect(markdown).toContain('## Image style')
    expect(markdown).toContain('Surreal Brainrot')
    expect(markdown).toContain('hybrid')
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

describe('export readiness', () => {
  const style = resolveImageStyle('cinematic')
  const readyState = () => {
    const project = validProject()
    const currentRender = (slide) => ({
      dataUrl: 'data:image/png;base64,QUFB', prompt: `prompt for slide ${slide.id}`, composedBlob: {},
      renderedText: slide.text, renderedVisual: slide.visual, renderedPreset: 'impact',
      renderedLayout: slide.direction.layout, renderedStyleDirective: style.directive,
    })
    return {
      slides: project.slides,
      gate: runQualityGate(project),
      images: Object.fromEntries(project.slides.map((slide) => [slide.id, currentRender(slide)])),
      reviewed: Object.fromEntries(project.slides.map((slide) => [slide.id, true])),
      presetId: 'impact',
      styleDirective: style.directive,
    }
  }

  it('is ready exactly when the gate passes and every slide is rendered, current, and approved', () => {
    const readiness = computeExportReadiness(readyState())
    expect(readiness).toEqual({ ready: true, blockers: [], gateFailures: [], missingSlides: [], staleSlides: [], unapprovedSlides: [] })
  })

  it('surfaces each quality-gate failure as its own named blocker', () => {
    const state = readyState()
    state.slides[1].text = 'Only three words'
    state.images[state.slides[1].id].renderedText = 'Only three words'
    state.gate = runQualityGate({ ...validProject(), slides: state.slides })
    const readiness = computeExportReadiness(state)
    expect(readiness.ready).toBe(false)
    expect(readiness.gateFailures).toEqual(['Copy is 4 to 16 readable words'])
    expect(readiness.blockers.some((blocker) => blocker.includes('Quality gate: Copy is 4 to 16 readable words'))).toBe(true)
  })

  it('reports slides with no stored frame as missing, not stale', () => {
    const state = readyState()
    delete state.images[2]
    const readiness = computeExportReadiness(state)
    expect(readiness.missingSlides).toEqual([2])
    expect(readiness.staleSlides).toEqual([])
    expect(readiness.blockers.some((blocker) => blocker.includes('Slide 2: no finished frame yet'))).toBe(true)
  })

  it('reports edited or restyled renders as stale, including a raw frame whose overlay was invalidated', () => {
    const state = readyState()
    state.images[3].renderedText = 'Different copy than the slide now holds'
    delete state.images[4].composedBlob // text edit keeps the raw image but strips the overlay
    const readiness = computeExportReadiness(state)
    expect(readiness.staleSlides).toEqual([3, 4])
    expect(readiness.missingSlides).toEqual([])
    expect(readiness.blockers.some((blocker) => blocker.includes('Slides 3, 4') && blocker.includes('changed after the last render'))).toBe(true)
  })

  it('reports current-but-unreviewed slides as awaiting approval', () => {
    const state = readyState()
    state.reviewed[5] = false
    delete state.reviewed[6]
    const readiness = computeExportReadiness(state)
    expect(readiness.unapprovedSlides).toEqual([5, 6])
    expect(readiness.blockers.some((blocker) => blocker.includes('Slides 5, 6') && blocker.includes('Reviewed and approved'))).toBe(true)
  })

  it('keeps the three render categories disjoint and stacks them with gate failures', () => {
    const state = readyState()
    state.gate = { passed: false, failures: ['Caption is present'] }
    delete state.images[1]
    state.images[2].renderedPreset = 'zine'
    state.reviewed[3] = false
    const readiness = computeExportReadiness(state)
    expect(readiness.ready).toBe(false)
    expect(readiness.missingSlides).toEqual([1])
    expect(readiness.staleSlides).toEqual([2])
    expect(readiness.unapprovedSlides).toEqual([3])
    expect(readiness.blockers).toHaveLength(4)
  })

  it('never reports ready for an empty slide set', () => {
    const readiness = computeExportReadiness({ slides: [], gate: { passed: true, failures: [] }, images: {}, reviewed: {} })
    expect(readiness.ready).toBe(false)
    expect(readiness.blockers).toEqual(['There are no slides to export yet.'])
  })
})
