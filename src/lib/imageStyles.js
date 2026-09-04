// Image-generation style system: user-selectable viral photography styles that
// materially change how the AI photographs every frame. This is deliberately a
// separate axis from the layout/typography presets in artDirection.js — those
// style the text overlay; these style the underlying photograph.

const clean = (value) => String(value ?? '').trim()

// Every fixed style must specify all six directive fields so the prompt
// changes subject treatment, environment, lighting, camera/lens, texture/color
// grading, and composition together — not just a color filter.
export const IMAGE_STYLE_FIELDS = Object.freeze(['subject', 'environment', 'lighting', 'camera', 'texture', 'composition'])

export const IMAGE_STYLES = Object.freeze([
  Object.freeze({
    id: 'creator-candid', name: 'Creator Candid',
    tagline: 'Phone-shot UGC realism — ambient light, lived-in scenes, camera-roll honesty.',
    swatch: Object.freeze(['#f3e7d6', '#dfb28c', '#8a6f57']),
    directive: Object.freeze({
      subject: 'A real person mid-action, caught between poses — imperfect hair, natural skin texture, a genuine unguarded expression with zero styling-team polish.',
      environment: 'Ordinary lived-in spaces: a cluttered bedroom desk, car interior, kitchen counter, or sidewalk café with believable everyday mess left in frame.',
      lighting: 'Unmodified ambient light — window light or mixed household lamps, slightly blown highlights, an auto-exposure look with mild white-balance drift.',
      camera: 'Vertical smartphone main camera, 26mm-equivalent wide lens, handheld with a slight tilt, everything roughly in focus with mild edge distortion.',
      texture: 'Light digital noise in the shadows, subtle smartphone HDR processing, true-to-life unglamorous color — the honest look of a camera roll, no cinematic grade.',
      composition: 'Slightly off-center casual framing cropped like a quick grab shot, with a plain uncluttered field above or below the subject left clear for overlay text.',
    }),
  }),
  Object.freeze({
    id: 'cinematic', name: 'Cinematic',
    tagline: 'Film-still drama — anamorphic depth, atmosphere, teal-and-amber grade.',
    swatch: Object.freeze(['#0b1e2d', '#14506b', '#e8862e']),
    directive: Object.freeze({
      subject: 'A protagonist treated like a movie still — deliberate blocking, controlled wardrobe tones, an emotionally loaded but restrained expression mid-story.',
      environment: 'Atmosphere-first locations: haze-filled rooms, rain-streaked windows, neon-edged streets at night, with strong foreground and background separation.',
      lighting: 'Motivated film lighting — a single hard key with deep falloff, practical sources visible in frame, volumetric light shafts cutting through haze.',
      camera: 'Anamorphic 40mm feel with shallow depth of field and oval bokeh, shot from a low or over-the-shoulder angle that implies an unseen scene partner.',
      texture: 'Filmic halation on highlights, fine 35mm grain, lifted blacks, and a graded teal-and-amber palette with crushed cinematic contrast.',
      composition: 'Widescreen sensibility inside the vertical frame: subject held to one third, the opposite third falling into deep clean darkness reserved for the overlay.',
    }),
  }),
  Object.freeze({
    id: 'flash-editorial', name: 'Flash Editorial',
    tagline: 'Hard direct flash, inky falloff, glossy backstage-tabloid punch.',
    swatch: Object.freeze(['#050505', '#3a3a3a', '#f2ede4']),
    directive: Object.freeze({
      subject: 'A styled subject shot paparazzi-close — confident direct gaze or caught-off-guard glamour, sharp wardrobe details, glossy specular skin highlights.',
      environment: 'Night streets, club corridors, hotel hallways, and blank walls that drop to black behind the flash pop — location reduced to a hard-lit backdrop.',
      lighting: 'Direct on-camera flash: a hard frontal blast, razor-edged shadows outlining the subject on the wall behind, everything past the flash falloff going dark.',
      camera: 'A 35mm point-and-shoot fired at close range, small aperture, deep focus front to back, tilted with tabloid urgency.',
      texture: 'High-contrast glossy grade, saturated color pop against inky blacks, faint film grain and the greasy sheen of an overexposed flash frame.',
      composition: 'A tight confrontational crop with the subject dominating one half, the flash-darkened remainder of the frame held as near-black space for the overlay.',
    }),
  }),
  Object.freeze({
    id: 'documentary', name: 'Documentary',
    tagline: 'Observed reportage — available light, honest texture, matte photo-essay tone.',
    swatch: Object.freeze(['#e9e4d8', '#a89f8d', '#4a463c']),
    directive: Object.freeze({
      subject: 'People and objects observed, never posed — hands at work, weathered surfaces, honest wear, a moment caught mid-task without awareness of the camera.',
      environment: 'Real workplaces and streets photographed as found: workshops, market rows, transit platforms, field sites — contextual detail preserved, nothing dressed.',
      lighting: 'Available light only — overcast daylight, humming fluorescent interiors, light spilling through a doorway; soft, truthful, and unglamorous.',
      camera: 'A classic 35mm reportage lens at eye or waist level, medium depth of field keeping the context readable, steady unhurried framing.',
      texture: 'A muted naturalistic grade with gentle grain, no gloss and no HDR — the tonality of a photo essay printed on matte stock.',
      composition: 'Layered frames with foreground context and the subject on a third, keeping a quiet stretch of sky, wall, or floor open for the overlay.',
    }),
  }),
  Object.freeze({
    id: 'y2k-internet', name: 'Y2K Internet',
    tagline: 'Digicam flash, candy gels, chrome-and-gloss 2000s web nostalgia.',
    swatch: Object.freeze(['#ff7ad9', '#7ad9ff', '#c8ff5e']),
    directive: Object.freeze({
      subject: 'A playful subject styled in glossy retro-tech kitsch — metallics, translucent plastics, butterfly clips, posed like an early webcam self-portrait.',
      environment: 'Bedrooms with inflatable furniture, CRT monitors and bead curtains, mirrored mall interiors, or an airbrushed studio sweep in bubblegum tones.',
      lighting: 'Hard compact-camera flash mixed with colored gels — cyan and hot-pink spill, blown highlights, the overexposed pop of an early-2000s digicam.',
      camera: 'An early digital point-and-shoot: 4-megapixel softness, strong flash vignette, slight motion smear, tilted high-angle MySpace-era framing.',
      texture: 'Oversharpened edges, JPEG artifacts, chromatic fringing, glittery bloom on highlights, a saturated candy-colored cast with silvery chrome accents.',
      composition: 'A centered-but-tilted subject with the kitsch clutter kept low in frame, preserving one clean overexposed hot spot as negative space for the overlay.',
    }),
  }),
  Object.freeze({
    id: 'luxury-minimal', name: 'Luxury Minimal',
    tagline: 'One hero subject, vast negative space, gallery-grade soft light.',
    swatch: Object.freeze(['#efe9df', '#d6cbb8', '#8f8577']),
    directive: Object.freeze({
      subject: 'A single hero subject treated like an object of desire — immaculate surfaces, precise styling, stillness and restraint instead of expression.',
      environment: 'Empty architectural space: a travertine plinth, seamless stone backdrop, raked sand, or a vast neutral wall with every extraneous object removed.',
      lighting: 'One large soft gradient light source with slow falloff, delicate long shadows, and a whisper of rim light — gallery-grade control, nothing harsh.',
      camera: 'Medium-format telephoto compression at 90mm-equivalent, a tack-sharp focus plane, tripod-still geometry with perfectly level verticals.',
      texture: 'Ultra-clean low-noise rendering of stone, silk, and brushed-metal micro-texture in a desaturated bone, greige, and espresso palette with one muted accent.',
      composition: 'Radical negative space — the subject occupies a small precise portion of the frame while a vast empty field above or below is reserved for the overlay.',
    }),
  }),
  Object.freeze({
    id: 'surreal-meme', name: 'Surreal Meme',
    tagline: 'Deadpan photoreal absurdity in flat, liminal stock-photo light.',
    swatch: Object.freeze(['#f4f0e6', '#ffd23f', '#3b6bd6']),
    directive: Object.freeze({
      subject: 'An ordinary subject pushed one degree into absurdity — wrong scale, a deadpan expression, one impossible-but-photoreal element played completely straight.',
      environment: 'Banal settings rendered uncanny: a fluorescent office, empty parking lot, beige living room, or supermarket aisle where a single element is quietly wrong.',
      lighting: 'Flat, even, almost clinical light — the affectless glow of corporate stock photography and liminal-space photos, with no dramatic shaping at all.',
      camera: 'A 50mm straight-on frontal view with deep focus and rigid symmetry, framed like evidence photography or a company brochure gone strange.',
      texture: 'A slightly-too-clean digital finish with mild compression artifacts and oversaturated primary colors against beige — the uncanny sheen of cursed stock imagery.',
      composition: 'A dead-centered subject under strict symmetry, with the empty institutional space above kept blank so the negative space reads as part of the joke and holds the overlay.',
    }),
  }),
  Object.freeze({
    id: 'custom', name: 'Custom',
    tagline: 'Write your own style direction — it drives every image prompt verbatim.',
    swatch: Object.freeze(['#e8e8e8', '#bdbdbd', '#7a7a7a']),
    editable: true,
    directive: null,
  }),
])

export const IMAGE_STYLE_IDS = Object.freeze(IMAGE_STYLES.map((style) => style.id))
export const DEFAULT_IMAGE_STYLE_ID = 'creator-candid'

export const CUSTOM_STYLE_PLACEHOLDER = 'e.g. Shot on expired 35mm film at a night market, sodium-vapor glow, motion blur on passing crowds, subject sharp and centered, top third kept dark and empty for text.'

// When Custom is selected but the direction box is empty, generation still
// needs a workable directive rather than silently reverting to a generic look.
const CUSTOM_FALLBACK_DIRECTIVE = 'Custom image style — Photorealistic vertical photography with a distinctive, deliberate look of your own choosing; strong single focal point, believable materials, and clear text-safe negative space preserved for a short overlay.'

export function getImageStyle(id) {
  return IMAGE_STYLES.find((style) => style.id === clean(id)) || IMAGE_STYLES.find((style) => style.id === DEFAULT_IMAGE_STYLE_ID)
}

// Render one style's structured fields into the single prompt directive that
// every meta/muse-image request embeds.
export function styleDirective(style, customText = '') {
  const resolved = getImageStyle(style?.id ?? style)
  if (resolved.editable) {
    const text = clean(customText)
    return text ? `Custom image style — ${text}` : CUSTOM_FALLBACK_DIRECTIVE
  }
  const d = resolved.directive
  return `${resolved.name} image style — Subject treatment: ${d.subject} Environment: ${d.environment} Lighting: ${d.lighting} Camera and lens: ${d.camera} Texture and color grade: ${d.texture} Composition: ${d.composition}`
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
    custom: style.editable ? custom : '',
    directive: styleDirective(style, custom),
  }
}
