// The view rules for the purchase order list (#168) — the Status column's text,
// and which empty state a viewer gets.
//
// Pure and dependency-free, so the offline tier pins every clause
// (offline/po-list-view.mjs). Same split as lib/materialPriceView.js and
// lib/deliveryStatus.js: the page fetches and gates, this decides what the rows
// look like once it has them.
//
// ORDERING IS NOT HERE. It was a `sortPORows` comparator over `Created Date` with
// `PO ID` as the tie-break; the list now sorts by `PO ID` alone, which Airtable
// does server-side in getAllPOs — exactly as getAllInvoices sorts by `Invoice ID`.
// A PO ID is fixed width and zero-padded, so ID order IS date order, and there is
// nothing left for JS to decide. The comparator's undated-last clause went with
// it: every PO has an ID.

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
 * NO DATES AT ALL, which is what makes this column a CLOSED SET a reader learns
 * once and then recognizes — the property #166 identified as the difference
 * between a list cell and a sentence. It carried `Signed 2026-07-27` and
 * `Withdrawn 2026-07-27` first; both dates went, and neither is lost. When a PO
 * was signed is on `/pos/[poId]`, which shows President Signed and its instant,
 * and the list already carries `Created` for the date a reader scans by.
 *
 * That is also why there is no separate Signed column: it would be blank for
 * every unsigned and withdrawn row — 24 of this base's 40 — and the table's
 * declared widths already spend all 832px the page has, so a seventh column
 * would have to take its width from Vendor, the one column with nothing to
 * spare.
 *
 * An unrecognized status is returned as-is rather than swallowed — the same
 * posture as #19's `PO: <status>` tag, so an option added to the field later
 * shows up instead of vanishing.
 */
export function statusLabel(po) {
    const status = po?.status || "";
    return status || "—";
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

// ─────────────────────────────────────────────────────────────────────────────
// APPROVED REQUESTS WITH NO PURCHASE ORDER (#176)
//
// PO generation runs inside the approving action and never rolls the approval
// back, so an Approved PR can sit with no PO forever. The retry exists —
// generatePOAction, Admin-only — but it is rendered only on that PR's own detail
// page, so finding the PR requires already knowing which one it is. The failure
// reaches console.error and nothing else.
//
// THIS LIVES ON `/pos`, AND WHO CAN ACT IS WHY. Generating an order is
// Admin-only, Admin is office staff, and the office works from that screen; a
// strip on the request list would offer an action most of its readers cannot
// take. The requester's path to knowing is unchanged and is that PR's own detail
// page, whose copy #176 also corrects.
//
// That a missing order cannot appear in a list of orders is why this is a STRIP
// RATHER THAN A COLUMN. A strip is what shows a list what the list structurally
// cannot: there is no row here to carry the fact, because the row is the thing
// that does not exist.
//
// WHY THE FILTER IS HALF FORMULA AND HALF JS. `Status` is a plain select, so
// filtering it server-side is fine (CLAUDE.md's rule bars link fields, not
// selects). Whether `Purchase Orders` is EMPTY is asked of the mapped record
// instead — a formula sees a link field as its primary-field text and there is
// no honest emptiness test — which is the same thing lib/poGeneration.js already
// does one line before it decides to generate.
//
// `PO Signed` IS IN THE SET, AND SHOULD NEVER MATCH. That status fires when the
// President signs the generated PO, so a `PO Signed` PR necessarily has one; a
// row here in that status is a broken record rather than a failed generation.
// It is included because generatePOHandler accepts both statuses and the PR
// detail page renders its PO section for both, so a narrower set here would
// disagree with the two places that already decided this — and because an
// anomaly is better surfaced than filtered out.

export const AWAITING_PO_STATUSES = ["Approved", "PO Signed"];

/**
 * Which approved requests have no purchase order, oldest first.
 *
 * SORTED BY `PR ID` ASCENDING, AND THAT IS AN APPROXIMATION THIS FILE OWES THE
 * READER. A worklist wants the longest-stuck item at the top, and the honest key
 * for that would be when the PR was approved — but `Purchase Requests` records no
 * approval instant. It has `Created At` and `Withdrawn At` and nothing between
 * them, so the only date in hand is when the request was raised, which `PR ID`
 * already encodes (`HYE-PR-YYMMDD-##`, fixed width and zero-padded, so string
 * order is date order).
 *
 * The approximation is wrong in one direction: a request raised long ago and
 * approved today sorts above one raised and approved yesterday, so it floats too
 * high rather than sinking too low. That is the direction to be wrong in — a
 * non-urgent row near the top costs a reader one glance, where an urgent row
 * pushed to the bottom of a growing list costs them the whole point of the strip.
 * Descending was the first choice and is exactly the inversion of that.
 */
export function selectPRsAwaitingPO(prs) {
    // `sort` mutates, but it is sorting what `filter` already copied, so the
    // caller's array is untouched without a defensive `slice()` — one was here
    // and was removed as dead: no mutation of it could make any assertion fail,
    // which is the shape offline/_harness.mjs's anti-vacuity rule is about.
    return (prs ?? [])
        .filter((pr) => AWAITING_PO_STATUSES.includes(pr?.status))
        .filter((pr) => (pr?.purchaseOrders?.length ?? 0) === 0)
        .sort((a, b) => String(a?.prId ?? "").localeCompare(String(b?.prId ?? "")));
}

/**
 * What the strip says, in two voices.
 *
 * THE HEADING IS ONE VOICE AND THE EXPLANATION IS TWO, because the fact is the
 * same for everyone and the next step is not. Only an Admin can run the retry,
 * and a strip that offers an action to someone who cannot take it is worse than
 * no strip: it reads as their fault. Same split lib/poWithdraw.js makes between
 * `modal` (the person about to act) and `banner` (the person reading about it).
 *
 * NEITHER VOICE SAYS "YET", AND THAT IS THE HALF OF #176 THAT IS COPY. The PR
 * detail page said "PO generation hasn't completed yet", which reads as work in
 * progress. Generation is synchronous inside the approving action, so a request
 * that reaches this strip is not on its way — it already failed, and the word
 * `yet` told a reader to wait for something that will never happen on its own.
 */
export const AWAITING_PO_COPY = {
    heading: (n) =>
        n === 1
            ? "1 approved request has no purchase order"
            : `${n} approved requests have no purchase order`,
    explain: {
        admin: "Generation failed when the request was approved. Generate the order here.",
        other: "Generation failed when the request was approved. Ask the office to generate it.",
    },
};

/** Both halves resolved for one render, so a call site never picks a voice by hand. */
export function awaitingPOCopy({ count, isAdmin }) {
    return {
        heading: AWAITING_PO_COPY.heading(count),
        explain: isAdmin ? AWAITING_PO_COPY.explain.admin : AWAITING_PO_COPY.explain.other,
    };
}
