import Link from "next/link";
import UndrawnPage from "@/app/components/UndrawnPage";
import { requireAdmin } from "@/lib/authz";
import { getInvoiceById } from "@/lib/airtable/invoices";
import { getItemsByInvoice } from "@/lib/airtable/invoiceItems";
import { getPOByRecordId } from "@/lib/airtable/purchaseOrders";
import { getAllVendors } from "@/lib/airtable/vendors";
import { editableShares, invoicePositions } from "@/lib/invoiceSpread";
import { getSpreadOrderedItems } from "@/lib/invoiceSpread.server";
import EditInvoiceForm from "./EditInvoiceForm";
import { withOpsLabel } from "@/lib/airtableOps";

export const metadata = { title: "Edit Invoice" };

// Admin-only (issue #117) — editing is back-office data entry, same category
// as creating an invoice and the Admin-only Paid toggle. VIEWING the invoice is
// row-scoped since #211 and reading its payment status is President-or-Admin;
// neither widened this page, which is unchanged and still Admin-only, and
// updateInvoiceAction re-checks server-side.
// Labeled for #190 by #224, the sweep across every entry point that opened no
// scope. An outer wrapper, so the page's own logic keeps its indentation, and
// the route TEMPLATE, so repeated loads aggregate into one row.
export default async function EditInvoicePage(props) {
    return withOpsLabel("/invoices/[invoiceId]/edit", () => renderEditInvoicePage(props));
}

async function renderEditInvoicePage({ params }) {
    const { authorized } = await requireAdmin();
    if (!authorized) {
        return (
            <UndrawnPage measure="notice">
                <p>Not authorized. Editing an invoice is Admin-only.</p>
            </UndrawnPage>
        );
    }

    const { invoiceId } = await params;
    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) {
        return <div className="p-8">Invoice not found.</div>;
    }

    // #660 — the items off the ids the invoice already carries (#640's shape), which pays for
    // the one read this page adds: its orders' ordered items, for a quantity per order.
    const [items, vendors] = await Promise.all([
        getItemsByInvoice(invoice.id, { rowIds: invoice.invoiceItems || [] }),
        getAllVendors(),
    ]);

    // The invoice's orders, from its items — the one record of which orders it charges — and
    // their ordered items in one query per fifty. An item is the vendor's as it was written
    // (`Position`), and where its material at its ordered price is on two or more of the
    // invoice's ordered items it takes a quantity per order (`lib/invoiceSpread.js`).
    const poRecordIds = [...new Set(items.map((it) => it.po?.[0]).filter(Boolean))];
    const poRecords = await Promise.all(poRecordIds.map((id) => getPOByRecordId(id)));
    const orderedItems = await getSpreadOrderedItems(poRecords);
    const orderedItemById = new Map(orderedItems.map((o) => [o.id, o]));
    const thisInvoiceOn = new Map();
    for (const it of items) {
        const id = it.poItem?.[0];
        if (id) thisInvoiceOn.set(id, (thisInvoiceOn.get(id) || 0) + (it.qty || 0));
    }
    const positions = invoicePositions({ items, orderedItemById }).map((position) => {
        const editable = editableShares({ position, orderedItems, thisInvoiceOn });
        return {
            key: position.key,
            itemName: position.itemName,
            size: position.size,
            maker: position.maker,
            unit: position.unit,
            unitPrice: position.unitPrice,
            remark: position.remark,
            qty: position.qty,
            perOrder: editable.length > 1,
            // Every share the item has, and on a per-order item every ordered item it may
            // take one on, in fill order; a share whose ordered item no order holds any more
            // (a hand edit) is kept as it is, with its own quantity.
            shares: [
                ...editable.map((e) => {
                    const share = position.shares.find((s) => s.id === e.invoiceItemRecordId);
                    return {
                        invoiceItemId: e.invoiceItemRecordId,
                        orderedItemId: e.orderedItem.id,
                        poId: e.orderedItem.poId,
                        qty: e.qty,
                        uninvoiced: e.uninvoiced,
                        priceVariance: share?.priceVariance ?? null,
                        quantityVariance: share?.quantityVariance ?? null,
                    };
                }),
                ...position.shares
                    .filter((s) => !editable.some((e) => e.invoiceItemRecordId === s.id))
                    .map((s) => ({
                        invoiceItemId: s.id,
                        orderedItemId: s.orderedItem?.id ?? null,
                        poId: s.poId,
                        qty: s.qty,
                        uninvoiced: null,
                        priceVariance: s.priceVariance,
                        quantityVariance: s.quantityVariance,
                    })),
            ],
        };
    });

    return (
        <UndrawnPage measure="document">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Edit {invoice.invoiceId}</h1>
                <Link href={`/invoices/${invoice.invoiceId}`} className="text-sm underline">
                    ← Back to invoice
                </Link>
            </div>

            <EditInvoiceForm invoice={invoice} positions={positions} vendors={vendors} />
        </UndrawnPage>
    );
}
