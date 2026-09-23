/**
 * Where the invoice file pane sits, and the one width that decides it (#422).
 *
 * THE BREAKPOINT IS IN THIS FILE AND NOWHERE ELSE, for the reason `LIST_PAGE_SIZE`
 * is (#326): it is a value the design pass will move, and a width spelled once per
 * class string is a search rather than an edit. It is `xl` — 80rem, 1280px — and it
 * was chosen by subtraction rather than by taste. The page's own column is
 * `max-w-2xl` with `p-8`, which is 38rem/608px of form inside 42rem of container, so
 * a viewport of 1280 leaves 1216 inside the padding, 608 to the form, 32 to the gap
 * and 576 to the pane — 561 measured, the rest being the scrollbar this form always
 * has. That is about three quarters of a US Letter page's width. At `lg` (1024) the
 * same subtraction leaves 320, which is not a document.
 *
 * NOTHING BELOW THAT WIDTH CHANGES, WHICH IS THE ISSUE'S OWN SECOND SENTENCE. Every
 * class here is behind the `xl:` variant, so under it the page is the single column
 * it already was and the pane is `display: none` — the form's own classes are
 * untouched at every width.
 *
 * AND THE FORM IS THE SAME WIDTH ON BOTH SIDES OF THE BREAKPOINT, which is what the
 * column below is `38rem` rather than `42rem` for. Measured, because the first
 * arithmetic was wrong and the browser said so: at 1279 the form measures 608px,
 * being the 42rem cap less the page's own `p-8` on each side, and a 42rem column put
 * that padding outside it and handed the form 672 — so crossing the breakpoint
 * widened every field inside it by 64px. The page gains a column; the form does not
 * change.
 *
 * THE PANE IS HIDDEN BY CSS RATHER THAN DROPPED BY JAVASCRIPT. Only the browser
 * knows the viewport, so deciding this in the component would mean a `matchMedia`
 * subscription and a first render that has to guess — the same shape `Instant`
 * carries for a reader's time zone, for a fact that CSS answers on its own. What it
 * costs is a frame in the document that nobody sees, which is local bytes and no
 * request: the pane's address is an object URL for a file already in the browser.
 */

/**
 * On the page's own container: it widens only while a pane is in it.
 *
 * `:has()` rather than a prop, because the container is a Server Component and
 * whether a file is attached is client state (`app/invoices/new/page.js` renders the
 * heading and the notice, and only `InvoiceForm` knows about the file). The
 * alternative was moving the heading into the client so one component could hold
 * both, which is a restructuring of the screen to carry one class.
 *
 * **The token below and the key of `FILE_PANE_MARK` are one string**, and they are
 * adjacent here because nothing can bind them: a Tailwind class is matched in the
 * source as a literal, so the selector cannot interpolate the attribute name.
 */
export const PAGE_WIDE_WHEN_PANE = "xl:has-[[data-invoice-file-pane]]:max-w-[96rem]";

/** What the pane is recognized by. Spread onto it; read by the class above. */
export const FILE_PANE_MARK = { "data-invoice-file-pane": "" };

/**
 * The two columns, applied only while there is a second one to draw.
 *
 * Never unconditional: with one child the form's column still takes the gap out of
 * the row, so a form with no file attached would be narrower above the breakpoint
 * than below it — which is the same defect the column's own width above fixes, from
 * the other direction.
 *
 * THE DOCUMENT IS THE LEFT COLUMN AND THE FORM THE RIGHT, which is the whole of what
 * the sides decide: the form keeps its 38rem either way and the pane takes what is
 * left, so nothing about the widths follows from the order.
 */
export const FORM_COLUMNS = "xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,38rem)] xl:gap-8";

/**
 * Which column each one sits in, since the FORM COMES FIRST IN THE DOCUMENT and the
 * pane is drawn to its left.
 *
 * THAT ORDER IS FOR THE KEYBOARD RATHER THAN FOR THE CSS. Reordering the elements
 * would need no placement classes at all, and it would put a PDF frame — which in a
 * browser's own viewer is several focusable controls, not one stop — between the
 * reader and every field of the longest form in the app. The pane is reference
 * material with nothing to fill in, so it goes last in the order things are reached
 * and first in the order they are read. What that costs is one element whose visual
 * position is not its focus position, and it is the pane rather than anything a
 * reader acts on.
 *
 * Both are `xl:`-scoped and both name their row, because auto-placement would
 * otherwise put the second child on a second row once the first is placed by hand.
 * They are inert wherever the wrapper is not a grid, which is every width below the
 * breakpoint and every state with no file attached.
 */
export const FORM_COLUMN = "xl:col-start-2 xl:row-start-1";
export const PANE_COLUMN = "xl:col-start-1 xl:row-start-1";

/**
 * The pane itself.
 *
 * STICKY IS WHAT THE ISSUE IS FOR, rather than a refinement of it. The items are
 * copied a figure at a time down a form that is several screens long, so a pane that
 * scrolls away with the header is a pane that is gone for the whole of the work it
 * exists for. `top-8` is the page's own `p-8`, and the height is the viewport less
 * that padding top and bottom.
 *
 * No `items-start` on the grid above, for this: a column shrunk to its content is
 * never taller than what is stuck inside it, and sticky does nothing.
 */
export const FILE_PANE = `hidden xl:sticky xl:top-8 xl:flex xl:h-[calc(100vh_-_4rem)] xl:flex-col ${PANE_COLUMN}`;
