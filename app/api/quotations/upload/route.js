import { handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getActiveUser } from "@/lib/authz";

// Client-upload token endpoint for Quotation files (issue #34). The actual
// file bytes go straight from the browser to Vercel Blob — this route only
// authorizes the upload and (optionally) reacts once it's done. Route
// Handlers can't use requireUser() (see lib/authz.js) since next/navigation's
// redirect() isn't meant for a plain Request/Response function — this
// throws instead, which handleUpload surfaces as a rejected upload() call
// on the client.
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
                };
            },
            // Not relied on: the client already gets the blob URL directly
            // from the upload() call's return value and carries it through
            // the PR form submission. This project also has no way to
            // receive this callback in local dev without a tunneling
            // service (Vercel can't reach localhost), so nothing here is
            // load-bearing — see CLAUDE.md's Quotation upload section.
            onUploadCompleted: async ({ blob }) => {
                console.log("Quotation blob upload completed:", blob.url);
            },
        });

        return NextResponse.json(jsonResponse);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
