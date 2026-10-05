"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Field, TextInput } from "@/app/components/Controls";
import { canTryAgain, CODE_COPY, CODE_STATES, isCodeShaped, RESENT_FOR_MS, SIGN_IN_COPY } from "@/lib/authTokenState";
import { COMPANY_EMAIL_COPY, companyAddress, emailFieldValue, namesAnotherDomain } from "@/lib/companyEmail";
import CodeField from "./CodeField";
import BottomBar from "@/app/components/BottomBar";
import { AddressChip, PageRefusal, SignInHeader } from "./SignInParts";

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
// is also why it is a request field and not a sentence. Nothing on this screen
// says where the reader was going; `docs/briefs/login.md` records that silence
// as deliberate.
//
// THE SECOND STEP TAKES THE CODE THE EMAIL CARRIES (#471), and opens with the page
// when the browser is still waiting on an email (`pendingEmail`, read from the
// binding by the page), so a reload lands back on it.
//
// THE FIRST STEP TAKES ONLY THE PART BEFORE THE COMPANY'S DOMAIN (#473), which it shows
// fixed beside the field: `domain` is `ALLOWED_EMAIL_DOMAIN`, handed down by the page, and
// what the field keeps, what it refuses and the sentence it refuses with are
// `lib/companyEmail.js`'s — the same judgment the request is held to on the server. A
// refused field sends nothing.
//
// A REQUEST THAT DID NOT HAPPEN SAYS ONE SENTENCE, WHEREVER IT WAS ASKED (#473): the
// email step's, a code the server could not check, and a new email that did not go —
// `SIGN_IN_COPY.failed`, in the place a refusal of the whole step stands.
//
// EVERY WORD COMES FROM `lib/authTokenState.js` and `lib/companyEmail.js`, not from this
// file, which is `NameForm.js`'s arrangement: a string written into JSX cannot be pinned.
export default function LoginForm({ destination = "", pendingEmail = "", domain }) {
    const [step, setStep] = useState(pendingEmail ? "code" : "email");
    const [email, setEmail] = useState(pendingEmail);

    // One request for the first email and every new one, so the three places that ask
    // for an email cannot ask for it three ways. It answers whether the email went.
    async function requestEmail(address) {
        try {
            const res = await fetch("/api/auth/request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: address, destination }),
            });
            return res.ok;
        } catch {
            return false;
        }
    }

    // The binding is forgotten on the server as well, or a reload would bring the code
    // step back for the address being corrected. The address returns to the field, its
    // domain taken off as the field always takes it, since correcting it is usually one
    // character.
    async function changeEmail() {
        await fetch("/api/auth/request", { method: "DELETE" }).catch(() => {});
        setStep("email");
    }

    if (step === "code") {
        return <CodeStep email={email} destination={destination} requestEmail={requestEmail} onChangeEmail={changeEmail} />;
    }
    return (
        <EmailStep
            domain={domain}
            initial={emailFieldValue(email, domain)}
            requestEmail={requestEmail}
            onSent={(address) => {
                setEmail(address);
                setStep("code");
            }}
        />
    );
}

/**
 * The first step: the part of the address before the company's domain (#473, 1a and 1d).
 *
 * WHAT A PASTE OR THE BROWSER'S FILLING BRINGS IS TAKEN APART AS IT ARRIVES. An address at
 * the company's domain loses its domain in the field; one at any other domain stays whole,
 * the fixed domain steps aside, and `Continue` refuses it under the field without asking
 * for anything. The field is `text` rather than `email`, which a browser would refuse for
 * having no `@`, and offers what the browser holds for an email address, since a full
 * address is taken apart anyway.
 *
 * AN EMPTY FIELD ASKS FOR NOTHING AND SAYS NOTHING: `Continue` puts the caret in it.
 */
function EmailStep({ domain, initial, requestEmail, onSent }) {
    const copy = SIGN_IN_COPY.request;
    const [value, setValue] = useState(initial);
    const [refusal, setRefusal] = useState(null); // "domain" | "failed" | null
    const [busy, setBusy] = useState(false);
    const fieldRef = useRef(null);

    async function handleSubmit(event) {
        event.preventDefault();
        if (busy) return; // a second press while the first is on its way
        if (!value.trim()) {
            fieldRef.current?.focus();
            return;
        }
        const address = companyAddress(value, domain);
        if (!address) {
            setRefusal("domain");
            fieldRef.current?.focus();
            return;
        }
        setBusy(true);
        setRefusal(null);
        const sent = await requestEmail(address);
        setBusy(false);
        if (sent) {
            onSent(address);
            return;
        }
        setRefusal("failed");
        fieldRef.current?.focus();
    }

    const otherDomain = namesAnotherDomain(value);
    return (
        <form onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col">
            <SignInHeader heading={copy.heading} sentence={copy.sentence} />
            <div className="mt-sign-in-header-stack">
                <Field label={copy.field} labelHidden size="xl" refusal={refusal === "domain" ? COMPANY_EMAIL_COPY.otherDomain(domain) : null}>
                    <TextInput
                        size="xl"
                        inputRef={fieldRef}
                        name="email"
                        value={value}
                        onChange={(typed) => {
                            setValue(emailFieldValue(typed, domain));
                            if (refusal === "domain") setRefusal(null);
                        }}
                        suffix={otherDomain ? null : `@${domain}`}
                        placeholder={copy.placeholder}
                        readOnly={busy}
                        inputMode="email"
                        autoComplete="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        enterKeyHint="go"
                        autoFocus
                    />
                </Field>
            </div>
            {refusal === "failed" && <PageRefusal>{SIGN_IN_COPY.failed}</PageRefusal>}
            <BottomBar stack={refusal === "failed" ? "refusal" : "form"}>
                <Button type="submit" size="xl" busy={busy} busyLabel={copy.working}>
                    {copy.action}
                </Button>
            </BottomBar>
        </form>
    );
}

/**
 * The code step (#471, drawn by #473 from 1a and 1e): the code the email carries, and the
 * two ways out — a new email to the same address, and a different address.
 *
 * A REFUSAL ABOUT THE ROW ENDS THE CODE. After a malformed or a wrong code the boxes stay,
 * with one sentence under them; after any other refusal no code can work, so the boxes go,
 * the heading names why and the step's one action sends a new email (0o, Ended).
 *
 * A CODE THAT WORKS SAYS SO BY ARRIVING (#321): the screen goes where the route says, and
 * `requireUser()` there sends a first-time signer to the name step exactly as it does
 * after the link.
 */
function CodeStep({ email, destination, requestEmail, onChangeEmail }) {
    const copy = SIGN_IN_COPY.code;
    const [code, setCode] = useState("");
    const [shown, setShown] = useState(null); // the figures a refused code keeps on screen
    const [refusal, setRefusal] = useState(null); // { state, remaining } | null
    const [failed, setFailed] = useState(false);
    const [checking, setChecking] = useState(false);
    const [sending, setSending] = useState(false);
    const [resent, setResent] = useState(false);
    const codeField = useRef(null);
    const heading = useRef(null);

    const busy = checking || sending;
    const ended = refusal !== null && !canTryAgain(refusal.state);
    const refusalCopy = refusal ? CODE_COPY[refusal.state] : null;
    const refusalWords = typeof refusalCopy === "function" ? refusalCopy(refusal.remaining) : refusalCopy;

    // A code the step can go on taking gets the caret back after a refusal or a failure, as
    // #471 had it — the field is read-only while a code is checked, so it never lost focus
    // on a phone, and this is what puts it back after a press elsewhere. A code that ends
    // hands focus to the heading instead, once, so the new heading is named.
    useEffect(() => {
        if (!busy && !ended && (refusal || failed)) codeField.current?.focus();
    }, [busy, ended, refusal, failed]);
    useEffect(() => {
        if (ended) heading.current?.focus();
    }, [ended]);

    // `Email sent` stands for its 3 s and then gives way to the control again. The new
    // email's code goes in the same field, and the control that asked for it has just given
    // way, so the caret goes where the code will be typed.
    useEffect(() => {
        if (!resent) return;
        codeField.current?.focus();
        const timer = window.setTimeout(() => setResent(false), RESENT_FOR_MS);
        return () => window.clearTimeout(timer);
    }, [resent]);

    async function check(typed) {
        if (busy) return;
        setFailed(false);
        // Checked here as well as on the server so a short code costs no request; the
        // server's check is the one that counts.
        if (!isCodeShaped(typed)) {
            setShown(null);
            setRefusal({ state: CODE_STATES.MALFORMED });
            return;
        }
        setChecking(true);
        setRefusal(null);
        try {
            const res = await fetch("/api/auth/code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: typed, destination }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.state === CODE_STATES.VALID) {
                window.location.assign(data.destination);
                return; // the step stays busy while the browser leaves
            }
            if (data.state) {
                setShown(data.state === CODE_STATES.WRONG ? typed : null);
                setCode("");
                setRefusal({ state: data.state, remaining: data.remaining });
            } else {
                // An answer with no state is a code the server did not check, which the
                // step says as it says a request that never arrived.
                setFailed(true);
            }
        } catch {
            setFailed(true);
        }
        setChecking(false);
    }

    async function sendNewEmail({ fromEnded }) {
        if (busy) return;
        setSending(true);
        setFailed(false);
        const sent = await requestEmail(email);
        setSending(false);
        if (!sent) {
            setFailed(true);
            return;
        }
        setCode("");
        setShown(null);
        setRefusal(null);
        // From an ended code the field comes back, and takes focus as it appears.
        if (!fromEnded) setResent(true);
    }

    const chip = <AddressChip email={email} onChange={onChangeEmail} disabled={busy} />;
    if (ended) {
        return (
            <div className="flex flex-1 flex-col">
                <SignInHeader heading={refusalWords} sentence={copy.endedSentence} chip={chip} headingRef={heading} />
                {failed && <PageRefusal>{SIGN_IN_COPY.failed}</PageRefusal>}
                <BottomBar stack={failed ? "refusal" : "header"}>
                    <Button size="xl" busy={sending} busyLabel={SIGN_IN_COPY.sending} onClick={() => sendNewEmail({ fromEnded: true })}>
                        {copy.endedAction}
                    </Button>
                </BottomBar>
            </div>
        );
    }

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                check(code);
            }}
            noValidate
            className="flex flex-1 flex-col"
        >
            <SignInHeader heading={copy.heading} sentence={copy.sentence} chip={chip} headingRef={heading} />
            <div className="mt-sign-in-header-stack max-sm:mt-mobile-code-stack">
                <Field label={copy.field} labelHidden size="xl" refusal={canTryAgain(refusal?.state) ? refusalWords : null}>
                    <CodeField
                        inputRef={codeField}
                        value={code}
                        shown={shown}
                        refused={Boolean(refusal)}
                        busy={busy}
                        onChange={(typed) => {
                            setCode(typed);
                            setShown(null);
                            setRefusal(null);
                            setFailed(false);
                        }}
                        onComplete={check}
                    />
                </Field>
            </div>
            {failed && <PageRefusal>{SIGN_IN_COPY.failed}</PageRefusal>}
            <BottomBar stack={failed ? "refusal" : "form"}>
                <Button type="submit" size="xl" busy={checking} busyLabel={copy.working}>
                    {copy.action}
                </Button>
            </BottomBar>
            <p
                aria-live="polite"
                className="mt-sign-in-form-stack text-center text-body-sm text-foreground-subtle max-sm:mt-mobile-code-help-stack max-sm:px-mobile-input-message-inset-x max-sm:text-left max-sm:text-mobile-body-sm"
            >
                {copy.resendLead}{" "}
                {resent ? (
                    <span className="font-semibold">{copy.resent}</span>
                ) : (
                    // Its room either side is pulled back out of the line, so the line is no
                    // taller and no wider for it — on the left by only half, which leaves its
                    // words that much further from the sentence they end (1e, 1a).
                    <button
                        type="button"
                        aria-disabled={busy || undefined}
                        onClick={() => sendNewEmail({ fromEnded: false })}
                        className="-my-[calc((var(--height-control-inline)-var(--text-body-sm--line-height))/2)] -mr-control-inline-inset-x -ml-code-resend-offset inline-flex h-control-inline items-center rounded-control px-control-inline-inset-x align-baseline font-semibold text-primary hover:bg-selected aria-disabled:pointer-events-none max-sm:h-auto max-sm:-my-[calc((var(--spacing-mobile-touch-target)-var(--text-mobile-body-sm--line-height))/2)] max-sm:py-[calc((var(--spacing-mobile-touch-target)-var(--text-mobile-body-sm--line-height))/2)] max-sm:active:opacity-mobile-pressed"
                    >
                        {copy.resend}
                    </button>
                )}
            </p>
        </form>
    );
}
