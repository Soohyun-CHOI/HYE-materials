import { NextResponse } from "next/server";
import { withAdminApi } from "@/lib/authz";
import { getInvoicingStatusByPO } from "@/lib/airtable/poItems";

// Issue #51, extended by #57. Backs the per-invoice-line PO Item dropdown
// in InvoiceForm.js. Admin-only (#134): re-checked here to match the
// Admin-only invoice form (its only consumer) and to close the #132 PO
// row-gate read bypass — a Route Handler is directly callable. Issue #147:
// the gate IS the wrapper, so the body can't run unauthorized.
// Uses getInvoicingStatusByPO (#48) so each item carries remainingQty for
// the dropdown's "(Remaining: N)".
export const GET = withAdminApi(async (request, { params }) => {
    const { poRecordId } = await params;
    const items = await getInvoicingStatusByPO(poRecordId);
    return NextResponse.json({ items });
});
