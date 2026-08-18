// The two document lists an order's own page carries (#233): which invoices
// charge it, and which deliveries filled it.
//
// WHY THIS IS A LIST AND NOT A COLUMN, which is the whole of the issue. The page
// used to put every invoice item under the ordered item it charged, and the facts
// on that dotted row belonged to two different records: the quantity, the price
// and `Invoice Items."Variance Flag"` are about the (invoice, ordered item) PAIR,
// while `Paid` and `Invoices."Variance Flag"` are about the INVOICE. Per-row
// placement rendered the second kind once per row an invoice charged, so one bill
// covering two ordered items said `Not paid` twice about one document. Folding to
// one entry per document puts each fact where its record is.
//
// IT DOES NOT MAKE THE PAGE SHORTER, AND EXPECTING THAT WOULD BE THE WRONG
// REASON TO DO IT. Three ordered items billed by two invoices is six pair-facts
// either way; what drops is the repetition of the header facts, from six to two.
// The pair facts are still listed per pair — inside the invoice's entry now
// instead of under the ordered item's row.
//
// EACH ENTRY NAMES THE ORDERED ITEMS IT TOUCHED, AND #232's REASON FOR NOT DOING
// SO DOES NOT REACH HERE. That issue keeps a delivery's orders off the INVOICE's
// page because the frame there is one invoice, and a delivery can carry bills
// this invoice has nothing to do with — so naming its orders shows orders outside
// the frame. The frame here is one ORDER, and only this order's ordered items are
// ever named, which is inside the frame by construction. What DOES carry over is
// the other half of that argument: a document may also have charged or filled
// orders elsewhere, so no entry may hold the document's own total. That is why an
// invoice entry has no `Amount Due` — a money figure beside a purchase order
// invites addition against the order's total, and one invoice can bill two
// orders. #167's `invoiceCaveat` exists because exactly that comparison misleads.
//
// A SETTLED OVER-DELIVERY LEAVES THE DELIVERY LIST, AND THAT IS THE ANSWER RATHER
// THAN AN OVERSIGHT. When #167's apply step re-points an over-delivery row onto
// the corrective order's ordered item, the original order keeps it only as
// `Former Delivery Items`, and this module walks the CURRENT `Delivery Items`
// link — so the arrival drops out of the original order's list. It has to: the
// `Delivered` column beside it reads `PO Items."Delivered Qty"`, which travels
// the same current link and drops by the same quantity. Measured on this base
// 2026-08-14, 53 of 53 ordered items: the rollup equals the sum over the current
// link exactly, with no contribution from `Former`. A list that kept the arrival
// while the column forgot it would be two answers to one question. The page holds
// `formerDeliveryItems` and could have used it; the story of where the excess
// went is #167's banner's, which is already on this page and names the corrective
// order, the delivery and the quantity.
//
// AN UNATTRIBUTABLE OVER-DELIVERY IS IN NO ORDER'S LIST AT ALL, said out loud so
// the silence is not read as a bug later. `Delivery Items."PO Item"` may be empty
// — the one case is an over-delivery allocation could not put on a single order
// (lib/airtable/deliveryItems.js states it) — and this walk reaches rows through
// that link, so such a slice is unreachable from every order. It is also absent
// from every `Delivered Qty`, so again the list and the column agree. The item
// axis still holds it through `Material`, which is where #162 left it.
//
// PURE, so the offline tier can hold it. The page does the credentialed reads and
// hands over records; the decision about whether to read the invoice level at all
// is the page's, because it is a decision about who is looking. `lib/format.js` is
// the one import and is pure itself, so the tier boundary holds.

import { formatUSD } from "./format.js";

/**
 * Sort keys, both descending, both matching the list each document has of its
 * own — a reader crossing from `/invoices` or `/deliveries` to an order should
 * not meet the same documents in a new order. `/invoices` sorts `Invoice ID`
 * descending server-side (`getAllInvoices`), and `Invoice ID` is a date plus a
 * zero-padded daily sequence, so a string sort is chronological.
 *
 * NOT `lib/overage.js:sortInvoicesOldestFirst`, AND THE TWO ARE NOT A DUPLICATION
 * TO MERGE. That one is `Issue Date` ascending and answers which bill CARRIES an
 * excess — the order the bills were raised in, because the oldest has the first
 * claim on a quantity. This one answers what a reader should see first in a
 * list of documents. One is an attribution rule with a consequence in the data,
 * the other is a display order with none; merging them would give one of the two
 * the wrong key.
 */
function byInvoiceIdDesc(a, b) {
    return (b.invoiceId || "").localeCompare(a.invoiceId || "");
}

/**
 * Newest arrival first, tie-broken by `Delivery ID`, undated LAST — the chain
 * `sortCandidates` and `sortHistoryRows` both use, and for the same reason: a
 * data gap must not take priority over a recorded date.
 */
function byReceivedDateDesc(a, b) {
    const da = a.receivedDate || "";
    const db = b.receivedDate || "";
    if (da !== db) {
        if (!da) return 1;
        if (!db) return -1;
        return db.localeCompare(da);
    }
    return (b.deliveryId || "").localeCompare(a.deliveryId || "");
}

/**
 * The ordered items this order holds, by record id, so a charge or an arrival can
 * name what it touched without the caller threading labels through.
 */
function orderedItemsById(orderedItems) {
    return new Map((orderedItems || []).map((o) => [o.id, o]));
}

/**
 * The invoices charging this order, one entry each.
 *
 * `invoiceItems` are the rows reached through this order's ordered items, so a
 * charge against some OTHER order never appears here even when the same invoice
 * carries it. An invoice item whose `PO Item` is not one of this order's is
 * dropped rather than grouped under a missing name — the same exclusion the
 * status axis makes for a row with no ordered item at all.
 */
export function foldInvoicesOnOrder({ orderedItems, invoiceItems, invoices } = {}) {
    const byId = orderedItemsById(orderedItems);
    const invoiceById = new Map((invoices || []).map((inv) => [inv.id, inv]));
    const entries = new Map();

    for (const item of invoiceItems || []) {
        const orderedItemRecordId = (item.poItem || [])[0] ?? null;
        const invoiceRecordId = (item.invoice || [])[0] ?? null;
        const orderedItem = orderedItemRecordId ? byId.get(orderedItemRecordId) : null;
        const invoice = invoiceRecordId ? invoiceById.get(invoiceRecordId) : null;
        if (!orderedItem || !invoice) continue;

        if (!entries.has(invoiceRecordId)) {
            entries.set(invoiceRecordId, {
                invoiceRecordId,
                invoiceId: invoice.invoiceId ?? null,
                vendorInvoiceCode: invoice.vendorInvoiceCode || "",
                issueDate: invoice.issueDate || "",
                varianceFlag: Boolean(invoice.varianceFlag),
                paid: Boolean(invoice.paid),
                paidDate: invoice.paidDate || "",
                charges: [],
            });
        }
        entries.get(invoiceRecordId).charges.push({
            orderedItemRecordId,
            itemName: orderedItem.itemName || "",
            size: orderedItem.size || "",
            unit: orderedItem.unit || "",
            qty: item.qty ?? 0,
            unitPrice: item.unitPrice ?? null,
            varianceFlag: Boolean(item.varianceFlag),
        });
    }

    // Charges in the order's own item order, so two invoices on one order read
    // their charges down the same axis the table above them uses.
    const position = new Map((orderedItems || []).map((o, i) => [o.id, i]));
    for (const entry of entries.values()) {
        entry.charges.sort((a, b) => position.get(a.orderedItemRecordId) - position.get(b.orderedItemRecordId));
    }

    return [...entries.values()].sort(byInvoiceIdDesc);
}

/**
 * The deliveries that filled this order, one entry each.
 *
 * `overDelivered` is folded UP from the slices: a delivery is marked when any
 * slice it brought against THIS order is flagged. The mark answers a question the
 * `Undelivered` column cannot — that column says an ordered item is over, this
 * says which arrival brought the excess — so it is a second answer rather than a
 * second rendering of one fact.
 */
export function foldDeliveriesOnOrder({ orderedItems, deliveryItems, deliveries } = {}) {
    const byId = orderedItemsById(orderedItems);
    const deliveryById = new Map((deliveries || []).map((d) => [d.id, d]));
    const entries = new Map();

    for (const item of deliveryItems || []) {
        const orderedItemRecordId = (item.poItem || [])[0] ?? null;
        const deliveryRecordId = (item.delivery || [])[0] ?? null;
        const orderedItem = orderedItemRecordId ? byId.get(orderedItemRecordId) : null;
        const delivery = deliveryRecordId ? deliveryById.get(deliveryRecordId) : null;
        if (!orderedItem || !delivery) continue;

        if (!entries.has(deliveryRecordId)) {
            entries.set(deliveryRecordId, {
                deliveryRecordId,
                deliveryId: delivery.deliveryId ?? null,
                receivedDate: delivery.receivedDate || "",
                overDelivered: false,
                brought: [],
            });
        }
        const entry = entries.get(deliveryRecordId);
        if (item.overDelivered) entry.overDelivered = true;
        entry.brought.push({
            orderedItemRecordId,
            itemName: orderedItem.itemName || "",
            size: orderedItem.size || "",
            unit: orderedItem.unit || "",
            qty: item.qty ?? 0,
        });
    }

    const position = new Map((orderedItems || []).map((o, i) => [o.id, i]));
    for (const entry of entries.values()) {
        entry.brought.sort((a, b) => position.get(a.orderedItemRecordId) - position.get(b.orderedItemRecordId));
    }

    return [...entries.values()].sort(byReceivedDateDesc);
}

// ---------------------------------------------------------------------------
// Copy
//
// #166's vocabulary: `delivered`, never `arrived`; `ordered item`, never `line`;
// `delivery`, never `shipment`; facts rather than verdicts. It lives in a
// `*_COPY` constant rather than in the page's JSX so that
// `offline/line-vocabulary.mjs` can see it — that check walks copy constants and
// cannot read text written straight into a component, which is how the row this
// replaces came to carry a `⚠ Line Variance` badge nobody's sweep could find.
//
// TWO VARIANCE WORDS, AND ONLY ONE OF THEM CHANGED. `Invoice Items."Variance
// Flag"` is this charge against what the order agreed, and it now reads the bare
// `⚠ Variance` the invoice detail's items table already uses for that same field
// — the page said `⚠ Line Variance`, which put the word this repository reserves
// for a Job's `Lines` row into new screen text, and #227's sweep cannot see text
// written straight into JSX.
//
// `Invoices."Variance Flag"` KEPT `⚠ Header Variance`, WHICH IS NOT AN
// ENDORSEMENT OF THE WORD. The invoice detail says exactly that today, so
// inventing a better one here would give one flag two screen words and add the
// drift #179 exists to remove — and #179's body has already chosen the
// replacements (`Total mismatch` and `Over-billed`), which are neither this word
// nor anything this issue would have coined. Changing both pages at once is that
// issue's, so this one leaves the word where it found it.

export const PO_DOCUMENTS_COPY = {
    invoices: {
        heading: "Invoices",
        /** Nothing has billed this order. The ordinary state of a fresh order. */
        empty: () => ({
            key: "no-invoices",
            text: "No invoice charges this order yet.",
        }),
        /**
         * One charge: what this invoice billed against one of this order's items.
         *
         * The price goes through `formatUSD`, the formatter every other money
         * figure on this page and on the invoice detail's items table already
         * uses. It is a pure module — one `Intl.NumberFormat` and no imports — so
         * importing it keeps this one offline-safe.
         */
        charge: (f) => ({
            key: "invoice-charge",
            text:
                `${itemLabel(f)} — ${f?.qty ?? 0}${f?.unit ? ` ${f.unit}` : ""}` +
                `${typeof f?.unitPrice === "number" ? ` @ ${formatUSD(f.unitPrice)}` : ""}`,
        }),
    },
    deliveries: {
        heading: "Deliveries",
        empty: () => ({
            key: "no-deliveries",
            text: "Nothing has been delivered against this order yet.",
        }),
        /** One arrival's contribution to one of this order's ordered items. */
        brought: (f) => ({
            key: "delivery-brought",
            text: `${itemLabel(f)} — ${f?.qty ?? 0}${f?.unit ? ` ${f.unit}` : ""}`,
        }),
    },
    /**
     * The badges. Words rather than components, so the same guard reads them; the
     * page decides their color, exactly as it does for the table's `(over)`.
     *
     * THE TWO VARIANCE BADGES LEFT IN #179 and are `lib/variance.js:VARIANCE_COPY`
     * now. They are invoice facts that happen to be rendered on an order's page, and
     * they read the same on the invoice list and the invoice detail — a word with
     * two homes is what that issue exists to remove, and this module was the second
     * home.
     */
    badge: {
        paid: (f) => (f?.paidDate ? `✓ Paid ${f.paidDate}` : "✓ Paid"),
        notPaid: "Not paid",
        overDelivered: "Over-delivered",
    },
};

/**
 * `Item Name Size`, the pair every items table on this base prints side by side.
 * Size is optional on a PO Item, so a blank one leaves no trailing space.
 */
function itemLabel(f) {
    return [f?.itemName, f?.size].filter(Boolean).join(" ") || "That item";
}
