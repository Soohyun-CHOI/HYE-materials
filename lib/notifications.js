import { headers } from "next/headers";
import { getUserByRecordId, getPresidentUser } from "./airtable/users";
import { getPOByRecordId } from "./airtable/purchaseOrders";
import { getPRByRecordId } from "./airtable/purchaseRequests";
import { getVendorByRecordId } from "./airtable/vendors";
import { sendSignerTurnEmail, sendPOAwaitingSignatureEmail, sendPOSignedEmail } from "./email";

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
            prId: pr.prId,
            poId: po.poId,
            poUrl: `${baseUrl}/pos/${po.poId}`,
            vendorName: vendor?.vendorName || "—",
            totalAmount: po.totalAmount,
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
            prId: pr.prId,
            poId: po.poId,
            prUrl: `${baseUrl}/prs/${pr.prId}`,
            vendorName: vendor?.vendorName || "—",
            totalAmount: po.totalAmount,
        });
    } catch (err) {
        console.error("notifyPOSigned failed (non-fatal)", err);
    }
}
