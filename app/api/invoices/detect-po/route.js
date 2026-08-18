import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { withAdminApi } from "@/lib/authz";
import { getPOById } from "@/lib/airtable/purchaseOrders";
import { isOurBlobUrl } from "@/lib/blobIngest";
import { isPOWithdrawn } from "@/lib/poWithdraw";
import { isPOUnsigned } from "@/lib/poUnsigned";
import { hasUninvoicedItems } from "@/lib/poItemQty";
import { withOpsLabel } from "@/lib/airtableOps";

// Issue #46. The company's real, historically-issued PO numbers use the
// same HYE-PO-YYYYMMDD-## shape this system now generates (4-digit year —
// see CLAUDE.md's ID-generation section for why that had to change first),
// so one regex covers both old and new POs a vendor might reference back
// to us in their invoice text.
const PO_ID_PATTERN = /HYE-PO-\d{8}-\d{2}/g;

// Route Handler, not a Server Action — Admin-only (#134), and since #147 via
// the withAdminApi wrapper rather than a returned refusal this file has to
// remember to pass along. Still not the redirect-based requireAdmin()
// (redirect() isn't meant for a plain Request/Response function).
export const POST = withAdminApi(async (request) => {
    return withOpsLabel("POST /api/invoices/detect-po", async () => {
        const { blobUrl } = await request.json();
        if (!blobUrl) {
            return NextResponse.json({ error: "Missing blobUrl" }, { status: 400 });
        }

        // Issue #134 — SSRF guard. This route fetches blobUrl server-side, so
        // restrict it to our Vercel Blob store: an authorized Admin still must
        // not be able to make the server fetch an arbitrary address (internal
        // metadata endpoints, etc.). Legitimate blobUrls are always the public
        // Blob host returned by the client upload() call.
        //
        // Issue #147 — the predicate itself is isOurBlobUrl (lib/blobIngest.js),
        // which was already documented as "the same host predicate the detect-po
        // SSRF guard uses" while in fact being a second copy of it. One
        // definition now, so the guard and the Blob-cleanup path cannot drift;
        // both rejection branches answered with this same 400 before, so the
        // response is unchanged.
        if (!isOurBlobUrl(blobUrl)) {
            return NextResponse.json({ error: "Invalid file URL" }, { status: 400 });
        }

        // Best-effort from here on — this feature only ever saves the user a
        // few clicks; the manual PO picker from #14 is always still there. A
        // parse failure (corrupt file, unexpected structure, whatever) should
        // fall back to "nothing detected," not surface as an error the client
        // has to specially handle.
        try {
            const fileRes = await fetch(blobUrl);
            if (!fileRes.ok) {
                return NextResponse.json({
                    confirmed: [],
                    unconfirmed: [],
                    withdrawn: [],
                    vendorConflict: false,
                });
            }
            const bytes = Buffer.from(await fileRes.arrayBuffer());

            const parser = new PDFParse({ data: bytes });
            const { pages } = await parser.getText();
            const fullText = pages.map((p) => p.text).join("\n");

            const matches = [...new Set(fullText.match(PO_ID_PATTERN) || [])];
            const lookups = await Promise.all(matches.map((poId) => getPOById(poId)));

            const confirmed = [];
            const unconfirmed = [];
            // Issue #138 — its own bucket, neither confirmed nor unconfirmed. A
            // withdrawn PO must not become a selectable candidate (nothing may be
            // invoiced against it), but it must not fall silent either, and it is
            // emphatically not a failed detection: this PO number was printed on
            // a vendor invoice that arrived, which means either the vendor shipped
            // against a canceled order or the withdrawal was a mistake. Both need
            // a human, and this is the only place in the system where that
            // contradiction becomes visible. Reporting it as "no such PO" would
            // bury the one signal that the linked-invoice invariant just broke in
            // real life.
            const withdrawn = [];
            matches.forEach((poId, i) => {
                const po = lookups[i];
                if (po && isPOWithdrawn(po)) {
                    withdrawn.push({ recordId: po.id, poId: po.poId });
                } else if (po) {
                    // Issue #198 — `unsigned` rides ON the candidate, beside `isOpen`,
                    // rather than in a bucket like `withdrawn` above: a withdrawn PO must
                    // not become selectable and an unsigned one must stay selectable,
                    // which is the whole distinction.
                    //
                    // Issue #92 — `isOpen` is whether every ordered item's cumulative
                    // invoiced Qty already meets its ordered Qty, independent of
                    // PO.Status; computed here so the client gets it in the same
                    // response, no extra round-trip. Sent whatever it says, because a
                    // fully-invoiced order is a warning on this screen and not a refusal.
                    //
                    // BOTH JUDGMENTS ARE PURE AND BOTH READ THE RECORD ALREADY IN HAND,
                    // which is why they are one pass. Until #244 `isOpen` came from a
                    // second pass over a per-PO read — isPoOpen re-fetched the order and
                    // walked its ordered items — and this comment said openness needed
                    // one. The base carries it now (Purchase Orders."Uninvoiced Items"),
                    // so getPOById above brought it back with everything else and this
                    // route pays nothing for it. Reading the same field the picker's
                    // query filters on is also what keeps the two from disagreeing about
                    // an order the banner names.
                    confirmed.push({
                        recordId: po.id,
                        poId: po.poId,
                        vendorId: po.vendor?.[0] || null,
                        unsigned: isPOUnsigned(po),
                        isOpen: hasUninvoicedItems(po),
                    });
                } else {
                    unconfirmed.push(poId);
                }
            });

            // An invoice's Vendor is a single header field, so confirmed POs
            // from more than one distinct Vendor means the detection is
            // uncertain, not a real multi-PO invoice — surfaced to the client
            // as a conflict rather than guessing which Vendor to auto-select.
            const vendorIds = new Set(confirmed.map((c) => c.vendorId).filter(Boolean));
            const vendorConflict = vendorIds.size > 1;

            return NextResponse.json({ confirmed, unconfirmed, withdrawn, vendorConflict });
        } catch (error) {
            console.error("PO detection failed (non-fatal, falling back to manual entry)", error);
            return NextResponse.json({
                confirmed: [],
                unconfirmed: [],
                withdrawn: [],
                vendorConflict: false,
            });
        }
    });
});
