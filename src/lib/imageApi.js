import { getImageStyle, resolveImageStyle } from './imageStyles'
import { mapWithConcurrency } from './concurrency'

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

// The selected style preset owns the entire medium-bearing content of the
// final provider prompt: the style directive (medium, subject grammar, scene,
// composition, texture, palette, negatives) opens the payload via the visual
// bible, and the style's own negative constraints are repeated verbatim as the
// closing hard-constraint block. Every line this wrapper contributes itself is
// medium-neutral logistics (subject, audience, role, scene hand-off, 9:16
// framing) — it must never reintroduce photography, 3D, or render language,
// or every preset drifts back toward one shared look. The only universal ban
// is lettering, because the approved slide text is composited locally.
export function buildImagePrompt(slide, project = {}, visualBible, styleSelection) {
  const subject = clean(project.topic) || clean(project.title) || 'the story subject'
  const audience = clean(project.audience) || 'a broad social audience'
  const direction = clean(slide?.visual)
  const style = resolveImageStyle(styleSelection)
  const bible = visualBible || buildVisualBible(project, style)
  const negative = getImageStyle(style.id)?.directive?.negative || ''

  return [
    'Create one full-bleed vertical frame for a TikTok slideshow.',
    bible,
    `Frame purpose: ${clean(slide?.role)}.`,
    `Scene direction: ${direction}.`,
    `Story subject: ${subject}.`,
    `Audience context: ${audience}.`,
    'Render the frame strictly in the medium the style directive defines — if the style is drawn, printed, cut from paper, pixelated, sculpted, or meme-native, do not fall back to generic photography or 3D rendering.',
    'Aspect ratio 9:16, full-bleed vertical frame, one strong focal point, and clear text-safe negative space left for a short text overlay in the upper-middle area.',
    'Keep the exact same styled treatment a complete slideshow series could use.',
    'No typography, lettering, captions, subtitles, logos, watermarks, or brand marks anywhere in the image.',
    negative ? `Final hard constraints for this ${style.name} frame — ${negative}` : '',
  ].filter(Boolean).join(' ')
}

export function parseImageResponse(result) {
  const item = result?.data?.[0]
  if (!item?.b64_json) throw new Error('OpenRouter returned no image data.')
  const mediaType = clean(item.media_type) || 'image/png'
  return { dataUrl: `data:${mediaType};base64,${item.b64_json}`, mediaType, cost: result?.usage?.cost ?? null }
}

const cancelledError = () => Object.assign(new Error('Image generation was cancelled before this frame finished.'), { cancelled: true })

// `signal` is an optional external AbortSignal (user cancellation) that
// composes with the internal per-request timeout: either one aborts the fetch,
// and the error message distinguishes a timeout from a cancellation.
export async function generateImage({ apiKey, prompt, model = DEFAULT_IMAGE_MODEL, fetchImpl = fetch, timeoutMs = 120000, signal }) {
  if (!clean(apiKey)) throw new Error('Add an OpenRouter API key first.')
  if (!clean(prompt)) throw new Error('Image prompt is empty.')
  if (signal?.aborted) throw cancelledError()

  const controller = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
  const onExternalAbort = () => controller.abort()
  signal?.addEventListener('abort', onExternalAbort)
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
    if (error?.name === 'AbortError') {
      if (timedOut) throw new Error('Image generation timed out. Completed slides were preserved; retry the missing frame.')
      throw cancelledError()
    }
    throw error
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', onExternalAbort)
  }

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Image generation failed (${response.status}): ${detail.slice(0, 240)}`)
  }

  return parseImageResponse(await response.json())
}

// Bounded parallelism for a whole slide set. Three concurrent requests is a
// deliberate ceiling for a single-user OpenRouter key: enough to overlap the
// long per-image latency, small enough to stay clear of per-key rate limits.
export const IMAGE_GENERATION_CONCURRENCY = 3

// Freeze every frame's exact provider prompt up front (one shared visual bible
// per run) so callers can diff against previously billed prompts and skip
// frames that are already current — no duplicate paid calls for unchanged art.
export function planImagePrompts({ slides = [], project = {}, styleSelection }) {
  const style = resolveImageStyle(styleSelection)
  const bible = buildVisualBible(project, style)
  return slides.map((slide, index) => ({ slide, slideId: slide.id, index, prompt: buildImagePrompt(slide, project, bible, style) }))
}

// Generate every planned frame with bounded parallelism. Returns one entry per
// plan, in plan order regardless of completion order:
//   { status: 'fulfilled', slideId, index, prompt, dataUrl, mediaType, cost }
//   { status: 'rejected',  slideId, index, prompt, reason }
//   { status: 'cancelled', slideId, index, prompt }   — never dispatched
// Each plan is dispatched exactly once; a frame failure never aborts the rest.
// `onFrame` is awaited per finished frame (progressive compositing/state) and
// an onFrame throw marks that frame rejected.
export async function generateSlideImages({ plans = [], apiKey, model = DEFAULT_IMAGE_MODEL, concurrency = IMAGE_GENERATION_CONCURRENCY, signal, fetchImpl = fetch, generateImpl = generateImage, onFrame }) {
  const settled = await mapWithConcurrency(plans, async (plan) => {
    const image = await generateImpl({ apiKey, prompt: plan.prompt, model, fetchImpl, signal })
    const frame = { slideId: plan.slideId, index: plan.index, prompt: plan.prompt, ...image }
    if (onFrame) await onFrame(frame, plan)
    return frame
  }, { concurrency, signal })

  return settled.map((entry, position) => {
    const plan = plans[position]
    const base = { slideId: plan.slideId, index: plan.index, prompt: plan.prompt }
    if (entry.status === 'fulfilled') return { ...base, ...entry.value, status: 'fulfilled' }
    if (entry.status === 'rejected' && !entry.reason?.cancelled) return { ...base, status: 'rejected', reason: entry.reason }
    return { ...base, status: 'cancelled' }
  })
}

export function imageExtension(mediaType = 'image/png') {
  if (mediaType.includes('jpeg') || mediaType.includes('jpg')) return 'jpg'
  if (mediaType.includes('webp')) return 'webp'
  return 'png'
}
