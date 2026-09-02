"use server";

import { redirect } from "next/navigation";
import { requireUser, withPresidentAction } from "@/lib/authz";
import { getPOById, updatePO } from "@/lib/airtable/purchaseOrders";
import { getPRByRecordId, updatePR } from "@/lib/airtable/purchaseRequests";
import { getVendorByRecordId } from "@/lib/airtable/vendors";
import { getUserByRecordId } from "@/lib/airtable/users";
import { generateAndAttachPOPdf, HYE_BUYER_NAME } from "@/lib/poPdf";
import { notifyPOSigned } from "@/lib/notifications";
import { isPOWithdrawn, withdrawPOAsRequester } from "@/lib/poWithdraw";
import { canSendPOToVendor, getPOSendEligibility, PO_SENT_STATUS, SEND_COPY } from "@/lib/poSend";
import { sendPOToVendorEmail } from "@/lib/email";
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

        redirect(`/pos/${po.poId}`);
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
 * WHOEVER MAY SEND THE ORDER MAY PRODUCE THE DOCUMENT IT NEEDS (#281). It was
 * President-only and the page offered it to the whole office, so five of eleven users
 * saw a button that could only throw. Rather than pick one of those two, both moved to
 * `canSendPOToVendor`: sending an order is placing it, which is the requester's act as
 * much as the office's, and a requester who may send but must ask somebody else to
 * generate is blocked with no signal that they are.
 *
 * IT NOW REFUSES AN ORDER THAT ALREADY HAS A DOCUMENT, and that is a narrowing of this
 * function's contract to what the screen has always offered. The docstring said it
 * "always re-generates … there's no equivalent 'already succeeded, don't redo it'
 * case", but `page.js` renders the control only inside the `!pdfFile` branch, so the
 * overwrite has never been reachable. Closing it matters because **the PO document is
 * only a PARTIAL snapshot**: the items and the money are frozen, while the vendor, the
 * job, every address, both internal contacts and the President are read live at
 * generation time. A second generation would therefore produce a DIFFERENT document,
 * and some of the differences misstate history — a changed President would put another
 * name in the signature block of an order somebody else signed. See
 * `docs/notes/purchase-orders.md` before reopening this.
 *
 * THE UNSIGNED REFUSAL IS UNCHANGED. The document is produced by the signature and
 * there is no reason to draft one nobody has signed.
 */
export async function regeneratePDFAction(prevState, formData) {
    return withOpsLabel("regeneratePDFAction", async () => {
        const user = await requireUser();
        const poId = formData.get("poId");

        const po = await getPOById(poId);
        if (!po) throw new Error("PO not found");

        const pr = po.pr?.[0] ? await getPRByRecordId(po.pr[0]) : null;
        if (!canSendPOToVendor(user, pr)) {
            return { error: SEND_COPY.notYours };
        }

        // Issue #138 — the PO PDF *is* the document sent to the vendor.
        // Regenerating it after a withdrawal would print a fresh formal order
        // for an order that was canceled, which is exactly the confusion
        // Withdrawn exists to prevent. The line is "no new documents, existing
        // document preserved": an already-generated PDF stays available on
        // the PO page (the PO did exist and was signed — that's audit trail),
        // only the regeneration control goes away.
        if (isPOWithdrawn(po)) {
            return { error: "This PO was withdrawn — its PDF can't be regenerated." };
        }
        if (!po.presidentSigned) {
            return { error: "This PO hasn't been signed yet." };
        }
        // #281 — the contract narrowed to what the screen offers, and it is tested
        // LAST so the two refusals above keep the precedence they had: a withdrawn
        // order is a more useful thing to be told than "nothing to generate". See the
        // docstring — regenerating over an existing document would produce a different
        // one, from live party data the signature never saw.
        if (po.poPdfFile?.[0]) {
            return { error: SEND_COPY.documentExists };
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

        redirect(`/pos/${po.poId}`);
    });
}

/**
 * Issue #281 — emails the signed order to the vendor, with the PDF attached.
 *
 * THE REQUESTER OR THE OFFICE, WHICH IS `canSendPOToVendor` AND NOT A ROLE. Sending
 * the order with its document attached IS placing the order, so this is the act #138
 * built the requester's withdrawal control around; the office is here too because not
 * sending stops the work where not withdrawing stops nothing. That module has the
 * whole argument. `requireUser()` rather than a wrapper for the same reason
 * `withdrawPOAction` uses one: the deciding comparison is per record, and a role
 * wrapper would cover the half that was never at risk.
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
export async function sendPOToVendorAction(prevState, formData) {
    return withOpsLabel("sendPOToVendorAction", async () => {
        // ONE READ FOR THE GATE AND THE REPLY-TO BOTH. `requireUser()` returns the
        // user, so the sender's address costs nothing beyond the session check — where
        // a role wrapper would have decided the gate and discarded it, which is the
        // #193 measurement #254 reported.
        const sender = await requireUser();
        const poId = formData.get("poId");

        const po = await getPOById(poId);
        if (!po) throw new Error("PO not found");

        // The vendor lives through the PR, because `Purchase Orders."Vendor"` is a
        // Lookup and carries the NAME rather than a record id. The same walk
        // lib/notifications.js:notifyPOSigned makes — and since #281 this read is
        // load-bearing for authorization too, since the requester is on the PR.
        const pr = po.pr?.[0] ? await getPRByRecordId(po.pr[0]) : null;
        if (!canSendPOToVendor(sender, pr)) {
            return { error: SEND_COPY.notYours };
        }
        const vendor = pr?.vendor?.[0] ? await getVendorByRecordId(pr.vendor[0]) : null;

        // Every refusal is re-asked here regardless of what the page rendered: a
        // Server Action is directly callable, so the page hiding the control is not a
        // gate. The predicate is the one the page reads.
        const eligibility = getPOSendEligibility({ po, vendorEmail: vendor?.picEmail });
        // TWO PEOPLE MAY SEND NOW, SO TWO CAN PRESS AT ONCE (#281). The second one's
        // screen is a moment stale and their button still works; `Sent At` is what
        // refuses them, which is the same judgment that refuses a resend. What they get
        // is a NOTICE and not an error: nothing went wrong, the vendor has the order,
        // and the form renders this away from the red box.
        if (eligibility.reason === "already-sent") {
            // The sender's NAME costs one read, and only here — the collision path,
            // not the send. Worth it because "already sent" without who is the answer
            // that makes somebody go and ask.
            const already = po.sentBy?.[0] ? await getUserByRecordId(po.sentBy[0]) : null;
            return {
                notice: SEND_COPY.alreadySent({
                    address: po.sentTo || "—",
                    when: new Date(po.sentAt).toLocaleString(),
                    by: already?.userName || null,
                }),
            };
        }
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
                    // The field, not a rendering of it (#292) — the builder formats.
                    totalAmount: po.totalAmount,
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

        redirect(`/pos/${po.poId}`);
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

        redirect(`/pos/${result.poId}`);
    });
}
