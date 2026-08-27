// The two document lists an order's own page carries (#233): which invoices
// charge it, and which deliveries filled it.
//
// WHY THIS IS A LIST AND NOT A COLUMN, which is the whole of the issue. The page
// used to put every invoice item under the ordered item it charged, and the facts
// on that dotted row belonged to two different records: the quantity, the price
// and `Invoice Items."Variance Flag"` are about the (invoice, ordered item) PAIR,
// while `Paid` and `Invoices."Variance Flag"` are about the INVOICE. Per-row
// placement rendered the second kind once per row an invoice charged, so one invoice
// covering two ordered items said `Not paid` twice about one document. Folding to
// one entry per document puts each fact where its record is.
//
// IT DOES NOT MAKE THE PAGE SHORTER, AND EXPECTING THAT WOULD BE THE WRONG
// REASON TO DO IT. Three ordered items invoiced by two invoices is six pair-facts
// either way; what drops is the repetition of the header facts, from six to two.
// The pair facts are still listed per pair — inside the invoice's entry now
// instead of under the ordered item's row.
//
// EACH ENTRY NAMES THE ORDERED ITEMS IT TOUCHED, AND #232's REASON FOR NOT DOING
// SO DOES NOT REACH HERE. That issue keeps a delivery's orders off the INVOICE's
// page because the frame there is one invoice, and a delivery can carry invoices
// this invoice has nothing to do with — so naming its orders shows orders outside
// the frame. The frame here is one ORDER, and only this order's ordered items are
// ever named, which is inside the frame by construction. What DOES carry over is
// the other half of that argument: a document may also have charged or filled
// orders elsewhere, so no entry may hold the document's own total. That is why an
// invoice entry has no `Amount Due` — a money figure beside a purchase order
// invites addition against the order's total, and one invoice can charge two
// orders. #167's `invoiceCaveat` exists because exactly that comparison misleads.
//
// A SETTLED OVER-DELIVERY LEAVES THE DELIVERY LIST, AND THAT IS THE ANSWER RATHER
// THAN AN OVERSIGHT. When #167's apply step re-points an over-delivery row onto
// the overage order's ordered item, the original order keeps it only as
// `Former Delivery Items`, and this module walks the CURRENT `Delivery Items`
// link — so the delivery drops out of the original order's list. It has to: the
// `Delivered` column beside it reads `PO Items."Delivered Qty"`, which travels
// the same current link and drops by the same quantity. Measured on this base
// 2026-08-14, 53 of 53 ordered items: the rollup equals the sum over the current
// link exactly, with no contribution from `Former`. A list that kept the delivery
// while the column forgot it would be two answers to one question. The page holds
// `formerDeliveryItems` and could have used it; the story of where the excess
// went is #167's banner's, which is already on this page and names the overage
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
// A CHILD LIST IS ONE ENTRY PER ORDERED ITEM, WHICH IT SAID BEFORE IT WAS (#266).
// Both lists rendered one line per stored row, and two rows reaching one ordered
// item is the shape every over-delivery writes: `planDelivery` attaches the excess
// to the last ordered item the delivery filled, so the within piece and the excess
// name the same one. Two lines for one material under one delivery, and the
// ordered item's record id — the React key — printed twice.
//
// THE DELETE PATH IS THE SECOND PRODUCER, AND IT IS WHY THE FOLD IS NOT AN
// OVER-DELIVERY FEATURE. `recomputeOverDelivery` splits a straddling row and
// lib/deliveryDelete.js creates the new piece on the SAME delivery and the SAME
// ordered item, so one delivery can hold two flagged rows against one ordered item
// — the `6, 6, 6` case that module describes — and, once a deletion frees room, two
// UNFLAGGED rows against one. So an excess figure sums the flagged members rather
// than reading one of them, and a folded row with nothing flagged says nothing
// about excess at all.
//
// THE KEYS ARE DIFFERENT ON THE TWO AXES, AND NEITHER IS `Material`. A `PO Items`
// row links exactly one purchase order and exactly one material, so #238's
// `Material` + ORDER fuses here into the ordered item alone — the same question that
// issue answers, in a frame that hands it one record instead of two. It lands
// STRICTLY FINER than folding on the material would, which this page needs: one
// order can carry two ordered items of one material, and this list names and sorts
// by the ordered item. The invoice axis adds the UNIT PRICE, which is
// lib/invoiceItemFold.js's key at this scope — two invoice items at different
// prices are two facts and stay two rows, so a folded one's `@ price` is exact
// by construction and has nothing new to say about a price that differs.
//
// WHAT REACHES THE INVOICE AXIS IS HAND-ENTERED DATA, NOT #167's SPLIT, and the
// issue reached for the wrong producer. That split re-points the excess onto the
// OVERAGE order's ordered item, and this walk admits only rows whose `PO Item` is
// one of THIS order's — so each order's page sees exactly one half and never both.
// The invoice form cannot make the shape either: #91 excludes an ordered item a
// sibling invoice item already claimed. That leaves a record edited by hand, which
// this base carries by design, and it is the same ground #241 states for the same
// shape one screen away.
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
 * TO MERGE. That one is `Issue Date` ascending and answers which invoice CARRIES an
 * excess — the order the invoices were raised in, because the oldest has the first
 * claim on a quantity. This one answers what a reader should see first in a
 * list of documents. One is an attribution rule with a consequence in the data,
 * the other is a display order with none; merging them would give one of the two
 * the wrong key.
 */
function byInvoiceIdDesc(a, b) {
    return (b.invoiceId || "").localeCompare(a.invoiceId || "");
}

/**
 * Newest delivery first, tie-broken by `Delivery ID`, undated LAST — the chain
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
 * The ordered items this order holds, by record id, so an invoice item or a
 * delivery can name what it touched without the caller threading labels through.
 */
function orderedItemsById(orderedItems) {
    return new Map((orderedItems || []).map((o) => [o.id, o]));
}

/**
 * One invoice item's fold key: the ordered item it charges, plus the unit price.
 *
 * `lib/invoiceItemFold.js:foldKey` AT THIS SCOPE, with the ordered item where that
 * one has `Material` — an invoice item here is listed and sorted under an ordered
 * item, and
 * one order can carry two ordered items of one material, so the material is too
 * coarse an identity for this list. The price is normalized the way that module
 * normalizes it, because `null` and `0` are different prices and a missing one is
 * neither.
 */
function chargeKey(orderedItemRecordId, unitPrice) {
    return `poi::${orderedItemRecordId}::${unitPrice ?? ""}`;
}

/**
 * The invoices charging this order, one entry each, and one invoice item per
 * ordered item and price within an entry.
 *
 * `invoiceItems` are the rows reached through this order's ordered items, so a
 * invoice item on some OTHER order never appears here even when the same invoice
 * carries it. An invoice item whose `PO Item` is not one of this order's is
 * dropped rather than grouped under a missing name — the same exclusion the
 * status axis makes for a row with no ordered item at all.
 *
 * `qty` sums the members and `varianceFlag` is true when ANY of them carries it,
 * which is `foldInvoiceItems`' rule and its reason: the question a reader asks of a
 * folded invoice item is whether something is wrong with it, not which half.
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
                charges: new Map(),
            });
        }
        const charges = entries.get(invoiceRecordId).charges;
        const unitPrice = item.unitPrice ?? null;
        const key = chargeKey(orderedItemRecordId, unitPrice);
        const existing = charges.get(key);

        if (existing) {
            existing.qty += item.qty ?? 0;
            existing.varianceFlag = existing.varianceFlag || Boolean(item.varianceFlag);
        } else {
            charges.set(key, {
                key,
                orderedItemRecordId,
                itemName: orderedItem.itemName || "",
                size: orderedItem.size || "",
                unit: orderedItem.unit || "",
                qty: item.qty ?? 0,
                unitPrice,
                varianceFlag: Boolean(item.varianceFlag),
            });
        }
    }

    // Charges in the order's own item order, so two invoices on one order read
    // their charges down the same axis the table above them uses. Two prices on one
    // ordered item are two invoice items and tie here; first appearance breaks the tie,
    // which is `Invoice Item ID` order, so a fold never reorders what a reader saw.
    const position = new Map((orderedItems || []).map((o, i) => [o.id, i]));
    return [...entries.values()]
        .map((entry) => ({
            ...entry,
            charges: [...entry.charges.values()].sort(
                (a, b) => position.get(a.orderedItemRecordId) - position.get(b.orderedItemRecordId)
            ),
        }))
        .sort(byInvoiceIdDesc);
}

/**
 * The deliveries that filled this order, one entry each, and one line per ordered
 * item within an entry.
 *
 * THE KEY IS THE ORDERED ITEM AND NOTHING ELSE, which is #238's `Material` + ORDER
 * with both components resolved by one record: a `PO Items` row links exactly one
 * purchase order and exactly one material. That makes it strictly finer than folding
 * on the material, and this list needs the finer of the two — one order can hold two
 * ordered items of one material, and each is a line of its own here, named and
 * ordered by the table above.
 *
 * `qty` sums every member so a material that arrived once reads as one line.
 * `overQty` sums only the FLAGGED members, because a folded row holds the within
 * piece and the excess together and one delivery can carry two flagged rows against
 * one ordered item (lib/deliveryDelete.js's `6, 6, 6`). It is 0 on a line with
 * nothing flagged, which is every line of an ordinary delivery and also the two
 * unflagged rows a deletion can leave on one ordered item — so the fold is not an
 * over-delivery feature and says nothing about excess where there is none.
 *
 * `overDelivered` is folded UP from the slices: a delivery is marked when any
 * slice it brought against THIS order is flagged. The mark answers a question the
 * `Delivered` column cannot — that column says an ordered item is over, this
 * says which delivery brought the excess — so it is a second answer rather than a
 * second rendering of one fact. It stays beside the document while `overQty` says
 * which line and how much, the relation #238 keeps between its headline tag and its
 * table. Both are accumulated over the one loop below, so they cannot disagree.
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
                brought: new Map(),
            });
        }
        const entry = entries.get(deliveryRecordId);
        if (item.overDelivered) entry.overDelivered = true;

        const existing = entry.brought.get(orderedItemRecordId);
        if (existing) {
            existing.qty += item.qty ?? 0;
            if (item.overDelivered) existing.overQty += item.qty ?? 0;
        } else {
            entry.brought.set(orderedItemRecordId, {
                key: orderedItemRecordId,
                orderedItemRecordId,
                itemName: orderedItem.itemName || "",
                size: orderedItem.size || "",
                unit: orderedItem.unit || "",
                qty: item.qty ?? 0,
                overQty: item.overDelivered ? item.qty ?? 0 : 0,
            });
        }
    }

    const position = new Map((orderedItems || []).map((o, i) => [o.id, i]));
    return [...entries.values()]
        .map((entry) => ({
            ...entry,
            brought: [...entry.brought.values()].sort(
                (a, b) => position.get(a.orderedItemRecordId) - position.get(b.orderedItemRecordId)
            ),
        }))
        .sort(byReceivedDateDesc);
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
// TWO VARIANCE WORDS, AND ONLY ONE OF THEM CHANGED IN #233. `Invoice
// Items."Variance Flag"` is this item against what the order agreed, and this page
// stopped coining a word for it — the page had said `⚠ Line Variance`, which put
// the word this repository reserves for a Job's `Lines` row into new screen text,
// and #227's sweep cannot see text written straight into JSX.
//
// BOTH WORDS ARE `lib/variance.js:VARIANCE_COPY` NOW AND THIS BLOCK NAMED NEITHER.
// It said the item flag read the bare `⚠ Variance`, that `Invoices."Variance Flag"`
// kept `⚠ Header Variance` and that the invoice detail said exactly that, and that
// #179 had already chosen `Total mismatch` and `Over-billed` as replacements. Each
// was true when written and none is now: #179 gave the pair `⚠ Order variance` and
// #254 replaced the header word with `⚠ Check the total`, while #179 rejected
// `Mismatch` outright rather than choosing it, because #232 owns that word on the
// delivery axis of these same two screens. Corrected per #181 by #303, which was
// sweeping the noun in the paragraph above. WHAT SURVIVES IS THE REASON THIS PAGE
// COINS NEITHER WORD: the invoice detail says both of them, so a second wording
// here would give one flag two screen words. They change together or not at all.
//
// `charge` AND `brought` KEEP THEIR NAMES WHILE THE NOUN MOVES (#303), and the
// pair is the reason. That issue made an `Invoice Items` row an `invoice item` and
// swept `charge` out of the prose here, but `invoices.charge` / `deliveries.brought`
// — with `invoice-charge` / `delivery-brought` under them and `entry.charges` /
// `entry.brought` behind those — name what each DOCUMENT did to this order, not the
// rows it did it with. `brought` is a past-tense verb and has no noun counterpart,
// so renaming its twin to `item` would break a matched pair and claim the array
// holds this order's items when it holds one invoice's charges against them.
// `lib/deliveryAllocation.js:plan.over` is the same shape one axis over.

export const PO_DOCUMENTS_COPY = {
    invoices: {
        heading: "Invoices",
        /** Nothing has invoiced this order. The ordinary state of a fresh order. */
        empty: () => ({
            key: "no-invoices",
            text: "No invoice charges this order yet.",
        }),
        /**
         * One invoice item: what this invoice charges against one of this order's
         * ordered items.
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
        /**
         * What one delivery brought against one of this order's ordered items, every
         * slice of it added (#266).
         *
         * THE EXCESS FIGURE IS NOT HERE AND THAT IS DELIBERATE. `(N over)` already
         * exists as `lib/deliveryAllocation.js:ALLOCATION_COPY.table.overPortion`,
         * which the delivery detail's own folded row prints for the same fact one
         * frame down; restating it here would give one word a second home, which is
         * what #179 exists to remove. The page appends it, in its own element,
         * because only the excess is colored.
         */
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
