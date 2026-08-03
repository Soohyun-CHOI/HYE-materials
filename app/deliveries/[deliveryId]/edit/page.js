import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getDeliveryById } from "@/lib/airtable/deliveries";
import { getJobByRecordId } from "@/lib/airtable/jobs";
import { getVendorByRecordId } from "@/lib/airtable/vendors";
import { canAccessJobDeliveries } from "@/lib/deliveryAccess";
import DeliveryEditForm from "./DeliveryEditForm";

/**
 * Correct a recorded delivery (#162) — its own page, laid out like
 * app/invoices/[invoiceId]/edit.
 *
 * Open to the same set that may VIEW the delivery: Job membership, or the office
 * (lib/deliveryAccess.js). Deliberately not Admin-only, unlike the invoice edit
 * page — invoicing is back-office data entry, whereas the three things editable
 * here are the recorder's own account of an arrival they were present for. Both
 * Server Actions re-check the same predicate, since a Server Action is callable
 * regardless of what this page rendered.
 *
 * WHAT IS NOT HERE is the point of the page. The item, the quantity, the vendor
 * and the PO are absent because changing any of them changes what the arrival was
 * allocated against — that would mean re-running allocation and mutating or
 * destroying existing Delivery Items, and there is deliberately no
 * allocation-editing UI. The correction for those is to delete the delivery and
 * enter it again, which the detail page offers.
 */
export default async function EditDeliveryPage({ params }) {
    const user = await requireUser();
    const { deliveryId } = await params;

    const delivery = await getDeliveryById(decodeURIComponent(deliveryId));

    // Same wording as the detail page: a delivery outside the viewer's Jobs must
    // not be distinguishable from one that does not exist.
    if (!delivery || !canAccessJobDeliveries(user, delivery.job?.[0])) {
        return (
            <div className="mx-auto w-full max-w-3xl p-8">
                <h1 className="text-2xl font-semibold">Delivery not found</h1>
                <Link href="/deliveries" className="mt-6 inline-block text-sm underline">
                    ← All deliveries
                </Link>
            </div>
        );
    }

    const [job, vendor] = await Promise.all([
        delivery.job?.[0] ? getJobByRecordId(delivery.job[0]) : null,
        delivery.vendor?.[0] ? getVendorByRecordId(delivery.vendor[0]) : null,
    ]);

    const photo = delivery.packingListFile?.[0] ?? null;

    return (
        <div className="mx-auto w-full max-w-3xl p-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Edit {delivery.deliveryId}</h1>
                <Link
                    href={`/deliveries/${encodeURIComponent(delivery.deliveryId)}`}
                    className="text-sm underline"
                >
                    ← Back to delivery
                </Link>
            </div>

            <div className="mt-4 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                <p>
                    <span className="text-zinc-500">Job:</span>{" "}
                    {job ? `${job.jobCode} — ${job.jobName}` : "—"}
                </p>
                <p>
                    <span className="text-zinc-500">Vendor:</span> {vendor?.vendorName ?? "—"}
                </p>
                <p>
                    <span className="text-zinc-500">Current packing list:</span>{" "}
                    {photo ? (
                        <a href={photo.url} target="_blank" rel="noreferrer" className="underline">
                            {photo.filename || "Open"}
                        </a>
                    ) : (
                        "not attached"
                    )}
                </p>
            </div>

            <p className="mt-4 rounded border border-zinc-200 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                Only the received date, the note and the packing list photo can be changed. The
                item, the quantity, the vendor and the PO are fixed — correcting one of those means
                deleting this delivery and entering it again.
            </p>

            <DeliveryEditForm
                deliveryId={delivery.deliveryId}
                receivedDate={delivery.receivedDate || ""}
                notes={delivery.notes || ""}
            />
        </div>
    );
}
