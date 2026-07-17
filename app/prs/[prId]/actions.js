"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { base, TABLES } from "@/lib/airtable/client";
import { getPRById, updatePR } from "@/lib/airtable/purchaseRequests";
import { getSignersByPR, updateSigner } from "@/lib/airtable/prSigners";
import { getItemsByPR, updateItem } from "@/lib/airtable/prItems";
import {
    getCorrectionRequestsByPR,
    createCorrectionRequest,
    resolveCorrectionRequest,
} from "@/lib/airtable/correctionRequests";
import { createEditLogEntry } from "@/lib/airtable/editLog";
import { createQuotation } from "@/lib/airtable/quotations";
import { getCurrentTurn, getReturnTargets, computeAdvance } from "@/lib/prSigning";
import { notifyCurrentTurn } from "@/lib/notifications";
import { generatePOForApprovedPR } from "@/lib/poGeneration";

const ITEM_FIELDS = ["itemName", "size", "unit", "qty", "rate", "remark"];
const ITEM_FIELD_LABELS = {
    itemName: "Item Name",
    size: "Size",
    unit: "Unit",
    qty: "Qty",
    rate: "Rate",
    remark: "Remark",
};

async function loadPRContext(prId) {
    const pr = await getPRById(prId);
    if (!pr) throw new Error("PR not found");

    const [signers, correctionRequests] = await Promise.all([
        getSignersByPR(pr.id),
        getCorrectionRequestsByPR(pr.id),
    ]);

    return { pr, signers, correctionRequests };
}

/**
 * Shared by approveAction and editAndContinueAction: both "finish" a turn
 * the same way once the actor's own record is updated — resolve a pending
 * Correction Request and resume to its initiator if the actor was
 * resuming from a return, otherwise advance normally (see
 * lib/prSigning.js:computeAdvance). Rolls back everything it wrote on
 * failure, using the pre-write snapshots the caller already has.
 *
 * Returns { nextStep, prApproved } so the caller can notify whoever the
 * chain now points at (see notifyCurrentTurn calls below) — nextStep is
 * null when prApproved is true, since there's no next signer to notify.
 */
async function finishTurn({ pr, turn, signers, correctionRequests }) {
    const { resolveCorrectionId, nextStep, prApproved } = computeAdvance({
        turn,
        signers,
        correctionRequests,
    });

    let resolvedCorrectionId = null;
    let resumedSignerId = null;

    try {
        if (resolveCorrectionId) {
            await resolveCorrectionRequest(resolveCorrectionId);
            resolvedCorrectionId = resolveCorrectionId;

            // The person we're resuming to had their PR Signer status set
            // to "Returned" when they delegated the correction — flip it
            // back to "Pending" now that it's their turn again, so the UI
            // shows them as actionable instead of stale "Returned".
            const initiatorSigner = signers.find((s) => s.sequenceOrder === nextStep);
            if (initiatorSigner) {
                await updateSigner(initiatorSigner.id, { status: "Pending" });
                resumedSignerId = initiatorSigner.id;
            }
        }

        await updatePR(pr.id, prApproved ? { status: "Approved" } : { currentSignerStep: nextStep });
    } catch (err) {
        if (resumedSignerId) {
            await updateSigner(resumedSignerId, { status: "Returned" }).catch(() => {});
        }
        if (resolvedCorrectionId) {
            await base(TABLES.CORRECTION_REQUESTS)
                .update(resolvedCorrectionId, { Status: "Pending", "Resolved At": null })
                .catch(() => {});
        }
        throw err;
    }

    return { nextStep, prApproved };
}

export async function approveAction(prevState, formData) {
    const user = await requireUser();
    const prId = formData.get("prId");
    const notes = formData.get("notes") || "";

    const { pr, signers, correctionRequests } = await loadPRContext(prId);
    const turn = getCurrentTurn(pr, signers);

    if (!turn || turn.type !== "signer" || turn.userId !== user.id) {
        return { error: "It's not your turn to act on this PR." };
    }
    if (pr.status !== "In Review") {
        return { error: "This PR isn't currently in review." };
    }

    const signerBefore = signers.find((s) => s.id === turn.prSignerRecordId);
    let advance;

    try {
        await updateSigner(turn.prSignerRecordId, {
            status: "Approved",
            signedAt: new Date().toISOString(),
            notes,
        });

        advance = await finishTurn({ pr, turn, signers, correctionRequests });
    } catch (err) {
        await updateSigner(turn.prSignerRecordId, {
            status: signerBefore.status,
            signedAt: signerBefore.signedAt || null,
            notes: signerBefore.notes || "",
        }).catch(() => {});

        console.error("approveAction failed, rolled back", err);
        return { error: "Something went wrong recording your approval. Please try again." };
    }

    // Best-effort — see lib/notifications.js. No notification when the PR
    // just reached its final Approved state (no next signer, per scope).
    if (!advance.prApproved) {
        const nextTurn = getCurrentTurn({ ...pr, currentSignerStep: advance.nextStep }, signers);
        await notifyCurrentTurn({ pr, turn: nextTurn });
    } else {
        // Best-effort, but unlike notifications a failure here leaves a
        // real gap (an Approved PR with no PO) rather than just a missed
        // email — see lib/poGeneration.js. Never rolls back the approval
        // that just committed; app/prs/[prId]/page.js surfaces a manual
        // "generate PO" retry (generatePOAction below) when this fails.
        try {
            await generatePOForApprovedPR(pr);
        } catch (err) {
            console.error("Auto PO generation failed after PR approval (non-fatal, retry available on PR page)", err);
        }
    }

    redirect(`/prs/${pr.prId}?done=approved`);
}

export async function editAndContinueAction(prevState, formData) {
    const user = await requireUser();
    const prId = formData.get("prId");
    const notes = formData.get("notes") || "";
    const editedItems = JSON.parse(formData.get("itemsJson") || "[]");
    // Issue #67 — Quotations added in this same edit session (a PR can
    // pick up a 2nd, 3rd, ... Quotation later, not just at submission).
    const newQuotations = JSON.parse(formData.get("newQuotationsJson") || "[]");

    for (const q of newQuotations) {
        if (!q.url) return { error: "Every quotation needs a file attached." };
    }

    const { pr, signers, correctionRequests } = await loadPRContext(prId);
    const turn = getCurrentTurn(pr, signers);

    if (!turn || turn.userId !== user.id) {
        return { error: "It's not your turn to act on this PR." };
    }
    if (pr.status !== "In Review") {
        return { error: "This PR isn't currently in review." };
    }

    const originalItems = await getItemsByPR(pr.id);
    const originalById = Object.fromEntries(originalItems.map((it) => [it.id, it]));

    // Diff submitted values against what's actually on record — only
    // fields that really changed get an Edit Log entry and a write,
    // matching Edit Log's per-field granularity (CLAUDE.md).
    const changes = []; // { itemId, field, oldValue, newValue }
    for (const submitted of editedItems) {
        const original = originalById[submitted.id];
        if (!original) continue;

        for (const field of ITEM_FIELDS) {
            const oldValue = original[field];
            const newValue = field === "qty" || field === "rate" ? parseFloat(submitted[field]) : submitted[field];
            if (String(oldValue ?? "") !== String(newValue ?? "")) {
                changes.push({ itemId: submitted.id, field, oldValue, newValue });
            }
        }
    }

    const createdEditLogIds = [];
    const touchedItemIds = new Set(changes.map((c) => c.itemId));
    // itemId -> { newQuotationId, oldQuotationId } — only populated for
    // items whose resolved Quotation choice actually differs from what's
    // currently stored (see below), so an edit session that never touches
    // Quotations writes nothing here.
    const quotationLinkChanges = new Map();
    let advance;
    const createdQuotationIds = [];

    try {
        // Newly-added Quotations are created before resolving item links
        // below, since a "new:<index>" choice needs the real record id —
        // sequential (not Promise.all), same reasoning as the PR creation
        // form's loop.
        for (const q of newQuotations) {
            const created = await createQuotation({
                prRecordId: pr.id,
                prId: pr.prId,
                vendorId: pr.vendor?.[0],
                vendorQuotationCode: q.vendorQuotationCode,
                file: [{ url: q.url, filename: q.filename || undefined }],
            });
            createdQuotationIds.push(created.id);
        }

        // Resolve each submitted item's Quotation choice ("existing:<id>"
        // | "new:<index>" | "") against its actually-stored current link
        // — an item whose choice didn't change (the common case: it was
        // never shown a dropdown, or the Requester left it alone) gets no
        // write at all.
        for (const submitted of editedItems) {
            const original = originalById[submitted.id];
            if (!original) continue;

            let newQuotationId = null;
            if (submitted.quotationChoice?.startsWith("existing:")) {
                newQuotationId = submitted.quotationChoice.slice("existing:".length);
            } else if (submitted.quotationChoice?.startsWith("new:")) {
                newQuotationId = createdQuotationIds[Number(submitted.quotationChoice.slice(4))];
            }

            const oldQuotationId = original.quotation?.[0] || null;
            if (newQuotationId !== oldQuotationId) {
                quotationLinkChanges.set(submitted.id, { newQuotationId, oldQuotationId });
                touchedItemIds.add(submitted.id);
            }
        }

        // One updateItem call per item (batching its changed fields, plus
        // any Quotation link change), but one Edit Log entry per changed
        // field — Quotation link changes aren't logged (Edit Log's Field
        // Name is a fixed select without a Quotation option, and this is
        // a linking correction, not a value edit the way Item Name/Qty/
        // etc. are).
        for (const itemId of touchedItemIds) {
            const itemChanges = changes.filter((c) => c.itemId === itemId);
            const fields = Object.fromEntries(itemChanges.map((c) => [c.field, c.newValue]));
            if (quotationLinkChanges.has(itemId)) {
                fields.quotationRecordId = quotationLinkChanges.get(itemId).newQuotationId;
            }
            await updateItem(itemId, fields);

            for (const change of itemChanges) {
                const entry = await createEditLogEntry({
                    prRecordId: pr.id,
                    prId: pr.prId,
                    changedById: user.id,
                    fieldName: ITEM_FIELD_LABELS[change.field],
                    oldValue: change.oldValue,
                    newValue: change.newValue,
                });
                createdEditLogIds.push(entry.id);
            }
        }

        if (turn.type === "signer") {
            await updateSigner(turn.prSignerRecordId, {
                status: "Edited",
                signedAt: new Date().toISOString(),
                notes,
            });
        }

        advance = await finishTurn({ pr, turn, signers, correctionRequests });
    } catch (err) {
        for (const itemId of touchedItemIds) {
            const original = originalById[itemId];
            await updateItem(itemId, {
                itemName: original.itemName,
                size: original.size,
                unit: original.unit,
                qty: original.qty,
                rate: original.rate,
                remark: original.remark,
                quotationRecordId: original.quotation?.[0] || null,
            }).catch(() => {});
        }
        await Promise.allSettled(
            createdEditLogIds.map((id) => base(TABLES.EDIT_LOG).destroy(id))
        );
        await Promise.allSettled(
            createdQuotationIds.map((id) => base(TABLES.QUOTATIONS).destroy(id))
        );
        if (turn.type === "signer") {
            const signerBefore = signers.find((s) => s.id === turn.prSignerRecordId);
            await updateSigner(turn.prSignerRecordId, {
                status: signerBefore.status,
                signedAt: signerBefore.signedAt || null,
                notes: signerBefore.notes || "",
            }).catch(() => {});
        }

        console.error("editAndContinueAction failed, rolled back", err);
        return { error: "Something went wrong saving your changes. Please try again." };
    }

    // Best-effort — see lib/notifications.js. No notification when the PR
    // just reached its final Approved state (no next signer, per scope).
    if (!advance.prApproved) {
        const nextTurn = getCurrentTurn({ ...pr, currentSignerStep: advance.nextStep }, signers);
        await notifyCurrentTurn({ pr, turn: nextTurn });
    } else {
        // Best-effort, but unlike notifications a failure here leaves a
        // real gap (an Approved PR with no PO) rather than just a missed
        // email — see lib/poGeneration.js. Never rolls back the approval
        // that just committed; app/prs/[prId]/page.js surfaces a manual
        // "generate PO" retry (generatePOAction below) when this fails.
        try {
            await generatePOForApprovedPR(pr);
        } catch (err) {
            console.error("Auto PO generation failed after PR approval (non-fatal, retry available on PR page)", err);
        }
    }

    redirect(`/prs/${pr.prId}?done=edited`);
}

export async function returnForCorrectionAction(prevState, formData) {
    const user = await requireUser();
    const prId = formData.get("prId");
    const targetValue = formData.get("target");
    const notes = formData.get("notes");

    if (!notes) {
        return { error: "Explain what needs to be corrected." };
    }

    const { pr, signers, correctionRequests } = await loadPRContext(prId);
    const turn = getCurrentTurn(pr, signers);

    if (!turn || turn.type !== "signer" || turn.userId !== user.id) {
        return { error: "It's not your turn to act on this PR." };
    }
    if (pr.status !== "In Review") {
        return { error: "This PR isn't currently in review." };
    }

    // Recompute the valid target set server-side rather than trusting the
    // submitted value — same reasoning as re-checking requireAdmin() in
    // every admin Server Action.
    const validTargets = getReturnTargets(pr, signers, turn.sequenceOrder);
    const target = validTargets.find((t) => t.value === targetValue);
    if (!target) {
        return { error: "Not a valid target for this PR's current step." };
    }

    const signerBefore = signers.find((s) => s.id === turn.prSignerRecordId);
    const targetStep = target.type === "requester" ? 0 : target.sequenceOrder;

    let createdCorrectionId = null;

    try {
        const correction = await createCorrectionRequest({
            prRecordId: pr.id,
            prId: pr.prId,
            initiatedById: user.id,
            sentToId: target.userId,
            notes,
        });
        createdCorrectionId = correction.id;

        await updateSigner(turn.prSignerRecordId, { status: "Returned" });
        await updatePR(pr.id, { currentSignerStep: targetStep });
    } catch (err) {
        if (createdCorrectionId) {
            await base(TABLES.CORRECTION_REQUESTS).destroy(createdCorrectionId).catch(() => {});
        }
        await updateSigner(turn.prSignerRecordId, {
            status: signerBefore.status,
            signedAt: signerBefore.signedAt || null,
            notes: signerBefore.notes || "",
        }).catch(() => {});

        console.error("returnForCorrectionAction failed, rolled back", err);
        return { error: "Something went wrong sending this back for correction. Please try again." };
    }

    // Best-effort — see lib/notifications.js.
    await notifyCurrentTurn({
        pr,
        turn: { type: target.type, userId: target.userId },
        context: `Returned for correction: ${notes}`,
    });

    redirect(`/prs/${pr.prId}?done=returned`);
}

/**
 * Manual fallback for when the auto-trigger in approveAction/
 * editAndContinueAction failed (see lib/poGeneration.js) — re-invokes the
 * exact same generation function. Safe to click more than once: it's a
 * no-op if a PO already exists for this PR (see generatePOForApprovedPR).
 */
export async function generatePOAction(prevState, formData) {
    await requireUser();
    const prId = formData.get("prId");

    const pr = await getPRById(prId);
    if (!pr) throw new Error("PR not found");

    // "PO Signed" is included alongside "Approved" (issue #63: PR Status
    // advances again once the President signs) — generatePOForApprovedPR
    // is a no-op once a PO already exists, so this stays safe to call in
    // either state; it's just that the retry form itself never renders
    // once a PO exists (see app/prs/[prId]/page.js).
    if (pr.status !== "Approved" && pr.status !== "PO Signed") {
        return { error: "This PR isn't fully approved yet." };
    }

    try {
        await generatePOForApprovedPR(pr);
    } catch (err) {
        console.error("Manual PO generation retry failed", err);
        return { error: "Something went wrong generating the PO. Please try again." };
    }

    redirect(`/prs/${pr.prId}?done=po-generated`);
}
