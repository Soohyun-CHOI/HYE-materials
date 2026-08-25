import { base, TABLES, findByRecordIds, getLinkedRecords } from "./client";
import { generateChildId } from "../ids";

/**
 * The two halves of `Invoice Items.Amount` being a whole number of cents (#254) —
 * the premise `lib/variance.js:HEADER_TOLERANCE` is derived from. See
 * `createInvoiceItem`'s own docstring for why they are enforced here and what
 * Airtable does not enforce for us.
 *
 * `undefined` and `null` pass both: an absent figure is a different question,
 * already asked by the callers that require one, and coupling the two would make
 * a partial update refuse a field it was not writing.
 */
function assertWholeQty(caller, qty) {
    if (qty == null) return;
    if (!Number.isInteger(qty)) {
        throw new Error(
            `${caller}: Qty must be a whole number, got ${qty} — a fractional ` +
            `quantity puts Amount off the cent and the header tolerance rests on it (#254)`
        );
    }
}

function assertWholeCentPrice(caller, unitPrice) {
    if (unitPrice == null) return;
    // Compared with slack rather than `x * 100 === Math.round(x * 100)`, because a
    // whole-cent value need not be exactly representable in binary — 8.11 is not —
    // so the exact test rejects prices this rule is meant to admit.
    const cents = unitPrice * 100;
    if (!Number.isFinite(cents) || Math.abs(cents - Math.round(cents)) > 1e-9) {
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
 * A WHOLE QUANTITY AT A WHOLE-CENT PRICE, AND IT IS REQUIRED HERE FOR THE SAME
 * REASON `PO Item` IS (#254). `Amount` is `{Qty} * {Unit Price}` and rolls up into
 * `Invoices."Calculated Total"`, which `checkHeaderVariance` compares against the
 * total a person copied off the vendor's paper. That tolerance is half a cent,
 * derived from both sides being whole numbers of cents — so this is the premise
 * the figure rests on, and it was resting on nothing. **Airtable's `precision` is
 * a display option**: measured on this base, a `Qty` field showing no decimals
 * stores 2.5 verbatim and renders it as 3, and a 2-decimal currency field stores
 * 1.005 the same way. The one gate anybody could have named was `step="1"` on the
 * form's own control, and both invoice forms submit a hidden `itemsJson` rather
 * than that control, so it was not even on the path. Two charges rounding the same
 * way would then put `⚠ Check the total` on a stored invoice with no cause but the
 * vendor rounding its own printed amounts.
 *
 * Throwing rather than coercing, as above: rounding here would silently restate
 * what a caller said the charge was. NO USER-FACING REFUSAL IS PAIRED WITH IT,
 * unlike #278's, whose state a form really could produce. A person cannot reach
 * this through either form — the quantity control's own validity check blocks the
 * submit, and the price is frozen from the ordered item — so what is left is a
 * request that never went through a control at all, which is what a service-layer
 * throw is for. That is also the exact sense in which `step` was never a gate:
 * it protects the form, not the action the form posts to.
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
 * Partial update of an invoice item — e.g. setting Variance Flag once
 * Phase 3 reconciliation logic exists. Amount is never accepted here.
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
