import { NextResponse } from "next/server";
import { withAdminApi } from "@/lib/authz";
import { searchPOs } from "@/lib/airtable/purchaseOrders";

// Issue #57. Backs "Show all / search closed POs" in InvoiceForm.js.
// Admin-only (#134): re-checked here to match the Admin-only invoice form
// that's its only consumer — a Route Handler is directly callable, so the
// gate can't be left to the page. Issue #147: the gate IS the wrapper, so
// there is no returned refusal for this file to forget to act on.
export const GET = withAdminApi(async (request) => {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    if (!q.trim()) {
        return NextResponse.json({ pos: [] });
    }

    const pos = await searchPOs(q.trim());
    return NextResponse.json({
        pos: pos.map((po) => ({
            id: po.id,
            poId: po.poId,
            vendorId: po.vendor?.[0] || null,
            shippingFee: po.shippingFee ?? null,
        })),
    });
});
