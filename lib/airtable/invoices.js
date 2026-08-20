import { base, findByRecordIds, TABLES } from "./client";
import { formulaString } from "../airtableFormula";
import { generateNextInvoiceId } from "../ids";

/**
 * Find an invoice by its backend-generated Invoice ID.
 * Returns null if not found.
 */
export async function getInvoiceById(invoiceId) {
    const records = await base(TABLES.INVOICES)
        .select({
            filterByFormula: `{Invoice ID} = "${formulaString(invoiceId)}"`,
            maxRecords: 1,
        })
        .firstPage();

    if (records.length === 0) return null;
    return recordToInvoice(records[0]);
}

/**
 * List every invoice, most-recently-created first (issue #115's list page).
 * Sorted by Invoice ID text, not Issue Date (#117): Issue Date is date-only,
 * so same-day invoices tie and fall back to arbitrary API order. Invoice ID
 * (HYE-INV-YYMMDD-##) is the creation date plus a zero-padded daily sequence,
 * so a plain string sort is exact chronological creation order with no
 * timestamp field — the same established pattern the create-invoice PO picker
 * uses for PO IDs (#91). (Sequence is 2-digit zero-padded; as with that PO
 * sort, string order only diverges from numeric if a single day ever exceeds
 * 99 invoices, far beyond this project's volume.)
 *
 * Access is gated at the page (President-or-Admin), not here — there is no
 * per-requester scoping: an invoice is a received vendor document, not a
 * user-owned record. Full fetch with no pagination is fine at this project's
 * volume (same call shape as getAllVendors/getAllJobs); revisit if invoice
 * counts ever grow large.
 */
/**
 * Invoices by record id, batched (#166). One query per 50 ids rather than one per
 * invoice — the delivery-status join needs the `Issue Date` and `Invoice ID` of
 * every invoice on an ordered item to order them, including bills the caller never
 * asked about.
 */
export async function getInvoicesByRecordIds(recordIds) {
    return (await findByRecordIds(TABLES.INVOICES, recordIds)).map(recordToInvoice);
}

export async function getAllInvoices() {
    const records = await base(TABLES.INVOICES)
        .select({ sort: [{ field: "Invoice ID", direction: "desc" }] })
        .all();

    return records.map(recordToInvoice);
}

function recordToInvoice(record) {
    return {
        id: record.id,
        invoiceId: record.get("Invoice ID"),
        vendorInvoiceCode: record.get("Vendor Invoice Code"),
        vendor: record.get("Vendor"),
        issueDate: record.get("Issue Date"),
        dueDate: record.get("Due Date"),
        amountDue: record.get("Amount Due"),
        shippingFee: record.get("Shipping Fee"),
        tariff: record.get("Tariff"), // issue #57 — optional, only set when the vendor's invoice itemizes one
        // Issue #78 — Items Subtotal (rollup of Invoice Items.Amount) and
        // Calculated Total (+ Shipping Fee + Tariff) are read-only, given
        // the existing submit-time comparison against Amount Due a stored
        // value to reference. Comparison/warning logic itself is unchanged.
        itemsSubtotal: record.get("Items Subtotal"),
        calculatedTotal: record.get("Calculated Total"),
        varianceFlag: record.get("Variance Flag") || false,
        paid: record.get("Paid") || false,
        paidDate: record.get("Paid Date"),
        file: record.get("File"),
        // Issue #166 — the reverse-link array, so a list of invoices can fetch
        // every invoice's invoice items in ONE batched read instead of one read
        // per row. Same trick recordToPR uses for
        // `signerRowIds`/`correctionRowIds` and recordToPO for its children: both
        // sides of a link are core data with no propagation lag, so the ids are
        // already here and cost nothing.
        invoiceItems: record.get("Invoice Items") || [],
        // Issue #210 — the delivery this invoice describes. An ARRAY because the
        // Metadata API refuses `prefersSingleRecordLink`, and single-record only
        // because this app keeps it so; every reader goes through
        // lib/deliveryInvoiceLink.js:linkedDelivery rather than indexing here, so
        // the flattening rule has one home.
        //
        // Empty is a reading rather than a gap: an invoice with no delivery is
        // awaiting delivery, which is the ordinary state of an invoice the vendor
        // emailed at shipment.
        delivery: record.get("Delivery") || [],
    };
}

/**
 * Fetch an invoice by its Airtable record ID rather than its Invoice ID —
 * used after Invoice Items have been created, to re-read Calculated Total
 * once its rollup has caught up (issue #15).
 */
export async function getInvoiceByRecordId(recordId) {
    const record = await base(TABLES.INVOICES).find(recordId);
    return recordToInvoice(record);
}

/**
 * Create an invoice. Invoice ID is backend-generated (top-level daily-reset
 * counter — Invoice<->PO is many-to-many, so it is not a child of one PO).
 * Vendor Invoice Code is the vendor's own printed number: human-entered,
 * purely informational, never guaranteed unique on its own — always scope
 * lookups by Vendor too.
 */
export async function createInvoice({
                                         vendorId,
                                         vendorInvoiceCode,
                                         issueDate,
                                         dueDate,
                                         amountDue,
                                         shippingFee,
                                         tariff,
                                         file,
                                     }) {
    const record = await generateNextInvoiceId((invoiceId) =>
        base(TABLES.INVOICES).create({
            "Invoice ID": invoiceId,
            "Vendor Invoice Code": vendorInvoiceCode || "",
            Vendor: vendorId ? [vendorId] : [],
            "Issue Date": issueDate,
            "Due Date": dueDate,
            "Amount Due": amountDue,
            "Shipping Fee": shippingFee,
            ...(tariff !== undefined && tariff !== null ? { Tariff: tariff } : {}),
            File: file || [],
        })
    );

    return recordToInvoice(record);
}

/**
 * Partial update of an invoice. Marking paid / setting the header-level
 * Variance Flag (#15) are backend-driven; the header scalars (issue #117's
 * edit path) are human-entered corrections. Amount Due is included here
 * deliberately: "never overwritten" means the backend never auto-derives it
 * (unlike Items Subtotal/Calculated Total), not that a person can't correct a
 * mistyped vendor total — and the caller recomputes Variance Flag whenever it
 * changes. Items Subtotal / Calculated Total are never accepted (rollup /
 * formula). Vendor Invoice Code / Tariff accept "" / null to clear.
 */
export async function updateInvoice(
    recordId,
    {
        paid,
        paidDate,
        varianceFlag,
        vendorId,
        vendorInvoiceCode,
        issueDate,
        dueDate,
        amountDue,
        shippingFee,
        tariff,
    }
) {
    const fields = {};
    if (paid !== undefined) fields["Paid"] = paid;
    if (paidDate !== undefined) fields["Paid Date"] = paidDate;
    if (varianceFlag !== undefined) fields["Variance Flag"] = varianceFlag;
    if (vendorId !== undefined) fields["Vendor"] = vendorId ? [vendorId] : [];
    if (vendorInvoiceCode !== undefined) fields["Vendor Invoice Code"] = vendorInvoiceCode;
    if (issueDate !== undefined) fields["Issue Date"] = issueDate;
    if (dueDate !== undefined) fields["Due Date"] = dueDate;
    if (amountDue !== undefined) fields["Amount Due"] = amountDue;
    if (shippingFee !== undefined) fields["Shipping Fee"] = shippingFee;
    // Tariff is a currency field; null clears it (a removed tariff line).
    if (tariff !== undefined) fields["Tariff"] = tariff;

    const record = await base(TABLES.INVOICES).update(recordId, fields);
    return recordToInvoice(record);
}

/**
 * Issue #210 — point an invoice at the delivery it bills for, or clear it.
 *
 * A NARROW SECOND WRITER RATHER THAN A PARAMETER ON updateInvoice, and the reason
 * is that the two answer to different gates. `updateInvoice` is the office's
 * header-correction path and every caller of it is Admin-only (#117); this link is
 * written from the DELIVERY side by a Job-scoped action, because the packing list
 * is where the pairing is known. One function with two authorization axes would
 * make the narrower one unenforceable. Same shape as setPOItemMaterial and
 * replaceDeliveryPhoto: the one field a record lets a neighbor change, written by
 * a function that exists for that alone.
 *
 * WRITES AT MOST ONE ID, WHICH IS THE WHOLE OF THE SINGLE-RECORD ENFORCEMENT ON
 * THE WRITE SIDE — the Airtable field is multi because nothing can make it
 * otherwise. `null` clears it, which is how a wrong pairing is corrected: the
 * delivery's own edit page detaches rather than swapping, so an invoice never moves
 * between deliveries in one write nobody reviewed.
 *
 * NO ARGUMENT CHECKING HERE. Whether this invoice may be paired with this delivery
 * at all is lib/deliveryInvoiceLink.js:invoiceLinkRefusal, applied by the
 * credentialed caller against a fresh read — a check inside the writer would be a
 * second answer to that question, and it could not see the caller's session.
 */
export async function setInvoiceDelivery(invoiceRecordId, deliveryRecordId) {
    const record = await base(TABLES.INVOICES).update(invoiceRecordId, {
        Delivery: deliveryRecordId ? [deliveryRecordId] : [],
    });
    return recordToInvoice(record);
}

/**
 * Link an invoice to a PO via the Invoice-PO Link join table — this is how
 * the many-to-many relationship is expressed (one join row per pair), since
 * one PO commonly has several invoices (partial shipments) and one invoice
 * can span several POs.
 */
export async function linkInvoiceToPO(invoiceRecordId, poRecordId) {
    const record = await base(TABLES.INVOICE_PO_LINK).create({
        Invoice: [invoiceRecordId],
        PO: [poRecordId],
    });

    return { id: record.id };
}
