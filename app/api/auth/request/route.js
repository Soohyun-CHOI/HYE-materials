import { NextResponse } from "next/server";
import { requestMagicLink } from "@/lib/auth";
import { withOpsLabel } from "@/lib/airtableOps";

export async function POST(request) {
    return withOpsLabel("POST /api/auth/request", async () => {
        const { email } = await request.json();

        if (!email || typeof email !== "string") {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }

        const baseUrl = new URL(request.url).origin;

        try {
            await requestMagicLink(email, { baseUrl });
        } catch (err) {
            return NextResponse.json({ error: err.message }, { status: 400 });
        }

        return NextResponse.json({ ok: true });
    });
}
