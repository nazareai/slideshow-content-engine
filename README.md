# Slideshow Content Engine

A local MVP for creating TikTok slideshow packages from sourced observations. It generates and scores hooks, writes editable 4 to 10-frame stories through a configurable OpenRouter text model, creates real 9:16 images, art-directs the approved text onto every final image with role-driven compositions and style presets, applies quality gates, and exports a ZIP with finished PNG slides, prompts, a contact sheet, and a Markdown manifest. It does not publish or schedule content.

## Visual direction system

Every slide is composed by `src/lib/artDirection.js` + `src/lib/compositor.js` rather than a single centered text box:

- **Seven composition archetypes**, selected from the slide's narrative role — `impact-stack` (hook: full-bleed image, oversized stacked display type, ghost index numeral, swipe cue), `editorial-split` (setup: asymmetric magazine panel with kicker and accent rule), `evidence-card` (evidence: offset field-note card with quote tick and source footer), `tension-rail` (tension: one-sided scrim with a narrow ragged column on the rail), `spotlight-reveal` (reveal: focal-point-aware radial spotlight with copy in the counter-focal half), `takeaway-ledger` (takeaway: bottom-anchored ledger panel with index badge), and `cta-stamp` (CTA: framed closing card with rotated stamp chip and bookmark glyph).
- **Sequence rhythm**: `planDirections` guarantees at least five distinct archetypes per set and never repeats a layout back-to-back; repeated archetypes mirror their composition side.
- **Slide design presets** that materially change typography and composition, not just color: Bold Impact (900-weight caps, hard panels, highlight-box emphasis), Zine Punch (rotated panels, stroke-outline emphasis, heavy grain), Quiet Documentary (Georgia serif, sentence case, underline emphasis, soft scrims), Field Log (monospace, boxed emphasis, utilitarian spacing). Switching presets re-renders existing frames locally without new image credits.

## Image generation styles

A separate control from the slide design presets: `src/lib/imageStyles.js` defines user-selectable photographic styles chosen **before** image generation, so a series can look like native creator content instead of generic professional stock. Each fixed style is a structured directive that changes six axes together — subject treatment, environment, lighting, camera/lens, texture/color grade, and composition — while every prompt still enforces 9:16 framing and text-safe negative space for the overlay.

- **Creator Candid** (default) — authentic phone-shot UGC: ambient light, lived-in scenes, camera-roll honesty.
- **Cinematic** — film-still drama: anamorphic depth, haze, teal-and-amber grade.
- **Flash Editorial** — hard direct flash, inky falloff, glossy backstage-tabloid punch.
- **Documentary** — observed reportage: available light, honest texture, matte photo-essay tone.
- **Y2K Internet** — digicam flash, candy gels, chrome-and-gloss 2000s web nostalgia.
- **Luxury Minimal** — one hero subject, vast negative space, gallery-grade soft light.
- **Surreal Meme** — deadpan photoreal absurdity in flat, liminal stock-photo light.
- **Custom** — an editable style direction written verbatim into every prompt.

The selected style is embedded in the per-series visual bible and every `meta/muse-image` prompt, recorded on each generated frame, persisted in the exported Markdown manifest (`## Image style`), and enforced by the staleness check: switching styles after generating marks frames stale until they are regenerated to match.
- **Model-driven art direction**: the text model returns `layout`, `emphasis`, and `focalPoint` per slide through the response schema; the app validates the metadata (clamping focal points, verifying the emphasis appears in the copy, falling back to role-derived layouts) and renders it deterministically — same input, same pixels.
- **Mobile safety**: all copy is fitted inside a TikTok-safe region (top search bar, bottom caption/sound area, and the right action rail are avoided); copy that cannot stay readable is rejected rather than shrunk or clipped.

### Visual proof

`contact-sheet.html` (built alongside the app) renders a full generated sequence through the production pipeline over deterministic placeholder photography — one contact sheet per preset plus full-resolution detail frames. Capture it with:

```bash
npm run build
npx vite preview --port 4174 --strictPort   # in one terminal
node scripts/capture-proof.mjs               # writes redesign-proof/*.png
```

Current captures live in `redesign-proof/`.

## Run

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Verify

```bash
npm test
npm run build
```

## Workflow

1. Enter a concrete topic, audience, lived tension, observation, and source.
2. Enter an OpenRouter API key in the in-memory password field.
3. Generate hook candidates, the complete 4 to 10-frame story, and caption with the configurable text model. Five frames is the manual-aligned default. The default test model is `openai/gpt-5.6-luna`.
4. Review and edit the selected hook, every frame, caption, and photographic direction.
5. Pick an image generation style (or write a Custom direction) and a slide design preset. Generate imagery with `meta/muse-image` — the selected style steers every prompt, then the app art-directs the approved copy onto each 1080 × 1920 image using the slide's planned composition, focal point, and emphasis word.
6. Inspect every finished frame (use the contact sheet to judge sequence rhythm at a glance) and pass the structural quality gate, which also enforces layout diversity.
7. Export `slideshow-upload-package.zip` — finished slides, prompts, contact sheet, and manifest.
8. Verify claims and visual accuracy, add native audio in TikTok, then publish manually.

## Real image generation

Text generation uses OpenRouter's `POST /api/v1/chat/completions` endpoint and requests schema-constrained hooks, a selected hook, exact frame count, visual directions, and caption. The text-model field is editable and defaults to `openai/gpt-5.6-luna`.

Image generation sends each frame's visual direction plus story context and the selected image-style directive to OpenRouter's `POST /api/v1/images` endpoint. The default image model is `meta/muse-image`. The model is explicitly told not to draw typography. The browser then crops the returned image to 9:16 biased toward the slide's declared focal point, and renders the approved copy through the slide's planned composition archetype and the active design preset. Editing the copy, the visual, the design preset, or the image style invalidates that frame's render so stale imagery cannot be exported as current; text and design-preset edits re-render locally from the stored raw image without a new API call, while an image-style change requires regeneration.

The API key is held only in React state for the current tab. It is not written to local storage, bundled into the app, or included in exports. For a public deployment, replace browser-side credentials with a small authenticated server endpoint.

If a frame has not been generated, export labels its old local SVG/PNG typography card as `fallback`. The UI never presents that fallback as a real photograph.

## Limits

Research is still entered manually. The deterministic story generator cannot independently prove factual accuracy, taste, cultural timing, or performance. Image models can produce visual errors and inconsistent subjects between frames, so every generated set requires review. There is no Postiz, scheduling, TikTok publishing, or analytics-learning layer.
