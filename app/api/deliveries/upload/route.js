import { handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getActiveUser } from "@/lib/authz";
import { withOpsLabel } from "@/lib/airtableOps";

// Client-upload token endpoint for packing list photos (issue #162) — same
// pattern as app/api/quotations/upload/route.js and
// app/api/invoices/upload/route.js: the file bytes go straight from the browser
// to Vercel Blob, this route only authorizes the upload.
//
// ANY ACTIVE USER, not Admin: recording a delivery is site work, open to anyone
// assigned to the Job. The Job itself cannot be checked here — the upload happens
// before the form is submitted, so this route does not know which Job the photo
// will belong to — and the Job membership check therefore lives in
// createDeliveryAction. The looseness that leaves is the same one
// /api/quotations/upload has, and worth naming: any active user can put an object
// in the store. What they cannot do is attach it to a delivery.
//
// Route Handlers can't use requireUser() (see lib/authz.js) since
// next/navigation's redirect() isn't meant for a plain Request/Response function.
// handleUpload wants a throw rather than a Response to reject, which is why this
// export is not wrapped and is listed as an exemption with that reason in
// scripts/tests/offline/authz-structure.mjs.
export async function POST(request) {
    return withOpsLabel("POST /api/deliveries/upload", async () => {
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
                        // A packing list is photographed on a phone or scanned, so
                        // images matter more here than anywhere else in the app.
                        // HEIC is deliberately absent: Airtable cannot preview it, so
                        // accepting it would trade a clear failure at upload time for
                        // an attachment nobody can read. iOS converts camera captures
                        // to JPEG for a file input, which is the path site staff use.
                        allowedContentTypes: ["application/pdf", "image/jpeg", "image/png"],
                        addRandomSuffix: true,
                        access: "public",
                        // A ceiling from the start, unlike /api/quotations/upload,
                        // which has none (#146). Generous for a phone photo — a
                        // sanity bound, not a real expected size.
                        maximumSizeInBytes: 20 * 1024 * 1024,
                    };
                },
                // Not relied on — see CLAUDE.md's File uploads section for why.
                onUploadCompleted: async ({ blob }) => {
                    console.log("Delivery blob upload completed:", blob.url);
                },
            });

            return NextResponse.json(jsonResponse);
        } catch (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
    });
}
