import { NextResponse } from "next/server";
import { getActiveUser } from "@/lib/authz";
import { getItemsByPO } from "@/lib/airtable/poItems";

// Issue #51. Backs the per-invoice-line PO Item dropdown in InvoiceForm.js —
// same getActiveUser() check as detect-po's Route Handler (the page itself
// is already Admin-gated; this just needs a logged-in session, not a fresh
// Admin re-check, since it's a read of already-frozen PO Item data with no
// write side effect).
export async function GET(request, { params }) {
    const user = await getActiveUser();
    if (!user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { poRecordId } = await params;
    const items = await getItemsByPO(poRecordId);
    return NextResponse.json({ items });
}
