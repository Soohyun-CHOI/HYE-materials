import { base, TABLES, findByRecordIds, getLinkedRecords } from "./client";
import { formulaString } from "../airtableFormula";
import { assertOurBlobFiles } from "../fileSource";
import { generateNextDeliveryId } from "../ids";

/**
 * A recorded delivery (#162). One Delivery per packing list; its quantity becomes
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
        // both a bare `PO`, which reads as "the order this delivery was recorded
        // against" — a different thing living on a different table, since
        // allocation's answer is one `Delivery Items."PO Item"` per slice and it
        // is reached through the `Material` link rather than from this number.
        // The detail page has said `PO on packing list` since #162, so the name
        // was the only place the two could be confused.
        packingListPO: record.get("Packing List PO") || [],
        receivedDate: record.get("Received Date"),
        // Issue #387 — where this delivery actually arrived, chosen at entry and
        // defaulted from the orders it attaches to. A SEPARATE FACT from where the
        // material was ordered to, which is `Purchase Orders."Delivery Address"`:
        // the order says where it was meant to go and this says where it turned up.
        //
        // EMPTY ON THE 12 DELIVERIES RECORDED BEFORE THE FIELD EXISTED, which were
        // not backfilled — 11 of them attach to orders that record no address
        // either. So a reader has to survive the blank; what it must not do is
        // fall back to the job's, which is the live read this whole address chain
        // removed (see lib/deliveryAddress.js).
        deliveryAddress: record.get("Delivery Address") || [],
        recordedBy: record.get("Recorded By") || [],
        createdAt: record.get("Created At"),
        notes: record.get("Notes"),
        packingListFile: record.get("Packing List File") || [],
        deliveryItems: record.get("Delivery Items") || [],
        // Issue #210 — the reverse of Invoices."Delivery": the invoices that name this
        // delivery. PLURAL, and the asymmetry with the singular on the far side IS
        // the n:1 rule — a delivery can be invoiced in more than one document while a
        // invoice is not split across deliveries.
        //
        // NOTHING WRITES THIS SIDE. `setInvoiceDelivery` writes the invoice's field
        // and this follows, which is what keeps one field the single place the
        // pairing is stored.
        //
        // NEVER OBSERVED, AND THE ONE WAY THIS GOES WRONG QUIETLY: renaming this
        // field in the Airtable UI makes `record.get()` return undefined, which
        // `|| []` turns into "no invoice names this delivery" — so every delivery on
        // the base would read `Awaiting invoice` and the whole vendor-chasing
        // worklist would look full rather than broken. A rename carries formulas,
        // rollups, lookups and view filters with it and breaks only string literals
        // here, which is why the procedure is to grep after renaming; this one is
        // worth naming because the symptom is a plausible answer rather than an
        // error. `verify-delivery-status-166.mjs` Part A reads both halves for
        // exactly that reason, since no file-only check can see a link field.
        invoices: record.get("Invoices") || [],
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
 * nowhere else. See that function for why two writers is the whole of it — and
 * since #438 both hold the photo to the same precondition, a url on this app's
 * Blob store, which this one had never asked.
 *
 * `Delivery Address` (#387) HAS EXACTLY ONE WRITER AND THIS IS IT, which is the
 * shape `Quotations."File"` already has and the reason `updateDelivery` below does
 * not take the parameter. Not because changing it would re-run allocation — it
 * would not — but because inventory is counted per address from the next issue on,
 * so moving a recorded delivery to a different address is a STOCK MOVEMENT rather
 * than a correction, and nothing counts stock yet. One writer is what keeps that
 * decision from being undone by a second path nobody weighed it against.
 */
export async function createDelivery({
    jobRecordId,
    vendorRecordId,
    packingListPORecordId,
    deliveryAddressRecordId,
    receivedDate,
    recordedByUserId,
    notes,
    file,
}) {
    // Issue #438 — the backstop behind `createDeliveryAction`'s own refusal. A url
    // that is not ours is fetched by Airtable and stored as the evidence a delivery
    // happened, so it is refused before the ID is minted.
    assertOurBlobFiles("createDelivery", file);

    const record = await generateNextDeliveryId((deliveryId) =>
        base(TABLES.DELIVERIES).create({
            "Delivery ID": deliveryId,
            Job: jobRecordId ? [jobRecordId] : [],
            Vendor: vendorRecordId ? [vendorRecordId] : [],
            "Packing List PO": packingListPORecordId ? [packingListPORecordId] : [],
            "Delivery Address": deliveryAddressRecordId ? [deliveryAddressRecordId] : [],
            "Received Date": receivedDate,
            "Recorded By": recordedByUserId ? [recordedByUserId] : [],
            // The moment of entry, distinct from Received Date on purpose:
            // material recorded days after it was delivered is normal. #164 moved the
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
 *
 * `deliveryAddress` IS ABSENT FOR A THIRD REASON AND MUST NOT GROW EITHER (#387).
 * It fails the allocation test — nothing is re-planned by moving it — so the
 * paragraph above does not cover it. What does: inventory is counted per address
 * from the next issue on, so changing a recorded delivery's address MOVES STOCK,
 * and a stock movement with no record of itself is a behavior nobody has designed
 * yet. Leaving the field write-once keeps that decision open instead of settling it
 * by omission. `createDelivery` is its one writer and that is asserted.
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
 * Since #438 "ours" means this app's own store rather than any Vercel customer's,
 * and the check is `assertOurBlobFiles`, which createDelivery above now asks too.
 */
export async function replaceDeliveryPhoto(recordId, { url, filename }) {
    const file = [{ url, filename: filename || undefined }];
    assertOurBlobFiles("replaceDeliveryPhoto", file);

    const record = await base(TABLES.DELIVERIES).update(recordId, {
        "Packing List File": file,
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
