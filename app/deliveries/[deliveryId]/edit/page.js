import Link from "next/link";
import FileViewer from "@/app/components/FileViewer";
import UndrawnPage from "@/app/components/UndrawnPage";
import { requireUser } from "@/lib/authz";
import { FILE_AXIS } from "@/lib/fileLinks";
import { getDeliveryById } from "@/lib/airtable/deliveries";
import { getJobByRecordId } from "@/lib/airtable/jobs";
import { getVendorByRecordId } from "@/lib/airtable/vendors";
import { canAccessJobDeliveries } from "@/lib/deliveryAccess";
import DeliveryEditForm from "./DeliveryEditForm";
import { withOpsLabel } from "@/lib/airtableOps";

export const metadata = { title: "Edit Delivery" };

/**
 * Correct a recorded delivery (#162) — its own page, laid out like
 * app/invoices/[invoiceId]/edit.
 *
 * Open to the same set that may VIEW the delivery: Job membership, or the office
 * (lib/deliveryAccess.js). Deliberately not Admin-only, unlike the invoice edit
 * page — invoicing is back-office data entry, whereas the three things editable
 * here are the recorder's own account of a delivery they were present for. Both
 * Server Actions re-check the same predicate, since a Server Action is callable
 * regardless of what this page rendered.
 *
 * WHAT IS NOT HERE is the point of the page. The item, the quantity, the vendor
 * and the PO are absent because changing any of them changes what the delivery was
 * allocated against — that would mean re-running allocation and mutating or
 * destroying existing Delivery Items, and there is deliberately no
 * allocation-editing UI. The correction for those is to delete the delivery and
 * enter it again, which the detail page offers.
 *
 * #210 ADDED A FOURTH EDITABLE THING — the invoice this delivery was paired with —
 * and #640 TOOK IT AWAY WITH THE PAIRING. Invoices and deliveries meet only through
 * the ordered items both name, so nothing on this page says which invoice a delivery
 * answers; the invoice detail and the order's own page say how much of each arrived.
 */
// Labeled for #190 by #224, the sweep across every entry point that opened no
// scope. An outer wrapper, so the page's own logic keeps its indentation, and
// the route TEMPLATE, so repeated loads aggregate into one row.
export default async function EditDeliveryPage(props) {
    return withOpsLabel("/deliveries/[deliveryId]/edit", () => renderEditDeliveryPage(props));
}

async function renderEditDeliveryPage({ params }) {
    const user = await requireUser();
    const { deliveryId } = await params;

    const delivery = await getDeliveryById(decodeURIComponent(deliveryId));

    // Same wording as the detail page: a delivery outside the viewer's Jobs must
    // not be distinguishable from one that does not exist.
    if (!delivery || !canAccessJobDeliveries(user, delivery.job?.[0])) {
        return (
            <UndrawnPage measure="delivery">
                <h1 className="text-2xl font-semibold">Delivery not found</h1>
                <Link href="/deliveries" className="mt-6 inline-block text-sm underline">
                    ← All deliveries
                </Link>
            </UndrawnPage>
        );
    }

    const [job, vendor] = await Promise.all([
        delivery.job?.[0] ? getJobByRecordId(delivery.job[0]) : null,
        delivery.vendor?.[0] ? getVendorByRecordId(delivery.vendor[0]) : null,
    ]);

    const photo = delivery.packingListFile?.[0] ?? null;

    return (
        <UndrawnPage measure="delivery">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Edit {delivery.deliveryId}</h1>
                <Link
                    href={`/deliveries/${encodeURIComponent(delivery.deliveryId)}`}
                    className="text-sm underline"
                >
                    ← Back to delivery
                </Link>
            </div>

            <div className="mt-4 space-y-1 text-sm text-zinc-600">
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
                        <FileViewer
                            axis={FILE_AXIS.delivery}
                            documentId={delivery.deliveryId}
                            filename={photo.filename}
                            contentType={photo.type}
                        >
                            {photo.filename || "Open"}
                        </FileViewer>
                    ) : (
                        "not attached"
                    )}
                </p>
            </div>

            <p className="mt-4 rounded border border-zinc-200 px-3 py-2 text-xs text-zinc-600">
                Only the received date, the note and the packing list photo can be changed. The
                item, the quantity, the vendor and the PO are fixed — correcting one of those means
                deleting this delivery and entering it again.
            </p>

            <DeliveryEditForm
                deliveryId={delivery.deliveryId}
                receivedDate={delivery.receivedDate || ""}
                notes={delivery.notes || ""}
            />
        </UndrawnPage>
    );
}
