// The purchase order list's view rules (#168) — the Status column's text, and
// which empty state a viewer gets.
//
// lib/poListView.js is pure and dependency-free, so every clause is pinnable here.
// ORDERING IS NO LONGER ONE OF THEM: the list sorts by `PO ID` descending, which
// Airtable does server-side in getAllPOs, so there is no comparator left to pin.
// offline/source-shape.mjs asserts that sort instead.
//
// What this cannot see is the page around it: the canViewPR gate is
// offline/pr-visibility.mjs's (33 checks) and is exercised against real records by
// verify-po-visibility-132.mjs, and the query budget is a property of
// app/pos/page.js that #190's counter measures rather than this file.

import { isMain, standalone } from "./_harness.mjs";
import { EMPTY_COPY, emptyStateKind, statusLabel } from "../../../lib/poListView.js";

export const title = "Purchase order list — status text and empty states (#168)";

export function run({ check, assert, log }) {
    // ── the Status column ───────────────────────────────────────────────────
    log("status text — the field value, and nothing else:");
    check(
        "awaiting signature is rendered verbatim, with nothing added",
        statusLabel({ status: "Awaiting Signature" }),
        "Awaiting Signature"
    );
    // NO STATUS CARRIES A DATE. Both timestamps are supplied here on purpose: with
    // the fields absent these would pass whether or not the rule holds, which is
    // the vacuous shape that hides a half-done change.
    check(
        "signed is the bare word, even when a signing instant exists",
        statusLabel({ status: "Signed", presidentSignedAt: "2026-07-27T04:15:00.000Z" }),
        "Signed"
    );
    check(
        "withdrawn is the bare word, even when a withdrawal instant exists",
        statusLabel({ status: "Withdrawn", withdrawnAt: "2026-08-05T22:00:00.000Z" }),
        "Withdrawn"
    );
    // A CLOSED SET: the column is three values a reader learns once, with no digit
    // anywhere. Same property #166 asserts of its own chips.
    for (const status of ["Awaiting Signature", "Signed", "Withdrawn"]) {
        const label = statusLabel({ status, presidentSignedAt: "2026-07-27T04:15:00.000Z", withdrawnAt: "2026-08-05T22:00:00.000Z" });
        check(`${status} renders as itself`, label, status);
        assert(`and carries no digit`, !/\d/.test(label));
    }
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
