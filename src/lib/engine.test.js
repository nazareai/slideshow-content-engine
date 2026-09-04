import { describe, expect, it } from 'vitest'
import { ensureZipFilename, makeSlides, runQualityGate, scoreIdea, slideToSvg, toMarkdown } from './engine'

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
