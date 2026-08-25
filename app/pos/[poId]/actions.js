"use server";

import { redirect } from "next/navigation";
import { requireUser, withAdminAction, withPresidentAction } from "@/lib/authz";
import { getPOById, updatePO } from "@/lib/airtable/purchaseOrders";
import { getPRByRecordId, updatePR } from "@/lib/airtable/purchaseRequests";
import { getVendorByRecordId } from "@/lib/airtable/vendors";
import { getCurrentUser } from "@/lib/session";
import { generateAndAttachPOPdf, HYE_BUYER_NAME } from "@/lib/poPdf";
import { notifyPOSigned } from "@/lib/notifications";
import { isPOWithdrawn, withdrawPOAsRequester } from "@/lib/poWithdraw";
import { getPOSendEligibility, PO_SENT_STATUS, SEND_COPY } from "@/lib/poSend";
import { sendPOToVendorEmail } from "@/lib/email";
import { formatUSD } from "@/lib/format";
import { withOpsLabel } from "@/lib/airtableOps";

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
export const signPOAction = withPresidentAction(signPOHandler);

async function signPOHandler(prevState, formData) {
    return withOpsLabel("signPOAction", async () => {
        const poId = formData.get("poId");

        const po = await getPOById(poId);
        if (!po) throw new Error("PO not found");
        // Issue #138 — without this, "Withdrawn" wouldn't be terminal at all:
        // signing writes Status -> "Signed" below and syncPRStatusToPOSigned
        // then advances the PR, so a signature after a withdrawal would
        // resurrect the whole thing. The page hides SignForm for a withdrawn
        // PO, but Server Actions are directly callable, so the real gate is
        // here.
        if (isPOWithdrawn(po)) {
            return { error: "This PO was withdrawn and can no longer be signed." };
        }
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

        // Best-effort — see lib/notifications.js. Independent of PDF generation
        // below: the signature is the real evidence, same principle as the
        // rest of this action.
        await notifyPOSigned({ poRecordId: po.id });

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
    });
}

/**
 * Manual retry for when signPOAction's PDF step failed. Always re-generates
 * (not a no-op like #10's generatePOAction) since this overwrites whatever
 * PO PDF File currently holds, rather than skipping if one already exists —
 * there's no equivalent "already succeeded, don't redo it" case here the
 * way there is for PO creation.
 */
/**
 * ADMIN SINCE #281, WHERE IT WAS PRESIDENT-ONLY, AND THE PAGE IS WHAT FORCED THE
 * CHOICE. `page.js` rendered this control on President-or-Admin while the action
 * refused everyone but the President, so five of the eleven users on this base saw a
 * button that could only throw. One of the two had to move, and the office is the
 * side that handles the order document — the same convention that puts invoicing
 * behind Admin and that #281's send control follows. Signing went the other way, to
 * President on both sides.
 *
 * WHAT THIS COSTS is a President who is not an Admin, who could regenerate before and
 * cannot now. Nobody on this base is one, and the President's act here is the
 * signature.
 *
 * THE UNSIGNED REFUSAL BELOW IS UNCHANGED. The PDF is generated at signing and there
 * is no reason to make a draft of a document nobody has signed.
 */
export const regeneratePDFAction = withAdminAction(
    () => ({ error: "Only office staff can regenerate this PO's document." }),
    regeneratePDFHandler
);

async function regeneratePDFHandler(prevState, formData) {
    return withOpsLabel("regeneratePDFAction", async () => {
        const poId = formData.get("poId");

        const po = await getPOById(poId);
        if (!po) throw new Error("PO not found");
        // Issue #138 — the PO PDF *is* the document sent to the vendor.
        // Regenerating it after a withdrawal would print a fresh formal order
        // for an order that was canceled, which is exactly the confusion
        // Withdrawn exists to prevent. The line is "no new documents, existing
        // document preserved": an already-generated PDF stays downloadable on
        // the PO page (the PO did exist and was signed — that's audit trail),
        // only the regeneration control goes away.
        if (isPOWithdrawn(po)) {
            return { error: "This PO was withdrawn — its PDF can't be regenerated." };
        }
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
    });
}

/**
 * Issue #281 — emails the signed order to the vendor, with the PDF attached.
 *
 * ADMIN RATHER THAN PRESIDENT, WHICH IS WHERE THIS DIVERGES FROM THE TWO CONTROLS
 * BESIDE IT. CLAUDE.md's own account of the workflow is that the President signs and
 * "office staff send that PDF to the vendor"; gating to Admin is what scopes something
 * to the office. Signing stays the President's.
 *
 * THE SEND HAPPENS BEFORE THE RECORD, AND THAT ORDERING IS THE WHOLE SAFETY PROPERTY.
 * `sendPOToVendorEmail` throws on a real failure — the Resend SDK returns
 * `{ data, error }` rather than rejecting, so an unchecked call makes a failed send
 * look like a success — and this function only writes after it returns. A failed send
 * therefore leaves the order exactly as it was, which is also what makes pressing
 * again a FIRST send rather than a second.
 *
 * THE REVERSE FAILURE GETS ITS OWN MESSAGE. If the mail goes and the write does not,
 * the vendor has the order and the record does not say so; the one thing the reader
 * must not do is assume it never went, so `SEND_COPY.recordFailed` says it did.
 *
 * NO `notify*` WRAPPER. `lib/notifications.js` swallows every failure because the
 * state change it reports on is already committed; here the send is the action and
 * nothing is committed until it succeeds.
 */
export const sendPOToVendorAction = withAdminAction(
    () => ({ error: "Only office staff can send a PO to the vendor." }),
    sendPOToVendorHandler
);

async function sendPOToVendorHandler(prevState, formData) {
    return withOpsLabel("sendPOToVendorAction", async () => {
        const poId = formData.get("poId");

        // The wrapper decides the gate and discards the user it loaded
        // (lib/authzWrap.js:createFlagGuard), so the sender's address costs one read
        // here. Reported to #193 as a measurement rather than fixed, since changing
        // that contract touches every wrapped action.
        const sender = await getCurrentUser();

        const po = await getPOById(poId);
        if (!po) throw new Error("PO not found");

        // The vendor lives through the PR, because `Purchase Orders."Vendor"` is a
        // Lookup and carries the NAME rather than a record id. The same walk
        // lib/notifications.js:notifyPOSigned makes.
        const pr = po.pr?.[0] ? await getPRByRecordId(po.pr[0]) : null;
        const vendor = pr?.vendor?.[0] ? await getVendorByRecordId(pr.vendor[0]) : null;

        // Every refusal is re-asked here regardless of what the page rendered: a
        // Server Action is directly callable, so the page hiding the control is not a
        // gate. The predicate is the one the page reads.
        const eligibility = getPOSendEligibility({ po, vendorEmail: vendor?.picEmail });
        if (!eligibility.eligible) {
            return { error: SEND_COPY.refusal[eligibility.reason] };
        }

        const pdf = po.poPdfFile[0];
        let attachmentContent;
        try {
            // Airtable's attachment URLs live about two hours, so this is fetched from
            // the record read moments ago and never stored. Not an Airtable API
            // operation, so the ops counter cannot see it — see
            // docs/notes/airtable-access.md on the count being a floor.
            const res = await fetch(pdf.url);
            if (!res.ok) throw new Error(`attachment fetch ${res.status}`);
            attachmentContent = Buffer.from(await res.arrayBuffer()).toString("base64");
        } catch (err) {
            console.error("sendPOToVendorAction could not read the PO document", err);
            return { error: SEND_COPY.sendFailed };
        }

        try {
            await sendPOToVendorEmail({
                to: vendor.picEmail,
                replyTo: sender.email,
                subject: SEND_COPY.mail.subject({ poId: po.poId, buyerName: HYE_BUYER_NAME }),
                html: SEND_COPY.mail.html({
                    poId: po.poId,
                    buyerName: HYE_BUYER_NAME,
                    vendorName: vendor.vendorName || "—",
                    totalAmount: formatUSD(po.totalAmount),
                    senderName: sender.userName || sender.email,
                }),
                attachment: {
                    filename: pdf.filename || SEND_COPY.mail.fallbackFilename(po.poId),
                    content: attachmentContent,
                },
            });
        } catch (err) {
            console.error("sendPOToVendorAction failed to send", err);
            return { error: SEND_COPY.sendFailed };
        }

        try {
            // One write, all four keys — the status and the event's three facts
            // together, mirroring the withdrawal's status-plus-timestamp pair.
            await updatePO(po.id, {
                status: PO_SENT_STATUS,
                sentAt: new Date().toISOString(),
                sentBy: sender.id,
                sentTo: vendor.picEmail,
            });
        } catch (err) {
            console.error("sendPOToVendorAction sent the mail but could not record it", err);
            return { error: SEND_COPY.recordFailed };
        }

        redirect(`/pos/${po.poId}?done=sent`);
    });
}

/**
 * Issue #138 — the parent PR's requester withdraws a PO they've decided not
 * to order after all. Deliberately a thin wrapper: everything that decides
 * anything (identity, status, no-linked-invoice) and the write itself live
 * in lib/poWithdraw.js:withdrawPOAsRequester, so the guard this action
 * enforces is the same object a verification script can call directly —
 * this file contributes only the two things that can't leave Next, the
 * session gate and the redirect.
 *
 * requireUser() is the right helper here and requireAdmin()/requireRole()
 * would be wrong twice over: they only *report* a decision (a caller that
 * ignores the flag protects nothing), and the axis isn't a role at all —
 * withdrawal is scoped to one record's requester, compared per record
 * inside withdrawPOAsRequester.
 */
export async function withdrawPOAction(prevState, formData) {
    return withOpsLabel("withdrawPOAction", async () => {
        const user = await requireUser();
        const poId = formData.get("poId");

        const result = await withdrawPOAsRequester({ poId, actingUserId: user.id });
        // Errors come back to the open modal; only success falls through.
        if (result.error) return result;

        redirect(`/pos/${result.poId}?done=withdrawn`);
    });
}
