import { base, TABLES, getLinkedRecords, findByRecordIds } from "./client";
import { generateChildId } from "../ids";
import { uninvoicedQty } from "../poItemQty";

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
 * List all ordered items for a PO. This is the EMPLOYEE path (#132): it must not
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
        // "Signed Qty" is deliberately absent: it still feeds only the Materials
        // rollups inside Airtable and has no JS reader at all.
        //
        // "Invoiced Qty" WAS ABSENT ON THE SAME LINE UNTIL #235 — invoice data kept
        // off this employee-facing path (#132) — and that line is retired rather
        // than bent. #211 held that what a vendor invoiced is readable by anyone who
        // may read the order behind it, and left `Paid` as the narrower replacement;
        // #235 acted on it, so the PO detail shows `Invoiced` to every viewer who can
        // see the order and judges the page's invoicing chip from this field. It
        // costs no query: fetchPOItemRecords passes no `fields`, so the record is
        // already here in full — the same argument `deliveryItems` delivered against.
        //
        // "Committed Qty" and "Delivered Qty" WERE both absent too, on the ground
        // that this mapper's audience had no use for them — #169 gave them one.
        // The PO detail page shows delivered against ordered to every viewer who
        // can see the order, and judges the page's delivery chip with
        // `countsAsOrdered`, which reads Committed Qty. Both are delivery-derived
        // rather than invoice-derived, the same category as `material` below and
        // as #167's `formerDeliveryItems`, so both are admissible here.
        material: record.get("Material") || [],
        // #18's judgment, read not re-derived: 0 when the PO was withdrawn.
        // Judged, never rendered — what "ordered" means as a FIGURE is
        // `Qty` (see CLAUDE.md's screen-words table).
        committedQty: record.get("Committed Qty"),
        // #162 — SUM of the Delivery Items allocated to this ordered item. Blank means
        // nothing has been delivered, which Airtable reports as undefined; callers treat
        // that as 0. See lib/deliveryStatus.js:orderedItemDelivery for why the rollup
        // is enough here while #166 one level up has to read the rows.
        deliveredQty: record.get("Delivered Qty"),
        // #18's rollup of every invoice item on this ordered item (#235). See the
        // note above on why it is admissible here now.
        invoicedQty: record.get("Invoiced Qty"),
        // #233 — the CURRENT `Delivery Items` reverse-link, so the order's page can
        // fetch a whole level of deliveries in one batched read instead of none at
        // all. Delivery data, so it is admissible here for the reason `material`,
        // `deliveredQty` and `formerDeliveryItems` already are, and it is FREE:
        // fetchPOItemRecords passes no `fields`, so Airtable has already returned
        // the whole record and reading one more key off it costs no query.
        //
        // THE `Invoice Items` ARRAY IS NOT HERE, AND THE REASON IT GIVES IS SPENT.
        // The line was #132's: an id array carries no money, but its LENGTH answers
        // "has this been invoiced, and in how many pieces" — invoice-derived by the
        // same standard that kept `Invoiced Qty` out of this mapper. **#235 retired
        // that standard**, putting `Invoiced Qty` here on #211's ground that what a
        // vendor invoiced is readable by anyone who may read the order behind it, so
        // the appeal has nothing left to appeal to; corrected per #181 by #311, which
        // read this file for the link array. What keeps the array out NOW is only
        // that no caller of this mapper needs it — the PO detail page reads the
        // level through getPOItemsForReconciliation below, and #311's second reader
        // is getPOItemsByRecordIds, which carries it.
        deliveryItems: record.get("Delivery Items") || [],
        // Issue #167 — the Delivery Items rows that USED TO BE allocated against
        // this ordered item, the reverse of Delivery Items."Former PO Item".
        // Delivery data, not invoice data, so it is admissible on this
        // employee-facing path for the same reason `material` above is. It is what
        // lets the ORIGINAL PO render the overage banner precisely rather than
        // walking the shared Delivery, which would put the banner on an order that
        // was not itself exceeded whenever one delivery filled two of them.
        //
        // NOT `reattachedDeliveryItems`, which named the wrong end: the row was
        // re-attached to the OVERAGE order's item, and from THIS one it departed. And
        // not `overageDeliveryItems` either — the parallel field on Purchase Requests
        // keeps that name on purpose, because there the overage IS the relationship,
        // while here the relationship is departure. One name for two meanings across
        // two parents is worse than the accidental collisions #164 had to census,
        // because it would be deliberate.
        formerDeliveryItems: record.get("Former Delivery Items") || [],
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
 * Ordered items by record id, batched — the shape the MATERIAL axis needs (#19)
 * and the DELIVERY axis needs (#162).
 *
 * A separate mapper from recordToPOItem on purpose. That one feeds the PO detail
 * page's employee path, where invoice-derived figures must stay out (#132), and
 * it deliberately carries neither `Committed Qty` nor `PO Status` because nothing
 * on the document axis reads them. The two off-document axes read both — the
 * status to LABEL an ordered item and Committed Qty to JUDGE whether it counts as
 * ordered (#19), that same judgment to decide whether an ordered item can receive
 * a delivery (#162) — so widening the shared mapper would push fields onto every
 * PO detail render that page has no use for.
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
        // #18's judgment, read not re-derived: 0 when the PO was withdrawn.
        committedQty: record.get("Committed Qty"),
        // #162 — SUM of the Delivery Items allocated to this ordered item. Blank means
        // nothing has been delivered, which Airtable reports as undefined; callers
        // treat that as 0 (lib/deliveryAllocation.js:undeliveredQty).
        deliveredQty: record.get("Delivered Qty"),
        // #235 — the invoiced total, for `/pos`'s invoicing chip. Invoice-derived on
        // a reader every active employee reaches, which #132 would have refused and
        // #211 settled: what a vendor invoiced is readable by anyone who may read the
        // order behind it. Free, for the reason the whole mapper is — findByRecordIds
        // passes no `fields`.
        invoicedQty: record.get("Invoiced Qty"),
        // #166 — the reverse-link array, so a caller can fetch a whole level of
        // Delivery Items in one batched read.
        deliveryItems: record.get("Delivery Items") || [],
        // #311 — THE OTHER AXIS'S REVERSE-LINK, AND THE LINE THAT KEPT IT OUT WAS
        // ALREADY SPENT. This said "a chip needs the total, not the rows, and the
        // level below belongs to the caller that renders it". The first half is
        // still true of the INVOICING chip and false of the payment one: `Paid`
        // lives on `Invoices` and no rollup reaches it from here, so the rows are
        // the only way. The second half named a caller that now exists — `/pos`
        // renders the payment column and needs this level to reach it.
        //
        // Free, for the reason the whole mapper is: findByRecordIds passes no
        // `fields`, so Airtable has already returned the record.
        invoiceItems: record.get("Invoice Items") || [],
    }));
}

/**
 * ordered items for #166's delivered-against-invoiced-against-ordered comparison.
 *
 * A THIRD PROJECTION OF THE SAME FETCH, and the reason is audience rather than
 * fields. `recordToPOItem` above serves the PO detail page, which #132 made
 * withhold invoice-derived values from a non-privileged viewer;
 * getPOItemsByRecordIds serves #19's price screens and #162's allocation, both of
 * which any active employee reaches. This one carries `Invoiced Qty` and the
 * `Invoice Items` link array, so #166 treated it as PRESIDENT-OR-ADMIN ONLY —
 * which is why lib/deliveryReconciliation.js decided whether to walk this level at
 * all rather than fetching it and letting a page choose not to render it.
 *
 * #167 NARROWED THAT AND #211 RETIRED IT. #167's exception was the delivery detail's
 * overage affordance, which is Job-scoped because raising the overage request is site
 * work and deciding whether it can be raised needs the invoices on the over-delivered
 * ordered item. #211 then opened the invoice routes to the same Job scope and
 * released the deliveries list's withholding with them, so there is no audience
 * left that this projection has to be kept from — what a vendor invoiced is readable
 * by anyone who may read the order behind it. WHAT REPLACED THE OLD LINE WAS
 * NARROWER AND IS GONE TOO: `Paid` was President-or-Admin, which #309 reversed —
 * payment is readable by every reader who reaches the invoice. Corrected per #181 by
 * #311. It is still not a field of this projection, and now for an ordinary reason:
 * `Paid` lives on `Invoices` rather than on an ordered item, and the `Invoice Items`
 * link below is how both callers reach it.
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
        // #265 — the AGREED price. The correction quotes a vendor's price, so where
        // two invoices could supply the quotation this is what says whether the choice
        // between them changes the figure on the order that goes out.
        //
        // FREE, exactly as getPOItemsByRecordIds says of its own extra fields:
        // findByRecordIds passes no `fields`, so Airtable already returns the whole
        // record and reading one more key off it costs no query and no bytes.
        unitPrice: record.get("Unit Price"),
        // #265 — TOTAL delivered, within-order plus beyond, which is one half of the
        // agreement test. The rollup is right for THIS reader and wrong for #166's:
        // that one separates within from beyond and so has to read `Delivery Items`
        // (see lib/deliveryStatus.js:orderedItemStatus), while the agreement asks only
        // whether the two documents' totals meet. Free for the same reason as above,
        // and it is what keeps the whole judgment at zero extra operations.
        deliveredQty: record.get("Delivered Qty"),
        // The ORDERED ITEM's invoiced total across every invoice, not one
        // invoice's own invoice items. An ordered item can carry two invoices, and
        // summing only the invoice in hand would report material as uninvoiced when
        // it is invoiced twice over.
        invoicedQty: record.get("Invoiced Qty"),
        // Both reverse-links, so the two axes can each fetch their next level in
        // one batched read.
        invoiceItems: record.get("Invoice Items") || [],
        deliveryItems: record.get("Delivery Items") || [],
        // #18's item identity. #167 folds an invoice's split invoice items on it
        // (never on `Item Name` text), and its apply step uses it to find which
        // ordered item of the overage PO the excess belongs on.
        material: record.get("Material") || [],
    }));
}

/**
 * Issue #18 — point a PO Item at its material. The ONLY writer to a PO Item
 * after creation, and deliberately narrow: PO Items are a frozen snapshot of
 * what was ordered (see createPOItem), so a general-purpose updatePOItem would
 * invite exactly the drift that freezing is meant to prevent. This link is not
 * part of the snapshot's meaning — it is a pointer to the item catalog that
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
 * Total quantity DELIVERED against one PO Item, read straight off the PO
 * Items."Delivered Qty" rollup (#162) — the delivery counterpart of the function
 * above, and read under the same condition: allocation subtracts it from `Qty`
 * to decide what an ordered item can still absorb, so a lagging value would
 * over-allocate the NEXT delivery to an ordered item that is already full.
 * Re-measured on the first read after a Delivery Item is created by
 * scripts/tests/verify-deliveries-162.mjs rather than assumed here.
 *
 * Blank means nothing has been delivered, which Airtable reports as undefined; 0 is the
 * honest answer for a caller asking "how much".
 */
export async function getDeliveredQtyForPOItem(poItemRecordId) {
    const record = await base(TABLES.PO_ITEMS).find(poItemRecordId);
    return record.get("Delivered Qty") || 0;
}

/**
 * Enriches each of a PO's PO Items with how much has actually been invoiced
 * against it so far (issue #48). Partial invoicing across several Invoice Items
 * is normal, so this only sums Qty — it doesn't judge whether an ordered item
 * is "done". A negative uninvoicedQty means more has been invoiced than was
 * ever ordered, which callers surface distinctly rather than lumping in with
 * "still uninvoiced" (see lib/poItemQty.js, which owns that rule).
 *
 * Issue #18 — one fetch, no per-item round trip. This used to read each PO
 * Item's Invoice Items reverse-link in a Promise.all, i.e. one extra fetch per
 * ordered item on every PO detail render; the figure now comes from the rollup already
 * present on the record fetched above.
 *
 * #233 — AND THE LINK ARRAY IS HERE FOR THE SAME REASON THE FIGURE IS. The page
 * went on making that per-item round trip anyway, through `getItemsByPOItem`, to
 * reach the invoice items themselves rather than their sum; carrying the ids lets
 * the caller batch that level too. This is the RIGHT SIDE OF #132's line and
 * `recordToPOItem` is the wrong one — a count of invoice items is invoice-derived
 * even though it holds no money, so it belongs where `Invoiced Qty` already is.
 * Free for the same reason: the records were fetched whole.
 */
export async function getInvoicingStatusByPO(poRecordId) {
    const records = await fetchPOItemRecords(poRecordId);

    return records.map((record) => {
        const item = recordToPOItem(record);
        const invoicedQty = record.get("Invoiced Qty") || 0;

        return {
            ...item,
            invoicedQty,
            uninvoicedQty: uninvoicedQty({ qty: item.qty, invoicedQty }),
            invoiceItems: record.get("Invoice Items") || [],
        };
    });
}

/**
 * Create an ordered item — a frozen snapshot copied from a PR Item at the
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
