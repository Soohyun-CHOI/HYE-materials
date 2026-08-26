// The purchase order list's view rules (#168) — the Status column's text, which
// empty state a viewer gets, and which orders each of the two strips selects.
//
// #295's SELECTOR IS THE QUIET MUTANT IN THIS FILE, and it is quiet because the two
// answers agree. That strip lists orders that have been signed and not sent, and the
// obvious way to write it is `status !== "Sent to Vendor"` — which on this base
// returns the same 30 rows as reading `Sent At`, because the send writes both in one
// operation. They come apart in exactly two places: a hand edit, and a send whose
// record write failed. The second is the dangerous one — the vendor HAS that order,
// and a status test would put it in a strip that tells somebody to send it. So the
// first thing asserted about the selector is its verdict on both divergent shapes,
// before anything about the ordinary ones.
//
// lib/poListView.js is pure, so every clause is pinnable here.
// ORDERING IS NO LONGER ONE OF THEM: the list sorts by `PO ID` descending, which
// Airtable does server-side in getAllPOs, so there is no comparator left to pin.
// offline/source-shape.mjs asserts that sort instead.
//
// What this cannot see is the page around it: the canViewPR gate is
// offline/pr-visibility.mjs's (33 checks) and is exercised against real records by
// verify-po-visibility-132.mjs, and the query budget is a property of
// app/pos/page.js that #190's counter measures rather than this file.

import { readFileSync } from "node:fs";
import { isMain, standalone } from "./_harness.mjs";
import { callsTo, parseFile, repoPath, resolveFunction } from "./_ast.mjs";
import {
    AWAITING_PO_COPY,
    AWAITING_PO_STATUSES,
    AWAITING_SEND_COPY,
    EMPTY_COPY,
    awaitingPOCopy,
    emptyStateKind,
    selectPOsAwaitingSend,
    selectPRsAwaitingPO,
    statusLabel,
} from "../../../lib/poListView.js";

export const title = "Purchase order list — status text, empty states and both strips";

const PAGE = "app/pos/page.js";

/** A signed order nobody has sent, and the one field each case spoils. */
const UNSENT = {
    poId: "HYE-PO-20260101-01",
    presidentSigned: true,
    presidentSignedAt: "2026-01-01T10:00:00.000Z",
    status: "Signed",
    sentAt: null,
};

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

    // ── approved requests with no purchase order (#176) ─────────────────────
    // One fixture for every clause, and it is built to be REJECTED as well as
    // accepted: a selector that returned its input unchanged, or returned
    // nothing at all, would pass a test whose fixture only contained matches.
    // The counts below are asserted against that mix rather than against a
    // number someone remembered.
    log("");
    log("approved requests with no purchase order — the strip's selection rule:");
    const PRS = [
        { id: "r1", prId: "HYE-PR-260803-01", status: "Approved", purchaseOrders: [] },
        { id: "r2", prId: "HYE-PR-260801-01", status: "Approved", purchaseOrders: [] },
        { id: "r3", prId: "HYE-PR-260802-01", status: "Approved", purchaseOrders: ["recPO"] },
        { id: "r4", prId: "HYE-PR-260804-01", status: "In Review", purchaseOrders: [] },
        { id: "r5", prId: "HYE-PR-260805-01", status: "Withdrawn", purchaseOrders: [] },
        { id: "r6", prId: "HYE-PR-260806-01", status: "Draft", purchaseOrders: [] },
        { id: "r7", prId: "HYE-PR-260807-01", status: "PO Signed", purchaseOrders: [] },
        { id: "r8", prId: "HYE-PR-260808-01", status: "PO Signed", purchaseOrders: ["recPO2"] },
    ];
    // CAPTURED BEFORE THE FIRST CALL, which is the whole of what makes the
    // no-mutation assertion below able to fail. Taking it afterwards records the
    // order a mutating implementation had already left behind, and then compares
    // that against itself — the first version of this did exactly that and a
    // deliberate in-place sort walked straight past it.
    const fixtureOrder = PRS.map((p) => p.id).join(",");
    const picked = selectPRsAwaitingPO(PRS);

    assert(`the fixture holds ${PRS.length} requests, so the rule has something to reject`, PRS.length > 4);
    check("it picks the approved-with-nothing and the anomaly", picked.length, 3);
    check(
        "and picks exactly those three",
        picked.map((p) => p.id).sort().join(","),
        "r1,r2,r7"
    );
    check("an approved request that HAS an order is not picked", picked.some((p) => p.id === "r3"), false);
    check("In Review is not picked", picked.some((p) => p.id === "r4"), false);
    check("Withdrawn is not picked", picked.some((p) => p.id === "r5"), false);
    check("Draft is not picked", picked.some((p) => p.id === "r6"), false);
    check("a signed PR that HAS its order is not picked", picked.some((p) => p.id === "r8"), false);

    // `PO Signed` with no order should be unreachable — that status fires when
    // the President signs the generated PO. It is in the set because
    // generatePOHandler accepts both statuses; an anomaly is better surfaced
    // than filtered away, and this pins that decision rather than the accident.
    assert("PO Signed is in the status set on purpose", AWAITING_PO_STATUSES.includes("PO Signed"));

    // ORDER, AND THE INVERSION IT IS NOT. Ascending puts the longest-stuck row
    // at the top; descending was the first choice and buries it. Asserting the
    // first element alone would pass under either on a two-row fixture, so both
    // ends are pinned and the reversal is named.
    check("oldest PR ID first", picked[0].prId, "HYE-PR-260801-01");
    check("and the newest last", picked[picked.length - 1].prId, "HYE-PR-260807-01");
    assert(
        "which is NOT the descending order it would be trivial to regress to",
        picked.map((p) => p.prId).join(",") !==
            picked.map((p) => p.prId).slice().reverse().join(",")
    );

    // The input must not be mutated: app/pos/page.js hands the same array to the
    // canViewPR gate and then reads it again, so an in-place sort would reorder
    // it behind that call's back.
    check("the caller's array is left alone", PRS.map((p) => p.id).join(","), fixtureOrder);
    check("and the fixture was not already sorted, or that would prove nothing", fixtureOrder, "r1,r2,r3,r4,r5,r6,r7,r8");

    check("nothing in, nothing out", selectPRsAwaitingPO([]).length, 0);
    check("and a missing list is not a crash", selectPRsAwaitingPO(undefined).length, 0);

    // ── the two voices ──────────────────────────────────────────────────────
    log("");
    log("two voices, because only one of the two readers can act:");
    const adminCopy = awaitingPOCopy({ count: 3, isAdmin: true });
    const otherCopy = awaitingPOCopy({ count: 3, isAdmin: false });
    assert("the heading is the same fact for both", adminCopy.heading === otherCopy.heading);
    assert("the next step is not", adminCopy.explain !== otherCopy.explain);
    assert("only the Admin voice offers the action", adminCopy.explain.includes("Generate the order"));
    assert("the other voice names who to ask", otherCopy.explain.includes("office"));
    assert(
        "and does not offer a button it cannot supply",
        !otherCopy.explain.includes("Generate the order")
    );

    // THE WORD THIS ISSUE EXISTS TO REMOVE. "yet" said the generation was still
    // coming; it runs inside the approving action and never retries itself, so a
    // request that reaches this copy has already failed.
    for (const [voice, text] of Object.entries(AWAITING_PO_COPY.explain)) {
        assert(`the ${voice} voice does not say 'yet'`, !text.includes("yet"));
        assert(`the ${voice} voice says it failed`, /fail/i.test(text));
        assert(`the ${voice} voice is a sentence`, /^[A-Z].*\.$/.test(text.trim()));
    }

    check("one request reads as one", AWAITING_PO_COPY.heading(1), "1 approved request has no purchase order");
    check("and two do not", AWAITING_PO_COPY.heading(2), "2 approved requests have no purchase order");
    assert(
        "the singular and plural headings actually differ",
        AWAITING_PO_COPY.heading(1) !== AWAITING_PO_COPY.heading(2)
    );

    // ── #295: signed orders nobody has sent ─────────────────────────────────
    log("");
    log("THE QUIET MUTANT — a strip that reads the status instead of the send:");
    // THE TWO SHAPES WHERE THE JUDGMENTS COME APART. Everything else on the base
    // answers the same either way, which is why these two lead.
    const sentStatusStale = { ...UNSENT, sentAt: "2026-01-02T09:00:00.000Z", status: "Signed" };
    check(
        "an order the vendor HAS is absent even with the status left behind",
        selectPOsAwaitingSend([sentStatusStale]).length,
        0
    );
    const statusMovedByHand = { ...UNSENT, status: "Sent to Vendor", sentAt: null };
    check(
        "  and an order whose status was hand-edited is still listed, because nobody sent it",
        selectPOsAwaitingSend([statusMovedByHand]).length,
        1
    );
    // ANTI-VACUITY: the status test has to be seen giving the OPPOSITE answer on both,
    // or "reading Sent At" is indistinguishable from reading either field.
    const byStatus = (pos) => pos.filter((po) => po.status !== "Sent to Vendor");
    assert(
        "a status test would answer the other way on both",
        byStatus([sentStatusStale]).length === 1 && byStatus([statusMovedByHand]).length === 0
    );
    // AND IT AGREES WITH THE STATUS TEST EVERYWHERE ELSE, which is the whole reason
    // the mutation is invisible on a screen: on the ordinary shapes both return the
    // same rows.
    const ordinary = [UNSENT, { ...UNSENT, poId: "HYE-PO-20260101-02", sentAt: "2026-01-02T09:00:00.000Z", status: "Sent to Vendor" }];
    check(
        "the two judgments agree on every ordinary order",
        selectPOsAwaitingSend(ordinary).length,
        byStatus(ordinary).length
    );

    log("");
    log("what the strip lists, and what it must not:");
    check("a signed order with no send is listed", selectPOsAwaitingSend([UNSENT]).length, 1);
    check(
        "an unsigned order is not — there is nothing to send yet",
        selectPOsAwaitingSend([{ ...UNSENT, presidentSigned: false, status: "Awaiting Signature" }]).length,
        0
    );
    // THE SECOND MUTANT, AND IT HAS A WITNESS ON THE BASE. A withdrawn order's
    // `Sent At` is empty and will never be filled, so an unconditional list keeps it
    // forever — `HYE-PO-20260819-26` is withdrawn AND signed today.
    check(
        "a withdrawn order is not, however signed it is",
        selectPOsAwaitingSend([{ ...UNSENT, status: "Withdrawn" }]).length,
        0
    );
    assert(
        "  and that exclusion is not what the send test was already doing",
        selectPOsAwaitingSend([{ ...UNSENT, status: "Withdrawn", sentAt: null }]).length === 0 &&
            selectPOsAwaitingSend([UNSENT]).length === 1
    );
    check("no orders is no rows", selectPOsAwaitingSend([]).length, 0);
    check("  and a missing list is not a throw", selectPOsAwaitingSend(undefined).length, 0);
    // THE SELECTOR DOES NOT ORDER, and the page is where that is asserted: the shared
    // comparator takes rows rather than records, so mapping happens first.
    const page = parseFile(PAGE);
    const render = resolveFunction(page.ast, "renderPOListPage");
    assert("the page's render resolves", render !== null);
    if (render) {
        const src = readFileSync(repoPath(PAGE), "utf8").slice(render.start, render.end);
        assert("the strip's rows go through the shared wait ordering", /sortLongestWaitingFirst\(\s*\n?\s*selectPOsAwaitingSend/.test(src));
        assert("  and the day count through the shared arithmetic", /daysWaiting\(signedDate, today\)/.test(src));
        // NO READ OF ITS OWN: the strip maps `visible`, which the table already gated,
        // and names no field the mapper does not carry.
        assert("  it selects from the rows the table already gated", /selectPOsAwaitingSend\(visible\)/.test(src));
        check("  and adds no Airtable call", callsTo(render, "getUsersByRecordIds").length, 0);
        assert("  nor a sender lookup of any kind", !src.includes("sentBy"));
    }

    log("");
    log("one voice, one sentence, and no control named:");
    check("one order reads as one", AWAITING_SEND_COPY.heading(1), "1 signed order has not been sent to the vendor");
    check("and two do not", AWAITING_SEND_COPY.heading(2), "2 signed orders have not been sent to the vendor");
    assert(
        "the singular and plural headings actually differ",
        AWAITING_SEND_COPY.heading(1) !== AWAITING_SEND_COPY.heading(2)
    );
    assert("the explanation is one string rather than two voices", typeof AWAITING_SEND_COPY.explain === "string");
    assert("  it orders the reader's attention", /longest wait first/i.test(AWAITING_SEND_COPY.explain));
    assert("  and says why the state matters", /places the order/i.test(AWAITING_SEND_COPY.explain));
    // IT NAMES NO CONTROL, because who may send is per record rather than per role and
    // a missing document changes which control the order's page even offers (#290).
    assert(
        "no control is named",
        !/send to vendor/i.test(AWAITING_SEND_COPY.explain) && !/button|click|press/i.test(AWAITING_SEND_COPY.explain)
    );
    // NO THRESHOLD, AND ITS ABSENCE IS ASSERTED RATHER THAN ASSUMED: #263's sentence
    // names its figure in the copy, so a threshold added here without one would be a
    // rule no reader is told about.
    assert(
        "and the sentence promises no threshold",
        !/\bdays?\b/i.test(AWAITING_SEND_COPY.explain) && !/\bonly\b/i.test(AWAITING_SEND_COPY.explain)
    );
    // The two strips' sentences must not be one another's: they report different
    // states and #176's carries two voices where this carries one.
    assert(
        "the two strips on this page say different things",
        AWAITING_SEND_COPY.explain !== AWAITING_PO_COPY.explain.admin &&
            AWAITING_SEND_COPY.heading(2) !== AWAITING_PO_COPY.heading(2)
    );
}

if (isMain(import.meta.url)) standalone(title, run);
