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
  Object.freeze({ id: 'illustrated', name: 'Illustration & transformation', blurb: 'Each preset is a different rendering medium — flat cel, pen doodle, printed comic, cut paper, pixels, or clay. Only Clay & Toy 3D is three-dimensional.' }),
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
  // Seven cartoon families, each a genuinely different rendering medium. The
  // five flat media (cel, doodle, comic, paper, pixel) carry explicit bans on
  // 3D, CGI, clay, plastic, photorealism, camera, and lens language so the
  // image model cannot converge them all onto the same glossy 3D look.
  Object.freeze({
    id: 'cartoon-pop', name: 'Flat 2D Cartoon', group: 'illustrated',
    tagline: 'Cel-animation flatness — thick outlines, flat color fills, candy palette. Drawn, never 3D.',
    swatch: Object.freeze(['#ff4fa3', '#ffd93b', '#2457ff']),
    directive: Object.freeze({
      medium: 'A completely flat 2D cel-animation cartoon still — hand-drawn linework with solid flat color fills and zero depth; unmistakably a drawing on a flat cel, never a photograph, never a 3D render, never computer-generated dimensional imagery.',
      subject: 'Characters and objects redrawn as bold flat cartoon figures — thick clean black outlines, exaggerated expressions, rubber-limbed poses, simplified faces built for huge readable emotion, every shape a flat fill with at most one hard-edged cel shadow tone.',
      scene: 'Flat graphic backgrounds built from simple shapes — a two-tone room, a starburst wall, a chunky patterned sky — with depth suggested only by overlapping flat layers, never by perspective realism or dimensional shading.',
      composition: 'A sticker-like hero character filling the lower two thirds at a dynamic angle, set against a flat solid color field up top kept empty for the overlay text.',
      texture: 'Perfectly flat digital ink with crisp edges; at most a paper-grain accent — no gradients on skin, no soft shading, no photographic grain, no rendered gloss.',
      palette: 'Loud candy saturation — hot pink, cyan, sunshine yellow, and cobalt slammed against each other in flat unbroken fields with black outlines holding it together.',
      negative: 'Strictly flat and drawn: no 3D, no CGI, no clay or plasticine, no plastic or vinyl toy sheen, no photorealism, no photographic elements, no camera grain, no lens blur or depth of field, no volumetric or realistic lighting, no dimensional shading or ambient occlusion.',
    }),
  }),
  Object.freeze({
    id: 'hand-doodle', name: 'Hand-Drawn Doodle', group: 'illustrated',
    tagline: 'Marker-and-ballpoint scribbles on paper — wobbly lines, notebook energy. Sketched, never 3D.',
    swatch: Object.freeze(['#fdfbf4', '#37352f', '#ff5a36']),
    directive: Object.freeze({
      medium: 'A hand-drawn doodle in marker and ballpoint pen on flat paper — wobbly scribbled linework like a sketchbook page brought to life; unmistakably hand-sketched ink on paper, never a photograph, never a 3D render, never smooth digital vector art.',
      subject: 'People and objects as loose naive doodle characters — shaky confident outlines, scribble-fill hair and clothes, gloriously wrong proportions, expressive faces drawn from two dots and a wobbly line.',
      scene: 'A mostly bare paper page with a few scrawled props — hand-drawn arrows, stars, coffee-ring stains, a crossed-out mistake left proudly visible — the emptiness of the paper is part of the scene.',
      composition: 'One doodle hero drawn big and off-center with scribbled motion lines, the top of the page left as untouched paper white so the overlay text sits in clean space.',
      texture: 'Visible marker streaks, ballpoint pressure wobble, graphite smudges, and paper tooth showing through every scribbled fill — no digital smoothness anywhere.',
      palette: 'Two or three pen colors at most — ink black plus one loud marker accent like red or blue — over warm paper white, with nothing blended and no gradients.',
      negative: 'Strictly pen on paper: no 3D, no CGI, no clay, no plastic materials, no photorealism, no photographic elements, no camera or lens effects, no clean vector curves, no cel shading, no painterly digital rendering, no realistic lighting.',
    }),
  }),
  Object.freeze({
    id: 'comic-ink', name: 'Comic Ink & Halftone', group: 'illustrated',
    tagline: 'Pulp comic-book printing — brush ink, Ben-Day dots, action panels. Printed, never 3D.',
    swatch: Object.freeze(['#f4e9d8', '#141414', '#e63946']),
    directive: Object.freeze({
      medium: 'A printed comic-book panel in bold ink and halftone — heavy brush-inked linework with Ben-Day dot shading on aged newsprint; unmistakably a flat printed 2D comic page, never a photograph, never a 3D render, never painted digital concept art.',
      subject: 'Characters as dynamic inked comic figures — heavy brush outlines, dramatic cross-hatched shadows, gritted teeth and flared expressions, action poses frozen mid-panel with speed lines trailing the movement.',
      scene: 'High-drama comic staging — speed lines radiating behind the action, a tilted-horizon cityscape or interior reduced to stark ink shapes, an impact burst framing the key moment inside a thin printed panel border.',
      composition: 'The inked action fills the lower panel while a flat halftone-dot sky band across the top stays quiet for the overlay text.',
      texture: 'Visible halftone dot grids in every mid-tone, slight off-register color misprint, newsprint grain, and solid ink blacks — the finish of a pulp comic page.',
      palette: 'Four-color pulp printing — ink black, halftone red, process yellow, and flat cyan-blue, all slightly faded like an old newsstand issue.',
      negative: 'Strictly printed ink: no 3D, no CGI, no clay, no plastic sheen, no photorealism, no photographic textures, no camera or lens effects, no soft digital gradients, no airbrushed painting, no dimensional rendering — only flat ink lines and halftone dots.',
    }),
  }),
  Object.freeze({
    id: 'paper-collage', name: 'Cut-Paper Collage', group: 'illustrated',
    tagline: 'Construction-paper cutouts and stickers — scissor edges, glued flat layers. Paper, never 3D.',
    swatch: Object.freeze(['#f94144', '#f8b229', '#43aa8b']),
    directive: Object.freeze({
      medium: 'A flat cut-paper and sticker collage illustration — construction-paper shapes cut with scissors and glued down in layered flats like a craft-table mural; unmistakably paper craft, never a photograph, never a 3D render, never digital painting.',
      subject: 'Characters assembled from torn and scissor-cut paper shapes — a circle head, zigzag-cut hair, googly-eye stickers — every part a separate flat paper layer with visible cut edges and slightly wrong alignment.',
      scene: 'A layered paper landscape — scalloped paper hills, a fringed paper sun, sticker clouds — everything flat, front-facing, and obviously glued onto a paper board.',
      composition: 'The paper character sits low in the frame among layered paper scenery, while one solid sheet of untouched background paper spans the top for the overlay text.',
      texture: 'Fibrous torn paper edges, thin hard shadows where paper layers overlap, glue wrinkles, and sticker gloss on small accents — real craft-table evidence, no digital smoothness.',
      palette: 'Bright construction-paper primaries — poster red, sunflower yellow, grass green, and sky blue — each shape one solid unmixed color with no gradients.',
      negative: 'Strictly flat paper: no 3D, no CGI, no clay or plasticine, no plastic toys, no photorealism, no photographic source material, no camera or lens effects, no digital painting, no dimensional rendering — only flat cut paper and stickers.',
    }),
  }),
  Object.freeze({
    id: 'clay-toy-3d', name: 'Clay & Toy 3D', group: 'illustrated',
    tagline: 'The deliberately 3D preset — stop-motion clay figures, toy dioramas, soft macro depth.',
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
    id: 'retro-pixel', name: 'Retro Pixel Art', group: 'illustrated',
    tagline: 'Chunky game-screen pixel art — strict grid, dithered shade, sprite drama. Pixels, never 3D.',
    swatch: Object.freeze(['#2b2d64', '#3ec54b', '#e832a0']),
    directive: Object.freeze({
      medium: 'Chunky low-resolution pixel art on a strict square grid — a hand-placed retro video-game scene with hard crisp pixel edges, never smooth vector art and never a photo.',
      subject: 'Characters and objects as expressive pixel sprites — blocky silhouettes a few dozen pixels tall with big theatrical poses and single-pixel eye details.',
      scene: 'A side-view or isometric game environment — tiled platforms, parallax skylines, glowing item pickups — staged like a dramatic paused moment in a level.',
      composition: 'The sprite scene anchored in the lower half like a level foreground, with a flat dithered sky band across the top kept clear for overlay text.',
      texture: 'Visible square pixels everywhere, ordered dithering for shading, deliberate aliasing on every edge — no smoothing, no anti-aliased curves.',
      palette: 'A limited 32-color retro console palette — deep indigo nights, emerald greens, and hot magenta accents with zero smooth gradients.',
      negative: 'Strictly hard-edged flat pixels: no 3D, no CGI, no clay, no plastic materials, no photorealism, no photographic textures, no camera or lens effects, no smooth anti-aliased curves, no painterly brushwork, no motion blur, no dimensional rendering.',
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
  if (style.mediumId) {
    const authority = style.photographic
      ? 'The selected medium is photographic, so describe physically plausible moments a camera could capture.'
      : `The selected medium is non-photographic and authoritative. Never use camera, lens, photorealistic, CGI, or generic 3D vocabulary unless the medium itself explicitly requires 3D. Hard medium constraints: ${style.negative}`
    return `${base} Selected combination: ${style.name}. ${style.directive} ${authority}`
  }
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
export const IMAGE_MEDIA = Object.freeze([
  Object.freeze({ id: 'photo-candid', name: 'Photo · Creator Candid', sourceStyleId: 'creator-candid', photographic: true }),
  Object.freeze({ id: 'photo-flash', name: 'Photo · Direct Flash', sourceStyleId: 'direct-flash', photographic: true }),
  Object.freeze({ id: 'photo-cinematic', name: 'Photo · Cinematic', sourceStyleId: 'cinematic', photographic: true }),
  Object.freeze({ id: 'flat-2d', name: 'Flat 2D Cartoon', sourceStyleId: 'cartoon-pop', photographic: false }),
  Object.freeze({ id: 'doodle', name: 'Hand-Drawn Doodle', sourceStyleId: 'hand-doodle', photographic: false }),
  Object.freeze({ id: 'comic', name: 'Comic Ink & Halftone', sourceStyleId: 'comic-ink', photographic: false }),
  Object.freeze({ id: 'paper', name: 'Cut-Paper Collage', sourceStyleId: 'paper-collage', photographic: false }),
  Object.freeze({ id: 'pixel', name: 'Retro Pixel Art', sourceStyleId: 'retro-pixel', photographic: false }),
  Object.freeze({ id: 'clay-3d', name: 'Clay & Toy 3D', sourceStyleId: 'clay-toy-3d', photographic: false }),
])

export const IMAGE_TREATMENTS = Object.freeze([
  Object.freeze({ id: 'clean', name: 'Clean', directive: 'Treatment: clean and intentional. Keep the medium legible and the story subject direct; add no meme damage or internet-chaos effects.' }),
  Object.freeze({ id: 'brainrot', name: 'Surreal Brainrot', directive: 'Treatment: surreal brainrot. Turn the subject into an absurd hybrid mascot with impossible pseudo-lore, wildly wrong scale, deadpan epic staging, shrine-like props, fake livestream UI fragments, and screenshot-of-a-screenshot energy. Apply all of this using only the selected rendering medium.' }),
  Object.freeze({ id: 'deep-fried', name: 'Deep-Fried', directive: 'Treatment: deep-fried meme. Push saturation, contrast, edge halos, compression blocks, repost damage, and reaction-image intensity while preserving the selected rendering medium.' }),
  Object.freeze({ id: 'cursed', name: 'Cursed', directive: 'Treatment: cursed and deliberately wrong. Use mismatched scale, contradictory shadows, awkward duplication, hard seams, and confident visual incoherence, all rendered natively in the selected medium.' }),
  Object.freeze({ id: 'y2k-chaos', name: 'Y2K Chaos', directive: 'Treatment: Y2K web chaos. Add chrome ornaments, sparkle bursts, gel-button shapes, cursor trails, checkerboard horizons, and candy cyber colors, translated into the selected rendering medium rather than replacing it.' }),
])

export const DEFAULT_IMAGE_MEDIUM_ID = 'photo-candid'
export const DEFAULT_IMAGE_TREATMENT_ID = 'clean'

export function getImageMedium(id) {
  return IMAGE_MEDIA.find((medium) => medium.id === clean(id)) || IMAGE_MEDIA.find((medium) => medium.id === DEFAULT_IMAGE_MEDIUM_ID)
}

export function getImageTreatment(id) {
  return IMAGE_TREATMENTS.find((treatment) => treatment.id === clean(id)) || IMAGE_TREATMENTS.find((treatment) => treatment.id === DEFAULT_IMAGE_TREATMENT_ID)
}

// New selections have two orthogonal axes. The rendering medium is authoritative:
// treatments may alter subject grammar and internet texture, but cannot replace
// flat drawing with photography or generic 3D. Bare legacy style ids remain
// supported for saved projects and older callers.
export function resolveImageStyle(selection = DEFAULT_IMAGE_STYLE_ID) {
  if (typeof selection === 'object' && selection?.mediumId) {
    const medium = getImageMedium(selection.mediumId)
    const treatment = getImageTreatment(selection.treatmentId)
    const source = getImageStyle(medium.sourceStyleId)
    const mediumDirective = styleDirective(source)
    const directive = `${mediumDirective} ${treatment.directive} Medium authority: ${source.directive.negative}`
    return {
      id: `${medium.id}+${treatment.id}`,
      mediumId: medium.id,
      treatmentId: treatment.id,
      name: treatment.id === 'clean' ? medium.name : `${medium.name} + ${treatment.name}`,
      group: 'composed',
      custom: '',
      photographic: medium.photographic,
      negative: source.directive.negative,
      directive,
    }
  }

  const styleId = typeof selection === 'string' ? selection : selection?.styleId ?? selection?.id
  const style = getImageStyle(styleId)
  const custom = typeof selection === 'object' ? clean(selection?.customText ?? selection?.custom) : ''
  return {
    id: style.id,
    name: style.name,
    group: style.group,
    custom: style.editable ? custom : '',
    photographic: style.group === 'capture',
    negative: style.directive?.negative || '',
    directive: styleDirective(style, custom),
  }
}
