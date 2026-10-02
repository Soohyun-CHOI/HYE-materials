"use client";

import { useState } from "react";
import { Button } from "@/app/components/Controls";
import { SIGN_IN_COPY } from "@/lib/authTokenState";
import { signInPath } from "@/lib/loginDestination";
import { BottomBar, PageRefusal } from "../SignInParts";

/**
 * `Send new email`, on a link that can no longer be used (#473, 1b and 1f).
 *
 * IT ASKS FOR THE EMAIL THE SIGN-IN SCREEN ASKS FOR, to the address the link was sent to:
 * the same request, so this browser is the one the new email's code works in, and then the
 * sign-in screen, which opens on the code step for that reason and carries the destination
 * on. The address is the link's row's, which the page shows already, so the button asks
 * for nothing a stranger holding the link could not ask for at the sign-in screen.
 *
 * A SCRIPT, WHERE THE BUTTON A GOOD LINK OFFERS HAS NONE. That one spends the token and is
 * a plain form so it works where scripts are blocked (#203); this one spends nothing, and
 * shows it is busy while the email goes, which only a script can.
 */
export default function SendNewEmail({ email, destination, label }) {
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);

    async function send() {
        if (busy) return;
        setBusy(true);
        setFailed(false);
        try {
            const res = await fetch("/api/auth/request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, destination }),
            });
            if (res.ok) {
                window.location.assign(signInPath(destination));
                return; // busy while the browser leaves
            }
        } catch {
            // the email did not go, which is said below
        }
        setBusy(false);
        setFailed(true);
    }

    return (
        <>
            {failed && <PageRefusal>{SIGN_IN_COPY.failed}</PageRefusal>}
            <BottomBar stack={failed ? "refusal" : "header"}>
                <Button size="xl" busy={busy} busyLabel={SIGN_IN_COPY.sending} onClick={send}>
                    {label}
                </Button>
            </BottomBar>
        </>
    );
}
