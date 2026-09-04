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
          items: { type: 'object', additionalProperties: false, required: ['role', 'text', 'visual'], properties: { role: { type: 'string' }, text: { type: 'string' }, visual: { type: 'string' } } },
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
  return {
    hooks: story.hooks.map((hook) => ({ text: clean(hook.text), score: Number(hook.score) || 0 })),
    selectedHook: clean(story.selectedHook),
    slides: story.slides.map((slide, index) => ({ id: index + 1, role: clean(slide.role), text: clean(slide.text), visual: clean(slide.visual) })),
    caption: clean(story.caption),
  }
}

export async function generateStory({ apiKey, model = DEFAULT_TEXT_MODEL, topic, audience, angle, observation, source, slideCount = 5, fetchImpl = fetch, timeoutMs = 90000 }) {
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
          content: `You write evidence-grounded TikTok slideshow stories. Generate distinct hooks, score them for curiosity, specificity, credibility, and visual potential, select the strongest, and write exactly ${slideCount} frames. Each frame must contain one idea, no paragraph, normally 4-16 words, and create a reason to swipe. Use a Hook, Context, Tension, Evidence, Shift, Payoff, CTA arc as space permits. Never invent facts beyond the supplied observation. Every visual direction must describe one concrete photorealistic vertical scene with negative space for an overlay. Return only schema-valid JSON.`,
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
