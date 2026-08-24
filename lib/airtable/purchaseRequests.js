import { base, TABLES, getLinkedRecords, findByRecordIds } from "./client";
import { formulaString } from "../airtableFormula";
import { generateNextPRId } from "../ids";

/**
 * Find a PR by its backend-generated PR ID (e.g. "HYE-PR-260710-07").
 * Returns null if not found.
 */
export async function getPRById(prId) {
    const records = await base(TABLES.PURCHASE_REQUESTS)
        .select({
            filterByFormula: `{PR ID} = "${formulaString(prId)}"`,
            maxRecords: 1,
        })
        .firstPage();

    if (records.length === 0) return null;

    return recordToPR(records[0]);
}

/**
 * Find a PR by its Airtable record ID.
 * Returns null if not found.
 */
/**
 * Many PRs by record id, batched (#19).
 *
 * This is what keeps the material-axis screens at zero per-row round trips.
 * `canViewPR` is pure and needs only an already-loaded PR — status, requester,
 * job, `signerRowIds`, `correctionRowIds` — all of which recordToPR exposes. So
 * one query per 50 POs' parents is enough to judge every row on the page, the
 * same property #143 established for the PR list.
 */
export async function getPRsByRecordIds(recordIds) {
    return (await findByRecordIds(TABLES.PURCHASE_REQUESTS, recordIds)).map(recordToPR);
}

export async function getPRByRecordId(recordId) {
    const record = await base(TABLES.PURCHASE_REQUESTS).find(recordId);
    if (!record) return null;
    return recordToPR(record);
}

function recordToPR(record) {
    return {
        id: record.id,
        prId: record.get("PR ID"),
        requester: record.get("Requester"),
        line: record.get("Line"),
        job: record.get("Job"), // Lookup via Line — read-only, auto-follows the picked Line
        vendor: record.get("Vendor"),
        // Issue #105 — migrated from date-only "Created Date" to a
        // timestamped "Created At" (datetime), matching the *At convention
        // used by Signed At / Requested At / Resolved At. Stored as a UTC
        // ISO instant; display converts to viewer-local via toLocaleString.
        createdAt: record.get("Created At"),
        status: record.get("Status"),
        // Issue #122 — set once when a Requester withdraws a still-In-Review
        // PR (Status -> Withdrawn). UTC ISO instant, *At convention; blank
        // for every PR that was never withdrawn. Drives the History timeline
        // entry on the detail page.
        withdrawnAt: record.get("Withdrawn At"),
        currentSignerStep: record.get("Current Signer Step"),
        // Issue #78 — renamed from "Total Amount": rollup of PR Items only,
        // before Shipping Fee.
        itemsSubtotal: record.get("Items Subtotal"),
        // Issue #69 — optional, entered by the Requester when the shipping
        // cost is already known at PR creation time. Total Amount (renamed
        // from "Grand Total" in #78) is a formula (Items Subtotal +
        // Shipping Fee, blank treated as 0) — the PR's true final figure.
        shippingFee: record.get("Shipping Fee"),
        totalAmount: record.get("Total Amount"),
        notes: record.get("Notes"),
        // Reverse-link, core link data (no propagation lag) — used to check
        // "does this PR already have a PO" without filtering the Purchase
        // Orders table by a link field (see CLAUDE.md's required
        // parent/child querying pattern).
        purchaseOrders: record.get("Purchase Orders") || [],
        // Issue #143 — this PR's child row ids, same reverse-link trick as
        // purchaseOrders above. canViewPR intersects them with the same two
        // arrays on the Users record to answer "is this user a signer on this
        // PR" and "was a correction on this PR sent to them" without reading
        // either child table. That is what keeps the PR list's visibility gate
        // at zero queries per row.
        signerRowIds: record.get("PR Signers") || [],
        correctionRowIds: record.get("Correction Requests") || [],
        // Issue #193 — the remaining three child levels, exposed for the same
        // reason and at the same price as the two above: they are already on the
        // record this mapper was handed. A page holding a PR can now read every
        // child level without re-finding the PR once per level, which is what made
        // /prs/[prId] fetch the same request six times in one render.
        itemRowIds: record.get("PR Items") || [],
        editLogRowIds: record.get("Edit Log") || [],
        quotationRowIds: record.get("Quotations") || [],
        // Issue #167 — the Delivery Items rows whose excess this PR corrects, the
        // reverse of Delivery Items."Overage PR". Same reverse-link trick again:
        // it is what lets an overage PR's own page, and an overage PO one hop
        // further through its `PR` link, render the banner with no extra query.
        // Empty on every ordinary PR, which is almost all of them.
        overageDeliveryItemRowIds: record.get("Overage Delivery Items") || [],
        // Issue #272 — the reverse of Direct Purchases."Purchase Request", and the
        // second half of what lib/prKind.js reads. Same trick and same price as the
        // line above: the array is on the record this mapper was handed, so the
        // request's KIND costs no query on any screen holding one. It is also the
        // ONLY place that kind is stored — a `Kind` field would be a second home for
        // what this link already says, and nothing would fail if a future write path
        // forgot to set it. Empty on every ordinary request.
        directPurchaseRowIds: record.get("Direct Purchases") || [],
    };
}

/**
 * List all prior PRs raised against a Line, via the Line's own reverse-link
 * field — used to check for duplicate submissions (issue #61). Includes
 * every Status (Draft/In Review/Approved/PO Signed): a PR already turned
 * into a signed PO is still a "previous submission" for this purpose.
 */
export async function getPRsByLine(lineRecordId) {
    const records = await getLinkedRecords(
        TABLES.LINES,
        lineRecordId,
        "Purchase Requests",
        TABLES.PURCHASE_REQUESTS
    );

    return records.map(recordToPR);
}

/**
 * List a Requester's Draft PRs, most-recent first (by Created At). Read via
 * the Users -> "Purchase Requests" reverse-link (the reverse of PR.Requester)
 * per CLAUDE.md's parent/child querying rule — filterByFormula can't match a
 * link field by record ID. Issue #73 resumes the single most recent (index
 * 0); #74 will list them all.
 */
export async function getDraftsByRequester(userRecordId) {
    const records = await getLinkedRecords(
        TABLES.USERS,
        userRecordId,
        "Purchase Requests",
        TABLES.PURCHASE_REQUESTS
    );

    return records
        .map(recordToPR)
        .filter((pr) => pr.status === "Draft")
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

/**
 * List every submitted PR (Status != Draft — i.e. In Review / Approved / PO
 * Signed / Withdrawn), most-recently-created first (Created At, #105). A
 * Withdrawn PR (issue #122) is still a submitted PR and stays in this list so
 * it remains visible/distinguishable, not hidden like a Draft. Drafts are excluded
 * (the drafts list modal, #74, owns those). Status is a plain select field, so
 * filtering it by formula is fine (unlike a link field). Row-level visibility
 * — requester / job scoping for non-admins — is applied by the list page
 * (issue #119), not here: this returns all submitted PRs. Full fetch with no
 * pagination, same as the invoice list (#115); revisit if PR counts grow large.
 */
export async function getSubmittedPRs() {
    const records = await base(TABLES.PURCHASE_REQUESTS)
        .select({
            filterByFormula: `{Status} != "Draft"`,
            sort: [{ field: "Created At", direction: "desc" }],
        })
        .all();

    return records.map(recordToPR);
}

/**
 * Every fully approved PR, whether or not it has a purchase order (#176).
 *
 * NARROWER THAN getSubmittedPRs ON PURPOSE, and the difference is what the
 * `/pos` strip costs as this base grows. That reader returns every non-Draft
 * PR — In Review and Withdrawn included — which the strip would then throw away
 * in JS; Airtable pages a select at 100 records, so the wider query is more
 * operations for the same answer as soon as there are a few hundred requests.
 * `Status` is a plain select, so filtering it server-side is fine — CLAUDE.md's
 * rule bars matching a LINK field in a formula, which is a different thing.
 *
 * WHETHER A PO EXISTS IS NOT ASKED HERE. `Purchase Orders` is a reverse-link and
 * a formula sees it as its primary-field text, so there is no emptiness test
 * worth trusting; the caller reads `purchaseOrders.length` off the mapped record
 * instead, which is what lib/poGeneration.js already does before it decides to
 * generate. Sorting is the caller's too — lib/poListView.js:selectPRsAwaitingPO
 * owns it, so the offline tier can pin the order without a base.
 */
export async function getApprovedPRs() {
    const records = await base(TABLES.PURCHASE_REQUESTS)
        .select({
            filterByFormula: `OR({Status} = "Approved", {Status} = "PO Signed")`,
        })
        .all();

    return records.map(recordToPR);
}

/**
 * Create a new PR. PR ID is backend-generated via lib/ids.js — never
 * passed in by the caller. Items Subtotal is a rollup and Total Amount is
 * a formula (issue #78) — both read-only. The Requester picks a Line, not
 * a Job directly — Job is a Lookup through Line and can't be written here
 * (see CLAUDE.md's Purchase Requests entry).
 */
export async function createPR({ requesterId, lineId, vendorId, notes, shippingFee }) {
    const record = await generateNextPRId((prId) =>
        base(TABLES.PURCHASE_REQUESTS).create({
            "PR ID": prId,
            Requester: requesterId ? [requesterId] : [],
            Line: lineId ? [lineId] : [],
            Vendor: vendorId ? [vendorId] : [],
            // Issue #105 — full UTC timestamp (was a date-only slice), so
            // PRs can be ordered by true creation time, not just by day.
            "Created At": new Date().toISOString(),
            Status: "Draft",
            Notes: notes || "",
            // Issue #69 — optional; omitted entirely (not written as 0)
            // when the Requester doesn't know it yet.
            ...(shippingFee !== undefined && shippingFee !== null ? { "Shipping Fee": shippingFee } : {}),
        })
    );

    return { id: record.id, prId: record.get("PR ID") };
}

/**
 * Partial update of a PR — e.g. Status transitions, Current Signer Step
 * advances. Only the fields passed in are written. Shipping Fee is only
 * ever written here via the Edit and continue flow (see
 * app/prs/[prId]/actions.js) — never through a free-standing "edit PR"
 * path, same enforcement style as PR Items' Unit Price (issue #69).
 */
export async function updatePR(
    recordId,
    { status, currentSignerStep, notes, shippingFee, lineId, vendorId, withdrawnAt }
) {
    const fields = {};
    if (status !== undefined) fields["Status"] = status;
    if (currentSignerStep !== undefined)
        fields["Current Signer Step"] = currentSignerStep;
    if (notes !== undefined) fields["Notes"] = notes;
    // Issue #122 — stamped when a Requester withdraws (alongside Status ->
    // Withdrawn). Only ever written here, never cleared.
    if (withdrawnAt !== undefined) fields["Withdrawn At"] = withdrawnAt;
    if (shippingFee !== undefined) fields["Shipping Fee"] = shippingFee;
    // Issue #72 — Draft re-save can change the picked Line/Vendor between
    // saves. Both are single-record link fields; an empty string clears the
    // link (a Draft is allowed to have neither set yet).
    if (lineId !== undefined) fields["Line"] = lineId ? [lineId] : [];
    if (vendorId !== undefined) fields["Vendor"] = vendorId ? [vendorId] : [];

    const record = await base(TABLES.PURCHASE_REQUESTS).update(recordId, fields);
    return recordToPR(record);
}
