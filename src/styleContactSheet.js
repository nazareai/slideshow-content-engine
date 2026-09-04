// Visual-proof harness for the image-style taxonomy: paints a deterministic
// mock base frame in each style's visual mechanics (medium, palette, texture,
// composition), then pushes it through the real production pipeline
// (makeSlides → composeSlide → composeContactSheet) so the styled result can
// be reviewed as finished 1080×1920 slides without spending image credits.
// Not part of the studio UI.
import { composeContactSheet, composeSlide, loadImage } from './lib/compositor'
import { makeSlides } from './lib/engine'
import { IMAGE_STYLES, styleDirective } from './lib/imageStyles'

// The seven cartoon families get detail frames: the whole point of the
// redesign is that their rendering media must be visibly different.
const DETAIL_STYLE_IDS = ['cartoon-pop', 'hand-doodle', 'comic-ink', 'paper-collage', 'retro-pixel', 'clay-toy-3d', 'surreal-brainrot']

const brief = {
  topic: 'building an autonomous content engine',
  audience: 'solo founders',
  angle: 'I automated distribution before the content deserved it',
  observation: 'The publishing pipe worked, but the generic drafts were not worth publishing.',
  slideCount: 7,
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

function baseCanvas() {
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1920
  return canvas
}

function jpegBlocks(context, random, strength = 0.14, size = 24) {
  for (let y = 0; y < 1920; y += size) {
    for (let x = 0; x < 1080; x += size) {
      if (random() > 0.5) continue
      const shift = Math.floor(random() * 70) - 35
      context.fillStyle = `rgba(${128 + shift}, ${100 + shift}, ${60 - shift}, ${strength * random()})`
      context.fillRect(x, y, size, size)
    }
  }
}

function sparkle(context, x, y, radius, color = 'rgba(255,255,255,0.95)') {
  context.strokeStyle = color
  context.lineWidth = Math.max(4, radius / 9)
  context.beginPath()
  context.moveTo(x - radius, y); context.lineTo(x + radius, y)
  context.moveTo(x, y - radius); context.lineTo(x, y + radius)
  context.stroke()
  context.fillStyle = color
  context.beginPath()
  context.arc(x, y, radius / 6, 0, Math.PI * 2)
  context.fill()
}

// One painter per fixed style — each encodes that style's medium, palette,
// texture, and composition mechanics so differences are visible side by side.
const painters = {
  'creator-candid': (context, random) => {
    const light = context.createLinearGradient(0, 0, 1080, 1920)
    light.addColorStop(0, '#f3e7d6'); light.addColorStop(0.6, '#dfb28c'); light.addColorStop(1, '#8a6f57')
    context.fillStyle = light; context.fillRect(0, 0, 1080, 1920)
    context.fillStyle = 'rgba(255,255,255,0.55)'; context.fillRect(660, 180, 340, 620) // blown window light
    context.fillStyle = '#6b5138'
    context.beginPath(); context.ellipse(430, 1310, 250, 420, -0.06, 0, Math.PI * 2); context.fill() // casual off-center figure
    context.fillStyle = '#8a6f57'; context.fillRect(60, 1620, 960, 190) // cluttered desk edge
    for (let speck = 0; speck < 2200; speck += 1) {
      context.fillStyle = random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)'
      context.fillRect(random() * 1080, random() * 1920, 1.6, 1.6)
    }
  },
  'direct-flash': (context, random) => {
    context.fillStyle = '#050505'; context.fillRect(0, 0, 1080, 1920)
    const flash = context.createRadialGradient(560, 1180, 60, 560, 1180, 720)
    flash.addColorStop(0, '#f2ede4'); flash.addColorStop(0.55, '#7a7468'); flash.addColorStop(1, 'rgba(5,5,5,0)')
    context.fillStyle = flash; context.fillRect(0, 0, 1080, 1920)
    context.fillStyle = '#15130f'
    context.beginPath(); context.ellipse(560, 1330, 260, 430, 0.08, 0, Math.PI * 2); context.fill() // flash-lit subject
    context.fillStyle = 'rgba(0,0,0,0.85)'
    context.beginPath(); context.ellipse(820, 1420, 230, 400, 0.3, 0, Math.PI * 2); context.fill() // razor wall shadow
    context.fillStyle = 'rgba(242,237,228,0.9)'
    context.beginPath(); context.ellipse(500, 1130, 60, 110, 0.1, 0, Math.PI * 2); context.fill() // specular highlight
    for (let speck = 0; speck < 1600; speck += 1) {
      context.fillStyle = 'rgba(255,255,255,0.05)'
      context.fillRect(random() * 1080, random() * 1920, 1.4, 1.4)
    }
  },
  cinematic: (context, random) => {
    const grade = context.createLinearGradient(0, 0, 0, 1920)
    grade.addColorStop(0, '#0b1e2d'); grade.addColorStop(0.7, '#14506b'); grade.addColorStop(1, '#071018')
    context.fillStyle = grade; context.fillRect(0, 0, 1080, 1920)
    context.save()
    context.translate(760, 0); context.rotate(0.32)
    const shaft = context.createLinearGradient(0, 0, 340, 0)
    shaft.addColorStop(0, 'rgba(232,134,46,0.5)'); shaft.addColorStop(1, 'rgba(232,134,46,0)')
    context.fillStyle = shaft; context.fillRect(0, 0, 340, 2400) // volumetric amber key
    context.restore()
    context.fillStyle = '#04090d'
    context.beginPath(); context.ellipse(320, 1360, 220, 400, -0.04, 0, Math.PI * 2); context.fill() // subject on a third
    context.fillStyle = 'rgba(232,134,46,0.8)'
    context.beginPath(); context.ellipse(430, 1180, 34, 90, 0.1, 0, Math.PI * 2); context.fill() // rim light
    for (let speck = 0; speck < 2600; speck += 1) {
      context.fillStyle = random() > 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.06)'
      context.fillRect(random() * 1080, random() * 1920, 1.5, 1.5)
    }
  },
  'cartoon-pop': (context) => {
    context.fillStyle = '#2457ff'; context.fillRect(0, 0, 1080, 1920) // flat field, no gradient
    context.fillStyle = '#ffd93b'
    for (let ray = 0; ray < 14; ray += 1) { // starburst wall
      const angle = (ray / 14) * Math.PI * 2
      context.beginPath()
      context.moveTo(540, 1250)
      context.lineTo(540 + Math.cos(angle - 0.09) * 1500, 1250 + Math.sin(angle - 0.09) * 1500)
      context.lineTo(540 + Math.cos(angle + 0.09) * 1500, 1250 + Math.sin(angle + 0.09) * 1500)
      context.fill()
    }
    context.fillStyle = '#2457ff'; context.fillRect(0, 0, 1080, 560) // flat top field held for overlay
    context.lineWidth = 18; context.strokeStyle = '#101010'
    context.fillStyle = '#ff4fa3' // rubber-limbed hero blob
    context.beginPath(); context.ellipse(540, 1330, 300, 340, 0.06, 0, Math.PI * 2); context.fill(); context.stroke()
    context.fillStyle = '#ffffff'
    context.beginPath(); context.ellipse(450, 1230, 74, 96, 0, 0, Math.PI * 2); context.fill(); context.stroke()
    context.beginPath(); context.ellipse(650, 1230, 74, 96, 0, 0, Math.PI * 2); context.fill(); context.stroke()
    context.fillStyle = '#101010'
    context.beginPath(); context.arc(470, 1250, 26, 0, Math.PI * 2); context.fill()
    context.beginPath(); context.arc(630, 1250, 26, 0, Math.PI * 2); context.fill()
    context.beginPath(); context.arc(540, 1400, 120, 0.15 * Math.PI, 0.85 * Math.PI); context.lineWidth = 16; context.stroke() // huge grin
    context.fillStyle = '#101010'
    for (let dot = 0; dot < 260; dot += 1) { // halftone accent, still flat ink
      const column = dot % 20; const row = Math.floor(dot / 20)
      context.beginPath(); context.arc(70 + column * 30, 1660 + row * 30, 6, 0, Math.PI * 2); context.fill()
    }
  },
  'hand-doodle': (context, random) => {
    context.fillStyle = '#fdfbf4'; context.fillRect(0, 0, 1080, 1920) // paper page, top kept clean for overlay
    context.strokeStyle = 'rgba(120,150,200,0.22)'; context.lineWidth = 3
    for (let rule = 0; rule < 15; rule += 1) { // faint notebook rules
      context.beginPath(); context.moveTo(60, 540 + rule * 92); context.lineTo(1020, 540 + rule * 92 + (random() * 8 - 4)); context.stroke()
    }
    const wobbly = (points, color = '#37352f', width = 9) => {
      context.strokeStyle = color; context.lineWidth = width; context.lineCap = 'round'; context.lineJoin = 'round'
      context.beginPath()
      points.forEach(([x, y], index) => {
        const jx = x + (random() * 12 - 6); const jy = y + (random() * 12 - 6)
        if (index === 0) context.moveTo(jx, jy); else context.lineTo(jx, jy)
      })
      context.stroke()
    }
    for (let pass = 0; pass < 3; pass += 1) { // rough overlapping head circles
      const ring = []
      for (let step = 0; step <= 22; step += 1) {
        const angle = (step / 22) * Math.PI * 2
        ring.push([540 + Math.cos(angle) * (195 + random() * 24), 1130 + Math.sin(angle) * (205 + random() * 24)])
      }
      wobbly(ring, '#37352f', 7)
    }
    for (let strand = 0; strand < 24; strand += 1) { // scribble-fill hair
      wobbly([[430 + strand * 9, 950 + random() * 40], [438 + strand * 9, 880 - random() * 60]], '#37352f', 5)
    }
    wobbly([[470, 1070], [482, 1105]], '#37352f', 13) // two-stroke face
    wobbly([[612, 1065], [622, 1100]], '#37352f', 13)
    wobbly([[455, 1225], [520, 1275], [605, 1268], [655, 1215]], '#37352f', 10)
    wobbly([[540, 1340], [540, 1600]], '#37352f', 11) // stick body
    wobbly([[540, 1410], [395, 1525]], '#37352f', 10)
    wobbly([[540, 1410], [695, 1495]], '#37352f', 10)
    wobbly([[540, 1600], [445, 1785]], '#37352f', 10)
    wobbly([[540, 1600], [645, 1790]], '#37352f', 10)
    for (let line = 0; line < 5; line += 1) wobbly([[760 + line * 12, 1080], [830 + line * 12, 1010]], '#37352f', 4) // motion scribbles
    wobbly([[215, 1690], [420, 1625]], '#ff5a36', 13) // red marker arrow accent
    wobbly([[420, 1625], [372, 1602], [398, 1665], [420, 1625]], '#ff5a36', 11)
    for (let pass = 0; pass < 2; pass += 1) { // double marker circle around the payoff
      const ring = []
      for (let step = 0; step <= 18; step += 1) {
        const angle = (step / 18) * Math.PI * 2
        ring.push([820 + Math.cos(angle) * (135 + random() * 16), 1610 + Math.sin(angle) * (105 + random() * 16)])
      }
      wobbly(ring, '#ff5a36', 8)
    }
    context.strokeStyle = 'rgba(150,100,50,0.3)'; context.lineWidth = 16 // coffee-ring stain
    context.beginPath(); context.arc(880, 680, 88, 0.2, Math.PI * 1.85); context.stroke()
    wobbly([[150, 735], [330, 680]], '#37352f', 6) // crossed-out mistake left visible
    wobbly([[150, 680], [330, 735]], '#37352f', 6)
  },
  'comic-ink': (context, random) => {
    context.fillStyle = '#f4e9d8'; context.fillRect(0, 0, 1080, 1920) // aged newsprint
    context.fillStyle = '#d8402f'
    for (let row = 0; row < 21; row += 1) for (let column = 0; column < 41; column += 1) { // Ben-Day dot sky band held for overlay
      context.beginPath(); context.arc(20 + column * 27 + (row % 2 ? 13 : 0), 36 + row * 27, 5.5, 0, Math.PI * 2); context.fill()
    }
    context.strokeStyle = '#141414'; context.lineWidth = 12
    context.strokeRect(48, 660, 984, 1200) // printed panel border
    context.save()
    context.beginPath(); context.rect(54, 666, 972, 1188); context.clip()
    context.save(); context.translate(540, 1860); context.rotate(-0.06); context.fillStyle = '#141414' // tilted stark ink skyline
    for (let building = 0; building < 9; building += 1) context.fillRect(-560 + building * 130, -260 - (building % 3) * 70, 96, 420)
    context.restore()
    for (let ray = 0; ray < 32; ray += 1) { // speed lines radiating behind the action
      const angle = (ray / 32) * Math.PI * 2
      context.strokeStyle = '#141414'; context.lineWidth = 2.5 + random() * 4
      context.beginPath()
      context.moveTo(540 + Math.cos(angle) * 300, 1230 + Math.sin(angle) * 300)
      context.lineTo(540 + Math.cos(angle) * 820, 1230 + Math.sin(angle) * 820)
      context.stroke()
    }
    const burst = (offsetX, offsetY) => {
      context.beginPath()
      for (let point = 0; point < 24; point += 1) {
        const angle = (point / 24) * Math.PI * 2
        const radius = point % 2 ? 200 : 320
        const x = 540 + offsetX + Math.cos(angle) * radius; const y = 1230 + offsetY + Math.sin(angle) * radius
        if (point === 0) context.moveTo(x, y); else context.lineTo(x, y)
      }
      context.closePath()
    }
    context.strokeStyle = 'rgba(216,64,47,0.65)'; context.lineWidth = 7; burst(16, 12); context.stroke() // off-register red misprint ghost
    context.fillStyle = '#f2c832'; context.strokeStyle = '#141414'; context.lineWidth = 10
    burst(0, 0); context.fill(); context.stroke() // impact burst
    context.fillStyle = '#141414' // inked hero fist
    context.beginPath(); context.ellipse(540, 1215, 118, 148, 0.18, 0, Math.PI * 2); context.fill()
    context.save(); context.translate(505, 1350); context.rotate(0.12); context.fillRect(0, 0, 92, 330); context.restore()
    context.fillStyle = '#f4e9d8' // knuckle highlights cut from the ink
    for (let knuckle = 0; knuckle < 3; knuckle += 1) { context.beginPath(); context.ellipse(470 + knuckle * 62, 1150, 20, 30, 0.2, 0, Math.PI * 2); context.fill() }
    context.strokeStyle = '#141414'; context.lineWidth = 3
    for (let hatch = 0; hatch < 26; hatch += 1) { // cross-hatched corner shadow
      context.beginPath(); context.moveTo(70, 1490 + hatch * 14); context.lineTo(330, 1400 + hatch * 14); context.stroke()
      if (hatch % 2 === 0) { context.beginPath(); context.moveTo(90 + hatch * 9, 1840); context.lineTo(220 + hatch * 9, 1560); context.stroke() }
    }
    context.fillStyle = '#2b6cb0'
    for (let row = 0; row < 12; row += 1) for (let column = 0; column < 12; column += 1) { // flat cyan halftone patch
      context.beginPath(); context.arc(760 + column * 22 + (row % 2 ? 11 : 0), 1560 + row * 22, 5, 0, Math.PI * 2); context.fill()
    }
    context.restore()
  },
  'paper-collage': (context, random) => {
    context.fillStyle = '#f8b229'; context.fillRect(0, 0, 1080, 1920) // one untouched background sheet; top stays clear for overlay
    for (let fiber = 0; fiber < 900; fiber += 1) { // paper tooth
      context.fillStyle = random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(120,70,0,0.05)'
      context.fillRect(random() * 1080, random() * 1920, 2.5, 2.5)
    }
    const shadowed = (color, trace) => { // every shape is a separate glued paper layer with a hard offset shadow
      context.save(); context.translate(12, 14); context.fillStyle = 'rgba(80,40,0,0.28)'; context.beginPath(); trace(); context.fill(); context.restore()
      context.fillStyle = color; context.beginPath(); trace(); context.fill()
    }
    const skyJags = Array.from({ length: 16 }, () => random() * 44 - 22)
    shadowed('#219ebc', () => { // torn-edge sky strip
      context.moveTo(0, 640)
      skyJags.forEach((jag, step) => context.lineTo((step + 1) * 72, 640 + jag))
      context.lineTo(1080, 930); context.lineTo(0, 930); context.closePath()
    })
    shadowed('#e63946', () => { context.arc(840, 800, 130, 0, Math.PI * 2) }) // fringed paper sun
    context.save(); context.translate(840, 800); context.fillStyle = '#e63946'
    for (let fringe = 0; fringe < 14; fringe += 1) { context.rotate((Math.PI * 2) / 14); context.fillRect(-14, 150, 28, 62) }
    context.restore()
    shadowed('#ffffff', () => { // sticker cloud with gloss stripe
      context.arc(230, 780, 74, 0, Math.PI * 2); context.arc(330, 750, 92, 0, Math.PI * 2); context.arc(420, 790, 66, 0, Math.PI * 2)
    })
    context.fillStyle = 'rgba(255,255,255,0.6)'; context.fillRect(190, 720, 220, 18)
    shadowed('#43aa8b', () => { // scalloped paper hills
      context.moveTo(0, 1920); context.lineTo(0, 1600)
      for (let scallop = 0; scallop < 6; scallop += 1) context.arc(90 + scallop * 180, 1600, 92, Math.PI, 0, false)
      context.lineTo(1080, 1920); context.closePath()
    })
    context.save(); context.translate(400, 1330); context.rotate(-0.05) // paper character, slightly misaligned layers
    shadowed('#f94144', () => { context.arc(0, 0, 175, 0, Math.PI * 2) }) // circle head
    shadowed('#5f4bb6', () => { // zigzag-cut hair
      context.moveTo(-180, -60)
      for (let tooth = 0; tooth < 6; tooth += 1) { context.lineTo(-150 + tooth * 60, -190); context.lineTo(-120 + tooth * 60, -95) }
      context.lineTo(180, -60); context.closePath()
    })
    shadowed('#ffffff', () => { context.arc(-62, -12, 46, 0, Math.PI * 2) }) // googly-eye stickers
    shadowed('#ffffff', () => { context.arc(70, -18, 46, 0, Math.PI * 2) })
    context.fillStyle = '#141414'
    context.beginPath(); context.arc(-50, 0, 20, 0, Math.PI * 2); context.fill()
    context.beginPath(); context.arc(84, -6, 20, 0, Math.PI * 2); context.fill()
    shadowed('#f3722c', () => { context.moveTo(-46, 78); context.lineTo(52, 70); context.lineTo(10, 118); context.closePath() }) // torn paper smile
    context.restore()
    shadowed('#90be6d', () => { context.rect(300, 1490, 210, 300) }) // paper body slab
    shadowed('#577590', () => { context.rect(540, 1540, 250, 60) }) // glued paper arm, wrong angle
  },
  'clay-toy-3d': (context, random) => {
    const backdrop = context.createLinearGradient(0, 0, 0, 1920)
    backdrop.addColorStop(0, '#fff3dd'); backdrop.addColorStop(1, '#ffd6a5')
    context.fillStyle = backdrop; context.fillRect(0, 0, 1080, 1920)
    context.fillStyle = '#a8e6cf'; context.fillRect(0, 1060, 1080, 860) // felt tabletop, raised so overlays cannot bury the diorama
    context.fillStyle = '#8fd3b6'; context.fillRect(0, 1060, 1080, 26) // felt edge seam
    context.fillStyle = '#c9a76d' // cardboard prop box
    context.save(); context.translate(880, 1010); context.rotate(0.05); context.fillRect(-110, 0, 220, 190); context.fillStyle = '#b08e55'; context.fillRect(-110, 0, 220, 34); context.restore()
    context.strokeStyle = '#5f9b57'; context.lineWidth = 14; context.lineCap = 'round' // pipe-cleaner plant
    context.beginPath(); context.moveTo(190, 1150); context.quadraticCurveTo(150, 950, 220, 830); context.stroke()
    context.fillStyle = '#74b96a'
    for (const [leafX, leafY] of [[160, 900], [250, 840], [205, 760]]) { context.beginPath(); context.ellipse(leafX, leafY, 46, 26, 0.5, 0, Math.PI * 2); context.fill() }
    context.fillStyle = '#ff8fab' // squishy clay hero, centered in the upper-middle band
    context.beginPath(); context.ellipse(540, 860, 235, 270, 0, 0, Math.PI * 2); context.fill()
    context.fillStyle = '#ffb7c9'
    context.beginPath(); context.ellipse(475, 760, 100, 120, -0.3, 0, Math.PI * 2); context.fill() // soft clay highlight
    context.fillStyle = '#5c4033'
    context.beginPath(); context.arc(475, 840, 28, 0, Math.PI * 2); context.fill()
    context.beginPath(); context.arc(615, 840, 28, 0, Math.PI * 2); context.fill()
    context.strokeStyle = '#5c4033'; context.lineWidth = 12
    context.beginPath(); context.arc(545, 940, 70, 0.2 * Math.PI, 0.8 * Math.PI); context.stroke() // pressed-in smile
    context.fillStyle = '#ffffff' // cotton-ball smoke over the box
    for (const [puffX, puffY, puffR] of [[860, 900, 44], [905, 860, 56], [960, 905, 40]]) { context.beginPath(); context.arc(puffX, puffY, puffR, 0, Math.PI * 2); context.fill() }
    for (let print = 0; print < 90; print += 1) { // thumbprint dents
      context.strokeStyle = 'rgba(120,70,60,0.16)'
      context.lineWidth = 3
      const x = 330 + random() * 440; const y = 630 + random() * 460
      context.beginPath(); context.arc(x, y, 8 + random() * 12, 0, Math.PI * 1.4); context.stroke()
    }
    context.fillStyle = 'rgba(255,243,221,0.65)'; context.fillRect(0, 1560, 1080, 360) // macro blur falloff
    context.fillStyle = 'rgba(255,243,221,0.5)'; context.fillRect(0, 0, 1080, 240)
  },
  'retro-pixel': (context, random) => {
    const grid = document.createElement('canvas')
    grid.width = 27; grid.height = 48 // strict low-res grid, scaled 40×
    const pixel = grid.getContext('2d')
    pixel.fillStyle = '#2b2d64'; pixel.fillRect(0, 0, 27, 48)
    for (let x = 0; x < 27; x += 1) for (let y = 0; y < 20; y += 1) {
      if ((x + y) % 2 === 0 && random() > 0.6) { pixel.fillStyle = '#3d3f7d'; pixel.fillRect(x, y, 1, 1) } // dithered sky
    }
    pixel.fillStyle = '#161738'
    for (let x = 0; x < 27; x += 3) pixel.fillRect(x, 14 + (x % 6 === 0 ? -2 : 0), 2, 10) // parallax skyline
    pixel.fillStyle = '#3ec54b'
    for (let x = 0; x < 27; x += 1) pixel.fillRect(x, 40, 1, 8) // tiled platform
    pixel.fillStyle = '#2c8f37'
    for (let x = 0; x < 27; x += 2) pixel.fillRect(x, 40, 1, 1)
    pixel.fillStyle = '#e832a0' // hero sprite, big theatrical pose
    pixel.fillRect(11, 30, 6, 8); pixel.fillRect(9, 32, 2, 3); pixel.fillRect(17, 30, 2, 3)
    pixel.fillRect(12, 26, 4, 4)
    pixel.fillStyle = '#ffffff'; pixel.fillRect(13, 27, 1, 1); pixel.fillRect(15, 27, 1, 1) // single-pixel eyes
    pixel.fillStyle = '#ffd93b'; pixel.fillRect(20, 34, 2, 2) // glowing pickup
    context.imageSmoothingEnabled = false
    context.drawImage(grid, 0, 0, 1080, 1920)
  },
  'surreal-brainrot': (context, random) => {
    const sky = context.createLinearGradient(0, 0, 0, 1920)
    sky.addColorStop(0, '#2e9bff'); sky.addColorStop(0.6, '#7bff3f'); sky.addColorStop(1, '#ff8b1f')
    context.fillStyle = sky; context.fillRect(0, 0, 1080, 1920) // oversaturated, clipping
    const bloom = context.createRadialGradient(540, 900, 40, 540, 900, 560)
    bloom.addColorStop(0, 'rgba(255,255,255,0.95)'); bloom.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = bloom; context.fillRect(0, 340, 1080, 1200) // harsh bloom halo
    context.fillStyle = '#123' // tiny skyline: the hybrid towers over the city
    for (let building = 0; building < 12; building += 1) {
      const width = 50 + random() * 40
      context.fillRect(building * 90, 1780 - random() * 120, width, 260)
    }
    context.fillStyle = '#ffd93b' // impossible hybrid: banana-bodied, cat-eared, sneaker-footed
    context.beginPath(); context.ellipse(540, 1220, 240, 520, 0.1, 0, Math.PI * 2); context.fill()
    context.fillStyle = '#ff8b1f'
    context.beginPath(); context.moveTo(390, 800); context.lineTo(460, 620); context.lineTo(540, 790); context.fill() // cat ear
    context.beginPath(); context.moveTo(560, 780); context.lineTo(650, 610); context.lineTo(710, 800); context.fill()
    context.fillStyle = '#ffffff'
    context.beginPath(); context.ellipse(470, 980, 80, 100, 0, 0, Math.PI * 2); context.fill()
    context.beginPath(); context.ellipse(640, 980, 80, 100, 0, 0, Math.PI * 2); context.fill()
    context.fillStyle = '#111'
    context.beginPath(); context.arc(480, 1010, 34, 0, Math.PI * 2); context.fill()
    context.beginPath(); context.arc(630, 1010, 34, 0, Math.PI * 2); context.fill()
    context.fillStyle = '#f2f2f2' // giant sneakers on a legend
    context.beginPath(); context.ellipse(420, 1740, 150, 70, -0.1, 0, Math.PI * 2); context.fill()
    context.beginPath(); context.ellipse(680, 1760, 150, 70, 0.1, 0, Math.PI * 2); context.fill()
    context.fillStyle = '#333'
    for (let onlooker = 0; onlooker < 9; onlooker += 1) { // awed onlookers imply the lore
      context.beginPath(); context.arc(90 + onlooker * 110, 1850, 16, 0, Math.PI * 2); context.fill()
    }
    jpegBlocks(context, random, 0.2, 28) // screenshot-of-a-screenshot rot
  },
  'deep-fried': (context, random) => {
    const base = context.createLinearGradient(0, 0, 0, 1920)
    base.addColorStop(0, '#ffb300'); base.addColorStop(0.5, '#ff3c00'); base.addColorStop(1, '#5c1a00')
    context.fillStyle = base; context.fillRect(0, 0, 1080, 1920)
    context.fillStyle = '#5c1a00' // reaction-image subject, dead center
    context.beginPath(); context.ellipse(540, 1150, 300, 360, 0, 0, Math.PI * 2); context.fill()
    context.strokeStyle = '#fff200'; context.lineWidth = 14 // ringing halo
    context.beginPath(); context.ellipse(540, 1150, 316, 376, 0, 0, Math.PI * 2); context.stroke()
    context.strokeStyle = 'rgba(255,60,0,0.8)'; context.lineWidth = 8
    context.beginPath(); context.ellipse(540, 1150, 336, 396, 0, 0, Math.PI * 2); context.stroke()
    context.fillStyle = '#ffb300'
    context.beginPath(); context.ellipse(440, 1060, 70, 90, 0, 0, Math.PI * 2); context.fill()
    context.beginPath(); context.ellipse(650, 1060, 70, 90, 0, 0, Math.PI * 2); context.fill()
    context.fillStyle = '#ff0000' // scorched glowing eyes
    context.beginPath(); context.arc(450, 1080, 30, 0, Math.PI * 2); context.fill()
    context.beginPath(); context.arc(640, 1080, 30, 0, Math.PI * 2); context.fill()
    sparkle(context, 450, 1080, 130, 'rgba(255,255,255,0.9)')
    sparkle(context, 640, 1080, 130, 'rgba(255,244,180,0.9)')
    sparkle(context, 850, 620, 90)
    jpegBlocks(context, random, 0.4, 32) // crunchy macroblocks
    for (let band = 0; band < 10; band += 1) { // posterized banding
      context.fillStyle = `rgba(${200 + band * 5}, ${40 + band * 14}, 0, 0.12)`
      context.fillRect(0, band * 192, 1080, 96)
    }
  },
  'cursed-collage': (context, random) => {
    context.fillStyle = '#e8dcc2'; context.fillRect(0, 0, 1080, 1920) // scanner-bed paper
    const scraps = [
      { x: 140, y: 700, w: 420, h: 560, rotate: -0.14, fill: '#4657ce' },
      { x: 520, y: 900, w: 460, h: 380, rotate: 0.1, fill: '#d43d2a' },
      { x: 300, y: 1220, w: 520, h: 480, rotate: 0.05, fill: '#3d7a4f' },
      { x: 90, y: 1350, w: 300, h: 420, rotate: -0.24, fill: '#b8860b' },
      { x: 640, y: 1380, w: 340, h: 460, rotate: 0.2, fill: '#6b3fa0' },
    ]
    for (const scrap of scraps) { // crude cutouts, wrong angles, contradictory shadows
      context.save()
      context.translate(scrap.x + scrap.w / 2, scrap.y + scrap.h / 2)
      context.rotate(scrap.rotate)
      context.fillStyle = 'rgba(0,0,0,0.4)'
      context.fillRect(-scrap.w / 2 + (random() > 0.5 ? 26 : -26), -scrap.h / 2 + (random() > 0.5 ? 22 : -22), scrap.w, scrap.h)
      context.fillStyle = '#ffffff' // white cut-line halo
      context.fillRect(-scrap.w / 2 - 14, -scrap.h / 2 - 14, scrap.w + 28, scrap.h + 28)
      context.fillStyle = scrap.fill
      context.fillRect(-scrap.w / 2, -scrap.h / 2, scrap.w, scrap.h)
      context.fillStyle = 'rgba(255,255,255,0.6)' // mismatched-resolution fragment
      context.fillRect(-scrap.w / 2, -scrap.h / 2, scrap.w, scrap.h / 5)
      context.restore()
    }
    context.fillStyle = '#f4ecd8' // roughly torn plain paper area held for the overlay
    context.beginPath()
    context.moveTo(0, 0); context.lineTo(1080, 0); context.lineTo(1080, 500)
    for (let x = 1080; x >= 0; x -= 90) context.lineTo(x, 500 + (random() > 0.5 ? 34 : -30))
    context.closePath(); context.fill()
    for (let dust = 0; dust < 900; dust += 1) { // scanner dust
      context.fillStyle = 'rgba(60,50,40,0.18)'
      context.fillRect(random() * 1080, random() * 1920, 2.2, 2.2)
    }
  },
  'y2k-web-chaos': (context, random) => {
    const mesh = context.createLinearGradient(0, 0, 0, 1920)
    mesh.addColorStop(0, '#7ad9ff'); mesh.addColorStop(0.5, '#ff7ad9'); mesh.addColorStop(1, '#1a1aff')
    context.fillStyle = mesh; context.fillRect(0, 0, 1080, 1920) // gradient mesh sky
    for (let row = 0; row < 8; row += 1) { // checkerboard floor receding to horizon
      const y = 1400 + row * row * 9
      const height = 14 + row * 9
      for (let column = 0; column < 14; column += 1) {
        context.fillStyle = (row + column) % 2 ? '#ffffff' : '#1a1aff'
        context.fillRect(column * 80 - row * 4, y, 80, height)
      }
    }
    const orbs = [[280, 1050, 150], [660, 880, 110], [780, 1250, 170], [420, 1420, 120]]
    for (const [x, y, radius] of orbs) { // chrome blobs with fake bevel gloss
      const chrome = context.createRadialGradient(x - radius / 3, y - radius / 3, radius / 8, x, y, radius)
      chrome.addColorStop(0, '#ffffff'); chrome.addColorStop(0.45, '#c8ff5e'); chrome.addColorStop(0.75, '#ff7ad9'); chrome.addColorStop(1, '#28285a')
      context.fillStyle = chrome
      context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill()
      context.fillStyle = 'rgba(255,255,255,0.85)'
      context.beginPath(); context.ellipse(x - radius / 3, y - radius / 2, radius / 4, radius / 7, -0.5, 0, Math.PI * 2); context.fill()
    }
    context.strokeStyle = 'rgba(255,255,255,0.9)'; context.lineWidth = 6 // floating empty window frame
    context.strokeRect(120, 780, 400, 300)
    context.strokeRect(120, 780, 400, 60)
    for (let glitter = 0; glitter < 26; glitter += 1) sparkle(context, random() * 1080, 600 + random() * 1100, 26 + random() * 46, 'rgba(255,255,255,0.85)')
    for (let grain = 0; grain < 2000; grain += 1) { // dithered GIF grain
      context.fillStyle = random() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,255,0.08)'
      context.fillRect(Math.floor(random() * 270) * 4, Math.floor(random() * 480) * 4, 4, 4)
    }
  },
}

async function run() {
  const root = document.getElementById('root')
  const status = document.getElementById('status')
  const slides = makeSlides(brief)
  const fixedStyles = IMAGE_STYLES.filter((style) => !style.editable)

  // A medium is only provable if the overlay leaves it visible: these two
  // styles would otherwise land on the text-heavy hook / scrimmed CTA slides.
  const SLIDE_OVERRIDES = { 'clay-toy-3d': 2, 'paper-collage': 4 }

  const composed = new Map()
  for (const [index, style] of fixedStyles.entries()) {
    status.textContent = `Rendering ${style.name}…`
    const canvas = baseCanvas()
    painters[style.id](canvas.getContext('2d'), seededRandom(0x9e3779b9 ^ (index * 2654435761)))
    const slideIndex = SLIDE_OVERRIDES[style.id] ?? index % slides.length
    const slide = slides[slideIndex]
    const blob = await composeSlide({ image: canvas, slide, direction: slide.direction, preset: 'impact', index: slideIndex, total: slides.length })
    composed.set(style.id, URL.createObjectURL(blob))
  }

  const items = []
  for (const style of fixedStyles) {
    items.push({ image: await loadImage(composed.get(style.id)), label: style.name })
  }
  const sheetBlob = await composeContactSheet({ items, title: 'Image style taxonomy — one production-composited frame per style' })
  const section = document.createElement('section')
  const sheet = new Image()
  sheet.className = 'sheet'
  sheet.src = URL.createObjectURL(sheetBlob)
  section.appendChild(sheet)
  root.appendChild(section)
  await sheet.decode()

  const detailHeading = document.createElement('h1')
  detailHeading.textContent = 'The seven cartoon families in detail — genuinely different rendering media, each with the exact prompt directive it injects'
  root.appendChild(detailHeading)
  const detail = document.createElement('div')
  detail.className = 'detail'
  root.appendChild(detail)
  for (const styleId of DETAIL_STYLE_IDS) {
    const style = fixedStyles.find((entry) => entry.id === styleId)
    const figure = document.createElement('figure')
    const img = new Image()
    img.src = composed.get(styleId)
    figure.appendChild(img)
    const caption = document.createElement('figcaption')
    caption.innerHTML = `<strong>${style.name}</strong> — ${style.tagline}<br><span>${styleDirective(style)}</span>`
    figure.appendChild(caption)
    detail.appendChild(figure)
    await img.decode()
  }

  status.textContent = `Done: ${fixedStyles.length} styles rendered through the production compositor (makeSlides → composeSlide → composeContactSheet).`
  document.title = 'style-sheet-ready'
}

run().catch((error) => {
  document.getElementById('status').textContent = `Render failed: ${error.message}`
  document.title = 'style-sheet-failed'
})
