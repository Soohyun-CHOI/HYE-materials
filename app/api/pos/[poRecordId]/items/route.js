import { NextResponse } from "next/server";
import { getActiveUser } from "@/lib/authz";
import { getInvoicingStatusByPO } from "@/lib/airtable/poItems";

// Issue #51, extended by #57. Backs the per-invoice-line PO Item dropdown
// in InvoiceForm.js — same getActiveUser() check as detect-po's Route
// Handler (the page itself is already Admin-gated; this just needs a
// logged-in session, not a fresh Admin re-check, since it's a read with
// no write side effect). Switched from getItemsByPO() to
// getInvoicingStatusByPO() (#48) so each item carries remainingQty —
// the dropdown needs it to sort open items first and show "(Remaining: N)".
export async function GET(request, { params }) {
    const user = await getActiveUser();
    if (!user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { poRecordId } = await params;
    const items = await getInvoicingStatusByPO(poRecordId);
    return NextResponse.json({ items });
}
