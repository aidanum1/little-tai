import { loadFont as loadCaveat } from "@remotion/google-fonts/Caveat";
import { loadFont as loadCormorant } from "@remotion/google-fonts/CormorantGaramond";
import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces";
import { loadFont as loadJost } from "@remotion/google-fonts/Jost";

export { PALETTE } from "./characters/figures";

const fraunces = loadFraunces("italic", { weights: ["300", "400", "600"], subsets: ["latin"] });
const frauncesUpright = loadFraunces("normal", { weights: ["400", "600"], subsets: ["latin"] });
const cormorant = loadCormorant("normal", { weights: ["500", "600", "700"], subsets: ["latin"] });
const cormorantItalic = loadCormorant("italic", { weights: ["500"], subsets: ["latin"] });
const jost = loadJost("normal", { weights: ["300", "400", "500"], subsets: ["latin"] });
const caveat = loadCaveat("normal", { weights: ["400", "600"], subsets: ["latin"] });

export const FONTS = {
  /** Wordmark "little TAI" — soft, warm display serif (use italic). */
  display: fraunces.fontFamily,
  /** Edition names, taglines — elegant high-contrast serif. */
  serif: cormorant.fontFamily,
  /** Small labels, tracking caps. */
  sans: jost.fontFamily,
  /** Handwritten love-note motifs on box 02. */
  hand: caveat.fontFamily,
};

export const fontsReady = () =>
  Promise.all([fraunces, frauncesUpright, cormorant, cormorantItalic, jost, caveat].map((f) => f.waitUntilDone()));
