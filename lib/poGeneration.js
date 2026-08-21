// PO auto-generation from a fully-Approved PR (issue #10). Triggered right
// after a PR's signing chain completes (see app/prs/[prId]/actions.js), and
// also callable directly as a manual retry when the auto-trigger failed —
// same function either way, no separate "resume" path.

import { base, TABLES } from "./airtable/client";
import { createPO } from "./airtable/purchaseOrders";
import { createPOItem } from "./airtable/poItems";
import { getItemsByPR } from "./airtable/prItems";
import { getJobByRecordId } from "./airtable/jobs";
import { refreshMaterialsCacheForPO } from "./materialsCache";
import { applyOverageToPO } from "./overagePR";

/**
 * Creates the PO + PO Items snapshot for an Approved PR. Rolls back
 * everything it created (PO Items in reverse order, then the PO record
 * itself) on any failure, leaving zero trace — same create-then-delete
 * pattern as PR creation (issue #5) rather than trying to "resume" a
 * partial attempt. This is deliberate: PO Item ID's sequence number is
 * derived from the PO's own live "PO Items" reverse-link count (see
 * lib/ids.js:generateChildId), so a fresh retry after a full rollback
 * always starts a brand-new PO with an empty reverse-link array — seq
 * restarts at 1 with no risk of colliding with a half-finished attempt.
 *
 * No-op (returns the existing PO) if this PR already has one — callers on
 * the retry path may call this more than once if a previous attempt's
 * failure was, e.g., a transient network error after the PO record itself
 * had already committed but before rollback ran.
 *
 * Issue #18 — also refreshes the item axis (Materials identity, this vendor's
 * Material Price, and each ordered item's Material link), once the PO and its items
 * are committed. Here rather than at the three call sites (approveAction,
 * editAndContinueAction, generatePOAction's retry) so there is one copy, and
 * because this is the moment its fields become available: Material Prices."Latest
 * PO" needs a PO to point at, and full approval is what makes a price real. See
 * lib/materialsCache.js for why the figures come from PO Items.
 */
export async function generatePOForApprovedPR(pr) {
    if (pr.purchaseOrders?.length > 0) {
        // Deliberately no cache refresh on this path. The retry reaches it
        // for a PO that already exists, and re-applying an older PO's prices
        // could move the cache BACKWARDS — a later PO for the same material
        // may already have overwritten them.
        return { alreadyExisted: true, poRecordId: pr.purchaseOrders[0] };
    }

    const [items, job] = await Promise.all([
        getItemsByPR(pr.id),
        pr.job?.[0] ? getJobByRecordId(pr.job[0]) : null,
    ]);

    const createdPOItems = [];
    let po;

    try {
        po = await createPO({
            prRecordId: pr.id,
            ourPicId: job?.pic?.[0] || null,
            ourManagerId: job?.manager?.[0] || null,
            // Default only — the President can change this on the signing
            // screen (issue #12) before signing. Both Primary and Alternate
            // (if the Job has one) are printed on the generated PDF
            // regardless of this value (issue #13's design) — this field
            // is internal tracking of which address was actually intended,
            // not what gets printed.
            deliveryAddressUsed: "Primary",
            // Issue #78 — frozen copy of the PR's Shipping Fee as of right
            // now (see purchaseOrders.js:createPO's doc comment).
            shippingFee: pr.shippingFee,
        });

        for (const item of items) {
            const poItem = await createPOItem({
                poRecordId: po.id,
                poId: po.poId,
                itemName: item.itemName,
                size: item.size,
                unit: item.unit,
                qty: item.qty,
                unitPrice: item.unitPrice,
                remark: item.remark,
            });
            createdPOItems.push(poItem);
        }
    } catch (err) {
        await Promise.allSettled(
            createdPOItems.map((item) => base(TABLES.PO_ITEMS).destroy(item.id))
        );
        if (po) {
            await base(TABLES.PURCHASE_ORDERS).destroy(po.id).catch(() => {});
        }
        throw err;
    }

    // Issue #18 — outside the try/catch above on purpose: everything the
    // rollback tears down has committed by here, so a cache failure can no
    // longer reach it. Awaited-and-swallowed rather than deferred with
    // after(): this function is also called directly by the credentialed
    // verification scripts, which have no request scope for after() to
    // attach to. The shape mirrors how signPOAction treats PDF generation
    // (app/pos/[poId]/actions.js) — a derived artifact never invalidates the
    // approval that produced it.
    try {
        const cache = await refreshMaterialsCacheForPO({
            poItems: createdPOItems,
            vendorRecordId: pr.vendor?.[0] || null,
            poRecordId: po.id,
            latestDate: po.createdDate,
        });
        if (cache.failed.length > 0 || cache.skipped.length > 0 || cache.skippedAll) {
            console.warn(
                `Materials cache refresh for ${po.poId} was partial`,
                JSON.stringify(cache)
            );
        }
    } catch (err) {
        console.error(
            `Materials cache refresh failed for ${po.poId} (non-fatal, the PO stands)`,
            err
        );
    }

    // Issue #167 — if this PR is an overage correction, settle it: the flagged
    // Delivery Items row moves onto this PO's own ordered item and the invoice item
    // that invoiced the excess splits onto it.
    //
    // AFTER the cache and outside the same rollback, deliberately twice over. After,
    // because it matches the overage row to an ordered item of this PO on #18's
    // `Material` link, which the cache is what writes. Outside, for #165's reason —
    // a derived artifact must not undo the approval that produced it, and this one
    // touches an invoice that may already be paid. A failure therefore leaves the PO
    // standing and an asymmetry behind; lib/overagePR.js names the two places it
    // shows, since no email can be sent.
    try {
        const overage = await applyOverageToPO({ pr, poRecordId: po.id });
        if (overage.failed.length > 0 || overage.skipped.length > 0) {
            console.warn(`Overage settlement for ${po.poId} was partial`, JSON.stringify(overage));
        }
    } catch (err) {
        console.error(
            `Overage settlement failed for ${po.poId} (non-fatal, the PO stands — the banner reads not-applied)`,
            err
        );
    }

    return { alreadyExisted: false, poRecordId: po.id, poId: po.poId };
}
