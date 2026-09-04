# Slideshow Content Engine

A local MVP for creating TikTok slideshow packages from sourced observations. It generates and scores hooks, writes editable 4 to 10-frame stories through a configurable OpenRouter text model, creates real 9:16 images, art-directs the approved text onto every final image with role-driven compositions and style presets, applies quality gates, and exports a ZIP with finished PNG slides, prompts, a contact sheet, and a Markdown manifest. It does not publish or schedule content.

## Visual direction system

Every slide is composed by `src/lib/artDirection.js` + `src/lib/compositor.js` rather than a single centered text box:

- **Seven composition archetypes**, selected from the slide's narrative role — `impact-stack` (hook: full-bleed image, oversized stacked display type, ghost index numeral, swipe cue), `editorial-split` (setup: asymmetric magazine panel with kicker and accent rule), `evidence-card` (evidence: offset field-note card with quote tick and source footer), `tension-rail` (tension: one-sided scrim with a narrow ragged column on the rail), `spotlight-reveal` (reveal: focal-point-aware radial spotlight with copy in the counter-focal half), `takeaway-ledger` (takeaway: bottom-anchored ledger panel with index badge), and `cta-stamp` (CTA: framed closing card with rotated stamp chip and bookmark glyph).
- **Sequence rhythm**: `planDirections` guarantees at least five distinct archetypes per set and never repeats a layout back-to-back; repeated archetypes mirror their composition side.
- **Slide design presets** that materially change typography and composition, not just color: Bold Impact (900-weight caps, hard panels, highlight-box emphasis), Zine Punch (rotated panels, stroke-outline emphasis, heavy grain), Quiet Documentary (Georgia serif, sentence case, underline emphasis, soft scrims), Field Log (monospace, boxed emphasis, utilitarian spacing). Switching presets re-renders existing frames locally without new image credits.

## Image generation styles

A separate control from the slide design presets: `src/lib/imageStyles.js` defines a TikTok-native taxonomy of user-selectable visual worlds chosen **before** image generation, grouped the way the platform's native content actually behaves. Each fixed style is a structured directive that changes seven axes together — medium, subject grammar, scene, composition, texture, palette, and negative constraints — while every prompt still enforces 9:16 framing and text-safe negative space for the overlay. Style names describe visual mechanics only; no living artists or protected studio names are imitated.

**Capture** — camera-real looks:

- **Creator Candid** (default) — authentic phone-shot UGC: ambient light, lived-in scenes, camera-roll honesty.
- **Direct Flash** — hard on-camera flash, inky falloff, glossy late-night snapshot punch.
- **Cinematic** — film-still drama: anamorphic depth, haze, teal-and-amber grade.

**Illustration & transformation** — the frame is rebuilt in a non-photographic medium:

- **Cartoon Pop** — unmistakably flat 2D cartoon illustration: thick outlines, cel shading, candy color, zero photorealism.
- **Clay & Toy 3D** — handmade miniature world: clay figures with fingerprints, toy diorama sets, soft macro depth.
- **Retro Pixel** — chunky game-screen pixel art on a strict grid: dithered shading, sprite drama, no anti-aliasing.

**Meme-native** — internet-born aesthetics where the artifacts are the style:

- **Surreal Brainrot** — absurd hybrid creature-mascots treated as legendary heroes of a saga that does not exist: uncanny pseudo-lore staging, wildly wrong scale, recompressed jpeg-rot texture — deadpan and played straight, never tasteful neon surrealism.
- **Deep-Fried Meme** — a snapshot nuked by generations of reposting: crunchy macroblocks, scorched saturation, ringing halos, lens-flare sparkles.
- **Cursed Collage** — crudely cut photo scraps forced together: visible white cut lines, contradictory shadows, clashing resolutions.
- **Y2K Web Chaos** — a maxed-out dial-up homepage: chrome blobs, sparkle glitter, gradient mesh skies, checkerboard floors.

**Your direction:**

- **Custom** — an editable style direction written verbatim into every prompt.

The selected style is embedded in the per-series visual bible and every `meta/muse-image` prompt (style-specific negative constraints included — only lettering is universally banned, because the approved text is composited locally), recorded on each generated frame, persisted in the exported Markdown manifest (`## Image style`), and enforced by the staleness check: switching styles after generating marks frames stale until they are regenerated to match.
- **Model-driven art direction**: the text model returns `layout`, `emphasis`, and `focalPoint` per slide through the response schema; the app validates the metadata (clamping focal points, verifying the emphasis appears in the copy, falling back to role-derived layouts) and renders it deterministically — same input, same pixels.
- **Mobile safety**: all copy is fitted inside a TikTok-safe region (top search bar, bottom caption/sound area, and the right action rail are avoided); copy that cannot stay readable is rejected rather than shrunk or clipped.

### Visual proof

`contact-sheet.html` (built alongside the app) renders a full generated sequence through the production pipeline over deterministic placeholder photography — one contact sheet per preset plus full-resolution detail frames. `style-contact-sheet.html` renders one deterministic mock base frame per image style (painted in that style's medium, palette, texture, and composition mechanics) through the same production compositor, plus full-size detail frames for Cartoon Pop, Surreal Brainrot, Deep-Fried Meme, and Cursed Collage annotated with the exact prompt directive each injects. Capture them with:

```bash
npm run build
npx vite preview --port 4174 --strictPort   # in one terminal
node scripts/capture-proof.mjs               # writes redesign-proof/*.png
node scripts/capture-style-sheet.mjs         # writes redesign-proof/style-taxonomy-contact-sheet.png
node scripts/capture-style-proof.mjs         # writes redesign-proof/studio-image-style-*.png
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
4. Review and edit the selected hook, every frame, caption, and visual direction.
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
