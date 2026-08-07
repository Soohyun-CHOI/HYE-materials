// The purchase order list's view rules (#168) — ordering, the Status column's
// text, and which empty state a viewer gets.
//
// lib/poListView.js is pure and dependency-free, so every clause is pinnable
// here. What this cannot see is the page around it: the canViewPR gate is
// offline/pr-visibility.mjs's (33 checks) and is exercised against real records by
// verify-po-visibility-132.mjs, and the query budget is a property of
// app/pos/page.js that #190's counter measures rather than this file.

import { isMain, standalone } from "./_harness.mjs";
import {
    EMPTY_COPY,
    emptyStateKind,
    sortPORows,
    statusLabel,
} from "../../../lib/poListView.js";

export const title = "Purchase order list — ordering, status text, empty states (#168)";

const order = (rows) => sortPORows(rows).map((r) => r.poId).join(",");

export function run({ check, assert, log }) {
    // ── ordering ────────────────────────────────────────────────────────────
    log("newest first, PO ID breaking a same-day tie:");
    check(
        "later Created Date first",
        order([
            { poId: "HYE-PO-20260801-01", createdDate: "2026-08-01" },
            { poId: "HYE-PO-20260805-01", createdDate: "2026-08-05" },
            { poId: "HYE-PO-20260803-01", createdDate: "2026-08-03" },
        ]),
        "HYE-PO-20260805-01,HYE-PO-20260803-01,HYE-PO-20260801-01"
    );
    // Created Date is calendar-only, so same-day orders tie and the ID decides.
    check(
        "same day falls back to PO ID, descending",
        order([
            { poId: "HYE-PO-20260805-01", createdDate: "2026-08-05" },
            { poId: "HYE-PO-20260805-03", createdDate: "2026-08-05" },
            { poId: "HYE-PO-20260805-02", createdDate: "2026-08-05" },
        ]),
        "HYE-PO-20260805-03,HYE-PO-20260805-02,HYE-PO-20260805-01"
    );
    // A DATA GAP MUST NOT TAKE THE TOP ROW — the same call sortCandidates makes.
    check(
        "an undated PO sorts last, not first",
        order([
            { poId: "HYE-PO-UNDATED-01", createdDate: null },
            { poId: "HYE-PO-20260801-01", createdDate: "2026-08-01" },
        ]),
        "HYE-PO-20260801-01,HYE-PO-UNDATED-01"
    );
    check(
        "and last however the input was ordered",
        order([
            { poId: "HYE-PO-20260801-01", createdDate: "2026-08-01" },
            { poId: "HYE-PO-UNDATED-01", createdDate: null },
        ]),
        "HYE-PO-20260801-01,HYE-PO-UNDATED-01"
    );

    // The caller's array is the server's row list and a component may hold it.
    const input = [
        { poId: "HYE-PO-20260801-01", createdDate: "2026-08-01" },
        { poId: "HYE-PO-20260805-01", createdDate: "2026-08-05" },
    ];
    sortPORows(input);
    check("sorting does not mutate the caller's array", input[0].poId, "HYE-PO-20260801-01");
    check("an empty list is fine", sortPORows([]).length, 0);

    // ── the Status column ───────────────────────────────────────────────────
    log("status text — the field value, plus the date where there is one:");
    check(
        "awaiting signature is rendered verbatim, with nothing added",
        statusLabel({ status: "Awaiting Signature" }),
        "Awaiting Signature"
    );
    check(
        "signed carries its date",
        statusLabel({ status: "Signed", presidentSignedAt: "2026-07-27T04:15:00.000Z" }),
        "Signed 2026-07-27"
    );
    check(
        "withdrawn carries its date",
        statusLabel({ status: "Withdrawn", withdrawnAt: "2026-08-05T22:00:00.000Z" }),
        "Withdrawn 2026-08-05"
    );
    check("signed with no timestamp still reads", statusLabel({ status: "Signed" }), "Signed");
    check("withdrawn with no timestamp still reads", statusLabel({ status: "Withdrawn" }), "Withdrawn");
    // An option added to the Airtable field later must SHOW UP rather than vanish
    // — #19's posture for its own status tag.
    check("an unrecognized status is not swallowed", statusLabel({ status: "On Hold" }), "On Hold");
    check("a missing status renders as a dash", statusLabel({ status: "" }), "—");
    check("and so does a missing record", statusLabel(undefined), "—");

    // AWAITING SIGNATURE IS NOT SPECIAL-CASED, and this is the assertion that keeps
    // it that way. An unsigned purchase order is an ordinary state of one; the
    // combination worth flagging is "unsigned AND already invoiced", which belongs
    // to the invoice screens and is its own Phase 3 issue.
    const awaiting = statusLabel({ status: "Awaiting Signature" });
    for (const marker of ["⚠", "!", "unsigned", "warning", "not approved", "caution"]) {
        assert(
            `the awaiting-signature label carries no "${marker}"`,
            !awaiting.toLowerCase().includes(marker.toLowerCase())
        );
    }

    // ── empty states ────────────────────────────────────────────────────────
    log("three empty states, because they are three different facts:");
    check(
        "no purchase order exists at all",
        emptyStateKind({ totalCount: 0, visibleCount: 0, filtersActive: false }),
        "none"
    );
    check(
        "some exist but none is visible to this viewer",
        emptyStateKind({ totalCount: 12, visibleCount: 0, filtersActive: false }),
        "hidden"
    );
    check(
        "visible rows exist and the filters excluded them",
        emptyStateKind({ totalCount: 12, visibleCount: 5, filtersActive: true }),
        "filtered"
    );
    check(
        "rows to render means no empty state",
        emptyStateKind({ totalCount: 12, visibleCount: 5, filtersActive: false }),
        null
    );

    // ORDER IS LOAD-BEARING. A viewer who can see nothing must not be told to
    // adjust filters that cannot help them, so `filtered` loses to both others.
    check(
        "nothing visible beats an active filter",
        emptyStateKind({ totalCount: 12, visibleCount: 0, filtersActive: true }),
        "hidden"
    );
    check(
        "an empty base beats both",
        emptyStateKind({ totalCount: 0, visibleCount: 0, filtersActive: true }),
        "none"
    );

    // THE WORD THAT WOULD MAKE IT A LIE. "yet" claims the company has never raised
    // a purchase order, which is false for a viewer who simply cannot see any.
    assert("the none-exist message says 'yet'", EMPTY_COPY.none.includes("yet"));
    assert("the nothing-visible message does NOT", !EMPTY_COPY.hidden.includes("yet"));
    assert(
        "and it explains the gate instead of blaming the data",
        EMPTY_COPY.hidden.includes("request behind it")
    );
    for (const [kind, text] of Object.entries(EMPTY_COPY)) {
        assert(`the ${kind} message is a sentence, not a fragment`, /^[A-Z].*\.$/.test(text.trim()));
    }
    check("every empty-state kind has copy", Object.keys(EMPTY_COPY).sort().join(","), "filtered,hidden,none");
}

if (isMain(import.meta.url)) standalone(title, run);
