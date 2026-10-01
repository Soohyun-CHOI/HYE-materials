"use client";

import { useEffect, useRef, useState } from "react";
import { SIGN_IN_TITLE } from "@/lib/productName";
import { canTryAgain, CODE_COPY, CODE_LENGTH, CODE_STATES, isCodeShaped, SIGN_IN_COPY } from "@/lib/authTokenState";

// The `?error=` messages that used to live here are gone (#203). Their only two
// producers were the redirects in app/api/auth/verify/route.js, and both went
// when that route stopped answering GET — a refused sign-in now returns to
// /login/confirm, which re-reads the row and names the actual reason. With no
// producer left, the messages could not be reached, and neither could the
// `useSearchParams` call that read them or the Suspense boundary that call
// required.
//
// THE DESTINATION IS A PROP RATHER THAN A `useSearchParams()` CALL (#373), and
// that is the same decision one step on: reading it here would bring back the
// hook and the Suspense boundary above, for a value the page has already read
// and already judged. So the page stays the only reader of the URL and this
// component carries the value forward without knowing anything about it — which
// is also why it is a hidden field and not a sentence. Nothing on this screen
// says where the reader was going; `docs/briefs/login.md` records that silence
// as deliberate.
//
// THE SECOND STEP TAKES THE CODE THE EMAIL CARRIES (#471). It replaced a
// sentence telling the reader to go and open the link, which signs in whichever
// device opens it — the wrong one for a person who asked on a phone and read the
// email on a computer. The step opens with the page when the browser is still
// waiting on an email (`pendingEmail`, read from the binding by the page), so a
// reload lands back on it, and its two ways out — a new email to the same address,
// or a different address — are what a reader had to reload and retype for before.
//
// EVERY WORD COMES FROM `lib/authTokenState.js`, not from this file, which is
// `NameForm.js`'s arrangement: a string written into JSX is invisible to
// `scripts/screen-strings.mjs` and to every vocabulary sweep this repository runs.
export default function LoginForm({ destination = "", pendingEmail = "" }) {
    const [step, setStep] = useState(pendingEmail ? "code" : "email");
    const [email, setEmail] = useState(pendingEmail);
    const [status, setStatus] = useState("idle"); // idle | submitting | error
    const [errorMessage, setErrorMessage] = useState("");

    // One request for both the first email and a new one, so the address step and
    // the code step's `Send a new email` cannot ask for the email two ways.
    async function requestEmail() {
        const res = await fetch("/api/auth/request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, destination }),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || SIGN_IN_COPY.request.failed);
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (status === "submitting") return; // double-click / double-submit guard

        setStatus("submitting");
        setErrorMessage("");

        try {
            await requestEmail();
            setStatus("idle");
            setStep("code");
        } catch (err) {
            setStatus("error");
            setErrorMessage(err.message);
        }
    }

    // The binding is forgotten on the server as well, or a reload would bring the
    // code step back for the address being corrected. The address stays in the
    // field either way, since correcting it is usually one character.
    async function changeEmail() {
        await fetch("/api/auth/request", { method: "DELETE" }).catch(() => {});
        setStatus("idle");
        setErrorMessage("");
        setStep("email");
    }

    if (step === "code") {
        return <CodeStep email={email} destination={destination} onResend={requestEmail} onChangeEmail={changeEmail} />;
    }

    return (
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
            <div>
                {/* The same line the magic-link email's subject carries, from
                    the same constant (#201) — this is the screen that email
                    lands on, so reading the sentence it was sent under is what
                    says the link arrived where it claimed, and distinguishes
                    this app from the group's other portals. */}
                <h1 className="text-2xl font-semibold">{SIGN_IN_TITLE}</h1>
                <p className="mt-1 text-zinc-600">{SIGN_IN_COPY.request.evidence}</p>
            </div>

            <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={SIGN_IN_COPY.request.placeholder}
                disabled={status === "submitting"}
                className="w-full rounded border border-zinc-300 px-3 py-2 disabled:opacity-50"
            />

            {status === "error" && (
                <p role="alert" className="text-sm text-red-600">
                    {errorMessage}
                </p>
            )}

            <button
                type="submit"
                disabled={status === "submitting"}
                className="w-full rounded bg-foreground px-3 py-2 text-background disabled:opacity-50"
            >
                {status === "submitting" ? SIGN_IN_COPY.request.sending : SIGN_IN_COPY.request.action}
            </button>
        </form>
    );
}

/**
 * The code step (#471): the field the email's code goes in, and the two ways out.
 *
 * THE FIELD IS SHAPED FOR A PHONE, because this is where a scan that arrived
 * signed out types it. `inputMode="numeric"` raises the number pad and
 * `autoComplete="one-time-code"` lets the phone offer a code it has seen in a
 * message; it is `type="text"` because a number input drops a leading zero.
 * Anything but a digit is dropped as it is typed, and there is no `maxLength`:
 * that would cut a pasted `123 456` down to `123 45` before the digits could be
 * picked out of it.
 *
 * A REFUSAL ABOUT THE ROW TAKES THE FIELD'S PLACE. After a malformed or a wrong
 * code the field stays, with one sentence under it; after any other refusal no
 * code can work, so the sentence stands where the field was and the new email is
 * the way on — the confirmation page's rule that a refused state has nothing to
 * press.
 *
 * A CODE THAT WORKS SAYS SO BY ARRIVING (#321): the screen goes where the route
 * says, and `requireUser()` there sends a first-time signer to the name step
 * exactly as it does after the link.
 */
function CodeStep({ email, destination, onResend, onChangeEmail }) {
    const copy = SIGN_IN_COPY.code;
    const [code, setCode] = useState("");
    const [status, setStatus] = useState("idle"); // idle | checking | resending | leaving
    const [refusal, setRefusal] = useState(null); // { state, remaining } | null
    const [notice, setNotice] = useState("");

    const busy = status !== "idle";
    const finished = refusal !== null && !canTryAgain(refusal.state);
    const refusalCopy = refusal ? CODE_COPY[refusal.state] : null;
    const refusalSentence = typeof refusalCopy === "function" ? refusalCopy(refusal.remaining) : refusalCopy;

    // The field is disabled while a code is checked, and a disabled field loses
    // focus — on a phone that closes the keyboard. So after a refusal that leaves
    // something to try, the field takes focus back for the next code.
    const codeField = useRef(null);
    useEffect(() => {
        if (status === "idle" && refusal && canTryAgain(refusal.state)) codeField.current?.focus();
    }, [status, refusal]);

    async function handleSubmit(e) {
        e.preventDefault();
        if (busy) return;
        setNotice("");
        // Checked here as well as on the server so a short code costs no request;
        // the server's check is the one that counts.
        if (!isCodeShaped(code)) {
            setRefusal({ state: CODE_STATES.MALFORMED });
            return;
        }

        setStatus("checking");
        setRefusal(null);
        try {
            const res = await fetch("/api/auth/code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code, destination }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.state === CODE_STATES.VALID) {
                setStatus("leaving");
                window.location.assign(data.destination);
                return;
            }
            if (!data.state) throw new Error(data.error || SIGN_IN_COPY.request.failed);
            setRefusal({ state: data.state, remaining: data.remaining });
            setCode("");
            setStatus("idle");
        } catch (err) {
            setNotice(err.message);
            setStatus("idle");
        }
    }

    async function handleResend() {
        if (busy) return;
        setStatus("resending");
        setNotice("");
        try {
            await onResend();
            setRefusal(null);
            setCode("");
            setNotice(copy.resent);
        } catch (err) {
            setNotice(err.message);
        } finally {
            setStatus("idle");
        }
    }

    return (
        <div className="w-full max-w-sm space-y-4">
            <div>
                <h1 className="text-2xl font-semibold">{copy.heading}</h1>
                <p className="mt-2 text-zinc-600">{copy.sent(email)}</p>
                <p className="mt-1 text-zinc-600">{copy.how}</p>
            </div>

            {finished ? (
                <p role="alert" className="text-sm text-red-600">
                    {refusalSentence}
                </p>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <label className="block">
                        <span className="text-sm text-zinc-600">{copy.label}</span>
                        <input
                            ref={codeField}
                            type="text"
                            name="code"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            autoFocus
                            required
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
                            disabled={busy}
                            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 tracking-widest disabled:opacity-50"
                        />
                    </label>

                    {refusalSentence && (
                        <p role="alert" className="text-sm text-red-600">
                            {refusalSentence}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={busy}
                        className="w-full rounded bg-foreground px-3 py-2 text-background disabled:opacity-50"
                    >
                        {status === "checking" || status === "leaving" ? copy.checking : copy.action}
                    </button>
                </form>
            )}

            {notice && (
                <p role="status" className="text-sm text-zinc-600">
                    {notice}
                </p>
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                <button type="button" onClick={handleResend} disabled={busy} className="underline disabled:opacity-50">
                    {status === "resending" ? copy.resending : copy.resend}
                </button>
                <button type="button" onClick={onChangeEmail} disabled={busy} className="underline disabled:opacity-50">
                    {copy.changeEmail}
                </button>
            </div>
        </div>
    );
}
