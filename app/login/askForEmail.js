/**
 * Asking for a sign-in email, from any of the four controls that do (#148): `Continue`,
 * `Resend email`, and `Send new email` on an ended code and on an ended link.
 *
 * ONE REQUEST AND ONE READING OF ITS ANSWER, so the four cannot ask three ways or read
 * a refusal two ways. `LoginForm.js` had this for its three and the confirmation kept a
 * copy of its own; a ceiling's answer is what made two copies two readings to keep in step.
 *
 * THE ANSWER IS ONE OF THREE. The email went; a ceiling held it back, which the route
 * says with `429` (`lib/signInLimit.js`); or the request did not happen, which covers an
 * answer the screen cannot read as either. The route also says when the ceiling lifts,
 * and no screen shows it: the design words a held-back email with no time.
 *
 * Plain fetch, no import: the two client components that ask take it from here.
 */

export const ASKED = { SENT: "sent", LIMITED: "limited", FAILED: "failed" };

export async function askForEmail({ email, destination }) {
    try {
        const res = await fetch("/api/auth/request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, destination }),
        });
        if (res.ok) return ASKED.SENT;
        if (res.status === 429) return ASKED.LIMITED;
        return ASKED.FAILED;
    } catch {
        return ASKED.FAILED;
    }
}
