"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireUser } from "@/lib/authz";
import { TABLES } from "@/lib/airtable/client";
import {
    getDeliveryById,
    replaceDeliveryPhoto,
    updateDelivery,
} from "@/lib/airtable/deliveries";
import { getDeliveryItemsByRecordIds } from "@/lib/airtable/deliveryItems";
import { getDeliveriesByRecordIds } from "@/lib/airtable/deliveries";
import { confirmIngestThenDelete } from "@/lib/blobIngest";
import { describeOveragePreview } from "@/lib/overage";
import { createOverageDraft, getOverageContext } from "@/lib/overagePR";
import { canAccessJobDeliveries } from "@/lib/deliveryAccess";
import { deleteDeliveryAsUser } from "@/lib/deliveryDelete";
import { setDeliveryInvoiceAsUser } from "@/lib/deliveryInvoiceCandidates";

// Every export below gates on requireUser() and then compares per record, so none
// of lib/authz.js's role wrappers fits — the axis is Job membership or authorship,
// not a role. Same shape as withdrawPOAction (#138); each is listed as a requireUser
// exemption with that reason in scripts/tests/offline/authz-structure.mjs.

/**
 * Resolve a delivery the caller is allowed to touch, or a refusal.
 *
 * A delivery on a Job the caller cannot reach reads exactly like one that does
 * not exist — never confirm that a record exists outside someone's scope, the
 * same posture the PR and PO detail pages take.
 */
async function loadForEdit(user, deliveryId) {
    const delivery = await getDeliveryById(deliveryId);
    if (!delivery) return { error: "That delivery no longer exists." };
    if (!canAccessJobDeliveries(user, delivery.job?.[0])) {
        return { error: "That delivery no longer exists." };
    }
    return { delivery };
}

/**
 * Edit the received date and the note in place.
 *
 * These two and the photo are the only editable things on a delivery. The item,
 * the quantity, the vendor and the PO are not: changing any of them changes what
 * the arrival was allocated against, which would mean re-running allocation and
 * mutating or destroying existing Delivery Items. There is deliberately no
 * allocation-editing UI, so the correction for those is delete and re-enter.
 */
export async function updateDeliveryAction(prevState, formData) {
    const user = await requireUser();
    const deliveryId = formData.get("deliveryId");
    const receivedDate = formData.get("receivedDate");
    const notes = formData.get("notes") || "";

    if (!receivedDate) return { error: "Received Date is required." };

    const loaded = await loadForEdit(user, deliveryId);
    if (loaded.error) return loaded;

    try {
        await updateDelivery(loaded.delivery.id, { receivedDate, notes });
    } catch (err) {
        console.error("updateDeliveryAction failed", err);
        return { error: "Something went wrong saving this delivery. Please try again." };
    }

    redirect(`/deliveries/${encodeURIComponent(deliveryId)}?done=updated`);
}

/**
 * Swap the packing list photo for a freshly uploaded one.
 *
 * A separate action from the one above rather than one combined save, and that is
 * #142's rule made structural: a save path that rebuilt the attachment from
 * whatever url the form was carrying is exactly how a photo gets lost, because
 * re-submitting an url Airtable issued returns success and silently empties the
 * field once it has expired. Here a photo write happens only when the recorder
 * actually uploaded a new file, and replaceDeliveryPhoto refuses any url that is
 * not a fresh Blob upload, so the failure mode is unreachable rather than merely
 * avoided.
 */
export async function replaceDeliveryPhotoAction(prevState, formData) {
    const user = await requireUser();
    const deliveryId = formData.get("deliveryId");
    const url = formData.get("packingListUrl");
    const filename = formData.get("packingListFilename");

    if (!url) return { error: "Upload a photo first." };

    const loaded = await loadForEdit(user, deliveryId);
    if (loaded.error) return loaded;

    let updated;
    try {
        updated = await replaceDeliveryPhoto(loaded.delivery.id, { url, filename });
    } catch (err) {
        console.error("replaceDeliveryPhotoAction failed", err);
        return { error: "Something went wrong replacing the photo. Please try again." };
    }

    // Issue #140 — the write succeeded, so Airtable now holds the new photo and
    // the uploaded object has served its purpose. Outside any rollback and
    // scheduled rather than awaited, for the same reasons as every other upload
    // path. The photo Airtable previously held is simply overwritten, which is
    // what the recorder asked for; its Blob object was already deleted after its
    // own ingest, so nothing is orphaned by the swap.
    after(() =>
        confirmIngestThenDelete([
            {
                table: TABLES.DELIVERIES,
                recordId: updated.id,
                field: "Packing List File",
                blobUrl: url,
                attachmentId: updated.packingListFile?.[0]?.id,
                label: `packing list ${updated.deliveryId}`,
            },
        ])
    );

    redirect(`/deliveries/${encodeURIComponent(deliveryId)}?done=photo-replaced`);
}

/**
 * Attach the invoice this shipment is billed by, after the fact (#210).
 *
 * THE LATER-ATTACHMENT PATH, and it is an in-place edit rather than a second entry
 * screen because the pairing is ORTHOGONAL TO ALLOCATION. What this page refuses to
 * change — the item, the quantity, the vendor, the packing list PO — is refused on
 * one ground: changing it changes what the arrival was allocated against, and there
 * is deliberately no allocation-editing UI. An invoice link changes no `Delivery
 * Items` row, moves no quantity between orders and re-runs nothing, so that reason
 * does not reach it. It belongs with the received date, the note and the photo.
 *
 * WHY IT HAS TO EXIST AT ALL: the vendor usually emails the bill at shipment, so it
 * is normally on hand first — but not always, and an invoice nobody has entered yet
 * cannot be picked from a dropdown. Leaving it blank at entry is a normal answer,
 * which makes this the path that finishes the pairing.
 *
 * Every decision is in lib/deliveryInvoiceCandidates.js, which re-runs the row gate
 * from a fresh read; this contributes the session gate, the Job comparison and the
 * redirect.
 */
export async function attachDeliveryInvoiceAction(prevState, formData) {
    const user = await requireUser();
    const deliveryId = formData.get("deliveryId");
    const invoiceRecordId = formData.get("invoiceRecordId");

    const loaded = await loadForEdit(user, deliveryId);
    if (loaded.error) return loaded;

    const result = await setDeliveryInvoiceAsUser({
        user,
        delivery: loaded.delivery,
        invoiceRecordId,
        attach: true,
    });
    if (result.error) return result;

    redirect(`/deliveries/${encodeURIComponent(deliveryId)}?done=invoice-attached`);
}

/**
 * Detach an invoice from this shipment (#210).
 *
 * DETACH RATHER THAN SWAP, and the pair of separate controls is deliberate: an
 * invoice can only ever name one delivery, so re-pointing one is a claim about two
 * shipments at once. Making it two steps means the screen it left says so, and the
 * refusal `taken-by-another` stays truthful rather than being something the app
 * silently overrides.
 */
export async function detachDeliveryInvoiceAction(prevState, formData) {
    const user = await requireUser();
    const deliveryId = formData.get("deliveryId");
    const invoiceRecordId = formData.get("invoiceRecordId");

    const loaded = await loadForEdit(user, deliveryId);
    if (loaded.error) return loaded;

    const result = await setDeliveryInvoiceAsUser({
        user,
        delivery: loaded.delivery,
        invoiceRecordId,
        attach: false,
    });
    if (result.error) return result;

    redirect(`/deliveries/${encodeURIComponent(deliveryId)}?done=invoice-detached`);
}

/**
 * Delete a delivery and its delivery items.
 *
 * Deliberately a thin wrapper: everything that decides anything (authorship or
 * Admin) and the write itself live in lib/deliveryDelete.js, so the guard this
 * action enforces is the same object a verification script can call directly.
 * This file contributes only the two things that cannot leave Next — the session
 * gate and the redirect. Same arrangement as withdrawPOAction.
 */
export async function deleteDeliveryAction(prevState, formData) {
    const user = await requireUser();
    const deliveryId = formData.get("deliveryId");

    const delivery = await getDeliveryById(deliveryId);
    if (!delivery) return { error: "That delivery no longer exists." };
    // Job scope first, so someone outside it learns nothing about who recorded
    // what — the authorship comparison happens inside the shared write path.
    if (!canAccessJobDeliveries(user, delivery.job?.[0])) {
        return { error: "That delivery no longer exists." };
    }

    const result = await deleteDeliveryAsUser({ deliveryRecordId: delivery.id, actingUser: user });
    if (result.error) return result;

    redirect("/deliveries?done=deleted");
}

/**
 * Raise the corrective PR for one over-delivery (#167).
 *
 * JOB-SCOPED, not office-gated, per the issue: raising the request is site work.
 * That was a NARROWING of #166, which withheld invoice existence from site staff on
 * the deliveries LIST while this affordance and its preview deliberately revealed
 * that the over-delivered ordered item is billed, by which invoice and at what unit
 * price, because none of that can be hidden from someone raising a request quoted
 * from it. #211 THEN RELEASED THE LIST COLUMN TO EVERY VIEWER, so this is no longer
 * an exception to anything — the reasoning is kept because it is what the
 * disclosure here rests on, not because the contrast survives.
 *
 * RE-AUTHORIZES AND RE-DERIVES EVERYTHING. A Server Action is callable directly, so
 * the button having rendered proves nothing: the Job check runs again and
 * getOverageContext recomputes eligibility from a fresh read. A PO withdrawn or a
 * correction raised in another tab while this page sat open lands here as a refusal
 * rather than a second Draft.
 */
export async function createOverageDraftAction(prevState, formData) {
    const user = await requireUser();
    const deliveryItemId = formData.get("deliveryItemId");
    if (!deliveryItemId) return { error: "Nothing to correct." };

    const [row] = await getDeliveryItemsByRecordIds([deliveryItemId]);
    if (!row) return { error: "That delivery item no longer exists." };

    const delivery = row.delivery?.[0]
        ? (await getDeliveriesByRecordIds([row.delivery[0]]))[0]
        : null;
    if (!delivery || !canAccessJobDeliveries(user, delivery.job?.[0])) {
        return { error: "That delivery no longer exists." };
    }

    const context = (
        await getOverageContext([row], {
            deliveryIds: new Map([[delivery.id, delivery.deliveryId]]),
        })
    ).get(row.id);
    if (!context?.eligibility?.eligible) {
        // The pure module already words every refusal, so the action does not
        // invent a second phrasing for the same state.
        const [message] = describeOveragePreview(context?.eligibility ?? {}, context?.facts ?? {});
        return { error: message?.text ?? "This over-delivery cannot be corrected." };
    }

    if (!context.originalPR) return { error: "Couldn't find the request behind that order." };

    let result;
    try {
        result = await createOverageDraft({
            user,
            delivery,
            row,
            orderedItem: context.orderedItem,
            bill: context.bill,
            originalPR: context.originalPR,
        });
    } catch (err) {
        console.error("createOverageDraftAction failed", err);
        return { error: "Couldn't open the correction draft. Please try again." };
    }

    // Issue #140 — the END of this action's transaction, which is here: every write
    // has landed, so Airtable has the quotation file and the Blob object can go.
    // Never inside createOverageDraft, whose rollback has to leave the same url
    // available to a retry. Scheduled rather than awaited, which also survives the
    // redirect below throwing.
    after(() => confirmIngestThenDelete(result.blobCleanups));

    // Straight into the existing Draft resume path (#72), which loadPRDraft
    // hydrates — including the signer chain, so a requester can add whoever the
    // copy dropped for being inactive.
    redirect(`/prs/new?draft=${encodeURIComponent(result.pr.prId)}`);
}
