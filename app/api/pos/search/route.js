import { NextResponse } from "next/server";
import { withAdminApi } from "@/lib/authz";
import { searchPOs } from "@/lib/airtable/purchaseOrders";
import { isPOUnsigned } from "@/lib/poUnsigned";
import { withOpsLabel } from "@/lib/airtableOps";

// Issue #57. Backs "Show all / search closed POs" in InvoiceForm.js.
// Admin-only (#134): re-checked here to match the Admin-only invoice form
// that's its only consumer — a Route Handler is directly callable, so the
// gate can't be left to the page. Issue #147: the gate IS the wrapper, so
// there is no returned refusal for this file to forget to act on.
export const GET = withAdminApi(async (request) => {
    return withOpsLabel("GET /api/pos/search", async () => {
        const { searchParams } = new URL(request.url);
        const q = searchParams.get("q") || "";
        if (!q.trim()) {
            return NextResponse.json({ pos: [] });
        }

        // Issue #198 — `unsigned` is a BOOLEAN here, not the `Status` string, and that is
        // the reason this projection changed rather than widening. The results render in
        // the same picker as the page's own PO list, so they need the same signal; passing
        // the status instead would put the judgment in the browser and give
        // lib/poUnsigned.js a second implementation to drift from. The projection had
        // dropped `Status` entirely, which is why the escape hatch was the one offered
        // surface with no way to show this — #168 shared the two readers' filter and left
        // their two shapes alone.
        const pos = await searchPOs(q.trim());
        return NextResponse.json({
            pos: pos.map((po) => ({
                id: po.id,
                poId: po.poId,
                vendorId: po.vendor?.[0] || null,
                shippingFee: po.shippingFee ?? null,
                unsigned: isPOUnsigned(po),
            })),
        });
    });
});
