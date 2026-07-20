import { Fragment } from "react";
import { requireUser } from "@/lib/authz";
import { getPOById } from "@/lib/airtable/purchaseOrders";
import { getInvoicingStatusByPO } from "@/lib/airtable/poItems";
import { getItemsByPOItem } from "@/lib/airtable/invoiceItems";
import { getInvoiceByRecordId } from "@/lib/airtable/invoices";
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

// President-or-Admin (issue #48 widened this from President-only): the
// un-invoiced tracking this page now shows is day-to-day useful to Admins
// actually reconciling invoices, not just to the President signing the PO.
// A single requireUser() call plus an inline role/isAdmin check — not
// requireRole() *and* requireAdmin() back to back, which would resolve the
// session against Airtable twice for no reason.
export default async function PODetailPage({ params, searchParams }) {
    const user = await requireUser();
    const authorized = user.role === "President" || user.isAdmin === true;
    const { poId } = await params;
    const { done } = await searchParams;

    if (!authorized) {
        return (
            <div className="flex flex-1 items-center justify-center p-8">
                <p>Not authorized. This page is President/Admin-only.</p>
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
        getInvoicingStatusByPO(po.id),
        pr.job?.[0] ? getJobByRecordId(pr.job[0]) : null,
        pr.vendor?.[0] ? getVendorByRecordId(pr.vendor[0]) : null,
        po.ourPic?.[0] ? getUserByRecordId(po.ourPic[0]) : null,
        po.ourManager?.[0] ? getUserByRecordId(po.ourManager[0]) : null,
    ]);

    // Issue #15 — the line-level breakdown behind each PO Item's
    // invoiced/remaining aggregate above, so line-level Variance Flags are
    // actually visible somewhere rather than only being stored.
    const itemsWithInvoiceLines = await Promise.all(
        items.map(async (it) => ({
            ...it,
            invoiceLines: await getItemsByPOItem(it.id),
        }))
    );

    // Each Invoice Item's header-level Variance Flag lives on its parent
    // Invoice, not on the line itself — resolve the distinct invoices once
    // rather than once per line.
    const invoiceRecordIds = [
        ...new Set(
            itemsWithInvoiceLines.flatMap((it) =>
                it.invoiceLines.map((line) => line.invoice?.[0]).filter(Boolean)
            )
        ),
    ];
    const invoiceRecords = await Promise.all(invoiceRecordIds.map((id) => getInvoiceByRecordId(id)));
    const invoiceByRecordId = new Map(invoiceRecords.map((inv) => [inv.id, inv]));

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
                <p>Items Subtotal: {po.itemsSubtotal ?? 0}</p>
                {po.shippingFee != null && (
                    <p>
                        Shipping Fee: {po.shippingFee} — compare against each invoice&apos;s own
                        Shipping Fee at reconciliation time.
                    </p>
                )}
                <p>Total Amount: {po.totalAmount ?? po.itemsSubtotal ?? 0}</p>
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
                            <th className="pr-2 text-right">Unit Price</th>
                            <th className="pr-2 text-right">Amount</th>
                            <th className="pr-2 text-right">Invoiced</th>
                            <th className="pr-2 text-right">Remaining</th>
                            <th className="pr-2">Remark</th>
                        </tr>
                    </thead>
                    <tbody>
                        {itemsWithInvoiceLines.map((it) => (
                            <Fragment key={it.id}>
                                <tr className="border-t border-zinc-200 dark:border-zinc-800">
                                    <td className="py-1 pr-2">{it.itemName}</td>
                                    <td className="py-1 pr-2">{it.size}</td>
                                    <td className="py-1 pr-2">{it.unit}</td>
                                    <td className="py-1 pr-2 text-right">{it.qty}</td>
                                    <td className="py-1 pr-2 text-right">{it.unitPrice}</td>
                                    <td className="py-1 pr-2 text-right">{it.amount}</td>
                                    <td className="py-1 pr-2 text-right">{it.invoicedQty}</td>
                                    <td
                                        className={
                                            it.remainingQty < 0
                                                ? "py-1 pr-2 text-right text-red-600"
                                                : "py-1 pr-2 text-right"
                                        }
                                    >
                                        {it.remainingQty}
                                        {it.remainingQty < 0 && " (over)"}
                                    </td>
                                    <td className="py-1 pr-2">{it.remark}</td>
                                </tr>
                                {it.invoiceLines.length > 0 && (
                                    <tr className="border-t border-dashed border-zinc-200 dark:border-zinc-800">
                                        <td colSpan={9} className="py-1 pl-4 text-xs text-zinc-500">
                                            <ul className="space-y-0.5">
                                                {it.invoiceLines.map((line) => {
                                                    const parentInvoice = invoiceByRecordId.get(line.invoice?.[0]);
                                                    return (
                                                        <li key={line.id}>
                                                            {parentInvoice?.invoiceId || "—"}: Qty {line.qty} @{" "}
                                                            {line.unitPrice}
                                                            {line.varianceFlag && (
                                                                <span className="ml-1 rounded bg-red-100 px-1 text-red-700 dark:bg-red-950 dark:text-red-400">
                                                                    ⚠ Line Variance
                                                                </span>
                                                            )}
                                                            {parentInvoice?.varianceFlag && (
                                                                <span className="ml-1 rounded bg-amber-100 px-1 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                                                                    ⚠ Header Variance
                                                                </span>
                                                            )}
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
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
