import { requireRole } from "@/lib/authz";
import { getPOById } from "@/lib/airtable/purchaseOrders";
import { getItemsByPO } from "@/lib/airtable/poItems";
import { getPRByRecordId } from "@/lib/airtable/purchaseRequests";
import { getJobByRecordId } from "@/lib/airtable/jobs";
import { getVendorByRecordId } from "@/lib/airtable/vendors";
import { getUserByRecordId } from "@/lib/airtable/users";
import SignForm from "./SignForm";
import RegeneratePDFForm from "./RegeneratePDFForm";

const DONE_MESSAGES = {
    signed: "Signed the PO.",
    "pdf-regenerated": "Regenerated the PDF.",
};

export default async function PODetailPage({ params, searchParams }) {
    const { authorized } = await requireRole("President");
    const { poId } = await params;
    const { done } = await searchParams;

    if (!authorized) {
        return (
            <div className="flex flex-1 items-center justify-center p-8">
                <p>Not authorized. This page is President-only.</p>
            </div>
        );
    }

    const po = await getPOById(poId);
    if (!po) {
        return <div className="p-8">PO not found.</div>;
    }

    // Purchase Orders.Vendor is a Lookup through PR -> Purchase Requests.
    // Vendor, itself a link field (confirmed via Airtable's field config
    // during #10's design) — po.vendor is a raw Vendor record ID, not
    // display text, same gotcha as Purchase Requests.Job. Resolve via the
    // PR chain instead of trusting the Lookup's raw value.
    const pr = await getPRByRecordId(po.pr[0]);
    const [items, job, vendor, ourPic, ourManager] = await Promise.all([
        getItemsByPO(po.id),
        pr.job?.[0] ? getJobByRecordId(pr.job[0]) : null,
        pr.vendor?.[0] ? getVendorByRecordId(pr.vendor[0]) : null,
        po.ourPic?.[0] ? getUserByRecordId(po.ourPic[0]) : null,
        po.ourManager?.[0] ? getUserByRecordId(po.ourManager[0]) : null,
    ]);

    const pdfFile = po.poPdfFile?.[0];

    return (
        <div className="mx-auto w-full max-w-2xl p-8">
            <h1 className="text-2xl font-semibold">{po.poId}</h1>

            {done && DONE_MESSAGES[done] && (
                <p className="mt-4 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
                    {DONE_MESSAGES[done]}
                </p>
            )}

            <div className="mt-4 space-y-1 text-sm">
                <p>
                    Status: <strong>{po.status}</strong>
                </p>
                <p>PR: {pr.prId}</p>
                <p>Job: {job ? `${job.jobCode} — ${job.jobName}` : "—"}</p>
                <p>Vendor: {vendor?.vendorName || "—"}</p>
                <p>Our PIC: {ourPic?.userName || "—"}</p>
                <p>Our Manager: {ourManager?.userName || "—"}</p>
                <p>Delivery Address Used: {po.deliveryAddressUsed || "—"}</p>
                <p>Total Amount: {po.totalAmount ?? 0}</p>
            </div>

            <div className="mt-6">
                <h2 className="text-lg font-semibold">Items</h2>
                <table className="mt-2 w-full text-sm">
                    <thead>
                        <tr className="text-left text-zinc-500">
                            <th className="pr-2">Item</th>
                            <th className="pr-2">Size</th>
                            <th className="pr-2">Unit</th>
                            <th className="pr-2 text-right">Qty</th>
                            <th className="pr-2 text-right">Rate</th>
                            <th className="pr-2 text-right">Amount</th>
                            <th className="pr-2">Remark</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((it) => (
                            <tr key={it.id} className="border-t border-zinc-200 dark:border-zinc-800">
                                <td className="py-1 pr-2">{it.itemName}</td>
                                <td className="py-1 pr-2">{it.size}</td>
                                <td className="py-1 pr-2">{it.unit}</td>
                                <td className="py-1 pr-2 text-right">{it.qty}</td>
                                <td className="py-1 pr-2 text-right">{it.rate}</td>
                                <td className="py-1 pr-2 text-right">{it.amount}</td>
                                <td className="py-1 pr-2">{it.remark}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-8">
                {!po.presidentSigned ? (
                    <SignForm poId={po.poId} />
                ) : (
                    <div className="space-y-2 text-sm">
                        <p>
                            Signed at {po.presidentSignedAt ? new Date(po.presidentSignedAt).toLocaleString() : "—"}
                        </p>
                        {pdfFile ? (
                            <a href={pdfFile.url} target="_blank" rel="noreferrer" className="underline">
                                {pdfFile.filename || "PO PDF"}
                            </a>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-zinc-600 dark:text-zinc-400">
                                    PDF generation hasn&apos;t completed yet for this PO.
                                </p>
                                <RegeneratePDFForm poId={po.poId} />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
