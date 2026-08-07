// The view rules for the purchase order list (#168) — ordering, the Status
// column's text, and which empty state a viewer gets.
//
// Pure and dependency-free, so the offline tier pins every clause
// (offline/po-list-view.mjs). Same split as lib/materialPriceView.js and
// lib/deliveryStatus.js: the page fetches and gates, this decides what the rows
// look like once it has them.

/**
 * Newest first, by the date the order was raised.
 *
 * `Created Date` is CALENDAR-ONLY, so same-day orders tie and need a second key;
 * `PO ID` is `HYE-PO-YYYYMMDD-##`, fixed width and monotonic within a day by
 * construction (#164), so a plain string comparison finishes the ordering. Same
 * chain and the same reason as sortHistoryRows (#19) and sortCandidates (#162).
 *
 * AN UNDATED PO SORTS LAST, in either direction — the same call sortCandidates
 * makes, and for the same reason: a data gap must not be handed the most
 * prominent row. Unreachable today (measured 24 of 24 POs carry a Created Date at
 * #165) and cheap to keep true.
 *
 * Copies rather than sorting in place: the caller's array is the server's row
 * list and a component may hold it.
 */
export function sortPORows(rows) {
    return [...rows].sort((a, b) => {
        const dateA = a.createdDate || "";
        const dateB = b.createdDate || "";
        if (dateA !== dateB) {
            if (!dateA) return 1;
            if (!dateB) return -1;
            return dateA < dateB ? 1 : -1;
        }
        const idA = a.poId || "";
        const idB = b.poId || "";
        return idA < idB ? 1 : idA > idB ? -1 : 0;
    });
}

/** The calendar day of an *At instant, or "" — see statusLabel on the timezone. */
function dayOf(instant) {
    return typeof instant === "string" && instant.length >= 10 ? instant.slice(0, 10) : "";
}

/**
 * What the Status column says.
 *
 * THE STATUS VALUE IS RENDERED VERBATIM, which is deliberate rather than lazy:
 * this column's whole job is to report the field, so the screen word and the
 * Airtable option agree and no row is needed in CLAUDE.md's screen-words table.
 *
 * `Awaiting Signature` GETS NO SPECIAL TREATMENT HERE — no warning, no emphasis.
 * An unsigned purchase order is an ordinary state of a purchase order, not a
 * problem. The combination worth flagging is "unsigned AND already invoiced",
 * which is a fact about the invoice screens rather than this list, and is its own
 * Phase 3 issue.
 *
 * Signed and Withdrawn carry their date, the shape the invoice list already uses
 * for `Paid 2026-07-27`. The two source fields are *At instants (UTC), so this
 * takes their UTC calendar day; the app writes and reads them in UTC throughout,
 * and `Created Date` beside it is calendar-only, so the column stays internally
 * consistent.
 *
 * An unrecognized status is returned as-is rather than swallowed — the same
 * posture as #19's `PO: <status>` tag, so an option added to the field later
 * shows up instead of vanishing.
 */
export function statusLabel(po) {
    const status = po?.status || "";
    if (!status) return "—";
    if (status === "Signed") {
        const day = dayOf(po.presidentSignedAt);
        return day ? `Signed ${day}` : "Signed";
    }
    if (status === "Withdrawn") {
        const day = dayOf(po.withdrawnAt);
        return day ? `Withdrawn ${day}` : "Withdrawn";
    }
    return status;
}

/**
 * The three empty states, which are three different facts and must not share a
 * sentence.
 *
 * "Nothing here yet" and "nothing here FOR YOU" are the pair that matters: a
 * viewer who can see no purchase order because none is on their jobs must not be
 * told the company has never raised one. The word "yet" is what makes the first
 * message false in that case, which is why only one of them carries it.
 */
export const EMPTY_COPY = {
    none: "No purchase orders yet. One is generated automatically when a purchase request is fully approved.",
    hidden: "No purchase orders to show. You see a purchase order when you can see the request behind it.",
    filtered: "No purchase orders match these filters.",
};

/**
 * Which of the three applies, or null when there are rows to render.
 *
 * ORDER IS LOAD-BEARING. `filtered` is tested LAST, because a viewer with nothing
 * visible at all would otherwise be told to adjust filters that cannot help them.
 * `totalCount` is every PO on the base before the visibility gate; `visibleCount`
 * is what survived it, before any client-side filter.
 */
export function emptyStateKind({ totalCount, visibleCount, filtersActive }) {
    if (totalCount === 0) return "none";
    if (visibleCount === 0) return "hidden";
    if (filtersActive) return "filtered";
    return null;
}
