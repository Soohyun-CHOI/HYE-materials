import { NextResponse } from "next/server";
import { signInWithCode } from "@/lib/auth";
import { CODE_STATES } from "@/lib/authTokenState";
import { CROSS_ORIGIN_REFUSAL, isCrossOrigin } from "@/lib/crossOrigin";
import { DEFAULT_DESTINATION, DESTINATION_PARAM, safeDestination } from "@/lib/loginDestination";
import { withOpsLabel } from "@/lib/airtableOps";

/**
 * Signs in with the code a sign-in email carries, in the browser that asked for
 * the email (#471).
 *
 * THE OTHER WAY TO SPEND THE ROW `POST /api/auth/verify` SPENDS. The link signs in
 * whichever browser opens it, which is the wrong one for somebody who asked on a
 * phone and opened the email on a computer; this route checks a typed code against
 * the row the ASKING browser is bound to (`lib/session.js`), so the email finishes
 * the sign-in where it was asked for. Either one ends the row for both.
 *
 * JSON, FROM THE SIGN-IN SCREEN'S OWN SCRIPT, rather than the plain form the
 * confirmation posts. A refusal has to be said on the screen the reader is looking
 * at, and #203 removed the `?error=` parameters that a redirect would need — a
 * screen reading its sentence off the URL is what #321 retired. The address step of
 * the same screen already needs its script, so this adds no way to fail.
 *
 * IT REFUSES A CROSS-ORIGIN SUBMISSION FIRST, before reading anything: a code, like
 * a token, authenticates a request and not the submitter's intent — login CSRF,
 * `lib/crossOrigin.js`.
 *
 * AND IT JUDGES THE DESTINATION AGAIN before handing it back, which is the call
 * that protects anything: this route is reachable without the screen that sent
 * the value. The screen goes where this says; a first-time signer meets the name
 * step there, because `requireUser()` asks — the same landing a link gets.
 *
 * WHAT A REFUSAL CARRIES IS THE STATE, AND ITS WORDS ARE THE SCREEN'S. The states
 * are `lib/authTokenState.js`'s closed set and so is the copy that reads them, so
 * the screen and this route cannot word one refusal two ways. Every one of them is
 * about the row this browser asked for, which is why none of them says anything
 * about who else has an account.
 */
export async function POST(request) {
    return withOpsLabel("POST /api/auth/code", async () => {
        if (isCrossOrigin(request)) {
            return NextResponse.json({ error: CROSS_ORIGIN_REFUSAL }, { status: 403 });
        }

        const body = await request.json().catch(() => null);
        const destination = safeDestination(body?.[DESTINATION_PARAM]);
        const result = await signInWithCode(body?.code);

        if (result.state !== CODE_STATES.VALID) {
            return NextResponse.json({ state: result.state, remaining: result.remaining }, { status: 400 });
        }
        return NextResponse.json({ state: result.state, destination: destination ?? DEFAULT_DESTINATION });
    });
}
