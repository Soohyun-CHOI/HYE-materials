import { Bricolage_Grotesque } from "next/font/google";

/**
 * The wordmark's face, Bricolage Grotesque (#460): the wordmark only (0h). `--font-brand`
 * resolves to the variable this call sets; `app/faces/ui.js` says why each face is a module
 * of its own, why none is swapped in late (#568) and why the root layout imports all three
 * (#258).
 *
 * With its optical size: the design asks for 500 and 700 at optical sizes 12 to 96, and
 * `next/font` takes an axis only with the variable weight, so this is the variable face,
 * both of its axes, in one file. The rail and the sign-in steps both draw the wordmark.
 */
export const brandFace = Bricolage_Grotesque({ subsets: ["latin"], axes: ["opsz"], display: "optional", variable: "--font-bricolage-grotesque" });
