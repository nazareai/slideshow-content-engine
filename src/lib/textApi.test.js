import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_TEXT_MODEL, generateStory, parseStoryResponse } from './textApi'

const validStory = {
  hooks: [
    { text: 'I automated distribution before the content deserved it', score: 94 },
    { text: 'The pipeline worked. The posts still failed.', score: 89 },
    { text: 'Automation exposed the weak part of my content system', score: 87 },
    { text: 'The drafts shipped faster than anyone wanted them', score: 84 },
    { text: 'My publishing bottleneck was never publishing', score: 82 },
  ],
  selectedHook: 'I automated distribution before the content deserved it',
  slides: [
    { role: 'Hook', text: 'I automated distribution before the content deserved it', visual: 'Founder looking at an empty analytics dashboard at night' },
    { role: 'Context', text: 'The pipeline shipped every draft on time.', visual: 'Automated conveyor moving identical paper sheets' },
    { role: 'Tension', text: 'Nobody wanted to save any of them.', visual: 'Phone screen with flat save activity beside discarded notes' },
    { role: 'Evidence', text: 'Publishing worked. Taste was the bottleneck.', visual: 'Two labeled workshop stations, one moving and one stalled' },
    { role: 'Shift', text: 'So I stopped scaling output.', visual: 'Hand switching off a large production machine' },
    { role: 'Payoff', text: 'Now every idea must earn distribution.', visual: 'Single marked card passing through a quality gate' },
  ],
  caption: 'Distribution cannot rescue weak content. Build the taste loop first.'
}

describe('OpenRouter text generation', () => {
  it('defaults to the requested GPT-5.6 Luna model and returns a complete story', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(validStory) } }] }),
    })

    const story = await generateStory({
      apiKey: 'test-key', model: DEFAULT_TEXT_MODEL, topic: 'content automation', audience: 'founders',
      angle: validStory.selectedHook, observation: 'The pipe worked but drafts were weak.', source: 'Build notes', slideCount: 6, fetchImpl,
    })

    expect(DEFAULT_TEXT_MODEL).toBe('openai/gpt-5.6-luna')
    expect(story.slides).toHaveLength(6)
    expect(fetchImpl).toHaveBeenCalledWith('https://openrouter.ai/api/v1/chat/completions', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('openai/gpt-5.6-luna'),
    }))
  })

  it('rejects malformed output instead of silently using incomplete slides', () => {
    expect(() => parseStoryResponse({ choices: [{ message: { content: '{"slides":[]}' } }] }, 6)).toThrow('complete story')
  })

  it('rejects too few hooks, invalid scores, and paragraph-sized slide copy', () => {
    expect(() => parseStoryResponse({ choices: [{ message: { content: JSON.stringify({ ...validStory, hooks: validStory.hooks.slice(0, 2) }) } }] }, 6)).toThrow('complete story')
    const badScore = { ...validStory, hooks: Array.from({ length: 5 }, (_, index) => ({ text: `Hook ${index}`, score: index === 0 ? 101 : 80 })) }
    expect(() => parseStoryResponse({ choices: [{ message: { content: JSON.stringify(badScore) } }] }, 6)).toThrow('complete story')
    const paragraph = { ...validStory, hooks: Array.from({ length: 5 }, (_, index) => ({ text: `Hook ${index}`, score: 80 })), slides: validStory.slides.map((slide, index) => index ? slide : { ...slide, text: Array.from({ length: 20 }, () => 'word').join(' ') }) }
    expect(() => parseStoryResponse({ choices: [{ message: { content: JSON.stringify(paragraph) } }] }, 6)).toThrow('complete story')
    const wide = { ...validStory, slides: validStory.slides.map((slide, index) => index ? slide : { ...slide, text: Array.from({ length: 16 }, () => 'abcdefghijklmnopqrstuvwx').join(' ') }) }
    expect(() => parseStoryResponse({ choices: [{ message: { content: JSON.stringify(wide) } }] }, 6)).toThrow('complete story')
  })

  it('rejects a selected hook that is not the highest-scoring returned hook', () => {
    const wrong = { ...validStory, selectedHook: validStory.hooks[1].text }
    expect(() => parseStoryResponse({ choices: [{ message: { content: JSON.stringify(wrong) } }] }, 6)).toThrow('complete story')
  })

  it('times out stalled requests with a retryable error', async () => {
    const fetchImpl = vi.fn((_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))))
    await expect(generateStory({ apiKey: 'test-key', model: DEFAULT_TEXT_MODEL, slideCount: 6, timeoutMs: 1, fetchImpl })).rejects.toThrow('timed out')
  })

  it('refuses a missing API key before network access', async () => {
    const fetchImpl = vi.fn()
    await expect(generateStory({ apiKey: '', model: DEFAULT_TEXT_MODEL, slideCount: 6, fetchImpl })).rejects.toThrow('API key')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
