import Link from "next/link";
import { requireAdmin } from "@/lib/authz";
import { getAllVendors } from "@/lib/airtable/vendors";
import { getOpenPOs } from "@/lib/airtable/purchaseOrders";
import InvoiceForm from "./InvoiceForm";

// Admin-only (issue #14) — manual invoice entry is back-office data entry,
// same category as the Job/Vendor/Line admin forms, not a floor-level
// action like PR creation (requireUser()).
export default async function NewInvoicePage() {
    const { authorized } = await requireAdmin();
    if (!authorized) {
        return (
            <div className="flex flex-1 items-center justify-center p-8">
                <p>Not authorized. This page is Admin-only.</p>
            </div>
        );
    }

    // Issue #57 — defaults to open POs only (Remaining Qty > 0 on at least
    // one PO Item), not the full historical list. A closed PO is never
    // truly unreachable — InvoiceForm.js's "Show all / search closed POs"
    // queries the complete set server-side, on demand, instead of this
    // page ever loading it all upfront.
    const [vendors, pos] = await Promise.all([getAllVendors(), getOpenPOs()]);

    // po.vendor is a raw Vendor record ID (Purchase Orders.Vendor is a
    // Lookup through PR -> Purchase Requests.Vendor, itself a link field —
    // same gotcha already documented for Purchase Requests.Job/po.vendor
    // elsewhere). Resolve each PO's vendor once here so the form can filter
    // its PO picker by the selected Vendor without re-deriving this per PO.
    const posWithVendorId = pos.map((po) => ({
        ...po,
        vendorId: po.vendor?.[0] || null,
        // Issue #78 — po.shippingFee is now a plain frozen copy (see
        // purchaseOrders.js:createPO), not a Lookup — used by the form as
        // a reference figure next to Invoice.Shipping Fee, no computed
        // comparison, just a display hint.
        shippingFee: po.shippingFee ?? null,
    }));

    return (
        <div className="mx-auto w-full max-w-2xl p-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">New Invoice</h1>
                <Link href="/invoices" className="text-sm underline">
                    View all invoices
                </Link>
            </div>

            <InvoiceForm vendors={vendors} pos={posWithVendorId} />
        </div>
    );
}
