import Space from "@/app/components/Space";

// The mark itself, which is not a word: no screen's copy constant holds it.
const MARK = "·";

/**
 * The dot between two clauses (0e): Ink 4, 9 either side (#463) — in a record's caption, a
 * history entry's line and the selection bar's second clause.
 *
 * THE 9s ARE `Space`s, so the two clauses copy and are read apart, which padding alone did
 * not do; the dot itself is not read. It reads design names, so a screen above the design's
 * axes must not reach it until #258 (`offline/design-values.mjs`).
 */
export default function Dot() {
    return (
        <>
            <Space className="w-separator-inline" />
            <span aria-hidden="true" className="text-foreground-faint">
                {MARK}
            </span>
            <Space className="w-separator-inline" />
        </>
    );
}
