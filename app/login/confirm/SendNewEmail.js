"use client";

import { useState } from "react";
import { Button } from "@/app/components/Controls";
import { SIGN_IN_COPY } from "@/lib/authTokenState";
import { signInPath } from "@/lib/loginDestination";
import { ASKED, askForEmail } from "../askForEmail";
import BottomBar from "@/app/components/BottomBar";
import { PageRefusal } from "../SignInParts";

/**
 * `Send new email`, on a link that can no longer be used (#473, 1b and 1f).
 *
 * IT ASKS FOR THE EMAIL THE SIGN-IN SCREEN ASKS FOR, to the address the link was sent to:
 * the same request, through the same `askForEmail`, so this browser is the one the new
 * email's code works in, and then the sign-in screen, which opens on the code step for that
 * reason and carries the destination on — with `Resend email`'s wait already counting from
 * this press, since the binding holds when it was asked for (#148). The address is the link's
 * row's, which the page shows already, so the button asks for nothing a stranger holding the
 * link could not ask for at the sign-in screen.
 *
 * A REFUSAL STAYS ON THIS PAGE. A request that did not happen says `failed` and one a ceiling
 * held back says `limited` (#148), each in the line over the button, which stays live.
 *
 * A SCRIPT, WHERE THE BUTTON A GOOD LINK OFFERS HAS NONE. That one spends the token and is
 * a plain form so it works where scripts are blocked (#203); this one spends nothing, and
 * shows it is busy while the email goes, which only a script can.
 */
export default function SendNewEmail({ email, destination, label }) {
    const [busy, setBusy] = useState(false);
    const [refusal, setRefusal] = useState(null); // ASKED.FAILED | ASKED.LIMITED | null

    async function send() {
        if (busy) return;
        setBusy(true);
        setRefusal(null);
        const asked = await askForEmail({ email, destination });
        if (asked === ASKED.SENT) {
            window.location.assign(signInPath(destination));
            return; // busy while the browser leaves
        }
        setBusy(false);
        setRefusal(asked);
    }

    return (
        <>
            {refusal && <PageRefusal>{refusal === ASKED.LIMITED ? SIGN_IN_COPY.limited : SIGN_IN_COPY.failed}</PageRefusal>}
            <BottomBar stack={refusal ? "refusal" : "header"}>
                <Button size="xl" busy={busy} busyLabel={SIGN_IN_COPY.sending} onClick={send}>
                    {label}
                </Button>
            </BottomBar>
        </>
    );
}
