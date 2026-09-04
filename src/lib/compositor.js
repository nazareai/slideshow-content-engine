export const overlayLayout = Object.freeze({
  width: 1080,
  height: 1920,
  x: 88,
  maxTextWidth: 904,
  top: 260,
  bottom: 1680,
  minFontSize: 58,
  maxFontSize: 92,
  lineHeight: 1.08,
  maxLines: 6,
})

const clean = (value) => String(value ?? '').trim().replace(/\s+/g, ' ')

function wrapWords(text, fontSize, measure) {
  const words = clean(text).split(' ').filter(Boolean)
  const lines = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (measure(candidate, fontSize) <= overlayLayout.maxTextWidth) {
      line = candidate
    } else {
      if (!line || measure(word, fontSize) > overlayLayout.maxTextWidth) return null
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

export function fitOverlayText(text, measure) {
  const value = clean(text)
  if (!value) throw new Error('Slide text is required for image composition.')
  for (let fontSize = overlayLayout.maxFontSize; fontSize >= overlayLayout.minFontSize; fontSize -= 2) {
    const lines = wrapWords(value, fontSize, measure)
    if (lines && lines.length <= overlayLayout.maxLines) return { lines, fontSize, lineHeight: Math.round(fontSize * overlayLayout.lineHeight) }
  }
  throw new Error('Slide text is too long to remain readable on the image.')
}

function cropBox(image) {
  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height
  const sourceRatio = sourceWidth / sourceHeight
  const targetRatio = overlayLayout.width / overlayLayout.height
  if (sourceRatio > targetRatio) {
    const width = sourceHeight * targetRatio
    return { sx: (sourceWidth - width) / 2, sy: 0, sw: width, sh: sourceHeight }
  }
  const height = sourceWidth / targetRatio
  return { sx: 0, sy: (sourceHeight - height) / 2, sw: sourceWidth, sh: height }
}

export function composeSlide({ image, text, canvas = document.createElement('canvas') }) {
  canvas.width = overlayLayout.width
  canvas.height = overlayLayout.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas composition is unavailable.')
  const crop = cropBox(image)
  context.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, overlayLayout.width, overlayLayout.height)

  const measure = (line, size) => {
    context.font = `800 ${size}px Inter, Arial, sans-serif`
    return context.measureText(line).width
  }
  const fitted = fitOverlayText(text, measure)
  const blockHeight = fitted.lines.length * fitted.lineHeight
  const y = Math.min(overlayLayout.bottom - blockHeight, Math.max(overlayLayout.top, Math.round((overlayLayout.height - blockHeight) * 0.43)))
  const panelPadding = 54

  context.fillStyle = 'rgba(0, 0, 0, 0.68)'
  context.fillRect(overlayLayout.x - panelPadding, y - panelPadding, overlayLayout.maxTextWidth + panelPadding * 2, blockHeight + panelPadding * 2)
  context.font = `800 ${fitted.fontSize}px Inter, Arial, sans-serif`
  context.textBaseline = 'top'
  context.fillStyle = '#FFFFFF'
  context.shadowColor = 'rgba(0, 0, 0, 0.55)'
  context.shadowBlur = 14
  fitted.lines.forEach((line, index) => context.fillText(line, overlayLayout.x, y + index * fitted.lineHeight))

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

export async function composeSlideDataUrl({ imageDataUrl, text, canvas }) {
  const image = await loadImage(imageDataUrl)
  const blob = await composeSlide({ image, text, canvas })
  return { blob, dataUrl: URL.createObjectURL(blob) }
}
