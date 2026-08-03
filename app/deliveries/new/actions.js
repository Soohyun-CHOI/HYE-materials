"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireUser } from "@/lib/authz";
import { base, TABLES } from "@/lib/airtable/client";
import { createDelivery } from "@/lib/airtable/deliveries";
import { createDeliveryItem } from "@/lib/airtable/deliveryItems";
import { getPOById } from "@/lib/airtable/purchaseOrders";
import { getPRByRecordId } from "@/lib/airtable/purchaseRequests";
import { confirmIngestThenDelete } from "@/lib/blobIngest";
import { getDeliveryCandidates } from "@/lib/deliveryCandidates";
import { getJobByRecordId } from "@/lib/airtable/jobs";
import { planDelivery } from "@/lib/deliveryAllocation";
import { canAccessJobDeliveries } from "@/lib/deliveryAccess";

/**
 * Record one arrival: a Delivery header plus one Delivery Item per allocated PO
 * line, and one more for any quantity no order could absorb.
 *
 * THE ALLOCATION IS RE-RUN HERE FROM A FRESH READ. The form draws a preview with
 * the same planDelivery, but a Server Action is directly callable and a PO can be
 * withdrawn, or another delivery recorded against the same line, while the form
 * sits open. The client's plan is display only and is never trusted — the same
 * posture as the invoice form's PO detection, which advises while
 * createInvoiceAction re-checks.
 *
 * requireUser() settles only "is this an active session"; the real authorization
 * is the per-record Job comparison below, through the one shared predicate in
 * lib/deliveryAccess.js. No lib/authz.js role helper fits that axis — same shape
 * as withdrawPOAction (#138) — which is why this export is listed as a
 * requireUser exemption in scripts/tests/offline/authz-structure.mjs.
 */
export async function createDeliveryAction(prevState, formData) {
    const user = await requireUser();

    const jobRecordId = formData.get("jobRecordId");
    const vendorRecordId = formData.get("vendorRecordId");
    const materialRecordId = formData.get("materialRecordId");
    const qtyRaw = formData.get("qty");
    const receivedDate = formData.get("receivedDate");
    const notes = formData.get("notes") || "";
    const poIdTyped = (formData.get("poId") || "").trim();
    const fileUrl = formData.get("packingListUrl");
    const fileName = formData.get("packingListFilename");

    if (!jobRecordId) return { error: "Select a job." };
    // Before anything else that could reveal what exists on a job the caller has
    // no business seeing.
    if (!canAccessJobDeliveries(user, jobRecordId)) {
        return { error: "You can only record deliveries on a job you are assigned to." };
    }
    if (!vendorRecordId) return { error: "Select the vendor who delivered." };
    if (!materialRecordId) return { error: "Pick the item from the list." };
    if (!receivedDate) return { error: "Received Date is required." };

    const qty = Number(qtyRaw);
    if (!Number.isFinite(qty) || qty <= 0) return { error: "Enter how much arrived." };

    // Required, like the invoice file and unlike a Quotation: a delivery is a
    // claim that material arrived and this is the evidence. The submit button is
    // disabled client-side until the upload finishes, but a Server Action is
    // callable directly regardless of what the page rendered.
    if (!fileUrl) return { error: "Attach a photo of the packing list." };

    // A typed PO ID has to resolve, has to belong to this job, and has to be that
    // vendor's. A wrong one is a mistyped or mistaken reference, and guessing
    // would be worse than refusing. The refusal never confirms that a PO exists
    // outside the caller's scope — same posture as the PR/PO detail pages.
    let po = null;
    if (poIdTyped) {
        po = await getPOById(poIdTyped);
        const pr = po?.pr?.[0] ? await getPRByRecordId(po.pr[0]) : null;
        const poJobRecordId = pr?.job?.[0] ?? null;
        if (!po || poJobRecordId !== jobRecordId || po.vendor?.[0] !== vendorRecordId) {
            return {
                error: `No purchase order ${poIdTyped} on this job for this vendor. Check the number on the packing list.`,
            };
        }
    }

    // Re-read this ONE job's lines. The form was handed every accessible job's
    // lines at once; the action needs only the submitted one, and reading it fresh
    // is the point — a PO can be withdrawn, or another arrival recorded against
    // the same line, while the form sits open.
    const job = await getJobByRecordId(jobRecordId).catch(() => null);
    if (!job) return { error: "That job no longer exists." };
    const candidates = await getDeliveryCandidates([job]);

    const plan = planDelivery({
        lines: candidates.lines,
        vendorRecordId,
        materialRecordId,
        poRecordId: po?.id ?? null,
        qty,
    });

    if (plan.rows.length === 0) {
        // planDelivery only returns no rows for a non-positive quantity, which is
        // already refused above. Guarding anyway rather than creating a header
        // with no lines, which nothing downstream expects.
        return { error: "Nothing to record — check the quantity." };
    }

    // The identity of the item, for the frozen reference copies. An allocated row
    // takes them from its PO line; an unattributable over-delivery row has no
    // line, so it falls back to any narrowed line for the same material, and to
    // the form's own labels when even that is absent.
    const fallback =
        plan.narrowed[0] ||
        candidates.lines.find((l) => l.materialRecordId === materialRecordId) ||
        null;

    let delivery;
    const createdItemIds = [];

    try {
        delivery = await createDelivery({
            jobRecordId,
            vendorRecordId,
            // The PO the packing list named, recorded even when allocation could
            // attribute nothing to it: it is a fact about the document.
            poRecordId: po?.id ?? null,
            receivedDate,
            recordedByUserId: user.id,
            notes,
            file: [{ url: fileUrl, filename: fileName || undefined }],
        });

        for (const row of plan.rows) {
            const source = row.line || fallback;
            const created = await createDeliveryItem({
                deliveryRecordId: delivery.id,
                deliveryId: delivery.deliveryId,
                poItemRecordId: row.line?.id ?? null,
                materialRecordId,
                itemName: source?.itemName ?? "",
                size: source?.size ?? "",
                unit: source?.unit ?? "",
                qty: row.qty,
                overDelivery: row.over,
            });
            createdItemIds.push(created.id);
        }
    } catch (err) {
        // Same create-then-delete rollback as the invoice path: Airtable has no
        // cross-table transactions, so a failure partway would otherwise leave a
        // half-recorded arrival. Reverse creation order.
        if (delivery) {
            await Promise.allSettled(
                createdItemIds.map((id) => base(TABLES.DELIVERY_ITEMS).destroy(id))
            );
            await base(TABLES.DELIVERIES).destroy(delivery.id).catch(() => {});
        }
        console.error("createDeliveryAction failed, rolled back", err);
        return { error: "Something went wrong recording this delivery. Please try again." };
    }

    // Issue #140 — every write succeeded, so the uploaded object has served its
    // purpose: Airtable holds the photo now. Deliberately OUTSIDE the try above,
    // because a rollback must leave the object alive for the retry to re-submit
    // the same url from the still-open form. Scheduled with after() rather than
    // awaited so the recorder is not held for ~1s of polling, and so the cleanup
    // does not depend on sitting above the redirect() below.
    after(() =>
        confirmIngestThenDelete([
            {
                table: TABLES.DELIVERIES,
                recordId: delivery.id,
                field: "Packing List File",
                blobUrl: fileUrl,
                attachmentId: delivery.packingListFile?.[0]?.id,
                label: `packing list ${delivery.deliveryId}`,
            },
        ])
    );

    redirect(`/deliveries/${encodeURIComponent(delivery.deliveryId)}?done=recorded`);
}
