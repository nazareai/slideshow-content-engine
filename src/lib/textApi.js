import { LAYOUT_IDS, LAYOUTS, planDirections } from './artDirection'
import { storySceneBrief } from './imageStyles'

const TEXT_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
export const DEFAULT_TEXT_MODEL = 'openai/gpt-5.6-luna'

const clean = (value) => String(value ?? '').trim()
const likelyFitsOverlay = (value) => {
  const words = clean(value).split(/\s+/).filter(Boolean)
  return words.length >= 4 && words.length <= 16 && clean(value).length <= 110 && words.every((word) => word.length <= 24)
}

function storySchema(slideCount) {
  return {
    name: 'slideshow_story',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['hooks', 'selectedHook', 'slides', 'caption'],
      properties: {
        hooks: {
          type: 'array', minItems: 5, maxItems: 10,
          items: { type: 'object', additionalProperties: false, required: ['text', 'score'], properties: { text: { type: 'string' }, score: { type: 'integer', minimum: 0, maximum: 100 } } },
        },
        selectedHook: { type: 'string' },
        slides: {
          type: 'array', minItems: slideCount, maxItems: slideCount,
          items: {
            type: 'object', additionalProperties: false,
            required: ['role', 'text', 'visual', 'layout', 'emphasis', 'focalPoint'],
            properties: {
              role: { type: 'string' },
              text: { type: 'string' },
              visual: { type: 'string' },
              layout: { type: 'string', enum: [...LAYOUT_IDS] },
              emphasis: { type: 'string' },
              focalPoint: {
                type: 'object', additionalProperties: false, required: ['x', 'y'],
                properties: { x: { type: 'number', minimum: 0, maximum: 1 }, y: { type: 'number', minimum: 0, maximum: 1 } },
              },
            },
          },
        },
        caption: { type: 'string' },
      },
    },
  }
}

function extractContent(result) {
  const content = result?.choices?.[0]?.message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map((part) => part?.text || '').join('')
  return ''
}

export function parseStoryResponse(result, slideCount) {
  const raw = extractContent(result)
  let story
  try { story = JSON.parse(raw) } catch { throw new Error('OpenRouter returned invalid story JSON.') }
  const validHooks = Array.isArray(story?.hooks) && story.hooks.length >= 5 && story.hooks.length <= 10 && story.hooks.every((hook) => clean(hook?.text) && Number.isInteger(hook?.score) && hook.score >= 0 && hook.score <= 100)
  const validSlides = Array.isArray(story?.slides) && story.slides.length === slideCount && story.slides.every((slide) => clean(slide?.role) && likelyFitsOverlay(slide?.text) && clean(slide?.visual))
  const bestHook = validHooks ? story.hooks.reduce((best, hook) => hook.score > best.score ? hook : best) : null
  const complete = validHooks && clean(story.selectedHook) === clean(bestHook?.text) && validSlides && clean(story.caption)
  if (!complete) throw new Error(`OpenRouter did not return a complete story with exactly ${slideCount} slides.`)
  const slides = story.slides.map((slide, index) => ({
    id: index + 1, role: clean(slide.role), text: clean(slide.text), visual: clean(slide.visual),
    direction: { layout: slide.layout, emphasis: slide.emphasis, focalPoint: slide.focalPoint },
  }))
  const directions = planDirections(slides)
  return {
    hooks: story.hooks.map((hook) => ({ text: clean(hook.text), score: Number(hook.score) || 0 })),
    selectedHook: clean(story.selectedHook),
    slides: slides.map((slide, index) => ({ ...slide, direction: directions[index] })),
    caption: clean(story.caption),
  }
}

export async function generateStory({ apiKey, model = DEFAULT_TEXT_MODEL, topic, audience, angle, observation, source, slideCount = 5, imageStyle, fetchImpl = fetch, timeoutMs = 90000 }) {
  if (!clean(apiKey)) throw new Error('Add your OpenRouter API key before generating text.')
  if (!clean(model)) throw new Error('Add an OpenRouter text model.')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  let response
  try {
    response = await fetchImpl(TEXT_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${clean(apiKey)}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': typeof window === 'undefined' ? 'http://localhost' : window.location.origin,
      'X-Title': 'Slideshow Content Engine',
    },
    body: JSON.stringify({
      model: clean(model),
      temperature: 0.75,
      messages: [
        {
          role: 'system',
          content: `You write evidence-grounded TikTok slideshow stories and art-direct every frame. Generate distinct hooks, score them for curiosity, specificity, credibility, and visual potential, select the strongest, and write exactly ${slideCount} frames. Each frame must contain one idea, no paragraph, normally 4-16 words, and create a reason to swipe. Use a Hook, Context, Tension, Evidence, Shift, Payoff, CTA arc as space permits. Never invent facts beyond the supplied observation. ${storySceneBrief(imageStyle)} Per frame also return art-direction metadata: "layout" chosen from ${LAYOUT_IDS.join(', ')} to match the frame's narrative job (${LAYOUT_IDS.map((id) => `${id} = ${LAYOUTS[id].role}`).join(', ')}); "emphasis" — the single most loaded word copied verbatim from that frame's text; "focalPoint" — where the described scene's subject sits in the 9:16 frame as {x, y} fractions from top-left, so the overlay can avoid it. Vary layouts across the sequence; never use the same layout twice in a row. Return only schema-valid JSON.`,
        },
        {
          role: 'user',
          content: `Topic: ${clean(topic)}\nAudience: ${clean(audience)}\nStarting hook or tension: ${clean(angle)}\nObserved evidence: ${clean(observation)}\nSource: ${clean(source)}\nFrames: ${slideCount}`,
        },
      ],
      response_format: { type: 'json_schema', json_schema: storySchema(slideCount) },
    }),
    signal: controller.signal,
  })
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('OpenRouter text generation timed out. Retry when the connection is stable.')
    throw error
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`OpenRouter text generation failed (${response.status})${detail ? `: ${detail.slice(0, 240)}` : '.'}`)
  }
  return parseStoryResponse(await response.json(), slideCount)
}
