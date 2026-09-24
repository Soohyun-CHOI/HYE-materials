// PO PDF generation (issue #13) — builds the 2-page PO document (header +
// item table), appends every quotation on the request behind it (#40 —
// lib/poQuotations.js owns which, in what order and how), uploads the merged
// bytes to the existing Public Vercel Blob store, and writes the result onto
// the PO record. Called from both the Sign action and the manual "regenerate
// PDF" retry (app/pos/[poId]/actions.js) — same function either way.
//
// THE ITEM COLUMN'S WIDTH HAS NEVER BEEN MEASURED AGAINST WHAT IT HOLDS, and #416
// is where that became worth writing down rather than fixing. `cellItem` is 27% of
// the content width and `Text` wraps, so a long name grows the row instead of
// overflowing; what nobody has checked is how many lines the longest one takes or
// whether that is acceptable on the page. #416 changed the string in this column
// from the category's composed path to the category's item name, and the reason it
// needed no work here is RELATIVE rather than absolute: measured over the whole
// catalog, **0 of the 777 names are longer than the path they replace** — 99
// characters at the longest against 146, and 30 at the median against 55 — so the
// column can only have got easier. An absolute check is a real gap and is left
// open deliberately: it is a risk nobody has observed, and the honest place for it
// is its own issue raised when somebody has.

import path from "path";
import { Document, Page, View, Text, Font, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { put } from "@vercel/blob";
import { after } from "next/server";
import { TABLES } from "./airtable/client";
import { childKind } from "./idSequence";
import { ORDER_PAGE_SIZE, appendQuotations, orderQuotations } from "./poQuotations";
import { confirmIngestThenDelete, deleteBlobBestEffort } from "./blobIngest";
import { getPOByRecordId, updatePO } from "./airtable/purchaseOrders";
import { getItemsByPO } from "./airtable/poItems";
import { getPRByRecordId } from "./airtable/purchaseRequests";
import { getJobByRecordId } from "./airtable/jobs";
import { getVendorByRecordId } from "./airtable/vendors";
import { getAddressByRecordId } from "./airtable/addresses";
import { getUserByRecordId, getPresidentUser } from "./airtable/users";
import { getQuotationsByPR } from "./airtable/quotations";
import { INSTANT_FORMAT, formatInstant } from "./format";
import { fullUserName } from "./userName";

// Registered from a bundled file rather than a remote Google Fonts URL so
// generation doesn't depend on an external fetch succeeding at render time.
// NOTE: not yet confirmed this file survives Vercel's serverless file
// tracing on an actual deploy (only verified in local dev so far) — if a
// deployed PDF renders with the fallback font instead of cursive, this is
// the first thing to check.
Font.register({
    family: "Dancing Script",
    src: path.join(process.cwd(), "assets/fonts/DancingScript-Regular.ttf"),
});

/**
 * The company's legal name, as a vendor reads it on the order document — NOT the
 * product's name, which is `lib/productName.js:PRODUCT_NAME` and has a different
 * owner. Exported since #281, which mails this document to the vendor and needs the
 * body to name the buyer the same way the attachment does; the alternative was a
 * second copy of the string, which is what having one owner exists to prevent.
 */
export const HYE_BUYER_NAME = "HANYANGENG USA INC.";
const HYE_BUYER_ADDRESS = "1635 Scottsdale Dr, Cedar Park TX 78641, USA";

/**
 * The zone and the locale this document states a time in (#374).
 *
 * THIS IS THE ONE SURFACE WITH NO READER TO RESOLVE AGAINST, which is why it is
 * the one place that names a zone at all. Every screen draws an instant in the
 * reader's own zone and therefore says nothing about which one it is; a vendor
 * holding a printed page is not a runtime this app can ask. Left alone, the
 * signature line rendered against whatever the renderer's zone was — UTC on
 * Vercel — with nothing on the paper to say so, so the hour disagreed with the
 * hour the President pressed the button and the reader had no way to convert it.
 *
 * THE COMPANY'S ZONE RATHER THAN UTC, AND THE ADDRESS ABOVE IS THE REASON. The
 * buyer is in Cedar Park, Texas; a US vendor reading `3:51 PM CDT` converts
 * nothing and sees the hour the signature happened at, while `20:51 UTC` is
 * correct, unambiguous and still arithmetic somebody has to do.
 *
 * A ZONE NAME AND NEVER AN OFFSET. `America/Chicago` observes daylight saving, so
 * a stored `-05:00` or `-06:00` would be right for half the year — and the
 * document would be wrong in the half nobody checks. `timeZoneName: "short"`
 * renders whichever of `CST` / `CDT` was in force at that instant, which is the
 * same reason the name is the thing stored.
 *
 * AND THE LOCALE IS PINNED FOR THE SAME REASON THE MONEY IS. `formatUSD` fixes
 * `en-US` because a vendor reads the figure; an unpinned locale would order the
 * day and the month against the renderer's own, which is a fact about Vercel and
 * not about the reader.
 */
const DOCUMENT_ZONE = "America/Chicago";
const DOCUMENT_LOCALE = "en-US";
const SIGNED_AT_FORMAT = {
    ...INSTANT_FORMAT,
    timeZone: DOCUMENT_ZONE,
    timeZoneName: "short",
};

const TERMS = [
    "If within 2 days from Seller's receipt of this PO Buyer does not receive written notice from Seller rejecting this PO, the PO shall be deemed accepted by Seller.",
    "This PO is subject to the general terms and conditions executed between Seller and Buyer.",
    "Payment Method : 100% within 1 month after delivery",
    "Seller shall bear risk of loss or damage to the products in transit. To ensure that, Seller shall maintain at its own expense liability insurance that covers more than Contract Amount",
    "Seller must give a notice prior to delivery to Buyer if any of the items in this PO is under any regulation or restriction of trade by the law of Seller's government.",
    "In case of selling dangerous goods, Seller must give a notice which is MSDS (Material Safety Data Sheet) before delivery date comes",
];

const styles = StyleSheet.create({
    page: { padding: 32, fontSize: 9, fontFamily: "Helvetica" },
    title: { fontSize: 16, fontWeight: 700, textAlign: "center", marginBottom: 4 },
    subtitle: { fontSize: 10, textAlign: "center", marginBottom: 12 },
    row: { flexDirection: "row", marginBottom: 8 },
    col: { flex: 1, paddingRight: 8 },
    label: { fontWeight: 700, marginBottom: 2 },
    line: { marginBottom: 2 },
    sectionTitle: { fontSize: 10, fontWeight: 700, marginTop: 10, marginBottom: 4 },
    termLine: { marginBottom: 3, lineHeight: 1.3 },
    table: { marginTop: 8 },
    tableRow: { flexDirection: "row", borderBottom: "1 solid #ccc", paddingVertical: 4 },
    tableHeaderRow: { flexDirection: "row", borderBottom: "1 solid #000", paddingBottom: 4, fontWeight: 700 },
    cellNo: { width: "5%" },
    cellItem: { width: "27%" },
    cellSize: { width: "10%" },
    cellUnit: { width: "8%" },
    cellQty: { width: "10%", textAlign: "right" },
    cellPrice: { width: "13%", textAlign: "right" },
    cellAmount: { width: "13%", textAlign: "right" },
    cellRemark: { width: "14%" },
    totalRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8, fontWeight: 700 },
    signatureName: { fontFamily: "Dancing Script", fontSize: 18, marginTop: 4 },
    footer: { position: "absolute", bottom: 20, left: 32, right: 32, textAlign: "center", fontSize: 8, color: "#666" },
});

function fmtAddress(address) {
    return address?.formattedAddress || "—";
}

function POPdfDocument({ po, items, job, vendor, ourPic, ourManager, president, deliveryAddress, vendorAddress, totalAmount }) {
    return (
        <Document>
            <Page size={ORDER_PAGE_SIZE} style={styles.page}>
                <Text style={styles.title}>PURCHASE ORDER</Text>
                <Text style={styles.subtitle}>HANYANG ENG USA Inc. — P/O NO: {po.poId}</Text>

                <View style={styles.row}>
                    <View style={styles.col}>
                        <Text style={styles.label}>Supplier&apos;s Name & Address</Text>
                        <Text style={styles.line}>{vendor?.vendorName || "—"}</Text>
                        <Text style={styles.line}>{fmtAddress(vendorAddress)}</Text>
                        <Text style={styles.line}>PIC: {vendor?.picName || "—"}</Text>
                        <Text style={styles.line}>TEL: {vendor?.picPhone || "—"}</Text>
                        <Text style={styles.line}>E-Mail: {vendor?.picEmail || "—"}</Text>
                    </View>
                    <View style={styles.col}>
                        <Text style={styles.label}>Buyer&apos;s Name & Address</Text>
                        <Text style={styles.line}>{HYE_BUYER_NAME}</Text>
                        <Text style={styles.line}>{HYE_BUYER_ADDRESS}</Text>
                        <Text style={styles.line}>PIC: {fullUserName(ourPic) || "—"}</Text>
                        <Text style={styles.line}>TEL: {ourPic?.phone || "—"}</Text>
                        <Text style={styles.line}>E-Mail: {ourPic?.email || "—"}</Text>
                    </View>
                </View>

                <View style={styles.row}>
                    <View style={styles.col}>
                        <Text style={styles.line}>Currency: USD</Text>
                        <Text style={styles.line}>P/O Date: {po.createdDate}</Text>
                        <Text style={styles.line}>Delivery Date: TBD</Text>
                        <Text style={styles.line}>Delivery Terms: TBD</Text>
                        <Text style={styles.line}>PJT: {job?.jobName || "—"}</Text>
                    </View>
                    <View style={styles.col}>
                        <Text style={styles.label}>Notify Party</Text>
                        <Text style={styles.line}>{HYE_BUYER_NAME}</Text>
                        <Text style={styles.line}>PIC: {fullUserName(ourManager) || "—"}</Text>
                        <Text style={styles.line}>TEL: {ourManager?.phone || "—"}</Text>
                        <Text style={styles.line}>E-Mail: {ourManager?.email || "—"}</Text>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>Special Terms & Conditions</Text>
                {TERMS.map((term, i) => (
                    <Text key={i} style={styles.termLine}>
                        {i + 1}. {term}
                    </Text>
                ))}

                {/* #384 — ONE BLOCK, AND THE QUALIFIER WENT WITH THE SECOND ONE.
                    This read `*Deliver To (Heavy Load)` over the job's default
                    address and `*Alternate Delivery Address (Fedex, UPS etc..)`
                    over `Jobs."Alternate Delivery Address"` when the job had one.
                    That field is gone, so `(Heavy Load)` names a distinction this
                    document no longer draws — it only ever meant "not the parcel
                    address", and there is no parcel address to contrast with. A
                    vendor reads this line, so it says where to deliver and stops.

                    #386 CHANGED WHERE THE VALUE COMES FROM AND NOT ONE WORD OF THE
                    DOCUMENT. The title, the block and the single line under it are
                    what #384 left; what moved is that the address is the one the
                    order froze at generation rather than the job's default read
                    live. Recorded here because a vendor reads this block, so
                    "nothing changed for them" should be checkable against the
                    source rather than inferred from a diff. */}
                <Text style={styles.sectionTitle}>*Deliver To</Text>
                <Text style={styles.line}>{fmtAddress(deliveryAddress)}</Text>

                <View style={[styles.row, { marginTop: 16 }]}>
                    <View style={styles.col}>
                        <Text style={styles.label}>Seller</Text>
                        <Text style={styles.line}>{vendor?.vendorName || "—"}</Text>
                    </View>
                    <View style={styles.col}>
                        <Text style={styles.label}>Buyer</Text>
                        <Text style={styles.line}>{HYE_BUYER_NAME}</Text>
                        <Text style={styles.line}>By:</Text>
                        <Text style={styles.signatureName}>{fullUserName(president) || "President"}</Text>
                        <Text style={styles.line}>
                            {fullUserName(president) || "President"} — Signed {po.presidentSignedAt ? formatInstant(po.presidentSignedAt, SIGNED_AT_FORMAT, DOCUMENT_LOCALE) : ""}
                        </Text>
                    </View>
                </View>

                <Text style={styles.footer}>Page 1 of 2</Text>
            </Page>

            <Page size={ORDER_PAGE_SIZE} style={styles.page}>
                <Text style={styles.subtitle}>{po.poId} — Items</Text>
                <View style={styles.table}>
                    <View style={styles.tableHeaderRow}>
                        <Text style={styles.cellNo}>NO</Text>
                        <Text style={styles.cellItem}>ITEM</Text>
                        <Text style={styles.cellSize}>SIZE</Text>
                        <Text style={styles.cellUnit}>UNIT</Text>
                        <Text style={styles.cellQty}>Q&apos;ty</Text>
                        <Text style={styles.cellPrice}>PRICE (USD)</Text>
                        <Text style={styles.cellAmount}>AMOUNT (USD)</Text>
                        <Text style={styles.cellRemark}>REMARK</Text>
                    </View>
                    {items.map((it, i) => (
                        <View key={it.id} style={styles.tableRow}>
                            <Text style={styles.cellNo}>{i + 1}</Text>
                            <Text style={styles.cellItem}>{it.itemName}</Text>
                            <Text style={styles.cellSize}>{it.size}</Text>
                            <Text style={styles.cellUnit}>{it.unit}</Text>
                            <Text style={styles.cellQty}>{it.qty}</Text>
                            <Text style={styles.cellPrice}>{Number(it.unitPrice).toFixed(2)}</Text>
                            <Text style={styles.cellAmount}>{Number(it.amount).toFixed(2)}</Text>
                            <Text style={styles.cellRemark}>{it.remark}</Text>
                        </View>
                    ))}
                </View>
                <View style={styles.totalRow}>
                    <Text>TOTAL: USD {Number(totalAmount || 0).toFixed(2)}</Text>
                </View>

                <Text style={styles.footer}>Page 2 of 2</Text>
            </Page>
        </Document>
    );
}

/**
 * Every quotation on the request, in `Quotation ID` order, each with its file's bytes
 * (#40) — `[{ quotationId, filename, bytes }]` for `appendQuotations`.
 *
 * THE LINK ARRAY IS ALREADY IN HAND, so the quotations cost one read and the request
 * is not found a second time (#193's `rowIds`); a request with none costs nothing.
 *
 * A QUOTATION WITH NO FILE IS PASSED ON RATHER THAN SKIPPED, and that is the change
 * from what this replaced, which returned null for it and for every other case it
 * could not use. `appendQuotations` refuses it by name.
 *
 * A FILE THAT CANNOT BE FETCHED THROWS AN ORDINARY ERROR, deliberately not the
 * unreadable code: Airtable's copy is there and the url was read moments ago, so a
 * failed fetch is the one failure here that another press can clear, and the retry's
 * `Please try again.` is true of it.
 */
async function readQuotationFiles(pr) {
    const { seqPrefix } = childKind(TABLES.PURCHASE_REQUESTS, "Quotations");
    const quotations = orderQuotations(await getQuotationsByPR(pr.id, { rowIds: pr.quotationRowIds }), {
        prId: pr.prId,
        seqPrefix,
    });
    return Promise.all(
        quotations.map(async (quotation) => {
            const file = quotation.file?.[0];
            if (!file?.url) return { quotationId: quotation.quotationId, filename: null, bytes: null };
            // Not an Airtable API operation, so the ops counter cannot see it —
            // docs/notes/airtable-access.md on the count being a floor.
            const res = await fetch(file.url);
            if (!res.ok) throw new Error(`Could not fetch quotation ${quotation.quotationId} (${res.status})`);
            return {
                quotationId: quotation.quotationId,
                filename: file.filename ?? null,
                bytes: new Uint8Array(await res.arrayBuffer()),
            };
        })
    );
}

/**
 * Builds the full PO PDF (the order's own pages, then every quotation on the
 * request — lib/poQuotations.js), uploads it to the existing Public Vercel Blob
 * store, writes the result onto the PO record, and then (issue #140) deletes the
 * Blob object once Airtable confirms it took the file — Airtable's copy is the copy
 * of record. That last step is scheduled with after(), so this must be called from a
 * request scope (both callers are Server Actions).
 * Throws on any failure of the document work — callers
 * (signPOAction/regeneratePDFAction) decide how to surface that without
 * touching President Signed/Status, which are committed independently and
 * never rolled back by a PDF failure. A quotation that cannot be appended is one
 * such failure and carries `QUOTATION_UNREADABLE`; nothing is uploaded or written
 * then, so the order stays signed with no document. Cleanup itself never throws.
 */
export async function generateAndAttachPOPdf(poRecordId) {
    const po = await getPOByRecordId(poRecordId);
    if (!po) throw new Error("PO not found");

    const pr = await getPRByRecordId(po.pr[0]);
    const [items, job, vendor, quotationFiles] = await Promise.all([
        getItemsByPO(po.id),
        pr.job?.[0] ? getJobByRecordId(pr.job[0]) : null,
        pr.vendor?.[0] ? getVendorByRecordId(pr.vendor[0]) : null,
        readQuotationFiles(pr),
    ]);

    // #384 — ONE ADDRESS READ FEWER. The job's alternate slot is gone, so this
    // resolves one delivery address and the vendor's own and nothing else. The
    // identifier is `deliveryAddress` rather than `primaryAddress` for the reason
    // the section title changed: `primary` was named after the `Primary` half of
    // `Purchase Orders."Delivery Address Used"`, and with no alternate to contrast
    // with it claims a distinction the base cannot express (docs/notes/naming.md's
    // test — does the name make a claim the contents contradict).
    //
    // #386 — AND THE ONE IT RESOLVES IS THE ORDER'S OWN, NOT THE JOB'S. This read
    // `job.deliveryAddress` and therefore re-answered the question on every
    // regeneration, so editing a job's default address would silently change what
    // an already-sent document says. The order froze its address at generation;
    // this reads that. Same read either way, so the operation count is unchanged.
    // An order with no address prints the em dash `fmtAddress(null)` has printed
    // since #13 — the state `/pos/[poId]` names in words.
    const [ourPic, ourManager, president, deliveryAddress, vendorAddress] = await Promise.all([
        po.ourPic?.[0] ? getUserByRecordId(po.ourPic[0]) : null,
        po.ourManager?.[0] ? getUserByRecordId(po.ourManager[0]) : null,
        getPresidentUser(),
        po.deliveryAddress?.[0] ? getAddressByRecordId(po.deliveryAddress[0]) : null,
        vendor?.address?.[0] ? getAddressByRecordId(vendor.address[0]) : null,
    ]);

    const baseBytes = await renderToBuffer(
        <POPdfDocument
            po={po}
            items={items}
            job={job}
            vendor={vendor}
            ourPic={ourPic}
            ourManager={ourManager}
            president={president}
            deliveryAddress={deliveryAddress}
            vendorAddress={vendorAddress}
            totalAmount={po.totalAmount}
        />
    );

    // Throws before anything is uploaded when a quotation cannot be appended, so a
    // refusal leaves no Blob object behind and writes nothing to the order.
    const finalBytes = Buffer.from(await appendQuotations(baseBytes, quotationFiles));

    const filename = `${po.poId}.pdf`;
    const blob = await put(filename, finalBytes, {
        access: "public",
        contentType: "application/pdf",
        addRandomSuffix: true,
    });

    // Issue #140 — the Blob object exists only so Airtable can fetch the
    // bytes. The two failure directions are opposite: a write that throws
    // will never be ingested, so the object is dead weight immediately; an
    // unconfirmed ingest might still land, so that object has to stay.
    let attached;
    try {
        attached = await updatePO(po.id, { poPdfFile: [{ url: blob.url, filename }] });
    } catch (err) {
        await deleteBlobBestEffort(blob.url, `PO PDF ${po.poId}`);
        throw err;
    }

    // Done here rather than in the callers (signPOAction / regeneratePDFAction)
    // because this function owns the object and the attachment id that
    // identifies it, so "the end of the action that ingested it" is the end of
    // this function. It also removes regenerate's second orphan: each run now
    // cleans up the object whose attachment it just replaced.
    //
    // Scheduled with after(), not awaited: signPOAction awaits this whole
    // function, so an awaited confirm would sit on the President's response
    // path — being non-fatal to the signature doesn't make it off the clock.
    // That does mean this function now expects a request scope; both callers
    // are Server Actions, and no script can reach it in any case — this file
    // contains JSX, so a plain `node` import of it fails to parse.
    after(() =>
        confirmIngestThenDelete([
            {
                table: TABLES.PURCHASE_ORDERS,
                recordId: po.id,
                field: "PO PDF File",
                blobUrl: blob.url,
                attachmentId: attached.poPdfFile?.[0]?.id,
                label: `PO PDF ${po.poId}`,
            },
        ])
    );

    // No URL is returned: by this point the Blob object is gone, and the
    // durable link lives on the PO record (Airtable's own copy). Both callers
    // already ignored the old return value.
}
