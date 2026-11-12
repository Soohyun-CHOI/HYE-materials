import { PAGE_WIDE } from "@/app/invoices/new/filePane";

/**
 * The box a screen the design has not drawn yet stands in (#258), inside the column the
 * root layout's rail holds every screen in (`app/layout.js`).
 *
 * THE MEASURES ARE THE ONES THOSE PAGES HELD, MOVED AND NOT CHOSEN. Until #258 each of the
 * screens above the assets axis declared its own `mx-auto w-full max-w-* p-8` inside its own
 * page — twenty pages, twenty-four declarations, four pages carrying two — and six branches
 * a centered refusal box of their own, so a width was a search rather than an edit and two
 * branches of one screen could disagree about one. They are here now under the kind of
 * screen each frames, every class string the bytes it was, so nothing a page draws moved.
 * **None of them is the design's**: nothing about these screens' appearance was designed
 * (`docs/briefs/_shared.md`), so no value here is a baseline for a drawing to depart from.
 *
 * A SCREEN THAT TAKES THE DESIGN STOPS CALLING THIS, and draws its measure from the design's
 * names as the asset screens do — `app/components/ListTable.js:LIST_MEASURE`, the record
 * page's `max-w-content` — since the layout holds no width of a screen's (`app/layout.js`).
 * The callers are a list that only shrinks: `offline/design-values.mjs` holds every one by
 * name, fails a page added to it, fails one left on it once it stops calling, and fails a
 * centered measure (`mx-auto` beside a Tailwind width step) spelled anywhere else. When the
 * last page leaves, this file goes.
 *
 * AND THE BOX SAYS WHAT IT IS, SO THE COLUMN KEEPS ONE RULE OFF IT. The column hands focus to
 * the page's heading when the control holding it goes (#519) — the asset screens' rule, and
 * the heading is scrolled to as it takes focus. These screens take controls away as a matter
 * of course: a request's item row is removed with its own button, and their dialogs close by
 * unmounting rather than as the browser's own modal. Under that rule each would scroll a long
 * form to its top. So the box carries `data-undrawn-page`, and the column leaves focus that
 * fell from inside one where the browser puts it, as these screens always had it
 * (`app/components/Rail.js`). Their dialogs keep `modalStyles.js` for the same reason, until
 * each screen's design draws them on `DialogFrame.js`.
 *
 * PURE, AND NO CLIENT STATE: the pages are Server Components and render it as one.
 */

/** Each kind of screen's box, by the classes its pages wrote. */
const MEASURES = {
    // The office's create forms and the address form a request sends its writer to: one
    // column of fields.
    form: "mx-auto w-full max-w-sm p-8",
    // A request, an order and an invoice, read or edited — and the request form.
    document: "mx-auto w-full max-w-2xl p-8",
    // The invoice form, the same box widened from `xl` up for the invoice's file beside it,
    // which `app/invoices/new/filePane.js` decides with the rest of that column.
    "invoice-entry": `mx-auto w-full max-w-2xl p-8 ${PAGE_WIDE}`,
    // A delivery, read, entered or edited: its allocation table declares a floor of its own.
    delivery: "mx-auto w-full max-w-3xl p-8",
    // The four document lists and the material prices: `LIST_TABLE_CLASS`'s 52rem is this
    // box less its padding (`app/components/listTableWidth.js`).
    list: "mx-auto w-full max-w-4xl p-8",
    // A refusal standing alone, in the middle of what the column shows. `min-h-full` is the
    // column's height from the phone's edge up, where the column is no flex container and
    // `flex-1` grows nothing; below it the column is one, and `flex-1` does it.
    notice: "flex min-h-full flex-1 items-center justify-center p-8",
};

/**
 * `measure` is the kind of screen: `form`, `document`, `invoice-entry`, `delivery`, `list` or
 * `notice`. An unknown one throws rather than drawing a box with no width.
 */
export default function UndrawnPage({ measure, children }) {
    const className = MEASURES[measure];
    if (!className) throw new Error(`UndrawnPage: no measure named ${JSON.stringify(measure)}`);
    return (
        <div data-undrawn-page="" className={className}>
            {children}
        </div>
    );
}
