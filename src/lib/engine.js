import { planDirections } from './artDirection'
import { overlaySettingsKey } from './overlayComposite'

const weakWords = ['ultimate', 'revolutionary', 'game-changing', 'unlock', 'secret hack']
const palettes = [
  ['#171717', '#F7F5F0', '#D9EDC2'],
  ['#2457FF', '#FFFFFF', '#FFDC64'],
  ['#FF654A', '#171717', '#F7F5F0'],
  ['#D9EDC2', '#171717', '#2457FF'],
]

const clean = (value) => String(value ?? '').trim()
const clamp = (value, min, max, fallback) => Math.max(min, Math.min(max, Number(value) || fallback))

export function ensureZipFilename(name = 'slideshow-upload-package') {
  const base = clean(name).replace(/\.[^./\\]+$/, '') || 'slideshow-upload-package'
  return `${base}.zip`
}

export function scoreIdea(idea = {}) {
  const text = `${clean(idea.hook)} ${clean(idea.angle)} ${clean(idea.observation)}`.toLowerCase()
  const specificity = /\d|\$|%|days?|minutes?|weeks?|before|after/.test(text) ? 22 : 12
  const tension = /\b(but|instead|without|before|stop|wrong|failed|cost|waste|quietly)\b/.test(text) ? 22 : 13
  const visual = clamp(idea.visualPotential, 1, 5, 3) * 5
  const novelty = clamp(idea.novelty, 1, 5, 3) * 5
  const evidence = clean(idea.observation) && clean(idea.source) ? 10 : 0
  const penalty = weakWords.some((word) => text.includes(word)) ? 14 : 0
  return Math.max(0, Math.min(100, specificity + tension + visual + novelty + evidence - penalty))
}

export function makeSlides({ topic, audience, angle, observation, slideCount }) {
  const subject = clean(topic) || 'this experiment'
  const reader = clean(audience) || 'people doing the work'
  const premise = clean(angle) || `What most ${reader} miss about ${subject}`
  const proof = clean(observation) || `The first version produced activity, but no useful signal.`
  const count = clamp(slideCount, 4, 10, 5)
  const core = [
    { role: 'Hook', text: premise, visual: `A single concrete image representing ${subject}` },
    { role: 'Observation', text: proof, visual: `A documentary detail that directly supports the observation` },
    { role: 'Implication', text: `For ${reader}, this is a reason to question the usual approach to ${subject}.`, visual: `The familiar approach interrupted by one contradictory signal` },
    { role: 'Risk', text: `The risky response is scaling the same approach before understanding why this happened.`, visual: `One unresolved problem multiplying across the frame` },
    { role: 'Question', text: `The better question: which single assumption should be tested next?`, visual: `One highlighted question beside several crossed-out guesses` },
    { role: 'Next step', text: `Run one small test, define the success signal first, and keep the other variables stable.`, visual: `A simple test card with one variable and one metric` },
  ]
  const optional = [
    { role: 'Measurement', text: `If the signal moves, repeat it. If it stays flat, change the premise instead of adding volume.`, visual: `A two-path decision tree based on a measured signal` },
    { role: 'Example', text: `Weak: do more. Better: test one cause with a result you can actually interpret.`, visual: `A noisy pile contrasted with one precise experiment` },
    { role: 'Rule', text: `Do not turn an observation into a conclusion before the next test supplies the evidence.`, visual: `A boundary line between observation and conclusion` },
    { role: 'Takeaway', text: `A useful observation should change the next decision, not merely decorate the story.`, visual: `One field note pointing toward a clear decision` },
  ]
  const cta = { role: 'CTA', text: `Save this before your next ${subject} decision.`, visual: `A clean final frame with one save cue and generous space` }
  const middle = count <= 6 ? core.slice(0, count - 1) : [...core, ...optional.slice(0, count - 7)]
  const slides = [...middle, cta].map((slide, index) => ({ ...slide, id: index + 1 }))
  const directions = planDirections(slides)
  return slides.map((slide, index) => ({ ...slide, direction: directions[index] }))
}

// Re-exported, not reimplemented: the freshness key must be derived from the
// exact same normalization the compositor renders with. A second copy here
// silently let a slide render with one padding while being keyed as another,
// so a composite change could leave an approved, stale frame in the export.
export { overlaySettingsKey }

// True when the stored render still matches the slide copy, visual direction,
// planned composition, active style preset, per-slide overlay composite, and
// (when supplied) the selected image-style directive — otherwise export is stale.
export function isRenderCurrent(slide, rendered, presetId, styleDirective) {
  if (!rendered?.composedBlob) return false
  return rendered.renderedText === slide.text && rendered.renderedVisual === slide.visual &&
    rendered.renderedPreset === presetId &&
    (rendered.renderedOverlayKey === overlaySettingsKey(slide.overlay) || (rendered.renderedOverlayKey === undefined && overlaySettingsKey(slide.overlay) === overlaySettingsKey({}))) &&
    (!slide.direction?.layout || rendered.renderedLayout === slide.direction.layout) &&
    (styleDirective === undefined || rendered.renderedStyleDirective === styleDirective)
}

// Single source of truth for export readiness. The Export button's disabled
// state and its click handler must both consume this computation, so the UI
// can never show an enabled button whose click is then refused — or a dead
// button with no visible reason. Every blocker names the slides it covers and
// distinguishes quality-gate failures, missing renders, stale renders, and
// missing approvals.
export function computeExportReadiness({ slides = [], gate, images = {}, reviewed = {}, presetId, styleDirective } = {}) {
  const missingSlides = []
  const staleSlides = []
  const unapprovedSlides = []
  for (const slide of slides) {
    const rendered = images[slide.id]
    if (!isRenderCurrent(slide, rendered, presetId, styleDirective)) {
      if (rendered?.composedBlob || rendered?.dataUrl) staleSlides.push(slide.id)
      else missingSlides.push(slide.id)
    } else if (!reviewed[slide.id]) {
      unapprovedSlides.push(slide.id)
    }
  }
  const gateFailures = gate && gate.passed !== true ? [...(gate.failures?.length ? gate.failures : ['The quality gate did not pass.'])] : []
  const label = (ids) => `Slide${ids.length === 1 ? '' : 's'} ${ids.join(', ')}`
  const blockers = [
    ...gateFailures.map((failure) => `Quality gate: ${failure} — see the Quality gate tab.`),
    ...(missingSlides.length ? [`${label(missingSlides)}: no finished frame yet — generate finished slides (image + text) first.`] : []),
    ...(staleSlides.length ? [`${label(staleSlides)}: the copy, visual direction, image style, or design preset changed after the last render — regenerate or re-render before export.`] : []),
    ...(unapprovedSlides.length ? [`${label(unapprovedSlides)}: check “Reviewed and approved” under the finished frame.`] : []),
  ]
  if (!slides.length) blockers.push('There are no slides to export yet.')
  return { ready: blockers.length === 0, blockers, gateFailures, missingSlides, staleSlides, unapprovedSlides }
}

// The composed sequence must read as an art-directed set: at least
// min(5, n) distinct compositions and never the same layout twice in a row.
export function sequenceIsDiverse(slides = []) {
  if (!slides.length) return false
  const layouts = slides.every((slide) => clean(slide?.direction?.layout))
    ? slides.map((slide) => slide.direction.layout)
    : planDirections(slides).map((direction) => direction.layout)
  const distinct = new Set(layouts).size
  const noAdjacentRepeat = layouts.every((layout, index) => index === 0 || layout !== layouts[index - 1])
  return distinct >= Math.min(5, layouts.length) && noAdjacentRepeat
}

export function runQualityGate(project = {}) {
  const slides = Array.isArray(project.slides) ? project.slides : []
  const checks = [
    { label: '4 to 10 slides', passed: slides.length >= 4 && slides.length <= 10 },
    { label: 'Every slide has copy', passed: slides.length > 0 && slides.every((s) => clean(s?.text)) },
    { label: 'Every slide has visual direction', passed: slides.length > 0 && slides.every((s) => clean(s?.visual)) },
    { label: 'Copy is 4 to 16 readable words', passed: slides.length > 0 && slides.every((s) => { const words = clean(s?.text).split(/\s+/).filter(Boolean); return words.length >= 4 && words.length <= 16 && clean(s?.text).length <= 110 && words.every((word) => word.length <= 24) }) },
    { label: 'No generic marketing language', passed: !weakWords.some((word) => slides.some((s) => clean(s?.text).toLowerCase().includes(word))) },
    { label: 'Slide compositions are diverse (no repeated layout in a row, 5+ archetypes)', passed: sequenceIsDiverse(slides) },
    { label: 'Caption is present', passed: Boolean(clean(project.caption)) },
    { label: 'Research observation is present', passed: Boolean(clean(project.observation)) },
    { label: 'Research source is present', passed: Boolean(clean(project.source)) },
    { label: 'Draft matches current brief', passed: project.stale !== true },
  ]
  const failures = checks.filter((check) => !check.passed).map((check) => check.label)
  return { passed: failures.length === 0, failures, checks }
}

export function toMarkdown(project) {
  const gate = runQualityGate(project)
  const imageStyle = project.imageStyle
  const imageStyleSection = imageStyle?.name
    ? `\n\n## Image style\n\n**${clean(imageStyle.name)}**${imageStyle.custom ? ` — custom direction: ${clean(imageStyle.custom)}` : ''}\n\n${clean(imageStyle.directive)}`
    : ''
  return `# ${clean(project.title) || 'Slideshow'}\n\n**Audience:** ${clean(project.audience)}\n**Status:** ${gate.passed ? 'Ready for manual review' : 'Needs revision'}\n\n## Research basis\n\n${clean(project.observation) || 'No research note supplied.'}\n\nSource: ${clean(project.source) || 'Not supplied'}${imageStyleSection}\n\n## Slides\n\n${(project.slides || []).map((slide) => `### ${slide.id}. ${slide.role}\n\n${slide.text}\n\n_Visual direction: ${slide.visual}_${slide.direction?.layout ? `\n\n_Composition: ${slide.direction.layout}${slide.direction.mirror ? ' (mirrored)' : ''} · emphasis: ${slide.direction.emphasis || '—'}_` : ''}`).join('\n\n')}\n\n## Caption\n\n${clean(project.caption)}\n\n## Quality gate\n\n${gate.checks.map((check) => `- [${check.passed ? 'x' : ' '}] ${check.label}`).join('\n')}\n\n## Publishing note\n\nThe package contains real generated image assets when every frame has been rendered. Verify claims and visual accuracy, add native text or audio if wanted, and publish manually.\n`
}

function escapeXml(value) {
  return clean(value).replace(/[<>&'\"]/g, (char) => ({ '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;' }[char]))
}

function wrapWords(text, limit = 19) {
  const words = clean(text).split(/\s+/); const lines = []; let line = ''
  words.forEach((word) => { const next = `${line} ${word}`.trim(); if (next.length > limit && line) { lines.push(line); line = word } else line = next })
  if (line) lines.push(line)
  return lines.slice(0, 9)
}

export function slideToSvg(slide, total) {
  const [bg, fg, accent] = palettes[(slide.id - 1) % palettes.length]
  const lines = wrapWords(slide.text)
  const tspans = lines.map((line, index) => `<tspan x="92" dy="${index === 0 ? 0 : 112}">${escapeXml(line)}</tspan>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920"><rect width="1080" height="1920" fill="${bg}"/><rect x="72" y="72" width="936" height="14" rx="7" fill="${accent}"/><text x="92" y="180" fill="${fg}" font-family="Arial,sans-serif" font-size="32" font-weight="700">${String(slide.id).padStart(2,'0')} / ${String(total).padStart(2,'0')}  ·  ${escapeXml(slide.role).toUpperCase()}</text><text x="92" y="520" fill="${fg}" font-family="Georgia,serif" font-size="88" font-weight="700">${tspans}</text><text x="92" y="1770" fill="${fg}" opacity="0.65" font-family="Arial,sans-serif" font-size="28">EDITABLE SLIDE ASSET</text></svg>`
}
