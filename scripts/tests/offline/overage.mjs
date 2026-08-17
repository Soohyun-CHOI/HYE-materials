// Raising an overage PR from an over-delivery (#167, #219) — the pure judgment.
//
// Four things this pins that nothing else can:
//   - ELIGIBILITY, clause by clause, including both out-of-scope cases.
//   - THE CANDIDATE TIERS (#219): a bill naming another shipment is never picked, a
//     bill naming this one wins over one naming none, and only the fallback tier
//     infers on a single bill. This is the defect #219 closes, so every tier is
//     asserted to give a DIFFERENT answer on the same input.
//   - THAT THE ORDERING IS THIS MODULE'S AND PRIVATE, on the AST: it moved out of
//     lib/deliveryStatus.js with #219, and a second sort by Issue Date anywhere
//     would answer the same question differently with nothing behavioral noticing.
//   - THAT THE BANNER IS DERIVED, from the linked PR's status and the row's flag,
//     so a withdrawal reopens the row with no write anywhere.
//
// What a pass does NOT prove: that the bills handed in were really every bill on the
// ordered item, that the `deliveryRecordId` on each one is the pairing Airtable
// holds, or that the flag and the attachment moved in one write. Those are
// lib/overagePR.js's and Airtable's properties and live in
// scripts/tests/verify-overage-167.mjs.

import {
    OVERAGE_BLOCKED,
    OVERAGE_COPY,
    OVERAGE_INFERRED,
    OVERAGE_STAGE,
    attachedDeliveryRecordId,
    attachedPOItemRecordId,
    awaitsCorrection,
    describeOverageBanner,
    describeOveragePreview,
    inferredLabel,
    isNoLongerOverDelivered,
    isOverageApplied,
    overageBannerState,
    overageEligibility,
    overagePRState,
    overageStageKey,
    resolveOriginalPOItem,
    selectCopyableSigners,
    selectOverageBill,
} from "../../../lib/overage.js";
// The namespace too, so "the ordering is private" is a claim about the export list
// rather than about a name this file chose not to import (#219).
import * as overage from "../../../lib/overage.js";
import { STATUS_COPY } from "../../../lib/deliveryStatus.js";
import { callPassesProperty, callsTo, parseFile, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Overage correction — eligibility, candidate bills, banner (#167, #219)";

/** The shipment the excess arrived on, and one it did not. */
const DELIVERY = "recDL1";
const OTHER_DELIVERY = "recDL2";

/** One over-delivery row as the readers see it. */
const row = (over = {}) => ({
    id: "recDI1",
    qty: 2,
    unit: "EA",
    itemName: "Pipe",
    size: '2"',
    overDelivered: true,
    poItem: ["recPOI1"],
    // #219 — the row's own shipment, which is what narrows the candidates.
    delivery: [DELIVERY],
    overagePRRecordId: null,
    formerPOItemRecordId: null,
    ...over,
});

/**
 * A bill NAMING THIS SHIPMENT — the tier #219 prefers, so every clause that is not
 * about the narrowing reads without a pairing spelled out in it.
 */
const bill = (id, qty, issueDate, over = {}) => ({
    invoiceItemRecordId: `recII${id}`,
    invoiceRecordId: `recINV${id}`,
    invoiceId: `HYE-INV-2607${id}`,
    issueDate,
    qty,
    unitPrice: 12,
    hasFile: true,
    deliveryRecordId: DELIVERY,
    ...over,
});

/** The same bill naming NO shipment — #210's ordinary state, and the fallback tier. */
const unpairedBill = (id, qty, issueDate, over = {}) =>
    bill(id, qty, issueDate, { deliveryRecordId: null, ...over });

/** And one naming a DIFFERENT shipment, which is never a candidate. */
const otherShipmentBill = (id, qty, issueDate, over = {}) =>
    bill(id, qty, issueDate, { deliveryRecordId: OTHER_DELIVERY, ...over });

/** selectOverageBill for this row's shipment unless told otherwise. */
const pick = (bills, excess, deliveryRecordId = DELIVERY) =>
    selectOverageBill({ bills, excess, deliveryRecordId });

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

    // --- THE CANDIDATE TIERS (#219) ---------------------------------------
    // THE DEFECT THIS CLOSES. The candidates used to be every bill on the ordered
    // item, so an order filled by two deliveries could attach the wrong vendor
    // invoice: the quotation, its code and its unit price all come off the picked
    // bill, so the document that went out was wrong rather than merely uncertain.
    log("");
    log("the candidates are the bills naming THIS shipment — tiers, never mixed:");
    const mine = bill("01", 10, "2026-07-01");
    const theirs = otherShipmentBill("02", 10, "2026-06-01");
    const nobodys = unpairedBill("03", 10, "2026-06-15");

    check("a bill naming this shipment is picked", pick([mine], 2).bill.invoiceId, mine.invoiceId);
    check("  and nothing is inferred — the pairing says which", pick([mine], 2).inferred, null);
    // THE HEART OF IT: the other shipment's bill is OLDER, so oldest-first alone
    // would have taken it. This is the exact input that used to pick wrong.
    check("an older bill naming another shipment loses", pick([theirs, mine], 2).bill.invoiceId, mine.invoiceId);
    check("  and it is still not inferred", pick([theirs, mine], 2).inferred, null);
    // A recorded pairing must not lose to an unrecorded one under an ordering, which
    // is what mixing the tiers would do — the unpaired bill here is older too.
    check("an unpaired bill does not dilute the pairing", pick([nobodys, mine], 2).bill.invoiceId, mine.invoiceId);
    check("  so one paired bill stays uninferred beside it", pick([nobodys, mine], 2).inferred, null);

    log("");
    log("nothing names this shipment — the fallback tier, ONE candidate only:");
    // `?.` so a refusal here reports a FAIL rather than throwing on a null bill: the
    // mutation that widens the refusal to one candidate lands exactly here, and a
    // stack trace is a worse signal than the comparison.
    check("an unpaired bill is still a candidate", pick([nobodys], 2).bill?.invoiceId, nobodys.invoiceId);
    // #210's ORDINARY STATE, not an anomaly: the vendor emails the bill at shipment,
    // so excluding these would make the correction wait on an optional field.
    check("  but the answer is inferred at one bill", pick([nobodys], 2).inferred, OVERAGE_INFERRED.noPairing);
    check(
        "another shipment's bill is not rescued by the fallback either",
        pick([theirs, nobodys], 2).bill.invoiceId,
        nobodys.invoiceId
    );

    // TWO UNPAIRED CANDIDATES ARE REFUSED, NOT ORDERED. Nothing records that either
    // bill describes this arrival, so an ordering would be a choice with nothing
    // behind it — and `Issue Date` is human-entered, so a vendor's typo could decide
    // which file, unit price and vendor code go onto a purchase order.
    log("");
    log("TWO unpaired candidates are refused rather than chosen between:");
    const twoUnpaired = [unpairedBill("03", 10, "2026-06-15"), unpairedBill("04", 10, "2026-06-20")];
    check("blocked", pick(twoUnpaired, 2).blocked, OVERAGE_BLOCKED.severalUnpairedBills);
    check("  and no bill is handed back", pick(twoUnpaired, 2).bill, null);
    // A refusal has no answer to qualify, so it carries no marker either.
    check("  nor an inference to qualify", pick(twoUnpaired, 2).inferred, null);
    // The oldest is NOT quietly picked: this is the assertion that would have caught
    // the version this replaced, which sorted and took the head.
    assert(
        "  the oldest is not picked in passing",
        pick(twoUnpaired, 2).bill?.invoiceId !== "HYE-INV-260703"
    );
    // ANTI-VACUITY FOR THE COUNT BOUNDARY: one candidate and two candidates must give
    // DIFFERENT answers, or the refusal is either unreachable or swallowing the case
    // that should proceed.
    const one = pick([twoUnpaired[0]], 2);
    const two_ = pick(twoUnpaired, 2);
    assert(
        `one unpaired candidate proceeds and two refuse (${one.bill?.invoiceId ?? one.blocked} vs ${two_.bill?.invoiceId ?? two_.blocked})`,
        Boolean(one.bill) && !two_.bill
    );
    check("  and the one that proceeds still says nothing named it", one.inferred, OVERAGE_INFERRED.noPairing);
    // A paired bill beside two unpaired ones takes the higher tier, so the refusal is
    // the fallback tier's own and never reached when the pairing answers.
    check(
        "a pairing beside them answers instead of refusing",
        pick([...twoUnpaired, mine], 2).bill.invoiceId,
        mine.invoiceId
    );
    assert(
        "the copy says what is missing is a record",
        OVERAGE_COPY.preview.blocked[OVERAGE_BLOCKED.severalUnpairedBills]().text.includes(
            "nothing records which one"
        )
    );
    assert(
        "  and names the action that supplies it",
        /Attach this delivery's own invoice from Edit/.test(
            OVERAGE_COPY.preview.blocked[OVERAGE_BLOCKED.severalUnpairedBills]().text
        )
    );
    // It must not promise eligibility: the newly named bill still needs a file and
    // still has to cover the excess.
    assert(
        "  without promising the correction becomes available",
        !/becomes available|will be available/i.test(
            OVERAGE_COPY.preview.blocked[OVERAGE_BLOCKED.severalUnpairedBills]().text
        )
    );
    assert(
        "and it is not the other-delivery sentence",
        OVERAGE_COPY.preview.blocked[OVERAGE_BLOCKED.severalUnpairedBills]().text !==
            OVERAGE_COPY.preview.blocked[OVERAGE_BLOCKED.otherDeliveryOnly]().text
    );

    log("");
    log("every bill names another shipment — a refusal of its own, not `no-invoice`:");
    check("blocked", pick([theirs], 2).blocked, OVERAGE_BLOCKED.otherDeliveryOnly);
    check("  and nothing is claimed to be inferred", pick([theirs], 2).inferred, null);
    // Merging this into `noInvoice` would print "No invoice bills this ordered item
    // yet", which is false: one does, and it describes another arrival.
    assert(
        "  the copy does not claim nothing bills the ordered item",
        !OVERAGE_COPY.preview.blocked[OVERAGE_BLOCKED.otherDeliveryOnly]().text.includes("No invoice bills")
    );
    assert(
        "  it says the bills name a different delivery",
        OVERAGE_COPY.preview.blocked[OVERAGE_BLOCKED.otherDeliveryOnly]().text.includes("different delivery")
    );
    check("nothing bills it at all is still `no-invoice`", pick([], 2).blocked, OVERAGE_BLOCKED.noInvoice);
    check("nullish does not throw", selectOverageBill().blocked, OVERAGE_BLOCKED.noInvoice);
    check("  nor does a nullish bill list", pick(null, 2).blocked, OVERAGE_BLOCKED.noInvoice);

    // A MISSING SHIPMENT MUST NOT READ AS THE PAIRING TIER. Without the truthiness
    // guard in candidateBills, a null delivery id would compare equal to an unpaired
    // bill's null and the fallback would announce itself as a lookup.
    log("");
    log("a row with no shipment falls to the fallback and SAYS so:");
    check("the unpaired bill is still found", pick([nobodys], 2, null).bill.invoiceId, nobodys.invoiceId);
    check("  and the answer is inferred, not certain", pick([nobodys], 2, null).inferred, OVERAGE_INFERRED.noPairing);
    check("a paired bill is then out of reach", pick([mine], 2, null).blocked, OVERAGE_BLOCKED.otherDeliveryOnly);

    // ANTI-VACUITY FOR THE WHOLE SECTION: one bill list, three shipment arguments,
    // three different answers. If the narrowing were not happening at all, these
    // would agree — which is what the pre-#219 code did.
    log("");
    log("  anti-vacuity — the same bills answer differently per shipment:");
    const all = [theirs, nobodys, mine];
    const answers = [
        pick(all, 2, DELIVERY),
        pick(all, 2, OTHER_DELIVERY),
        pick(all, 2, null),
    ].map((r) => `${r.bill?.invoiceId ?? r.blocked}/${r.inferred}`);
    assert(`three distinct answers (${answers.join(", ")})`, new Set(answers).size === 3);
    // Distinct is not enough on its own: each answer must be the bill of the shipment
    // asked about, which is the property rather than three different strings.
    check("  this shipment gets its own bill", pick(all, 2, DELIVERY).bill.invoiceId, mine.invoiceId);
    check("  the other shipment gets its own", pick(all, 2, OTHER_DELIVERY).bill.invoiceId, theirs.invoiceId);
    check("  and a row naming none gets the unpaired one", pick(all, 2, null).bill.invoiceId, nobodys.invoiceId);

    // --- ORDER WITHIN A TIER, AND THE TWO REFUSALS ------------------------
    log("");
    log("within a tier: oldest first, then Invoice ID — the ordering moved here (#219):");
    const two = [bill("10", 10, "2026-07-10"), bill("01", 10, "2026-07-01")];
    check("the oldest is chosen", pick(two, 2).bill.invoiceId, "HYE-INV-260701");
    check("and it is marked inferred", pick(two, 2).inferred, OVERAGE_INFERRED.severalBills);
    const sameDay = [bill("02", 10, "2026-07-01"), bill("01", 10, "2026-07-01")];
    check("ties break on Invoice ID ascending", pick(sameDay, 2).bill.invoiceId, "HYE-INV-260701");
    const undated = [bill("02", 10, ""), bill("01", 10, "2026-07-05")];
    check("an undated bill does not claim to be oldest", pick(undated, 2).bill.invoiceId, "HYE-INV-260701");
    // The ordering is only ever asked within one tier, so an undated bill of ANOTHER
    // shipment cannot take the head of the queue.
    check(
        "and an undated bill of another shipment is not in the queue at all",
        pick([otherShipmentBill("02", 10, ""), bill("01", 10, "2026-07-05")], 2).bill.invoiceId,
        "HYE-INV-260701"
    );

    log("");
    log("TWO BILLS ON THIS SHIPMENT IS THE CONDITION — #166's determinacy does not transfer:");
    // allocateLineToInvoices called a delivery covering EVERY bill determinate,
    // because there the question is whether a bill was covered. Here the question is
    // which bill's invoice item the excess sits in, and full coverage leaves that open.
    const covered = [bill("01", 10, "2026-07-01"), bill("02", 10, "2026-07-02")];
    check("two bills, both fully covered, still infers", pick(covered, 2).inferred, OVERAGE_INFERRED.severalBills);
    // ONE SENTENCE PER TIER, and each names the fact that produced it. The premise was
    // a constant shared with lib/deliveryStatus.js until #219; the invoice axis's
    // marker went with #210's stored pairing, so there is nothing left to share with.
    assert(
        "the several-bills sentence names this delivery's own bills",
        OVERAGE_COPY.preview.inferred[OVERAGE_INFERRED.severalBills]().text.includes(
            "this delivery carries more than one bill"
        )
    );
    assert(
        "the no-pairing sentence says nothing names this delivery",
        OVERAGE_COPY.preview.inferred[OVERAGE_INFERRED.noPairing]().text.includes(
            "no invoice names this delivery"
        )
    );
    for (const key of Object.values(OVERAGE_INFERRED)) {
        const sentence = OVERAGE_COPY.preview.inferred[key]();
        assert(`${key}: says what it concludes, not only its premise`, sentence.text.includes("carrying the excess"));
        // Two readings of ONE qualifier, so one key — the arrangement
        // noLongerOverDelivered already uses for its two voices.
        check(`  and shares the qualifier's message key`, sentence.key, "preview-inferred");
    }
    assert(
        "the two sentences are not the same sentence",
        OVERAGE_COPY.preview.inferred[OVERAGE_INFERRED.severalBills]().text !==
            OVERAGE_COPY.preview.inferred[OVERAGE_INFERRED.noPairing]().text
    );
    // The invoice axis has no inferred copy left to agree with, which is what #210
    // removed and what #219 relies on when it stops sharing a constant.
    assert(
        "the invoice axis no longer has an inferred sentence to agree with",
        !("inferred" in STATUS_COPY.detail) && !("inferred" in STATUS_COPY.column)
    );
    // ANTI-VACUITY for the line above: the object it looks in must be the one that
    // holds the other detail entries, or "not in it" is what an empty object says.
    // The `column` half was `column.mismatch` until #232 made the discrepancy a chip
    // value and retired that label; `column.invoice` is the member that holds the
    // chips, so it is the one whose presence proves the object is real.
    assert(
        "  and the object checked is the real one",
        typeof STATUS_COPY.detail.verdict === "object" &&
            typeof STATUS_COPY.column.invoice === "object"
    );

    // --- OUT OF SCOPE: AN EXCESS ONE BILL CANNOT CARRY --------------------
    log("");
    log("the excess must fit the chosen bill — TWO refusals, because one lied (#219):");
    // Two candidate bills on this shipment and the oldest is too small: the excess
    // genuinely spans two invoices, and the reason is the QUOTATION rather than the
    // arithmetic — two invoices means two files and a PR takes one.
    const spans = overageEligibility({
        row: row({ qty: 5 }),
        bills: [bill("01", 3, "2026-07-01"), bill("02", 12, "2026-07-05")],
    });
    check("two bills, oldest too small — spans", spans.blocked, OVERAGE_BLOCKED.spansInvoices);
    assert(
        "and the copy says the quotation is why, not the sum",
        OVERAGE_COPY.preview.blocked[OVERAGE_BLOCKED.spansInvoices]().text.includes("no single quotation")
    );
    // A newer bill that COULD absorb it does not rescue it: oldest-first is the rule
    // within the tier, and picking the other one would be a second answer to the
    // same ambiguity.
    assert("even though a later bill is large enough", spans.eligible === false);
    // ONE bill and it is too small: nothing is spanned. Under the single old reason
    // this printed "so it spans more than one invoice", with one invoice in play.
    const tooSmall = overageEligibility({
        row: row({ qty: 5 }),
        bills: [bill("01", 3, "2026-07-01")],
    });
    check("one bill, too small — a fact about the quantity", tooSmall.blocked, OVERAGE_BLOCKED.excessExceedsBill);
    assert(
        "and its copy does not claim anything spans two invoices",
        !OVERAGE_COPY.preview.blocked[OVERAGE_BLOCKED.excessExceedsBill]().text.includes("spans")
    );
    assert(
        "  it says the excess is larger than what is billed",
        OVERAGE_COPY.preview.blocked[OVERAGE_BLOCKED.excessExceedsBill]().text.includes("larger than")
    );
    // The two refusals are distinct keys AND distinct sentences, or splitting them
    // bought nothing.
    assert(
        "the two refusals do not share a sentence",
        OVERAGE_COPY.preview.blocked[OVERAGE_BLOCKED.spansInvoices]().text !==
            OVERAGE_COPY.preview.blocked[OVERAGE_BLOCKED.excessExceedsBill]().text
    );
    // Every blocked key the module defines has a message, or a row renders a blank box.
    for (const key of Object.values(OVERAGE_BLOCKED)) {
        assert(`\`${key}\` has copy`, typeof OVERAGE_COPY.preview.blocked[key] === "function");
    }

    log("");
    log("the row's own shipment is where the narrowing comes from:");
    check("read off the link array", attachedDeliveryRecordId(row()), DELIVERY);
    check("  absent is null, not undefined", attachedDeliveryRecordId(row({ delivery: [] })), null);
    check("  nullish does not throw", attachedDeliveryRecordId(null), null);
    // Eligibility takes it from the row, so no caller has to pass it separately —
    // which is what makes a forgotten argument impossible on that path.
    check(
        "eligibility narrows without being told which delivery",
        overageEligibility({ row: row(), bills: [otherShipmentBill("02", 10, "2026-06-01")] }).blocked,
        OVERAGE_BLOCKED.otherDeliveryOnly
    );

    // --- THE ORDERING IS THIS MODULE'S, AND PRIVATE (AST) ----------------
    log("");
    log("the ordering moved here with #219 and is not exported (AST):");
    const { ast } = parseFile("lib/overage.js");
    let importsFromDeliveryStatus = false;
    walk(ast, (node) => {
        if (node.type !== "ImportDeclaration") return;
        if (node.source.value?.includes("deliveryStatus")) importsFromDeliveryStatus = true;
    });
    assert("lib/overage.js imports nothing from lib/deliveryStatus.js", !importsFromDeliveryStatus);
    assert(
        "  and `sortInvoicesOldestFirst` is not on its export list either",
        !("sortInvoicesOldestFirst" in overage)
    );
    assert("  nor is a premise constant", !("INFERRED_PREMISE" in overage));
    // EXACTLY ONE sort by Issue Date in the repo's judgment layer: this one. Two would
    // answer the same question differently and nothing behavioral would notice, which
    // is why this is a source-shape check — and the count is asserted rather than mere
    // presence, so a copy added beside it fails.
    const billSorts = [];
    walk(ast, (node) => {
        if (node.type !== "CallExpression") return;
        const callee = node.callee;
        if (callee?.type !== "MemberExpression" || callee.property?.name !== "sort") return;
        if (JSON.stringify(node.arguments).includes("issueDate")) billSorts.push(node);
    });
    check("one Issue Date sort, and it lives here now", billSorts.length, 1);
    assert("  and it tie-breaks on Invoice ID", JSON.stringify(billSorts[0].arguments).includes("invoiceId"));
    // ONE TIER ORDERS, THE OTHER REFUSES — asserted as a call count, because the
    // behavioral difference is invisible at one candidate and this is the shape a
    // later edit would undo by "tidying" the fallback tier into symmetry with the
    // paired one.
    check("the ordering is called from exactly one tier", callsTo(ast, "sortInvoicesOldestFirst").length, 1);

    // THE CALLER OBLIGATION, PINNED. selectOverageBill falls to the fallback tier
    // when it is not told which shipment — the honest answer for a row that names
    // none, and the wrong one for a caller that forgot. Every call site in the
    // credentialed module passes it, including the APPLY step, which has to split the
    // same bill the preview quoted.
    log("");
    log("every selectOverageBill call site names a shipment (AST):");
    const { ast: prAst } = parseFile("lib/overagePR.js");
    // BOTH NAMES, BECAUSE THE APPLY PATH HAS A HOP. `applyOverageToPO` hands the
    // shipment to `splitInvoiceLineForOverage`, which passes it on as a shorthand
    // property — so asserting only the inner call would have been satisfied by a
    // shorthand whose value the outer call had stopped supplying. Measured: dropping
    // it from the outer call passed a check that only looked at the inner one.
    const callSites = ["selectOverageBill", "splitInvoiceLineForOverage"].flatMap((name) =>
        callsTo(prAst, name).map((call) => ({ name, call }))
    );
    assert(`found ${callSites.length} call sites, preview and apply alike`, callSites.length >= 5);
    for (const [i, { name, call }] of callSites.entries()) {
        assert(`  ${name} call ${i + 1} passes deliveryRecordId`, callPassesProperty(call, "deliveryRecordId"));
    }
    // ANTI-VACUITY for that matcher: it must report false for a property that is not
    // there, or every call "passes" everything.
    assert(
        "  and the matcher is not answering true for anything",
        !callPassesProperty(callSites[0].call, "shipmentRecordId")
    );
    assert(
        "  both names really were found, so neither loop ran empty",
        callSites.some((c) => c.name === "selectOverageBill") &&
            callSites.some((c) => c.name === "splitInvoiceLineForOverage")
    );
    // The pairing is flattened in ONE place (#210), so the credentialed side takes
    // linkedDelivery rather than indexing `.delivery[0]` a second time.
    const prImports = new Map();
    walk(prAst, (node) => {
        if (node.type !== "ImportDeclaration") return;
        for (const spec of node.specifiers) {
            prImports.set(spec.imported?.name ?? spec.local.name, node.source.value);
        }
    });
    check("the flattening comes from #210's own module", prImports.get("linkedDelivery"), "./deliveryInvoiceLink");
    check("and the judgment from this one", prImports.get("selectOverageBill"), "./overage");
    check("  including the row accessor", prImports.get("attachedDeliveryRecordId"), "./overage");

    // AND THE FIELD THE ACCESSOR READS IS ON THE ROWS. Every over-delivery row reaches
    // the narrowing through lib/airtable/deliveryItems.js's one mapper, so a
    // projection without `delivery` would degrade every answer to the fallback tier
    // in silence — no error, just an inference where a lookup was available.
    const { ast: rowAst } = parseFile("lib/airtable/deliveryItems.js");
    const rowFields = new Set();
    walk(rowAst, (node) => {
        if (node.type === "Property" && node.key?.name) rowFields.add(node.key.name);
    });
    assert("the Delivery Items mapper projects `delivery`", rowFields.has("delivery"));
    assert(
        "  and the walk sees its siblings, so that is not an empty set",
        rowFields.has("poItem") && rowFields.has("overDelivered")
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
        // #233 — NO SENTENCE PRINTS A MISSING FACT AS `null`. The order's page
        // supplies these facts without an invoice whenever the reader is not the
        // office, since the bill a correction spans is invoice-derived while the
        // banner itself is not; `invoiceCaveat` interpolated `f.invoiceId` with no
        // fallback, so it opened with the literal word.
        for (const state of ["applied", "pending", "not-applied"]) {
            const withoutBill = describeOverageBanner({
                site,
                state,
                facts: { ...facts, invoiceId: null },
            });
            assert(
                `${site}/${state}: says no "null" when no invoice is known`,
                !withoutBill.some((m) => /\bnull\b/.test(m.text))
            );
        }
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

    // --- #217: THE STRIP'S SELECTION ---------------------------------------
    log("");
    log("which rows the strip above /prs lists — flagged, and no live correction:");
    check("flagged with nothing covering it", awaitsCorrection({ row: row() }), true);
    check("a draft covers it", awaitsCorrection({ row: row(), overagePR: { status: "Draft" } }), false);
    check("  as does one in review", awaitsCorrection({ row: row(), overagePR: { status: "In Review" } }), false);
    check("  and one whose order exists", awaitsCorrection({ row: row(), overagePR: { status: "PO Signed" } }), false);
    // The two clauses this composition inherits, and the reason it is a composition:
    // a withdrawal reopens the row with no write anywhere, and so does withdrawing
    // the overage ORDER one hop further.
    check(
        "a WITHDRAWN correction puts the row back on the list",
        awaitsCorrection({ row: row(), overagePR: { status: "Withdrawn" } }),
        true
    );
    check(
        "  and so does a withdrawn overage order",
        awaitsCorrection({ row: row(), overagePR: { status: "PO Signed" }, overagePO: { status: "Withdrawn" } }),
        true
    );
    check("an unflagged row is not on the list", awaitsCorrection({ row: row({ overDelivered: false }) }), false);
    // #206's row: linked, unflagged, never moved. It is not an over-delivery any
    // more, so it is not something to correct.
    check(
        "nor is #206's no-longer-over-delivered row",
        awaitsCorrection({ row: row({ overDelivered: false, overagePRRecordId: "recPR1" }) }),
        false
    );
    check("nullish does not throw", awaitsCorrection(), false);
    // ANTI-VACUITY: the predicate must both admit and refuse within one corpus, or
    // it is either a constant or unreachable.
    const corpus = [
        { row: row() },
        { row: row(), overagePR: { status: "In Review" } },
        { row: row({ overDelivered: false }) },
    ];
    const admitted = corpus.filter((c) => awaitsCorrection(c)).length;
    assert(`admits ${admitted} of ${corpus.length} — neither all nor none`, admitted === 1);

    // --- #217: WHICH STAGE, AND THE COPY THAT NAMES IT --------------------
    log("");
    log("the stage a live correction has reached — a copy-only refinement:");
    check("no correction has no stage", overageStageKey(null), null);
    check("a draft", overageStageKey({ status: "Draft" }), OVERAGE_STAGE.draft);
    check("in review", overageStageKey({ status: "In Review" }), OVERAGE_STAGE.inReview);
    check("approved — the order exists", overageStageKey({ status: "Approved" }), OVERAGE_STAGE.generated);
    check("PO signed", overageStageKey({ status: "PO Signed" }), OVERAGE_STAGE.generated);
    check(
        "a withdrawn overage order is no correction, so no stage",
        overageStageKey({ status: "PO Signed" }, { status: "Withdrawn" }),
        null
    );
    // overagePRState answers `pending` for a status it does not know; of the two
    // pending voices this takes the one that tells the reader to wait.
    check("an unrecognized status reads as in review", overageStageKey({ status: "Something New" }), OVERAGE_STAGE.inReview);
    check("nullish does not throw", overageStageKey(), null);

    log("");
    log("the already-covered refusal names the stage, and arrives in linkable parts:");
    const raisedFacts = { overagePrId: "HYE-PR-260806-01" };
    const stageTexts = new Map();
    for (const stage of [...Object.values(OVERAGE_STAGE), undefined]) {
        const message = OVERAGE_COPY.preview.blocked[OVERAGE_BLOCKED.alreadyRaised]({
            ...raisedFacts,
            overageStage: stage,
        });
        const label = stage ?? "(no stage)";
        check(`${label}: the id is handed back for the link`, message.prId, raisedFacts.overagePrId);
        // The flattened sentence and the parts cannot drift, which is what lets the
        // Server Action keep returning a plain string while the page renders a link.
        check(`  text is prefix + prId + suffix`, message.text, message.prefix + message.prId + message.suffix);
        assert(`  and it names the excess it covers`, message.text.includes("covers this excess"));
        stageTexts.set(label, message.text);
    }
    assert(
        "the four sentences are four sentences",
        new Set(stageTexts.values()).size === 4
    );
    assert("draft says nobody has been asked yet", /draft/.test(stageTexts.get(OVERAGE_STAGE.draft)));
    assert("in review says it is with its signers", /signers/.test(stageTexts.get(OVERAGE_STAGE.inReview)));
    assert("generated says the order exists", /order has been generated/.test(stageTexts.get(OVERAGE_STAGE.generated)));
    // The stageless voice is #167's own sentence, kept for a caller that supplies
    // none: naming a stage we were not told would be worse than naming none.
    check("no stage falls back to the original sentence", stageTexts.get("(no stage)"), "HYE-PR-260806-01 already covers this excess.");
    // With no id there is nothing to link, and the page must not try.
    const anonymous = OVERAGE_COPY.preview.blocked[OVERAGE_BLOCKED.alreadyRaised]({});
    check("no id at all: nothing to link", anonymous.prId, null);
    assert("  and the sentence still reads", anonymous.text.startsWith("A request already covers"));
    // ONLY THAT ONE MESSAGE CARRIES AN ID, which is what makes the page's branch
    // exhaustive: a new message carrying `prId` would be linked without anyone
    // deciding it should be.
    const everyBlocked = Object.entries(OVERAGE_COPY.preview.blocked).map(([key, build]) => [
        key,
        build({ ...facts, overageStage: OVERAGE_STAGE.draft }),
    ]);
    for (const [key, message] of everyBlocked) {
        const shouldLink = key === OVERAGE_BLOCKED.alreadyRaised;
        check(`${key} ${shouldLink ? "carries" : "carries no"} prId`, Boolean(message.prId), shouldLink);
    }

    // --- #217: THE STRIP'S OWN COPY ---------------------------------------
    log("");
    log("the strip's heading, its one voice, and a chip per refusal:");
    check("one row", OVERAGE_COPY.strip.heading(1), "1 over-delivery has no correction");
    assert("more than one", OVERAGE_COPY.strip.heading(4).startsWith("4 over-deliveries"));
    // ONE VOICE, and the condition is narrower than #216 left it: the action is on
    // the row, and everyone who can see a row can take it, so there is nothing to
    // split over. Naming the control is therefore allowed here, where #216's copy
    // was barred from it.
    assert("the explanation names the ordering", /Longest wait first/.test(OVERAGE_COPY.strip.explain));
    assert("  and says a row can raise it here", /raises the correction here/.test(OVERAGE_COPY.strip.explain));
    assert("  while not promising every row can", /the rest say what has to come first/.test(OVERAGE_COPY.strip.explain));
    // #166 bars the word outright, and this sentence is inside that sweep — see the
    // copy for why it says what it says.
    assert("  and does not say `missing`", !/missing/i.test(OVERAGE_COPY.strip.explain));

    // EVERY REFUSAL THE STRIP CAN SHOW HAS A CHIP, AND THE TWO IT CANNOT DO NOT.
    // Asserted over the whole key set rather than a list written twice, so a refusal
    // added later fails here instead of rendering an empty cell.
    const EXCLUDED_BY_SELECTION = [OVERAGE_BLOCKED.notOverDelivered, OVERAGE_BLOCKED.alreadyRaised];
    for (const key of Object.values(OVERAGE_BLOCKED)) {
        const excluded = EXCLUDED_BY_SELECTION.includes(key);
        check(
            `${key} ${excluded ? "needs no chip" : "has a chip"}`,
            Object.prototype.hasOwnProperty.call(OVERAGE_COPY.strip.reason, key),
            !excluded
        );
    }
    const chips = Object.values(OVERAGE_COPY.strip.reason);
    assert(`${chips.length} chips, all distinct`, new Set(chips).size === chips.length);
    // A CHIP IS NOT A SENTENCE — #166's density rule, applied a second time. No
    // digit, because a figure changes per row and would break the closed set; and
    // short enough to sit at the end of a one-line row.
    for (const chip of chips) {
        assert(`"${chip}" carries no digit`, !/\d/.test(chip));
        assert(`  and is short enough for a row`, chip.length <= 32);
        assert(`  and ends without a full stop`, !chip.endsWith("."));
    }
    // ANTI-VACUITY for the loop above: the corpus it walks must be the real one.
    assert("the chips walked are the module's own", chips.length >= 5 && chips.includes("no invoice yet"));

    // --- #217: THE MARKER'S SENTENCE HAS ONE HOME -------------------------
    log("");
    log("the inferred marker's label, resolved in one place for two screens:");
    for (const key of Object.values(OVERAGE_INFERRED)) {
        check(`${key} resolves to its sentence`, inferredLabel({ inferred: key }), OVERAGE_COPY.preview.inferred[key]().text);
    }
    check("nothing inferred, no label", inferredLabel({ inferred: null }), null);
    check("an unknown key gets none either", inferredLabel({ inferred: "nope" }), null);
    check("nullish does not throw", inferredLabel(), null);

    // --- #217: THE CHAIN RULE, NOW PURE -----------------------------------
    log("");
    log("which signers a correction copies — one rule, two fetch shapes:");
    const signer = (seq, userId) => ({ id: `recS${seq}`, sequenceOrder: seq, signer: userId ? [userId] : [] });
    const active = new Set(["recU1", "recU2"]);
    // Fed in the order a batched read by record id returns — which is the ids' order,
    // not the chain's — so the rule has to sort.
    const scrambled = [signer(3, "recU2"), signer(1, "recU1"), signer(2, "recU9")];
    const picked = selectCopyableSigners(scrambled, active);
    check("ordered by Sequence Order", picked.keep.map((s) => s.sequenceOrder).join(","), "1,3");
    check("  the inactive signer is dropped", picked.droppedCount, 1);
    check("  and the original count is kept", picked.originalCount, 3);
    // A signer row with no user link is the same dead end as an inactive one.
    const unlinked = selectCopyableSigners([signer(1, null), signer(2, "recU1")], active);
    check("a signer with no user is dropped too", unlinked.keep.length, 1);
    check("  and counted as dropped", unlinked.droppedCount, 1);
    check("an array of ids works as well as a Set", selectCopyableSigners([signer(1, "recU1")], ["recU1"]).keep.length, 1);
    check("nobody active, nobody kept", selectCopyableSigners(scrambled, []).keep.length, 0);
    check("  which is the empty-chain state the preview warns about", selectCopyableSigners(scrambled, []).droppedCount, 3);
    check("nullish does not throw", selectCopyableSigners().originalCount, 0);
    // It must not mutate its input, since one caller passes rows it read for others.
    const asRead = [signer(2, "recU1"), signer(1, "recU1")];
    selectCopyableSigners(asRead, active);
    check("does not reorder its argument", asRead[0].sequenceOrder, 2);

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
    // #219 — the key decides WHICH sentence, and either way exactly one is added
    // right after the summary.
    for (const key of Object.values(OVERAGE_INFERRED)) {
        const inferredPreview = describeOveragePreview({ eligible: true, excess: 2, inferred: key }, facts);
        check(`${key} adds one, right after the summary`, inferredPreview[1].key, "preview-inferred");
        check(`  and only one`, inferredPreview.length, full.length + 1);
        assert(
            `  the sentence is the one for ${key}`,
            inferredPreview[1].text === OVERAGE_COPY.preview.inferred[key]().text
        );
    }
    // The same guarded lookup the blocked branch uses: a key nothing wrote renders
    // nothing rather than crashing a screen.
    check(
        "an unrecognized inference renders nothing",
        describeOveragePreview({ eligible: true, excess: 2, inferred: "nope" }, facts).length,
        full.length
    );
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
        // Both tiers' sentences (#219), so neither can drift out of the vocabulary.
        ...Object.values(OVERAGE_COPY.preview.inferred).map((f) => f().text),
        OVERAGE_COPY.preview.signersDropped(2).text,
        OVERAGE_COPY.preview.signersEmpty().text,
        OVERAGE_COPY.preview.draft().text,
        ...["overagePR", "overagePO", "originalPO"].map((s) => OVERAGE_COPY.banner[s](facts).text),
        OVERAGE_COPY.banner.pending(facts).text,
        OVERAGE_COPY.banner.invoiceCaveat(facts).text,
        OVERAGE_COPY.banner.notApplied(facts).text,
        // #217's strip — the heading, the one voice, and every chip, so a shorter
        // density cannot become a shortcut past the vocabulary.
        OVERAGE_COPY.strip.heading(1),
        OVERAGE_COPY.strip.heading(3),
        OVERAGE_COPY.strip.explain,
        ...Object.values(OVERAGE_COPY.strip.reason),
        // And every stage of the already-covered refusal, which the blocked sweep
        // above only reaches with whatever stage `facts` happens to carry.
        ...Object.values(OVERAGE_STAGE).map(
            (stage) =>
                OVERAGE_COPY.preview.blocked[OVERAGE_BLOCKED.alreadyRaised]({ ...facts, overageStage: stage })
                    .text
        ),
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
