"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { base, TABLES } from "@/lib/airtable/client";
import { createPR, updatePR, getPRsByLine } from "@/lib/airtable/purchaseRequests";
import { createItem, getItemsByPR } from "@/lib/airtable/prItems";
import { createSigner } from "@/lib/airtable/prSigners";
import { createQuotation } from "@/lib/airtable/quotations";
import { getUserByRecordId } from "@/lib/airtable/users";
import { notifyCurrentTurn } from "@/lib/notifications";

// Canonical key for an item's duplicate-match identity — Item Name
// (case/whitespace-insensitive) + Qty + Unit Price, per issue #61. Size/Unit/
// Remark deliberately excluded: the issue only calls out Name/Qty/Rate
// (Rate renamed to Unit Price in #78).
function itemKey(item) {
    return `${(item.itemName || "").trim().toLowerCase()}|${parseFloat(item.qty)}|${parseFloat(item.unitPrice)}`;
}

// Issue #61 — flags a PR as a likely re-submission when some prior PR on
// the same Line has the exact same set of items (Name/Qty/Unit Price, order
// and multiplicity insensitive). Checked against every prior PR on the Line
// regardless of Status, since even one already PO Signed is still a
// forgotten-resubmission candidate.
async function findDuplicatePR(lineId, items) {
    const submittedKey = items.map(itemKey).sort().join(",");

    const priorPRs = await getPRsByLine(lineId);
    for (const priorPr of priorPRs) {
        const priorItems = await getItemsByPR(priorPr.id);
        const priorKey = priorItems.map(itemKey).sort().join(",");
        if (priorKey !== submittedKey) continue;

        const requester = priorPr.requester?.[0]
            ? await getUserByRecordId(priorPr.requester[0])
            : null;

        return {
            priorPrId: priorPr.prId,
            // Issue #105 — now a full ISO timestamp (Created At); PRForm
            // formats it to a readable date in the browser's locale.
            priorDate: priorPr.createdAt,
            priorRequesterName: requester?.userName || "Unknown",
        };
    }

    return null;
}

// Bound to useActionState (see PRForm.js): takes (prevState, formData),
// returns { error } on a validation/write failure instead of throwing —
// same reasoning as app/admin/lines/new/actions.js.
export async function createPRAction(prevState, formData) {
    const user = await requireUser();

    const lineId = formData.get("lineId");
    const vendorId = formData.get("vendorId");
    const notes = formData.get("notes") || "";
    // Issue #69 — optional; the Requester leaves it blank when the
    // shipping cost isn't known yet at PR creation time.
    const shippingFeeRaw = formData.get("shippingFee");
    const shippingFee = shippingFeeRaw ? parseFloat(shippingFeeRaw) : null;
    const items = JSON.parse(formData.get("itemsJson") || "[]");
    // Each entry: { userId, confirmationType } — issue #66's per-signer
    // Approval/Agreement tag, picked by the Requester in SignerList.js.
    const signers = JSON.parse(formData.get("signersJson") || "[]");
    // Each entry: { url, filename, vendorQuotationCode } — issue #67: a
    // Vendor can send more than one Quotation, each becoming its own
    // Quotations record; PR Items.quotationIndex (below) picks which one.
    const quotations = JSON.parse(formData.get("quotationsJson") || "[]");
    const confirmed = formData.get("confirmed") === "true";

    if (!lineId) return { error: "Select a Line." };
    if (!vendorId) return { error: "Select a Vendor." };
    if (items.length === 0) {
        return { error: "Add at least one item." };
    }
    for (const item of items) {
        if (!item.itemName || !item.qty || !item.unitPrice) {
            return { error: "Every item needs a name, quantity, and unit price." };
        }
    }
    if (signers.length === 0) {
        return { error: "Assign at least one signer." };
    }
    if (shippingFeeRaw && Number.isNaN(shippingFee)) {
        return { error: "Shipping Fee must be a number." };
    }
    // At least one Quotation is required (not optional) — a PR always
    // needs the vendor's actual quote on file.
    if (quotations.length === 0) {
        return { error: "Add at least one quotation." };
    }
    // A Quotation entry with no file attached can't become a real
    // Quotations record — the Requester must either attach one or remove
    // the entry (PRForm.js disables Submit for this same reason; this is
    // the authoritative check).
    for (const quotation of quotations) {
        if (!quotation.url) {
            return { error: "Every quotation needs a file attached." };
        }
    }

    // Real submit-time check (this app has no separate Draft-save step —
    // reaching here already is the actual submission), skipped once the
    // Requester has confirmed past a previously-shown warning.
    if (!confirmed) {
        const duplicate = await findDuplicatePR(lineId, items);
        if (duplicate) {
            return { duplicateWarning: duplicate };
        }
    }

    let pr;
    const createdItemIds = [];
    const createdSignerIds = [];
    const createdQuotationIds = [];

    try {
        pr = await createPR({ requesterId: user.id, lineId, vendorId, notes, shippingFee });

        // Quotations are created before Items: each entry becomes its own
        // Quotations record ({PR ID}-Q{seq}), and an item's Quotation link
        // needs that real record id to point at — sequential (not
        // Promise.all) since generateChildId reads the PR's current
        // Quotations reverse-link count on each call to assign the next
        // seq, same reasoning as the Items/Signers loops below.
        for (const quotation of quotations) {
            const created = await createQuotation({
                prRecordId: pr.id,
                prId: pr.prId,
                vendorId,
                vendorQuotationCode: quotation.vendorQuotationCode,
                file: [{ url: quotation.url, filename: quotation.filename || undefined }],
            });
            createdQuotationIds.push(created.id);
        }

        for (const item of items) {
            // 0 Quotations: no link at all. Exactly 1: every item auto-
            // links to it, regardless of quotationIndex (PRForm.js hides
            // the picker in this case, so quotationIndex is meaningless
            // here). 2+: quotationIndex picks which one, defaulting to the
            // first if somehow unset (matches the <select>'s own default).
            const quotationRecordId =
                createdQuotationIds.length === 0
                    ? null
                    : createdQuotationIds.length === 1
                      ? createdQuotationIds[0]
                      : createdQuotationIds[item.quotationIndex ?? 0];

            const created = await createItem({
                prRecordId: pr.id,
                prId: pr.prId,
                itemName: item.itemName,
                size: item.size,
                unit: item.unit,
                qty: parseFloat(item.qty),
                unitPrice: parseFloat(item.unitPrice),
                remark: item.remark,
                quotationRecordId,
            });
            createdItemIds.push(created.id);
        }

        for (let i = 0; i < signers.length; i++) {
            const created = await createSigner({
                prRecordId: pr.id,
                prId: pr.prId,
                signerUserId: signers[i].userId,
                sequenceOrder: i + 1,
                confirmationType: signers[i].confirmationType,
            });
            createdSignerIds.push(created.id);
        }

        // Creating a PR here means the Requester has finished assigning
        // signers in the same step — submission IS the start of the review
        // chain, not a Draft left for later. Current Signer Step: 1 means
        // the first signer's turn.
        await updatePR(pr.id, { status: "In Review", currentSignerStep: 1 });
    } catch (err) {
        // Best-effort compensating rollback: Airtable has no cross-table
        // transactions, so a failure partway through (e.g. the 3rd signer
        // fails to create) would otherwise leave a half-built PR behind.
        // Delete everything created so far, in reverse order, so a failed
        // submission leaves no trace rather than a confusing partial PR.
        if (pr) {
            await Promise.allSettled([
                ...createdSignerIds.map((id) => base(TABLES.PR_SIGNERS).destroy(id)),
                ...createdItemIds.map((id) => base(TABLES.PR_ITEMS).destroy(id)),
                ...createdQuotationIds.map((id) => base(TABLES.QUOTATIONS).destroy(id)),
            ]);
            await base(TABLES.PURCHASE_REQUESTS)
                .destroy(pr.id)
                .catch(() => {});
        }

        console.error("createPRAction failed, rolled back", err);
        return { error: "Something went wrong creating the PR. Please try again." };
    }

    // Best-effort — see lib/notifications.js. Signer #1 is signers[0]
    // (Sequence Order 1, the PR's starting Current Signer Step).
    await notifyCurrentTurn({ pr, turn: { type: "signer", userId: signers[0].userId } });

    redirect(`/prs/new?created=${encodeURIComponent(pr.prId)}`);
}
