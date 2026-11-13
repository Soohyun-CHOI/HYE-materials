// The chips #166's two list columns render, and the marker that qualifies them.
//
// RENAMED FROM DeliveryChips.js BY #181. The plural claimed both exports are
// chips, and one deliberately is not: a chip is a value from a closed set, while
// the marker composes WITH any of them and would double the set if it were one.
// `Marks` is the word both fit under — a chip is a mark and so is the `!` — so the
// file no longer contradicts what it holds. It stays ONE file for the reason below;
// the two belong together, they are just not the same shape. #210 renamed the
// marker itself for the same test applied one level down; see there.
//
// ONE FILE FOR BOTH LISTS because the two columns are one idea at two ends: the
// invoice list says whether what was invoiced has been delivered, the deliveries
// list whether what was delivered has been invoiced. A reader crossing between them
// should recognize the shape, so a tone means the same thing on both — complete,
// partial, or neither — and neither list carries a palette of its own.
//
// Presentational only: no hooks, no imports beyond React's JSX, so a Server
// Component (the invoice list) and a Client Component (the deliveries list) can
// both use it. The semantic tone comes from lib/deliveryStatus.js; the colors are
// here, because which green is a rendering decision and "this is the complete
// state" is not.

const TONE_CLASS = {
    complete: "bg-green-100 text-green-800",
    partial: "bg-amber-100 text-amber-800",
    // A `variance` tone stood here (#232), red for the `Delivery variance` chip — an
    // error, kept off `partial`'s amber so the palette would not say a stage and an
    // error in one color. It went with that chip (#640): no chip value is an error now.
    none: "bg-zinc-100 text-zinc-600",
};

/**
 * One status chip — a closed set of values, the way an Airtable single select is.
 *
 * `absent` is deliberately NOT a chip. It means the comparison was never made
 * (every invoice item was free text), and dressing "we did not measure" as a
 * value would put it in the same set as the three that are measurements.
 */
export function StatusChip({ chip }) {
    if (!chip) return <span className="text-zinc-500">—</span>;
    if (chip.tone === "absent") return <span className="text-zinc-500">{chip.text}</span>;

    return (
        <span
            className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium ${TONE_CLASS[chip.tone]}`}
        >
            {chip.text}
        </span>
    );
}

/**
 * A qualifier on the cell beside it: the `!` in a circle, whose whole meaning is
 * the sentence handed to it.
 *
 * A MARKER RATHER THAN A SECOND CHIP, because it is not another value of the set —
 * it composes with any of them, and as a chip it would double them.
 *
 * NAMED FOR ITS SHAPE, NOT FOR ONE OF ITS MEANINGS (#210). It was `InferredMarker`
 * while there was exactly one qualifier in the app; #210 gave it a second meaning,
 * a discrepancy on the invoice list, and a name claiming either would have been
 * false at the other call site. So it says what the component IS and the label says
 * what it means, exactly as `StatusChip` does.
 *
 * BACK TO ONE CALLER SINCE #232, AND THE NAME IS STILL RIGHT. That issue made the
 * discrepancy a chip value: the chip said `Delivered` and the marker qualified it, so
 * a reader met the normal word first and had to hover for the one that mattered. What
 * is left is the overage affordance's tie-break (#265): several invoices could have
 * supplied the quotation at the same price. The name outlived the reuse that prompted
 * it, which is the point of naming a component for its shape: it does not have to be
 * renamed back.
 *
 * `title` alone would be the whole affordance on a mouse and nothing at all
 * anywhere else: a tooltip opens on neither touch nor a keyboard. So the same
 * sentence is the accessible name, which is what a screen reader announces and
 * what survives when hover does not exist. Whether there is a fuller explanation
 * elsewhere is the caller's business: #167 prints the same sentence beside its
 * button, and #210's discrepancy is stated with its figures, per ordered item, on
 * the invoice detail.
 */
export function QualifierMarker({ label }) {
    return (
        <span
            role="img"
            aria-label={label}
            title={label}
            className="inline-flex h-3.5 w-3.5 shrink-0 cursor-help items-center justify-center rounded-full border border-zinc-400 text-[10px] font-bold leading-none text-zinc-500"
        >
            !
        </span>
    );
}
