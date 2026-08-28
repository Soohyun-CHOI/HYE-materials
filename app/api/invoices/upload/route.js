import { handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/authz";
import { withOpsLabel } from "@/lib/airtableOps";
import { MAX_UPLOAD_BYTES, refuseMultipartUpload } from "@/lib/uploadLimit";

// Client-upload token endpoint for Invoice files (issue #14) — same
// pattern as app/api/quotations/upload/route.js (issue #34): the actual
// file bytes go straight from the browser to Vercel Blob, this route only
// authorizes the upload. Admin-only (#134): the token callback calls
// requireAdminApi() (Route Handlers can't use the redirect-based helpers)
// and throws when it returns a refusal Response, which handleUpload
// surfaces as a rejected upload() on the client.
//
// Unlike Quotations, the Invoice file is required, not optional (every
// received vendor invoice must be kept on file) — enforced client/server
// side in app/invoices/new, not here; this route only authorizes.
export async function POST(request) {
    return withOpsLabel("POST /api/invoices/upload", async () => {
        const body = await request.json();

        try {
            const jsonResponse = await handleUpload({
                body,
                request,
                onBeforeGenerateToken: async (pathname, clientPayload, multipart) => {
                    // Issue #134 — Admin-only (Blob write), matching the invoice
                    // form that's this route's only consumer. handleUpload wants a
                    // throw (not a Response) to reject, so surface the gate's
                    // refusal as a throw.
                    const gate = await requireAdminApi();
                    if (gate instanceof Response) {
                        throw new Error("Not authorized");
                    }
                    // Issue #146 — see lib/uploadLimit.js: the signed ceiling below
                    // does not bind a multipart upload, measured, so a caller who
                    // asks for one is refused instead. No form asks.
                    refuseMultipartUpload(multipart);

                    return {
                        allowedContentTypes: ["application/pdf", "image/jpeg", "image/png"],
                        addRandomSuffix: true,
                        access: "public",
                        // Issue #146 — was this route's own literal, and the only
                        // one in the app until #162 copied it. lib/uploadLimit.js
                        // is where the figure lives and where it is explained.
                        maximumSizeInBytes: MAX_UPLOAD_BYTES,
                    };
                },
                // Not relied on — see CLAUDE.md's File uploads section for why.
                onUploadCompleted: async ({ blob }) => {
                    console.log("Invoice blob upload completed:", blob.url);
                },
            });

            return NextResponse.json(jsonResponse);
        } catch (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
    });
}
