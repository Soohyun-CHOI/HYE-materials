import Icon from "./Icon";

/*
 * 0o's Activity marks (Invoices 0o.33 to 0o.38, 0o.54; #670): what an Activity entry leads with and
 * the Rule that joins one entry to the next, drawn once for every record page that keeps an
 * Activity — an item's since #670, and an invoice's to come, whose settling events take the blue
 * (0o.36). What each entry says, and which mark it takes, is its caller's: an item's events are
 * `lib/assetView.js:ACTIVITY_MARK`'s.
 *
 * AT A DESK, A 24 CIRCLE HOLDING ITS 12 MARK (0o.33). The circle stands on Field over white, so the
 * Rule behind it never shows through, its mark at Ink 3 (`qualifier`); an event that settles
 * something left open takes the blue Face and its mark Accent (`settled`, `current`). It centers on
 * the event's first line — 2 above the entry's top, half of 24 less 20 — and stands 12 before its
 * words (0o.34). The Rule, 1px, runs from under the circle to the next one through their centers
 * and stops at the last (0o.35): from the circle's foot to 2 above the entry's end, where the next
 * circle's top stands.
 *
 * ON A PHONE, A 6 DOT AT INK 4 STANDS IN FOR THE CIRCLE (0o.54, Tools 0a's Activity), 12 before its
 * words as the circle is, and the Rule runs from under the dot into the next entry as 1j draws it.
 *
 * A MARK IS DECORATION: the column it stands in is hidden from assistive tech, and the entry's words
 * say what happened.
 */

/** The list of entries, newest first wherever a page has no rail block for it (0o.51). */
export function ActivityTrail({ children }) {
    return <ol className="flex flex-col">{children}</ol>;
}

// The circle's ground: Field over white, or the blue Face for an event that settles (0o.33, 0o.36).
const CIRCLE_GROUND = {
    open: "bg-white bg-[linear-gradient(var(--color-background-muted),var(--color-background-muted))]",
    settled: "bg-selected",
};

/** One entry: its mark and the Rule to the next on the left, its words on the right. */
export function ActivityEntry({ mark, settled = false, last = false, children }) {
    return (
        <li className="grid grid-cols-[var(--size-log-mark)_minmax(0,1fr)] gap-x-log-mark-inline max-sm:grid-cols-[var(--width-mobile-log-track)_minmax(0,1fr)]">
            <div aria-hidden="true" className="relative flex justify-center">
                {!last && (
                    <span className="absolute top-[calc(var(--size-log-mark)-var(--spacing-log-mark-bleed))] bottom-log-mark-bleed w-px bg-divider max-sm:top-mobile-log-rule-inset-top max-sm:-bottom-mobile-log-rule-overhang" />
                )}
                <span
                    className={`relative -mt-log-mark-bleed flex size-log-mark shrink-0 items-center justify-center rounded-full ${settled ? CIRCLE_GROUND.settled : CIRCLE_GROUND.open} max-sm:hidden`}
                >
                    <Icon name={mark} kind={settled ? "current" : "qualifier"} className="size-log-mark-icon" />
                </span>
                <span className="relative mt-mobile-log-dot-inset-top size-mobile-log-dot rounded-full bg-foreground-faint sm:hidden" />
            </div>
            <div className={`flex min-w-0 flex-col gap-log-line-stack ${last ? "" : "pb-log-stack max-sm:pb-mobile-log-stack"}`}>{children}</div>
        </li>
    );
}
