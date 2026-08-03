// The read side of #162: every PO line a delivery on one Job could be allocated
// against, plus the vendor and item choices the entry form offers.
//
// WHY A MODULE OF ITS OWN. `PO Items` carries no Job, so reaching a Job's order
// lines means walking Job -> Lines -> PRs -> POs -> PO Items, and both the entry
// form (to build its dropdowns and draw its preview) and the Server Action (to
// re-allocate authoritatively at submit) need exactly the same walk. One
// implementation, so the two cannot come to disagree about what was ordered.
// lib/deliveryAllocation.js then decides; this only fetches.
//
// THE QUERY BUDGET IS CONSTANT IN THE NUMBER OF LINES. Every step fetches a whole
// level at once, keyed on record ids gathered from the level above:
//
//   1  Jobs              (.find by id)
//   2  Lines             (by record id)
//   3  Purchase Requests (by record id)
//   4  Purchase Orders   (by record id)
//   5  PO Items          (by record id)
//   6  Vendors           (all)
//
// So ~6 queries for a Job of any size, plus one extra per 50 ids inside a batched
// step. Same discipline as lib/materialHistory.js, and the same reason: the
// alternative is a round trip per line, which #143 established should not happen.
//
// THE ITEM LABELS COME FROM THE PO LINES, NOT FROM `Materials`. Every line
// already carries its own Item Name/Size/Unit — a frozen copy of what was
// ordered — so grouping lines by their `Material` link gives both the identity
// and the label without a seventh query. It is also the more faithful label: it
// is the text on the order document the delivery is being matched to.
//
// Credentialed tier: imports lib/airtable/*, so the offline tier cannot load it.

import { findByRecordIds, TABLES } from "./airtable/client";
import { getPOsByRecordIds } from "./airtable/purchaseOrders";
import { getPRsByRecordIds } from "./airtable/purchaseRequests";
import { getPOItemsByRecordIds } from "./airtable/poItems";
import { getAllVendors } from "./airtable/vendors";
import { getJobByRecordId } from "./airtable/jobs";
import { countsAsOrdered } from "./materialPriceView";

/**
 * Every candidate PO line on one Job, in the flat shape planDelivery expects.
 *
 * Returns { job, lines, vendors, poById } where `lines` is one entry per PO Item
 * of that Job that points at a material, and `vendors` is only the vendors that
 * actually have such a line — the entry form's vendor picker, narrowed so a
 * recorder cannot pick a supplier this Job never ordered from.
 *
 * A LINE WITH NO `Material` LINK IS EXCLUDED, and that exclusion is the honest
 * cause of the form's "item is not in the dropdown" dead end. #18 writes that
 * link at PO-generation time and PO lines created before it were not backfilled,
 * so an older order is invisible here — as is a line the cache skipped for having
 * no Unit. Matching such a line would mean matching on `Item Name` text, which is
 * exactly what the item axis exists to avoid.
 */
export async function getDeliveryCandidatesForJob(jobRecordId) {
    const job = await getJobByRecordId(jobRecordId);
    if (!job) return null;

    const lineRecords = await findByRecordIds(TABLES.LINES, job.lines || []);
    const prIds = lineRecords.flatMap((r) => r.get("Purchase Requests") || []);

    const prs = await getPRsByRecordIds(prIds);
    const pos = await getPOsByRecordIds(prs.flatMap((pr) => pr.purchaseOrders || []));

    const [poItems, allVendors] = await Promise.all([
        getPOItemsByRecordIds(pos.flatMap((po) => po.poItems || [])),
        getAllVendors(),
    ]);

    const poById = new Map(pos.map((po) => [po.id, po]));

    const lines = poItems
        .map((item) => {
            const po = item.po[0] ? poById.get(item.po[0]) : null;
            if (!po) return null;
            // No material link, no item axis, no allocation target.
            if (!item.material[0]) return null;

            return {
                id: item.id,
                poItemId: item.poItemId,
                poRecordId: po.id,
                poId: po.poId,
                poCreatedDate: po.createdDate,
                poStatus: item.poStatus || po.status || "",
                // Purchase Orders.Vendor is a Lookup through PR, so it is an
                // array of Vendor record ids like every other link field here.
                vendorRecordId: po.vendor?.[0] ?? null,
                materialRecordId: item.material[0],
                itemName: item.itemName,
                size: item.size,
                unit: item.unit,
                qty: item.qty,
                committedQty: item.committedQty,
                deliveredQty: item.deliveredQty,
            };
        })
        .filter(Boolean);

    const vendorNameById = new Map(allVendors.map((v) => [v.id, v.vendorName]));
    const vendorIdsWithLines = new Set(lines.map((l) => l.vendorRecordId).filter(Boolean));
    const vendors = [...vendorIdsWithLines]
        .map((id) => ({ id, vendorName: vendorNameById.get(id) ?? "Unknown vendor" }))
        .sort((a, b) => a.vendorName.localeCompare(b.vendorName));

    return { job, lines, vendors, poById };
}

/**
 * The item dropdown for one vendor: every material this Job ordered from them,
 * with how much is still outstanding.
 *
 * DELIBERATELY WIDER THAN THE ALLOCATION CANDIDATE SET. It lists a material whose
 * orders are already fully delivered, with `outstanding: 0`, instead of dropping
 * it. Narrowing to outstanding-only would make that item VANISH, and the recorder
 * would then land on the "not in the dropdown" message — which says the item may
 * never have been ordered here. That message would be false: the item was
 * ordered, the app knows it, and it is merely satisfied. Showing it lets the
 * screen say the true thing and flag the entry as over-delivery, which is what
 * "over-delivery is flagged, not blocked" requires.
 *
 * Withdrawn lines are excluded by `countsAsOrdered`, the same judgement
 * allocation applies, so an item ordered only on a cancelled PO does not appear.
 */
export function buildItemOptions(lines, vendorRecordId) {
    const byMaterial = new Map();

    for (const line of lines) {
        if (line.vendorRecordId !== vendorRecordId) continue;
        if (!countsAsOrdered({ committedQty: line.committedQty })) continue;

        const existing = byMaterial.get(line.materialRecordId);
        const remaining = Math.max(0, (line.qty || 0) - (line.deliveredQty || 0));
        if (existing) {
            existing.ordered += line.qty || 0;
            existing.delivered += line.deliveredQty || 0;
            existing.outstanding += remaining;
            existing.lineCount += 1;
        } else {
            byMaterial.set(line.materialRecordId, {
                materialRecordId: line.materialRecordId,
                // First line's spelling wins the label, the same first-seen rule
                // Materials itself uses for `Item Name` (#18).
                itemName: line.itemName,
                size: line.size,
                unit: line.unit,
                ordered: line.qty || 0,
                delivered: line.deliveredQty || 0,
                outstanding: remaining,
                lineCount: 1,
            });
        }
    }

    return [...byMaterial.values()].sort((a, b) =>
        `${a.itemName} ${a.size}`.localeCompare(`${b.itemName} ${b.size}`)
    );
}

/** A label for one item option — `Pipe 2" (EA)`, blanks omitted. */
export function itemOptionLabel(option) {
    return [option.itemName, option.size, option.unit ? `(${option.unit})` : ""]
        .filter(Boolean)
        .join(" ");
}
