import { resolveImageStyle } from './imageStyles'

const IMAGE_ENDPOINT = 'https://openrouter.ai/api/v1/images'
export const DEFAULT_IMAGE_MODEL = 'meta/muse-image'

const clean = (value) => String(value ?? '').trim()

// The visual bible is the per-series continuity contract embedded in every
// frame's prompt. The selected image style supplies the entire look — medium,
// subject grammar, scene, composition, texture, palette, and negatives.
export function buildVisualBible(project = {}, styleSelection) {
  const subject = clean(project.topic) || clean(project.title) || 'the story subject'
  const audience = clean(project.audience) || 'a broad social audience'
  const style = resolveImageStyle(styleSelection)
  return `Series continuity: one ${style.name}-styled vertical slideshow series about ${subject} for ${audience}. ${style.directive} Hold this exact medium and treatment with consistent visual density and palette across every frame.`
}

// Style-specific negatives live inside each style directive ("Avoid: …"), so
// the only universal bans here are the ones the compositor depends on — the
// approved slide text is rendered locally, so the model must never letter the
// image itself.
export function buildImagePrompt(slide, project = {}, visualBible, styleSelection) {
  const subject = clean(project.topic) || clean(project.title) || 'the story subject'
  const audience = clean(project.audience) || 'a broad social audience'
  const direction = clean(slide?.visual)
  const bible = visualBible || buildVisualBible(project, styleSelection)

  return [
    'Create one full-bleed vertical frame for a TikTok slideshow.',
    `Story subject: ${subject}.`,
    `Audience context: ${audience}.`,
    `Frame purpose: ${clean(slide?.role)}.`,
    `Scene direction: ${direction}.`,
    bible,
    'Render the frame strictly in the medium the style directive defines — if the style is illustrated, rendered, or meme-native, do not fall back to generic photography.',
    'Aspect ratio 9:16, full-bleed vertical frame, one strong focal point, and clear text-safe negative space left for a short text overlay in the upper-middle area.',
    'Keep the exact same styled treatment a complete slideshow series could use.',
    'No typography, lettering, captions, subtitles, logos, watermarks, or brand marks anywhere in the image.',
  ].join(' ')
}

export function parseImageResponse(result) {
  const item = result?.data?.[0]
  if (!item?.b64_json) throw new Error('OpenRouter returned no image data.')
  const mediaType = clean(item.media_type) || 'image/png'
  return { dataUrl: `data:${mediaType};base64,${item.b64_json}`, mediaType, cost: result?.usage?.cost ?? null }
}

export async function generateImage({ apiKey, prompt, model = DEFAULT_IMAGE_MODEL, fetchImpl = fetch, timeoutMs = 120000 }) {
  if (!clean(apiKey)) throw new Error('Add an OpenRouter API key first.')
  if (!clean(prompt)) throw new Error('Image prompt is empty.')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  let response
  try {
    response = await fetchImpl(IMAGE_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': globalThis.location?.origin || 'http://localhost',
      'X-Title': 'Slideshow Content Engine',
    },
    body: JSON.stringify({ model, prompt }),
    signal: controller.signal,
  })
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Image generation timed out. Completed slides were preserved; retry the missing frame.')
    throw error
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Image generation failed (${response.status}): ${detail.slice(0, 240)}`)
  }

  return parseImageResponse(await response.json())
}

export function imageExtension(mediaType = 'image/png') {
  if (mediaType.includes('jpeg') || mediaType.includes('jpg')) return 'jpg'
  if (mediaType.includes('webp')) return 'webp'
  return 'png'
}
