import { Fragment_Mono, Instrument_Sans } from "next/font/google";

/**
 * The layout every tools screen renders inside (#336).
 *
 * THE CONTAINER BELOW IS THE ONLY WIDTH CONTAINER ON THIS AXIS, and that is the
 * whole reason this file exists. The screens above the tools track declare one
 * inside their own page instead — eighteen of the twenty-one do, twenty-two
 * declarations in all — so a width settled for that axis lands in about as many
 * places as it has pages. Here it lands in one.
 *
 * A TOOLS PAGE MUST NOT DECLARE A WIDTH OF ITS OWN. Nothing fails when one does:
 * the page simply renders at a width this layout did not choose, and the axis
 * quietly has two containers again. That is the state this file is here to
 * prevent, and the prevention is this sentence rather than a check — a file-only
 * check cannot tell a page's container from a `max-w-full` on an image.
 *
 * AND THE BOX UNDER `<body>` IS THIS LAYOUT'S RATHER THAN A PAGE'S, which is the
 * same rule seen from the other side. `<body>` is `min-h-full flex flex-col`, so
 * the flex item is the container below and a tools page renders inside it, its
 * own root element an ordinary block. `flex-1` on a tools page's root therefore
 * does nothing, and anything about the axis's own box — filling the height, for
 * one — is decided here. **Somebody will copy the two screens that do it the
 * other way:** `/` and `/login` put `flex-1` on their own root div to fill the
 * height, and it works there because on that axis the page's root IS the flex
 * item. This paragraph is reasoned from the rendered DOM rather than measured —
 * `body > div > h1` was read in a browser, and the rest follows from it in CSS.
 *
 * IT IS EMPTY ON PURPOSE, AND THE EMPTINESS IS NOT A GAP TO FILL IN PASSING.
 * #336 settles WHERE the width is decided and decides no value. Nothing about
 * this app's appearance was designed, so a width, a padding or a type value
 * chosen here would become the baseline a design has to justify departing from —
 * which is exactly what `docs/briefs/_shared.md` opens by saying it is not.
 * The issues that apply the design's values to this axis fill it, reading the
 * names `app/designValues.css` declares (#462), and this one element is the whole
 * of what they have to reach for the axis's width.
 *
 * THE DESIGN'S FACES ARE LOADED HERE, AND LOADING ONE STYLES NOTHING (#456). Each
 * `next/font` call below defines the variable its face resolves to — `--font-ui`
 * reads `--font-instrument-sans` — on this one element, so everything on the axis
 * can take the face and nothing does until it asks for it: the registration dialog
 * sets `font-ui`, and the screens behind it keep the face they have until #463
 * gives them the look. **This is the one place a face is loaded for the tools
 * screens**: #459's Fragment Mono joined it here, for the ids a landing's notice
 * lists, rather than in the file that first reads it, and #460's joins it the same
 * way; `offline/design-values.mjs` holds that a face read on this axis has a
 * loader only this axis reaches, and #258 moves the lot to the root layout, where
 * Geist's two calls are today. What reaches past this element is only what is a
 * DOM descendant of it — a dialog or a list in the top layer is still one, which
 * is why a face reaches them. The label's Inconsolata stays on its own page:
 * it is the label's measured face and not the design's (`tools.md`).
 *
 * These screens are the only ones in the app used at a phone width as well as at
 * a monitor: a tool is entered and its labels printed at a desk, and a tool item
 * is scanned on site. `docs/notes/tools.md` carries that derivation.
 */

// The design's UI face, all of its weights at once: it is a variable font, so the
// three the design uses — 400, 500 and 600 — are one file.
const uiFace = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument-sans" });

// The design's id face, in the one weight the design sets it at (#459). It is not a
// variable font, so the weight is named.
const idFace = Fragment_Mono({ subsets: ["latin"], weight: "400", variable: "--font-fragment-mono" });

export default function ToolsLayout({ children }) {
    return <div className={`${uiFace.variable} ${idFace.variable}`}>{children}</div>;
}
