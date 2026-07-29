import { base, TABLES, formulaString } from "./client";
import { hasRemainingQty } from "../poItemQty";
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
            filterByFormula: `{PO ID} = "${poId}"`,
            maxRecords: 1,
        })
        .firstPage();

    if (records.length === 0) return null;
    return recordToPO(records[0]);
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
 * List all POs eligible to be invoiced against — used to populate the PO
 * picker on the Invoice entry form (issue #14). Excludes `Awaiting
 * Signature` POs: a PO that hasn't even been signed/sent to the vendor yet
 * can't have a real
 * vendor invoice against it. Also excludes `Withdrawn` POs (issue #138) —
 * a withdrawn PO will never receive an invoice, so it must not be offerable
 * as a target for one. `vendor` here is the raw Vendor record ID
 * (Purchase Orders.Vendor is a Lookup through PR -> Purchase Requests.Vendor,
 * itself a link field — same gotcha already documented for `po.vendor`
 * elsewhere) — callers resolve it against `getAllVendors()`, same pattern
 * as the PR detail page's Job/Vendor/Line resolution.
 */
export async function getAllPOs() {
    const records = await base(TABLES.PURCHASE_ORDERS)
        .select({
            filterByFormula: `AND({Status} != "Awaiting Signature", {Status} != "${PO_WITHDRAWN_STATUS}")`,
        })
        .all();

    return records.map(recordToPO);
}

/**
 * Server-side search over the *complete* invoiceable PO set (issue #57's
 * "Show all / search closed POs" escape hatch — non-`Awaiting Signature`,
 * and non-`Withdrawn` since #138) — matches PO ID substrings
 * only. Vendor-name search isn't offered: Purchase Orders.Vendor is a
 * Lookup through PR -> Purchase Requests.Vendor, not a direct link, so it
 * can't be filtered server-side the way CLAUDE.md's link-field-filtering
 * rule already documents for other tables; Vendor scoping instead stays
 * entirely client-side in InvoiceForm.js (posForVendor), same as the
 * default open-POs list.
 */
export async function searchPOs(query) {
    // Issue #18 — was an inline copy of this same escape. One rule, one
    // implementation: client.js:formulaString, shared with every other
    // filterByFormula that interpolates a value.
    const records = await base(TABLES.PURCHASE_ORDERS)
        .select({
            filterByFormula: `AND({Status} != "Awaiting Signature", {Status} != "${PO_WITHDRAWN_STATUS}", SEARCH(LOWER("${formulaString(query)}"), LOWER({PO ID})))`,
        })
        .all();

    return records.map(recordToPO);
}

/**
 * Whether a PO still has at least one PO Item with remaining un-invoiced
 * quantity (issue #57's definition of "open" — Purchase Orders.Status has
 * no "Closed" option; openness is entirely this computed check, not a
 * stored field). Deliberately a separate, sequential implementation
 * rather than reusing getInvoicingStatusByPO() (#48) directly: that
 * function reads every item's figures, which is exactly right when the
 * caller needs the full per-item breakdown (the PO detail page, the Item
 * dropdown), but wasteful here where all getOpenPOs() below needs is a
 * yes/no per PO. This walks PO Items one at a time and returns the
 * instant it finds one with remaining qty, so an open PO with an
 * unfulfilled item early in its list is cheap to confirm.
 *
 * Issue #18 — the fetch strategy above is still deliberately its own, but the
 * rule is not: this was the THIRD implementation of "qty minus invoiced",
 * pairing its own per-Invoice-Item fetch with its own subtraction. The invoiced
 * total is now PO Items."Invoiced Qty" (a rollup of the same SUM) and the
 * subtraction is lib/poItemQty.js, so all three sites read one figure and apply
 * one rule. It also drops a fetch per Invoice Item, which was the most wasteful
 * part of the walk this comment was defending.
 */
export async function isPoOpen(poRecordId) {
    const poRecord = await base(TABLES.PURCHASE_ORDERS).find(poRecordId);
    const poItemIds = poRecord.get("PO Items") || [];

    for (const poItemId of poItemIds) {
        const poItemRecord = await base(TABLES.PO_ITEMS).find(poItemId);

        if (
            hasRemainingQty({
                qty: poItemRecord.get("Qty"),
                invoicedQty: poItemRecord.get("Invoiced Qty"),
            })
        ) {
            return true;
        }
    }

    return false;
}

/**
 * getAllPOs(), narrowed to open ones (issue #57) — the invoice form's
 * default PO list, since new invoices are almost always against recent,
 * in-progress POs and the full historical list only grows over time. Not
 * a filterByFormula-level filter (openness can't be expressed as one —
 * see isPoOpen()'s comment), so this still fetches every invoiceable PO's
 * header record (getAllPOs()'s exclusions, `Withdrawn` among them since
 * #138), then checks each one's openness in parallel. A fully-
 * invoiced PO is never truly hidden from the app — see the "Show all /
 * search closed POs" UI in InvoiceForm.js, which queries the complete set
 * server-side on demand instead.
 */
export async function getOpenPOs() {
    const pos = await getAllPOs();
    const openFlags = await Promise.all(pos.map((po) => isPoOpen(po.id)));
    return pos.filter((_, i) => openFlags[i]);
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
