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
// invoice list says whether what was billed has been delivered, the deliveries
// list whether what was delivered has been billed. A reader crossing between them
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
    none: "bg-zinc-100 text-zinc-600",
};

/**
 * One status chip — a closed set of values, the way an Airtable single select is.
 *
 * `absent` is deliberately NOT a chip. It means the comparison was never made
 * (every line was free text), and dressing "we did not measure" as a value would
 * put it in the same set as the three that are measurements.
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
 * while there was exactly one qualifier in the app; it now carries two — #210's
 * discrepancy on the invoice list, and #167's inferred attribution on the overage
 * affordance, which is still a guess because reading it off the stored pairing is
 * that issue's work rather than this one's. A name claiming the first would have
 * been false at the second call site the moment it was reused, so it says what the
 * component IS and the label says what it means, exactly as `StatusChip` does.
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
