import Link from "next/link";
import { requireAdmin } from "@/lib/authz";
import { getInvoiceById } from "@/lib/airtable/invoices";
import { getItemsByInvoice } from "@/lib/airtable/invoiceItems";
import { getPOByRecordId } from "@/lib/airtable/purchaseOrders";
import { getAllVendors } from "@/lib/airtable/vendors";
import EditInvoiceForm from "./EditInvoiceForm";

// Admin-only (issue #117) — editing is back-office data entry, same category
// as creating an invoice and the Admin-only Paid toggle. Viewing the invoice
// stays President-or-Admin; only Admins reach this edit page, and
// updateInvoiceAction re-checks server-side.
export default async function EditInvoicePage({ params }) {
    const { authorized } = await requireAdmin();
    if (!authorized) {
        return (
            <div className="flex flex-1 items-center justify-center p-8">
                <p>Not authorized. Editing an invoice is Admin-only.</p>
            </div>
        );
    }

    const { invoiceId } = await params;
    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) {
        return <div className="p-8">Invoice not found.</div>;
    }

    const [items, vendors] = await Promise.all([getItemsByInvoice(invoice.id), getAllVendors()]);

    // Resolve each line's PO to its PO ID for the read-only per-line label
    // (the PO link itself isn't editable in Tier 1).
    const poRecordIds = [...new Set(items.map((it) => it.po?.[0]).filter(Boolean))];
    const poRecords = await Promise.all(poRecordIds.map((id) => getPOByRecordId(id)));
    const poIdByRecordId = Object.fromEntries(poRecords.map((po) => [po.id, po.poId]));
    const itemsWithPoId = items.map((it) => ({ ...it, poId: poIdByRecordId[it.po?.[0]] || null }));

    return (
        <div className="mx-auto w-full max-w-2xl p-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Edit {invoice.invoiceId}</h1>
                <Link href={`/invoices/${invoice.invoiceId}`} className="text-sm underline">
                    ← Back to invoice
                </Link>
            </div>

            <EditInvoiceForm invoice={invoice} items={itemsWithPoId} vendors={vendors} />
        </div>
    );
}
