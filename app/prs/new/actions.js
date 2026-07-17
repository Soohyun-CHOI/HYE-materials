"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { base, TABLES } from "@/lib/airtable/client";
import { createPR, updatePR, getPRsByLine } from "@/lib/airtable/purchaseRequests";
import { createItem, getItemsByPR } from "@/lib/airtable/prItems";
import { createSigner } from "@/lib/airtable/prSigners";
import { createQuotation } from "@/lib/airtable/quotations";
import { getUserByRecordId } from "@/lib/airtable/users";
import { notifyCurrentTurn } from "@/lib/notifications";

// Canonical key for an item's duplicate-match identity — Item Name
// (case/whitespace-insensitive) + Qty + Rate, per issue #61. Size/Unit/
// Remark deliberately excluded: the issue only calls out Name/Qty/Rate.
function itemKey(item) {
    return `${(item.itemName || "").trim().toLowerCase()}|${parseFloat(item.qty)}|${parseFloat(item.rate)}`;
}

// Issue #61 — flags a PR as a likely re-submission when some prior PR on
// the same Line has the exact same set of items (Name/Qty/Rate, order and
// multiplicity insensitive). Checked against every prior PR on the Line
// regardless of Status, since even one already PO Signed is still a
// forgotten-resubmission candidate.
async function findDuplicatePR(lineId, items) {
    const submittedKey = items.map(itemKey).sort().join(",");

    const priorPRs = await getPRsByLine(lineId);
    for (const priorPr of priorPRs) {
        const priorItems = await getItemsByPR(priorPr.id);
        const priorKey = priorItems.map(itemKey).sort().join(",");
        if (priorKey !== submittedKey) continue;

        const requester = priorPr.requester?.[0]
            ? await getUserByRecordId(priorPr.requester[0])
            : null;

        return {
            priorPrId: priorPr.prId,
            priorDate: priorPr.createdDate,
            priorRequesterName: requester?.userName || "Unknown",
        };
    }

    return null;
}

// Bound to useActionState (see PRForm.js): takes (prevState, formData),
// returns { error } on a validation/write failure instead of throwing —
// same reasoning as app/admin/lines/new/actions.js.
export async function createPRAction(prevState, formData) {
    const user = await requireUser();

    const lineId = formData.get("lineId");
    const vendorId = formData.get("vendorId");
    const notes = formData.get("notes") || "";
    const items = JSON.parse(formData.get("itemsJson") || "[]");
    // Each entry: { userId, confirmationType } — issue #66's per-signer
    // Approval/Agreement tag, picked by the Requester in SignerList.js.
    const signers = JSON.parse(formData.get("signersJson") || "[]");
    const quotationUrl = formData.get("quotationUrl");
    const quotationFilename = formData.get("quotationFilename");
    const vendorQuotationCode = formData.get("vendorQuotationCode") || "";
    const confirmed = formData.get("confirmed") === "true";

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
    if (signers.length === 0) {
        return { error: "Assign at least one signer." };
    }

    // Real submit-time check (this app has no separate Draft-save step —
    // reaching here already is the actual submission), skipped once the
    // Requester has confirmed past a previously-shown warning.
    if (!confirmed) {
        const duplicate = await findDuplicatePR(lineId, items);
        if (duplicate) {
            return { duplicateWarning: duplicate };
        }
    }

    let pr;
    const createdItemIds = [];
    const createdSignerIds = [];
    let createdQuotationId = null;

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

        for (let i = 0; i < signers.length; i++) {
            const created = await createSigner({
                prRecordId: pr.id,
                prId: pr.prId,
                signerUserId: signers[i].userId,
                sequenceOrder: i + 1,
                confirmationType: signers[i].confirmationType,
            });
            createdSignerIds.push(created.id);
        }

        // Optional — only if a file was actually uploaded. Kept inside this
        // same try/catch (not a best-effort side effect like the
        // notification below): the Requester explicitly attached this
        // file, so silently dropping it on a write failure would be worse
        // than rolling back the whole submission and letting them retry.
        if (quotationUrl) {
            const quotation = await createQuotation({
                prRecordId: pr.id,
                prId: pr.prId,
                vendorId,
                vendorQuotationCode,
                file: [{ url: quotationUrl, filename: quotationFilename || undefined }],
            });
            createdQuotationId = quotation.id;
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
            if (createdQuotationId) {
                await base(TABLES.QUOTATIONS).destroy(createdQuotationId).catch(() => {});
            }
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

    // Best-effort — see lib/notifications.js. Signer #1 is signers[0]
    // (Sequence Order 1, the PR's starting Current Signer Step).
    await notifyCurrentTurn({ pr, turn: { type: "signer", userId: signers[0].userId } });

    redirect(`/prs/new?created=${encodeURIComponent(pr.prId)}`);
}
