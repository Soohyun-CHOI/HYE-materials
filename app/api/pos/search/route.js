import { NextResponse } from "next/server";
import { getActiveUser } from "@/lib/authz";
import { searchPOs } from "@/lib/airtable/purchaseOrders";

// Issue #57. Backs "Show all / search closed POs" in InvoiceForm.js —
// same getActiveUser() check as the sibling PO Items route, not a fresh
// Admin re-check (the page itself is already Admin-gated; this is a read
// with no write side effect).
export async function GET(request) {
    const user = await getActiveUser();
    if (!user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

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
            prShippingFee: po.prShippingFee?.[0] ?? null,
        })),
    });
}
