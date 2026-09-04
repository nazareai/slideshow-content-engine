// Visual-proof harness: runs the real story engine + art-directed compositor
// over deterministic placeholder photography so the redesign can be inspected
// without spending image credits. Not part of the studio UI.
import { STYLE_PRESETS } from './lib/artDirection'
import { composeContactSheet, composeSlide, loadImage } from './lib/compositor'
import { makeSlides } from './lib/engine'

const SLIDE_COUNT = 7
const brief = {
  topic: 'building an autonomous content engine',
  audience: 'solo founders',
  angle: 'I automated distribution before the content deserved it',
  observation: 'The publishing pipe worked, but the generic drafts were not worth publishing.',
  slideCount: SLIDE_COUNT,
}

function seededRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// A photographic stand-in: layered light, depth shapes, a clear subject at the
// slide's focal point, and grain — enough to judge composition honestly.
function placeholderScene(index, focalPoint) {
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1920
  const context = canvas.getContext('2d')
  const random = seededRandom(0x9e3779b9 ^ (index * 2654435761))
  const hue = [210, 28, 152, 8, 262, 94, 330][index % 7]

  const sky = context.createLinearGradient(0, 0, 0, 1920)
  sky.addColorStop(0, `hsl(${hue}, 32%, 68%)`)
  sky.addColorStop(0.55, `hsl(${(hue + 24) % 360}, 30%, 46%)`)
  sky.addColorStop(1, `hsl(${(hue + 40) % 360}, 34%, 22%)`)
  context.fillStyle = sky
  context.fillRect(0, 0, 1080, 1920)

  for (let blob = 0; blob < 7; blob += 1) {
    const x = random() * 1080
    const y = random() * 1920
    const radius = 140 + random() * 380
    const soft = context.createRadialGradient(x, y, 0, x, y, radius)
    soft.addColorStop(0, `hsla(${(hue + blob * 30) % 360}, 42%, ${30 + random() * 40}%, 0.5)`)
    soft.addColorStop(1, 'hsla(0, 0%, 0%, 0)')
    context.fillStyle = soft
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  }

  const fx = focalPoint.x * 1080
  const fy = focalPoint.y * 1920
  const glowRadius = 300
  const glow = context.createRadialGradient(fx, fy, 20, fx, fy, glowRadius)
  glow.addColorStop(0, `hsla(${(hue + 180) % 360}, 65%, 82%, 0.95)`)
  glow.addColorStop(0.45, `hsla(${(hue + 180) % 360}, 55%, 60%, 0.5)`)
  glow.addColorStop(1, 'hsla(0, 0%, 0%, 0)')
  context.fillStyle = glow
  context.fillRect(fx - glowRadius, fy - glowRadius, glowRadius * 2, glowRadius * 2)
  context.fillStyle = `hsla(${(hue + 180) % 360}, 40%, 20%, 0.85)`
  context.beginPath()
  context.arc(fx, fy, 84, 0, Math.PI * 2)
  context.fill()

  const vignette = context.createRadialGradient(540, 960, 500, 540, 960, 1300)
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(0,0,0,0.42)')
  context.fillStyle = vignette
  context.fillRect(0, 0, 1080, 1920)

  for (let speck = 0; speck < 1400; speck += 1) {
    context.fillStyle = random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'
    context.fillRect(random() * 1080, random() * 1920, 1.4, 1.4)
  }

  context.font = '600 22px Menlo, monospace'
  context.fillStyle = 'rgba(255,255,255,0.4)'
  context.fillText(`PLACEHOLDER BASE ${String(index + 1).padStart(2, '0')}`, 24, 1892)
  return canvas
}

async function run() {
  const params = new URLSearchParams(window.location.search)
  const root = document.getElementById('root')
  const status = document.getElementById('status')
  const slides = makeSlides(brief)
  const baseScenes = slides.map((slide, index) => placeholderScene(index, slide.direction.focalPoint))

  async function composedUrlFor(slide, index, presetId) {
    const blob = await composeSlide({ image: baseScenes[index], slide, direction: slide.direction, preset: presetId, index, total: slides.length })
    return URL.createObjectURL(blob)
  }

  if (params.get('full')) {
    const index = Math.min(slides.length - 1, Math.max(0, Number(params.get('slide') || 0)))
    const presetId = params.get('preset') || 'impact'
    document.body.style.background = '#000'
    document.querySelector('main').innerHTML = '<div id="root"></div>'
    const url = await composedUrlFor(slides[index], index, presetId)
    const img = new Image()
    img.src = url
    img.style.cssText = 'display:block;width:1080px;height:1920px'
    document.getElementById('root').appendChild(img)
    await img.decode()
    document.title = 'contact-sheet-ready'
    return
  }

  for (const preset of STYLE_PRESETS) {
    status.textContent = `Rendering ${preset.name}…`
    const items = []
    for (const [index, slide] of slides.entries()) {
      const url = await composedUrlFor(slide, index, preset.id)
      items.push({ image: await loadImage(url), label: `${String(index + 1).padStart(2, '0')} · ${slide.role} · ${slide.direction.layout}${slide.direction.mirror ? ' ⇋' : ''}` })
    }
    const sheetBlob = await composeContactSheet({ items, title: `${preset.name} — ${brief.angle}` })
    const section = document.createElement('section')
    const img = new Image()
    img.className = 'sheet'
    img.src = URL.createObjectURL(sheetBlob)
    section.appendChild(img)
    root.appendChild(section)
    await img.decode()
  }

  const detailHeading = document.createElement('h1')
  detailHeading.textContent = 'Detail frames — Bold Impact preset, full arc'
  root.appendChild(detailHeading)
  const detail = document.createElement('div')
  detail.className = 'detail'
  root.appendChild(detail)
  for (const [index, slide] of slides.entries()) {
    const url = await composedUrlFor(slide, index, 'impact')
    const img = new Image()
    img.src = url
    detail.appendChild(img)
    await img.decode()
  }

  status.textContent = `Done: ${STYLE_PRESETS.length} presets × ${slides.length} frames rendered through the production compositor.`
  document.title = 'contact-sheet-ready'
}

run().catch((error) => {
  document.getElementById('status').textContent = `Render failed: ${error.message}`
  document.title = 'contact-sheet-failed'
})
