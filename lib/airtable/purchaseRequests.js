import { base, TABLES, getLinkedRecords } from "./client";
import { generateNextPRId } from "../ids";

/**
 * Find a PR by its backend-generated PR ID (e.g. "HYE-PR-260710-07").
 * Returns null if not found.
 */
export async function getPRById(prId) {
    const records = await base(TABLES.PURCHASE_REQUESTS)
        .select({
            filterByFormula: `{PR ID} = "${prId}"`,
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
export async function updatePR(recordId, { status, currentSignerStep, notes, shippingFee }) {
    const fields = {};
    if (status !== undefined) fields["Status"] = status;
    if (currentSignerStep !== undefined)
        fields["Current Signer Step"] = currentSignerStep;
    if (notes !== undefined) fields["Notes"] = notes;
    if (shippingFee !== undefined) fields["Shipping Fee"] = shippingFee;

    const record = await base(TABLES.PURCHASE_REQUESTS).update(recordId, fields);
    return recordToPR(record);
}
