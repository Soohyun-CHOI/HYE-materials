import { Instrument_Sans } from "next/font/google";

/**
 * The design's UI face, Instrument Sans: everything but ids, file names and the wordmark
 * (0h). `--font-ui` in `app/designValues.css` resolves to the variable this call sets.
 *
 * ONE FACE, ONE MODULE, ONE CALL, AND A LAYOUT IMPORTS THE FACES ITS SCREENS DRAW (#473).
 * The tools layout loaded all three faces itself until the sign-in screens needed two of
 * them under a layout of their own. A second call in that layout would have been a second
 * copy of this one's options — a `next/font` call takes literals only, so the two could
 * not share them — and one module holding all three would have handed the sign-in screens
 * the id face they never draw, preloaded. So each face is a module and each layout imports
 * the ones its screens read; `offline/design-values.mjs` holds that every face read on an
 * axis is loaded by a module that axis reaches. **#258 moves the variable classes to the
 * root layout's element** and both layouts stop applying them, with these three modules
 * unchanged.
 *
 * LOADING ONE STYLES NOTHING (#456). The call defines the variable on whichever element
 * carries `uiFace.variable`; only what asks for `font-ui` draws in the face. It is a
 * variable font, so the three weights the design uses — 400, 500 and 600 — are one file.
 */
export const uiFace = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument-sans" });
