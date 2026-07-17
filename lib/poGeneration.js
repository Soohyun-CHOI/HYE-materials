// PO auto-generation from a fully-Approved PR (issue #10). Triggered right
// after a PR's signing chain completes (see app/prs/[prId]/actions.js), and
// also callable directly as a manual retry when the auto-trigger failed —
// same function either way, no separate "resume" path.

import { base, TABLES } from "./airtable/client";
import { createPO } from "./airtable/purchaseOrders";
import { createPOItem } from "./airtable/poItems";
import { getItemsByPR } from "./airtable/prItems";
import { getJobByRecordId } from "./airtable/jobs";

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
 */
export async function generatePOForApprovedPR(pr) {
    if (pr.purchaseOrders?.length > 0) {
        return { alreadyExisted: true, poRecordId: pr.purchaseOrders[0] };
    }

    const [items, job] = await Promise.all([
        getItemsByPR(pr.id),
        pr.job?.[0] ? getJobByRecordId(pr.job[0]) : null,
    ]);

    const createdPOItemIds = [];
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
            createdPOItemIds.push(poItem.id);
        }
    } catch (err) {
        await Promise.allSettled(
            createdPOItemIds.map((id) => base(TABLES.PO_ITEMS).destroy(id))
        );
        if (po) {
            await base(TABLES.PURCHASE_ORDERS).destroy(po.id).catch(() => {});
        }
        throw err;
    }

    return { alreadyExisted: false, poRecordId: po.id, poId: po.poId };
}
