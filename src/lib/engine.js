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
  return [...middle, cta].map((slide, index) => ({ ...slide, id: index + 1 }))
}

export function runQualityGate(project = {}) {
  const slides = Array.isArray(project.slides) ? project.slides : []
  const checks = [
    { label: '4 to 10 slides', passed: slides.length >= 4 && slides.length <= 10 },
    { label: 'Every slide has copy', passed: slides.length > 0 && slides.every((s) => clean(s?.text)) },
    { label: 'Every slide has visual direction', passed: slides.length > 0 && slides.every((s) => clean(s?.visual)) },
    { label: 'Copy is 4 to 16 readable words', passed: slides.length > 0 && slides.every((s) => { const words = clean(s?.text).split(/\s+/).filter(Boolean); return words.length >= 4 && words.length <= 16 && clean(s?.text).length <= 110 && words.every((word) => word.length <= 24) }) },
    { label: 'No generic marketing language', passed: !weakWords.some((word) => slides.some((s) => clean(s?.text).toLowerCase().includes(word))) },
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
  return `# ${clean(project.title) || 'Slideshow'}\n\n**Audience:** ${clean(project.audience)}\n**Status:** ${gate.passed ? 'Ready for manual review' : 'Needs revision'}\n\n## Research basis\n\n${clean(project.observation) || 'No research note supplied.'}\n\nSource: ${clean(project.source) || 'Not supplied'}\n\n## Slides\n\n${(project.slides || []).map((slide) => `### ${slide.id}. ${slide.role}\n\n${slide.text}\n\n_Visual direction: ${slide.visual}_`).join('\n\n')}\n\n## Caption\n\n${clean(project.caption)}\n\n## Quality gate\n\n${gate.checks.map((check) => `- [${check.passed ? 'x' : ' '}] ${check.label}`).join('\n')}\n\n## Publishing note\n\nThe package contains real generated image assets when every frame has been rendered. Verify claims and visual accuracy, add native text or audio if wanted, and publish manually.\n`
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
