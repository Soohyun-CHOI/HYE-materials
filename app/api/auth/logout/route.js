import { NextResponse } from "next/server";
import { destroySession } from "@/lib/session";
import { withOpsLabel } from "@/lib/airtableOps";

export async function POST(request) {
    return withOpsLabel("POST /api/auth/logout", async () => {
        await destroySession();
        return NextResponse.redirect(new URL("/login", request.url));
    });
}
