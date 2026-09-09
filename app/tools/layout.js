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
 * #258 is what fills it, and this one element is the whole of what it has to
 * reach for the tools axis.
 *
 * These screens are the only ones in the app used at a phone width as well as at
 * a monitor: a tool is entered and its labels printed at a desk, and a tool item
 * is scanned on site. `docs/notes/tools.md` carries that derivation.
 */
export default function ToolsLayout({ children }) {
    return <div>{children}</div>;
}
