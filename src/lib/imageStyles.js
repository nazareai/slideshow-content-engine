// Image-generation style system: user-selectable TikTok-native visual worlds
// that materially change what every frame IS — not a color filter over stock
// photography. This is deliberately a separate axis from the layout/typography
// presets in artDirection.js: those style the text overlay; these style the
// generated base image.
//
// Taxonomy (from TikTok-native research): three content groups —
//   capture      — the frame reads as a real photo or film still
//   illustrated  — the frame is redrawn/rebuilt in a non-photographic medium
//   meme         — internet-born aesthetics where artifacts and chaos ARE the style
// plus a Custom group whose text drives the prompt verbatim.
//
// Naming rule: descriptive visual mechanics only — no living artists, no
// protected studio or franchise names, ever.

const clean = (value) => String(value ?? '').trim()

// Every fixed style must specify all seven directive fields so a style switch
// rewrites the medium, subject grammar, scene, composition, texture, palette,
// and negative constraints of the prompt together.
export const IMAGE_STYLE_FIELDS = Object.freeze(['medium', 'subject', 'scene', 'composition', 'texture', 'palette', 'negative'])

export const IMAGE_STYLE_GROUPS = Object.freeze([
  Object.freeze({ id: 'capture', name: 'Capture', blurb: 'Camera-real looks — the frame reads as an actual photo or film still.' }),
  Object.freeze({ id: 'illustrated', name: 'Illustration & transformation', blurb: 'The frame is redrawn or rebuilt in a fully non-photographic medium.' }),
  Object.freeze({ id: 'meme', name: 'Meme-native', blurb: 'Internet-born aesthetics — compression, chaos, and absurdity are the style.' }),
  Object.freeze({ id: 'custom', name: 'Your direction', blurb: 'Describe the style yourself — it drives every image prompt verbatim.' }),
])

export const IMAGE_STYLES = Object.freeze([
  // ————— Capture —————
  Object.freeze({
    id: 'creator-candid', name: 'Creator Candid', group: 'capture',
    tagline: 'Phone-shot UGC realism — ambient light, lived-in scenes, camera-roll honesty.',
    swatch: Object.freeze(['#f3e7d6', '#dfb28c', '#8a6f57']),
    directive: Object.freeze({
      medium: 'A real photograph from a smartphone main camera — vertical 26mm-equivalent wide shot, handheld with a slight tilt, auto-exposed, straight off a camera roll.',
      subject: 'A real person mid-action, caught between poses — imperfect hair, natural skin texture, a genuine unguarded expression with zero styling-team polish.',
      scene: 'Ordinary lived-in spaces under unmodified ambient light — a cluttered bedroom desk, car interior, kitchen counter, or sidewalk café with believable everyday mess and slightly blown window light left in frame.',
      composition: 'Slightly off-center casual framing cropped like a quick grab shot, with a plain uncluttered field above or below the subject left clear for overlay text.',
      texture: 'Light digital noise in the shadows, subtle smartphone HDR processing, mild white-balance drift — the honest finish of a camera roll, no cinematic grade.',
      palette: 'True-to-life unglamorous color — warm indoor tungsten mixing with cool daylight, nothing stylized, saturated, or color-graded.',
      negative: 'No studio lighting, no illustration or 3D rendering, no cinematic color grade, no collage elements, no posed stock-photo perfection.',
    }),
  }),
  Object.freeze({
    id: 'direct-flash', name: 'Direct Flash', group: 'capture',
    tagline: 'Hard on-camera flash, inky falloff, glossy late-night snapshot punch.',
    swatch: Object.freeze(['#050505', '#3a3a3a', '#f2ede4']),
    directive: Object.freeze({
      medium: 'A point-and-shoot photograph fired at close range with hard on-camera flash — 35mm compact camera, small aperture, deep focus front to back.',
      subject: 'A styled subject shot paparazzi-close — confident direct gaze or caught-off-guard energy, sharp outfit details, glossy specular highlights on skin.',
      scene: 'Night streets, club corridors, hotel hallways, and blank walls that drop to black behind the flash pop — the location reduced to a hard-lit backdrop with razor-edged wall shadows.',
      composition: 'A tight confrontational crop with the subject dominating one half, the flash-darkened remainder of the frame held as near-black space for the overlay.',
      texture: 'High-contrast glossy finish, faint film grain, and the greasy sheen of an overexposed flash frame.',
      palette: 'Saturated color pop against inky blacks — flash-bleached skin tones and one loud accent color, everything past the falloff going dark.',
      negative: 'No soft ambient light, no illustration or cartoon shading, no pastel wash, no collage cutouts, no tasteful editorial retouching.',
    }),
  }),
  Object.freeze({
    id: 'cinematic', name: 'Cinematic', group: 'capture',
    tagline: 'Film-still drama — anamorphic depth, atmosphere, teal-and-amber grade.',
    swatch: Object.freeze(['#0b1e2d', '#14506b', '#e8862e']),
    directive: Object.freeze({
      medium: 'A photorealistic film still — anamorphic 40mm cinema lens, shallow depth of field with oval bokeh, motivated practical lighting.',
      subject: 'A protagonist treated like a movie still — deliberate blocking, controlled wardrobe tones, an emotionally loaded but restrained expression mid-story.',
      scene: 'Atmosphere-first locations — haze-filled rooms, rain-streaked windows, lamplit streets at night — under a single hard key light with deep falloff and volumetric shafts cutting through haze.',
      composition: 'Widescreen sensibility inside the vertical frame: subject held to one third, the opposite third falling into deep clean darkness reserved for the overlay.',
      texture: 'Filmic halation on highlights, fine 35mm grain, lifted blacks, crushed cinematic contrast.',
      palette: 'A graded teal-and-amber film palette — cool shadows, warm practical highlights, restrained saturation.',
      negative: 'No flat even lighting, no cartoon or 3D-render look, no oversaturated meme processing, no smartphone snapshot flatness, no collage.',
    }),
  }),

  // ————— Illustration & transformation —————
  Object.freeze({
    id: 'cartoon-pop', name: 'Cartoon Pop', group: 'illustrated',
    tagline: 'Flat 2D cartoon illustration — thick outlines, cel shading, candy color.',
    swatch: Object.freeze(['#ff4fa3', '#ffd93b', '#2457ff']),
    directive: Object.freeze({
      medium: 'A flat 2D digital cartoon illustration — hand-drawn vector-style linework with cel-shaded fills; unmistakably a drawing, never a photograph and never a 3D render.',
      subject: 'Characters and objects redrawn as bold cartoon figures — thick clean black outlines, exaggerated expressions, rubber-limbed poses, simplified faces built for huge readable emotion.',
      scene: 'Flat graphic backgrounds built from simple shapes — a two-tone room, a starburst wall, a chunky patterned sky — with depth suggested by overlapping flat layers instead of perspective realism.',
      composition: 'A sticker-like hero character filling the lower two thirds at a dynamic angle, set against a flat solid color field up top kept empty for the overlay text.',
      texture: 'Perfectly flat digital ink with crisp edges; at most a halftone-dot or paper-grain accent — no photographic grain and no rendered gloss.',
      palette: 'Loud candy saturation — hot pink, cyan, sunshine yellow, and cobalt slammed against each other with black outlines holding it together.',
      negative: 'Absolutely no photographic elements, no photorealistic skin or fabric, no 3D rendering or clay shading, no camera grain, no lens blur, no realistic lighting.',
    }),
  }),
  Object.freeze({
    id: 'clay-toy-3d', name: 'Clay & Toy 3D', group: 'illustrated',
    tagline: 'Handmade miniature world — clay figures, toy sets, soft macro depth.',
    swatch: Object.freeze(['#ffd6a5', '#a8e6cf', '#ff8fab']),
    directive: Object.freeze({
      medium: 'A handcrafted stop-motion-style 3D scene — modeling-clay and toy-plastic figures on a miniature tabletop diorama, shot macro with tilt-shift depth.',
      subject: 'Everything rebuilt as squishy clay figures and playset props — chunky rounded proportions, visible fingerprints and tool marks, wide-eyed handmade charm instead of realism.',
      scene: 'Miniature dioramas of felt, cardboard, and painted foam — tiny furniture, cotton-ball smoke, pipe-cleaner plants — lit like a soft toy-commercial tabletop studio.',
      composition: 'A centered hero figurine at toy scale with the diorama falling into soft macro blur, and a clean band of softly lit backdrop above it left free for overlay text.',
      texture: 'Matte clay with thumbprint dents, soft plastic sheen, felt fuzz, and the gentle depth-of-field falloff of a real macro lens on a tiny set.',
      palette: 'Warm playroom pastels — butter yellow, mint, coral, and sky blue under soft cream lighting, nothing grim or desaturated.',
      negative: 'No flat 2D illustration, no photorealistic humans, no gritty realistic materials, no harsh lighting, no glitch or compression artifacts.',
    }),
  }),
  Object.freeze({
    id: 'retro-pixel', name: 'Retro Pixel', group: 'illustrated',
    tagline: 'Chunky game-screen pixel art — strict grid, dithered shade, sprite drama.',
    swatch: Object.freeze(['#2b2d64', '#3ec54b', '#e832a0']),
    directive: Object.freeze({
      medium: 'Chunky low-resolution pixel art on a strict square grid — a hand-placed retro video-game scene with hard crisp pixel edges, never smooth vector art and never a photo.',
      subject: 'Characters and objects as expressive pixel sprites — blocky silhouettes a few dozen pixels tall with big theatrical poses and single-pixel eye details.',
      scene: 'A side-view or isometric game environment — tiled platforms, parallax skylines, glowing item pickups — staged like a dramatic paused moment in a level.',
      composition: 'The sprite scene anchored in the lower half like a level foreground, with a flat dithered sky band across the top kept clear for overlay text.',
      texture: 'Visible square pixels everywhere, ordered dithering for shading, deliberate aliasing on every edge — no smoothing, no anti-aliased curves.',
      palette: 'A limited 32-color retro console palette — deep indigo nights, emerald greens, and hot magenta accents with zero smooth gradients.',
      negative: 'No smooth anti-aliased curves, no photographic textures, no 3D rendering, no painterly brushwork, no motion blur or lens effects.',
    }),
  }),

  // ————— Meme-native —————
  Object.freeze({
    id: 'surreal-brainrot', name: 'Surreal Brainrot', group: 'meme',
    tagline: 'Impossible hybrid mascots with fake epic lore, wrong scale, fried render sheen.',
    swatch: Object.freeze(['#7bff3f', '#ff8b1f', '#2e9bff']),
    directive: Object.freeze({
      medium: 'An overcooked hyperreal 3D-render-style image played completely straight — the glossy sheen of a viral low-effort render that has been reposted a thousand times.',
      subject: 'An absurd hybrid creature or object-mascot — an everyday animal, food item, or household appliance fused into one impossible character — treated as the legendary hero of its own nonsense saga, caught mid-dramatic moment.',
      scene: 'Mundane locations staged like epic lore drops — a parking lot, bathroom, or classroom framed as a mythic arena, with shrine-like props and awed onlookers implying a deep backstory that does not exist.',
      composition: 'Heroic low-angle centered framing at wildly wrong scale — the hybrid towering over buildings or posed tiny on a dinner plate — with the upper area held as plain sky or ceiling for the overlay text.',
      texture: 'Chaotic internet texture — recompressed jpeg blocking, oversharpened AI-render gloss, slightly melted background details, harsh bloom — like a screenshot of a screenshot.',
      palette: 'Blown-out oversaturation — radioactive greens, hot oranges, and piercing blues clipping toward white, nothing tasteful or harmonized.',
      negative: 'No elegant dreamlike surrealism, no artful neon gradients, no moody fantasy illustration, no tasteful symbolism — the absurdity must be literal, deadpan, and played completely straight.',
    }),
  }),
  Object.freeze({
    id: 'deep-fried', name: 'Deep-Fried Meme', group: 'meme',
    tagline: 'A snapshot nuked by reposting — crunchy jpeg, scorched saturation, flare.',
    swatch: Object.freeze(['#ff3c00', '#ffb300', '#5c1a00']),
    directive: Object.freeze({
      medium: 'A photographic snapshot destroyed by generations of reposting — recompressed until it crunches, like a meme saved and re-uploaded fifty times.',
      subject: 'One ordinary subject pushed to maximum intensity — a face mid-laugh, a pet mid-stare, an object held up in triumph — made iconic by sheer compression damage rather than styling.',
      scene: 'Whatever banal setting the snapshot happened in — a bedroom, sidewalk, or kitchen — barely legible behind the frying, with hot lens-flare sparkles slapped onto the focal point.',
      composition: 'The subject slammed dead-center and cropped tight like a reaction image, with a blown-out flat area above it left as scorched negative space for the overlay text.',
      texture: 'Crunchy jpeg macroblocks, ringing halos around every edge, posterized banding, and oversharpening artifacts stacked until the image sizzles.',
      palette: 'Nuked saturation with a hot orange-red chemical cast — highlights clipped to white, shadows crushed to muddy brown, every hue pushed past plausible.',
      negative: 'No clean sharp detail, no balanced natural color, no professional grading, no illustration or 3D look — the base must read as a real photo ruined by the internet.',
    }),
  }),
  Object.freeze({
    id: 'cursed-collage', name: 'Cursed Collage', group: 'meme',
    tagline: 'Crudely cut photo scraps forced together — visible seams, wrong shadows.',
    swatch: Object.freeze(['#e8dcc2', '#d43d2a', '#4657ce']),
    directive: Object.freeze({
      medium: 'A chaotic mixed-media digital collage — photo fragments crudely cut out and pasted together with visible hard clipping edges, like a fever-dream image board.',
      subject: 'Mismatched photo cutouts forced to share one scene — a hand from one photo, a head from another at the wrong scale, stock objects duplicated and stretched — assembled into a wrong-but-confident tableau.',
      scene: 'A background stitched from clashing sources — a living-room floor meeting an ocean horizon meeting outer space — with unblended seams and contradictory shadows left proudly visible.',
      composition: 'Dense off-kilter clutter spiraling around one central cutout, every element pasted at a slightly wrong angle, with one roughly torn plain paper area kept clear near the top for the overlay text.',
      texture: 'Mixed resolutions inside one frame — crisp cutouts against blurry upscaled fragments — white cut-line halos, drop shadows pointing in different directions, scanner dust over everything.',
      palette: 'Clashing palettes colliding — faded magazine yellows against harsh digital primaries with no unifying grade; the mismatch is the aesthetic.',
      negative: 'No seamless blending, no unified lighting, no clean minimal layout, no single-source photography, no tasteful color harmony — visual coherence is the failure state.',
    }),
  }),
  Object.freeze({
    id: 'y2k-web-chaos', name: 'Y2K Web Chaos', group: 'meme',
    tagline: 'Chrome blobs, sparkle glitter, gradient skies — a maxed-out dial-up homepage.',
    swatch: Object.freeze(['#ff7ad9', '#7ad9ff', '#c8ff5e']),
    directive: Object.freeze({
      medium: 'A glossy early-2000s web-graphics scene — low-poly 3D renders, chrome blobs, and sparkle-glitter clip art assembled like a maxed-out homepage from the dial-up era.',
      subject: 'Subjects rebuilt as shiny web ornaments — plastic-chrome mascots, aqua gel buttons, spinning low-poly shapes, winged hearts and orbiting stars — everything glossy, bevelled, and slightly pixelated.',
      scene: 'A cyber-space backdrop of gradient mesh skies, tiled checkerboard floors receding to a horizon, floating empty window frames and cursor trails — pure pre-broadband screen space.',
      composition: 'A busy central cluster of glossy elements with radial sparkle bursts, framed by a calmer gradient band across the top held open for the overlay text.',
      texture: 'Hard plastic gloss with fake bevel highlights, dithered GIF grain, chunky pixel edges on small elements, and lens-flare sparkles stamped on every shiny corner.',
      palette: 'Bubblegum cyber-candy — hot pink, aqua, lime, and silver chrome over deep blue, with rainbow gradient fills nothing in nature could produce.',
      negative: 'No photorealism, no matte modern minimalism, no muted tasteful tones, no hand-drawn linework — everything must look machine-rendered, glossy, and gloriously dated.',
    }),
  }),

  // ————— Your direction —————
  Object.freeze({
    id: 'custom', name: 'Custom', group: 'custom',
    tagline: 'Write your own style direction — it drives every image prompt verbatim.',
    swatch: Object.freeze(['#e8e8e8', '#bdbdbd', '#7a7a7a']),
    editable: true,
    directive: null,
  }),
])

export const IMAGE_STYLE_IDS = Object.freeze(IMAGE_STYLES.map((style) => style.id))
export const DEFAULT_IMAGE_STYLE_ID = 'creator-candid'

export function stylesInGroup(groupId) {
  return IMAGE_STYLES.filter((style) => style.group === groupId)
}

export const CUSTOM_STYLE_PLACEHOLDER = 'e.g. Everything rebuilt from folded paper and cardboard, stop-motion craft lighting, one paper hero centered, top third kept as plain backdrop for text.'

// When Custom is selected but the direction box is empty, generation still
// needs a workable directive rather than silently reverting to a generic look.
const CUSTOM_FALLBACK_DIRECTIVE = 'Custom image style — A vertical frame with one distinctive, deliberate visual treatment of your own choosing; a single coherent medium held across every frame, one strong focal point, and clear text-safe negative space preserved for a short overlay.'

export function getImageStyle(id) {
  return IMAGE_STYLES.find((style) => style.id === clean(id)) || IMAGE_STYLES.find((style) => style.id === DEFAULT_IMAGE_STYLE_ID)
}

// Render one style's structured fields into the single prompt directive that
// every image request embeds.
export function styleDirective(style, customText = '') {
  const resolved = getImageStyle(style?.id ?? style)
  if (resolved.editable) {
    const text = clean(customText)
    return text ? `Custom image style — ${text}` : CUSTOM_FALLBACK_DIRECTIVE
  }
  const d = resolved.directive
  return `${resolved.name} image style — Medium: ${d.medium} Subject treatment: ${d.subject} Scene: ${d.scene} Composition: ${d.composition} Texture: ${d.texture} Palette: ${d.palette} Avoid: ${d.negative}`
}

// The story model writes each slide's visual direction before any image prompt
// exists, so the selected style must be authoritative at that layer too: a
// global photorealistic default there would seed illustrated and meme-native
// series with camera language the image model then faithfully obeys.
export function storySceneBrief(selection = DEFAULT_IMAGE_STYLE_ID) {
  const style = resolveImageStyle(selection)
  const fixed = getImageStyle(style.id)
  const base = 'Every visual direction must describe one concrete vertical scene in the selected image medium, with clear negative space for a text overlay.'
  if (fixed.editable) {
    return `${base} ${style.directive} This custom direction is authoritative: describe every scene in its medium and vocabulary alone, and only use real-camera photography language if the direction itself asks for it.`
  }
  const d = fixed.directive
  const grammar = `Selected image style — ${style.name}. Medium: ${d.medium} Subject treatment: ${d.subject}`
  if (fixed.group === 'capture') {
    return `${base} ${grammar} These frames are real photography: describe physically plausible, concrete photorealistic moments a camera could capture, in exactly that language.`
  }
  return `${base} ${grammar} Write every scene as native to that medium — name its materials, forms, and staging — and never describe a scene as a real photograph or use camera vocabulary the medium itself does not call for.`
}

// Normalize any selection shape ({ styleId, customText }, a resolved style, or
// a bare id string) into the object the app state, prompts, and export
// manifest share. Idempotent: resolveImageStyle(resolveImageStyle(x)) is x.
export function resolveImageStyle(selection = DEFAULT_IMAGE_STYLE_ID) {
  const styleId = typeof selection === 'string' ? selection : selection?.styleId ?? selection?.id
  const style = getImageStyle(styleId)
  const custom = typeof selection === 'object' ? clean(selection?.customText ?? selection?.custom) : ''
  return {
    id: style.id,
    name: style.name,
    group: style.group,
    custom: style.editable ? custom : '',
    directive: styleDirective(style, custom),
  }
}
