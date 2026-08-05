import { base, TABLES, findByRecordIds, getLinkedRecords } from "./client";
import { formulaString } from "../airtableFormula";
import { generateNextDeliveryId } from "../ids";
import { isOurBlobUrl } from "../blobIngest";

/**
 * A recorded arrival (#162). One Delivery per packing list; its quantity becomes
 * one or more Delivery Items, allocated by lib/deliveryAllocation.js.
 *
 * `Job` is a direct link rather than a lookup through PO, because a delivery may
 * name no PO at all — site orders first and the PR/PO follow as a record — and
 * the Job is what scopes both authorization and the item dropdown, so it has to
 * be present unconditionally.
 */
function recordToDelivery(record) {
    return {
        id: record.id,
        deliveryId: record.get("Delivery ID"),
        job: record.get("Job") || [],
        vendor: record.get("Vendor") || [],
        // Optional: the PO the packing list itself names, when it carries one.
        // Recorded even when allocation could attribute nothing to it, because
        // "the vendor's list quoted this PO" is a fact about the document.
        //
        // NAMED FOR THE DOCUMENT IT CAME OFF (#181). The field and this key were
        // both a bare `PO`, which reads as "the order this arrival was recorded
        // against" — a different thing living on a different table, since
        // allocation's answer is one `Delivery Items."PO Item"` per slice and it
        // is reached through the `Material` link rather than from this number.
        // The detail page has said `PO on packing list` since #162, so the name
        // was the only place the two could be confused.
        packingListPO: record.get("Packing List PO") || [],
        receivedDate: record.get("Received Date"),
        recordedBy: record.get("Recorded By") || [],
        createdAt: record.get("Created At"),
        notes: record.get("Notes"),
        packingListFile: record.get("Packing List File") || [],
        deliveryItems: record.get("Delivery Items") || [],
    };
}

export async function getDeliveryById(deliveryId) {
    const records = await base(TABLES.DELIVERIES)
        .select({
            filterByFormula: `{Delivery ID} = "${formulaString(deliveryId)}"`,
            maxRecords: 1,
        })
        .firstPage();

    if (records.length === 0) return null;
    return recordToDelivery(records[0]);
}

export async function getDeliveryByRecordId(recordId) {
    const record = await base(TABLES.DELIVERIES).find(recordId);
    if (!record) return null;
    return recordToDelivery(record);
}

/**
 * Many deliveries by record id, batched — the deliveries list reads each
 * accessible Job's `Deliveries` reverse link and resolves the union in one pass
 * rather than a `.find()` per row (#143's no-per-row-round-trip rule).
 */
export async function getDeliveriesByRecordIds(recordIds) {
    return (await findByRecordIds(TABLES.DELIVERIES, recordIds)).map(recordToDelivery);
}

/**
 * Create the delivery header. `Delivery ID` is backend-generated.
 *
 * `Packing List File` is written HERE and in replaceDeliveryPhoto below, and
 * nowhere else. See that function for why two writers is the whole of it.
 */
export async function createDelivery({
    jobRecordId,
    vendorRecordId,
    packingListPORecordId,
    receivedDate,
    recordedByUserId,
    notes,
    file,
}) {
    const record = await generateNextDeliveryId((deliveryId) =>
        base(TABLES.DELIVERIES).create({
            "Delivery ID": deliveryId,
            Job: jobRecordId ? [jobRecordId] : [],
            Vendor: vendorRecordId ? [vendorRecordId] : [],
            "Packing List PO": packingListPORecordId ? [packingListPORecordId] : [],
            "Received Date": receivedDate,
            "Recorded By": recordedByUserId ? [recordedByUserId] : [],
            // The moment of entry, distinct from Received Date on purpose:
            // material recorded days after it arrived is normal. #164 moved the
            // Delivery ID counter off this field onto the ID prefix, so it is no
            // longer load-bearing for the ID — it remains the deliveries list's
            // tie-break and the only timestamp on the record nobody typed.
            "Created At": new Date().toISOString(),
            Notes: notes || "",
            "Packing List File": file || [],
        })
    );

    return recordToDelivery(record);
}

/**
 * Edit the three things a delivery lets you change after the fact: the received
 * date and the note here, the photo in replaceDeliveryPhoto.
 *
 * DELIBERATELY HAS NO `file` PARAMETER, and must not grow one — the same rule
 * updateQuotation carries (#142). Re-submitting an attachment url Airtable
 * handed us hours earlier returns success and silently empties the field once
 * that url has expired, so a general-purpose updater that rebuilt the attachment
 * from whatever the form was carrying is exactly how a photo gets lost.
 *
 * The item, the quantity, the vendor and the packing list PO are absent for a different
 * reason: they are not editable at all. Changing them would mean re-running
 * allocation and mutating or destroying existing Delivery Items, and there is no
 * allocation-editing UI by design. Correcting those means deleting the delivery
 * and entering it again (lib/deliveryDelete.js).
 */
export async function updateDelivery(recordId, { receivedDate, notes }) {
    const fields = {};
    if (receivedDate !== undefined) fields["Received Date"] = receivedDate;
    if (notes !== undefined) fields["Notes"] = notes || "";

    const record = await base(TABLES.DELIVERIES).update(recordId, fields);
    return recordToDelivery(record);
}

/**
 * Swap the packing-list photo for a freshly uploaded one.
 *
 * The SECOND and last writer of `Packing List File`. Two writers rather than one
 * because the photo is genuinely editable in place, unlike a Quotation's file —
 * and the shape follows setPOItemMaterial (lib/airtable/poItems.js): the one
 * field a frozen-ish record lets you change after creation, written by one
 * narrow function that exists for that purpose alone.
 *
 * What makes it safe is the precondition, not discipline. #142's failure mode is
 * re-submitting an url Airtable ISSUED; this refuses any url that is not one of
 * ours, so that mode is unreachable here by construction rather than by a
 * caller remembering. A caller handing over an Airtable attachment url — which
 * is what a page re-render carries — gets a throw, not a silently emptied field.
 */
export async function replaceDeliveryPhoto(recordId, { url, filename }) {
    if (!isOurBlobUrl(url)) {
        throw new Error(
            "replaceDeliveryPhoto: refusing a url that is not a fresh Vercel Blob upload. " +
                "Re-submitting Airtable's own attachment url succeeds and empties the field once it expires (#142)."
        );
    }

    const record = await base(TABLES.DELIVERIES).update(recordId, {
        "Packing List File": [{ url, filename: filename || undefined }],
    });
    return recordToDelivery(record);
}

/**
 * Every delivery recorded against one Job, read through the Job's own
 * reverse-link — the shape CLAUDE.md's parent/child rule prescribes, and the
 * reason neither new table needed a `Job Record ID` lookup.
 */
export async function getDeliveriesByJob(jobRecordId) {
    const records = await getLinkedRecords(TABLES.JOBS, jobRecordId, "Deliveries", TABLES.DELIVERIES);
    return records.map(recordToDelivery);
}
