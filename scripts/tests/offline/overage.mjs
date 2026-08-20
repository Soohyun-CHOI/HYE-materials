// Raising an overage PR from an over-delivery (#167, #219, #265) — the pure judgment.
//
// Five things this pins that nothing else can:
//   - THE AGREEMENT RULE (#265): a correction is earned by the two documents meeting
//     above the order, and `Over Delivered` alone does not earn it. THIS IS THE
//     SILENT MUTANT — dropping the comparison restores exactly what #167 shipped, the
//     button opens, no figure on any screen moves, and the order that goes to the
//     vendor asks for material the vendor never charged for. Asserted FIRST.
//   - THAT THE COMPARISON IS THE ORDERED ITEM'S TOTALS, not one delivery's and not one
//     invoice's, which is the decision the whole rule rests on.
//   - WHICH INVOICE SUPPLIES THE QUOTATION: it must cover the excess on its own, the
//     candidates must agree on price, and the pairing is a preference among equals
//     rather than #219's tier.
//   - THAT THE ORDERING IS THIS MODULE'S AND PRIVATE, on the AST: it moved out of
//     lib/deliveryStatus.js with #219, and a second sort by Issue Date anywhere
//     would answer the same question differently with nothing behavioral noticing.
//   - THAT THE BANNER IS DERIVED, from the linked PR's status and the row's flag,
//     so a withdrawal reopens the row with no write anywhere.
//
// What a pass does NOT prove: that the invoices handed in were really every invoice on the
// ordered item, that the two rollups are what Airtable holds, or that the flag and
// the attachment moved in one write. Those are lib/overagePR.js's and Airtable's
// properties and live in scripts/tests/verify-overage-167.mjs.

import {
    DISAGREEMENT,
    OVERAGE_AGREEMENT,
    OVERAGE_BLOCKED,
    OVERAGE_COPY,
    OVERAGE_STAGE,
    attachedDeliveryRecordId,
    attachedPOItemRecordId,
    awaitsCorrection,
    describeOverageBanner,
    describeOveragePreview,
    disagreementDirection,
    foldByInvoice,
    isNoLongerOverDelivered,
    isOverageApplied,
    overageAgreement,
    overageBannerState,
    overageEligibility,
    overagePRState,
    overageStageKey,
    resolveOriginalPOItem,
    selectCopyableSigners,
    selectOverageInvoice,
    tieBreakLabel,
} from "../../../lib/overage.js";
// The namespace too, so "the ordering is private" is a claim about the export list
// rather than about a name this file chose not to import (#219).
import * as overage from "../../../lib/overage.js";
import { recomputeOverDelivery } from "../../../lib/deliveryAllocation.js";
import { STATUS_COPY } from "../../../lib/deliveryStatus.js";
import { callPassesProperty, callsTo, parseFile, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Overage correction — the agreement rule, the quotation, the banner (#167, #265)";

/** The delivery the excess delivered against, and one it did not. */
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
    // #219 — the row's own delivery, which is the pairing preference since #265.
    delivery: [DELIVERY],
    overagePRRecordId: null,
    formerPOItemRecordId: null,
    ...over,
});

/**
 * An invoice NAMING THIS DELIVERY, which #265 leaves as a preference among candidates
 * that already agree on price — so every clause that is not about the preference reads
 * without a pairing spelled out in it.
 */
const invoice = (id, qty, issueDate, over = {}) => ({
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

/** The same invoice naming NO delivery — #210's ordinary state. */
const unpairedInvoice = (id, qty, issueDate, over = {}) =>
    invoice(id, qty, issueDate, { deliveryRecordId: null, ...over });

/** And one naming a DIFFERENT delivery. */
const otherDeliveryInvoice = (id, qty, issueDate, over = {}) =>
    invoice(id, qty, issueDate, { deliveryRecordId: OTHER_DELIVERY, ...over });

/** selectOverageInvoice for this row's delivery unless told otherwise. */
const pick = (invoices, excess, deliveryRecordId = DELIVERY) =>
    selectOverageInvoice({ invoices, excess, deliveryRecordId });

/**
 * The ordered item's three totals, AGREEING by default, so a clause that is not about
 * the agreement does not have to restate it. `ordered` 10 with 12 delivered and 12
 * billed is the paradigm correctable shape — the vendor shipped a pack of two extra
 * and charged for them.
 */
const totals = (over = {}) => ({ orderedQty: 10, deliveredQty: 12, invoicedQty: 12, ...over });

/** Eligibility with the ordered item's totals supplied, which every real caller does. */
const eligible = (invoices, over = {}) =>
    overageEligibility({ row: row(), invoices, orderedItem: totals(), ...over });

export function run({ check, log, assert }) {
    // --- #265: THE AGREEMENT RULE — THE SILENT MUTANT ---------------------
    //
    // ASSERTED FIRST BECAUSE IT IS THE ONE NOTHING ELSE NOTICES. Delete the comparison
    // and eligibility falls back to what #167 shipped: the flag alone opens the
    // correction, the preview still names an invoice and a price, no figure on any
    // screen changes, and the purchase order that leaves the company asks the vendor
    // for material the vendor never charged for. `HYE-DL-260819-11` on the demo base
    // is that exact shape — 19 delivered, 4 billed.
    log("#265 — a correction is earned by the two documents agreeing, not by the flag:");
    const short = eligible([invoice("01", 4, "2026-07-01")], {
        orderedItem: totals({ deliveredQty: 19, invoicedQty: 4 }),
        row: row({ qty: 9 }),
    });
    check("billed short of the delivery — not eligible", short.eligible, false);
    check("  and refused as a disagreement", short.blocked, OVERAGE_BLOCKED.documentsDisagree);
    check("  naming which way it runs", short.disagreement, DISAGREEMENT.billedShort);

    // THE OTHER DIRECTION IS THE HALF A ONE-SIDED TEST WOULD MISS, and it is on the
    // base too: `HYE-DL-260819-10`, 13 delivered against 26 billed.
    const over = eligible([invoice("01", 13, "2026-07-01"), invoice("02", 13, "2026-07-02")], {
        orderedItem: totals({ deliveredQty: 13, invoicedQty: 26 }),
        row: row({ qty: 3 }),
    });
    check("billed beyond the delivery — also not eligible", over.eligible, false);
    check("  same key", over.blocked, OVERAGE_BLOCKED.documentsDisagree);
    check("  opposite voice", over.disagreement, DISAGREEMENT.billedOver);

    // ANTI-VACUITY, and it is what makes the two above mean something: the agreeing
    // shape IS eligible. Without this a gate refusing everything would pass them.
    check("the two agreeing above the order is eligible", eligible([invoice("01", 12, "2026-07-01")]).eligible, true);

    // A CALLER THAT OMITS THE TOTALS FAILS CLOSED, on the same reasoning: 0 delivered
    // against something billed is a disagreement, so a forgotten argument refuses
    // rather than reverting to the flag-only rule the mutant restores.
    check(
        "no totals at all refuses rather than passing",
        overageEligibility({ row: row(), invoices: [invoice("01", 12, "2026-07-01")] }).blocked,
        OVERAGE_BLOCKED.documentsDisagree
    );

    // --- #265: THE THREE STATES, DIRECTLY ---------------------------------
    log("");
    log("  the three answers, from the ordered item's totals alone:");
    check("the totals meet", overageAgreement({ deliveredQty: 12, invoicedQty: 12, hasInvoice: true }), OVERAGE_AGREEMENT.agreed);
    check("they do not", overageAgreement({ deliveredQty: 12, invoicedQty: 10, hasInvoice: true }), OVERAGE_AGREEMENT.disagree);
    check("nothing bills it", overageAgreement({ deliveredQty: 12, invoicedQty: 0, hasInvoice: false }), OVERAGE_AGREEMENT.noInvoice);
    // `hasInvoice` IS NOT `invoicedQty > 0`, and that is the trap the flag exists for:
    // an invoice item of zero is a document that says nothing was billed, which is a
    // disagreement, while NO document is a question nobody has answered yet.
    check(
        "an invoice billing zero is a disagreement, not an absence",
        overageAgreement({ deliveredQty: 12, invoicedQty: 0, hasInvoice: true }),
        OVERAGE_AGREEMENT.disagree
    );
    check("nullish reads as nothing billed", overageAgreement(), OVERAGE_AGREEMENT.noInvoice);
    check("the direction is null on agreement", disagreementDirection({ deliveredQty: 5, invoicedQty: 5 }), null);
    check("  nullish does not throw", disagreementDirection(), null);

    // --- #265: THE SCOPE IS THE ORDERED ITEM'S TOTALS ---------------------
    //
    // THE DECISION THE WHOLE RULE RESTS ON, so it is asserted as a behavior rather
    // than left to the paragraph that argues it. Two invoices summing to what was
    // delivered AGREE: the vendor charged for everything it sent, across two
    // documents. A rule reading one invoice at a time would call this a disagreement
    // and refuse a correction that is owed.
    log("");
    log("  two invoices summing to the delivery agree — the totals are the ordered item's:");
    const acrossTwo = eligible([invoice("01", 8, "2026-07-01"), invoice("02", 4, "2026-07-02")]);
    check("eligible", acrossTwo.eligible, true);
    check("  and the figures it reports are the totals", acrossTwo.figures.invoicedQty, 12);
    // The mirror: one invoice of 8 against 12 delivered is a real disagreement, so the
    // check above cannot be passing by ignoring quantities altogether.
    check(
        "one invoice short of the delivery still disagrees",
        eligible([invoice("01", 8, "2026-07-01")], {
            orderedItem: totals({ invoicedQty: 8 }),
        }).blocked,
        OVERAGE_BLOCKED.documentsDisagree
    );

    // --- eligibility, clause by clause ------------------------------------
    log("");
    log("eligibility, in order, because the order is what stops a misleading reason:");
    check(
        "a row that was not over-delivered",
        overageEligibility({ row: row({ overDelivered: false }), invoices: [] }).blocked,
        OVERAGE_BLOCKED.notOverDelivered
    );
    check(
        "a row naming no ordered item",
        overageEligibility({ row: row({ poItem: [] }), invoices: [] }).blocked,
        OVERAGE_BLOCKED.noOrderedItem
    );
    check(
        "nothing bills the ordered item yet",
        eligible([]).blocked,
        OVERAGE_BLOCKED.noInvoice
    );
    check(
        "the invoice has no file to quote from",
        eligible([invoice("01", 12, "2026-07-01", { hasFile: false })]).blocked,
        OVERAGE_BLOCKED.noInvoiceFile
    );
    check("everything present", eligible([invoice("01", 12, "2026-07-01")]).eligible, true);
    check("nullish does not throw", overageEligibility().blocked, OVERAGE_BLOCKED.notOverDelivered);

    // THE AGREEMENT COMES BEFORE ANYTHING ABOUT THE QUOTATION, on `alreadyRaised`'s own
    // ordering rule: with the documents apart there is no correction to raise, so
    // naming a missing file would send a reader to fix what is not in the way.
    check(
        "a disagreement wins over the missing file",
        eligible([invoice("01", 4, "2026-07-01", { hasFile: false })], {
            orderedItem: totals({ deliveredQty: 19, invoicedQty: 4 }),
        }).blocked,
        OVERAGE_BLOCKED.documentsDisagree
    );

    // --- the excess needs no arithmetic ----------------------------------
    log("");
    log("the excess is the row's own Qty — #162 made the over-delivery its own row:");
    check(
        "so eligibility reports it without subtracting anything",
        eligible([invoice("01", 12, "2026-07-01")], { row: row({ qty: 3 }) }).excess,
        3
    );
    // AND IT IS NOT THE ORDERED ITEM'S TOTAL BEYOND THE ORDER, which is 2 here. The
    // two part company when two deliveries each exceeded the same ordered item, and
    // the correction covers the row the button was pressed on.
    check(
        "  even where the ordered item's own excess differs",
        eligible([invoice("01", 12, "2026-07-01")], { row: row({ qty: 3 }) }).figures.deliveredQty -
            eligible([invoice("01", 12, "2026-07-01")], { row: row({ qty: 3 }) }).figures.orderedQty,
        2
    );

    // ALREADY RAISED is tested before anything about the invoice, so a row someone
    // is already correcting is never reported as blocked for a reason a reader
    // would then try to fix — getPOWithdrawEligibility's own ordering argument.
    log("");
    log("a live correction blocks BEFORE any invoice reason, deliberately:");
    const withNoInvoice = { row: row({ overagePRRecordId: "recPR1" }), invoices: [] };
    check(
        "already raised wins over no-invoice",
        overageEligibility({ ...withNoInvoice, overagePR: { status: "In Review", prId: "HYE-PR-1" } }).blocked,
        OVERAGE_BLOCKED.alreadyRaised
    );

    // --- #265: WHICH INVOICE SUPPLIES THE QUOTATION -----------------------
    //
    // #219's THREE TIERS ARE GONE AND THIS IS WHAT REPLACED THEM. They existed to pick
    // a document when the app could not tell whether the excess was billed at all; the
    // agreement rule answers that first, so what is left is narrower — a candidate has
    // to cover the excess on its own, they have to agree on price, and the pairing is a
    // preference among equals.
    log("");
    log("#265 — the quotation comes from an invoice covering the excess on its own:");
    check(
        "one invoice large enough is chosen",
        pick([invoice("01", 12, "2026-07-01")], 3).invoice.invoiceId,
        "HYE-INV-260701"
    );
    check("  with nothing passed over", pick([invoice("01", 12, "2026-07-01")], 3).tieBreak, null);
    // A REQUEST TAKES ONE QUOTATION (#167), so no candidate covering the excess is a
    // refusal rather than a sum of several. This is the shape on the demo base:
    // `HYE-DL-260819-07`, excess 20 against invoices of 15 and 15.
    const spans = pick([invoice("01", 15, "2026-07-01"), invoice("02", 15, "2026-07-02")], 20);
    check("no single invoice covers it", spans.blocked, OVERAGE_BLOCKED.spansInvoices);
    check("  and no invoice is handed back", spans.invoice, null);
    // ANTI-VACUITY for the clause above: the same two invoices DO answer a smaller
    // excess, so the refusal is about the quantity rather than about the count.
    check(
        "  the same pair answers an excess either covers",
        Boolean(pick([invoice("01", 15, "2026-07-01"), invoice("02", 15, "2026-07-02")], 5).invoice),
        true
    );
    // `excessExceedsInvoice` IS GONE AND CANNOT COME BACK, because every invoice is
    // asked rather than only the oldest: a single invoice reaching here on an agreeing
    // ordered item bills the whole delivered quantity, which is at least the excess.
    assert("the retired single-candidate refusal is not a key", !("excessExceedsInvoice" in OVERAGE_BLOCKED));
    assert(
        "nor the two the tiers needed",
        !("otherDeliveryOnly" in OVERAGE_BLOCKED) && !("severalUnpairedInvoices" in OVERAGE_BLOCKED)
    );
    assert("and the inference constant is gone entirely", !("OVERAGE_INFERRED" in overage));
    assert("  with the function that read it", !("inferredLabel" in overage));

    log("");
    log("  candidates disagreeing on price are REFUSED, never chosen between:");
    const dearer = [invoice("01", 12, "2026-07-01"), invoice("02", 12, "2026-07-02", { unitPrice: 19 })];
    check("blocked", pick(dearer, 3).blocked, OVERAGE_BLOCKED.severalPricesDiffer);
    check("  and no invoice is handed back", pick(dearer, 3).invoice, null);
    // A PRICE OF NULL IS NOT A PRICE, and it makes the set DIFFER rather than agree —
    // failing closed, since a quotation taken at an unknown price is the one outcome
    // that must not happen quietly.
    check(
        "an unknown price fails closed",
        pick([invoice("01", 12, "2026-07-01"), invoice("02", 12, "2026-07-02", { unitPrice: null })], 3).blocked,
        OVERAGE_BLOCKED.severalPricesDiffer
    );
    // AND IT ONLY LOOKS AT CANDIDATES. An invoice too small to cover the excess cannot
    // supply the quotation, so its price is not a disagreement about anything.
    check(
        "a price on an invoice too small to quote from is not consulted",
        pick([invoice("01", 12, "2026-07-01"), invoice("02", 1, "2026-07-02", { unitPrice: 19 })], 3).invoice.invoiceId,
        "HYE-INV-260701"
    );

    log("");
    log("  the pairing is a PREFERENCE among equals, not a tier:");
    // #219's OWN DEFECT, WHICH IS WHY THE PAIRING SURVIVES AT ALL: an ordered item
    // filled by two deliveries and billed by two invoices, each large enough to cover
    // the excess and both at the agreed price. The excess belongs to the delivery whose
    // row carries the flag, and the stored pairing is the only thing that says which
    // invoice describes it — so the older invoice must NOT win on age alone.
    const twoDeliveries = [
        otherDeliveryInvoice("01", 12, "2026-07-01"),
        invoice("02", 12, "2026-07-02"),
    ];
    check("the one naming this delivery is preferred", pick(twoDeliveries, 3).invoice.invoiceId, "HYE-INV-260702");
    // AND IT IS NOT A TIER: an invoice naming ANOTHER delivery is still a candidate,
    // which is exactly what #219 refused. It has to be, because it counts toward
    // `Invoiced Qty` and therefore toward the agreement that got this far.
    check(
        "one naming another delivery is still chosen when it is the only candidate",
        pick([otherDeliveryInvoice("01", 12, "2026-07-01")], 3).invoice.invoiceId,
        "HYE-INV-260701"
    );
    check(
        "  as is one naming none",
        pick([unpairedInvoice("01", 12, "2026-07-01")], 3).invoice.invoiceId,
        "HYE-INV-260701"
    );
    // With nothing recorded the ordering decides and that is NOT a refusal, because by
    // then the figures are equal either way.
    const bothUnpaired = [unpairedInvoice("01", 12, "2026-07-01"), unpairedInvoice("02", 12, "2026-07-02")];
    check("two unpaired equals: the oldest, and not a refusal", pick(bothUnpaired, 3).invoice.invoiceId, "HYE-INV-260701");
    check("  reported as a tie-break", pick(bothUnpaired, 3).tieBreak.chosen, "HYE-INV-260701");
    check("  naming what it was chosen over", pick(bothUnpaired, 3).tieBreak.passedOver.join(","), "HYE-INV-260702");
    // An undated invoice does not claim to be the oldest — sortCandidates' own call.
    check(
        "an undated invoice sorts last",
        pick([unpairedInvoice("01", 12, null), unpairedInvoice("02", 12, "2026-07-02")], 3).invoice.invoiceId,
        "HYE-INV-260702"
    );

    log("");
    log("  and the candidates are folded to one entry per INVOICE, not per invoice item:");
    // THE MISCOUNT #219 COULD AFFORD AND #265 CANNOT. That issue only COUNTED entries,
    // so an invoice split across two rows on one ordered item changed no figure; here a
    // candidate has to cover the excess, and two half-entries would each look too small.
    const splitInvoice = [
        { ...invoice("01", 7, "2026-07-01"), invoiceItemRecordId: "recIIa" },
        { ...invoice("01", 5, "2026-07-01"), invoiceItemRecordId: "recIIb" },
    ];
    check("one invoice in two rows folds to one candidate", foldByInvoice(splitInvoice).length, 1);
    check("  carrying the summed charge", foldByInvoice(splitInvoice)[0].qty, 12);
    check("  and the lowest invoice item id as its row", foldByInvoice(splitInvoice)[0].invoiceItemRecordId, "recIIa");
    check("so it covers an excess neither row would", Boolean(pick(splitInvoice, 10).invoice), true);
    check("  and passes nothing over", pick(splitInvoice, 10).tieBreak, null);
    // ANTI-VACUITY: two DIFFERENT invoices of the same quantities do not fold.
    check(
        "two invoices are still two candidates",
        foldByInvoice([invoice("01", 7, "2026-07-01"), invoice("02", 5, "2026-07-02")]).length,
        2
    );
    check("  and a row with no invoice is dropped", foldByInvoice([{ qty: 5 }]).length, 0);
    check("  nullish does not throw", foldByInvoice().length, 0);

    log("");
    log("  nothing bills the ordered item at all:");
    check("no invoice", pick([], 3).blocked, OVERAGE_BLOCKED.noInvoice);
    check("nullish does not throw", selectOverageInvoice().blocked, OVERAGE_BLOCKED.noInvoice);

    // --- #265: THE FLAG ALREADY MEANS THE ORDER IS EXCEEDED ---------------
    //
    // WHY THERE IS NO FOURTH STATE, pinned as a property of the writer rather than
    // trusted from a paragraph. `overageAgreement` takes `orderedQty` and never
    // compares it, on the premise that a flagged row implies the ordered item is over —
    // `recomputeOverDelivery` flags a row only where `room === 0`, and deletion is the
    // only thing that mutates rows after creation. If that ever stopped holding, this
    // is the assertion that would say so.
    log("");
    log("#265 — a flagged row always implies the ordered item is over (recomputeOverDelivery):");
    const shapes = [
        { orderedQty: 10, rows: [{ id: "a", deliveryItemId: "d-001", qty: 10 }, { id: "b", deliveryItemId: "d-002", qty: 3 }] },
        { orderedQty: 10, rows: [{ id: "a", deliveryItemId: "d-001", qty: 4 }] },
        { orderedQty: 0, rows: [{ id: "a", deliveryItemId: "d-001", qty: 5 }] },
        { orderedQty: 10, rows: [{ id: "a", deliveryItemId: "d-001", qty: 25 }] },
    ];
    let flaggedSeen = 0;
    let violations = 0;
    for (const shape of shapes) {
        const out = recomputeOverDelivery(shape);
        const delivered =
            out.rows.reduce((t, r) => t + (r.qty || 0), 0) +
            out.splits.reduce((t, s) => t + (s.qty || 0), 0);
        // A split row is the excess minted as its own record, flagged when it is
        // written — the same implication, on the row the recomputation creates.
        const flagged = out.rows.filter((r) => r.overDelivered).length + out.splits.length;
        flaggedSeen += flagged;
        if (flagged > 0 && delivered <= (shape.orderedQty || 0)) violations++;
    }
    check("no flagged row on an ordered item that is not over", violations, 0);
    // ANTI-VACUITY: the loop has to have SEEN flagged rows, or "none violated" is the
    // same result as "the traversal found nothing".
    assert(`the sweep saw ${flaggedSeen} flagged rows`, flaggedSeen >= 3);

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
    const invoiceSorts = [];
    walk(ast, (node) => {
        if (node.type !== "CallExpression") return;
        const callee = node.callee;
        if (callee?.type !== "MemberExpression" || callee.property?.name !== "sort") return;
        if (JSON.stringify(node.arguments).includes("issueDate")) invoiceSorts.push(node);
    });
    check("one Issue Date sort, and it lives here now", invoiceSorts.length, 1);
    assert("  and it tie-breaks on Invoice ID", JSON.stringify(invoiceSorts[0].arguments).includes("invoiceId"));
    // ONE TIER ORDERS, THE OTHER REFUSES — asserted as a call count, because the
    // behavioral difference is invisible at one candidate and this is the shape a
    // later edit would undo by "tidying" the fallback tier into symmetry with the
    // paired one.
    check("the ordering is called from exactly one tier", callsTo(ast, "sortInvoicesOldestFirst").length, 1);

    // THE CALLER OBLIGATION, PINNED. selectOverageInvoice falls to the fallback tier
    // when it is not told which delivery — the honest answer for a row that names
    // none, and the wrong one for a caller that forgot. Every call site in the
    // credentialed module passes it, including the APPLY step, which has to split the
    // same invoice the preview quoted.
    log("");
    log("every selectOverageInvoice call site names a delivery (AST):");
    const { ast: prAst } = parseFile("lib/overagePR.js");
    // BOTH NAMES, BECAUSE THE APPLY PATH HAS A HOP. `applyOverageToPO` hands the
    // delivery to `splitInvoiceItemForOverage`, which passes it on as a shorthand
    // property — so asserting only the inner call would have been satisfied by a
    // shorthand whose value the outer call had stopped supplying. Measured: dropping
    // it from the outer call passed a check that only looked at the inner one.
    const callSites = ["selectOverageInvoice", "splitInvoiceItemForOverage"].flatMap((name) =>
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
        callSites.some((c) => c.name === "selectOverageInvoice") &&
            callSites.some((c) => c.name === "splitInvoiceItemForOverage")
    );

    // #265 — AND THE ELIGIBILITY CALL NAMES THE ORDERED ITEM'S TOTALS. This is the one
    // mutation the behavioral checks above cannot see: `overageEligibility` fails
    // closed on a missing argument, so a caller that stops supplying the figures
    // refuses every row rather than opening one — safe, but wrong, and invisible to a
    // pure check because the omission is in the credentialed module. #219's own pin was
    // widened for exactly this reason once before, when a call site one hop away
    // slipped past a matcher looking at a single function name.
    log("");
    log("#265 — the eligibility call supplies the ordered item's totals (AST):");
    const eligibilityCalls = callsTo(prAst, "overageEligibility");
    check("one call site, and it is this module's", eligibilityCalls.length, 1);
    for (const key of ["orderedItem", "orderedQty", "deliveredQty", "invoicedQty"]) {
        assert(`  it passes ${key}`, callPassesProperty(eligibilityCalls[0], key));
    }
    // ANTI-VACUITY, the same shape as above: the matcher has to say no to something.
    assert(
        "  and the matcher is not answering true for anything",
        !callPassesProperty(eligibilityCalls[0], "overDeliveredQty")
    );
    // THE TWO ROLLUPS COME OFF THE PROJECTION THAT READS THEM, so the figures are the
    // base's sums rather than anything recomputed here.
    const reconciliationFields = new Set();
    const { ast: poItemsAst } = parseFile("lib/airtable/poItems.js");
    walk(poItemsAst, (node) => {
        if (node.type !== "Property" || node.key?.name === undefined) return;
        if (node.value?.type === "CallExpression" && node.value.callee?.property?.name === "get") {
            reconciliationFields.add(node.value.arguments?.[0]?.value);
        }
    });
    assert("`Delivered Qty` is read from PO Items", reconciliationFields.has("Delivered Qty"));
    assert("  as is `Invoiced Qty`", reconciliationFields.has("Invoiced Qty"));
    assert("  and `Unit Price`, for the price the candidates are compared on", reconciliationFields.has("Unit Price"));
    // ANTI-VACUITY: the walk has to be seen missing a field that is not there.
    assert("  and the walk is not answering true for anything", !reconciliationFields.has("Agreed Qty"));
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
    check("and the judgment from this one", prImports.get("selectOverageInvoice"), "./overage");
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
        eligible([invoice("01", 12, "2026-07-01")], {
            row: row({ overagePRRecordId: "recPR1" }),
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
        // office, since the invoice a correction spans is invoice-derived while the
        // banner itself is not; `invoiceCaveat` interpolated `f.invoiceId` with no
        // fallback, so it opened with the literal word.
        for (const state of ["applied", "pending", "not-applied"]) {
            const withoutInvoice = describeOverageBanner({
                site,
                state,
                facts: { ...facts, invoiceId: null },
            });
            assert(
                `${site}/${state}: says no "null" when no invoice is known`,
                !withoutInvoice.some((m) => /\bnull\b/.test(m.text))
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
    //
    // #265 CHANGED WHAT THE MARKER IS ABOUT AND KEPT ITS ONE HOME. It stood for an
    // inference and now stands for a tie-break, so the assertion is that the two
    // screens still get their sentence from one function rather than each writing
    // its own — the property #217 added it for.
    log("");
    log("the tie-break marker's label, resolved in one place for two screens:");
    const tied = { chosen: "HYE-INV-260701", passedOver: ["HYE-INV-260702"] };
    check(
        "it is the preview's own sentence",
        tieBreakLabel({ tieBreak: tied }),
        OVERAGE_COPY.preview.tieBreak(tied).text
    );
    assert("  naming both invoices", tieBreakLabel({ tieBreak: tied }).includes("HYE-INV-260702"));
    assert(
        "  and saying the choice changes no figure",
        /changes no figure/.test(tieBreakLabel({ tieBreak: tied }))
    );
    // AND IT NO LONGER SAYS THE APP GUESSED, which is the whole of what #265 changed
    // about it: the word would be false now that a correction is offered only where
    // the excess is billed.
    assert("  and never claims an inference", !/[Ii]nferred/.test(tieBreakLabel({ tieBreak: tied })));
    check("nothing passed over, no label", tieBreakLabel({ tieBreak: null }), null);
    check("nullish does not throw", tieBreakLabel(), null);

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
    const figures = { orderedQty: 10, deliveredQty: 12, invoicedQty: 12 };
    // #265 — A BLOCKED ROW GETS TWO, AND THE SECOND IS WHY. The refusal comes from the
    // ORDERED ITEM's totals while the reader is looking at one delivery, so the reason
    // alone would sit beside figures that do not add up to it.
    const blockedMessages = describeOveragePreview(
        { eligible: false, blocked: OVERAGE_BLOCKED.noInvoice, figures },
        facts
    );
    check("blocked: the reason, then what was compared", blockedMessages.map((m) => m.key).join(","),
        `${OVERAGE_BLOCKED.noInvoice},preview-compared`);
    assert("  and the comparison names all three totals",
        /10 EA ordered/.test(blockedMessages[1].text) &&
            /12 EA delivered/.test(blockedMessages[1].text) &&
            /12 EA billed/.test(blockedMessages[1].text));
    assert("  and the order they belong to", blockedMessages[1].text.includes(facts.originalPoId));
    // THE TWO THAT NEVER REACH THE TOTALS GET NO COMPARISON LINE, because naming
    // figures there would claim a measurement that was not taken.
    for (const key of [OVERAGE_BLOCKED.notOverDelivered, OVERAGE_BLOCKED.noOrderedItem]) {
        check(`${key} says nothing about figures`, describeOveragePreview({ eligible: false, blocked: key }, facts).length, 1);
    }
    // NOR DOES `alreadyRaised`: the excess is somebody's already, so what was compared
    // is not the question its reader has.
    check(
        "already-raised keeps its one message",
        describeOveragePreview({ eligible: false, blocked: OVERAGE_BLOCKED.alreadyRaised, figures }, facts).length,
        1
    );
    const full = describeOveragePreview({ eligible: true, excess: 2, figures }, facts);
    check("eligible: summary, what was compared, then the draft note",
        full.map((m) => m.key).join(","), "preview-summary,preview-compared,preview-draft");
    // #265 — the tie-break rides along rather than replacing anything, which is what
    // makes it a qualifier: the summary and the comparison still say what they said.
    const tiedPreview = describeOveragePreview(
        { eligible: true, excess: 2, figures, tieBreak: { chosen: "HYE-INV-A", passedOver: ["HYE-INV-B"] } },
        facts
    );
    check("a tie-break adds one, after the comparison", tiedPreview[2].key, "preview-tie-break");
    check("  and only one", tiedPreview.length, full.length + 1);
    assert("  naming both invoices", tiedPreview[2].text.includes("HYE-INV-A") && tiedPreview[2].text.includes("HYE-INV-B"));
    const dropped = describeOveragePreview(
        { eligible: true, excess: 2, figures },
        { ...facts, signersDropped: 2 }
    );
    check("dropped signers are reported", dropped[2].key, "preview-signers-dropped");
    assert("with the count", dropped[2].text.includes("2 signers"));
    const empty = describeOveragePreview(
        { eligible: true, excess: 2, figures },
        { ...facts, signersDropped: 3, signersEmpty: true }
    );
    check("an empty chain replaces the count rather than adding to it", empty[2].key, "preview-signers-empty");
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
        // #265's two additions: what was compared, and the tie-break that replaced
        // #219's two inference voices — neither can drift out of the vocabulary.
        OVERAGE_COPY.preview.compared({ ...facts, orderedQty: 10, deliveredQty: 12, invoicedQty: 12 }).text,
        OVERAGE_COPY.preview.tieBreak({ chosen: "HYE-INV-A", passedOver: ["HYE-INV-B"] }).text,
        // Both voices of the disagreement, which one builder produces from a key.
        ...[DISAGREEMENT.billedShort, DISAGREEMENT.billedOver, undefined].map(
            (d) => OVERAGE_COPY.preview.blocked[OVERAGE_BLOCKED.documentsDisagree]({ ...facts, disagreement: d }).text
        ),
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
