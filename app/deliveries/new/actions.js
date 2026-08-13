"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireUser } from "@/lib/authz";
import { base, TABLES } from "@/lib/airtable/client";
import { createDelivery } from "@/lib/airtable/deliveries";
import { createDeliveryItem } from "@/lib/airtable/deliveryItems";
import { setInvoiceDelivery } from "@/lib/airtable/invoices";
import { getInvoiceLinkCandidates } from "@/lib/deliveryInvoiceCandidates";
import { billFromInvoiceOption, planPairings } from "@/lib/deliveryInvoiceMatch";
import { getPOById } from "@/lib/airtable/purchaseOrders";
import { getPRByRecordId } from "@/lib/airtable/purchaseRequests";
import { confirmIngestThenDelete } from "@/lib/blobIngest";
import { getDeliveryCandidates } from "@/lib/deliveryCandidates";
import { getJobByRecordId } from "@/lib/airtable/jobs";
import { describePlan, itemOptionLabel, planDelivery } from "@/lib/deliveryAllocation";
import { canAccessJobDeliveries } from "@/lib/deliveryAccess";

/**
 * The item's printed name, for a refusal that has to say which item it means.
 * Any ordered item for the material will do — they all carry the same frozen copies —
 * and a material with no ordered item at all is named only by its record id, which is
 * no use in a message, so it falls back to the generic wording (#165).
 */
function itemLabelFor(lines, materialRecordId) {
    const line = (lines || []).find((l) => l.materialRecordId === materialRecordId);
    return line ? itemOptionLabel(line) : "";
}

/**
 * Record one arrival: a Delivery header plus one Delivery Item per allocated PO
 * ordered item, and one more for any quantity no order could absorb.
 *
 * THE ALLOCATION IS RE-RUN HERE FROM A FRESH READ. The form draws a preview with
 * the same planDelivery, but a Server Action is directly callable and a PO can be
 * withdrawn, or another delivery recorded against the same ordered item, while the form
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
    // One packing list usually lists several items, so the form submits an array
    // the way the invoice form does — [{ materialRecordId, qty }].
    const submittedItems = JSON.parse(formData.get("itemsJson") || "[]");
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
    if (!receivedDate) return { error: "Received Date is required." };
    if (submittedItems.length === 0) return { error: "Add at least one item." };

    for (const row of submittedItems) {
        if (!row.materialRecordId) return { error: "Every item needs to be picked from the list." };
        const q = Number(row.qty);
        if (!Number.isFinite(q) || q <= 0) return { error: "Every item needs how much was delivered." };
    }

    // TWO ROWS OF ONE MATERIAL ARE SUMMED, not planned twice. Allocation runs
    // against a single snapshot of the candidate ordered items, so planning the same
    // material twice would let both plans claim the same undelivered quantity and
    // double-allocate. Summing first is also what the recorder meant: two pallets
    // of the same item on one packing list is one arrival of their total.
    const wantedByMaterial = new Map();
    for (const row of submittedItems) {
        const prev = wantedByMaterial.get(row.materialRecordId) || 0;
        wantedByMaterial.set(row.materialRecordId, prev + Number(row.qty));
    }

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

    // Re-read this ONE job's ordered items. The form was handed every accessible
    // job's ordered items at once; the action needs only the submitted one, and
    // reading it fresh is the point — a PO can be withdrawn, or another arrival
    // recorded against the same ordered item, while the form sits open.
    const job = await getJobByRecordId(jobRecordId).catch(() => null);
    if (!job) return { error: "That job no longer exists." };
    const candidates = await getDeliveryCandidates([job]);

    // #231 — the bills this vendor could have sent, gated per record through the
    // same walk the page used to render the picker. Read here rather than trusted
    // from the form for the reason the allocation is re-run: an invoice can be
    // paired with another shipment while this page sits open.
    const invoiceOptions = await getInvoiceLinkCandidates(user, {
        vendorRecordIds: [vendorRecordId],
    });

    // ONE PLAN PER MATERIAL, each against the same snapshot. Different materials
    // never compete for the same ordered item, so planning them independently is
    // correct; the same material appearing twice was already summed above, which
    // is what makes that true.
    const plans = [];
    for (const [material, qty] of wantedByMaterial) {
        const plan = planDelivery({
            lines: candidates.lines,
            vendorRecordId,
            materialRecordId: material,
            // Still `poRecordId` here, and deliberately (#181): planDelivery's
            // parameter is "narrow the candidates to this order", not a copy of
            // `Deliveries."Packing List PO"`. The value happens to come from the
            // packing list today because that is the only thing that narrows.
            poRecordId: po?.id ?? null,
            qty,
        });
        // Issue #165 — a blocked plan has no ordered item to attach anything to,
        // and every row must name one, so nothing is recorded and the reason is
        // shown. The reachable case is a packing list naming a PO that does not
        // carry the item picked: the dropdown is narrowed by vendor, not by the
        // typed PO. Overriding the document would be worse than asking for a
        // correction.
        if (plan.blocked) {
            const label = itemLabelFor(candidates.lines, material);
            return {
                error: describePlan(plan, { poId: poIdTyped || null, label })[0].text,
            };
        }
        if (plan.rows.length === 0) {
            // planDelivery only returns no rows for a non-positive quantity, which
            // is already refused above. Guarding anyway rather than creating a
            // header with no delivery items, which nothing downstream expects.
            return { error: "Nothing to record — check the quantities." };
        }
        plans.push({ materialRecordId: material, plan });
    }

    let delivery;
    const createdItemIds = [];

    try {
        delivery = await createDelivery({
            jobRecordId,
            vendorRecordId,
            // The PO the packing list named, recorded even when allocation could
            // attribute nothing to it: it is a fact about the document.
            packingListPORecordId: po?.id ?? null,
            receivedDate,
            recordedByUserId: user.id,
            notes,
            file: [{ url: fileUrl, filename: fileName || undefined }],
        });

        // Items in the order they were entered, and each item's slices in
        // allocation order, so `Delivery Item ID` order is the order a reader
        // expects — which is what lets groupRowsByItem present them by entry.
        for (const { materialRecordId, plan } of plans) {
            for (const row of plan.rows) {
                // Issue #165 — every row names an ordered item, including the
                // over-delivery one, so the frozen reference copies always come
                // from the ordered item itself. The old
                // fallback-to-any-narrowed-item is gone with the unattached row it
                // existed for; a plan that could not attach is blocked above
                // rather than written with a null link.
                const created = await createDeliveryItem({
                    deliveryRecordId: delivery.id,
                    deliveryId: delivery.deliveryId,
                    poItemRecordId: row.line.id,
                    materialRecordId,
                    itemName: row.line.itemName ?? "",
                    size: row.line.size ?? "",
                    unit: row.line.unit ?? "",
                    qty: row.qty,
                    overDelivered: row.over,
                });
                createdItemIds.push(created.id);
            }
        }

        // #210 — LAST, AND INSIDE THE ROLLBACK. Last because nothing follows it, so
        // a failure here cannot leave a pairing whose delivery was then rolled back;
        // inside, because a failure has to take the arrival with it rather than
        // record material against an order and silently drop which bill covers it.
        // Destroying the delivery below removes this link with it, so the rollback
        // needs no undo of its own.
        //
        // #231 — AND NOW THERE MAY BE SEVERAL, WHICH ADDS NO FAILURE MODE. The
        // transcribed number goes first, because a recorder read it off the document
        // and that beats a computation; then every bill this arrival's ordered items
        // place on it, which `planPairings` decides against a pool where each
        // decision so far already counts as attached. A throw part-way through leaves
        // some invoices pointing at a delivery the catch below then destroys, and
        // Airtable drops a link to a deleted record — so the partial state is
        // undone by the same rollback that was already here, and the only thing
        // added is that it may now undo more than one link.
        const computed = planPairings({
            arrival: {
                deliveryRecordId: delivery.id,
                deliveryId: delivery.deliveryId,
                orderedItems: plans.flatMap(({ plan }) =>
                    plan.rows.map((row) => ({ poItemRecordId: row.line.id, qty: row.qty }))
                ),
            },
            bills: invoiceOptions.map(billFromInvoiceOption),
            agreedPrices: new Map(candidates.lines.map((l) => [l.id, l.unitPrice])),
        });
        for (const bill of computed.attach) {
            await setInvoiceDelivery(bill.invoiceRecordId, delivery.id);
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
