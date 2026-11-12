import { Instrument_Sans } from "next/font/google";

/**
 * The design's UI face, Instrument Sans: everything but ids, file names and the wordmark
 * (0h). `--font-ui` in `app/designValues.css` resolves to the variable this call sets.
 *
 * ONE FACE, ONE MODULE, ONE CALL (#473), AND THE ROOT LAYOUT IMPORTS ALL THREE (#258). The
 * assets layout loaded all three faces itself until the sign-in screens needed two of them
 * under a layout of their own; a second call there would have been a second copy of this
 * one's options — a `next/font` call takes literals only, so the two could not share them —
 * so each face became a module and each layout imported the ones its screens read. Since
 * #258 one layout holds every screen and sets every face's variable on `<html>`, so every
 * route preloads all three, the sign-in steps the id face they do not draw among them; the
 * modules stayed apart, which costs nothing and keeps each call's options beside its face.
 * `offline/design-values.mjs` holds that the root layout is the one file importing them and
 * that every face loaded is read.
 *
 * LOADING ONE STYLES NOTHING (#456). The call defines the variable on whichever element
 * carries `uiFace.variable`; only what asks for `font-ui` draws in the face, and since #258
 * that is `<body>`, so every word inherits it. It is a variable font, so the three weights
 * the design uses — 400, 500 and 600 — are one file.
 *
 * A FACE THAT ARRIVES LATE IS NOT SWAPPED IN (#568): `display: "optional"`, where next/font's
 * own is `swap`. Swapped in after the first paint, the face moved every line drawn in its
 * fallback — `next/font`'s Arial with the face's metrics, which Safari takes only the width of
 * and a phone with no Arial does not take at all — so the text jumped on a phone's first,
 * slow load. An optional face is used if it is there within the first moment and otherwise
 * not for that page, which the next load then has from the cache. All three faces take it,
 * so no line on one screen swaps while another does not.
 */
export const uiFace = Instrument_Sans({ subsets: ["latin"], display: "optional", variable: "--font-instrument-sans" });
