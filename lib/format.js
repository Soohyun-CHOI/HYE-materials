// Shared display formatters. Keep purely presentational — no business
// logic, no Airtable shapes.

// Currency fields in this app are USD-only (see the Materials entry in
// docs/notes/data-model.md) and follow a "blank = 0" convention: Total Amount /
// Shipping Fee come back null when unset, and we render those as $0.00 rather
// than a blank cell so PR and PO layouts stay identical. Not reused for the PO
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
// `lib/assetView.js:EVENT_AT_FORMAT` carried them with the condition for
// gathering them written beside it — a fifth site, or the first screen wanting a
// different resolution — and #374 is both at once: it has to reach every site
// that renders an instant, and `/prs/new`'s duplicate warning wants a day with no
// time on it. The name went with the move: `Event At` is one field on `Asset Log`,
// and what these describe is a resolution.
//
// THEY LIVE HERE BECAUSE OF WHO HAS TO READ THEM. The reader's own zone is known
// only in the browser, so the formatting happens in a Client Component — and this
// module imports nothing, which is what lets a `"use client"` file and the
// offline tier both load it (CLAUDE.md, client bundle safety).

/**
 * A date and a time to the minute — every history, every `*At` a screen shows.
 *
 * THE MONTH AND THE DAY IN TWO FIGURES SINCE #463, the design's `09/14/2026`: every
 * date the Tools and Invoices files draw is written that way, on every screen, so it
 * is the app's notation rather than a screen's. The order document takes it too, since
 * `lib/poPdf.js` spreads these options under its own zone and locale.
 */
export const INSTANT_FORMAT = Object.freeze({
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
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
    month: "2-digit",
    day: "2-digit",
});

/**
 * The locale a screen writes an instant in (#463): the design's notation, month, day and
 * year parted by slashes and the hour on a twelve-hour clock, whatever language the
 * reader's browser is set to. The ZONE stays the reader's — that is #374 and is the point
 * — and this app's words are US English everywhere, so a date written in another
 * language's order was the one part of a screen that was not.
 */
const SCREEN_LOCALE = "en-US";

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
 * A stored instant as one locale string — the order document's, since #463 gave the
 * screens `instantParts` below.
 *
 * THE ZONE IS LEFT UNSET BY EVERY SCREEN, and that is the whole of how an instant
 * lands in the reader's own zone: with none supplied, the formatter resolves against
 * the runtime it runs in, and a screen formats only in a browser. The one caller that
 * passes a zone is `lib/poPdf.js`, whose reader is a vendor holding a printed document —
 * see its own header for the zone it names and why it has to name one. A screen left
 * the locale unset too until #463, so a browser set to another language wrote the date
 * in that language's order; it writes the design's notation now (`SCREEN_LOCALE`).
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

/**
 * A stored instant as the parts a screen draws it in (#463): the date's three figures,
 * month first, and the time when the format carries one — or `null` for a value that is
 * not an instant.
 *
 * PARTS RATHER THAN A STRING, BECAUSE THE DESIGN DRAWS THE SLASHES AND THE GAP.
 * `app/components/Instant.js` sets the slashes between the figures dimmed and the time a
 * space's worth past the date, with no comma — none of which a formatted string can
 * carry. The figures and the clock are the formatter's, in the reader's zone and the
 * screen's locale; only the arrangement is the screen's.
 */
export function instantParts(value, format = INSTANT_FORMAT) {
    const at = readInstant(value);
    if (at === null) return null;
    const parts = new Intl.DateTimeFormat(SCREEN_LOCALE, format).formatToParts(at);
    const part = (type) => parts.find((p) => p.type === type)?.value;
    const date = ["month", "day", "year"].map(part).filter(Boolean);
    const time = "hour" in format ? `${part("hour")}:${part("minute")} ${part("dayPeriod")}` : null;
    return { date, time };
}

/**
 * The zone the reader's own browser is in, by its IANA name (#553) — what a browser sends with a
 * request whose answer a server writes days into, so those days are the reader's as a screen's
 * are. Asked in a browser only: on a server it would name the server's zone.
 */
export function readerTimeZone() {
    return new Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * The zone a server was sent, as the runtime knows it, or `UTC` for anything it does not know
 * (#553): a browser always sends its own (`readerTimeZone`), so only a request made by hand meets
 * the second.
 */
export function knownTimeZone(asked) {
    if (typeof asked !== "string" || asked === "") return "UTC";
    try {
        return new Intl.DateTimeFormat(SCREEN_LOCALE, { timeZone: asked }).resolvedOptions().timeZone;
    } catch {
        return "UTC";
    }
}

/**
 * The calendar day an instant falls on in `timeZone`, as figures — `{ year, month, day }` — or
 * null for a value that is not an instant (#553). The day the screens draw, read by the parts
 * they are drawn from, with the zone given where a screen leaves its browser's: the list's
 * export writes a reader's days on a server, in the zone their press sent.
 */
export function dayOf(value, timeZone) {
    const parts = instantParts(value, { ...DAY_FORMAT, timeZone });
    if (parts === null) return null;
    const [month, day, year] = parts.date.map(Number);
    return { year, month, day };
}

/**
 * The same instant as one string, for a sentence that is built around it — `Sent to …
 * on 09/14/2026 4:31 PM` (#463). The slashes are plain here: a sentence is one string from
 * one builder, so nothing in it can be drawn apart.
 */
export function instantText(value, format = INSTANT_FORMAT) {
    const parts = instantParts(value, format);
    if (parts === null) return null;
    return parts.time ? `${parts.date.join("/")} ${parts.time}` : parts.date.join("/");
}
