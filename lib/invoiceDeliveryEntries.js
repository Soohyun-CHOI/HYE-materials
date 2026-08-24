// One material, one entry, in an invoice's delivery section (#241).
//
// THE SECTION LISTED ONE ENTRY PER `Invoice Items` ROW WHILE THE ITEMS TABLE ABOVE
// IT FOLDED, so an invoice whose charge an overage split divided showed one material
// twice under the delivery and once in the table. #232 had left a normal entry
// silent, so the two carried the same name and nothing else, and the reason there
// were two — an overage order exists — is an order fact that #232 removed from this
// section and #237 gave to `Purchase Orders`. The count still said it.
//
// WHAT COUNTS AS ONE ITEM ON THIS PAGE IS `lib/invoiceItemFold.js` AND IS NOT DECIDED
// AGAIN HERE. That module owns the key (`Material` + unit price) and states its
// grouping as `rowIds`; this one joins those record ids back to the reconciliation
// rows the page already holds — the same join #237 makes, on the same field, for the
// same reason: a rule stated over raw rows would disagree with the table a reader is
// looking at.
//
// THE FOLD IS FOR THE READER, NEVER FOR THE JUDGMENT, AND THE ORDER OF THOSE TWO IS
// THE WHOLE DESIGN. A share is CLAMPED at what its invoice invoiced
// (`invoiceShareStatus`), and that clamp is per invoice per ordered item: a delivery may
// legitimately bring more of an ordered item than this invoice charges, and that
// surplus is the delivery axis's fact rather than this invoice's. So a folded entry ADDS
// the shares its members already carry and never re-derives one from summed inputs.
// Re-clamping at the folded scope would:
//
//   - let a surplus on one ordered item cancel a shortfall on another, which is
//     exactly what the per-pair clamp exists to prevent one level down; and
//   - disagree with the chip. `summarizeInvoiceStatus` reads the same per-row shares
//     — on this page AND on `/invoices`, where no fold is computed at all — so a
//     folded entry judged on its own arithmetic could leave the amber sentence
//     standing above a list with nothing in it that points anywhere. #232's whole
//     shape rests on the chip and the entries saying one thing.
//
// THE TWO BEYOND-ORDER TERMS ARE THE EXCEPTION, AND THEY ADD OVER DISTINCT ORDERED
// ITEMS. `invoicedBeyondOrder` and `deliveredBeyondOrder` belong to a `PO Items` row
// rather than to an invoice, so two charges against ONE ordered item carry the same
// figure and adding both would print one excess twice. The invoice form cannot make
// that shape — #91 excludes an ordered item a sibling invoice item already claimed —
// so this is defensive against hand-entered data, which this base carries by design.
//
// A SILENT ENTRY HAS NO PLACE (#241). Folded, a list of every item is the name column
// of the items table directly above it: same count, same names, same order. #232
// settled that the invoice level states what the state is and the item level points
// at an exception; before the fold this list was not that copy, and the fold is what
// makes it one. So only an entry with something to say is returned, and an invoice
// where everything agrees renders no list — the delivery, named once, is the section.
//
// NOTHING WITHOUT A MATCHED DELIVERY, WHICH IS #232's RULE AND IS PASSED IN RATHER
// THAN DERIVED. With nothing matched there is no second term to compare against, so
// the section says that once and shows no entries at all. A share with
// `delivered: 0` cannot tell "nothing is matched" from "the matched delivery brought
// none of this", so the caller states which it is.
//
// AN ENTRY CARRIES ONE TONE AND ITS NAME WEARS IT TOO. The name and the sentence under
// it are one statement, and with only exceptions in the list a black name over an amber
// sentence left the color attached to nothing a reader could name — worse with several,
// where black and amber alternate down the page. The tone is the verdict's
// (`lib/deliveryStatus.js`); an entry that speaks ONLY through the order-scoped aside
// has no verdict to read and is `exception`, since something exceeding an ordered item
// is what put it in a list that holds nothing else. The aside itself stays uncolored:
// it is a fact about the ordered item rather than about this invoice, which is #232's
// distinction and is untouched here.
//
// #278 TOOK THE SECOND TONE OUT OF THIS LIST. A charge with no ordered item behind it
// took `unjudged` and made this list's own distinction — gray says nothing was
// measured, amber says something is wrong — and that charge is not a state this app
// has. Every entry here is an exception now, which is what #232 said the list was for
// and what the fold made true; the gray half was the one member of it that was not.
//
// THE NAME COMES FROM THE INVOICE ITEM, NOT THE ORDERED ITEM, WHICH REVERSES WHAT THE
// WALK DOES. `getInvoiceReconciliation` labels a row from the `PO Items` row it
// compares against; a folded entry can span two of those, so there is no single one
// to name — the same fact that makes the items table's `PO` column impossible (#167).
// It takes the fold group's frozen copy instead, the source #237 chose, so the entry
// and the row above it cannot disagree.
//
// Pure: it applies `lib/deliveryStatus.js`'s copy but authors none, and reaches no
// credentialed module. `scripts/tests/offline/invoice-delivery-entries.mjs` pins it.

import { describeInvoiceItem } from "./deliveryStatus.js";

/**
 * The share for one folded entry: its members' shares, added.
 *
 * `members` are reconciliation rows, every one of which carries a status since
 * #278 — the walk builds no unjudged row. Returns null only for an empty member
 * list, which `invoiceDeliveryEntries` already refuses; it stayed a total function
 * rather than gaining a throw, because that is what its callers were written
 * against.
 *
 * The four invoice-scoped fields add per member. The two order-scoped ones add over
 * DISTINCT `PO Item`s — see the header.
 */
export function foldedEntryShare(members) {
    const judged = (members || []).filter((m) => m?.status);
    if (judged.length === 0) return null;

    const share = {
        invoiced: 0,
        delivered: 0,
        invoicedNotDelivered: 0,
        deliveredNotInvoiced: 0,
        deliveredBeyondOrder: 0,
        invoicedBeyondOrder: 0,
    };
    const countedOrderedItems = new Set();

    for (const member of judged) {
        share.invoiced += member.status.invoiced || 0;
        share.delivered += member.status.delivered || 0;
        share.invoicedNotDelivered += member.status.invoicedNotDelivered || 0;
        share.deliveredNotInvoiced += member.status.deliveredNotInvoiced || 0;

        // An ordered item's own excess, once however many charges reach it.
        if (countedOrderedItems.has(member.poItemId)) continue;
        countedOrderedItems.add(member.poItemId);
        share.deliveredBeyondOrder += member.status.deliveredBeyondOrder || 0;
        share.invoicedBeyondOrder += member.status.invoicedBeyondOrder || 0;
    }

    return share;
}

/**
 * How many ordered items one folded entry covers — what the order-scoped
 * sentence's subject agrees with, and the same set its two figures were added
 * over.
 */
export function orderedItemsCovered(members) {
    return new Set(
        (members || []).filter((m) => m?.status).map((m) => m.poItemId)
    ).size;
}

/**
 * The entries the delivery section renders, in the invoice's own item order.
 *
 * `folded` is `foldInvoiceItems`'s output and `rows` `getInvoiceReconciliation`'s;
 * they are joined on the invoice item's record id, so a `rowIds` entry with no row
 * contributes nothing rather than a blank member. `hasDelivery` is the invoice's
 * pairing, not anything read off a share.
 *
 * ONLY ENTRIES WITH SOMETHING TO SAY COME BACK, each carrying the copy it says it
 * with, so "a silent entry has no place" is a rule this module holds rather than a
 * condition written into a page the offline tier cannot read.
 */
export function invoiceDeliveryEntries({ folded, rows, hasDelivery = false } = {}) {
    if (!hasDelivery) return [];

    const rowById = new Map((rows || []).filter(Boolean).map((row) => [row.id, row]));

    return (folded || [])
        .filter(Boolean)
        .map((group) => {
            const members = (group.rowIds || [])
                .map((rowId) => rowById.get(rowId))
                .filter(Boolean);
            // A group none of whose rows resolved is not an item this page can say
            // anything about. Reachable since #278 in one way it was not before: the
            // walk drops a row whose ordered item is gone rather than giving it a
            // row of its own, so a fold group can lose every member. Left out, which
            // is what it already did.
            if (members.length === 0) return null;
            const status = foldedEntryShare(members);
            const orderedItemCount = orderedItemsCovered(members);
            const copy = describeInvoiceItem(status, group.unit || "", {
                hasDelivery,
                orderedItemCount,
            });

            return {
                key: group.key,
                itemName: group.itemName || "",
                size: group.size || "",
                unit: group.unit || "",
                status,
                orderedItemCount,
                copy,
                // The verdict's, or `exception` where there is no verdict — which is
                // an entry the order-scoped aside alone put in the list. See the
                // header; the page turns this into a color and nothing else does.
                tone: copy.verdict?.tone ?? "exception",
            };
        })
        .filter((entry) => entry && (entry.copy.verdict || entry.copy.againstOrder));
}
