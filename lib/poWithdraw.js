// Requester-driven PO withdrawal (issue #138) — the whole concern in one
// module: the eligibility predicate, both voices of the user-facing copy,
// and the guarded write. "Where does the withdraw rule live" has exactly
// one answer, so the UI and the server can never drift apart on it.
//
// Why the PO and not the PR: an Approved PR really was approved and its
// signer chain records that, and "PO Signed" is terminal, so the PR side
// can't express a signed order that never went out. PR Withdrawn (#122)
// stays In Review-only and is untouched by this module.

import { getPOById, updatePO, PO_WITHDRAWN_STATUS } from "./airtable/purchaseOrders";
import { getPRByRecordId } from "./airtable/purchaseRequests";

/**
 * The only two statuses a withdrawal can start from. An allowlist, not an
 * exclusion list, and that direction is deliberate: any status outside these
 * two is refused by default, so an option added to the Airtable field later
 * cannot become withdrawable without a matching change here. Policy, not
 * vocabulary — the Status option names themselves live with the table module
 * (purchaseOrders.js).
 */
export const PO_WITHDRAWABLE_STATUSES = ["Awaiting Signature", "Signed"];

/**
 * The two voices, side by side on purpose (issue #138): `modal` addresses
 * the requester who is about to act (second person, future), `banner`
 * addresses whoever later opens the PO (third person, past). Both branch on
 * the SAME condition — whether the president signature is recorded — and
 * keeping the pairs adjacent in one object is the point: a later change to
 * one voice can't quietly leave the other describing the old behavior.
 *
 * Modal bodies take the PO ID (a confirmation dialog must name what it's
 * acting on); banners don't (they render directly under the page's PO ID
 * heading). Resolve these on the server and pass plain strings to the
 * client component — functions can't cross the boundary.
 */
export const WITHDRAW_COPY = {
    modal: {
        unsigned: {
            title: "Withdraw this PO?",
            body: (poId) =>
                `${poId} hasn't been signed yet, so withdrawing it ends the plan to order these materials. It stays on record as Withdrawn and can no longer be signed or invoiced. This can't be undone.`,
        },
        signed: {
            title: "Withdraw this PO?",
            body: (poId) =>
                `${poId} was signed, but no order went out and no invoice is expected. Withdrawing records that. The signature and the signed PO document stay on record; the PO can no longer be invoiced. This can't be undone.`,
        },
    },
    banner: {
        unsigned:
            "Withdrawn — the requester ended the plan to order before this PO was signed. It can't be signed or invoiced.",
        signed:
            "Withdrawn — this PO was signed, but no order went out and no invoice is expected. The signed document stays on record.",
    },
};

/**
 * Resolves both voices for one PO in a single call, so the president-
 * signature branch is evaluated once per render rather than once per
 * message.
 */
export function getWithdrawCopy(presidentSigned) {
    const key = presidentSigned ? "signed" : "unsigned";
    return { modal: WITHDRAW_COPY.modal[key], banner: WITHDRAW_COPY.banner[key] };
}

/**
 * Server-side refusal messages, keyed by the predicate's `reason` so the
 * write path and the page can't disagree about what a refusal means.
 */
export const WITHDRAW_REFUSAL = {
    "wrong-status": "This PO can no longer be withdrawn.",
    "invoice-linked":
        "An invoice is already linked to this PO, so it can't be withdrawn. An Admin has to unlink it first.",
};

/**
 * The single eligibility predicate (issue #138): status in {Awaiting
 * Signature, Signed} AND no linked invoice. Pure — no Airtable calls, the
 * caller passes an already-loaded PO — same contract as canViewPR
 * (lib/prVisibility.js). Both link arrays it reads are core link data with
 * no propagation lag (see lib/airtable/client.js:getLinkedRecords), so a
 * PO read moments after an invoice was linked already reflects it.
 *
 * Returns { eligible, reason, status, linkedInvoiceCount }. `reason`
 * distinguishes the two refusals so the UI can say the right thing:
 * "wrong-status" means no control at all, "invoice-linked" means explain
 * that an Admin has to unlink first.
 *
 * Status is checked FIRST, and that ordering is load-bearing: a PO that fails
 * the status test and also has invoices must not be told "ask an Admin to
 * unlink", because unlinking wouldn't make it withdrawable either.
 *
 * linkedInvoiceCount counts Invoice-PO Link join rows, which is exactly one
 * per invoice (see app/invoices/new/actions.js — one join row per distinct
 * PO, not per ordered item). The Invoice Items reverse-link only contributes to the
 * boolean, as a safety net: createInvoiceAction's rollback is best-effort
 * (Promise.allSettled), so an Invoice Item could in principle outlive its
 * join row, and a PO with invoice items pointing at it is not withdrawable
 * whatever the join table says.
 */
export function getPOWithdrawEligibility(po) {
    const linkedInvoiceCount = po?.invoicePoLinks?.length || 0;
    const strandedInvoiceItems = po?.invoiceItems?.length || 0;
    const hasLinkedInvoice = linkedInvoiceCount > 0 || strandedInvoiceItems > 0;

    if (!PO_WITHDRAWABLE_STATUSES.includes(po?.status)) {
        return { eligible: false, reason: "wrong-status", status: po?.status, linkedInvoiceCount };
    }
    if (hasLinkedInvoice) {
        return { eligible: false, reason: "invoice-linked", status: po.status, linkedInvoiceCount };
    }
    return { eligible: true, reason: null, status: po.status, linkedInvoiceCount: 0 };
}

/**
 * The inverse guard used by the invoice side (#138). Deliberately NOT
 * getPOWithdrawEligibility(): the two rules are inverses only at the level
 * of this one Status value. Reusing the full predicate to gate invoicing
 * would refuse a second invoice against a partly invoiced PO, which is
 * routine — being un-withdrawable is not the same as being un-invoiceable.
 * What they share is the status name, not the rule.
 */
export function isPOWithdrawn(po) {
    return po?.status === PO_WITHDRAWN_STATUS;
}

/**
 * Withdraws a PO on behalf of the parent PR's requester: re-reads the PO,
 * re-checks identity and eligibility, then writes. Every check sits before
 * the single updatePO() call, and that call is the only mutation here, so a
 * refused attempt leaves nothing behind.
 *
 * `actingUserId` is the caller's Users record id — the one thing the Server
 * Action derives from the session (requireUser().id). Keeping the decision
 * and the write in this plain module, with identity as a parameter, is what
 * lets scripts/tests exercise the real guard instead of a copy of it: the
 * action itself is unimportable outside Next (iron-session cookies,
 * redirect()), so nothing decision-shaped may live there.
 *
 * Ownership is per-record, so there is no lib/authz.js role helper to use
 * beyond the session gate the caller already applied: requireRole/
 * requireAdmin only report a decision (and would block nothing here), and
 * requirePresident is the wrong axis — the requester is not the President.
 *
 * Identity is checked before eligibility so a non-requester learns nothing
 * about the PO's invoicing state, matching withdrawAction (#122).
 *
 * Airtable has no transactions and withKeyLock only serializes in-process,
 * so an invoice linked in a different invocation between the re-read and
 * the write would still land — a documented residual, narrowed (not
 * closed) by re-reading here rather than trusting the page's copy.
 */
export async function withdrawPOAsRequester({ poId, actingUserId }) {
    const po = await getPOById(poId);
    if (!po) return { error: "PO not found." };

    const pr = po.pr?.[0] ? await getPRByRecordId(po.pr[0]) : null;
    if (!pr) return { error: "PO not found." };
    if (pr.requester?.[0] !== actingUserId) {
        return { error: "Only the requester can withdraw this PO." };
    }

    const eligibility = getPOWithdrawEligibility(po);
    if (!eligibility.eligible) {
        return { error: WITHDRAW_REFUSAL[eligibility.reason], reason: eligibility.reason };
    }

    try {
        // One write, both fields (#138) — the timestamp is part of the same
        // operation as the status, mirroring the PR side.
        await updatePO(po.id, {
            status: PO_WITHDRAWN_STATUS,
            withdrawnAt: new Date().toISOString(),
        });
    } catch (err) {
        console.error("withdrawPOAsRequester failed", err);
        return { error: "Something went wrong withdrawing this PO. Please try again." };
    }

    return { ok: true, poId: po.poId };
}
