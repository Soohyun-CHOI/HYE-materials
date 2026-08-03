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
import { confirmIngestThenDelete } from "@/lib/blobIngest";
import { canAccessJobDeliveries } from "@/lib/deliveryAccess";
import { deleteDeliveryAsUser } from "@/lib/deliveryDelete";

// All three exports below gate on requireUser() and then compare per record, so
// none of lib/authz.js's role wrappers fits — the axis is Job membership or
// authorship, not a role. Same shape as withdrawPOAction (#138); all three are
// listed as requireUser exemptions with that reason in
// scripts/tests/offline/authz-structure.mjs.

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
 * Delete a delivery and its lines.
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
