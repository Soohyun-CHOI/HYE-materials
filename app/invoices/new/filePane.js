/**
 * The invoice file's own column: where it sits, the one width that decides it, and
 * the words it says (#422).
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
 * it already was, the pane is `display: none`, and the file is attached by the
 * control the `Invoice File` section has always carried. The form's own classes are
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
 * THE COLUMN IS THERE BEFORE THE FILE IS, AND THAT IS WHY NOTHING HERE IS
 * CONDITIONAL ANY MORE. The pane opened as a preview that appeared once a file was
 * attached, which meant the page widened under the reader and the form slid sideways
 * at the moment of attaching — measured at 1440, from x=409 to x=785. It is the file
 * CONTROL now: an empty box that says to drop a file on it or click it, in the exact
 * place and at the exact size the document will occupy. So the two columns are drawn
 * from the first paint, the form never moves, and `_shared.md`'s rule about
 * reserving space for a conditional is not in play — what is always there is an
 * action rather than a fact that is usually absent.
 *
 * THE PANE IS HIDDEN BY CSS RATHER THAN DROPPED BY JAVASCRIPT. Only the browser
 * knows the viewport, so deciding this in the component would mean a `matchMedia`
 * subscription and a first render that has to guess — the same shape `Instant`
 * carries for a reader's time zone, for a fact that CSS answers on its own.
 */

/**
 * On the page's own container, which is a Server Component and stays one.
 *
 * It was `xl:has-[[data-invoice-file-pane]]:max-w-[96rem]` while the pane came and
 * went with the file, so that the width could follow client state without the
 * heading moving into the client. The box is unconditional now, so the container is
 * simply wider at that width and the `:has()` went with the state it was reading.
 */
export const PAGE_WIDE = "xl:max-w-[96rem]";

/**
 * The two columns. The document is the left one and the form the right.
 *
 * The sides decide nothing about the widths — the form keeps its 38rem either way
 * and the pane takes what is left — so what they decide is reading order: the source
 * on the left, the transcription of it on the right.
 */
export const FORM_COLUMNS = "xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,38rem)] xl:gap-8";

/**
 * Which column each one sits in, since the FORM COMES FIRST IN THE DOCUMENT and the
 * pane is drawn to its left.
 *
 * THAT ORDER IS FOR THE KEYBOARD RATHER THAN FOR THE CSS. Reordering the elements
 * would need no placement classes at all, and it would put the file box, the drawn
 * document and the toolbar under it — several stops since #433, not one — between the
 * reader and every field of the longest form in the app. The pane holds the document
 * and the controls that move it; the form is the work. So the pane
 * goes last in the order things are reached and first in the order they are read,
 * and the one element whose visual position is not its focus position is the one
 * nobody types into.
 *
 * Both name their row, because auto-placement would otherwise put the second child
 * on a second row once the first is placed by hand.
 */
export const FORM_COLUMN = "xl:col-start-2 xl:row-start-1";
export const PANE_COLUMN = "xl:col-start-1 xl:row-start-1";

/**
 * The column itself.
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

/**
 * The rect the box and the document share, above the file control.
 *
 * ONE RECT IN EVERY STATE IS #422's OWN WORDS — an empty box at the document's size,
 * and then the document in the same place at the same size. What stands in the way is
 * one row: since #433 a drawn file has a toolbar under it — the page it is on, the
 * zoom, `Fit width` and `Rotate` — inside the same column, so a file with its toolbar
 * would be drawn a toolbar shorter than the box it replaced.
 *
 * SO THE ROW IS PART OF THE SLOT RATHER THAN TAKEN OUT OF THE DOCUMENT, the answer
 * #422 gave the frame's standing sentence, which #433 removed. With a file in it, the
 * slot holds the file and its toolbar; with nothing, it holds the box and leaves that
 * row empty. Every state draws the file's rect at one size, and the toolbar arrives in
 * a row that was already there rather than pushing the file up.
 */
export const FILE_SLOT = "flex min-h-0 flex-1 flex-col";

/**
 * The toolbar's row: under the drawn file, over the file control.
 *
 * UNDER THE FILE RATHER THAN OVER IT, because the empty state has to leave the same
 * row empty and an empty strip above the box reads as a gap in the page, where one
 * under it reads as the space the control below already has. It also puts every
 * control this column has in one band at its foot.
 *
 * `h-9` BECAUSE THAT IS THE BUTTON. `FileControls.js`'s control is `py-1.5` and
 * `text-sm` inside a 1px border: 6 + 20 + 6 plus 2, 34px, so a 36px row holds it with
 * the row's own height rather than the tallest child deciding it.
 */
export const FILE_PANE_TOOLBAR = "mt-2 flex h-9 shrink-0 items-center justify-between gap-2";

/**
 * The toolbar's row, left empty while there is no file: `mt-2` and `h-9` above, 8
 * and 36, so 44px — `pb-11` exactly.
 */
export const FILE_SLOT_TOOLBAR_ROOM = "pb-11";

/**
 * The box, empty.
 *
 * `mt-4 min-h-0 flex-1` BECAUSE THAT IS WHAT THE FRAME IS. `FileFrame` gives its
 * image and `PdfPages` its pages those three classes, so inside the slot above the box
 * and the drawn file start at one top and fill one height.
 *
 * A BUTTON RATHER THAN A STYLED `div`, so it is reached by `Tab` and opened by
 * `Enter` or `Space` with nothing written here to make that true.
 */
export const FILE_DROP_BOX =
    "mt-4 min-h-0 flex-1 rounded border-2 border-dashed border-zinc-300 px-6 text-sm text-zinc-500 hover:border-zinc-400";

/** While a dragged file is over it. The only state the box has. */
export const FILE_DROP_BOX_OVER =
    "mt-4 min-h-0 flex-1 rounded border-2 border-dashed border-zinc-500 bg-zinc-50 px-6 text-sm text-zinc-700";

/**
 * What the box says, and the only string this issue coins.
 *
 * It names both ways in because neither is discoverable from the other: a box that
 * says only `click to choose` never gets a file dropped on it, and one that says
 * only `drop` reads as refusing the picker every other upload in this app uses. The
 * file it names is the invoice, which is the word the table behind it carries.
 */
export const FILE_PANE_COPY = {
    drop: "Drop the invoice file here, or click to choose one.",
};
