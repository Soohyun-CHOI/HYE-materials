import { NextResponse } from "next/server";
import { withOpsLabel } from "@/lib/airtableOps";
import { getActiveUser } from "@/lib/authz";
import { canAccessJobDeliveries } from "@/lib/deliveryAccess";
import { getVisibleInvoiceIds } from "@/lib/invoiceVisibility";
import { canViewPR } from "@/lib/prVisibility";
import { FILE_AXIS, SERVABLE_CONTENT_TYPES } from "@/lib/fileLinks";
import { getDeliveryById } from "@/lib/airtable/deliveries";
import { getDirectPurchaseByDirectPurchaseId } from "@/lib/airtable/directPurchases";
import { getItemsByInvoice } from "@/lib/airtable/invoiceItems";
import { getInvoiceById } from "@/lib/airtable/invoices";
import { getPOById } from "@/lib/airtable/purchaseOrders";
import { getPRByRecordId } from "@/lib/airtable/purchaseRequests";
import { getQuotationByQuotationId } from "@/lib/airtable/quotations";

// Every uploaded file this app shows is served here (#331).
//
// WHAT THIS REPLACES. Six screens linked Airtable's own signed attachment url,
// which dies at the wall-clock instant its own path segment names — observed on this
// base going 200 to 410 at 18:00:11Z on a url captured at 15:23:39Z whose stamp read
// 18:00:00Z. So a held tab, a bookmark and a forwarded link all ended at a white page
// outside the app. This re-reads the record on every request, which is the rule
// `uploads-and-drafts.md` already held for these urls, written as a link instead of
// as a caution.
//
// THE QUIET MUTANT THIS ROUTE IS, AND WHY `authz-structure.mjs` PASSING IS NOT THE
// ANSWER. Five fields reach one handler and they sit behind THREE different gates. An
// exemption in that check proves only that the named helper is called somewhere
// inside the export, and it does not check order — so `getActiveUser()` here plus one
// gate for all five satisfies it completely, no screen changes, and a reader opens a
// file on a job they are not on. `offline/file-route.mjs` is what closes that: the
// map below declares each axis's gate, each `open*` function must call the gate its
// own axis declares and no other, and swapping one fails.
//
// IT STREAMS RATHER THAN REDIRECTING, and the reason is not cost. A 302 would put
// Airtable's url in the reader's address bar, where it is a public bearer link for
// two to four hours with no session — which trades "the link on the page expires" for
// "the link in the address bar admits anybody", in an app whose whole premise is a
// per-record gate. It also cannot set a disposition or a filename, and all three of
// the other defects #331 carries are Airtable's headers: the saved name loses a space
// (`HYE logo.png` came back as `filename="HYElogo.png"`) and the type decides whether
// a click views or saves. Cost is bounded by #146's ceiling at 20 MB in and 20 MB
// out; the largest file anybody has actually put through this app is 493 KB, and the
// body is piped rather than buffered.
//
// `inline` IS LOAD-BEARING, not a preference. The viewer puts this response in a
// frame, and `attachment` makes a browser save instead of display. What makes a
// download a download is the viewer's own anchor, which carries `download` and works
// because this route is same-origin — the very thing #331 records as impossible
// across origins.
//
// NO `Content-Security-Policy: sandbox` AND NO `X-Frame-Options`. Sandbox breaks
// in-frame document rendering and we frame this ourselves. What shuts the door
// instead is the content-type allowlist: an attachment added by hand in Airtable can
// claim any type, and anything outside the three becomes `application/octet-stream`,
// which `nosniff` will not let a browser reinterpret as markup.

/** Answers a missing record and a refused one identically. */
function notFound() {
    // ONE REFUSAL FOR TWO STATES, which is the rule every one of these screens
    // already follows: never confirm that a record exists outside someone's scope.
    // It matters more here than on a page, because the id in the url is a document id
    // a person can guess a neighbor of — and guessing learns nothing, since a hit
    // outside scope reads exactly like a miss.
    return new NextResponse("Not found.", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
}

/**
 * A quotation's file, gated through the request it hangs off.
 *
 * Three operations with the session: this record, its parent, and the gate is pure.
 */
async function openQuotation(user, quotationId) {
    const quotation = await getQuotationByQuotationId(quotationId);
    if (!quotation?.pr?.[0]) return null;

    const pr = await getPRByRecordId(quotation.pr[0]);
    if (!pr || !canViewPR(user, pr)) return null;

    return quotation.file?.[0] ?? null;
}

/**
 * The order document, gated through the request the order was generated from.
 *
 * `poPdfFile` and NEVER `quotationFile`, which sits on the same mapper one line
 * above it: that is a Lookup chain onto `Quotations.File` with no reader, and serving
 * it here would make one file reachable under two axes.
 */
async function openPurchaseOrder(user, poId) {
    const po = await getPOById(poId);
    if (!po?.pr?.[0]) return null;

    const pr = await getPRByRecordId(po.pr[0]);
    if (!pr || !canViewPR(user, pr)) return null;

    return po.poPdfFile?.[0] ?? null;
}

/**
 * The vendor's invoice document, gated by the walk that reaches `canViewPR` from an
 * invoice (#211).
 *
 * The invoice items are read because the gate is answered through them, exactly as
 * `/invoices/[invoiceId]` reads them before asking — an `Invoice Items` row carries
 * its own `PO` link, which is how one invoice reaches the requests behind it.
 *
 * MEASURED AT FOUR OPERATIONS FOR THE OFFICE AND SIX FOR A SITE READER, and the
 * office's fourth is deliberate. `seesEveryInvoice` would let this skip the items
 * read when the walk is going to be skipped anyway, saving one — and it would make
 * this the third invoice surface that asks who the reader is, which is exactly the
 * shape #314 took out of the other two when it inverted
 * `offline/invoice-visibility.mjs`'s assertion. One operation on a click is not worth
 * reintroducing it. The double `Invoices` read is `getInvoiceById` plus the walk's
 * own, and belongs to that module rather than to this caller.
 */
async function openInvoice(user, invoiceId) {
    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) return null;

    const items = await getItemsByInvoice(invoice.id);
    const visibleIds = await getVisibleInvoiceIds(user, [invoice], items);
    if (!visibleIds.has(invoice.id)) return null;

    return invoice.file?.[0] ?? null;
}

/** The packing list photo, gated on the delivery's own Job. Two operations. */
async function openDelivery(user, deliveryId) {
    const delivery = await getDeliveryById(deliveryId);
    if (!delivery || !canAccessJobDeliveries(user, delivery.job?.[0])) return null;

    return delivery.packingListFile?.[0] ?? null;
}

/**
 * A direct purchase's file, on the same Job rule the strip that links it uses.
 *
 * `canAccessJobDeliveries` rather than a rule of its own, which `naming.md` records
 * as a delivery-shaped name for a Job-shaped question: #272 asked it of this table
 * and did not rename it, because one implementation beats two with better names.
 */
async function openDirectPurchase(user, directPurchaseId) {
    const directPurchase = await getDirectPurchaseByDirectPurchaseId(directPurchaseId);
    if (!directPurchase || !canAccessJobDeliveries(user, directPurchase.job?.[0])) return null;

    return directPurchase.file?.[0] ?? null;
}

/**
 * Axis to gate to opener. THE ONE PLACE THE FIVE FIELDS AND THE THREE GATES MEET.
 *
 * `gate` is a declaration and `open` is the implementation, and they are two places
 * on purpose — `offline/file-route.mjs` compares them against each other and against
 * its own table, so an axis whose opener calls somebody else's gate fails on the
 * disagreement rather than on anybody noticing. A token absent from here answers
 * before a record is read.
 */
const AXES = {
    [FILE_AXIS.quotation]: { gate: canViewPR, open: openQuotation },
    [FILE_AXIS.purchaseOrder]: { gate: canViewPR, open: openPurchaseOrder },
    [FILE_AXIS.invoice]: { gate: getVisibleInvoiceIds, open: openInvoice },
    [FILE_AXIS.delivery]: { gate: canAccessJobDeliveries, open: openDelivery },
    [FILE_AXIS.directPurchase]: { gate: canAccessJobDeliveries, open: openDirectPurchase },
};

export async function GET(request, { params }) {
    return withOpsLabel("GET /api/files/[axis]/[documentId]/[filename]", async () => {
        const { axis, documentId } = await params;

        const entry = AXES[axis];
        if (!entry) return notFound();

        const user = await getActiveUser();
        // A page cannot reach this state — the viewer's frame only exists on a screen
        // that already rendered with a session — so what lands here is a forwarded
        // link, and the app's own front door is the useful answer. `requireUser()`
        // cannot be used: `redirect()` is for the page-render pipeline.
        if (!user) {
            return NextResponse.redirect(new URL("/login", request.url), 302);
        }

        const attachment = await entry.open(user, decodeURIComponent(documentId));
        if (!attachment?.url) return notFound();

        // The attachment url is used the instant it is read and stored nowhere, which
        // is the same discipline `sendPOToVendorAction` keeps. Not an Airtable
        // operation, so the counter above cannot see it.
        const upstream = await fetch(attachment.url);
        if (!upstream.ok || !upstream.body) {
            console.error("GET /api/files could not read the attachment", axis, documentId, upstream.status);
            return notFound();
        }

        const claimed = String(attachment.type || "").toLowerCase();
        const type = SERVABLE_CONTENT_TYPES.includes(claimed) ? claimed : "application/octet-stream";

        return new NextResponse(upstream.body, {
            status: 200,
            headers: {
                "content-type": type,
                // The record's own filename, which is the human's original — the
                // random suffix #140 describes is on the Blob object's name and never
                // reached Airtable. Quoted, and quotes stripped out of the value so a
                // filename cannot close the parameter early.
                "content-disposition": `inline; filename="${String(attachment.filename || "file").replace(/"/g, "")}"`,
                "x-content-type-options": "nosniff",
                // Gated bytes from our own origin: no shared cache may hold them, and
                // Airtable's own `max-age=14400, immutable` must not be inherited.
                "cache-control": "private, no-store",
            },
        });
    });
}
