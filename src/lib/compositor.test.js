import { describe, expect, it, vi } from 'vitest'
import { composeSlide, fitOverlayText, overlayLayout } from './compositor'

describe('slide compositor', () => {
  it('wraps short copy into readable lines inside the manual safe margins', () => {
    const measure = (text, size) => text.length * size * 0.52
    const fitted = fitOverlayText('Publishing worked. Taste was the bottleneck.', measure)
    expect(fitted.fontSize).toBeGreaterThanOrEqual(58)
    expect(fitted.lines.length).toBeGreaterThan(1)
    expect(fitted.lines.every((line) => measure(line, fitted.fontSize) <= overlayLayout.maxTextWidth)).toBe(true)
    expect(overlayLayout.x).toBeGreaterThanOrEqual(80)
    expect(overlayLayout.bottom).toBeLessThanOrEqual(1740)
  })

  it('rejects paragraph-sized copy that cannot remain readable', () => {
    const longCopy = Array.from({ length: 90 }, (_, index) => `word${index}`).join(' ')
    expect(() => fitOverlayText(longCopy, (text, size) => text.length * size * 0.5)).toThrow('too long')
  })

  it('draws the image, contrast panel, and every text line before exporting PNG', async () => {
    const calls = []
    const context = {
      drawImage: (...args) => calls.push(['drawImage', ...args]),
      fillRect: (...args) => calls.push(['fillRect', ...args]),
      fillText: (...args) => calls.push(['fillText', ...args]),
      measureText: (text) => ({ width: text.length * 40 }),
      set fillStyle(value) { calls.push(['fillStyle', value]) },
      set font(value) { calls.push(['font', value]) },
      set textBaseline(value) { calls.push(['textBaseline', value]) },
      set shadowColor(value) { calls.push(['shadowColor', value]) },
      set shadowBlur(value) { calls.push(['shadowBlur', value]) },
    }
    const canvas = { width: 0, height: 0, getContext: () => context, toBlob: (callback) => callback(new Blob(['png'], { type: 'image/png' })) }
    const image = { naturalWidth: 1080, naturalHeight: 1920 }
    const blob = await composeSlide({ image, text: 'The pipeline worked. The posts still failed.', canvas })

    expect(blob.type).toBe('image/png')
    expect(canvas.width).toBe(1080)
    expect(canvas.height).toBe(1920)
    expect(calls.some(([name]) => name === 'drawImage')).toBe(true)
    expect(calls.some(([name]) => name === 'fillRect')).toBe(true)
    expect(calls.filter(([name]) => name === 'fillText').length).toBeGreaterThan(0)
  })
})
