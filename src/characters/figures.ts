/**
 * Single source of truth for the five editions of "little TAI — The Feelings Collection".
 * Imported by the Remotion scenes (art direction) and by the Tripo pipeline in scripts/ (prompts).
 * Keep this file free of browser- or Node-only imports.
 */

export const PALETTE = {
  midnight: "#181D27",
  burgundy: "#7A2739",
  powder: "#8FBCE7",
  cream: "#ECE6D9",
  forest: "#526047",
  gold: "#C4A66D",
} as const;

export type EditionId = "dreamer" | "shy" | "rebel" | "wanderer" | "midnight";

export type PoseId = "star-up" | "hands-together" | "pocket-tilt" | "suitcase" | "red-star";

export type BoxStyle = "tuck" | "flaps" | "pop" | "luxe";

export interface Expression {
  /** Iris offset inside the eye, in eye-widths (x: + = figure's left/viewer right, y: + = up). */
  gaze: [number, number];
  /** 0 = wide open, 1 = closed. Upper-lid coverage. */
  lid: number;
  /** Mouth curve: + smile, - pout. */
  smile: number;
  /** Asymmetric lift of one mouth corner (smirk). */
  smirk: number;
  /** Mouth width relative to default. */
  mouthWidth: number;
  /** Cheek blush strength 0..1. */
  blush: number;
  /** Head rotation [pitch, yaw, roll] in radians. */
  head: [number, number, number];
}

export interface Outfit {
  coat: string;
  coatLength: "standard" | "long";
  sweater: string;
  shirt: string;
  shirtStripe: string;
  trousers: string;
  shoes: string;
  scarf?: string;
  /** Diagonal glitter panel on the coat front (Midnight Star). */
  panel?: string;
  buttons: string;
}

export interface BoxDesign {
  style: BoxStyle;
  base: string;
  ink: string;
  accent: string;
  interior: string;
  motif: "stars" | "love-notes" | "silver-stars" | "landscapes" | "celestial";
  tagline: string;
}

export interface Edition {
  id: EditionId;
  index: number;
  number: string;
  name: string;
  label: string;
  secret: boolean;
  mood: [string, string, string];
  feeling: string;
  rarity: string;
  palette: { primary: string; secondary: string; accent: string; glow: string };
  outfit: Outfit;
  pose: PoseId;
  expression: Expression;
  box: BoxDesign;
  /** Reference photos (in public/photos) used for this edition's concept image. */
  referencePhotos: string[];
  /** Edition-specific part of the image-to-image prompt. image[1] is always the master reference. */
  conceptPrompt: string;
}

const coat = "#3B3E46";

export const EDITIONS: Edition[] = [
  {
    id: "dreamer",
    index: 0,
    number: "01",
    name: "THE DREAMER",
    label: "01 — THE DREAMER",
    secret: false,
    mood: ["innocent", "dreamy", "nostalgic"],
    feeling: "For the nights you wish on something small and bright.",
    rarity: "1 / 4",
    palette: { primary: PALETTE.powder, secondary: PALETTE.cream, accent: "#26355A", glow: "#BFE0FF" },
    outfit: {
      coat,
      coatLength: "standard",
      sweater: PALETTE.burgundy,
      shirt: "#9CC3EA",
      shirtStripe: "#3E6FB0",
      trousers: "#2A2D35",
      shoes: "#1C1B1F",
      buttons: "#C9CCD3",
    },
    pose: "star-up",
    expression: { gaze: [0.05, 0.28], lid: 0.18, smile: 0.15, smirk: 0, mouthWidth: 0.8, blush: 0.55, head: [-0.16, 0.12, 0.03] },
    box: {
      style: "tuck",
      base: "#A9CBEC",
      ink: "#1E2B4A",
      accent: PALETTE.cream,
      interior: "#E9F2FB",
      motif: "stars",
      tagline: "a small wish, held gently",
    },
    referencePhotos: ["tai_01.jpg", "tai_02.jpg"],
    conceptPrompt:
      "Edition 'The Dreamer'. Keep the exact same character from image[1]. Expression: soft, thoughtful gaze looking slightly upward, lips gently closed, faint blush. Pose: standing, his right hand raised to chest height holding a small translucent powder-blue star, the other arm relaxed at his side. Outfit unchanged: oversized charcoal wool coat, burgundy sweater, blue striped shirt collar. Accent colors powder blue, cream and deep navy.",
  },
  {
    id: "shy",
    index: 1,
    number: "02",
    name: "THE SHY ONE",
    label: "02 — THE SHY ONE",
    secret: false,
    mood: ["tender", "sweet", "quietly emotional"],
    feeling: "For the words you folded up and never sent.",
    rarity: "1 / 4",
    palette: { primary: "#D9A5AE", secondary: "#F4EEE6", accent: PALETTE.burgundy, glow: "#FFD3DB" },
    outfit: {
      coat,
      coatLength: "standard",
      sweater: PALETTE.burgundy,
      shirt: "#F1ECE4",
      shirtStripe: "#D9A5AE",
      trousers: "#2A2D35",
      shoes: "#1C1B1F",
      buttons: "#E9D7D2",
    },
    pose: "hands-together",
    expression: { gaze: [0.32, -0.04], lid: 0.22, smile: 0.35, smirk: 0.08, mouthWidth: 0.7, blush: 0.95, head: [0.1, -0.2, -0.07] },
    box: {
      style: "flaps",
      base: "#D9A5AE",
      ink: "#5E1F2E",
      accent: "#FBF4EC",
      interior: "#FBEFF1",
      motif: "love-notes",
      tagline: "a letter you never sent",
    },
    referencePhotos: ["tai_04.jpg", "tai_02.jpg"],
    conceptPrompt:
      "Edition 'The Shy One'. Keep the exact same character from image[1]. Expression: a small hesitant smile, eyes glancing to the side, stronger pink blush. Pose: both small hands held together in front of his waist holding a tiny ivory folded letter, shoulders slightly drawn inward, head tilted down a little. A tiny pale-pink heart charm pinned to the coat. Outfit: the same charcoal coat over a burgundy sweater and ivory collared shirt. Accent colors dusty pink, burgundy and ivory.",
  },
  {
    id: "rebel",
    index: 2,
    number: "03",
    name: "THE LITTLE REBEL",
    label: "03 — THE LITTLE REBEL",
    secret: false,
    mood: ["playful", "mysterious", "fashionable"],
    feeling: "For the days you'd rather be a little bit trouble.",
    rarity: "1 / 4",
    palette: { primary: PALETTE.burgundy, secondary: "#C9CDD6", accent: "#15161A", glow: "#E9EEF8" },
    outfit: {
      coat: "#24262C",
      coatLength: "standard",
      sweater: PALETTE.burgundy,
      shirt: "#2E3038",
      shirtStripe: "#4A4D57",
      trousers: "#1B1C21",
      shoes: "#0E0E11",
      buttons: "#C9CDD6",
    },
    pose: "pocket-tilt",
    expression: { gaze: [0, 0.02], lid: 0.38, smile: 0.25, smirk: 0.55, mouthWidth: 0.85, blush: 0.35, head: [0.02, 0.1, 0.13] },
    box: {
      style: "pop",
      base: "#7A2739",
      ink: "#F2EEF4",
      accent: "#C9CDD6",
      interior: "#2A1218",
      motif: "silver-stars",
      tagline: "a little bit of trouble",
    },
    referencePhotos: ["tai_05.jpg", "tai_03.jpg"],
    conceptPrompt:
      "Edition 'The Little Rebel'. Keep the exact same character from image[1]. Expression: slightly mischievous smirk, direct confident gaze at the viewer, head tilted a little to one side. Pose: one hand tucked inside his coat pocket, the other arm relaxed. Outfit: darker version — near-black charcoal coat, dark shirt, subtle burgundy sweater accents, a small polished metallic silver star pin on the coat lapel. Accent colors charcoal, black, burgundy and silver.",
  },
  {
    id: "wanderer",
    index: 3,
    number: "04",
    name: "THE WANDERER",
    label: "04 — THE WANDERER",
    secret: false,
    mood: ["nostalgic", "adventurous", "poetic"],
    feeling: "For every somewhere you haven't been yet.",
    rarity: "1 / 4",
    palette: { primary: PALETTE.forest, secondary: PALETTE.cream, accent: "#1D2A4A", glow: "#F6E7C4" },
    outfit: {
      coat,
      coatLength: "long",
      sweater: "#25335A",
      shirt: "#EDE5D3",
      shirtStripe: "#8FA0C4",
      trousers: "#2A2D35",
      shoes: "#3A2A22",
      scarf: PALETTE.forest,
      buttons: "#D8CCB0",
    },
    pose: "suitcase",
    expression: { gaze: [-0.24, 0.12], lid: 0.12, smile: 0.08, smirk: 0, mouthWidth: 0.7, blush: 0.5, head: [-0.06, -0.24, -0.02] },
    box: {
      style: "tuck",
      base: "#5B6B4F",
      ink: "#F3ECDD",
      accent: "#E9D9B4",
      interior: "#EFE8D8",
      motif: "landscapes",
      tagline: "somewhere you haven't been",
    },
    referencePhotos: ["tai_03.jpg", "tai_01.jpg"],
    conceptPrompt:
      "Edition 'The Wanderer'. Keep the exact same character from image[1]. Expression: curious, distant gaze looking off to the side as if seeing somewhere new. Pose: standing as though about to set off, one hand holding a small cream-colored vintage suitcase at his side, a tiny folded paper star tucked into the suitcase strap. Outfit: a longer charcoal coat reaching below the knees, midnight-blue sweater, cream collared shirt, a forest-green knitted scarf. Accent colors forest green, midnight blue and warm cream.",
  },
  {
    id: "midnight",
    index: 4,
    number: "???",
    name: "THE MIDNIGHT STAR",
    label: "??? — SECRET EDITION",
    secret: true,
    mood: ["quiet", "mysterious", "elegant"],
    feeling: "For the feeling that only shows up after dark.",
    rarity: "SECRET · 1 / 144",
    palette: { primary: "#0B0B10", secondary: PALETTE.gold, accent: "#8E1B2E", glow: "#FF3B4E" },
    outfit: {
      coat: "#0F1015",
      coatLength: "long",
      sweater: "#141519",
      shirt: "#1A1B21",
      shirtStripe: "#25262E",
      trousers: "#0E0F13",
      shoes: "#0A0A0C",
      panel: "#8E1B2E",
      buttons: PALETTE.gold,
    },
    pose: "red-star",
    expression: { gaze: [0.02, -0.02], lid: 0.42, smile: 0.06, smirk: 0.12, mouthWidth: 0.72, blush: 0.25, head: [0.06, 0.05, -0.04] },
    box: {
      style: "luxe",
      base: "#0C0C11",
      ink: PALETTE.gold,
      accent: "#E3C98F",
      interior: "#2A0A12",
      motif: "celestial",
      tagline: "only after midnight",
    },
    referencePhotos: ["tai_09.jpg", "tai_07.jpg", "tai_08.jpg"],
    conceptPrompt:
      "Secret Edition 'The Midnight Star' — the rare chase figure, noticeably more elaborate and luxurious. Keep the exact same character from image[1], and take the outfit from image[2] and image[3]: a black long coat and dark shirt with a deep-red shimmering glitter panel running diagonally down the front. Material: deep midnight-black glossy vinyl, burgundy translucent accents, tiny metallic gold star details scattered on the coat, subtle pearlescent highlights on the black hair. Expression: quiet, mysterious and elegant, calm half-lidded eyes. Pose: standing calmly, holding a glowing translucent dark-red star at chest height.",
  },
];

export const STANDARD_EDITIONS = EDITIONS.filter((e) => !e.secret);
export const SECRET_EDITION = EDITIONS.find((e) => e.secret)!;

export const getEdition = (id: EditionId): Edition => {
  const edition = EDITIONS.find((e) => e.id === id);
  if (!edition) {
    throw new Error(`Unknown edition ${id}`);
  }
  return edition;
};

/** Shared identity brief used for the master reference and repeated in every edition prompt. */
export const CHARACTER_IDENTITY =
  "A premium designer art-toy collectible figurine of the young man shown in the reference photos, original stylized interpretation that keeps his recognizable likeness: soft youthful slender oval face with a small chin, distinctive black layered hair with a long piecey fringe that falls to his eyelashes and completely hides the eyebrows, longer layers over the ears and nape; gentle dark almond-shaped eyes that are slightly narrow and softly downturned with soft single eyelids (not big round anime eyes); small delicate nose; natural soft relaxed lips; calm, gentle, slightly introspective and dreamy expression — never frowning or stern. About 2.7 heads tall: oversized but balanced head, compact body, small hands and small shoes. Softly sculpted hair strands, carefully painted eyes, subtle blush, rounded polished silhouette, soft matte vinyl with satin highlights. Cute but sophisticated, slightly melancholic, Japanese storybook sensibility. Not anime, not chibi, not a Funko Pop — a distinctive premium designer-toy look.";

export const PRODUCT_SHOT_RULES =
  "Full body, one single figure, standing upright facing the camera in a near-front three-quarter view, arms slightly away from the body so the silhouette is unobstructed, head and both shoes completely visible with space around them, no base or stand, plain seamless light warm-grey studio background, soft even studio lighting, sharp focus, product photography of a real vinyl collectible. No text, no logo, no watermark, no frame, no other people.";

export const MASTER_PROMPT = `${CHARACTER_IDENTITY} Use image[1] and image[2] for his face and hair, and image[3] for the outfit: oversized charcoal wool coat, burgundy knit sweater, blue striped shirt collar, dark trousers, small black shoes. Neutral calm pose, arms relaxed. ${PRODUCT_SHOT_RULES}`;

/**
 * Second master pass: image[1] (master-base) supplies the art-toy proportions, pose and vinyl material,
 * image[2]/image[3] supply the likeness. Instruction-following models otherwise drift to a realistic doll.
 */
export const MASTER_REFINE_PROMPT = `Image[1] is a designer vinyl art-toy figurine. Keep its exact proportions — about 2.7 heads tall with an oversized head, compact short body, short legs, small hands and small shoes — and keep its pose, framing, soft matte vinyl material, sculpted hair-strand style, outfit and plain studio background. Redesign only the face and hairstyle so the figurine clearly resembles the young man in image[2] and image[3]: his slender soft oval face and small chin, his black layered hair with a long piecey fringe falling to the eyelashes and hiding the eyebrows, longer layers over the ears and nape, his gentle slightly narrow almond eyes with soft single eyelids, small delicate nose and soft natural lips with a calm, faintly dreamy expression. Keep the features stylized and toy-like (painted eyes with small highlights, smooth vinyl skin, subtle blush) — not realistic skin, not a ball-jointed doll, not anime. ${PRODUCT_SHOT_RULES}`;

/** Game asset sheet: same character, neutral T-pose with empty hands so Tripo can auto-rig cleanly. */
export const GAME_POSE_PROMPT =
  "The exact same character as image[1] — identical face, hair, outfit colors, 2.7-heads-tall art-toy proportions and vinyl material — redrawn as a clean 3D-rigging reference: standing straight, facing the camera directly front-on, arms stretched out horizontally to the sides in a T-pose with open empty hands (remove any held props, pins that stick out, bags and suitcases), legs straight and slightly apart, feet flat, no base or stand, full body visible from the top of the hair to the shoes with space around it, plain light-grey studio background, even lighting, no text.";

export const editionPrompt = (edition: Edition) =>
  `${edition.conceptPrompt} Image[1] is the master figurine: the face, head size, hair silhouette, eye style, 2.7-heads-tall body proportions, short legs and vinyl material must match image[1] exactly — it is the same collectible toy in a new edition. ${PRODUCT_SHOT_RULES}`;
