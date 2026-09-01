import { base, TABLES, findByRecordIds, getLinkedRecords } from "./client";
import { generateChildId } from "../ids";
import { isWholeCentPrice, isWholeQty } from "../variance";

/**
 * The backstop for the premise `lib/variance.js:HEADER_TOLERANCE` is derived from
 * (#254). The JUDGMENT is that module's — `isWholeQty` / `isWholeCentPrice` — since
 * both invoice actions ask it too, with a message; these two are the last line, and
 * throw rather than coerce because rounding here would silently restate what a
 * caller said the item was. See `createInvoiceItem`'s docstring for the
 * derivation and for what Airtable does not enforce for us.
 */
function assertWholeQty(caller, qty) {
    if (!isWholeQty(qty)) {
        throw new Error(
            `${caller}: Qty must be a whole number, got ${qty} — a fractional ` +
            `quantity puts Amount off the cent and the header tolerance rests on it (#254)`
        );
    }
}

function assertWholeCentPrice(caller, unitPrice) {
    if (!isWholeCentPrice(unitPrice)) {
        throw new Error(
            `${caller}: Unit Price must be a whole number of cents, got ${unitPrice} ` +
            `— a sub-cent price puts Amount off the cent and the header tolerance ` +
            `rests on it (#254)`
        );
    }
}

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
 * List every Invoice Item linked to a single PO Item — the actual item-
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
 * SCHEMA. It was optional under #51 so an invoice item could be left unlinked for
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
 * A WHOLE QUANTITY AT A WHOLE-CENT PRICE, AND IT IS REQUIRED HERE FOR THE SAME
 * REASON `PO Item` IS (#254). `Amount` is `{Qty} * {Unit Price}` and rolls up into
 * `Invoices."Calculated Total"`, which `checkHeaderVariance` compares against the
 * total a person copied off the vendor's paper. That tolerance is half a cent,
 * derived from both sides being whole numbers of cents — so this is the premise
 * the figure rests on, and it was resting on nothing. Two items rounding the same
 * way would put `⚠ Check the total` on a stored invoice with no cause but the
 * vendor rounding its own printed amounts.
 *
 * NOTHING ELSE HOLDS IT, AND ALL THREE CANDIDATES WERE MEASURED RATHER THAN
 * REASONED ABOUT — the first draft of this docstring got the third one wrong.
 * **Airtable's `precision` is a display option**: a `Qty` field showing no decimals
 * stores 2.5 verbatim and renders it as 3, and a 2-decimal currency field stores
 * 1.005 the same way. The **value the action reads** is a hidden `itemsJson`, not
 * the controls, so nothing declared on a control could gate it. And the **controls'
 * own validation does not fire**: the quantity input declares no `step` and the
 * price input declares `step="0.01"`, yet on this form `2.5` and `1.005` both
 * report `checkValidity() === true` and the form submits. Measured in the browser —
 * a detached `<input type="number">` DOES report `stepMismatch` for 2.5, so the
 * absent attribute is not the reason and the shape of the form is.
 *
 * SO BOTH STATES ARE FORM-REACHABLE, WHICH IS #278's CONDITION AND MEANS THIS
 * THROW IS NOT ALONE. `createInvoiceAction` and `updateInvoiceAction` refuse first,
 * with `ITEM_PRECISION_COPY`, because a reader who typed the figure can fix it —
 * without that, this throw reached them as
 * `Something went wrong creating the invoice. Please try again.` and retrying
 * failed identically. This remains the last line, for a request that never went
 * through a control at all.
 *
 * Amount is a live formula, never set here. Variance Flag is a plain pass-through
 * field: the reconciliation that decides its value is `createInvoiceAction`'s,
 * against the tolerances in `lib/variance.js`, and is not computed here.
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
    assertWholeQty("createInvoiceItem", qty);
    assertWholeCentPrice("createInvoiceItem", unitPrice);
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
 * Partial update of an invoice item — Variance Flag from `createInvoiceAction`
 * and `lib/overagePR.js`, values from the edit form, and both links when an
 * overage correction moves an invoice item. Amount is never accepted here.
 *
 * It said `once Phase 3 reconciliation logic exists`, which #15 shipped, so the
 * sentence had been describing a future its own callers were already living in.
 * Corrected in the commit that gave this function `createInvoiceItem`'s quantity
 * and price guards (#254): fixing one sibling's docstring and leaving the other's
 * is the shape those two guards exist to avoid.
 *
 * WHAT IT ACCEPTS IS THE SAME PREMISE AS `createInvoiceItem`'s, conditionally —
 * see the note inside on why, and that function's docstring for the derivation.
 */
export async function updateInvoiceItem(
    recordId,
    { itemName, qty, unitPrice, poRecordId, poItemRecordId, remark, varianceFlag }
) {
    // #254 — conditional, because this writer's shape is. The same premise as
    // `createInvoiceItem`'s: the overage split writes a quantity here
    // (`lib/overagePR.js`), and while it computes rather than transcribes, it
    // computes by subtracting one stored quantity from another — so it can only
    // ever propagate a fraction that was already stored, and this is where that
    // surfaces instead of reaching `Calculated Total`.
    const fields = {};
    if (itemName !== undefined) fields["Item Name"] = itemName;
    if (qty !== undefined) {
        assertWholeQty("updateInvoiceItem", qty);
        fields["Qty"] = qty;
    }
    if (unitPrice !== undefined) {
        assertWholeCentPrice("updateInvoiceItem", unitPrice);
        fields["Unit Price"] = unitPrice;
    }
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
