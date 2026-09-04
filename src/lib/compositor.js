import { canvasSpec, getPreset, LAYOUTS, validateDirection } from './artDirection'
import { composeOverlayGeometry, normalizeOverlaySettings } from './overlayComposite'

const clean = (value) => String(value ?? '').trim().replace(/\s+/g, ' ')
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

// Text must always land inside this box: TikTok reserves the top for search,
// the bottom for caption + sound, and the right rail for the action stack.
export const textSafeArea = canvasSpec.safe

export { DEFAULT_OVERLAY_SETTINGS, normalizeOverlaySettings, overlaySettingsKey, PANEL_CHROME } from './overlayComposite'

function fnv1a(value) {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function mulberry32(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function wrapWords(text, fontSize, maxWidth, measure) {
  const words = clean(text).split(' ').filter(Boolean)
  const lines = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (measure(candidate, fontSize) <= maxWidth) {
      line = candidate
    } else {
      if (!line || measure(word, fontSize) > maxWidth) return null
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

export function fitText(text, measure, { maxWidth, maxLines, fontRange, lineHeight, maxHeight = Infinity }) {
  const value = clean(text)
  if (!value) throw new Error('Slide text is required for image composition.')
  const [minSize, maxSize] = fontRange
  for (let fontSize = maxSize; fontSize >= minSize; fontSize -= 2) {
    const lines = wrapWords(value, fontSize, maxWidth, measure)
    const lineHeightPx = Math.round(fontSize * lineHeight)
    if (lines && lines.length <= maxLines && lines.length * lineHeightPx <= maxHeight) {
      return { lines, fontSize, lineHeight: lineHeightPx }
    }
  }
  throw new Error('Slide text is too long to remain readable on the image.')
}

// Frame: the box the main copy block must live in, per layout and preset.
// Deliberately holds no panel position: a panel is never a constant here,
// it is derived from the copy that was actually laid out (see the composite).
function textFrame(layoutId, preset, direction) {
  const safe = textSafeArea
  const safeWidth = safe.right - safe.left
  const pad = Math.round(54 * preset.paddingScale)
  switch (layoutId) {
    case 'impact-stack':
      return { x: safe.left, maxWidth: safeWidth, align: 'left', anchor: 'bottom', yTop: safe.top + 130, yBottom: safe.bottom - 104 }
    case 'editorial-split':
      return { x: safe.left + 16, maxWidth: Math.round((safeWidth - 32) * 0.94), align: 'left', anchor: 'top', yTop: 1250, yBottom: safe.bottom }
    case 'evidence-card': {
      const x = 56 + pad
      return { x, maxWidth: Math.round(safeWidth * 0.78), align: 'left', anchor: 'center', yTop: safe.top + 150, yBottom: safe.bottom - 150, pad }
    }
    case 'tension-rail':
      return direction.mirror
        ? { x: safe.right, maxWidth: Math.round(safeWidth * 0.62), align: 'right', anchor: 'center', yTop: safe.top + 80, yBottom: safe.bottom - 80 }
        : { x: safe.left, maxWidth: Math.round(safeWidth * 0.62), align: 'left', anchor: 'center', yTop: safe.top + 80, yBottom: safe.bottom - 80 }
    case 'spotlight-reveal': {
      const lower = direction.focalPoint.y < 0.5
      return lower
        ? { x: safe.left, maxWidth: Math.round(safeWidth * 0.88), align: 'left', anchor: 'center', yTop: 1010, yBottom: safe.bottom - 60 }
        : { x: safe.left, maxWidth: Math.round(safeWidth * 0.88), align: 'left', anchor: 'center', yTop: safe.top + 90, yBottom: 900 }
    }
    case 'takeaway-ledger':
      return { x: safe.left, maxWidth: Math.round(safeWidth * 0.92), align: 'left', anchor: 'top', yTop: 1246, yBottom: safe.bottom }
    case 'cta-stamp':
      return { x: Math.round((safe.left + safe.right) / 2), maxWidth: Math.round(safeWidth * 0.8), align: 'center', anchor: 'center', yTop: 830, yBottom: 1290 }
    default:
      return { x: safe.left, maxWidth: safeWidth, align: 'left', anchor: 'center', yTop: safe.top, yBottom: safe.bottom }
  }
}

// Pure geometry: given text + direction + preset and a measure function,
// compute every rendered line with its position, plus the emphasis span.
// The painter consumes this; tests assert safe-area behavior on it directly.
export function layoutSlideText({ text, role = 'setup', direction, preset: presetInput, measure, index = 0, total = 1, overlaySettings }) {
  const preset = getPreset(presetInput?.id ?? presetInput)
  const overlay = normalizeOverlaySettings(overlaySettings)
  const resolved = validateDirection(direction, { text, role })
  const layout = LAYOUTS[resolved.layout] || LAYOUTS['editorial-split']
  const frame = textFrame(layout.id, preset, resolved)
  const transform = preset.display.transform === 'upper' ? (value) => value.toUpperCase() : (value) => value
  const shaped = transform(clean(text))
  const fontRange = [Math.round(layout.fontRange[0] * preset.sizeScale * overlay.textScale), Math.round(layout.fontRange[1] * preset.sizeScale * overlay.textScale)]
  const lineHeight = layout.lineHeight * preset.lineHeightScale
  const fitted = fitText(shaped, measure, { maxWidth: frame.maxWidth, maxLines: layout.maxLines, fontRange, lineHeight, maxHeight: frame.yBottom - frame.yTop })

  const blockHeight = fitted.lines.length * fitted.lineHeight
  const span = frame.yBottom - frame.yTop
  const anchoredTop = (which) => which === 'top' ? frame.yTop
    : which === 'bottom' ? frame.yBottom - blockHeight
    : Math.round(frame.yTop + Math.max(0, (span - blockHeight) / 2))
  const anchor = overlay.position === 'auto' ? frame.anchor : overlay.position
  const top = clamp(anchoredTop(anchor) + overlay.offsetY, textSafeArea.top, Math.max(textSafeArea.top, textSafeArea.bottom - blockHeight))
  // How far the reviewer moved the composite away from where this layout puts
  // it. Both terms use the same block height, so resizing the copy alone never
  // registers as a displacement.
  const displacement = top - anchoredTop(frame.anchor)

  const lines = fitted.lines.map((line, lineIndex) => {
    const width = measure(line, fitted.fontSize)
    const naturalX = frame.align === 'right' ? frame.x - width : frame.align === 'center' ? Math.round(frame.x - width / 2) : frame.x
    const x = clamp(naturalX + overlay.offsetX, textSafeArea.left, Math.max(textSafeArea.left, textSafeArea.right - width))
    return { text: line, x, y: top + lineIndex * fitted.lineHeight, width }
  })

  const emphasisText = transform(clean(resolved.emphasis))
  let emphasisSpan = null
  if (emphasisText) {
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const haystack = lines[lineIndex].text
      const at = haystack.toLowerCase().indexOf(emphasisText.toLowerCase())
      if (at >= 0) {
        const prefixWidth = at > 0 ? measure(haystack.slice(0, at), fitted.fontSize) : 0
        emphasisSpan = {
          lineIndex,
          text: haystack.slice(at, at + emphasisText.length),
          x: lines[lineIndex].x + prefixWidth,
          width: measure(haystack.slice(at, at + emphasisText.length), fitted.fontSize),
        }
        break
      }
    }
  }

  // The composite — copy box plus the panel painted beneath it — is resolved
  // here, once, from the copy that was actually laid out. Every painter reads
  // its backing surface from this instead of from static frame constants, so
  // panel and text can only ever move and resize together.
  const composite = composeOverlayGeometry({
    layoutId: layout.id, frame, lines, blockTop: top, blockBottom: top + blockHeight, overlay,
    frameSpan: { top: frame.yTop + displacement, bottom: frame.yBottom + displacement },
  })

  return {
    preset, layout: layout.id, direction: resolved, frame, lines, emphasisSpan, overlay, composite,
    fontSize: fitted.fontSize, lineHeight: fitted.lineHeight,
    blockTop: top, blockBottom: top + blockHeight, index, total,
  }
}

function cropBox(image, focalPoint = { x: 0.5, y: 0.5 }) {
  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height
  const targetRatio = canvasSpec.width / canvasSpec.height
  if (sourceWidth / sourceHeight > targetRatio) {
    const width = sourceHeight * targetRatio
    return { sx: clamp(focalPoint.x * sourceWidth - width / 2, 0, sourceWidth - width), sy: 0, sw: width, sh: sourceHeight }
  }
  const height = sourceWidth / targetRatio
  return { sx: 0, sy: clamp(focalPoint.y * sourceHeight - height / 2, 0, sourceHeight - height), sw: sourceWidth, sh: height }
}

function roundedRectPath(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2)
  context.beginPath()
  context.moveTo(x + r, y)
  context.lineTo(x + width - r, y)
  context.arcTo(x + width, y, x + width, y + r, r)
  context.lineTo(x + width, y + height - r)
  context.arcTo(x + width, y + height, x + width - r, y + height, r)
  context.lineTo(x + r, y + height)
  context.arcTo(x, y + height, x, y + height - r, r)
  context.lineTo(x, y + r)
  context.arcTo(x, y, x, y + r, r)
  context.closePath()
}

function paintPanel(context, preset, x, y, width, height, fill, rotate = preset.panel.rotation) {
  context.save()
  if (rotate) {
    context.translate(x + width / 2, y + height / 2)
    context.rotate((rotate * Math.PI) / 180)
    context.translate(-(x + width / 2), -(y + height / 2))
  }
  context.fillStyle = fill
  if (preset.panel.radius > 0) {
    roundedRectPath(context, x, y, width, height, preset.panel.radius)
    context.fill()
  } else {
    context.fillRect(x, y, width, height)
  }
  context.restore()
}

function verticalScrim(context, from, to, alpha) {
  const gradient = context.createLinearGradient(0, from, 0, to)
  gradient.addColorStop(0, 'rgba(8, 8, 10, 0)')
  gradient.addColorStop(0.45, `rgba(8, 8, 10, ${(alpha * 0.55).toFixed(3)})`)
  gradient.addColorStop(1, `rgba(8, 8, 10, ${alpha.toFixed(3)})`)
  context.fillStyle = gradient
  context.fillRect(0, Math.min(from, to), canvasSpec.width, Math.abs(to - from))
}

function paintGrain(context, seedText, alpha) {
  if (alpha <= 0) return
  const random = mulberry32(fnv1a(seedText))
  context.save()
  for (let index = 0; index < 640; index += 1) {
    const x = random() * canvasSpec.width
    const y = random() * canvasSpec.height
    const size = 1 + random() * 1.8
    context.fillStyle = random() > 0.5 ? `rgba(255, 255, 255, ${alpha})` : `rgba(0, 0, 0, ${alpha})`
    context.fillRect(x, y, size, size)
  }
  context.restore()
}

function setFont(context, preset, size, family = preset.display.family, weight = preset.display.weight) {
  context.font = `${weight} ${size}px ${family}`
  context.letterSpacing = preset.display.letterSpacing
}

function kickerLabel(context, preset, text, x, y, { color, chip = false, align = 'left' } = {}) {
  const size = preset.kicker.size
  context.font = `${preset.kicker.weight} ${size}px ${preset.kicker.family}`
  context.letterSpacing = preset.kicker.letterSpacing
  const label = text.toUpperCase()
  const width = context.measureText(label).width
  const drawX = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x
  if (chip) {
    context.fillStyle = preset.palette.accent
    context.fillRect(drawX - 18, y - 14, width + 36, size + 30)
    context.fillStyle = preset.palette.accentInk
  } else {
    context.fillStyle = color || 'rgba(255, 255, 255, 0.82)'
  }
  context.textBaseline = 'top'
  context.fillText(label, drawX, y)
  context.letterSpacing = '0px'
  return { x: drawX, width }
}

function paintEmphasis(context, plan) {
  const { emphasisSpan, preset, fontSize } = plan
  if (!emphasisSpan) return
  const line = plan.lines[emphasisSpan.lineIndex]
  const padX = Math.round(fontSize * 0.14)
  const padY = Math.round(fontSize * 0.1)
  if (preset.emphasis === 'highlight') {
    context.fillStyle = preset.palette.accent
    context.fillRect(emphasisSpan.x - padX, line.y - padY, emphasisSpan.width + padX * 2, fontSize + padY * 2)
  } else if (preset.emphasis === 'underline') {
    context.fillStyle = preset.palette.accent
    context.fillRect(emphasisSpan.x, line.y + fontSize + Math.round(fontSize * 0.08), emphasisSpan.width, Math.max(6, Math.round(fontSize * 0.09)))
  } else if (preset.emphasis === 'box') {
    context.strokeStyle = preset.palette.accent
    context.lineWidth = Math.max(3, Math.round(fontSize * 0.05))
    context.strokeRect(emphasisSpan.x - padX, line.y - padY, emphasisSpan.width + padX * 2, fontSize + padY * 2)
  }
}

function paintLayoutPanel(context, plan) {
  if (!plan.overlay.panelEnabled || plan.overlay.panelOpacity <= 0) return
  const { panel } = plan.composite
  context.save()
  context.globalAlpha = plan.overlay.panelOpacity
  paintPanel(context, plan.preset, panel.x, panel.y, panel.width, panel.height, plan.overlay.panelColor || plan.preset.palette.paper, 0)
  context.restore()
}

function paintTextBlock(context, plan, color) {
  const { preset, fontSize, emphasisSpan } = plan
  const { backdrop } = plan.composite
  if (backdrop && backdrop.width > 0 && backdrop.height > 0) {
    context.save()
    context.globalAlpha = plan.overlay.backgroundOpacity
    context.fillStyle = '#000000'
    context.fillRect(backdrop.x, backdrop.y, backdrop.width, backdrop.height)
    context.restore()
  }
  paintEmphasis(context, plan)
  setFont(context, preset, fontSize)
  context.textBaseline = 'top'
  plan.lines.forEach((line, lineIndex) => {
    context.fillStyle = color
    context.fillText(line.text, line.x, line.y)
    if (emphasisSpan && emphasisSpan.lineIndex === lineIndex) {
      if (preset.emphasis === 'stroke') {
        context.strokeStyle = preset.palette.accent
        context.lineWidth = Math.max(3, Math.round(fontSize * 0.055))
        context.strokeText(emphasisSpan.text, emphasisSpan.x, line.y)
      } else if (preset.emphasis === 'highlight') {
        context.fillStyle = preset.palette.accentInk
        context.fillText(emphasisSpan.text, emphasisSpan.x, line.y)
      } else if (preset.emphasis === 'underline') {
        context.fillStyle = preset.palette.accent
        context.fillText(emphasisSpan.text, emphasisSpan.x, line.y)
      }
    }
  })
  context.letterSpacing = '0px'
}

const painters = {
  'impact-stack': (context, plan) => {
    const { preset, index, total } = plan
    const safe = textSafeArea
    const { scrim } = plan.composite
    // The base scrim belongs to the composite: lifting the copy lifts the
    // darkened region with it and hands the bottom of the image back.
    verticalScrim(context, scrim.from, scrim.to, Math.min(0.92, 0.8 * preset.scrimBoost))
    context.fillStyle = 'rgba(8, 8, 10, 0.34)'
    context.fillRect(0, 0, canvasSpec.width, 300)
    const numeral = String(index + 1).padStart(2, '0')
    context.font = `${preset.display.weight} 330px ${preset.display.family}`
    context.textBaseline = 'top'
    context.strokeStyle = preset.palette.accent
    context.lineWidth = 4
    context.strokeText(numeral, plan.direction.mirror ? 96 : 660, 250)
    kickerLabel(context, preset, `${numeral} / ${String(total).padStart(2, '0')} — read this`, safe.left, safe.top, { chip: true })
    paintTextBlock(context, plan, '#ffffff')
    kickerLabel(context, preset, 'swipe →', safe.left, safe.bottom - 34, { color: 'rgba(255,255,255,0.9)' })
  },

  'editorial-split': (context, plan) => {
    const { preset, frame, index, total } = plan
    const { panel, edge, text } = plan.composite
    // `edge.top` is the panel's logical top edge before any bleed, so the
    // kicker, accent bar, and rule stay pinned to the copy they introduce.
    verticalScrim(context, edge.top - 320, edge.top, 0.3 * preset.scrimBoost)
    paintLayoutPanel(context, plan)
    context.fillStyle = preset.palette.accent
    const barX = plan.direction.mirror ? textSafeArea.right - 12 : textSafeArea.left - 28
    context.fillRect(barX, edge.top + 64, 12, 210)
    kickerLabel(context, preset, `${String(index + 1).padStart(2, '0')} — the setup`, text.left, edge.top + 66, { color: preset.palette.ink })
    context.fillStyle = 'rgba(0, 0, 0, 0.22)'
    context.fillRect(text.left, edge.top + 118, Math.round(frame.maxWidth * 0.42), 3)
    paintTextBlock(context, plan, preset.palette.ink)
    kickerLabel(context, preset, `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`, textSafeArea.right, edge.top + 66, { color: 'rgba(0,0,0,0.45)', align: 'right' })
  },

  'evidence-card': (context, plan) => {
    const { preset, frame, index, total } = plan
    const { panel: card, text } = plan.composite
    context.fillStyle = `rgba(10, 10, 12, ${(0.3 * preset.scrimBoost).toFixed(3)})`
    context.fillRect(0, 0, canvasSpec.width, canvasSpec.height)
    const pad = frame.pad
    paintPanel(context, preset, card.x, card.y, card.width, card.height, preset.palette.paper)
    context.fillStyle = preset.palette.accent
    const spineX = plan.direction.mirror ? card.x + card.width - 12 : card.x
    context.fillRect(spineX, card.y, 12, card.height)
    context.font = `${preset.display.weight} 130px ${preset.display.family}`
    context.textBaseline = 'top'
    context.fillStyle = preset.palette.accent
    context.fillText('”', text.left, card.y + 8)
    paintTextBlock(context, plan, preset.palette.ink)
    kickerLabel(context, preset, `field note · ${String(index + 1).padStart(2, '0')}/${String(total).padStart(2, '0')}`, text.left, text.bottom + pad - 6, { color: 'rgba(0,0,0,0.5)' })
  },

  'tension-rail': (context, plan) => {
    const { preset, index, total } = plan
    const { text } = plan.composite
    // The side scrim is the composite's backing surface: the darkened edge is
    // always the edge the copy sits against, so moving the copy across the
    // frame moves the darkened region with it instead of stranding both.
    const rightSide = (text.left + text.right) / 2 >= canvasSpec.width / 2
    const gradient = context.createLinearGradient(rightSide ? canvasSpec.width : 0, 0, rightSide ? 0 : canvasSpec.width, 0)
    gradient.addColorStop(0, `rgba(8, 8, 10, ${Math.min(0.92, 0.85 * preset.scrimBoost).toFixed(3)})`)
    gradient.addColorStop(0.66, 'rgba(8, 8, 10, 0.12)')
    gradient.addColorStop(1, 'rgba(8, 8, 10, 0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, canvasSpec.width, canvasSpec.height)
    context.fillStyle = preset.palette.accent
    const barX = rightSide ? text.right + 18 : text.left - 30
    context.fillRect(barX, plan.blockTop - 8, 10, plan.blockBottom - plan.blockTop + 16)
    kickerLabel(context, preset, 'the catch', rightSide ? text.right : text.left, plan.blockTop - 74, { color: preset.palette.accent, align: rightSide ? 'right' : 'left' })
    paintTextBlock(context, plan, '#ffffff')
    context.fillStyle = preset.palette.accent
    for (let dot = 0; dot < 3; dot += 1) {
      const dotX = rightSide ? text.right - 18 - dot * 40 : text.left + dot * 40
      context.fillRect(dotX, plan.blockBottom + 46, 18, 18)
    }
    kickerLabel(context, preset, `${String(index + 1).padStart(2, '0')}/${String(total).padStart(2, '0')}`, rightSide ? textSafeArea.left : textSafeArea.right, textSafeArea.bottom - 30, { color: 'rgba(255,255,255,0.55)', align: rightSide ? 'left' : 'right' })
  },

  'spotlight-reveal': (context, plan) => {
    const { preset, direction } = plan
    const { scrim, text } = plan.composite
    const focalX = direction.focalPoint.x * canvasSpec.width
    const focalY = direction.focalPoint.y * canvasSpec.height
    const spotlight = context.createRadialGradient(focalX, focalY, 190, focalX, focalY, 1250)
    spotlight.addColorStop(0, 'rgba(8, 8, 10, 0)')
    spotlight.addColorStop(0.55, `rgba(8, 8, 10, ${(0.4 * preset.scrimBoost).toFixed(3)})`)
    spotlight.addColorStop(1, `rgba(8, 8, 10, ${Math.min(0.9, 0.74 * preset.scrimBoost).toFixed(3)})`)
    context.fillStyle = spotlight
    context.fillRect(0, 0, canvasSpec.width, canvasSpec.height)
    verticalScrim(context, scrim.from, scrim.to, 0.42 * preset.scrimBoost)
    kickerLabel(context, preset, 'the shift', text.left, plan.blockTop - 76, { chip: true })
    paintTextBlock(context, plan, '#ffffff')
    context.fillStyle = preset.palette.accent
    context.fillRect(text.left, plan.blockBottom + 42, 150, 8)
  },

  'takeaway-ledger': (context, plan) => {
    const { preset, frame, index, total } = plan
    const { panel, edge, text } = plan.composite
    verticalScrim(context, edge.top - 360, edge.top, 0.34 * preset.scrimBoost)
    paintLayoutPanel(context, plan)
    const badge = 104
    const badgeX = plan.direction.mirror ? textSafeArea.right - badge : text.left
    context.fillStyle = preset.palette.accent
    context.fillRect(badgeX, edge.top - badge / 2, badge, badge)
    context.font = `${preset.display.weight} 56px ${preset.display.family}`
    context.textBaseline = 'top'
    context.fillStyle = preset.palette.accentInk
    context.fillText(String(index + 1).padStart(2, '0'), badgeX + 22, edge.top - badge / 2 + 24)
    kickerLabel(context, preset, 'keep this', text.left, edge.top + 76, { color: 'rgba(0,0,0,0.5)' })
    kickerLabel(context, preset, `takeaway · ${String(index + 1).padStart(2, '0')}/${String(total).padStart(2, '0')}`, textSafeArea.right, edge.top + 76, { color: 'rgba(0,0,0,0.45)', align: 'right' })
    paintTextBlock(context, plan, preset.palette.ink)
    context.fillStyle = 'rgba(0, 0, 0, 0.2)'
    context.fillRect(text.left, Math.min(plan.blockBottom + 40, textSafeArea.bottom + 40), frame.maxWidth, 3)
  },

  'cta-stamp': (context, plan) => {
    const { preset, total } = plan
    const { text } = plan.composite
    // The stamp chip, bookmark glyph, and series footer are centred on the
    // composite rather than on the static frame, so the whole card travels
    // together when the copy is nudged sideways.
    const centerX = Math.round((text.left + text.right) / 2)
    context.fillStyle = `rgba(10, 10, 12, ${Math.min(0.85, 0.56 * preset.scrimBoost).toFixed(3)})`
    context.fillRect(0, 0, canvasSpec.width, canvasSpec.height)
    context.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    context.lineWidth = 3
    context.strokeRect(56, 56, canvasSpec.width - 112, canvasSpec.height - 112)
    context.strokeStyle = preset.palette.accent
    context.lineWidth = 8
    context.strokeRect(76, 76, canvasSpec.width - 152, canvasSpec.height - 152)
    context.save()
    context.translate(centerX, plan.blockTop - 120)
    context.rotate((-6 * Math.PI) / 180)
    context.fillStyle = preset.palette.accent
    context.fillRect(-170, -44, 340, 88)
    context.font = `${preset.kicker.weight} 34px ${preset.kicker.family}`
    context.textBaseline = 'top'
    context.fillStyle = preset.palette.accentInk
    const stamp = 'SAVE THIS'
    context.fillText(stamp, -context.measureText(stamp).width / 2, -18)
    context.restore()
    paintTextBlock(context, plan, '#ffffff')
    context.fillStyle = preset.palette.accent
    context.beginPath()
    context.moveTo(centerX - 26, plan.blockBottom + 54)
    context.lineTo(centerX + 26, plan.blockBottom + 54)
    context.lineTo(centerX + 26, plan.blockBottom + 130)
    context.lineTo(centerX, plan.blockBottom + 102)
    context.lineTo(centerX - 26, plan.blockBottom + 130)
    context.closePath()
    context.fill()
    kickerLabel(context, preset, `part ${String(total).padStart(2, '0')} of ${String(total).padStart(2, '0')} · follow for the next one`, centerX, textSafeArea.bottom - 30, { color: 'rgba(255,255,255,0.72)', align: 'center' })
  },
}

// Deterministic renderer: image, focal-aware crop, layout painter, grain.
export function composeSlide({ image, text, slide, direction, preset: presetInput, index = 0, total = 1, canvas = document.createElement('canvas') }) {
  const copy = clean(slide?.text ?? text)
  const role = slide?.role ?? 'setup'
  canvas.width = canvasSpec.width
  canvas.height = canvasSpec.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas composition is unavailable.')

  const preset = getPreset(presetInput?.id ?? presetInput)
  const measure = (value, size) => {
    setFont(context, preset, size)
    return context.measureText(value).width
  }
  const plan = layoutSlideText({ text: copy, role, direction, preset, measure, index, total, overlaySettings: slide?.overlay })

  const crop = cropBox(image, plan.direction.focalPoint)
  context.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, canvasSpec.width, canvasSpec.height)
  paintGrain(context, `${plan.layout}|${copy}|${index}`, preset.grainAlpha)

  const painter = painters[plan.layout] || painters['editorial-split']
  painter(context, plan)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not export composed slide.')), 'image/png', 0.94)
  })
}

export function loadImage(dataUrl, ImageCtor = Image) {
  return new Promise((resolve, reject) => {
    const image = new ImageCtor()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not load the generated image for composition.'))
    image.src = dataUrl
  })
}

export async function composeSlideDataUrl({ imageDataUrl, text, slide, direction, preset, index, total, canvas }) {
  const image = await loadImage(imageDataUrl)
  const blob = await composeSlide({ image, text, slide, direction, preset, index, total, canvas })
  return { blob, dataUrl: URL.createObjectURL(blob) }
}

// Grid contact sheet from already-composed slide images, for visual QA.
export function composeContactSheet({ items, title = 'Sequence contact sheet', scale = 0.24, canvas = document.createElement('canvas') }) {
  if (!items?.length) throw new Error('Contact sheet needs at least one composed slide.')
  const cellWidth = Math.round(canvasSpec.width * scale)
  const cellHeight = Math.round(canvasSpec.height * scale)
  const gap = 28
  const columns = Math.min(items.length, 5)
  const rows = Math.ceil(items.length / columns)
  const headerHeight = 96
  canvas.width = columns * cellWidth + gap * (columns + 1)
  canvas.height = headerHeight + rows * (cellHeight + 56) + gap
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas composition is unavailable.')
  context.fillStyle = '#111114'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.font = "700 34px 'Helvetica Neue', Arial, sans-serif"
  context.textBaseline = 'top'
  context.fillStyle = '#ffffff'
  context.fillText(title, gap, 34)
  items.forEach((item, itemIndex) => {
    const column = itemIndex % columns
    const row = Math.floor(itemIndex / columns)
    const x = gap + column * (cellWidth + gap)
    const y = headerHeight + row * (cellHeight + 56)
    context.drawImage(item.image, x, y, cellWidth, cellHeight)
    context.strokeStyle = 'rgba(255, 255, 255, 0.25)'
    context.lineWidth = 2
    context.strokeRect(x, y, cellWidth, cellHeight)
    context.font = "600 17px 'Helvetica Neue', Arial, sans-serif"
    context.fillStyle = 'rgba(255, 255, 255, 0.78)'
    context.fillText(String(item.label || `Slide ${itemIndex + 1}`).slice(0, Math.floor(cellWidth / 9)), x, y + cellHeight + 14)
  })
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not export the contact sheet.')), 'image/png', 0.92)
  })
}
