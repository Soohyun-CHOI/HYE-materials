// Raising an overage PR from an over-delivery (#167) — the pure judgment.
//
// Three things this pins that nothing else can:
//   - ELIGIBILITY, clause by clause, including the out-of-scope case.
//   - THAT THE ORDERING IS #166'S, on the AST rather than by agreement: a second
//     sort by Issue Date would answer the same question differently and nothing
//     behavioral would notice.
//   - THAT THE BANNER IS DERIVED, from the linked PR's status and the row's flag,
//     so a withdrawal reopens the row with no write anywhere.
//
// What a pass does NOT prove: that the bills handed in were really every bill on the
// ordered item, or that the flag and the attachment moved in one write. Those are
// lib/overagePR.js's and Airtable's properties and live in
// scripts/tests/verify-overage-167.mjs.

import {
    OVERAGE_BLOCKED,
    OVERAGE_COPY,
    attachedPOItemRecordId,
    describeOverageBanner,
    describeOveragePreview,
    isNoLongerOverDelivered,
    isOverageApplied,
    overageBannerState,
    overageEligibility,
    overagePRState,
    resolveOriginalPOItem,
    selectOverageBill,
} from "../../../lib/overage.js";
import { INFERRED_PREMISE, STATUS_COPY } from "../../../lib/deliveryStatus.js";
import { parseFile, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Overage correction — eligibility, ordering, banner (#167)";

/** One over-delivery row as the readers see it. */
const row = (over = {}) => ({
    id: "recDI1",
    qty: 2,
    unit: "EA",
    itemName: "Pipe",
    size: '2"',
    overDelivered: true,
    poItem: ["recPOI1"],
    overagePRRecordId: null,
    formerPOItemRecordId: null,
    ...over,
});

const bill = (id, qty, issueDate, over = {}) => ({
    invoiceItemRecordId: `recII${id}`,
    invoiceRecordId: `recINV${id}`,
    invoiceId: `HYE-INV-2607${id}`,
    issueDate,
    qty,
    unitPrice: 12,
    hasFile: true,
    ...over,
});

export function run({ check, log, assert }) {
    // --- the excess needs no arithmetic ----------------------------------
    log("the excess is the row's own Qty — #162 made the over-delivery its own row:");
    check(
        "so eligibility reports it without subtracting anything",
        overageEligibility({ row: row({ qty: 3 }), bills: [bill("01", 10, "2026-07-01")] }).excess,
        3
    );

    // --- eligibility, clause by clause ------------------------------------
    log("");
    log("eligibility, in order, because the order is what stops a misleading reason:");
    check(
        "a row that was not over-delivered",
        overageEligibility({ row: row({ overDelivered: false }), bills: [] }).blocked,
        OVERAGE_BLOCKED.notOverDelivered
    );
    check(
        "a row naming no ordered item",
        overageEligibility({ row: row({ poItem: [] }), bills: [] }).blocked,
        OVERAGE_BLOCKED.noOrderedItem
    );
    check(
        "nothing bills the ordered item yet",
        overageEligibility({ row: row(), bills: [] }).blocked,
        OVERAGE_BLOCKED.noInvoice
    );
    check(
        "the invoice has no file to quote from",
        overageEligibility({ row: row(), bills: [bill("01", 10, "2026-07-01", { hasFile: false })] }).blocked,
        OVERAGE_BLOCKED.noInvoiceFile
    );
    check(
        "everything present",
        overageEligibility({ row: row(), bills: [bill("01", 10, "2026-07-01")] }).eligible,
        true
    );
    check("nullish does not throw", overageEligibility().blocked, OVERAGE_BLOCKED.notOverDelivered);

    // ALREADY RAISED is tested before anything about the invoice, so a row someone
    // is already correcting is never reported as blocked for a reason a reader
    // would then try to fix — getPOWithdrawEligibility's own ordering argument.
    log("");
    log("a live correction blocks BEFORE any invoice reason, deliberately:");
    const withNoInvoice = { row: row({ overagePRRecordId: "recPR1" }), bills: [] };
    check(
        "already raised wins over no-invoice",
        overageEligibility({ ...withNoInvoice, overagePR: { status: "In Review", prId: "HYE-PR-1" } }).blocked,
        OVERAGE_BLOCKED.alreadyRaised
    );

    // --- OUT OF SCOPE: an excess spanning two invoices --------------------
    log("");
    log("an excess larger than the oldest bill spans two invoices — out of scope:");
    // The reason is the QUOTATION, not the arithmetic: two invoices means two files
    // and a PR takes one. Under oldest-first that condition is exactly "the oldest
    // bill's invoice item is smaller than the excess", so it needs no rule of its own.
    const spans = overageEligibility({
        row: row({ qty: 5 }),
        bills: [bill("01", 3, "2026-07-01"), bill("02", 12, "2026-07-05")],
    });
    check("blocked", spans.blocked, OVERAGE_BLOCKED.spansInvoices);
    assert(
        "and the copy says the quotation is why, not the sum",
        OVERAGE_COPY.preview.blocked[OVERAGE_BLOCKED.spansInvoices]().text.includes("no single quotation")
    );
    // A newer bill that COULD absorb it does not rescue it: oldest-first is the rule,
    // and picking the other one would be a second answer to #166's ambiguity.
    assert("even though a later bill is large enough", spans.eligible === false);

    // --- WHICH BILL: #166'S ORDERING ---------------------------------------
    log("");
    log("which bill carries the excess — oldest first, then Invoice ID:");
    const two = [bill("10", 10, "2026-07-10"), bill("01", 10, "2026-07-01")];
    check("the oldest is chosen", selectOverageBill(two, 2).bill.invoiceId, "HYE-INV-260701");
    check("and it is marked inferred", selectOverageBill(two, 2).inferred, true);
    check("one bill needs no inference", selectOverageBill([bill("01", 10, "2026-07-01")], 2).inferred, false);
    check("  and is not blocked", selectOverageBill([bill("01", 10, "2026-07-01")], 2).blocked, null);
    const sameDay = [bill("02", 10, "2026-07-01"), bill("01", 10, "2026-07-01")];
    check("ties break on Invoice ID ascending", selectOverageBill(sameDay, 2).bill.invoiceId, "HYE-INV-260701");
    const undated = [bill("02", 10, ""), bill("01", 10, "2026-07-05")];
    check("an undated bill does not claim to be oldest", selectOverageBill(undated, 2).bill.invoiceId, "HYE-INV-260701");
    check("no bills at all", selectOverageBill([], 2).blocked, OVERAGE_BLOCKED.noInvoice);
    check("nullish does not throw", selectOverageBill(null, 2).blocked, OVERAGE_BLOCKED.noInvoice);

    log("");
    log("TWO BILLS IS THE WHOLE CONDITION — #166's determinacy does not transfer:");
    // allocateLineToInvoices calls a delivery covering EVERY bill determinate,
    // because there the question is whether a bill was covered. Here the question is
    // which bill's invoice item the excess sits in, and full coverage leaves that open.
    const covered = [bill("01", 10, "2026-07-01"), bill("02", 10, "2026-07-02")];
    check("two bills, both fully covered, still infers", selectOverageBill(covered, 2).inferred, true);
    assert(
        "and the premise sentence is #166's, imported rather than restated",
        OVERAGE_COPY.preview.inferred().text.includes(INFERRED_PREMISE)
    );
    assert(
        "with this module's own consequence, because the question is its own",
        OVERAGE_COPY.preview.inferred().text.includes("carrying the excess")
    );
    // #210 REMOVED THE OTHER HALF OF THIS PAIR, and what was asserted here was that
    // the two markers explained themselves with one premise and two endings. The
    // invoice axis's marker is gone — the pairing is stored, so nothing there is
    // inferred — so there is one ending left and this is now a claim about a shared
    // CONSTANT rather than about two sentences agreeing. The constant is still worth
    // pinning: it is imported from a module that no longer reads it, which is exactly
    // the shape a later cleanup would delete by accident.
    assert(
        "the invoice axis no longer has an inferred sentence to agree with",
        !("inferred" in STATUS_COPY.detail) && !("inferred" in STATUS_COPY.column)
    );
    // ANTI-VACUITY for the line above: the object it looks in must be the one that
    // holds the other detail entries, or "not in it" is what an empty object says.
    assert(
        "  and the object checked is the real one",
        typeof STATUS_COPY.detail.verdict === "object" &&
            typeof STATUS_COPY.column.mismatch === "function"
    );

    // --- THE ORDERING IS IMPORTED, ASSERTED ON THE AST -------------------
    log("");
    log("the ordering is #166's function, not a copy of it (AST):");
    const { ast } = parseFile("lib/overage.js");
    const imported = new Set();
    let importsFromDeliveryStatus = false;
    walk(ast, (node) => {
        if (node.type !== "ImportDeclaration") return;
        if (node.source.value !== "./deliveryStatus.js") return;
        importsFromDeliveryStatus = true;
        for (const spec of node.specifiers) imported.add(spec.imported?.name ?? spec.local.name);
    });
    assert("lib/overage.js imports from ./deliveryStatus.js", importsFromDeliveryStatus);
    assert("  including sortInvoicesOldestFirst", imported.has("sortInvoicesOldestFirst"));
    assert("  and the shared premise", imported.has("INFERRED_PREMISE"));
    // A second sort by Issue Date would answer the same question differently and
    // nothing behavioral would notice, which is why this is a source-shape check.
    let ownIssueDateSort = false;
    walk(ast, (node) => {
        if (node.type !== "CallExpression") return;
        const callee = node.callee;
        if (callee?.type !== "MemberExpression" || callee.property?.name !== "sort") return;
        const text = JSON.stringify(node.arguments);
        if (text.includes("issueDate") || text.includes("invoiceId")) ownIssueDateSort = true;
    });
    assert("and sorts nothing by Issue Date itself", !ownIssueDateSort);
    // The extension is spelled out because the offline tier runs under plain node.
    assert(
        "the import spells its extension out, or this file could not be loaded here",
        importsFromDeliveryStatus
    );

    // --- STATE IS READ, NEVER STORED --------------------------------------
    log("");
    log("whether a correction is pending is READ from the linked PR's Status:");
    check("no link", overagePRState(null), "none");
    check("a draft", overagePRState({ status: "Draft" }), "pending");
    check("in review", overagePRState({ status: "In Review" }), "pending");
    check("approved", overagePRState({ status: "Approved" }), "generated");
    check("PO signed", overagePRState({ status: "PO Signed" }), "generated");
    // The whole reason there is no boolean: a withdrawal reopens the row with no
    // write anywhere.
    check("WITHDRAWN reopens the row", overagePRState({ status: "Withdrawn" }), "none");
    assert(
        "so a withdrawn correction makes the row eligible again",
        overageEligibility({
            row: row({ overagePRRecordId: "recPR1" }),
            bills: [bill("01", 10, "2026-07-01")],
            overagePR: { status: "Withdrawn" },
        }).eligible === true
    );
    // An option added to the field later must not silently make a live correction
    // offerable twice — the opposite default from #144's denylist, on purpose.
    check("an unrecognized status is treated as pending", overagePRState({ status: "Something New" }), "pending");

    log("");
    log("and one hop further, to the overage order — a withdrawn PO is no correction:");
    check(
        "PO Signed with a withdrawn order reopens the row",
        overagePRState({ status: "PO Signed" }, { status: "Withdrawn" }),
        "none"
    );
    check(
        "a signed order does not",
        overagePRState({ status: "PO Signed" }, { status: "Signed" }),
        "generated"
    );
    check("omitting the order only means not noticing", overagePRState({ status: "PO Signed" }), "generated");

    // --- APPLIED IS PROVENANCE, NOT THE FLAG (#206) ------------------------
    log("");
    log("whether the excess MOVED is provenance, which one atomic write guarantees:");
    const moved = { overagePRRecordId: "recPR1", overDelivered: false, formerPOItemRecordId: "recPOI1" };
    check("linked and still flagged — not applied", isOverageApplied(row({ overagePRRecordId: "recPR1" })), false);
    check("linked with provenance — applied", isOverageApplied(row(moved)), true);
    check("provenance with no link is not an overage at all", isOverageApplied(row({ formerPOItemRecordId: "recPOI1" })), false);
    check("nullish does not throw", isOverageApplied(null), false);

    // THE WHOLE POINT OF #206: a recomputation may clear the flag on a row whose
    // excess never moved, and that must not read as applied. Before #206 this
    // exact input answered `true`.
    check(
        "linked, UNFLAGGED, no provenance — still NOT applied",
        isOverageApplied(row({ overagePRRecordId: "recPR1", overDelivered: false })),
        false
    );

    log("");
    log("the qualifier — a live correction whose excess is no longer there:");
    check(
        "linked, unflagged, never moved — fires",
        isNoLongerOverDelivered(row({ overagePRRecordId: "recPR1", overDelivered: false })),
        true
    );
    check(
        "linked and still flagged — does not",
        isNoLongerOverDelivered(row({ overagePRRecordId: "recPR1" })),
        false
    );
    // The third clause, and what it is for: an applied row is unflagged forever,
    // so without it the qualifier would fire on every settled correction.
    check("applied — does not, which is what the provenance clause buys", isNoLongerOverDelivered(row(moved)), false);
    check("no link at all — does not", isNoLongerOverDelivered(row({ overDelivered: false })), false);
    check("nullish does not throw", isNoLongerOverDelivered(null), false);

    log("");
    log("the original ordered item, in every state, as one expression:");
    check("before the apply step it is the row's own link", resolveOriginalPOItem(row()), "recPOI1");
    check(
        "after it, the provenance link",
        resolveOriginalPOItem(row({ poItem: ["recNEW"], formerPOItemRecordId: "recPOI1" })),
        "recPOI1"
    );
    check("neither", resolveOriginalPOItem({}), null);
    check("and the CURRENT attachment is its own accessor", attachedPOItemRecordId(row({ poItem: ["recNEW"] })), "recNEW");
    check("  which differs from the original after the apply step", attachedPOItemRecordId(row({ poItem: ["recNEW"], formerPOItemRecordId: "recPOI1" })), "recNEW");
    check("  nullish does not throw", attachedPOItemRecordId(null), null);
    check("nullish does not throw", resolveOriginalPOItem(null), null);

    // --- THE BANNER --------------------------------------------------------
    log("");
    log("the banner state is derived from the link and the flag, nothing else:");
    check("no correction, no banner", overageBannerState({ row: row(), overagePR: null }), null);
    check(
        "pending",
        overageBannerState({ row: row({ overagePRRecordId: "recPR1" }), overagePR: { status: "In Review" } }),
        "pending"
    );
    check(
        "the order exists and the excess moved",
        overageBannerState({
            row: row({ overagePRRecordId: "recPR1", overDelivered: false, formerPOItemRecordId: "recPOI1" }),
            overagePR: { status: "PO Signed" },
        }),
        "applied"
    );
    // #206 — an unflagged row that never moved is still not-applied, where before
    // the flag alone would have called it applied.
    check(
        "the order exists, the flag was recomputed away, but nothing moved",
        overageBannerState({
            row: row({ overagePRRecordId: "recPR1", overDelivered: false }),
            overagePR: { status: "PO Signed" },
        }),
        "not-applied"
    );
    // THE ONE FAILURE THIS FEATURE CAN LEAVE, and the only place it shows: the apply
    // step is outside PO generation's rollback and no email can be sent.
    check(
        "the order exists and it did NOT",
        overageBannerState({
            row: row({ overagePRRecordId: "recPR1" }),
            overagePR: { status: "PO Signed" },
        }),
        "not-applied"
    );

    log("");
    log("three sites, one first sentence each, with the shared endings appended:");
    const facts = {
        excess: 2,
        unit: "EA",
        itemName: "Pipe",
        size: '2"',
        deliveryId: "HYE-DL-260804-07",
        originalPoId: "HYE-PO-20260804-10",
        overagePrId: "HYE-PR-260805-01",
        overagePoId: "HYE-PO-20260806-01",
        invoiceId: "HYE-INV-260804-06",
        thisPoId: "HYE-PO-20260806-01",
    };
    for (const site of ["overagePR", "overagePO", "originalPO"]) {
        const applied = describeOverageBanner({ site, state: "applied", facts });
        check(`${site}: applied is the sentence plus the caveat`, applied.length, 2);
        check(`  and the caveat is second`, applied[1].key, "banner-invoice-caveat");
        assert(`  the first sentence names the delivery`, applied[0].text.includes("HYE-DL-260804-07"));
        const pending = describeOverageBanner({ site, state: "pending", facts });
        check(`${site}: pending says so`, pending[1].key, "banner-pending");
        // Until the split happens the invoice bills ONE order, so claiming it spans
        // two would be false.
        assert(`  and carries NO invoice caveat`, !pending.some((m) => m.key === "banner-invoice-caveat"));
        const notApplied = describeOverageBanner({ site, state: "not-applied", facts });
        check(`${site}: not-applied says the excess has not moved`, notApplied[1].key, "banner-not-applied");
        assert(`  and carries no caveat either`, !notApplied.some((m) => m.key === "banner-invoice-caveat"));
    }

    // --- #206'S QUALIFIER, COMPOSED WITH EACH STATE ------------------------
    log("");
    log("the qualifier is appended, not substituted, and only where it can act:");
    for (const site of ["overagePR", "overagePO", "originalPO"]) {
        for (const state of ["pending", "not-applied"]) {
            const plain = describeOverageBanner({ site, state, facts });
            const qualified = describeOverageBanner({ site, state, facts, noLongerOverDelivered: true });
            check(`${site}/${state}: adds exactly one message`, qualified.length, plain.length + 1);
            check(`  and it is last`, qualified.at(-1).key, "no-longer-over-delivered");
            // Appended rather than substituted: the state's own message survives.
            assert(
                `  the state's own message is still there`,
                plain.every((m, i) => qualified[i].key === m.key)
            );
            assert(`  it says the excess now fits`, /no longer\s+over-delivered/.test(qualified.at(-1).text));
        }
        // APPLIED HAS NO VOICE. The money is on the overage order and its invoice,
        // so nothing can be withdrawn, and naming an action the reader cannot take
        // would be worse than silence. isNoLongerOverDelivered cannot return true
        // for an applied row anyway — this is the second line of defense.
        const appliedQualified = describeOverageBanner({ site, state: "applied", facts, noLongerOverDelivered: true });
        check(
            `${site}/applied: nothing is appended`,
            appliedQualified.length,
            describeOverageBanner({ site, state: "applied", facts }).length
        );
    }
    // The two voices differ in the ACTION they name, which is the whole reason
    // there are two rather than one shared sentence.
    const qPending = describeOverageBanner({ site: "overagePR", state: "pending", facts, noLongerOverDelivered: true }).at(-1);
    const qNotApplied = describeOverageBanner({ site: "overagePR", state: "not-applied", facts, noLongerOverDelivered: true }).at(-1);
    assert("pending names the request as the thing to withdraw", qPending.text.includes(facts.overagePrId));
    assert("not-applied names the order instead", qNotApplied.text.includes(facts.overagePoId));
    assert("the two are not the same sentence", qPending.text !== qNotApplied.text);
    // Neither may name an action that is unavailable.
    for (const [label, m] of [["pending", qPending], ["not-applied", qNotApplied]]) {
        assert(`${label} does not tell the reader something cannot be done`, !/cannot/i.test(m.text));
    }

    check("no state, no messages", describeOverageBanner({ site: "overagePR", state: null }).length, 0);
    check("an unknown site renders nothing", describeOverageBanner({ site: "nope", state: "applied", facts }).length, 0);
    check("nullish does not throw", describeOverageBanner().length, 0);

    log("");
    log("THE ACCOUNTING CAVEAT is why the banner outlives signature:");
    const caveat = OVERAGE_COPY.banner.invoiceCaveat(facts).text;
    assert("it names the invoice", caveat.includes("HYE-INV-260804-06"));
    assert("says the invoice bills BOTH orders", caveat.includes("both orders"));
    assert("and that a payment will not match this order alone", caveat.includes("will not match"));
    assert("naming which order it means", caveat.includes("HYE-PO-20260806-01"));

    // The original PO's banner must not claim THIS order was over-delivered: one
    // delivery can fill two orders of the same material, and #165 attaches the
    // excess to the last one filled.
    const original = OVERAGE_COPY.banner.originalPO(facts).text;
    assert("the original PO's banner names the delivery, not a claim about the order", original.startsWith("Delivery "));
    assert("and points at the correction", original.includes("HYE-PR-260805-01"));

    // --- THE PREVIEW -------------------------------------------------------
    log("");
    log("the preview: one message for a blocked row, the full set otherwise:");
    check(
        "blocked gets exactly one — nothing else it might say is true",
        describeOveragePreview({ eligible: false, blocked: OVERAGE_BLOCKED.noInvoice }, facts).length,
        1
    );
    const full = describeOveragePreview({ eligible: true, excess: 2, inferred: false }, facts);
    check("eligible: summary then the draft note", full.map((m) => m.key).join(","), "preview-summary,preview-draft");
    const inferredPreview = describeOveragePreview({ eligible: true, excess: 2, inferred: true }, facts);
    check("inferred adds one, right after the summary", inferredPreview[1].key, "preview-inferred");
    const dropped = describeOveragePreview(
        { eligible: true, excess: 2, inferred: false },
        { ...facts, signersDropped: 2 }
    );
    check("dropped signers are reported", dropped[1].key, "preview-signers-dropped");
    assert("with the count", dropped[1].text.includes("2 signers"));
    const empty = describeOveragePreview(
        { eligible: true, excess: 2, inferred: false },
        { ...facts, signersDropped: 3, signersEmpty: true }
    );
    check("an empty chain replaces the count rather than adding to it", empty[1].key, "preview-signers-empty");
    assert(
        "and the count is not also shown",
        !empty.some((m) => m.key === "preview-signers-dropped")
    );
    assert(
        "the summary names the invoice, the price and the excess",
        (() => {
            const t = full[0].text;
            return t.includes("2 EA") && t.includes("HYE-INV-260804-06") && t.includes("HYE-PO-20260804-10");
        })()
    );
    check("an unknown reason renders nothing rather than crashing", describeOveragePreview({ eligible: false, blocked: "nope" }, facts).length, 0);
    check("nullish does not throw", describeOveragePreview().length, 0);

    // --- VOCABULARY --------------------------------------------------------
    log("");
    log("#166's vocabulary, unchanged — one word per fact:");
    const everySentence = [
        ...Object.values(OVERAGE_COPY.preview.blocked).map((f) => f(facts).text),
        OVERAGE_COPY.preview.summary({ ...facts, unitPriceLabel: "$12.00" }).text,
        OVERAGE_COPY.preview.inferred().text,
        OVERAGE_COPY.preview.signersDropped(2).text,
        OVERAGE_COPY.preview.signersEmpty().text,
        OVERAGE_COPY.preview.draft().text,
        ...["overagePR", "overagePO", "originalPO"].map((s) => OVERAGE_COPY.banner[s](facts).text),
        OVERAGE_COPY.banner.pending(facts).text,
        OVERAGE_COPY.banner.invoiceCaveat(facts).text,
        OVERAGE_COPY.banner.notApplied(facts).text,
    ];
    for (const forbidden of ["arriv", "recorded as", "over-billed", "short-shipped", "missing"]) {
        assert(
            `no message says "${forbidden}"`,
            !everySentence.some((t) => t.toLowerCase().includes(forbidden))
        );
    }
    // A `Line` on this base is a child of a Job, so an ordered item is never a line.
    assert(
        'no message calls an ordered item a "line"',
        !everySentence.some((t) => /\bline(s)?\b/i.test(t))
    );
    assert("every sentence is non-empty", everySentence.every((t) => t && t.length > 0));
    assert(
        "and none prints 'undefined' when the unit is blank",
        !OVERAGE_COPY.banner.overagePR({ ...facts, unit: "" }).text.includes("undefined")
    );
}

if (isMain(import.meta.url)) standalone(title, run);
