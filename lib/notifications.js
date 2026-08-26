import { headers } from "next/headers";
import { getUserByRecordId, getPresidentUser } from "./airtable/users";
import { getPOByRecordId } from "./airtable/purchaseOrders";
import { getPRByRecordId } from "./airtable/purchaseRequests";
import { getVendorByRecordId } from "./airtable/vendors";
import { sendSignerTurnEmail, sendPOAwaitingSignatureEmail, sendPOSignedEmail } from "./email";
import { SIGNED_NOTICE_COPY } from "./poSend";
import { AWAITING_SIGNATURE_COPY } from "./poUnsigned";

async function getBaseUrl() {
    const h = await headers();
    const host = h.get("host");
    const protocol = host?.startsWith("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https";
    return `${protocol}://${host}`;
}

/**
 * Best-effort "it's your turn" notification for whoever the signing chain
 * now points at (see lib/prSigning.js:getCurrentTurn). Never throws — a
 * failed send must not block or roll back the PR action that triggered it
 * (create/approve/edit-and-continue/return-for-correction), since the
 * Airtable state change this is notifying about is already durably
 * committed by the time this runs. Errors are logged, not surfaced.
 *
 * Scope: only the "next signer" case (per product decision) — no
 * notification when a PR reaches its final Approved state.
 */
export async function notifyCurrentTurn({ pr, turn, context }) {
    if (!turn) return;

    try {
        const user = await getUserByRecordId(turn.userId);
        if (!user?.email) return;

        const baseUrl = await getBaseUrl();
        await sendSignerTurnEmail({
            to: user.email,
            prId: pr.prId,
            prUrl: `${baseUrl}/prs/${pr.prId}`,
            context,
        });
    } catch (err) {
        console.error("notifyCurrentTurn failed (non-fatal)", err);
    }
}

/**
 * Best-effort "PO awaiting signature" notification to the President, fired
 * once a PO is generated from a fully-approved PR (issue #101). Re-fetches
 * the PO itself rather than trusting a caller-supplied object: Items
 * Subtotal/Total Amount are rollup/formula fields that aren't populated
 * until after PO Items are attached, which happens after the PO record is
 * first created (see lib/poGeneration.js). Never throws — same contract as
 * notifyCurrentTurn; a failed email must not block PO generation.
 */
export async function notifyPOAwaitingSignature({ poRecordId, pr }) {
    try {
        const [po, president] = await Promise.all([
            getPOByRecordId(poRecordId),
            getPresidentUser(),
        ]);
        if (!president?.email) {
            console.warn("notifyPOAwaitingSignature: no active President user found, skipping email");
            return;
        }

        const vendor = pr.vendor?.[0] ? await getVendorByRecordId(pr.vendor[0]) : null;

        const baseUrl = await getBaseUrl();
        await sendPOAwaitingSignatureEmail({
            to: president.email,
            subject: AWAITING_SIGNATURE_COPY.subject({ poId: po.poId }),
            html: AWAITING_SIGNATURE_COPY.html({
                poId: po.poId,
                prId: pr.prId,
                poUrl: `${baseUrl}/pos/${po.poId}`,
                vendorName: vendor?.vendorName || "—",
                // THE FIELD, NOT A RENDERING OF IT (#292). The builder formats; a
                // `formatUSD(...)` here would hand it a string, which coerces to
                // `$0.00` and says so to nobody. offline/mail-money.mjs pins the shape
                // of this one property for that reason.
                totalAmount: po.totalAmount,
            }),
        });
    } catch (err) {
        console.error("notifyPOAwaitingSignature failed (non-fatal)", err);
    }
}

/**
 * Best-effort "PO signed" notification to the PR's Requester, fired once
 * the President signs the PO (issue #101). Self-contained like
 * notifyPOAwaitingSignature — walks PO -> PR -> Requester/Vendor itself
 * rather than requiring the caller to pre-resolve the chain. Never throws;
 * a failed email must not roll back the signature that already committed.
 *
 * IT POINTS AT THE ORDER SINCE #290, and the sibling above is what makes that the
 * ordinary shape rather than a new one: notifyPOAwaitingSignature has always sent the
 * President a `${baseUrl}/pos/${po.poId}` link, so the requester's mail pointing at
 * the request was the odd one out. #281 settled what the mail has to say — sending the
 * order to the vendor IS placing it, and the requester may do it — so this one now
 * carries an instruction and its destination is where the instruction is carried out.
 * The words are `lib/poSend.js:SIGNED_NOTICE_COPY`'s.
 *
 * THE REQUESTER IS STILL THE ONLY RECIPIENT, and #281 already wrote the reason the
 * office does not join them: what an office reader needs is every signed order nobody
 * has sent, which is a strip above `/pos` in #176's shape (recorded in
 * docs/notes/purchase-orders.md as work this app has not done yet) and not one mail per
 * signature to each of five Admins. There is no office ADDRESS to send to — only a set
 * of users carrying `Is Admin` — so widening this would be an alert policy rather than
 * a recipient.
 */
export async function notifyPOSigned({ poRecordId }) {
    try {
        const po = await getPOByRecordId(poRecordId);
        const prRecordId = po.pr?.[0];
        if (!prRecordId) return;

        const pr = await getPRByRecordId(prRecordId);
        if (!pr?.requester?.[0]) {
            console.warn("notifyPOSigned: PR has no Requester, skipping email");
            return;
        }

        const [requester, vendor] = await Promise.all([
            getUserByRecordId(pr.requester[0]),
            pr.vendor?.[0] ? getVendorByRecordId(pr.vendor[0]) : null,
        ]);
        if (!requester?.email) {
            console.warn("notifyPOSigned: Requester has no email, skipping email");
            return;
        }

        const baseUrl = await getBaseUrl();
        await sendPOSignedEmail({
            to: requester.email,
            subject: SIGNED_NOTICE_COPY.subject({ poId: po.poId }),
            html: SIGNED_NOTICE_COPY.html({
                poId: po.poId,
                prId: pr.prId,
                // THE ONE THING THAT MUST NOT BE FORGOTTEN HERE. A missing property is
                // not an error anywhere: the builder interpolates it, the mail goes,
                // the signature succeeds, and the reader gets a link to `undefined`.
                // offline/po-signed-notice.mjs asserts this property by name for that
                // reason. Same form as notifyPOAwaitingSignature's above.
                poUrl: `${baseUrl}/pos/${po.poId}`,
                vendorName: vendor?.vendorName || "—",
                // #233's rule reaches the mail: this figure went out raw until #290,
                // so a total of 220.00000000000003 on the base printed all of it. The
                // `formatUSD` call that fixed it lived here until #292 moved it into
                // the builder, which is where a caller cannot skip it.
                totalAmount: po.totalAmount,
            }),
        });
    } catch (err) {
        console.error("notifyPOSigned failed (non-fatal)", err);
    }
}
