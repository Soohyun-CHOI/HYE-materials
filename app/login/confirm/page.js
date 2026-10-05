import { Button, ButtonLink } from "@/app/components/Controls";
import { getAuthTokenRecord } from "@/lib/airtable/authTokens";
import { CONFIRM_COPY, describeToken, TOKEN_STATES } from "@/lib/authTokenState";
import { DESTINATION_PARAM, safeDestination, signInPath } from "@/lib/loginDestination";
import { withOpsLabel } from "@/lib/airtableOps";
import BottomBar from "@/app/components/BottomBar";
import { AddressChip, SignInHeader } from "../SignInParts";
import SendNewEmail from "./SendNewEmail";

export const metadata = { title: "Confirm sign-in" };

// Never cached, never prerendered. The answer depends entirely on one row's
// current state, and a cached "this link is valid" would outlive the click that
// made it false.
export const dynamic = "force-dynamic";

export default async function ConfirmSignInPage(props) {
    return withOpsLabel("/login/confirm", () => renderConfirmSignInPage(props));
}

/**
 * Where the magic link now lands (#203).
 *
 * THIS PAGE READS THE TOKEN AND MUST NEVER CONSUME IT. That is the entire
 * issue: mail security scanners open links in delivered messages before the
 * recipient does, so while `/api/auth/verify` spent the token on `GET`, the
 * scanner spent it and the recipient got the invalid-or-expired error. Observed
 * with a real recipient, well inside the 15-minute window. So the only Airtable
 * call here is `getAuthTokenRecord`, which is a `select` and nothing else, and
 * `offline/source-shape.mjs` asserts that neither `consumeAuthToken` nor
 * `verifyMagicLink` is named in this file — the property is easy to undo by
 * someone reasonably thinking the extra step is redundant.
 *
 * Consuming happens on the form POST below, which a scanner does not issue.
 *
 * THE TARGET ADDRESS IS SHOWN, which withholds nothing: anyone who can read
 * this page already holds the token and can press the button to become that
 * user, so hiding the address only hides it from the person being asked to
 * press. Showing it is what makes a login-CSRF attempt visible to its victim —
 * being asked to sign in as somebody else is the one thing that reads as wrong.
 * It is also useful on its own, since one person can hold two addresses here.
 *
 * IT ALSO CARRIES A DESTINATION THROUGH (#373) AND SHOWS NOTHING OF IT. The
 * address the reader was trying to reach when the app asked them to sign in
 * arrives beside the token, rides the form as a hidden field, and is where
 * `POST /api/auth/verify` lands them. It is judged here so a refused value never
 * reaches the form, and judged again there, which is the call that protects
 * anything — that endpoint is reachable without this page.
 *
 * AND THE WAY ON CARRIES IT TOO. A reader whose link expired or was used presses
 * `Send new email`, and a reader whose link names no row `Go to sign in`; both hold
 * the destination rather than dropping it at the last step of a flow that exists to
 * preserve it.
 *
 * WHAT IT SHOWS IS THE DESIGN'S (#473, 1b and 1f): every state a heading and one way
 * on, the address under the heading wherever the row names one. A used or expired link
 * showing its address withholds nothing either — whoever holds the link holds the
 * email it came in, which names the address — and the way on from those two is a new
 * email to it, from this browser. A link that names no row has no address to show or
 * send to, and goes back to the sign-in screen.
 */
async function renderConfirmSignInPage({ searchParams }) {
    const { token, destination: asked } = await searchParams;
    const destination = safeDestination(asked);
    const record = typeof token === "string" && token ? await getAuthTokenRecord(token) : null;

    const state = describeToken({
        token,
        exists: Boolean(record),
        used: record?.get("Used") === true,
        expiresAt: record?.get("Expires At"),
    });
    const copy = CONFIRM_COPY[state];
    const email = record?.get("Email");
    const chip = record ? <AddressChip email={email} /> : null;

    return (
        <div className="flex flex-1 flex-col">
            <SignInHeader heading={copy.heading} sentence={copy.sentence} chip={chip} />

            {state === TOKEN_STATES.VALID ? (
                // A plain HTML form, deliberately: no action id and no script of any kind
                // behind it, so it still works where scripts are blocked. It is also what
                // makes the behavior reproducible with one request in a check.
                <form method="POST" action="/api/auth/verify" className="flex flex-1 flex-col">
                    <input type="hidden" name="token" value={token} />
                    {destination && <input type="hidden" name={DESTINATION_PARAM} value={destination} />}
                    <BottomBar stack="header">
                        <Button type="submit" size="xl">
                            {copy.action}
                        </Button>
                    </BottomBar>
                </form>
            ) : record ? (
                <SendNewEmail email={email} destination={destination} label={copy.action} />
            ) : (
                <BottomBar stack="header">
                    <ButtonLink size="xl" href={signInPath(destination)}>
                        {copy.action}
                    </ButtonLink>
                </BottomBar>
            )}
        </div>
    );
}
