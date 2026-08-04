// The chips #166's two list columns render, and the marker that qualifies them.
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
    complete: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
    partial: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    none: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
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
 * The inferred marker: the answer in that cell rests on an ordering nothing
 * records (lib/deliveryStatus.js:allocateLineToInvoices).
 *
 * A MARKER RATHER THAN A SECOND CHIP, because it is not another value of the set
 * — it composes with any of them, and as a chip it would double them.
 *
 * `title` alone would be the whole affordance on a mouse and nothing at all
 * anywhere else: a tooltip opens on neither touch nor a keyboard. So the same
 * sentence is the accessible name, which is what a screen reader announces and
 * what survives when hover does not exist. The full explanation is on the invoice
 * detail as an ordinary line of text, which is the reading nobody has to discover.
 */
export function InferredMarker({ label }) {
    return (
        <span
            role="img"
            aria-label={label}
            title={label}
            className="inline-flex h-3.5 w-3.5 shrink-0 cursor-help items-center justify-center rounded-full border border-zinc-400 text-[10px] font-bold leading-none text-zinc-500 dark:border-zinc-500 dark:text-zinc-400"
        >
            !
        </span>
    );
}
