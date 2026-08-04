import { base, TABLES, getLinkedRecords, findByRecordIds } from "./client";
import { generateChildId } from "../ids";
import { remainingQty } from "../poItemQty";

/**
 * The raw PO Item records for one PO, fetched the way CLAUDE.md requires
 * (parent's reverse-link, never a filter on the child table). Kept internal so
 * getItemsByPO and getInvoicingStatusByPO share one fetch shape while exposing
 * deliberately different field sets — see getInvoicingStatusByPO.
 */
async function fetchPOItemRecords(poRecordId) {
    return getLinkedRecords(TABLES.PURCHASE_ORDERS, poRecordId, "PO Items", TABLES.PO_ITEMS);
}

/**
 * List all line items for a PO. This is the EMPLOYEE path (#132): it must not
 * carry invoice-derived figures, which is why the rollup below is read in
 * getInvoicingStatusByPO and not in recordToPOItem.
 */
export async function getItemsByPO(poRecordId) {
    return (await fetchPOItemRecords(poRecordId)).map(recordToPOItem);
}

function recordToPOItem(record) {
    return {
        id: record.id,
        poItemId: record.get("PO Item ID"),
        po: record.get("PO"),
        itemName: record.get("Item Name"),
        size: record.get("Size"),
        unit: record.get("Unit"),
        qty: record.get("Qty"),
        unitPrice: record.get("Unit Price"),
        amount: record.get("Amount"),
        remark: record.get("Remark"),
        // Issue #18 — the item-axis link, written by lib/materialsCache.js
        // after the PO is committed. Not invoice-derived, so it is safe on the
        // employee path.
        //
        // "Invoiced Qty", "Committed Qty", "Signed Qty" and "Delivered Qty" are
        // all deliberately absent here, but no longer for one shared reason.
        // Invoiced Qty is invoice data and must stay off this path (#132).
        // Committed Qty DOES have readers now — getPOItemsByRecordIds below
        // exposes it for #19's price screens and #162's allocation — so its
        // absence here is about this mapper's audience, not about the field
        // being unread. Delivered Qty is the same: read below, not here.
        // Signed Qty still feeds only the Materials rollups inside Airtable.
        material: record.get("Material") || [],
    };
}

/**
 * Fetch a single PO Item by its Airtable record ID — used at invoice
 * creation time (#15) to compare an Invoice Item's Unit Price/Qty against
 * the PO Item it reconciles against.
 */
export async function getPOItemByRecordId(recordId) {
    const record = await base(TABLES.PO_ITEMS).find(recordId);
    return recordToPOItem(record);
}

/**
 * PO Item lines by record id, batched — the shape the MATERIAL axis needs (#19)
 * and the DELIVERY axis needs (#162).
 *
 * A separate mapper from recordToPOItem on purpose. That one feeds the PO detail
 * page's employee path, where invoice-derived figures must stay out (#132), and
 * it deliberately carries neither `Committed Qty` nor `PO Status` because nothing
 * on the document axis reads them. The two off-document axes read both — the
 * status to LABEL a line and Committed Qty to JUDGE whether it counts as ordered
 * (#19), that same judgement to decide whether a line can receive an arrival
 * (#162) — so widening the shared mapper would push fields onto every PO detail
 * render that page has no use for.
 *
 * `Delivered Qty` was added here for #162 rather than in a third mapper, and the
 * deciding fact is that it is FREE: findByRecordIds passes no `fields`, so
 * Airtable already returns the whole record and reading one more key off it costs
 * no query and no bytes. A near-duplicate mapper to avoid one unused number on
 * #19's rows would have been the more expensive mistake.
 *
 * Batched by RECORD_ID() via findByRecordIds. Note this deliberately does not use
 * any `PO Record ID` lookup on this table — there is none, and the one that used
 * to exist was misconfigured (it returned the PO's Invoice Items link array
 * instead of its record id, measured in #19) and has since been deleted.
 */
export async function getPOItemsByRecordIds(poItemRecordIds) {
    const records = await findByRecordIds(TABLES.PO_ITEMS, poItemRecordIds);

    return records.map((record) => ({
        id: record.id,
        poItemId: record.get("PO Item ID"),
        po: record.get("PO") || [],
        material: record.get("Material") || [],
        itemName: record.get("Item Name"),
        size: record.get("Size"),
        unit: record.get("Unit"),
        qty: record.get("Qty"),
        unitPrice: record.get("Unit Price"),
        amount: record.get("Amount"),
        // Lookup — an array. Joined rather than indexed so a blank reads as ""
        // instead of undefined, and so a hypothetical multi-value lookup is
        // visible rather than silently truncated to its first element.
        poStatus: (record.get("PO Status") || []).join(", "),
        // #18's judgement, read not re-derived: 0 when the PO was withdrawn.
        committedQty: record.get("Committed Qty"),
        // #162 — SUM of the Delivery Items allocated to this line. Blank means
        // nothing has arrived, which Airtable reports as undefined; callers
        // treat that as 0 (lib/deliveryAllocation.js:undeliveredQty).
        deliveredQty: record.get("Delivered Qty"),
        // #166 — the reverse-link array, so a caller can fetch a whole level of
        // Delivery Items in one batched read. Delivery data, not invoice data, so
        // it is admissible on this reader's employee-facing path for the same
        // reason `deliveredQty` above already is. The `Invoice Items` array is
        // deliberately NOT here — see getPOItemsForReconciliation below.
        deliveryItems: record.get("Delivery Items") || [],
    }));
}

/**
 * PO lines for #166's delivered-against-invoiced-against-ordered comparison.
 *
 * A THIRD PROJECTION OF THE SAME FETCH, and the reason is audience rather than
 * fields. `recordToPOItem` above serves the PO detail page, which #132 made
 * withhold invoice-derived values from a non-privileged viewer;
 * getPOItemsByRecordIds serves #19's price screens and #162's allocation, both of
 * which any active employee reaches. This one carries `Invoiced Qty` and the
 * `Invoice Items` link array, so it is PRESIDENT-OR-ADMIN ONLY and its callers
 * must not fetch it on a path site staff can reach — which is exactly why
 * lib/deliveryReconciliation.js decides whether to walk this level at all rather
 * than fetching it and letting a page choose not to render it.
 *
 * All three live in this file because a projection of a table belongs with the
 * table, and keeping them adjacent is what makes the audience difference visible
 * instead of buried in three call sites.
 */
export async function getPOItemsForReconciliation(poItemRecordIds) {
    const records = await findByRecordIds(TABLES.PO_ITEMS, poItemRecordIds);

    return records.map((record) => ({
        id: record.id,
        poItemId: record.get("PO Item ID"),
        po: record.get("PO") || [],
        itemName: record.get("Item Name"),
        size: record.get("Size"),
        unit: record.get("Unit"),
        // What was ordered — the third quantity in the comparison.
        qty: record.get("Qty"),
        // The LINE's invoiced total across every invoice, not one invoice's own
        // lines. A PO line can carry two invoices, and summing only the invoice in
        // hand would report material as unbilled when it is billed twice over.
        invoicedQty: record.get("Invoiced Qty"),
        // Both reverse-links, so the two axes can each fetch their next level in
        // one batched read.
        invoiceItems: record.get("Invoice Items") || [],
        deliveryItems: record.get("Delivery Items") || [],
    }));
}

/**
 * Issue #18 — point a PO Item at its material. The ONLY writer to a PO Item
 * after creation, and deliberately narrow: PO Items are a frozen snapshot of
 * what was ordered (see createPOItem), so a general-purpose updatePOItem would
 * invite exactly the drift that freezing is meant to prevent. This link is not
 * part of the snapshot's meaning — it is a pointer to the item catalogue that
 * lets the material axis exist at all, and it is written outside the PO
 * generation rollback so a failure here cannot undo the PO.
 */
export async function setPOItemMaterial(poItemRecordId, materialRecordId) {
    const record = await base(TABLES.PO_ITEMS).update(poItemRecordId, {
        Material: materialRecordId ? [materialRecordId] : [],
    });
    return recordToPOItem(record);
}

/**
 * Total quantity invoiced against ONE PO Item, read straight off the
 * PO Items."Invoiced Qty" rollup (#18).
 *
 * This used to fetch every linked Invoice Item and sum Qty in JS. The rollup is
 * the same SUM over the same Invoice Items."Qty" through the same PO Item link,
 * so keeping both was two implementations of one rule. What blocked merging was
 * whether the rollup reflects a JUST-linked Invoice Item — this function's
 * callers read it immediately after creating one, so a lagging value would
 * silently under-count. Measured on this base before merging: on 5 of 5 samples
 * the rollup was already correct on the first read after create() returned, so
 * any lag is below one API round trip. See CLAUDE.md.
 *
 * Blank means no invoices, which Airtable reports as undefined; 0 is the honest
 * answer for a caller asking "how much".
 */
export async function getInvoicedQtyForPOItem(poItemRecordId) {
    const record = await base(TABLES.PO_ITEMS).find(poItemRecordId);
    return record.get("Invoiced Qty") || 0;
}

/**
 * Total quantity DELIVERED against one PO Item, read straight off the
 * PO Items."Delivered Qty" rollup (#162) — the arrival counterpart of the
 * function above, and read under the same condition: allocation subtracts it
 * from `Qty` to decide what a line can still absorb, so a lagging value would
 * over-allocate the NEXT arrival to a line that is already full. Re-measured on
 * the first read after a Delivery Item is created by
 * scripts/tests/verify-deliveries-162.mjs rather than assumed here.
 *
 * Blank means nothing has arrived, which Airtable reports as undefined; 0 is the
 * honest answer for a caller asking "how much".
 */
export async function getDeliveredQtyForPOItem(poItemRecordId) {
    const record = await base(TABLES.PO_ITEMS).find(poItemRecordId);
    return record.get("Delivered Qty") || 0;
}

/**
 * Enriches each of a PO's PO Items with how much has actually been invoiced
 * against it so far (issue #48). Partial invoicing across several Invoice Items
 * is normal, so this only sums Qty — it doesn't judge whether a line is "done".
 * A negative remainingQty means more has been invoiced than was ever ordered,
 * which callers surface distinctly rather than lumping in with "still
 * outstanding" (see lib/poItemQty.js, which owns that rule).
 *
 * Issue #18 — one fetch, no per-item round trip. This used to read each PO
 * Item's Invoice Items reverse-link in a Promise.all, i.e. one extra fetch per
 * line on every PO detail render; the figure now comes from the rollup already
 * present on the record fetched above.
 */
export async function getInvoicingStatusByPO(poRecordId) {
    const records = await fetchPOItemRecords(poRecordId);

    return records.map((record) => {
        const item = recordToPOItem(record);
        const invoicedQty = record.get("Invoiced Qty") || 0;

        return {
            ...item,
            invoicedQty,
            remainingQty: remainingQty({ qty: item.qty, invoicedQty }),
        };
    });
}

/**
 * Create a PO line item — a frozen snapshot copied from a PR Item at the
 * moment the PO is generated. Unlike PR Items, Amount here is a STATIC
 * currency value: it is NOT a formula in Airtable, so the backend must
 * compute and write it explicitly. This is intentional — PO Items must
 * never silently change after a PO has been issued to a vendor.
 * PO Item ID is backend-generated as {PO ID}-{seq}.
 */
export async function createPOItem({
                                        poRecordId,
                                        poId,
                                        itemName,
                                        size,
                                        unit,
                                        qty,
                                        unitPrice,
                                        remark,
                                    }) {
    const record = await generateChildId(
        {
            parentTableName: TABLES.PURCHASE_ORDERS,
            parentRecordId: poRecordId,
            parentLinkFieldName: "PO Items",
            childTableName: TABLES.PO_ITEMS,
            prefix: poId,
        },
        (poItemId) =>
            base(TABLES.PO_ITEMS).create({
                "PO Item ID": poItemId,
                PO: [poRecordId],
                "Item Name": itemName,
                Size: size || "",
                // Unit is a single-select and this is a frozen copy of the
                // PR Item's Unit, which is now allowed to be blank (#111);
                // omit rather than send "" (Airtable rejects the empty
                // option). No user-facing Unit entry on PO — this only ever
                // mirrors the PR Item via poGeneration.js.
                ...(unit ? { Unit: unit } : {}),
                Qty: qty,
                "Unit Price": unitPrice,
                Amount: qty * unitPrice,
                Remark: remark || "",
            })
    );

    return recordToPOItem(record);
}
