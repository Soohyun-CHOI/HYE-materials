import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { requireAdminApi } from "@/lib/authz";
import { getPOById, isPoOpen } from "@/lib/airtable/purchaseOrders";

// Issue #46. The company's real, historically-issued PO numbers use the
// same HYE-PO-YYYYMMDD-## shape this system now generates (4-digit year —
// see CLAUDE.md's ID-generation section for why that had to change first),
// so one regex covers both old and new POs a vendor might reference back
// to us in their invoice text.
const PO_ID_PATTERN = /HYE-PO-\d{8}-\d{2}/g;

// Route Handler, not a Server Action — Admin-only (#134) via
// requireAdminApi(), not the redirect-based requireAdmin() (redirect()
// isn't meant for a plain Request/Response function).
export async function POST(request) {
    const gate = await requireAdminApi();
    if (gate instanceof Response) return gate;

    const { blobUrl } = await request.json();
    if (!blobUrl) {
        return NextResponse.json({ error: "Missing blobUrl" }, { status: 400 });
    }

    // Issue #134 — SSRF guard. This route fetches blobUrl server-side, so
    // restrict it to our Vercel Blob store: an authorized Admin still must
    // not be able to make the server fetch an arbitrary address (internal
    // metadata endpoints, etc.). Legitimate blobUrls are always the public
    // Blob host returned by the client upload() call.
    let parsedBlobUrl;
    try {
        parsedBlobUrl = new URL(blobUrl);
    } catch {
        return NextResponse.json({ error: "Invalid file URL" }, { status: 400 });
    }
    if (
        parsedBlobUrl.protocol !== "https:" ||
        !parsedBlobUrl.hostname.endsWith(".public.blob.vercel-storage.com")
    ) {
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
            return NextResponse.json({ confirmed: [], unconfirmed: [], vendorConflict: false });
        }
        const bytes = Buffer.from(await fileRes.arrayBuffer());

        const parser = new PDFParse({ data: bytes });
        const { pages } = await parser.getText();
        const fullText = pages.map((p) => p.text).join("\n");

        const matches = [...new Set(fullText.match(PO_ID_PATTERN) || [])];
        const lookups = await Promise.all(matches.map((poId) => getPOById(poId)));

        const confirmed = [];
        const unconfirmed = [];
        matches.forEach((poId, i) => {
            const po = lookups[i];
            if (po) {
                confirmed.push({ recordId: po.id, poId: po.poId, vendorId: po.vendor?.[0] || null });
            } else {
                unconfirmed.push(poId);
            }
        });

        // Issue #92 — whether each matched PO is already fully invoiced
        // (every PO Item's cumulative invoiced Qty already meets its
        // ordered Qty), independent of PO.Status. Reuses #15's isPoOpen()
        // rather than reimplementing it; computed here so the client gets
        // it in the same response, no extra round-trip.
        const openFlags = await Promise.all(confirmed.map((c) => isPoOpen(c.recordId)));
        confirmed.forEach((c, i) => {
            c.isOpen = openFlags[i];
        });

        // An invoice's Vendor is a single header field, so confirmed POs
        // from more than one distinct Vendor means the detection is
        // uncertain, not a real multi-PO invoice — surfaced to the client
        // as a conflict rather than guessing which Vendor to auto-select.
        const vendorIds = new Set(confirmed.map((c) => c.vendorId).filter(Boolean));
        const vendorConflict = vendorIds.size > 1;

        return NextResponse.json({ confirmed, unconfirmed, vendorConflict });
    } catch (error) {
        console.error("PO detection failed (non-fatal, falling back to manual entry)", error);
        return NextResponse.json({ confirmed: [], unconfirmed: [], vendorConflict: false });
    }
}
