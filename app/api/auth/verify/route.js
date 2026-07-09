import { NextResponse } from "next/server";
import { verifyMagicLink } from "@/lib/auth";

export async function GET(request) {
    const token = new URL(request.url).searchParams.get("token");

    if (!token) {
        return NextResponse.redirect(new URL("/login?error=missing_token", request.url));
    }

    try {
        await verifyMagicLink(token);
    } catch {
        return NextResponse.redirect(new URL("/login?error=invalid_token", request.url));
    }

    return NextResponse.redirect(new URL("/", request.url));
}
