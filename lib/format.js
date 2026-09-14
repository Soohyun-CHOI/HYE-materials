// Shared display formatters. Keep purely presentational — no business
// logic, no Airtable shapes.

// Currency fields in this app are USD-only (see CLAUDE.md's Materials
// note) and follow a "blank = 0" convention: Total Amount / Shipping Fee
// come back null when unset, and we render those as $0.00 rather than a
// blank cell so PR and PO layouts stay identical. Not reused for the PO
// PDF, which needs its own comma-free "USD 1234.56" format (lib/poPdf.js).
const usdFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
});

export function formatUSD(value) {
    return usdFormatter.format(Number(value) || 0);
}

// ---------------------------------------------------------------------------
// Stored instants (#374)
//
// WHAT A STORED INSTANT IS ON THIS BASE: an ISO string in UTC, written by this
// app — `Created At`, `Event At`, `Sent At`, `President Signed At`, `Withdrawn
// At`, every `*At` the `X At` convention names. A calendar date (`Received
// Date`, `Issue Date`, `Due Date`, `Paid Date`) is NOT one of these and must
// never be handed to anything here: it carries no zone, and `new Date("2026-09-
// 14")` parses as UTC midnight, which renders as the previous day anywhere west
// of Greenwich. Those fields are rendered as the stored string, and that is why.
//
// THESE OPTIONS WERE WRITTEN OUT AT FOUR CALL SITES AND ARE ONE SET NOW.
// `lib/toolItemView.js:EVENT_AT_FORMAT` carried them with the condition for
// gathering them written beside it — a fifth site, or the first screen wanting a
// different resolution — and #374 is both at once: it has to reach every site
// that renders an instant, and `/prs/new`'s duplicate warning wants a day with no
// time on it. The name went with the move: `Event At` is one field on `Tool Log`,
// and what these describe is a resolution.
//
// THEY LIVE HERE BECAUSE OF WHO HAS TO READ THEM. The reader's own zone is known
// only in the browser, so the formatting happens in a Client Component — and this
// module imports nothing, which is what lets a `"use client"` file and the
// offline tier both load it (CLAUDE.md, client bundle safety).

/** A date and a time to the minute — every history, every `*At` a screen shows. */
export const INSTANT_FORMAT = Object.freeze({
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
});

/**
 * The day alone, for a sentence where the hour would be noise.
 *
 * Its one reader is `/prs/new`'s duplicate warning, which says another request
 * was submitted on a day; the hour of a request somebody else raised weeks ago
 * decides nothing the reader is about to do.
 */
export const DAY_FORMAT = Object.freeze({
    year: "numeric",
    month: "numeric",
    day: "numeric",
});

/**
 * The stored value as a `Date`, or `null` when it is not one.
 *
 * One rule for two readers: the formatter below, and the component that decides
 * whether it has an instant to draw at all. A blank and a string no parser can
 * read are both `null` here, which is what keeps `Invalid Date` off every screen.
 */
export function readInstant(value) {
    if (value === null || value === undefined || value === "") return null;
    const at = new Date(value);
    return Number.isNaN(at.getTime()) ? null : at;
}

/**
 * A stored instant, as a reader sees it.
 *
 * `locale` AND THE FORMAT'S `timeZone` ARE BOTH LEFT UNSET BY EVERY SCREEN, and
 * that is the whole of how an instant lands in the reader's own zone: with
 * neither supplied, `toLocaleString` resolves against the runtime it runs in, and
 * this function is only ever called from a browser. The one caller that passes
 * both is `lib/poPdf.js`, whose reader is a vendor holding a printed document —
 * see its own header for the zone it names and why it has to name one.
 *
 * AN UNREADABLE VALUE COMES BACK UNCHANGED rather than as `Invalid Date`. It was
 * `formatEventAt`'s rule, for a log row whose four facts never drop so there is
 * always a pair to fill; it generalizes because a stored string this cannot read
 * is more honestly shown as itself than as a formatter's complaint, on any screen.
 */
export function formatInstant(value, format = INSTANT_FORMAT, locale = undefined) {
    const at = readInstant(value);
    if (at === null) return value;
    return at.toLocaleString(locale, format);
}
