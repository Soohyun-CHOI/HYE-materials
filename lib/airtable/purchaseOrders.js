import { base, TABLES, findByRecordIds } from "./client";
import { formulaString } from "../airtableFormula";
import { generateNextPOId } from "../ids";

/**
 * The terminal "requester decided not to order after all" Status option
 * (issue #138). Lives here rather than in lib/poWithdraw.js because it's
 * this table's own vocabulary — the filterByFormula strings below and the
 * write in poWithdraw.js both need it, and defining it here keeps the
 * dependency one-way (poWithdraw -> purchaseOrders) instead of circular.
 * The Airtable select option itself is added by hand outside the repo.
 */
export const PO_WITHDRAWN_STATUS = "Withdrawn";

/**
 * Find a PO by its backend-generated PO ID.
 * Returns null if not found.
 */
export async function getPOById(poId) {
    const records = await base(TABLES.PURCHASE_ORDERS)
        .select({
            filterByFormula: `{PO ID} = "${formulaString(poId)}"`,
            maxRecords: 1,
        })
        .firstPage();

    if (records.length === 0) return null;
    return recordToPO(records[0]);
}

/**
 * Many POs by record id, batched (#19). The material-axis screens need each
 * source PO's `PO ID` (to show and link) and its `PR` link (to judge whether the
 * viewer may see identifiers at all), for every row on the page at once — so one
 * `.find()` per row is exactly what #143 ruled out.
 */
export async function getPOsByRecordIds(recordIds) {
    return (await findByRecordIds(TABLES.PURCHASE_ORDERS, recordIds)).map(recordToPO);
}

/**
 * Find a PO by its Airtable record ID.
 * Returns null if not found.
 */
export async function getPOByRecordId(recordId) {
    const record = await base(TABLES.PURCHASE_ORDERS).find(recordId);
    if (!record) return null;
    return recordToPO(record);
}

function recordToPO(record) {
    return {
        id: record.id,
        poId: record.get("PO ID"),
        pr: record.get("PR"),
        vendor: record.get("Vendor"), // Lookup via PR — read-only
        quotationFile: record.get("Quotation File"), // Lookup — read-only
        ourPic: record.get("Our PIC"),
        ourManager: record.get("Our Manager"),
        createdDate: record.get("Created Date"),
        presidentSigned: record.get("President Signed") || false,
        presidentSignedAt: record.get("President Signed At"),
        status: record.get("Status"),
        // Issue #138 — stamped in the same write as Status -> Withdrawn
        // (lib/poWithdraw.js), never cleared. Blank on every PO that was
        // never withdrawn. UTC ISO instant, *At convention, mirroring
        // Purchase Requests."Withdrawn At" (#122).
        withdrawnAt: record.get("Withdrawn At"),
        poPdfFile: record.get("PO PDF File"),
        // Issue #138 — reverse-links read by the withdraw eligibility
        // predicate ("does this PO have an invoice against it"). Core link
        // data, no propagation lag (see client.js:getLinkedRecords), so
        // exposing them here costs no extra fetch and needs no rollup.
        // Invoice-PO Link holds one join row per invoice; Invoice Items is
        // the per-line reverse-link, used only as a safety net.
        invoicePoLinks: record.get("Invoice-PO Link") || [],
        invoiceItems: record.get("Invoice Items") || [],
        // Issue #19 — the line-item reverse-link, same category as the two
        // above: core link data with no propagation lag, so exposing it costs
        // nothing. It lets the material-axis screens fetch exactly the ordered items of
        // the POs they already have, instead of every ordered item a material ever had.
        poItems: record.get("PO Items") || [],
        // Issue #244 — how many of this order's ordered items still have
        // something left to invoice, from the rollup of the same name. Read
        // through lib/poItemQty.js:hasUninvoicedItems, never compared here.
        // Costs no fetch: it is on every record this function is handed, which
        // is what lets /api/invoices/detect-po answer "is it open" for a
        // detected order without a read of its own.
        uninvoicedItems: record.get("Uninvoiced Items") || 0,
        // Issue #78 — renamed from "Total Amount": rollup of PO Items only,
        // before Shipping Fee.
        itemsSubtotal: record.get("Items Subtotal"),
        deliveryAddressUsed: record.get("Delivery Address Used"),
        // Issue #78 — plain copy of the PR's Shipping Fee, frozen at
        // PO-generation time (createPO), same pattern as PO Items
        // snapshotting PR Items. Replaces #69's "PR Shipping Fee" Lookup.
        shippingFee: record.get("Shipping Fee"),
        // New formula (Items Subtotal + Shipping Fee) — the PO's true
        // final figure, and what's printed as the PO PDF's TOTAL line.
        totalAmount: record.get("Total Amount"),
    };
}

/**
 * The status condition every invoice-side PO reader shares, in ONE place.
 *
 * It was two separate strings, and each carried the same two-status `AND(...)`.
 * A change to one would have left the other answering differently — and both feed
 * the SAME SCREEN, the invoice form's picker and its "show all / search" escape
 * hatch, so the divergence would have shown up as a PO the dropdown hides and the
 * search finds. That is the exact asymmetry #168 was diagnosing when it found
 * this, so fixing one while creating another was not an option.
 *
 * THREE READERS SINCE #244, not two: getOpenPOs went from inheriting this
 * condition through getPOsExceptWithdrawn to interpolating it itself, because
 * the openness half of its question became a filter too and the two halves
 * belong in one formula.
 *
 * WHY IT IS INTERPOLATED RATHER THAN ASSIGNED. `filterByFormula` cannot be handed
 * this constant directly: offline/formula-escaping.mjs fails a value that is not a
 * template literal, because it cannot verify a formula passed by variable. So each
 * reader keeps its own template literal and interpolates this fragment, which is
 * listed in that check's exemption table — replacing the narrower
 * `PO_WITHDRAWN_STATUS` entry rather than adding to it, so the list stays at one.
 */
const PO_NOT_WITHDRAWN = `{Status} != "${PO_WITHDRAWN_STATUS}"`;

/**
 * Every PO except withdrawn ones — the PO picker on the Invoice entry form
 * (issue #14), and the set its search escape hatch covers.
 *
 * NAMED FOR THE FILTER, NOT FOR A BUSINESS RULE, and #168 is why. It used to also
 * exclude `Awaiting Signature`, on the stated ground that "a PO that hasn't even
 * been signed/sent to the vendor yet can't have a real vendor invoice against it".
 * THAT GROUND IS FALSE and the base disproves it: `HYE-PO-20260805-02` is Awaiting
 * Signature and carries an invoice. Two normal paths produce it. Site staff order
 * outside the app and the PR/PO follow as a record, which is the same fact #162
 * cites for not filtering delivery candidates on signature status and the reason
 * `Committed Qty` and `Signed Qty` are separate fields. And a corrective PO (#167)
 * exists *because* material already arrived, so the excess invoice can precede it
 * by construction — the vendor bills for what it shipped.
 *
 * `Withdrawn` stays excluded (#138): that order will never receive an invoice, so
 * offering it as a target for one would be offering a mistake.
 *
 * A name like `getInvoiceablePOs` would be true today and silently false the day a
 * second un-invoiceable status appears, since this is a DENYLIST (#144) and admits
 * whatever it does not name. Naming the exclusion cannot rot that way.
 *
 * `vendor` here is the raw Vendor record ID (Purchase Orders.Vendor is a Lookup
 * through PR -> Purchase Requests.Vendor, itself a link field — same gotcha
 * already documented for `po.vendor` elsewhere) — callers resolve it against
 * `getAllVendors()`, same pattern as the PR detail page's Job/Vendor/Line
 * resolution.
 */
export async function getPOsExceptWithdrawn() {
    const records = await base(TABLES.PURCHASE_ORDERS)
        .select({
            filterByFormula: `${PO_NOT_WITHDRAWN}`,
        })
        .all();

    return records.map(recordToPO);
}

/**
 * Server-side search over the complete set above (issue #57's "Show all / search
 * closed POs" escape hatch) — matches PO ID substrings only.
 *
 * It described itself as "the *complete* invoiceable PO set" while excluding
 * Awaiting Signature, so "complete" was not true; #168 narrowed the filter to
 * match, and the status condition now comes from PO_NOT_WITHDRAWN so this and
 * getPOsExceptWithdrawn cannot answer differently about the same PO.
 *
 * Vendor-name search isn't offered: Purchase Orders.Vendor is a Lookup through
 * PR -> Purchase Requests.Vendor, not a direct link, so it can't be filtered
 * server-side the way CLAUDE.md's link-field-filtering rule already documents for
 * other tables; Vendor scoping instead stays entirely client-side in
 * InvoiceForm.js (posForVendor), same as the default open-POs list.
 */
export async function searchPOs(query) {
    // Issue #18 — was an inline copy of this same escape. One rule, one
    // implementation: lib/airtableFormula.js:formulaString, shared with every
    // other filterByFormula that interpolates a value (#159 finished the sweep).
    const records = await base(TABLES.PURCHASE_ORDERS)
        .select({
            filterByFormula: `AND(${PO_NOT_WITHDRAWN}, SEARCH(LOWER("${formulaString(query)}"), LOWER({PO ID})))`,
        })
        .all();

    return records.map(recordToPO);
}

/**
 * Every PO, whatever its status — the /pos list (#168).
 *
 * THIS NAME WAS REBOUND, AND IT WAS EMPTY WHEN THIS TOOK IT. Before #168 it meant
 * "every PO except Awaiting Signature and Withdrawn", which is `getPOsExceptWithdrawn`
 * above with a filter narrowed to one status. The commit that renamed it measured
 * the old name at zero occurrences across the repo before this one reused it, so
 * the two meanings never coexisted in a single tree — see that commit's message,
 * which is the only place that measurement survives.
 *
 * HAVING NO FILTER IS THE CONTRACT HERE, not an omission, and the failure mode is
 * why it is worth stating. A list shows what it shows: add a status condition and
 * the matching rows stop appearing, with nothing on screen to say a row was
 * withheld. Every status belongs — `Awaiting Signature` is the President's own
 * worklist, and `Withdrawn` is kept on record rather than deleted (#138), exactly
 * as the PR list keeps withdrawn PRs (#122). `offline/source-shape.mjs` asserts
 * this function builds no `filterByFormula`.
 *
 * Row-level visibility is NOT this function's job — /pos filters with `canViewPR`
 * against each PO's parent PR, the same gate /pos/[poId] uses.
 *
 * SORTED BY `PO ID` DESCENDING, SERVER-SIDE, exactly as getAllInvoices sorts by
 * `Invoice ID`. A PO ID is `HYE-PO-YYYYMMDD-##`, fixed width and zero-padded
 * throughout, so a plain string sort already gives chronological order and the
 * within-day sequence — InvoiceForm.js states the same property of this same ID
 * format. That is why /pos shows no Created column: the order IS the date order,
 * and #164's counter makes the ID prefix the one thing nobody can backdate.
 *
 * A `sort` is not a filter. The no-filterByFormula contract above is about rows
 * being silently withheld; ordering hides nothing.
 */
export async function getAllPOs() {
    const records = await base(TABLES.PURCHASE_ORDERS)
        .select({ sort: [{ field: "PO ID", direction: "desc" }] })
        .all();

    return records.map(recordToPO);
}

/**
 * Every PO that is not withdrawn and still has something left to invoice
 * (issue #57) — the invoice form's default PO list, since new invoices are
 * almost always against recent, in-progress POs and the full historical list
 * only grows over time. A fully-invoiced PO is never truly hidden from the app —
 * see the "Show all / search closed POs" UI in InvoiceForm.js, which queries the
 * complete set server-side on demand instead.
 *
 * ITS DEFINITION IS UNCHANGED by #168 — not withdrawn, and something left to
 * invoice. Unsigned POs reach it only because the superset widened. #244 changed
 * WHO ANSWERS the second half, not what it asks.
 *
 * ONE QUERY, AND THE POINT IS THAT IT NO LONGER GROWS WITH THE ORDER BOOK.
 * Until #244 this called getPOsExceptWithdrawn() and then asked each PO in turn
 * whether it was open, re-reading that PO and walking its ordered items: one
 * list, then a find per order and a find per ordered item until one came back
 * unbilled. So it grew with every order the company had ever placed and not
 * withdrawn. Measured on this base — 40 such orders, 58 ordered items — at 83
 * operations, which was this screen's 85 less the session and the vendor list.
 * The defense in the old per-PO comment was that an order with an unfulfilled
 * item early in its list is cheap to confirm; that is true of ONE order and
 * false of a list of them, and it is the distinction the comment did not draw.
 *
 * Openness IS expressible as a filter now, because the base carries the answer:
 * `Purchase Orders."Uninvoiced Items"` is a rollup counting the ordered items
 * that pass lib/poItemQty.js:hasUninvoicedQty. Measured on the live parser
 * (#244) — filterByFormula evaluates a rollup exactly as it evaluates a stored
 * number; what CLAUDE.md's rule forbids is comparing a LINK field to a record
 * id, which this is not.
 *
 * WHAT IT COSTS NOW IS ONE OPERATION PER 100 OPEN ORDERS, `.all()`'s page size,
 * and nothing per order beyond that — the same shape as getDeliveryCandidates,
 * whose count grows one query per 50 records while staying independent of row
 * count. Orders that are closed or withdrawn cost nothing at all, which is the
 * ceiling this screen did not have.
 *
 * The one behavior it inherits: a filter on a computed field goes through
 * Airtable's query index, which can lag a just-written record, where the walk
 * read the rollup off a .find() and could not (client.js:getLinkedRecords says
 * the same of lookups). Measured rather than assumed —
 * scripts/tests/verify-open-orders-244.mjs Part E, and the figure is on
 * `PO Items."Invoiced Qty"`. Both directions were already survivable: a PO
 * generated moments ago is appended by detection (InvoiceForm.js's posList), and
 * one that just closed still raises the over-invoicing warning.
 */
export async function getOpenPOs() {
    const records = await base(TABLES.PURCHASE_ORDERS)
        .select({
            filterByFormula: `AND(${PO_NOT_WITHDRAWN}, {Uninvoiced Items} > 0)`,
        })
        .all();

    return records.map(recordToPO);
}

/**
 * Create a PO from a signed PR. PO ID is backend-generated. Vendor,
 * Quotation File, Items Subtotal, and Total Amount are Lookups/rollup/
 * formula — never set directly. Shipping Fee (issue #78) is a plain copy
 * of the PR's own Shipping Fee at this exact moment — frozen going
 * forward, same as PO Items snapshotting PR Items.
 */
export async function createPO({
                                    prRecordId,
                                    ourPicId,
                                    ourManagerId,
                                    deliveryAddressUsed,
                                    shippingFee,
                                }) {
    const record = await generateNextPOId((poId) =>
        base(TABLES.PURCHASE_ORDERS).create({
            "PO ID": poId,
            PR: [prRecordId],
            "Our PIC": ourPicId ? [ourPicId] : [],
            "Our Manager": ourManagerId ? [ourManagerId] : [],
            "Created Date": new Date().toISOString().slice(0, 10),
            // A freshly generated PO starts unsigned, awaiting the
            // President's signature (#133 renamed this status from "Draft").
            Status: "Awaiting Signature",
            "Delivery Address Used": deliveryAddressUsed,
            ...(shippingFee !== undefined && shippingFee !== null ? { "Shipping Fee": shippingFee } : {}),
        })
    );

    return recordToPO(record);
}

/**
 * Partial update of a PO — e.g. president signing, status transitions,
 * attaching the generated PDF. `withdrawnAt` (issue #138) is accepted here
 * so the withdrawal timestamp can be written in the SAME call as Status ->
 * Withdrawn (lib/poWithdraw.js), never as a second write that could leave a
 * withdrawn PO with no recorded time; only ever set, never cleared.
 */
export async function updatePO(
    recordId,
    { presidentSigned, presidentSignedAt, status, poPdfFile, withdrawnAt }
) {
    const fields = {};
    if (presidentSigned !== undefined)
        fields["President Signed"] = presidentSigned;
    if (presidentSignedAt !== undefined)
        fields["President Signed At"] = presidentSignedAt;
    if (status !== undefined) fields["Status"] = status;
    if (poPdfFile !== undefined) fields["PO PDF File"] = poPdfFile;
    if (withdrawnAt !== undefined) fields["Withdrawn At"] = withdrawnAt;

    const record = await base(TABLES.PURCHASE_ORDERS).update(recordId, fields);
    return recordToPO(record);
}
