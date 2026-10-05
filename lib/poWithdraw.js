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
import { PO_SENT_STATUS } from "./poSend";
import { requesterOf } from "./prRequester";

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
const WITHDRAW_COPY = {
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
    /**
     * Issue #281 — a sent order, and this text is what the allowlist above has always
     * been for.
     *
     * #138 DECIDED THIS AND COULD NOT RENDER IT. That issue put `Sent to Vendor` out
     * of withdrawal's reach on the ground that by then calling the order off involves
     * the vendor, and put any in-app path for it after that point out of scope. #144
     * then removed the option, so no order could reach the state and the refusal had
     * no reader. #281 writes the status, which gives it one — the rule is #138's,
     * unchanged; only the sentence is new.
     *
     * WHY IT IS A SENTENCE RATHER THAN SILENCE. `wrong-status` renders nothing at all,
     * on the reasoning that there is nothing the requester can do. After a send there
     * is: the same thing `invoice-linked` says, one step further out. The order left
     * the app, so calling it off left the app with it, and a requester who just lost
     * a control they had a moment ago is owed the reason.
     */
    sent: "This PO has been sent to the vendor, so it can't be withdrawn here. Calling off an order the vendor already has means agreeing it with them first.",
};

/**
 * The single eligibility predicate (issue #138): status in {Awaiting
 * Signature, Signed} AND no invoice charging the order. Pure — no Airtable
 * calls, the caller passes an already-loaded PO — same contract as canViewPR
 * (lib/prVisibility.js). The link array it reads is core link data with no
 * propagation lag (see lib/airtable/client.js:getLinkedRecords), so a PO read
 * moments after an invoice item was created already reflects it.
 *
 * Returns { eligible, reason, status }. `reason` distinguishes the refusals so
 * the UI can say the right thing: "wrong-status" means no control at all,
 * "invoice-linked" means explain that an Admin has to unlink first, and "sent"
 * (#281) says why a sent order cannot be withdrawn here.
 *
 * Status is checked FIRST, and that ordering is load-bearing: a PO that fails
 * the status test and also has invoices must not be told "ask an Admin to
 * unlink", because unlinking wouldn't make it withdrawable either.
 *
 * "AN INVOICE CHARGES IT" IS THE ORDER'S OWN `Invoice Items` REVERSE-LINK AND
 * NOTHING ELSE (#492). That link is the far side of `Invoice Items."PO"`, which
 * every invoice item names, so it is the pairing itself rather than a copy of it.
 * Until #492 a second copy, one row per (invoice, order), was read first and this
 * array was only its safety net; the two agreed on every order on the base when
 * #492 measured them (docs/notes/purchase-orders.md). `offline/source-shape.mjs` holds
 * that this reads `invoiceItems` and `status` off the order and nothing else. What
 * it decides with them is held by `verify-po-withdraw-138.mjs` alone, since this
 * module reaches lib/airtable/ and the offline tier cannot load it.
 *
 * TWO STATES NOBODY HAS OBSERVED, NAMED HERE SO THEY ARE NOT DISCOVERED LATER.
 *   - An invoice item a failed rollback or delete left behind still names its
 *     order and still refuses: `createInvoiceAction` and `deleteInvoiceAction` both
 *     destroy invoice items in a `Promise.allSettled` whose results they discard.
 *     That is the direction to fail in — the row is on the base for an Admin to
 *     remove — and it is what the safety net already did.
 *   - `/pos/[poId]` lists the invoices charging an order through its ORDERED items
 *     (`PO Items."Invoice Items"`, the far side of `Invoice Items."PO Item"`), while
 *     this reads the order's own link. Every writer sets an invoice item's two links
 *     from one row and moves them together (#167's re-point), so both name one
 *     order; a hand edit splitting them would leave an order whose page lists no
 *     invoice and still refuses here. #492 counted 0 such invoice items.
 */
export function getPOWithdrawEligibility(po) {
    const hasLinkedInvoice = (po?.invoiceItems?.length || 0) > 0;

    // Issue #281 — a sent order is refused BY THE ALLOWLIST, which is #138's own
    // decision working rather than a rule this branch adds. What is new is that the
    // refusal is named: `wrong-status` renders nothing, and a requester who could
    // withdraw a minute ago needs the reason. Tested before the allowlist so the
    // narrower answer wins over the general one; both are the same refusal.
    if (po?.status === PO_SENT_STATUS) {
        return { eligible: false, reason: "sent", status: po.status };
    }
    if (!PO_WITHDRAWABLE_STATUSES.includes(po?.status)) {
        return { eligible: false, reason: "wrong-status", status: po?.status };
    }
    if (hasLinkedInvoice) {
        return { eligible: false, reason: "invoice-linked", status: po.status };
    }
    return { eligible: true, reason: null, status: po.status };
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
    if (requesterOf(pr) !== actingUserId) {
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
