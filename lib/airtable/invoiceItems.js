import { base, TABLES, findByRecordIds, getLinkedRecords } from "./client";
import { generateChildId } from "../ids";

/**
 * Many invoice items by record id, batched (#166, exported in #167).
 *
 * The ids come from a `PO Items."Invoice Items"` reverse-link, so a whole level of
 * invoices is fetched in one query per 50 rather than one per invoice item — the
 * per-row round trip #143 ruled out. #166's join walked this level with a private
 * copy of this reader; #167 needs the same level for the overage affordance, so it
 * moved here rather than becoming a second one that could drift.
 */
export async function getInvoiceItemsByRecordIds(recordIds) {
    return (await findByRecordIds(TABLES.INVOICE_ITEMS, recordIds)).map(recordToInvoiceItem);
}

/**
 * List all invoice items for an invoice.
 */
export async function getItemsByInvoice(invoiceRecordId) {
    const records = await getLinkedRecords(
        TABLES.INVOICES,
        invoiceRecordId,
        "Invoice Items",
        TABLES.INVOICE_ITEMS
    );

    return records.map(recordToInvoiceItem);
}

/**
 * List every Invoice Item linked to a single PO Item — the actual line-
 * level breakdown behind getInvoicingStatusByPO()'s aggregate, used by the
 * PO detail page (#15) to show each reconciling invoice item and its
 * Variance Flag, not just the summed invoiced/uninvoiced Qty.
 */
export async function getItemsByPOItem(poItemRecordId) {
    const records = await getLinkedRecords(
        TABLES.PO_ITEMS,
        poItemRecordId,
        "Invoice Items",
        TABLES.INVOICE_ITEMS
    );

    return records.map(recordToInvoiceItem);
}

function recordToInvoiceItem(record) {
    return {
        id: record.id,
        invoiceItemId: record.get("Invoice Item ID"),
        invoice: record.get("Invoice"),
        po: record.get("PO"),
        // Empty is unreachable through this app since #278 — every writer names
        // one — and is left readable rather than coerced, because a hand-edited
        // base can still empty a link and a reader that throws on it takes a page
        // down. Nothing DESCRIBES the state any more; see docs/notes.
        poItem: record.get("PO Item"),
        itemName: record.get("Item Name"),
        // Issue #84 — frozen copies from the linked PO Item at creation
        // time, same as Item Name/Unit Price (never a live Lookup). No
        // edit path: a Size/Unit that needs to differ means the wrong PO
        // Item was picked, not a value to correct in place.
        size: record.get("Size"),
        unit: record.get("Unit"),
        qty: record.get("Qty"),
        unitPrice: record.get("Unit Price"),
        amount: record.get("Amount"), // live formula (Qty x Unit Price) — never set by backend
        remark: record.get("Remark"), // issue #57 — why Unit Price/Qty diverges from the linked PO Item
        varianceFlag: record.get("Variance Flag") || false,
    };
}

/**
 * Create an invoice item. Invoice Item ID is backend-generated as
 * {Invoice ID}-{seq}. PO is a required single link — each invoice item reconciles
 * against exactly one PO, which is what makes item-level matching on a
 * multi-PO invoice possible.
 *
 * `PO Item` IS REQUIRED SINCE #278, AND IT IS REQUIRED HERE RATHER THAN IN THE
 * SCHEMA. It was optional under #51 so a charge could be left unlinked for
 * something with no ordered item behind it — Freight, a repair charge — and #96
 * hid that option while leaving this path open. #278 decided the option is not a
 * feature: a vendor's freight arrives on `Invoices."Shipping Fee"`, a header
 * field, and every item row is chosen from an order. **Airtable cannot make a
 * link field required** — the Metadata API exposes no such property on
 * `multipleRecordLinks` and the UI offers none either, so the constraint has
 * nowhere to live but here, exactly as `prefersSingleRecordLink` does (see
 * CLAUDE.md's measured Metadata API limits). Throwing rather than coercing,
 * because a caller that reaches this without one has a defect and a silently
 * empty link is what took twenty-two branches to describe.
 *
 * Amount is a live formula, never set here. Variance Flag is exposed as a plain
 * pass-through field — the reconciliation logic that decides its value is
 * Phase 3 work, blocked on the still-open variance tolerance decision, so
 * it's not computed here.
 */
export async function createInvoiceItem({
                                             invoiceRecordId,
                                             invoiceId,
                                             poRecordId,
                                             poItemRecordId,
                                             itemName,
                                             size,
                                             unit,
                                             qty,
                                             unitPrice,
                                             remark,
                                             varianceFlag,
                                         }) {
    if (!poItemRecordId) {
        throw new Error("createInvoiceItem: an invoice item must name a PO Item (#278)");
    }
    const record = await generateChildId(
        {
            parentTableName: TABLES.INVOICES,
            parentRecordId: invoiceRecordId,
            parentLinkFieldName: "Invoice Items",
            childTableName: TABLES.INVOICE_ITEMS,
            prefix: invoiceId,
        },
        (invoiceItemId) =>
            base(TABLES.INVOICE_ITEMS).create({
                "Invoice Item ID": invoiceItemId,
                Invoice: [invoiceRecordId],
                PO: poRecordId ? [poRecordId] : [],
                "PO Item": [poItemRecordId],
                "Item Name": itemName,
                Size: size || "",
                // Unit is a single select (issue #83) — an empty string isn't a
                // valid choice, so it is omitted rather than blanked. Since #278
                // the ordered item always supplies one, and this stays because
                // omitting is still how a blank Unit has to be written.
                ...(unit ? { Unit: unit } : {}),
                Qty: qty,
                "Unit Price": unitPrice,
                Remark: remark || "",
                "Variance Flag": varianceFlag || false,
            })
    );

    return recordToInvoiceItem(record);
}

/**
 * Partial update of an invoice item — e.g. setting Variance Flag once
 * Phase 3 reconciliation logic exists. Amount is never accepted here.
 */
export async function updateInvoiceItem(
    recordId,
    { itemName, qty, unitPrice, poRecordId, poItemRecordId, remark, varianceFlag }
) {
    const fields = {};
    if (itemName !== undefined) fields["Item Name"] = itemName;
    if (qty !== undefined) fields["Qty"] = qty;
    if (unitPrice !== undefined) fields["Unit Price"] = unitPrice;
    // Issue #167 — the PO an invoice item reconciles against can move exactly
    // once: when an overage correction takes over an invoice whose WHOLE invoice item
    // was the excess, the invoice item is re-pointed rather than split, so it must
    // follow the ordered item to the new order. Both links move together or the
    // invoice item would name a PO Item belonging to a different PO.
    //
    // #278 — THIS PATH CANNOT CLEAR EITHER LINK, and it never could through a
    // caller: both writers pass a target. The `? :` shape stays because
    // `undefined` and a value are what a caller distinguishes, and a falsy id
    // reaching here would be a defect rather than a request to unlink. `createInvoiceItem`
    // throws on one; this is an update and has an id in hand by construction.
    if (poRecordId !== undefined) fields["PO"] = poRecordId ? [poRecordId] : [];
    if (poItemRecordId !== undefined) fields["PO Item"] = poItemRecordId ? [poItemRecordId] : [];
    if (remark !== undefined) fields["Remark"] = remark;
    if (varianceFlag !== undefined) fields["Variance Flag"] = varianceFlag;

    const record = await base(TABLES.INVOICE_ITEMS).update(recordId, fields);
    return recordToInvoiceItem(record);
}
