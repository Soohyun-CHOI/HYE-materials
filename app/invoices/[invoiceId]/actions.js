"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/authz";
import { getInvoiceById, updateInvoice } from "@/lib/airtable/invoices";

// Server Actions are directly callable regardless of what the page
// rendered, so the Admin check happens here too — same principle as
// createInvoiceAction (issue #16 keeps payment tracking Admin-only,
// matching who already creates/reconciles invoices; viewing this page is
// President-or-Admin, but marking Paid is not).
async function requireAdminOrThrow() {
    const { authorized } = await requireAdmin();
    if (!authorized) {
        throw new Error("Only an Admin can update payment status.");
    }
}

/**
 * Toggles Invoices.Paid(+Date). Checking Paid requires a Date (this is a
 * record of a payment that already happened elsewhere — a paid invoice
 * with no date is a weak record); unchecking always clears Paid Date too,
 * so a stale date never lingers if it's checked again later.
 */
export async function updatePaidAction(prevState, formData) {
    await requireAdminOrThrow();

    const invoiceId = formData.get("invoiceId");
    const paid = formData.get("paid") === "on";
    const paidDate = formData.get("paidDate") || null;

    if (paid && !paidDate) {
        return { error: "Paid Date is required when marking as Paid." };
    }

    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) throw new Error("Invoice not found");

    try {
        await updateInvoice(invoice.id, {
            paid,
            paidDate: paid ? paidDate : null,
        });
    } catch (err) {
        console.error("updatePaidAction failed", err);
        return { error: "Something went wrong updating payment status. Please try again." };
    }

    redirect(`/invoices/${invoiceId}?done=paid-updated`);
}
