"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { getPOById, updatePO } from "@/lib/airtable/purchaseOrders";
import { getPRByRecordId, updatePR } from "@/lib/airtable/purchaseRequests";
import { generateAndAttachPOPdf } from "@/lib/poPdf";

// Issue #63 — the linked PR's Status only ever reaches "Approved" (see
// app/prs/[prId]/actions.js's finishTurn): PO creation happens
// synchronously at that same moment, so a PR-level "Converted to PO"
// status was never reachable in practice. President-signing is the
// moment a Requester actually cares about ("this is confirmed and going
// to the vendor"), so that's when the PR's Status advances to "PO
// Signed" instead. Best-effort, same tier as PDF generation below — the
// PO's own President Signed/At fields are the real evidence; this is
// just a derived label on the PR, so a failure here must never roll
// back the signature that already committed. Idempotent (no-op if the
// PR is already PO Signed) so it's safe to re-run from
// regeneratePDFAction's retry.
async function syncPRStatusToPOSigned(po) {
    const prRecordId = po.pr?.[0];
    if (!prRecordId) return;

    try {
        const pr = await getPRByRecordId(prRecordId);
        if (pr && pr.status !== "PO Signed") {
            await updatePR(pr.id, { status: "PO Signed" });
        }
    } catch (err) {
        console.error(
            "Syncing PR status to PO Signed failed (non-fatal, retried on next Regenerate PDF click)",
            err
        );
    }
}

// Server Actions are directly callable regardless of what the page renders,
// so the President-only check happens here too, independently of
// app/pos/[poId]/page.js's own requireRole() check — same principle as
// every other role-gated action in this project (see lib/authz.js).
async function requirePresident() {
    const { authorized } = await requireRole("President");
    if (!authorized) {
        throw new Error("Only the President can sign a PO.");
    }
}

/**
 * Signs the PO (President Signed/At + Status -> "Signed"), then generates
 * and attaches the PDF in the same action. The two are deliberately in
 * separate try/catches: a PDF failure must never roll back the signature
 * that was just committed — the signing action is real evidence, same
 * principle as PR approvals never being undone by a later step (see
 * CLAUDE.md's evidence model). If PDF generation fails here, the PO is
 * left "Signed" with no PO PDF File, and app/pos/[poId]/page.js surfaces a
 * "Regenerate PDF" retry (regeneratePDFAction below) rather than silently
 * leaving the gap unaddressed.
 */
export async function signPOAction(prevState, formData) {
    await requirePresident();
    const poId = formData.get("poId");

    const po = await getPOById(poId);
    if (!po) throw new Error("PO not found");
    if (po.presidentSigned) {
        return { error: "This PO has already been signed." };
    }

    const signedAt = new Date().toISOString();

    try {
        await updatePO(po.id, {
            presidentSigned: true,
            presidentSignedAt: signedAt,
            status: "Signed",
        });
    } catch (err) {
        console.error("signPOAction failed to record signature", err);
        return { error: "Something went wrong recording your signature. Please try again." };
    }

    try {
        await generateAndAttachPOPdf(po.id);
    } catch (err) {
        // Non-fatal by design (see comment above) — rolling back the
        // signature here would contradict the "an approval, once made,
        // stands" model. It stays committed; the retry lives on the PO
        // page (regeneratePDFAction).
        console.error("PDF generation failed after PO signing (non-fatal, retry available on PO page)", err);
    }

    await syncPRStatusToPOSigned(po);

    redirect(`/pos/${po.poId}?done=signed`);
}

/**
 * Manual retry for when signPOAction's PDF step failed. Always re-generates
 * (not a no-op like #10's generatePOAction) since this overwrites whatever
 * PO PDF File currently holds, rather than skipping if one already exists —
 * there's no equivalent "already succeeded, don't redo it" case here the
 * way there is for PO creation.
 */
export async function regeneratePDFAction(prevState, formData) {
    await requirePresident();
    const poId = formData.get("poId");

    const po = await getPOById(poId);
    if (!po) throw new Error("PO not found");
    if (!po.presidentSigned) {
        return { error: "This PO hasn't been signed yet." };
    }

    // Independent of the PDF retry below — also catches up a PR whose
    // Status sync failed back in signPOAction (see syncPRStatusToPOSigned).
    await syncPRStatusToPOSigned(po);

    try {
        await generateAndAttachPOPdf(po.id);
    } catch (err) {
        console.error("Manual PDF regeneration failed", err);
        return { error: "Something went wrong generating the PDF. Please try again." };
    }

    redirect(`/pos/${po.poId}?done=pdf-regenerated`);
}
