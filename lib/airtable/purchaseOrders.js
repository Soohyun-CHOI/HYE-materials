import { base, TABLES } from "./client";
import { generateNextPOId } from "../ids";

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
        poPdfFile: record.get("PO PDF File"),
        totalAmount: record.get("Total Amount"), // rollup — read-only
        deliveryAddressUsed: record.get("Delivery Address Used"),
        // Issue #69 — Lookup via PR, same pattern as Vendor/Quotation File.
        // Lets the invoice form show a reference figure without an extra
        // per-PO fetch of its PR.
        prShippingFee: record.get("PR Shipping Fee"),
    };
}

/**
 * List all POs eligible to be invoiced against — used to populate the PO
 * picker on the Invoice entry form (issue #14). Excludes `Draft` POs: a PO
 * that hasn't even been signed/sent to the vendor yet can't have a real
 * vendor invoice against it. `vendor` here is the raw Vendor record ID
 * (Purchase Orders.Vendor is a Lookup through PR -> Purchase Requests.Vendor,
 * itself a link field — same gotcha already documented for `po.vendor`
 * elsewhere) — callers resolve it against `getAllVendors()`, same pattern
 * as the PR detail page's Job/Vendor/Line resolution.
 */
export async function getAllPOs() {
    const records = await base(TABLES.PURCHASE_ORDERS)
        .select({
            filterByFormula: `{Status} != "Draft"`,
        })
        .all();

    return records.map(recordToPO);
}

/**
 * Server-side search over the *complete* non-Draft PO set (issue #57's
 * "Show all / search closed POs" escape hatch) — matches PO ID substrings
 * only. Vendor-name search isn't offered: Purchase Orders.Vendor is a
 * Lookup through PR -> Purchase Requests.Vendor, not a direct link, so it
 * can't be filtered server-side the way CLAUDE.md's link-field-filtering
 * rule already documents for other tables; Vendor scoping instead stays
 * entirely client-side in InvoiceForm.js (posForVendor), same as the
 * default open-POs list.
 */
export async function searchPOs(query) {
    const escaped = query.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const records = await base(TABLES.PURCHASE_ORDERS)
        .select({
            filterByFormula: `AND({Status} != "Draft", SEARCH(LOWER("${escaped}"), LOWER({PO ID})))`,
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
 * function always computes every item's invoiced total via
 * Promise.all-parallel fetches, which is exactly right when the caller
 * needs the full per-item breakdown (the PO detail page, the Item
 * dropdown), but wasteful here where all getOpenPOs() below needs is a
 * yes/no per PO. This walks PO Items one at a time and returns the
 * instant it finds one with remaining qty, so an open PO with an
 * unfulfilled item early in its list is cheap to confirm; the same
 * `Qty - SUM(invoiced Qty)` formula as #48 — if that formula ever
 * changes, this must change with it.
 */
export async function isPoOpen(poRecordId) {
    const poRecord = await base(TABLES.PURCHASE_ORDERS).find(poRecordId);
    const poItemIds = poRecord.get("PO Items") || [];

    for (const poItemId of poItemIds) {
        const poItemRecord = await base(TABLES.PO_ITEMS).find(poItemId);
        const qty = poItemRecord.get("Qty") || 0;
        const invoiceItemIds = poItemRecord.get("Invoice Items") || [];

        let invoicedQty = 0;
        if (invoiceItemIds.length > 0) {
            const invoiceItemRecords = await Promise.all(
                invoiceItemIds.map((id) => base(TABLES.INVOICE_ITEMS).find(id))
            );
            invoicedQty = invoiceItemRecords.reduce(
                (sum, record) => sum + (record.get("Qty") || 0),
                0
            );
        }

        if (qty - invoicedQty > 0) return true;
    }

    return false;
}

/**
 * getAllPOs(), narrowed to open ones (issue #57) — the invoice form's
 * default PO list, since new invoices are almost always against recent,
 * in-progress POs and the full historical list only grows over time. Not
 * a filterByFormula-level filter (openness can't be expressed as one —
 * see isPoOpen()'s comment), so this still fetches every non-Draft PO's
 * header record, then checks each one's openness in parallel. A fully-
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
 * Quotation File, and Total Amount are Lookups/rollup — never set directly.
 */
export async function createPO({
                                    prRecordId,
                                    ourPicId,
                                    ourManagerId,
                                    deliveryAddressUsed,
                                }) {
    const record = await generateNextPOId((poId) =>
        base(TABLES.PURCHASE_ORDERS).create({
            "PO ID": poId,
            PR: [prRecordId],
            "Our PIC": ourPicId ? [ourPicId] : [],
            "Our Manager": ourManagerId ? [ourManagerId] : [],
            "Created Date": new Date().toISOString().slice(0, 10),
            Status: "Draft",
            "Delivery Address Used": deliveryAddressUsed,
        })
    );

    return recordToPO(record);
}

/**
 * Partial update of a PO — e.g. president signing, status transitions,
 * attaching the generated PDF.
 */
export async function updatePO(
    recordId,
    { presidentSigned, presidentSignedAt, status, poPdfFile }
) {
    const fields = {};
    if (presidentSigned !== undefined)
        fields["President Signed"] = presidentSigned;
    if (presidentSignedAt !== undefined)
        fields["President Signed At"] = presidentSignedAt;
    if (status !== undefined) fields["Status"] = status;
    if (poPdfFile !== undefined) fields["PO PDF File"] = poPdfFile;

    const record = await base(TABLES.PURCHASE_ORDERS).update(recordId, fields);
    return recordToPO(record);
}
