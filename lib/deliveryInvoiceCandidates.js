// The credentialed half of #210's pairing: which invoices a delivery may name, and
// the guarded write that pairs them.
//
// TWO MODULES FOR ONE RULE, THE ARRANGEMENT #167 USES. The judgement and every
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
// paired with another shipment while the form sits open, which is exactly the
// refusal `taken-by-another` exists for.

import { getAllInvoices, getInvoicesByRecordIds, setInvoiceDelivery } from "./airtable/invoices";
import { getInvoiceItemsByRecordIds } from "./airtable/invoiceItems";
import { getDeliveriesByRecordIds } from "./airtable/deliveries";
import { getVisibleInvoiceIds, seesEveryInvoice } from "./invoiceVisibility";
import { canAccessJobDeliveries } from "./deliveryAccess";
import {
    LINK_REFUSED,
    describeLinkRefusal,
    invoiceLinkRefusal,
    linkedDelivery,
} from "./deliveryInvoiceLink";

/**
 * The invoices this user may offer for a delivery from one of these vendors.
 *
 * `vendorRecordIds` narrows before anything is walked, which is what keeps the
 * batched reads small: on the entry page it is every vendor the selected jobs
 * ordered from, and the form narrows again to the one chosen. An empty list costs
 * one query and returns nothing.
 *
 * Each option carries `linkedDeliveryRecordId` when some shipment already holds it,
 * and `linkedDeliveryId` only when the viewer may reach that shipment — a delivery
 * is Job-scoped and an invoice can bill two jobs, so the holder is not always in
 * view, and naming it then would confirm a record outside someone's scope.
 */
export async function getInvoiceLinkCandidates(user, { vendorRecordIds } = {}) {
    const vendors = new Set((vendorRecordIds || []).filter(Boolean));
    if (vendors.size === 0) return [];

    const all = await getAllInvoices();
    const relevant = all.filter((inv) => vendors.has((inv.vendor || [])[0]));
    if (relevant.length === 0) return [];

    const items = seesEveryInvoice(user)
        ? []
        : await getInvoiceItemsByRecordIds(relevant.flatMap((inv) => inv.invoiceItems || []));
    const visibleIds = await getVisibleInvoiceIds(user, relevant, items);
    const visible = relevant.filter((inv) => visibleIds.has(inv.id));

    // One batched read over the shipments already holding one of these bills.
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
        };
    });
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
 * The guarded write for the two IN-PLACE paths: attach a bill to a delivery that
 * already exists, or detach one from it.
 *
 * THE ENTRY PATH DELIBERATELY DOES NOT USE THIS, and the asymmetry is the
 * transaction rather than an oversight. createDeliveryAction has to run the guard
 * BEFORE it creates anything — refusing after a create would mean rolling one back
 * — and then write the link as the last step INSIDE its own rollback, so a failure
 * there takes the whole arrival with it. It therefore calls `checkInvoicePairing`
 * and `setInvoiceDelivery` separately. Everything either path can decide is in
 * those two, so nothing is duplicated by the split.
 *
 * DETACHING REFUSES ANYTHING NOT ON THIS DELIVERY, which the same predicate already
 * says: an invoice naming another shipment is `taken-by-another` whichever
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
