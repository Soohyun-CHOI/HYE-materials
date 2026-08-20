// The credentialed half of #210's pairing: which invoices a delivery may name, and
// the guarded write that pairs them.
//
// TWO MODULES FOR ONE RULE, THE ARRANGEMENT #167 USES. The judgment and every
// sentence live in lib/deliveryInvoiceLink.js, which is pure because the entry form
// imports it; this file is what reaches Airtable, so neither the offline tier nor
// any Client Component may import it — an import is an execution, and
// lib/airtable/client.js throws `Missing AIRTABLE_API_KEY` at module load.
//
// THE SCOPE GATE IS `canViewPR`, REACHED THROUGH lib/invoiceVisibility.js, AND THAT
// IS NOT A CHOICE. A dropdown of invoice numbers is a surface that shows invoices,
// so it gates per record rather than per role — and by calling the one rule rather
// than writing a comparison of its own. The tempting shortcut was "an invoice
// billing a purchase order in this job's candidate set", which is free because
// getDeliveryCandidates already holds those orders; it is also a SECOND answer to
// the visibility question, and it would disagree with the first one — `canViewPR`
// also admits a requester, a signer and the recipient of a correction request,
// none of whom need a Job assignment.
//
// THE READ IS PAID FOR BY THE AUDIENCE THAT NEEDS IT, the shape app/invoices/page.js
// already has: a President or an Admin sees every invoice, so their answer needs no
// Invoice Items, no orders and no requests. Measured budgets are in the two callers.
//
// THE GUARD RUNS AGAIN ON WRITE, FROM A FRESH READ. A Server Action is callable
// directly, so the dropdown having rendered proves nothing; and an invoice can be
// paired with another delivery while the form sits open, which is exactly the
// refusal `taken-by-another` exists for.

import { getAllInvoices, getInvoicesByRecordIds, setInvoiceDelivery } from "./airtable/invoices";
import { getInvoiceItemsByRecordIds } from "./airtable/invoiceItems";
import { getDeliveriesByRecordIds } from "./airtable/deliveries";
import { getDeliveryItemsByRecordIds } from "./airtable/deliveryItems";
import { getPOItemsByRecordIds } from "./airtable/poItems";
import { getVisibleInvoiceIds, seesEveryInvoice } from "./invoiceVisibility";
import { canAccessJobDeliveries } from "./deliveryAccess";
import {
    LINK_REFUSED,
    describeLinkRefusal,
    invoiceLinkRefusal,
    linkedDelivery,
} from "./deliveryInvoiceLink";
import { invoiceFromOption } from "./deliveryInvoiceMatch";

/**
 * The invoices this user may offer for a delivery from one of these vendors.
 *
 * `vendorRecordIds` narrows before anything is walked, which is what keeps the
 * batched reads small: on the entry page it is every vendor the selected jobs
 * ordered from, and the form narrows again to the one chosen. An empty list costs
 * one query and returns nothing.
 *
 * Each option carries `linkedDeliveryRecordId` when some delivery already holds it,
 * and `linkedDeliveryId` only when the viewer may reach that delivery — a delivery
 * is Job-scoped and an invoice can bill two jobs, so the holder is not always in
 * view, and naming it then would confirm a record outside someone's scope.
 */
export async function getInvoiceLinkCandidates(user, { vendorRecordIds } = {}) {
    const vendors = new Set((vendorRecordIds || []).filter(Boolean));
    if (vendors.size === 0) return [];

    const all = await getAllInvoices();
    const relevant = all.filter((inv) => vendors.has((inv.vendor || [])[0]));
    if (relevant.length === 0) return [];

    // #231 — READ UNCONDITIONALLY NOW, WHERE THE OFFICE USED TO SKIP THIS LEVEL.
    // It was fetched only to answer the row gate, which a President or an Admin
    // passes without it; the computed pairing needs the ordered items every invoice
    // charges against, and that is the same level. So the office pays one batched
    // read it did not before — measured as a page figure in this issue's PR — and
    // the walk below still costs nothing for a viewer who sees everything.
    const items = await getInvoiceItemsByRecordIds(
        relevant.flatMap((inv) => inv.invoiceItems || [])
    );
    // Still called unconditionally: it short-circuits for a President or an Admin
    // itself (lib/invoiceVisibility.js), so branching here would be a second copy of
    // that rule sitting one call above the first.
    const visibleIds = await getVisibleInvoiceIds(user, relevant, items);
    const visible = relevant.filter((inv) => visibleIds.has(inv.id));

    // What each invoice charges against, keyed by its parent. `Item Name` text is
    // never the key — #18's ordered item is, exactly as allocation matches on
    // `Material` rather than on the words a vendor wrote.
    const chargedByInvoice = new Map();
    for (const item of items) {
        const parent = (item.invoice || [])[0];
        const poItemRecordId = (item.poItem || [])[0] ?? null;
        if (!parent || !poItemRecordId) continue;
        if (!chargedByInvoice.has(parent)) chargedByInvoice.set(parent, []);
        // `qty` costs nothing to carry — these records were read for the ordered
        // item anyway — and it is what lets the matcher ask how much of a delivery
        // an invoice already on it has claimed. Not a quantity MATCH: see
        // lib/deliveryInvoiceMatch.js:roomOnOrderedItem for why the two differ.
        chargedByInvoice.get(parent).push({
            poItemRecordId,
            qty: item.qty,
            unitPrice: item.unitPrice,
        });
    }

    // One batched read over the deliveries already holding one of these invoices.
    // findByRecordIds returns early on an empty list, so a base where nothing is
    // paired yet pays nothing here.
    const holders = await getDeliveriesByRecordIds([
        ...new Set(visible.map(linkedDelivery).filter(Boolean)),
    ]);
    const holderById = new Map(holders.map((d) => [d.id, d]));

    return visible.map((inv) => {
        const heldBy = linkedDelivery(inv);
        const holder = heldBy ? holderById.get(heldBy) ?? null : null;
        return {
            invoiceRecordId: inv.id,
            invoiceId: inv.invoiceId,
            // The vendor's own number, which is what the packing list carries and
            // therefore what the label leads with.
            vendorInvoiceCode: inv.vendorInvoiceCode || "",
            issueDate: inv.issueDate || "",
            vendorRecordId: (inv.vendor || [])[0] ?? null,
            linkedDeliveryRecordId: heldBy,
            linkedDeliveryId:
                holder && canAccessJobDeliveries(user, (holder.job || [])[0])
                    ? holder.deliveryId
                    : null,
            // #231 — what this invoice charges against, which is what places it on a
            // delivery. The matcher reads it through
            // lib/deliveryInvoiceMatch.js:invoiceFromOption rather than
            // directly, so this option keeps ONE vocabulary — the dropdown's — and
            // the pure rule keeps its own. No field here is repeated under a second
            // name for the matcher's benefit.
            orderedItems: chargedByInvoice.get(inv.id) || [],
        };
    });
}

/**
 * #231 — THE SAME PAIRING READ FROM THE OTHER END: the deliveries an invoice being
 * entered could describe, plus everything lib/deliveryInvoiceMatch.js needs to
 * choose between them.
 *
 * Here because the rule is the same rule. #210's module owns the gated read and the
 * guarded write for `Invoices."Delivery"`, and "which deliveries may this invoice name"
 * is that question from the invoice's side — a module of its own would be a second
 * home for one rule under a name nobody could tell from this one at a glance.
 *
 * THE INVOICE POOL COMES FROM `getInvoiceLinkCandidates` ABOVE, WHICH IS THE WHOLE
 * POINT. The rival clause has to see what it sees on the delivery form, or the same
 * two documents would pair or not pair depending on which was typed in first. Going
 * through the one function rather than assembling a second pool is what makes that
 * a property of the code instead of two call sites happening to agree.
 *
 * THE READS, and every one of them returns early on an empty id list:
 *
 *   1  PO Items      (the billed ordered items — their agreed price, and which
 *                     `Delivery Items` hang off them)
 *   2  Delivery Items (those slices, for the deliveries they belong to)
 *   3  Deliveries     (those deliveries — vendor, label, Job, full item arrays)
 *   4  Delivery Items (each candidate delivery's FULL set, so the delivery handed to
 *                      the matcher is the same shape the delivery form hands it)
 *   5+ getInvoiceLinkCandidates (the vendor's bills, ≤3)
 *
 * AN INVOICE WHOSE ORDERED ITEMS HAVE NOT DELIVERED COSTS ONE OPERATION, and that is the
 * ordinary case rather than the optimized one: the vendor emails the invoice when
 * the material ships, so the invoice is normally entered before the packing list
 * exists. Measured on this base 2026-08-13, 6 of 13 unpaired invoices have no
 * candidate delivery at all. Step 2's id list is empty for them, so 3, 4 and the
 * invoice pool are never reached.
 *
 * Step 4 buys shape rather than an answer — containment would compute the same
 * from step 2's partial set. It is paid because a partially-filled field named for
 * the whole is exactly the latent divergence between the two directions that this
 * pairing must not have.
 */
export async function getDeliveriesForInvoice(user, { vendorRecordId, orderedItems } = {}) {
    const empty = { deliveries: [], invoices: [], agreedPrices: new Map() };
    const billed = [...new Set((orderedItems || []).map((o) => o.poItemRecordId).filter(Boolean))];
    if (!vendorRecordId || billed.length === 0) return empty;

    const poItems = await getPOItemsByRecordIds(billed);
    const agreedPrices = new Map(poItems.map((p) => [p.id, p.unitPrice]));

    const touchingSlices = await getDeliveryItemsByRecordIds(
        poItems.flatMap((p) => p.deliveryItems || [])
    );
    const deliveries = await getDeliveriesByRecordIds([
        ...new Set(touchingSlices.map((s) => (s.delivery || [])[0]).filter(Boolean)),
    ]);

    // Vendor is the semantic narrowing, exactly as it is for the dropdown; the Job
    // is the scope. An Admin passes `canAccessJobDeliveries` on every Job, so this
    // narrows nothing on today's Admin-only invoice path — it is here because the
    // answer is rendered back with a delivery on it, and a surface that names a
    // delivery asks that question rather than assuming it.
    const candidates = deliveries.filter(
        (d) =>
            (d.vendor || [])[0] === vendorRecordId &&
            canAccessJobDeliveries(user, (d.job || [])[0])
    );
    if (candidates.length === 0) return empty;

    const fullSlices = await getDeliveryItemsByRecordIds(
        candidates.flatMap((d) => d.deliveryItems || [])
    );
    // Per ordered item, and per SLICE rather than deduplicated: a delivery holds two
    // rows for one ordered item whenever part of it was over-delivered, and both
    // are quantity delivered. `qtyOnOrderedItem` sums them.
    const broughtByDelivery = new Map();
    for (const slice of fullSlices) {
        const parent = (slice.delivery || [])[0];
        const poItemRecordId = (slice.poItem || [])[0];
        if (!parent || !poItemRecordId) continue;
        if (!broughtByDelivery.has(parent)) broughtByDelivery.set(parent, []);
        broughtByDelivery.get(parent).push({ poItemRecordId, qty: slice.qty });
    }

    const options = await getInvoiceLinkCandidates(user, { vendorRecordIds: [vendorRecordId] });

    return {
        deliveries: candidates.map((d) => ({
            deliveryRecordId: d.id,
            deliveryId: d.deliveryId,
            orderedItems: broughtByDelivery.get(d.id) || [],
        })),
        invoices: options.map(invoiceFromOption),
        agreedPrices,
    };
}

/**
 * The guard: resolve the invoice, or a refusal already worded.
 *
 * `deliveryRecordId` IS NULL ON THE ENTRY PATH, and that is not a special case but
 * the correct reading of it — the delivery does not exist yet, so no invoice can
 * already name it, so any existing pairing is `taken-by-another`. The in-place
 * paths pass the record id, which is what makes re-submitting the same pairing a
 * no-op rather than an error.
 *
 * Returns `{ invoice }` on success, or `{ refusal, error }` where `error` is the
 * sentence lib/deliveryInvoiceLink.js gives that refusal — so no action invents a
 * second phrasing for one state.
 */
export async function checkInvoicePairing({
    user,
    invoiceRecordId,
    deliveryRecordId = null,
    vendorRecordId = null,
} = {}) {
    const [invoice] = await getInvoicesByRecordIds([invoiceRecordId].filter(Boolean));

    // The row gate again, from this read rather than from the page's. Zero queries
    // for the office, two for everyone else.
    const items =
        invoice && !seesEveryInvoice(user)
            ? await getInvoiceItemsByRecordIds(invoice.invoiceItems || [])
            : [];
    const visibleIds = invoice ? await getVisibleInvoiceIds(user, [invoice], items) : new Set();

    const refusal = invoiceLinkRefusal({
        invoice,
        deliveryRecordId,
        vendorRecordId,
        visible: invoice ? visibleIds.has(invoice.id) : false,
    });
    if (!refusal) return { invoice };

    // `taken-by-another` is the one refusal that can name a record, so it is the
    // one that has to ask whether the reader may see it first.
    let heldLabel = null;
    if (refusal === LINK_REFUSED.takenByAnother) {
        const [holder] = await getDeliveriesByRecordIds([linkedDelivery(invoice)]);
        if (holder && canAccessJobDeliveries(user, (holder.job || [])[0])) {
            heldLabel = holder.deliveryId;
        }
    }

    return {
        refusal,
        error: describeLinkRefusal(refusal, {
            invoiceId: invoice?.invoiceId,
            deliveryId: heldLabel,
        })?.text,
    };
}

/**
 * The guarded write for the two IN-PLACE paths: attach an invoice to a delivery that
 * already exists, or detach one from it.
 *
 * THE ENTRY PATH DELIBERATELY DOES NOT USE THIS, and the asymmetry is the
 * transaction rather than an oversight. createDeliveryAction has to run the guard
 * BEFORE it creates anything — refusing after a create would mean rolling one back
 * — and then write the link as the last step INSIDE its own rollback, so a failure
 * there takes the whole delivery with it. It therefore calls `checkInvoicePairing`
 * and `setInvoiceDelivery` separately. Everything either path can decide is in
 * those two, so nothing is duplicated by the split.
 *
 * DETACHING REFUSES ANYTHING NOT ON THIS DELIVERY, which the same predicate already
 * says: an invoice naming another delivery is `taken-by-another` whichever
 * direction the caller was going. An invoice naming nothing is a no-op, for the
 * reason a re-submitted attach is one.
 *
 * The Job scope of the delivery is the CALLER's, checked before this is reached —
 * the same split lib/deliveryDelete.js uses, where the action owns Job membership
 * and the module owns the rule it exists for.
 */
export async function setDeliveryInvoiceAsUser({ user, delivery, invoiceRecordId, attach } = {}) {
    if (!delivery?.id) return { error: "That delivery no longer exists." };
    if (!invoiceRecordId) return { error: "Pick an invoice first." };

    const checked = await checkInvoicePairing({
        user,
        invoiceRecordId,
        deliveryRecordId: delivery.id,
        // Only when attaching. A pairing that somehow crossed vendors has to stay
        // detachable, or the refusal would lock in the very state it objects to.
        vendorRecordId: attach ? (delivery.vendor || [])[0] ?? null : null,
    });
    if (checked.error) return checked;

    const held = linkedDelivery(checked.invoice);
    if (attach && held === delivery.id) return { invoice: checked.invoice };
    if (!attach && !held) return { invoice: checked.invoice };

    const invoice = await setInvoiceDelivery(checked.invoice.id, attach ? delivery.id : null);
    return { invoice };
}
