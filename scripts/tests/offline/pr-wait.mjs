// The listed/offered split, and the chip between them (#272).
//
// THE SILENT MUTANT THIS EXISTS FOR: a strip that always answers the same way.
// Collapse `stillWaiting` and `requestOfferable` back into one test and every
// screen still renders — every row simply has a button, or every row simply
// vanishes the moment somebody drafts a request, which is the state #167 shipped
// and nobody noticed until an abandoned draft took an excess off the only list
// that showed it. Nothing else can see that: both strips look perfectly ordinary
// with one of the two answers missing, because the row that would prove otherwise
// is the row that is not there.
//
// SO THE FIRST ASSERTION IS THAT THE TWO ANSWERS DIVERGE. Everything after it is
// per-stage detail, and none of it is worth anything if the split has quietly
// become a synonym.
//
// It also pins the two callers' agreement: `lib/overage.js:overageStillWaiting`
// composes this rule with #167's own reopening rule, and their ORDER matters — a
// withdrawn overage ORDER reopens a row whose request says `PO Signed`, so asking
// the stage first would drop it.

import { WAIT_COPY, WAIT_STAGE, requestOfferable, stillWaiting, waitStage } from "../../../lib/prWait.js";
import { awaitsOverageRequest, overageStillWaiting } from "../../../lib/overage.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "A record waiting for a request — listed, offered, or let go (#272)";

/** An over-delivery row as lib/overage.js reads one. */
const row = (over = {}) => ({
    overDelivered: true,
    poItem: ["recPOItem1"],
    qty: 2,
    ...over,
});

export function run({ check, assert, log }) {
    // ── the mutant, first ───────────────────────────────────────────────────
    log("listed and offered are two answers, and something separates them:");
    const stages = [null, { status: "Draft" }, { status: "In Review" }, { status: "Withdrawn" }];
    const listed = stages.map((pr) => stillWaiting(pr));
    const offered = stages.map((pr) => requestOfferable(pr));
    assert(
        "the two disagree on at least one input — a strip with one answer is the defect",
        listed.some((value, i) => value !== offered[i])
    );
    check("and they disagree on exactly the draft", listed.join(",") !== offered.join(","), true);
    check("a draft is listed", stillWaiting({ status: "Draft" }), true);
    check("  and not offered", requestOfferable({ status: "Draft" }), false);

    // ── the three stages ────────────────────────────────────────────────────
    log("");
    log("how far the request a waiting record produced has got:");
    check("nothing covers it", waitStage(null), WAIT_STAGE.none);
    check("a draft covers it", waitStage({ status: "Draft" }), WAIT_STAGE.draft);
    check("in review", waitStage({ status: "In Review" }), WAIT_STAGE.raised);
    check("approved", waitStage({ status: "Approved" }), WAIT_STAGE.raised);
    check("its order signed", waitStage({ status: "PO Signed" }), WAIT_STAGE.raised);
    // #167's rule, unchanged and load-bearing on both axes: withdrawal reopens the
    // record, which is why neither side stores a boolean for "covered".
    check("withdrawn reopens it", waitStage({ status: "Withdrawn" }), WAIT_STAGE.none);
    check("  so it is offered again", requestOfferable({ status: "Withdrawn" }), true);
    // An unknown status is a request somebody can still find on /prs, so the LIST
    // lets it go — the opposite default from overagePRState, which decides whether
    // to offer and must not offer twice.
    check("an unknown status reads as raised", waitStage({ status: "Rejected?" }), WAIT_STAGE.raised);
    check("  so the strip lets it go", stillWaiting({ status: "Rejected?" }), false);
    check("undefined does not throw", waitStage(undefined), WAIT_STAGE.none);

    // ── the chip ────────────────────────────────────────────────────────────
    log("");
    log("the chip a listed-but-unoffered row carries:");
    check("names the person", WAIT_COPY.draftChip("chkim"), "draft with chkim");
    check("and says the state without one", WAIT_COPY.draftChip(null), "draft, not submitted");
    assert("the two voices differ", WAIT_COPY.draftChip("chkim") !== WAIT_COPY.draftChip(null));
    // A chip, not a sentence: the strip gives a row one line (#217's density rule).
    assert("it is chip-sized", WAIT_COPY.draftChip("chkim").length < 30);

    // ── the overage composition ─────────────────────────────────────────────
    log("");
    log("the over-delivery strip composes it with #167's own reopening rule:");
    check("flagged, nothing covering it — listed", overageStillWaiting({ row: row() }), true);
    check("  and offered", awaitsOverageRequest({ row: row() }), true);
    check(
        "a draft covers it — still listed",
        overageStillWaiting({ row: row(), overagePR: { status: "Draft" } }),
        true
    );
    check(
        "  but no longer offered",
        awaitsOverageRequest({ row: row(), overagePR: { status: "Draft" } }),
        false
    );
    check(
        "in review — the request is on /prs, so the row goes",
        overageStillWaiting({ row: row(), overagePR: { status: "In Review" } }),
        false
    );
    check(
        "its order generated — gone too",
        overageStillWaiting({ row: row(), overagePR: { status: "PO Signed" } }),
        false
    );
    // THE ORDER OF THE TWO CLAUSES, and the case that proves it has to be that way:
    // a withdrawn overage ORDER reopens the row (#167) even though its request reads
    // `PO Signed`, which the stage alone would call `raised`.
    check(
        "a withdrawn overage ORDER reopens a PO-Signed row",
        overageStillWaiting({
            row: row(),
            overagePR: { status: "PO Signed" },
            overagePO: { status: "Withdrawn" },
        }),
        true
    );
    check(
        "  and the stage alone would have dropped it",
        waitStage({ status: "PO Signed" }),
        WAIT_STAGE.raised
    );
    // The two exclusions that predate this split are untouched by it.
    check(
        "an unflagged row is on neither list",
        overageStillWaiting({ row: row({ overDelivered: false }) }),
        false
    );
    check(
        "nor is one whose ordered item was emptied by hand (#278's silent refusal)",
        overageStillWaiting({ row: row({ poItem: [] }) }),
        false
    );
    check("nullish does not throw", overageStillWaiting(), false);

    // ── anti-vacuity ────────────────────────────────────────────────────────
    log("");
    log("anti-vacuity — the corpus reaches every stage, and the rule discriminates:");
    const corpus = [
        null,
        { status: "Draft" },
        { status: "In Review" },
        { status: "Approved" },
        { status: "PO Signed" },
        { status: "Withdrawn" },
    ];
    const reached = new Set(corpus.map(waitStage));
    check("all three stages are reachable from it", reached.size, 3);
    const stillListed = corpus.filter(stillWaiting).length;
    // Three of six: nothing, a draft, and a withdrawal. A rule that answered the
    // same for every input would show up here as 0 or 6.
    check("and the corpus splits rather than agreeing", stillListed, 3);
}

if (isMain(import.meta.url)) standalone(title, run);
