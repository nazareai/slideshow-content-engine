import { useMemo, useRef, useState } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import JSZip from 'jszip'
import { Check, Clipboard, Download, Grid3x3, Lightbulb, Plus, Sparkles, Trash2 } from 'lucide-react'
import { cn } from './lib/cn'
import { computeExportReadiness, ensureZipFilename, isRenderCurrent, makeSlides, runQualityGate, scoreIdea, toMarkdown } from './lib/engine'
import { DEFAULT_IMAGE_MODEL, generateSlideImages, IMAGE_GENERATION_CONCURRENCY, planImagePrompts } from './lib/imageApi'
import { composeContactSheet, composeSlideDataUrl, loadImage } from './lib/compositor'
import { DEFAULT_PRESET_ID, getPreset, STYLE_PRESETS } from './lib/artDirection'
import { CUSTOM_STYLE_PLACEHOLDER, DEFAULT_IMAGE_STYLE_ID, getImageStyle, IMAGE_STYLE_GROUPS, resolveImageStyle, stylesInGroup } from './lib/imageStyles'
import { DEFAULT_TEXT_MODEL, generateStory } from './lib/textApi'

const starterIdeas = [
  { id: crypto.randomUUID(), hook: 'I published 30 posts before noticing the only metric that mattered', angle: 'Activity versus signal', observation: 'Saves stayed flat while posting volume tripled.', source: 'Personal content log', visualPotential: 5, novelty: 4 },
  { id: crypto.randomUUID(), hook: 'The SEO advice that quietly kills a new domain', angle: 'Premature scale', observation: 'Publishing more pages created crawl noise before any topic earned traction.', source: 'SEO operating notes', visualPotential: 4, novelty: 5 },
]

const templates = [
  ['Contrarian lesson', 'The accepted advice that failed in practice'],
  ['Before / after', 'One changed variable and the result it produced'],
  ['Mini teardown', 'Show the weak version, then rebuild it'],
  ['Field note', 'A concrete observation from work done today'],
]

function Button({ children, className, variant = 'primary', ...props }) {
  return <button className={cn('focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-45', variant === 'primary' ? 'bg-ink text-white hover:bg-black/80' : 'border border-black/20 bg-white text-ink hover:bg-black/5', className)} {...props}>{children}</button>
}

function Score({ value }) {
  const tone = value >= 80 ? 'bg-moss' : value >= 65 ? 'bg-amber-100' : 'bg-red-100'
  return <span className={cn('rounded-md px-2 py-1 text-sm font-bold tabular-nums', tone)}>{value}/100</span>
}

function App() {
  const [ideas, setIdeas] = useState(starterIdeas)
  const [topic, setTopic] = useState('building an autonomous content engine')
  const [audience, setAudience] = useState('solo founders')
  const [angle, setAngle] = useState('I kept trying to automate distribution before the content deserved it')
  const [observation, setObservation] = useState('The publishing pipe worked, but the generic drafts were not worth publishing.')
  const [source, setSource] = useState('Internal build notes')
  const [slideCount, setSlideCount] = useState(5)
  const [slides, setSlides] = useState(() => makeSlides({ topic, audience, angle, observation, slideCount }))
  const [caption, setCaption] = useState('Distribution cannot rescue weak content. Build the taste loop first, then automate the pipe.')
  const [notice, setNotice] = useState('')
  const [exporting, setExporting] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [textModel, setTextModel] = useState(DEFAULT_TEXT_MODEL)
  const [imageModel, setImageModel] = useState(DEFAULT_IMAGE_MODEL)
  const [generatingText, setGeneratingText] = useState(false)
  const [generatingImages, setGeneratingImages] = useState(false)
  const [stylePreset, setStylePreset] = useState(DEFAULT_PRESET_ID)
  const [imageStyleId, setImageStyleId] = useState(DEFAULT_IMAGE_STYLE_ID)
  const [customStyleText, setCustomStyleText] = useState('')
  const [images, setImages] = useState({})
  const [reviewedSlides, setReviewedSlides] = useState({})
  const imageAbortRef = useRef(null)
  const imageStyle = useMemo(() => resolveImageStyle({ styleId: imageStyleId, customText: customStyleText }), [imageStyleId, customStyleText])
  const briefKey = JSON.stringify({ topic, audience, angle, observation, source, slideCount })
  const [generatedBriefKey, setGeneratedBriefKey] = useState(briefKey)
  const stale = briefKey !== generatedBriefKey
  const project = useMemo(() => ({ title: angle || topic, audience, observation, source, slides, caption, stale, imageStyle }), [angle, topic, audience, observation, source, slides, caption, stale, imageStyle])
  const gate = useMemo(() => runQualityGate(project), [project])
  const readiness = useMemo(
    () => computeExportReadiness({ slides, gate, images, reviewed: reviewedSlides, presetId: stylePreset, styleDirective: imageStyle.directive }),
    [slides, gate, images, reviewedSlides, stylePreset, imageStyle],
  )

  function generate() {
    setSlides(makeSlides({ topic, audience, angle, observation, slideCount }))
    setGeneratedBriefKey(briefKey)
    setImages({})
    setReviewedSlides({})
    setNotice('Local structure regenerated. Use AI story for model-written hooks, slides, and caption.')
  }

  async function generateAiStory() {
    if (!apiKey.trim() || generatingText) {
      setNotice('Add your OpenRouter API key to generate the story.')
      return
    }
    setGeneratingText(true)
    setNotice(`Generating hooks and a complete story with ${textModel}…`)
    try {
      const story = await generateStory({ apiKey, model: textModel, topic, audience, angle, observation, source, slideCount, imageStyle })
      setAngle(story.selectedHook)
      setSlides(story.slides)
      setCaption(story.caption)
      setImages({})
      setReviewedSlides({})
      setGeneratedBriefKey(JSON.stringify({ topic, audience, angle: story.selectedHook, observation, source, slideCount }))
      setNotice(`Story generated with ${textModel}. Best hook selected from ${story.hooks.length} candidates. Review it, then generate composed images.`)
    } catch (error) {
      setNotice(error.message || 'Text generation failed. The existing draft was kept.')
    } finally {
      setGeneratingText(false)
    }
  }

  function useIdea(idea) {
    setAngle(idea.hook); setTopic(idea.angle); setObservation(idea.observation); setSource(idea.source)
    setNotice('Idea moved into Studio. Regenerate the draft to use it.')
  }

  function updateSlide(id, field, value) {
    setSlides((current) => current.map((slide) => slide.id === id ? { ...slide, [field]: value } : slide))
    if (field === 'visual') setImages((current) => {
      const previous = current[id]
      if (previous?.composedUrl) URL.revokeObjectURL(previous.composedUrl)
      const next = { ...current }; delete next[id]; return next
    })
    if (field === 'text') setImages((current) => {
      const previous = current[id]
      if (!previous) return current
      if (previous.composedUrl) URL.revokeObjectURL(previous.composedUrl)
      const { composedBlob, composedUrl, renderedText, renderedVisual, renderedPreset, renderedLayout, ...raw } = previous
      return { ...current, [id]: raw }
    })
    if (field === 'visual' || field === 'text') setReviewedSlides((current) => { const next = { ...current }; delete next[id]; return next })
  }

  // Re-render overlays locally from stored raw images — no new image credits.
  async function recomposeOverlays(presetId = stylePreset) {
    const pending = slides.filter((slide) => images[slide.id]?.dataUrl)
    if (!pending.length || generatingImages || generatingText) return
    setGeneratingImages(true)
    setReviewedSlides({})
    setNotice(`Re-rendering overlays in the ${getPreset(presetId).name} style…`)
    try {
      const next = { ...images }
      for (const slide of pending) {
        const index = slides.findIndex((entry) => entry.id === slide.id)
        const composed = await composeSlideDataUrl({ imageDataUrl: next[slide.id].dataUrl, slide, direction: slide.direction, preset: presetId, index, total: slides.length })
        if (next[slide.id].composedUrl) URL.revokeObjectURL(next[slide.id].composedUrl)
        next[slide.id] = { ...next[slide.id], composedBlob: composed.blob, composedUrl: composed.dataUrl, renderedText: slide.text, renderedVisual: slide.visual, renderedPreset: presetId, renderedLayout: slide.direction?.layout }
        setImages({ ...next })
      }
      setNotice(`Overlays re-rendered in the ${getPreset(presetId).name} style. Review and approve every frame again before export.`)
    } catch (error) {
      setNotice(error.message || 'Overlay re-render failed. Existing frames were kept.')
    } finally {
      setGeneratingImages(false)
    }
  }

  function changePreset(presetId) {
    if (presetId === stylePreset) return
    setStylePreset(presetId)
    setReviewedSlides({})
    recomposeOverlays(presetId)
  }

  // Image style is chosen before generation. Unlike the slide design preset it
  // shapes the generated photograph itself, so switching after generating only
  // marks frames stale — it never silently spends image credits.
  function changeImageStyle(styleId) {
    if (styleId === imageStyleId) return
    setImageStyleId(styleId)
    const hasFrames = slides.some((slide) => images[slide.id]?.dataUrl)
    const name = getImageStyle(styleId).name
    setNotice(hasFrames
      ? `Image style set to ${name}. Existing frames and visual directions keep the previous style — regenerate the AI story and images to apply it. Export stays blocked until every frame matches the selected style.`
      : `Image style set to ${name}. It will shape the story's visual directions and every image prompt when you generate.`)
  }

  // Store one finished frame (raw provider result + locally composed overlay)
  // via a functional update: parallel frames land in any order and must never
  // clobber each other through a stale closure.
  function storeFrame(slideId, slide, frame, composed) {
    setImages((current) => {
      const previous = current[slideId]
      if (previous?.composedUrl) URL.revokeObjectURL(previous.composedUrl)
      return {
        ...current,
        [slideId]: {
          ...(frame ? { dataUrl: frame.dataUrl, mediaType: frame.mediaType, cost: frame.cost, prompt: frame.prompt } : previous),
          renderedStyleId: imageStyle.id, renderedStyleDirective: imageStyle.directive,
          composedBlob: composed.blob, composedUrl: composed.dataUrl,
          renderedText: slide.text, renderedVisual: slide.visual, renderedPreset: stylePreset, renderedLayout: slide.direction?.layout,
        },
      }
    })
  }

  async function generateImages() {
    if (!apiKey.trim() || generatingImages) {
      setNotice('Add your OpenRouter API key to generate real images.')
      return
    }
    setGeneratingImages(true)
    setReviewedSlides({})
    const controller = new AbortController()
    imageAbortRef.current = controller
    const startedAt = performance.now()
    try {
      // Every frame's exact provider prompt is planned up front. Frames whose
      // stored raw image already came from the identical prompt are reused
      // (recomposed locally if the overlay is stale) instead of re-billed;
      // if every frame is current, the click is an explicit full re-roll.
      const plans = planImagePrompts({ slides, project: { topic, title: angle, audience }, styleSelection: imageStyle })
      const isCurrentRaw = (plan) => Boolean(images[plan.slideId]?.dataUrl && images[plan.slideId].prompt === plan.prompt)
      const allCurrent = plans.every(isCurrentRaw)
      const targets = allCurrent ? plans : plans.filter((plan) => !isCurrentRaw(plan))
      const reused = allCurrent ? [] : plans.filter(isCurrentRaw)
      setNotice(`Generating ${targets.length} of ${slides.length} frames in parallel (up to ${IMAGE_GENERATION_CONCURRENCY} at once) in the ${imageStyle.name} style…${reused.length ? ` ${reused.length} unchanged ${reused.length === 1 ? 'frame is' : 'frames are'} reused without new image credits.` : ''}`)

      for (const plan of reused) {
        const slide = slides[plan.index]
        if (isRenderCurrent(slide, images[plan.slideId], stylePreset, imageStyle.directive)) continue
        const composed = await composeSlideDataUrl({ imageDataUrl: images[plan.slideId].dataUrl, slide, direction: slide.direction, preset: stylePreset, index: plan.index, total: slides.length })
        storeFrame(plan.slideId, slide, null, composed)
      }

      const results = await generateSlideImages({
        plans: targets, apiKey, model: imageModel, signal: controller.signal,
        onFrame: async (frame) => {
          const slide = slides[frame.index]
          const composed = await composeSlideDataUrl({ imageDataUrl: frame.dataUrl, slide, direction: slide.direction, preset: stylePreset, index: frame.index, total: slides.length })
          storeFrame(frame.slideId, slide, frame, composed)
        },
      })

      const finished = results.filter((result) => result.status === 'fulfilled')
      const failed = results.filter((result) => result.status === 'rejected')
      const cancelled = results.filter((result) => result.status === 'cancelled')
      const seconds = ((performance.now() - startedAt) / 1000).toFixed(1)
      if (cancelled.length) {
        setNotice(`Image generation cancelled. ${finished.length} finished ${finished.length === 1 ? 'frame was' : 'frames were'} kept; ${cancelled.length} ${cancelled.length === 1 ? 'frame was' : 'frames were'} stopped without billing (slides ${cancelled.map((entry) => entry.slideId).join(', ')}). Generate again to finish only the missing frames.`)
      } else if (failed.length) {
        const firstReason = failed[0].reason?.message || 'Unknown error'
        setNotice(`${failed.length} of ${results.length} frames failed — slide${failed.length === 1 ? '' : 's'} ${failed.map((entry) => entry.slideId).join(', ')} (first error: ${firstReason}). ${finished.length} completed ${finished.length === 1 ? 'frame was' : 'frames were'} kept. Generate again to retry only the failed frames; export stays blocked until every frame is finished.`)
      } else {
        setNotice(`${slides.length} finished slides ready in the ${imageStyle.name} image style — ${targets.length} generated in parallel in ${seconds}s${reused.length ? `, ${reused.length} reused` : ''}. Review and approve every frame before export.`)
      }
    } catch (error) {
      setNotice(error.message || 'Image generation failed. Previously generated frames were kept.')
    } finally {
      imageAbortRef.current = null
      setGeneratingImages(false)
    }
  }

  function cancelImageGeneration() {
    imageAbortRef.current?.abort()
  }

  function saveBlob(content, name, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type })
    if (typeof URL.createObjectURL !== 'function') throw new Error('This browser cannot save files from the page.')
    const url = URL.createObjectURL(blob)
    try {
      const link = document.createElement('a')
      link.href = url
      link.download = type === 'image/png' ? name : ensureZipFilename(name)
      link.type = type
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      URL.revokeObjectURL(url)
      throw new Error(`The browser blocked the download link${error?.message ? ` (${error.message})` : ''}.`)
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function buildContactSheet() {
    const ready = project.slides.filter((slide) => images[slide.id]?.composedUrl)
    if (!ready.length) return null
    const items = []
    for (const slide of ready) {
      const image = await loadImage(images[slide.id].composedUrl)
      items.push({ image, label: `${String(slide.id).padStart(2, '0')} · ${slide.role} · ${slide.direction?.layout || 'auto'}` })
    }
    return composeContactSheet({ items, title: `${(angle || topic).slice(0, 60)} — ${getPreset(stylePreset).name} · ${imageStyle.name}` })
  }

  async function downloadContactSheet() {
    try {
      const blob = await buildContactSheet()
      if (!blob) { setNotice('Generate composed slides first — the contact sheet renders from finished frames.'); return }
      saveBlob(blob, 'contact-sheet.png', 'image/png')
      setNotice('Contact sheet downloaded. Inspect rhythm and readability across the full sequence at a glance.')
    } catch { setNotice('Contact sheet export failed. Regenerate the composed frames and retry.') }
  }

  async function download() {
    if (exporting) return
    if (!readiness.ready) {
      setNotice(`Export is blocked. ${readiness.blockers.join(' ')}`)
      return
    }
    setExporting(true)
    try {
      const zip = new JSZip(); zip.file('slideshow-package.md', toMarkdown(project)); const folder = zip.folder('slides')
      for (const slide of project.slides) {
        const generated = images[slide.id]
        if (!isRenderCurrent(slide, generated, stylePreset, imageStyle.directive)) throw new Error(`Slide ${slide.id} lost its finished frame while the package was being assembled — re-render it and retry.`)
        folder.file(`slide-${String(slide.id).padStart(2,'0')}.png`, generated.composedBlob)
        folder.file(`slide-${String(slide.id).padStart(2,'0')}-prompt.txt`, generated.prompt || 'Image prompt unavailable for this frame.')
      }
      // The contact sheet is an auxiliary QA artifact — never fail the whole
      // package over it.
      let sheetIncluded = false
      try {
        const sheet = await buildContactSheet()
        if (sheet) { zip.file('contact-sheet.png', sheet); sheetIncluded = true }
      } catch { /* exported package stays valid without it */ }
      const blob = await zip.generateAsync({ type: 'blob' }); saveBlob(blob, 'slideshow-upload-package.zip', 'application/zip')
      setNotice(`${project.slides.length} composed slides in the ${getPreset(stylePreset).name} style were exported with the Markdown manifest${sheetIncluded ? ' and a contact sheet' : ' — the contact sheet could not be rendered and was left out'}.`)
    } catch (error) { setNotice(`Export failed: ${error?.message || 'the package could not be assembled.'} No package was downloaded.`) }
    finally { setExporting(false) }
  }

  async function copy() {
    if (!gate.passed) return
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard is unavailable')
      await navigator.clipboard.writeText(toMarkdown(project)); setNotice('Package copied to clipboard.')
    } catch { setNotice('Clipboard access failed. Use Export package instead.') }
  }

  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-black/15 bg-paper">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-lg bg-cobalt text-white"><Sparkles size={20} aria-hidden="true" /></div><div><p className="font-display text-xl font-bold">Slideshow Content Engine</p><p className="text-xs text-black/55">Research, story, real visuals, export</p></div></div>
          <span className="rounded-full border border-black/15 bg-white px-3 py-1.5 text-xs font-semibold">Local MVP · no publishing</span>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
        <section className="mb-10 grid gap-8 border-b border-black/15 pb-10 lg:grid-cols-[1.3fr_.7fr] lg:items-end">
          <div><p className="mb-3 text-sm font-bold text-cobalt">MAKE THE CONTENT WORTH DISTRIBUTING</p><h1 className="max-w-3xl text-balance font-display text-4xl font-bold leading-tight sm:text-6xl">Turn one sharp observation into a complete slideshow.</h1></div>
          <p className="text-pretty text-lg leading-8 text-black/65">Score the premise, shape the story, reject generic output, then export a package ready for human review and native TikTok finishing.</p>
        </section>

        <Tabs.Root defaultValue="studio">
          <Tabs.List aria-label="Content engine sections" className="mb-6 flex gap-1 overflow-x-auto border-b border-black/15">
            {[['studio','Studio'],['ideas','Idea bank'],['quality','Quality gate']].map(([value,label]) => <Tabs.Trigger key={value} value={value} className="focus-ring border-b-2 border-transparent px-4 py-3 text-sm font-bold text-black/55 data-[state=active]:border-cobalt data-[state=active]:text-ink">{label}</Tabs.Trigger>)}
          </Tabs.List>

          <Tabs.Content value="studio" className="focus:outline-none">
            <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
              <aside className="panel self-start p-5 lg:sticky lg:top-4">
                <h2 className="mb-1 text-xl font-bold">Story brief</h2><p className="mb-6 text-sm text-black/55">Start with a concrete premise, not a broad niche.</p>
                <label className="label" htmlFor="topic">Topic</label><input id="topic" className="field mb-4" value={topic} onChange={(e) => setTopic(e.target.value)} />
                <label className="label" htmlFor="audience">Audience</label><input id="audience" className="field mb-4" value={audience} onChange={(e) => setAudience(e.target.value)} />
                <label className="label" htmlFor="angle">Hook / lived tension</label><textarea id="angle" className="field mb-4 min-h-28 resize-y" value={angle} onChange={(e) => setAngle(e.target.value)} />
                <label className="label" htmlFor="observation">Research observation</label><textarea id="observation" className="field mb-4 min-h-24 resize-y" value={observation} onChange={(e) => setObservation(e.target.value)} />
                <label className="label" htmlFor="source">Source URL or note</label><input id="source" className="field mb-4" value={source} onChange={(e) => setSource(e.target.value)} />
                <label className="label" htmlFor="count">Slide count</label><select id="count" className="field mb-5" value={slideCount} onChange={(e) => setSlideCount(Number(e.target.value))}>{[4,5,6,7,8,9,10].map(n => <option key={n}>{n}</option>)}</select>
                <Button className="w-full" onClick={generate} disabled={generatingImages || generatingText}><Sparkles size={17} aria-hidden="true" /> Generate local fallback</Button>
              </aside>

              <section aria-labelledby="slides-title">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 id="slides-title" className="text-2xl font-bold">Slide editor</h2><p className="text-sm text-black/55">Short copy. One job per frame. Real visual generation included.</p></div><Score value={scoreIdea({ hook: angle, angle: topic, observation, source, visualPotential: 4, novelty: 4 })} /></div>
                <div className="mb-5 grid gap-3 rounded-xl border border-black/10 bg-white p-4 md:grid-cols-2"><label className="label">OpenRouter API key<input aria-label="OpenRouter API key" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk-or-v1-…" autoComplete="off" className="field mt-1 font-normal" /></label><label className="label">Text model<input aria-label="Text model" value={textModel} onChange={(event) => setTextModel(event.target.value)} className="field mt-1 font-normal" /></label><label className="label">Image model<input aria-label="Image model" value={imageModel} onChange={(event) => setImageModel(event.target.value)} className="field mt-1 font-normal" /></label><Button onClick={generateAiStory} disabled={generatingText || generatingImages || !apiKey.trim()} className="self-end">{generatingText ? 'Writing hooks + story…' : 'Generate AI hooks + story'}</Button><p className="text-xs text-black/55 md:col-span-2">The key remains in memory for this tab and is sent only to OpenRouter. Images are generated without lettering, then the approved slide text is art-directed onto each final 1080 × 1920 PNG.</p></div>
                <div className="mb-5 rounded-xl border border-black/10 bg-white p-4">
                  <div className="mb-3">
                    <span className="label mb-0" id="image-style-title">Image generation style</span>
                    <p className="text-xs text-black/55">Choose the visual world before generating — it is written into the story's visual directions and every image prompt. This is separate from the slide design preset below, which only styles the text overlay.</p>
                  </div>
                  <div role="radiogroup" aria-labelledby="image-style-title" aria-label="Image generation style">
                    {IMAGE_STYLE_GROUPS.map((group) => (
                      <div key={group.id} className="mb-4 last:mb-0" data-style-group={group.id}>
                        <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
                          <p className="text-xs font-bold uppercase tracking-wide text-black/70">{group.name}</p>
                          <p className="text-xs text-black/45">{group.blurb}</p>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          {stylesInGroup(group.id).map((style) => (
                            <button key={style.id} role="radio" aria-checked={imageStyleId === style.id} onClick={() => changeImageStyle(style.id)} disabled={generatingImages || generatingText}
                              className={cn('focus-ring rounded-lg border p-3 text-left transition-colors', imageStyleId === style.id ? 'border-cobalt bg-cobalt/5 ring-1 ring-cobalt' : 'border-black/15 hover:bg-black/5')}>
                              <span aria-hidden="true" className="mb-2 block h-8 w-full rounded-md border border-black/10" style={{ background: `linear-gradient(120deg, ${style.swatch[0]} 0%, ${style.swatch[1]} 55%, ${style.swatch[2]} 100%)` }} />
                              <p className="text-sm font-bold">{style.name}</p>
                              <p className="mt-1 text-xs leading-5 text-black/55">{style.tagline}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {imageStyleId === 'custom' && (
                    <div className="mt-3">
                      <label className="label" htmlFor="custom-style">Custom style direction</label>
                      <textarea id="custom-style" className="field min-h-24 resize-y font-normal" value={customStyleText} onChange={(event) => setCustomStyleText(event.target.value)} placeholder={CUSTOM_STYLE_PLACEHOLDER} disabled={generatingImages} />
                    </div>
                  )}
                  <div className="mt-4 flex gap-2">
                    <Button onClick={generateImages} disabled={generatingImages || generatingText || !apiKey.trim()} className="flex-1">{generatingImages ? `Generating up to ${IMAGE_GENERATION_CONCURRENCY} frames at once…` : `Generate finished slides: image + text (${imageStyle.name})`}</Button>
                    {generatingImages && <Button variant="secondary" onClick={cancelImageGeneration}>Cancel</Button>}
                  </div>
                  <p className="mt-3 text-xs text-black/55">Each style owns the full final image prompt — medium, subject grammar, scene, composition, texture, palette, and hard negative constraints — while preserving 9:16 framing and text-safe negative space. Frames are generated in parallel (up to {IMAGE_GENERATION_CONCURRENCY} at once), each frame's failure is reported individually, and frames whose prompt has not changed are reused without spending new image credits. Switching styles after generating marks frames stale until they are regenerated.</p>
                </div>
                <div className="mb-5 rounded-xl border border-black/10 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between gap-3"><span className="label mb-0">Slide design preset</span><Button variant="secondary" className="min-h-9 px-3 text-xs" onClick={() => recomposeOverlays()} disabled={generatingImages || generatingText || !slides.some((slide) => images[slide.id]?.dataUrl)}>Re-render overlays</Button></div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" role="radiogroup" aria-label="Slide design preset">
                    {STYLE_PRESETS.map((preset) => (
                      <button key={preset.id} role="radio" aria-checked={stylePreset === preset.id} onClick={() => changePreset(preset.id)} disabled={generatingImages || generatingText}
                        className={cn('focus-ring rounded-lg border p-3 text-left transition-colors', stylePreset === preset.id ? 'border-cobalt bg-cobalt/5 ring-1 ring-cobalt' : 'border-black/15 hover:bg-black/5')}>
                        <p className="text-sm font-bold">{preset.name}</p>
                        <p className="mt-1 text-xs leading-5 text-black/55">{preset.blurb}</p>
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-black/55">Design presets change the text overlay: typography, composition, and texture per narrative role — independent of the image generation style above. Switching re-renders existing frames locally without spending image credits. Each slide gets one of seven compositions (impact stack, editorial split, evidence card, tension rail, spotlight reveal, takeaway ledger, CTA stamp) chosen from its narrative job, with no layout repeated back-to-back.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {slides.map((slide) => <article key={slide.id} className="panel overflow-hidden">
                    <div className="flex items-center justify-between gap-2 border-b border-black/10 px-4 py-3"><span className="flex min-w-0 items-center gap-2 text-sm font-bold tabular-nums">{String(slide.id).padStart(2,'0')} · {slide.role}{slide.direction?.layout && <span className="truncate rounded bg-black/5 px-1.5 py-0.5 text-[11px] font-semibold text-black/60">{slide.direction.layout}{slide.direction.mirror ? ' ⇋' : ''}</span>}</span><span className="shrink-0 text-xs text-black/45">{images[slide.id]?.composedUrl ? 'TEXT ON IMAGE' : `${slide.text.length}/110`}</span></div>
                    {images[slide.id]?.composedUrl && <><img src={images[slide.id].composedUrl} alt={`Finished slide ${slide.id} with generated visual and text overlay`} className="aspect-[9/16] w-full object-cover" /><label className="flex min-h-11 items-center gap-2 border-t border-black/10 px-4 py-3 text-sm font-bold"><input type="checkbox" checked={Boolean(reviewedSlides[slide.id])} onChange={(event) => setReviewedSlides((current) => ({ ...current, [slide.id]: event.target.checked }))} /> Reviewed and approved</label></>}
                    <div className="p-4"><label className="sr-only" htmlFor={`slide-${slide.id}`}>Slide {slide.id} copy</label><textarea id={`slide-${slide.id}`} className="field min-h-28 resize-y font-display text-xl font-bold leading-snug" value={slide.text} disabled={generatingImages} onChange={(e) => updateSlide(slide.id, 'text', e.target.value)} /><label className="label mt-4" htmlFor={`visual-${slide.id}`}>Visual direction</label><input id={`visual-${slide.id}`} className="field" value={slide.visual} disabled={generatingImages} onChange={(e) => updateSlide(slide.id, 'visual', e.target.value)} /></div>
                  </article>)}
                </div>
                <div className="panel mt-4 p-5"><label className="label" htmlFor="caption">Caption</label><textarea id="caption" className="field min-h-24 resize-y" value={caption} onChange={(e) => setCaption(e.target.value)} /></div>
                <div className="mt-4 flex flex-wrap justify-end gap-3"><Button variant="secondary" onClick={copy} disabled={!gate.passed}><Clipboard size={17} aria-hidden="true" />Copy manifest</Button><Button variant="secondary" onClick={downloadContactSheet} disabled={!slides.some((slide) => images[slide.id]?.composedUrl)}><Grid3x3 size={17} aria-hidden="true" />Contact sheet</Button><Button onClick={download} disabled={!readiness.ready || exporting}><Download size={17} aria-hidden="true" />{exporting ? 'Exporting…' : 'Export package'}</Button></div>
                {!readiness.ready && (
                  <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm" data-testid="export-blockers">
                    <p className="font-bold">Export is blocked until every item below is resolved:</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-black/70">{readiness.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>
                  </div>
                )}
                {notice && <p role="status" className="mt-3 rounded-lg bg-moss px-4 py-3 text-sm font-semibold">{notice}</p>}
              </section>
            </div>
          </Tabs.Content>

          <Tabs.Content value="ideas" className="focus:outline-none">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-3xl font-bold">Idea bank</h2><p className="text-black/55">Score specificity, tension, novelty, and visual potential before writing.</p></div><Button onClick={() => setIdeas([...ideas, { id: crypto.randomUUID(), hook: 'A concrete observation from today', angle: 'Why it matters now', observation: '', source: '', visualPotential: 3, novelty: 3 }])}><Plus size={17} aria-hidden="true" /> Add idea</Button></div>
            <div className="grid gap-4 lg:grid-cols-2">{ideas.map((idea) => <article key={idea.id} className="panel p-5"><div className="mb-4 flex justify-between gap-4"><Lightbulb aria-hidden="true" /><Score value={scoreIdea(idea)} /></div><input aria-label="Idea hook" className="field mb-3 font-bold" value={idea.hook} onChange={(e) => setIdeas(ideas.map(i => i.id === idea.id ? {...i, hook:e.target.value}:i))}/><input aria-label="Idea angle" className="field mb-3" value={idea.angle} onChange={(e) => setIdeas(ideas.map(i => i.id === idea.id ? {...i, angle:e.target.value}:i))}/><textarea aria-label="Research observation" className="field mb-3 min-h-20 resize-y" value={idea.observation} onChange={(e) => setIdeas(ideas.map(i => i.id === idea.id ? {...i, observation:e.target.value}:i))}/><input aria-label="Source URL or note" className="field mb-4" value={idea.source} onChange={(e) => setIdeas(ideas.map(i => i.id === idea.id ? {...i, source:e.target.value}:i))}/><div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-black/50">Visual {idea.visualPotential}/5 · Novelty {idea.novelty}/5</span><div className="flex gap-2"><Button variant="secondary" onClick={() => useIdea(idea)}>Use in Studio</Button><button aria-label="Delete idea" className="focus-ring rounded-md p-2 hover:bg-red-50" onClick={() => setIdeas(ideas.filter(i => i.id !== idea.id))}><Trash2 size={17} aria-hidden="true" /></button></div></div></article>)}</div>
            <h3 className="mb-3 mt-10 text-xl font-bold">Reliable starting frames</h3><div className="grid gap-3 sm:grid-cols-2">{templates.map(([name,description]) => <div key={name} className="panel p-4"><p className="font-bold">{name}</p><p className="text-sm text-black/55">{description}</p></div>)}</div>
          </Tabs.Content>

          <Tabs.Content value="quality" className="focus:outline-none">
            <div className="grid gap-6 lg:grid-cols-[1fr_.8fr]"><section className="panel p-6"><div className="mb-5 flex items-center justify-between"><h2 className="text-3xl font-bold">Pre-export gate</h2><span className={cn('rounded-full px-3 py-1.5 text-sm font-bold', gate.passed ? 'bg-moss' : 'bg-red-100')}>{gate.passed ? 'PASS' : 'BLOCKED'}</span></div>{gate.passed ? <div className="space-y-3">{gate.checks.map(item => <p key={item.label} className="flex items-center gap-3"><Check className="text-green-700" size={18} aria-hidden="true" />{item.label}</p>)}</div> : <ul className="list-disc space-y-2 pl-5 text-red-800">{gate.failures.map(f => <li key={f}>{f}</li>)}</ul>}</section><aside className="rounded-xl bg-ink p-6 text-white"><h3 className="mb-3 font-display text-2xl font-bold">Manual review still matters.</h3><p className="text-pretty leading-7 text-white/70">This gate catches structural weakness. It cannot prove taste, truth, or cultural timing. Read the full sequence aloud, verify every claim, and add native audio inside TikTok before publishing.</p></aside></div>
          </Tabs.Content>
        </Tabs.Root>
      </main>
    </div>
  )
}

export default App
