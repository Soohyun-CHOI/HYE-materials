"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { base, TABLES } from "@/lib/airtable/client";
import { createPR, updatePR } from "@/lib/airtable/purchaseRequests";
import { createItem } from "@/lib/airtable/prItems";
import { createSigner } from "@/lib/airtable/prSigners";

// Bound to useActionState (see PRForm.js): takes (prevState, formData),
// returns { error } on a validation/write failure instead of throwing —
// same reasoning as app/admin/lines/new/actions.js.
export async function createPRAction(prevState, formData) {
    const user = await requireUser();

    const lineId = formData.get("lineId");
    const vendorId = formData.get("vendorId");
    const notes = formData.get("notes") || "";
    const items = JSON.parse(formData.get("itemsJson") || "[]");
    const signerIds = JSON.parse(formData.get("signerIdsJson") || "[]");

    if (!lineId) return { error: "Select a Line." };
    if (!vendorId) return { error: "Select a Vendor." };
    if (items.length === 0) {
        return { error: "Add at least one item." };
    }
    for (const item of items) {
        if (!item.itemName || !item.qty || !item.rate) {
            return { error: "Every item needs a name, quantity, and rate." };
        }
    }
    if (signerIds.length === 0) {
        return { error: "Assign at least one signer." };
    }

    let pr;
    const createdItemIds = [];
    const createdSignerIds = [];

    try {
        pr = await createPR({ requesterId: user.id, lineId, vendorId, notes });

        for (const item of items) {
            const created = await createItem({
                prRecordId: pr.id,
                prId: pr.prId,
                itemName: item.itemName,
                size: item.size,
                unit: item.unit,
                qty: parseFloat(item.qty),
                rate: parseFloat(item.rate),
                remark: item.remark,
            });
            createdItemIds.push(created.id);
        }

        for (let i = 0; i < signerIds.length; i++) {
            const created = await createSigner({
                prRecordId: pr.id,
                prId: pr.prId,
                signerUserId: signerIds[i],
                sequenceOrder: i + 1,
            });
            createdSignerIds.push(created.id);
        }

        // Creating a PR here means the Requester has finished assigning
        // signers in the same step — submission IS the start of the review
        // chain, not a Draft left for later. Current Signer Step: 1 means
        // the first signer's turn.
        await updatePR(pr.id, { status: "In Review", currentSignerStep: 1 });
    } catch (err) {
        // Best-effort compensating rollback: Airtable has no cross-table
        // transactions, so a failure partway through (e.g. the 3rd signer
        // fails to create) would otherwise leave a half-built PR behind.
        // Delete everything created so far, in reverse order, so a failed
        // submission leaves no trace rather than a confusing partial PR.
        if (pr) {
            await Promise.allSettled([
                ...createdSignerIds.map((id) => base(TABLES.PR_SIGNERS).destroy(id)),
                ...createdItemIds.map((id) => base(TABLES.PR_ITEMS).destroy(id)),
            ]);
            await base(TABLES.PURCHASE_REQUESTS)
                .destroy(pr.id)
                .catch(() => {});
        }

        console.error("createPRAction failed, rolled back", err);
        return { error: "Something went wrong creating the PR. Please try again." };
    }

    redirect(`/prs/new?created=${encodeURIComponent(pr.prId)}`);
}
