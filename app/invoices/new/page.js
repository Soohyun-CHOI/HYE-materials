import Link from "next/link";
import { requireAdmin } from "@/lib/authz";
import { getAllVendors } from "@/lib/airtable/vendors";
import { getOpenPOs } from "@/lib/airtable/purchaseOrders";
import { isPOUnsigned } from "@/lib/poUnsigned";
import { DIRECT_PURCHASE_COPY } from "@/lib/directPurchase";
import { withOpsLabel } from "@/lib/airtableOps";
import InvoiceForm from "./InvoiceForm";

export const metadata = { title: "New Invoice" };

// Labeled for #190 in #231, which is the screen this issue adds a read path
// beside — #216's rule that an issue labels the screens it changes so it can show
// a before and an after, rather than claiming one. #193's own comment asked for
// this one by name, on the suspicion that `getOpenPOs` was the most expensive read
// path in the app; the label proved it, at 83 of this screen's 85 operations, and
// #244 then took it to 1. #224 remains the sweep across every other unlabeled
// entry point.
export default async function NewInvoicePage(props) {
    return withOpsLabel("/invoices/new", () => renderNewInvoicePage(props));
}

// Admin-only (issue #14) — manual invoice entry is back-office data entry,
// same category as the Job/Vendor/Line admin forms, not a floor-level
// action like PR creation (requireUser()).
async function renderNewInvoicePage({ searchParams } = {}) {
    const { authorized } = await requireAdmin();
    if (!authorized) {
        return (
            <div className="flex flex-1 items-center justify-center p-8">
                <p>Not authorized. This page is Admin-only.</p>
            </div>
        );
    }

    // Issue #57 — defaults to open POs only (uninvoiced qty > 0 on at least
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
        // Issue #198 — the unsigned judgment runs HERE, on the record, so the form
        // reads a boolean instead of comparing `Status` in the browser. The same
        // normalization the search route and the detect route each do on their own
        // way out, which is what lets one label helper serve all three sources
        // (lib/poUnsigned.js). Costs no read: `status` is already on every record
        // getOpenPOs returned.
        unsigned: isPOUnsigned(po),
        // Issue #78 — po.shippingFee is now a plain frozen copy (see
        // purchaseOrders.js:createPO), not a Lookup — used by the form as
        // a reference figure next to Invoice.Shipping Fee, no computed
        // comparison, just a display hint.
        shippingFee: po.shippingFee ?? null,
    }));

    // Issue #272 — where the office lands after recording a direct purchase. The
    // invoice that started it cannot be entered until the request is approved and
    // its order signed, so there is nothing to return to and this is a fresh form
    // with a line saying what was recorded. The sentence is lib/directPurchase.js's;
    // the query string carries the id and the job's code and no words at all (#231).
    const sp = (await searchParams) ?? {};
    const recorded = typeof sp.recorded === "string" ? sp.recorded : null;

    return (
        <div className="mx-auto w-full max-w-2xl p-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">New Invoice</h1>
                <Link href="/invoices" className="text-sm underline">
                    View all invoices
                </Link>
            </div>

            {recorded && (
                <p className="mt-4 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
                    {
                        DIRECT_PURCHASE_COPY.recorded({
                            directPurchaseId: recorded,
                            jobCode: typeof sp.job === "string" ? sp.job : null,
                        }).text
                    }
                </p>
            )}

            <InvoiceForm vendors={vendors} pos={posWithVendorId} />
        </div>
    );
}
