import { handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getActiveUser } from "@/lib/authz";
import { withOpsLabel } from "@/lib/airtableOps";
import { MAX_UPLOAD_BYTES, refuseMultipartUpload } from "@/lib/uploadLimit";

// Client-upload token endpoint for Quotation files (issue #34). The actual
// file bytes go straight from the browser to Vercel Blob — this route only
// authorizes the upload and (optionally) reacts once it's done. Route
// Handlers can't use requireUser() (see lib/authz.js) since next/navigation's
// redirect() isn't meant for a plain Request/Response function — this
// throws instead, which handleUpload surfaces as a rejected upload() call
// on the client.
export async function POST(request) {
    return withOpsLabel("POST /api/quotations/upload", async () => {
        const body = await request.json();

        try {
            const jsonResponse = await handleUpload({
                body,
                request,
                onBeforeGenerateToken: async (pathname, clientPayload, multipart) => {
                    const user = await getActiveUser();
                    if (!user) {
                        throw new Error("Not authenticated");
                    }
                    // Issue #146 — see lib/uploadLimit.js: the signed ceiling below
                    // does not bind a multipart upload, measured, so a caller who
                    // asks for one is refused instead. No form asks.
                    refuseMultipartUpload(multipart);

                    return {
                        allowedContentTypes: ["application/pdf", "image/jpeg", "image/png"],
                        addRandomSuffix: true,
                        access: "public",
                        // Issue #146 — the server half of the limit, and the only
                        // half that holds when this route is called directly.
                        // The ceiling is HMAC-signed into the token Blob hands
                        // back, so a caller who skips the form still gets our
                        // number and Blob refuses the oversized PUT before any
                        // object exists. Nothing is stored, so nothing is left to
                        // clean up: this path never meets confirmIngestThenDelete.
                        maximumSizeInBytes: MAX_UPLOAD_BYTES,
                    };
                },
                // Not relied on — see CLAUDE.md's File uploads section for why.
                onUploadCompleted: async ({ blob }) => {
                    console.log("Quotation blob upload completed:", blob.url);
                },
            });

            return NextResponse.json(jsonResponse);
        } catch (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
    });
}
