"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { base, TABLES } from "@/lib/airtable/client";
import {
    createPR,
    updatePR,
    getPRByRecordId,
    getPRsByLine,
} from "@/lib/airtable/purchaseRequests";
import { createItem, getItemsByPR } from "@/lib/airtable/prItems";
import { createSigner, getSignersByPR } from "@/lib/airtable/prSigners";
import { createQuotation, getQuotationsByPR } from "@/lib/airtable/quotations";
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
async function findDuplicatePR(lineId, items, excludeRecordId = null) {
    const submittedKey = items.map(itemKey).sort().join(",");

    const priorPRs = await getPRsByLine(lineId);
    for (const priorPr of priorPRs) {
        // Issue #72 — a resumed Draft is itself a PR on this Line with these
        // same items, so skip it or it would always match itself on submit.
        if (excludeRecordId && priorPr.id === excludeRecordId) continue;
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

// Both the Draft-save and the submit actions read the same set of hidden
// form fields — parse them in one place.
function parseFormState(formData) {
    const shippingFeeRaw = formData.get("shippingFee");
    return {
        lineId: formData.get("lineId") || "",
        vendorId: formData.get("vendorId") || "",
        notes: formData.get("notes") || "",
        shippingFeeRaw,
        // Issue #69 — optional; null (not 0) when left blank.
        shippingFee: shippingFeeRaw ? parseFloat(shippingFeeRaw) : null,
        items: JSON.parse(formData.get("itemsJson") || "[]"),
        // Each entry: { userId, confirmationType } — issue #66's per-signer
        // Approval/Agreement tag, picked in SignerList.js.
        signers: JSON.parse(formData.get("signersJson") || "[]"),
        // Each entry: { url, filename, vendorQuotationCode } — issue #67.
        quotations: JSON.parse(formData.get("quotationsJson") || "[]"),
        // Issue #72 — set once a Draft has been saved/resumed; both save and
        // submit then re-target that record instead of creating a new PR.
        existingDraftRecordId: formData.get("existingDraftRecordId") || null,
        confirmed: formData.get("confirmed") === "true",
    };
}

// Blank numeric fields on a Draft become undefined so createItem omits them
// rather than writing NaN into Airtable's number columns.
function toNumberOrUndefined(value) {
    if (value === "" || value == null) return undefined;
    const n = parseFloat(value);
    return Number.isNaN(n) ? undefined : n;
}

// A row the Requester never touched shouldn't be persisted as a Draft item.
function isEmptyItemRow(item) {
    return !(
        (item.itemName && String(item.itemName).trim()) ||
        (item.size && String(item.size).trim()) ||
        item.unit ||
        (item.qty !== "" && item.qty != null) ||
        (item.unitPrice !== "" && item.unitPrice != null) ||
        (item.remark && String(item.remark).trim())
    );
}

async function collectChildIds(prRecordId) {
    const [items, signers, quotations] = await Promise.all([
        getItemsByPR(prRecordId),
        getSignersByPR(prRecordId),
        getQuotationsByPR(prRecordId),
    ]);
    return {
        itemIds: items.map((i) => i.id),
        signerIds: signers.map((s) => s.id),
        quotationIds: quotations.map((q) => q.id),
    };
}

async function destroyChildren({ itemIds = [], signerIds = [], quotationIds = [] }) {
    // Items link to Quotations, so drop items/signers before the quotations
    // they point at.
    await Promise.allSettled([
        ...signerIds.map((id) => base(TABLES.PR_SIGNERS).destroy(id)),
        ...itemIds.map((id) => base(TABLES.PR_ITEMS).destroy(id)),
    ]);
    await Promise.allSettled(quotationIds.map((id) => base(TABLES.QUOTATIONS).destroy(id)));
}

// Shared persistence for both the Draft-save and the submit paths (issue
// #72). On a first save it creates the PR record (Status: Draft, via
// createPR). On a re-save of an existing Draft it updates the scalar fields
// and rebuilds the children from the current form state.
//
// Children are rebuilt "create the new generation, then delete the old one"
// rather than the reverse, so a failure partway through leaves the previous
// generation intact — a re-save never loses already-saved children. On a
// first-save failure the freshly created PR record is removed too, so a
// failed save leaves no trace (same guarantee the original submit had).
async function persistPRFromForm({ userId, state }) {
    const { existingDraftRecordId, lineId, vendorId, notes, shippingFee, items, signers, quotations } =
        state;

    let pr;
    let oldChildIds = null;

    if (existingDraftRecordId) {
        const existing = await getPRByRecordId(existingDraftRecordId);
        if (!existing) throw new Error("Draft record not found");
        pr = { id: existing.id, prId: existing.prId };
        oldChildIds = await collectChildIds(existing.id);
        await updatePR(existing.id, { lineId, vendorId, notes, shippingFee });
    } else {
        pr = await createPR({ requesterId: userId, lineId, vendorId, notes, shippingFee });
    }

    const createdQuotationIds = [];
    const createdItemIds = [];
    const createdSignerIds = [];

    try {
        // Quotations first — each becomes its own record and items link to
        // them. Index-aligned with the form array (null for skipped
        // entries) so item.quotationIndex still maps correctly. A Draft
        // keeps any entry with a file OR a typed code; fully-empty entries
        // are dropped (issue #72 decision).
        const quotationByIndex = [];
        for (const q of quotations) {
            const code = (q.vendorQuotationCode || "").trim();
            if (!q.url && !code) {
                quotationByIndex.push(null);
                continue;
            }
            const created = await createQuotation({
                prRecordId: pr.id,
                prId: pr.prId,
                vendorId,
                vendorQuotationCode: q.vendorQuotationCode,
                file: q.url ? [{ url: q.url, filename: q.filename || undefined }] : [],
            });
            quotationByIndex.push(created.id);
            createdQuotationIds.push(created.id);
        }
        const persistedQuotationIds = quotationByIndex.filter(Boolean);

        for (const item of items) {
            if (isEmptyItemRow(item)) continue;
            // 0 kept quotations: no link. Exactly 1: every item auto-links to
            // it. 2+: quotationIndex picks which (defaulting to the first);
            // that slot may have been dropped, in which case no link.
            const quotationRecordId =
                persistedQuotationIds.length === 0
                    ? null
                    : persistedQuotationIds.length === 1
                      ? persistedQuotationIds[0]
                      : quotationByIndex[item.quotationIndex ?? 0] ?? null;

            const created = await createItem({
                prRecordId: pr.id,
                prId: pr.prId,
                itemName: item.itemName,
                size: item.size,
                unit: item.unit,
                qty: toNumberOrUndefined(item.qty),
                unitPrice: toNumberOrUndefined(item.unitPrice),
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
    } catch (err) {
        // Roll back only the generation we just created; any previous
        // generation is still present and untouched.
        await destroyChildren({
            itemIds: createdItemIds,
            signerIds: createdSignerIds,
            quotationIds: createdQuotationIds,
        });
        if (!existingDraftRecordId && pr) {
            await base(TABLES.PURCHASE_REQUESTS).destroy(pr.id).catch(() => {});
        }
        throw err;
    }

    // Success — on a re-save, drop the previous generation of children now
    // that the new one is fully in place.
    if (oldChildIds) {
        await destroyChildren(oldChildIds);
    }

    return { pr };
}

// Issue #72 — persist the in-progress PR as a Draft. Deliberately skips the
// full submit-time validation (Line/Vendor/items/signers/quotations may all
// be incomplete or empty) and the duplicate-PR check. Bound to useActionState
// in PRForm.js; returns { savedDraft } or { error } rather than redirecting,
// so the Requester stays on the form and can keep editing.
export async function saveDraftAction(prevState, formData) {
    const user = await requireUser();
    const state = parseFormState(formData);

    if (state.shippingFeeRaw && Number.isNaN(state.shippingFee)) {
        return { error: "Shipping Fee must be a number." };
    }

    try {
        const { pr } = await persistPRFromForm({ userId: user.id, state });
        return { savedDraft: { prId: pr.prId, recordId: pr.id } };
    } catch (err) {
        console.error("saveDraftAction failed", err);
        return { error: "Couldn't save the draft. Please try again." };
    }
}

// Bound to useActionState (see PRForm.js): takes (prevState, formData),
// returns { error }/{ duplicateWarning } on a validation/write failure
// instead of throwing — same reasoning as app/admin/lines/new/actions.js.
export async function createPRAction(prevState, formData) {
    const user = await requireUser();
    const state = parseFormState(formData);
    const { lineId, vendorId, items, signers, quotations, shippingFee, shippingFeeRaw, confirmed } =
        state;

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

    // Submit-time check, skipped once the Requester has confirmed past a
    // previously-shown warning.
    if (!confirmed) {
        const duplicate = await findDuplicatePR(lineId, items, state.existingDraftRecordId);
        if (duplicate) {
            return { duplicateWarning: duplicate };
        }
    }

    let pr;
    try {
        const result = await persistPRFromForm({ userId: user.id, state });
        pr = result.pr;
        // Submission starts the review chain — whether this PR began as a
        // fresh form or a resumed Draft (issue #72), reaching here is the
        // actual submission. Current Signer Step 1 = the first signer's turn.
        // The same record transitions Draft -> In Review, keeping its PR ID,
        // Created At, and history continuous.
        await updatePR(pr.id, { status: "In Review", currentSignerStep: 1 });
    } catch (err) {
        // persistPRFromForm already rolled back its own partial writes (and,
        // for a fresh submit, the PR record itself). A failure in the status
        // flip after a successful persist leaves a resumable Draft rather
        // than a corrupt half-PR, which is acceptable.
        console.error("createPRAction failed", err);
        return { error: "Something went wrong creating the PR. Please try again." };
    }

    // Best-effort — see lib/notifications.js. Signer #1 is signers[0]
    // (Sequence Order 1, the PR's starting Current Signer Step).
    await notifyCurrentTurn({ pr, turn: { type: "signer", userId: signers[0].userId } });

    redirect(`/prs/new?created=${encodeURIComponent(pr.prId)}`);
}
