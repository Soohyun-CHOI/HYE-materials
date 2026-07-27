import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/authz";
import { searchPOs } from "@/lib/airtable/purchaseOrders";

// Issue #57. Backs "Show all / search closed POs" in InvoiceForm.js.
// Admin-only (#134): re-checked here via requireAdminApi to match the
// Admin-only invoice form that's its only consumer — a Route Handler is
// directly callable, so the gate can't be left to the page.
export async function GET(request) {
    const gate = await requireAdminApi();
    if (gate instanceof Response) return gate;

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
}
