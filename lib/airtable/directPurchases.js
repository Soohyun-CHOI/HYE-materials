import { base, TABLES, findByRecordIds } from "./client";
import { formulaString } from "../airtableFormula";
import { generateNextDirectPurchaseId } from "../ids";

/**
 * Material a site bought directly from a vendor with no order behind it (#272).
 *
 * WHY THE ROW EXISTS AT ALL. The vendor's invoice reaches the office,
 * `/invoices/new` has no order for it to charge, and the office cannot raise the
 * purchase request either: a request needs a `Discipline`, `Purchase Requests."Job"` is
 * a lookup THROUGH that link, and only the site knows which discipline it was. So the
 * office records what the invoice says here — vendor, code, date, the document
 * itself, and the Job it learned by telephone — and the site raises the request
 * from it. That is also why this is a table rather than a Draft request: a Draft
 * could not carry the Job, and `canViewPR` shows a Draft to its requester alone,
 * so an office-owned Draft would reach nobody.
 *
 * NO ITEMS AND NO TOTAL. The invoice document travels with the row and the
 * requester types the items into the request, which is the app's one place a
 * human types an item — the sentence #278 leaned on when it removed the
 * free-text charge. A total would be a figure nobody reconciles against, which
 * is what #211 removed from the overage read path.
 *
 * WHAT IS NOT STORED: whether the row is still waiting. That is read from
 * `Purchase Request` and, when it is set, from that request's own `Status` —
 * empty means nobody has claimed it, `Draft` means somebody has and has not
 * submitted it, `In Review` or beyond means the fact has a home on `/prs`. A
 * status field here would be a second copy of it, which is the shape this whole
 * design avoids: the request's KIND is read from the same link and is stored
 * nowhere else.
 */
function recordToDirectPurchase(record) {
    return {
        id: record.id,
        directPurchaseId: record.get("Direct Purchase ID"),
        vendor: record.get("Vendor") || [],
        // Required by the app: the strip lists rows on the jobs a viewer may
        // reach, so a row with no Job reaches nobody. A direct link rather than a
        // lookup — see the header for why that is the reason this table exists.
        job: record.get("Job") || [],
        vendorInvoiceCode: record.get("Vendor Invoice Code") || "",
        issueDate: record.get("Issue Date"),
        file: record.get("File") || [],
        notes: record.get("Notes") || "",
        recordedBy: record.get("Recorded By") || [],
        createdAt: record.get("Created At"),
        // Single-record in practice, app-enforced: the Metadata API refuses
        // `prefersSingleRecordLink` on both CREATE and UPDATE (422), the same limit
        // `Invoices."Delivery"` and `Invoice Items."PO Item"` live with. Readers
        // take `[0]`.
        purchaseRequest: record.get("Purchase Request") || [],
    };
}

/**
 * Many rows by record id, batched — one query per 50 (#193).
 *
 * The strip's reader. It arrives with the ids off `Jobs."Direct Purchases"`,
 * because `filterByFormula` cannot match a link field against a record id and the
 * Job is what scopes the list; `getAllJobs` already carries the array, so finding
 * a job's rows costs no query of its own.
 */
export async function getDirectPurchasesByRecordIds(recordIds) {
    return (await findByRecordIds(TABLES.DIRECT_PURCHASES, recordIds)).map(recordToDirectPurchase);
}

/**
 * One row by its own `Direct Purchase ID`, or null (#331).
 *
 * The file route's reader. By that id rather than by record id because the strip
 * that links the file already carries it beside the record id it hands the claim
 * action, so the href costs no read to build. It carries the `Job` link, which is
 * what `canAccessJobDeliveries` is answered on.
 */
export async function getDirectPurchaseByDirectPurchaseId(directPurchaseId) {
    const records = await base(TABLES.DIRECT_PURCHASES)
        .select({
            filterByFormula: `{Direct Purchase ID} = "${formulaString(directPurchaseId)}"`,
            maxRecords: 1,
        })
        .firstPage();

    if (records.length === 0) return null;
    return recordToDirectPurchase(records[0]);
}

/** One row by record id, or null. The claim action's re-read. */
export async function getDirectPurchaseByRecordId(recordId) {
    const record = await base(TABLES.DIRECT_PURCHASES).find(recordId);
    if (!record) return null;
    return recordToDirectPurchase(record);
}

/**
 * Record one direct purchase. `Direct Purchase ID` is backend-generated
 * (lib/ids.js) and never passed in.
 *
 * `file` IS A FRESH VERCEL BLOB URL AND NOTHING ELSE. The office uploads the
 * invoice on `/invoices/new` before anything is created, so the object is one
 * nobody has ingested yet and Airtable can fetch it — no re-upload is needed here,
 * unlike the overage request, whose source is Airtable's own copy of an invoice
 * (#167). The caller schedules `confirmIngestThenDelete` at the end of its action,
 * never here (#140).
 *
 * WRITTEN ONCE AND NEVER REWRITTEN. There is no updater for this attachment, for
 * #142's measured reason: re-submitting an attachment url Airtable itself issued
 * returns success and silently empties the field once it has expired. If a row
 * ever needs a different document, that is a new row.
 */
export async function createDirectPurchase({
    vendorRecordId,
    jobRecordId,
    vendorInvoiceCode,
    issueDate,
    notes,
    recordedByUserId,
    file,
}) {
    const record = await generateNextDirectPurchaseId((directPurchaseId) =>
        base(TABLES.DIRECT_PURCHASES).create({
            "Direct Purchase ID": directPurchaseId,
            Vendor: vendorRecordId ? [vendorRecordId] : [],
            Job: jobRecordId ? [jobRecordId] : [],
            "Vendor Invoice Code": vendorInvoiceCode || "",
            // Omitted rather than written empty when the office has not read a date
            // off the document: Airtable takes `null` for a date but an empty string
            // is a value, and the same care the Unit select needs (CLAUDE.md).
            ...(issueDate ? { "Issue Date": issueDate } : {}),
            Notes: notes || "",
            "Recorded By": recordedByUserId ? [recordedByUserId] : [],
            // When the office recorded it, UTC instant, *At convention. Distinct
            // from `Issue Date` on purpose — an invoice recorded weeks after it was
            // issued is the ordinary case here — and it is what the strip orders by.
            "Created At": new Date().toISOString(),
            File: file || [],
        })
    );

    return recordToDirectPurchase(record);
}

/**
 * Point this row at the request a site raised from it.
 *
 * THE LAST WRITE OF THE CLAIM, and deliberately: it is what marks the row as
 * taken, so nothing marks it before the Draft it points at exists in full. Same
 * ordering as `setDeliveryItemOveragePR` (#167), and the same reason.
 *
 * ONE-WAY. Nothing clears it: a claimed row whose Draft is deleted loses the link
 * with the record, because Airtable drops a link to a destroyed row, and the strip
 * then reads it as unclaimed again — which is the honest answer.
 */
export async function setDirectPurchaseRequest(recordId, prRecordId) {
    const record = await base(TABLES.DIRECT_PURCHASES).update(recordId, {
        "Purchase Request": prRecordId ? [prRecordId] : [],
    });
    return recordToDirectPurchase(record);
}
