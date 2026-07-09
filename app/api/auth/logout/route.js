import { NextResponse } from "next/server";
import { destroySession } from "@/lib/session";

export async function POST(request) {
    await destroySession();
    return NextResponse.redirect(new URL("/login", request.url));
}
