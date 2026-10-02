import { Bricolage_Grotesque } from "next/font/google";

/**
 * The wordmark's face, Bricolage Grotesque (#460): the wordmark only (0h). `--font-brand`
 * resolves to the variable this call sets; `app/faces/ui.js` says why each face is a module
 * of its own and what #258 does with them.
 *
 * With its optical size: the design asks for 500 and 700 at optical sizes 12 to 96, and
 * `next/font` takes an axis only with the variable weight, so this is the variable face,
 * both of its axes, in one file. The rail and the sign-in screens both draw the wordmark,
 * so both layouts import it.
 */
export const brandFace = Bricolage_Grotesque({ subsets: ["latin"], axes: ["opsz"], variable: "--font-bricolage-grotesque" });
