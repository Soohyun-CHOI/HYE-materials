import { Fragment_Mono } from "next/font/google";

/**
 * The design's id face, Fragment Mono: ids and file names, and nothing else (0h).
 * `--font-id` resolves to the variable this call sets; `app/faces/ui.js` says why each
 * face is a module of its own and what #258 does with them.
 *
 * Loaded at the one weight the design sets it at (#459). It is not a variable font, so the
 * weight is named. The assets layout imports it; the sign-in screens draw no id and do not.
 */
export const idFace = Fragment_Mono({ subsets: ["latin"], weight: "400", variable: "--font-fragment-mono" });
