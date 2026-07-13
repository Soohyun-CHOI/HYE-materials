// PO PDF generation (issue #13) — builds the 2-page PO document (header +
// item table), appends the vendor's Quotation as a PDF-only appendix (see
// #40 for the deferred image-quotation case), uploads the merged bytes to
// the existing Public Vercel Blob store, and writes the result onto the PO
// record. Called from both the Sign action and the manual "regenerate PDF"
// retry (app/pos/[poId]/actions.js) — same function either way.

import path from "path";
import { Document, Page, View, Text, Font, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { PDFDocument } from "pdf-lib";
import { put } from "@vercel/blob";
import { getPOByRecordId, updatePO } from "./airtable/purchaseOrders";
import { getItemsByPO } from "./airtable/poItems";
import { getPRByRecordId } from "./airtable/purchaseRequests";
import { getJobByRecordId } from "./airtable/jobs";
import { getVendorByRecordId } from "./airtable/vendors";
import { getAddressByRecordId } from "./airtable/addresses";
import { getUserByRecordId, getPresidentUser } from "./airtable/users";
import { getQuotationsByPR } from "./airtable/quotations";

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

const HYE_BUYER_NAME = "HANYANGENG USA INC.";
const HYE_BUYER_ADDRESS = "1635 Scottsdale Dr, Cedar Park TX 78641, USA";

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

function POPdfDocument({ po, items, job, vendor, ourPic, ourManager, president, primaryAddress, alternateAddress, vendorAddress, totalAmount }) {
    return (
        <Document>
            <Page size="A4" style={styles.page}>
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
                        <Text style={styles.line}>PIC: {ourPic?.userName || "—"}</Text>
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
                        <Text style={styles.line}>PIC: {ourManager?.userName || "—"}</Text>
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

                <Text style={styles.sectionTitle}>*Deliver To (Heavy Load)</Text>
                <Text style={styles.line}>{fmtAddress(primaryAddress)}</Text>
                {alternateAddress && (
                    <>
                        <Text style={styles.sectionTitle}>*Alternate Delivery Address (Fedex, UPS etc..)</Text>
                        <Text style={styles.line}>{fmtAddress(alternateAddress)}</Text>
                    </>
                )}

                <View style={[styles.row, { marginTop: 16 }]}>
                    <View style={styles.col}>
                        <Text style={styles.label}>Seller</Text>
                        <Text style={styles.line}>{vendor?.vendorName || "—"}</Text>
                    </View>
                    <View style={styles.col}>
                        <Text style={styles.label}>Buyer</Text>
                        <Text style={styles.line}>{HYE_BUYER_NAME}</Text>
                        <Text style={styles.line}>By:</Text>
                        <Text style={styles.signatureName}>{president?.userName || "President"}</Text>
                        <Text style={styles.line}>
                            {president?.userName || "President"} — Signed {po.presidentSignedAt ? new Date(po.presidentSignedAt).toLocaleString() : ""}
                        </Text>
                    </View>
                </View>

                <Text style={styles.footer}>Page 1 of 2</Text>
            </Page>

            <Page size="A4" style={styles.page}>
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
                            <Text style={styles.cellPrice}>{Number(it.rate).toFixed(2)}</Text>
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

async function fetchQuotationPdfBytes(prRecordId) {
    const quotations = await getQuotationsByPR(prRecordId);
    const quotation = quotations[0];
    const file = quotation?.file?.[0];
    if (!file) return null;

    const isPdf = file.type === "application/pdf" || file.filename?.toLowerCase().endsWith(".pdf");
    if (!isPdf) return null; // Non-PDF quotations (images) are #40, deliberately deferred.

    const res = await fetch(file.url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
}

/**
 * Builds the full PO PDF (base document + Quotation appendix, PDF-only —
 * see #40 for the image-quotation follow-up), uploads it to the existing
 * Public Vercel Blob store, and writes the result onto the PO record.
 * Throws on any failure — callers (signPOAction/regeneratePDFAction) decide
 * how to surface that without touching President Signed/Status, which are
 * committed independently and never rolled back by a PDF failure.
 */
export async function generateAndAttachPOPdf(poRecordId) {
    const po = await getPOByRecordId(poRecordId);
    if (!po) throw new Error("PO not found");

    const pr = await getPRByRecordId(po.pr[0]);
    const [items, job, vendor, quotationPdfBytes] = await Promise.all([
        getItemsByPO(po.id),
        pr.job?.[0] ? getJobByRecordId(pr.job[0]) : null,
        pr.vendor?.[0] ? getVendorByRecordId(pr.vendor[0]) : null,
        fetchQuotationPdfBytes(pr.id),
    ]);

    const [ourPic, ourManager, president, primaryAddress, alternateAddress, vendorAddress] = await Promise.all([
        po.ourPic?.[0] ? getUserByRecordId(po.ourPic[0]) : null,
        po.ourManager?.[0] ? getUserByRecordId(po.ourManager[0]) : null,
        getPresidentUser(),
        job?.deliveryAddress?.[0] ? getAddressByRecordId(job.deliveryAddress[0]) : null,
        job?.alternateDeliveryAddress?.[0] ? getAddressByRecordId(job.alternateDeliveryAddress[0]) : null,
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
            primaryAddress={primaryAddress}
            alternateAddress={alternateAddress}
            vendorAddress={vendorAddress}
            totalAmount={po.totalAmount}
        />
    );

    let finalBytes = baseBytes;
    if (quotationPdfBytes) {
        const merged = await PDFDocument.create();
        const basePdf = await PDFDocument.load(baseBytes);
        const quotationPdf = await PDFDocument.load(quotationPdfBytes);

        const basePages = await merged.copyPages(basePdf, basePdf.getPageIndices());
        basePages.forEach((p) => merged.addPage(p));
        const quotationPages = await merged.copyPages(quotationPdf, quotationPdf.getPageIndices());
        quotationPages.forEach((p) => merged.addPage(p));

        finalBytes = Buffer.from(await merged.save());
    }

    const filename = `${po.poId}.pdf`;
    const blob = await put(filename, finalBytes, {
        access: "public",
        contentType: "application/pdf",
        addRandomSuffix: true,
    });

    await updatePO(po.id, { poPdfFile: [{ url: blob.url, filename }] });

    return { url: blob.url };
}
