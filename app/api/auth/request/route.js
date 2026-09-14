import { NextResponse } from "next/server";
import { requestMagicLink } from "@/lib/auth";
import { withOpsLabel } from "@/lib/airtableOps";

export async function POST(request) {
    return withOpsLabel("POST /api/auth/request", async () => {
        const { email, destination } = await request.json();

        if (!email || typeof email !== "string") {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }

        const baseUrl = new URL(request.url).origin;

        // The destination is passed on unjudged and judged where the link is
        // built (#373): `confirmPath` calls the predicate itself, so no caller
        // of it — this one included — can put an unjudged value into a URL.
        try {
            await requestMagicLink(email, { baseUrl, destination });
        } catch (err) {
            return NextResponse.json({ error: err.message }, { status: 400 });
        }

        return NextResponse.json({ ok: true });
    });
}
