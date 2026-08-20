// The read side of #162: every ordered item a delivery could be allocated against,
// across every Job the viewer may record on.
//
// WHY A MODULE OF ITS OWN. `PO Items` carries no Job, so reaching a Job's order
// ordered items means walking Job -> Lines -> PRs -> POs -> PO Items, and both
// the entry page (to build its dropdowns) and the Server Action (to re-allocate
// authoritatively at submit) need the same walk. One implementation, so the two
// cannot come to disagree about what was ordered. lib/deliveryAllocation.js then
// decides; this only fetches.
//
// THE QUERY BUDGET IS CONSTANT IN THE NUMBER OF JOBS, not just in the number of
// ordered items, and that is what makes a single-page form possible at all. Every step
// fetches a whole level for ALL the requested jobs at once:
//
//   1  Lines             (by record id, from the jobs' own Lines links)
//   2  Purchase Requests (by record id)
//   3  Purchase Orders   (by record id)
//   4  PO Items          (by record id)
//   5  Vendors           (all)
//
// So ~5 queries whether the viewer is on one job or on all 36, plus one extra per
// 50 ids inside a batched step. The first version of this took a single job and
// the page navigated to it; for an Admin that shape would have been ~6 queries
// per job — over 200 — which is why the page could not simply loop.
//
// THE ITEM LABELS COME FROM THE ORDERED ITEMS, NOT FROM `Materials`. Every ordered
// item already carries its own Item Name/Size/Unit — a frozen copy of what was
// ordered — so grouping ordered items by their `Material` link gives both the
// identity and the label without another query. It is also the more faithful
// label: it is the text on the order document the delivery is being matched to.
//
// Credentialed tier: imports lib/airtable/*, so neither the offline tier nor any
// Client Component may import this. The pure half the FORM needs — buildItemOptions
// and itemOptionLabel — lives in lib/deliveryAllocation.js for exactly that
// reason; importing this module from the client throws `Missing AIRTABLE_API_KEY`
// in the browser, because an import executes the module.

import { findByRecordIds, TABLES } from "./airtable/client";
import { getPOsByRecordIds } from "./airtable/purchaseOrders";
import { getPRsByRecordIds } from "./airtable/purchaseRequests";
import { getPOItemsByRecordIds } from "./airtable/poItems";
import { getAllVendors } from "./airtable/vendors";

/**
 * Every candidate ordered item across the given Jobs, in the flat shape planDelivery
 * expects, each tagged with the Job it belongs to.
 *
 * `jobs` are already-loaded Job objects carrying their `lines` link array — which
 * getAllJobs() supplies, so the caller has them in hand and this costs no Jobs
 * query of its own.
 *
 * Returns { orderedItems, vendorNameById }. `orderedItems` is one entry per PO
 * Item of those Jobs that points at a material. The key was `lines` until #227,
 * and `offline/delivery-allocation.mjs` now pins that its readers — the entry
 * page, the Server Action and the form's own prop — name it the same thing.
 *
 * AN ORDERED ITEM WITH NO `Material` LINK IS EXCLUDED, and that exclusion is the honest
 * cause of the form's "item is not in the dropdown" dead end. #18 writes that link
 * at PO-generation time and ordered items created before it were not backfilled, so an
 * older order is invisible here — as is an ordered item the cache skipped for having no
 * Unit. Matching such an ordered item would mean matching on `Item Name` text, which is
 * exactly what the item axis exists to avoid.
 */
export async function getDeliveryCandidates(jobs) {
    const jobIds = new Set((jobs || []).map((j) => j.id));
    const lineIds = (jobs || []).flatMap((j) => j.lines || []);
    if (lineIds.length === 0) return { orderedItems: [], vendorNameById: new Map() };

    const lineRecords = await findByRecordIds(TABLES.LINES, lineIds);
    // Line -> Job, so every ordered item can be attributed back to a Job. Taken from
    // the Line's own `Job` link rather than from Purchase Requests' `Job` lookup:
    // the link is core data, the lookup is computed from it.
    const jobByLineId = new Map(
        lineRecords.map((r) => [r.id, (r.get("Job") || [])[0] ?? null])
    );

    const prs = await getPRsByRecordIds(lineRecords.flatMap((r) => r.get("Purchase Requests") || []));
    const jobByPrId = new Map(prs.map((pr) => [pr.id, jobByLineId.get(pr.line?.[0]) ?? null]));

    const pos = await getPOsByRecordIds(prs.flatMap((pr) => pr.purchaseOrders || []));
    const jobByPoId = new Map(pos.map((po) => [po.id, jobByPrId.get(po.pr?.[0]) ?? null]));

    const [poItems, allVendors] = await Promise.all([
        getPOItemsByRecordIds(pos.flatMap((po) => po.poItems || [])),
        getAllVendors(),
    ]);

    const poById = new Map(pos.map((po) => [po.id, po]));

    const orderedItems = poItems
        .map((item) => {
            const po = item.po[0] ? poById.get(item.po[0]) : null;
            if (!po) return null;
            // No material link, no item axis, no allocation target.
            if (!item.material[0]) return null;

            const jobRecordId = jobByPoId.get(po.id) ?? null;
            // An ordered item whose Job could not be resolved is dropped rather
            // than shown under the wrong one: it would otherwise become a
            // candidate for a Job it does not belong to, which is worse than being
            // invisible.
            if (!jobRecordId || !jobIds.has(jobRecordId)) return null;

            return {
                id: item.id,
                poItemId: item.poItemId,
                poRecordId: po.id,
                poId: po.poId,
                poCreatedDate: po.createdDate,
                poStatus: item.poStatus || po.status || "",
                jobRecordId,
                // Purchase Orders.Vendor is a Lookup through PR, so it is an array
                // of Vendor record ids like every other link field here.
                vendorRecordId: po.vendor?.[0] ?? null,
                materialRecordId: item.material[0],
                itemName: item.itemName,
                size: item.size,
                unit: item.unit,
                qty: item.qty,
                // #231 — the price the order agreed, which the entry form tests a
                // candidate invoice's own price against before computing a pairing.
                // Free: getPOItemsByRecordIds already projects it, so this adds no
                // query and no round trip. It reaches the browser like everything
                // else here, and discloses nothing new — the form already renders
                // this ordered item's quantities to the same viewer.
                unitPrice: item.unitPrice,
                committedQty: item.committedQty,
                deliveredQty: item.deliveredQty,
            };
        })
        .filter(Boolean);

    return {
        orderedItems,
        vendorNameById: new Map(allVendors.map((v) => [v.id, v.vendorName])),
    };
}

// A `vendorsForJob` helper was here briefly and is deliberately gone. The form
// needs that list per job selection, so a helper in THIS module could never serve
// it — importing this file from a Client Component is precisely the bug above —
// and nothing on the server wanted it. An export with no caller is the shape this
// base has been bitten by before (`PO Items."PO Record ID"`), so the form derives
// its vendor list from the ordered items it already holds instead.
