import { handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getActiveUser } from "@/lib/authz";

// Client-upload token endpoint for Invoice files (issue #14) — same
// pattern as app/api/quotations/upload/route.js (issue #34): the actual
// file bytes go straight from the browser to Vercel Blob, this route only
// authorizes the upload. Route Handlers can't use requireUser() (see
// lib/authz.js) since next/navigation's redirect() isn't meant for a plain
// Request/Response function — this throws instead, which handleUpload
// surfaces as a rejected upload() call on the client.
//
// Unlike Quotations, the Invoice file is required, not optional (every
// received vendor invoice must be kept on file) — enforced client/server
// side in app/invoices/new, not here; this route only authorizes.
export async function POST(request) {
    const body = await request.json();

    try {
        const jsonResponse = await handleUpload({
            body,
            request,
            onBeforeGenerateToken: async () => {
                const user = await getActiveUser();
                if (!user) {
                    throw new Error("Not authenticated");
                }

                return {
                    allowedContentTypes: ["application/pdf", "image/jpeg", "image/png"],
                    addRandomSuffix: true,
                    access: "public",
                    // Generous for a scanned/emailed invoice document —
                    // just a sanity bound, not a real expected size.
                    maximumSizeInBytes: 20 * 1024 * 1024,
                };
            },
            // Not relied on — see CLAUDE.md's Quotation upload section for
            // why (same reasoning applies here: the client already has the
            // Blob URL from upload()'s return value, and Vercel can't call
            // this back to localhost anyway).
            onUploadCompleted: async ({ blob }) => {
                console.log("Invoice blob upload completed:", blob.url);
            },
        });

        return NextResponse.json(jsonResponse);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
