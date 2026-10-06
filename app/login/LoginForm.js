"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Field, TextInput } from "@/app/components/Controls";
import { canTryAgain, CODE_COPY, CODE_STATES, isCodeShaped, RESENT_FOR_MS, SIGN_IN_COPY } from "@/lib/authTokenState";
import { COMPANY_EMAIL_COPY, companyAddress, emailFieldValue, namesAnotherDomain } from "@/lib/companyEmail";
import { RESEND_COOLDOWN_MS, resendWaitLeft } from "@/lib/signInLimit";
import { ASKED, askForEmail } from "./askForEmail";
import CodeField from "./CodeField";
import BottomBar from "@/app/components/BottomBar";
import { AddressChip, PageRefusal, ResendRefusal, SignInHeader } from "./SignInParts";

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
// `SIGN_IN_COPY.failed`, in the place a refusal of the whole step stands. ONE A CEILING
// HELD BACK SAYS ANOTHER (#148), `SIGN_IN_COPY.limited`, by the control that asked: in that
// same place for `Continue` and an ended code's `Send new email`, and for `Resend email` in
// the line under the code. Either way the step keeps its state, the control stays live and
// starts no wait, and the sentence goes at the next request.
//
// `Resend email` RESTS AFTER EVERY EMAIL THIS PAGE ASKS FOR (#148, 1j), `Continue`'s
// included: one clock from the press, `Email sent` for its first moments after a resend,
// then `Resend in m:ss`, which takes no press and is not announced, then the control again,
// which is. How long is `lib/signInLimit.js`'s, and a page the server draws mid-wait is
// handed what is left of it (`resendWaitMs`), so a reload counts on.
//
// EVERY WORD COMES FROM `lib/authTokenState.js` and `lib/companyEmail.js`, not from this
// file, which is `NameForm.js`'s arrangement: a string written into JSX cannot be pinned.
export default function LoginForm({ destination = "", pendingEmail = "", resendWaitMs = 0, domain }) {
    const [step, setStep] = useState(pendingEmail ? "code" : "email");
    const [email, setEmail] = useState(pendingEmail);
    // The wait the code step opens on: when it was asked for, in this page's clock, and what
    // is left of it. A page the server drew knows only the second until it is live.
    const [openingWait, setOpeningWait] = useState({ askedAt: null, left: resendWaitMs });

    // One request for the first email and every new one, so the places that ask for an
    // email cannot ask for it different ways (`./askForEmail.js`, which the confirmation
    // shares). It answers whether the email went, was held back, or did not happen.
    const requestEmail = (address) => askForEmail({ email: address, destination });

    // The binding is forgotten on the server as well, or a reload would bring the code
    // step back for the address being corrected. The address returns to the field, its
    // domain taken off as the field always takes it, since correcting it is usually one
    // character.
    async function changeEmail() {
        await fetch("/api/auth/request", { method: "DELETE" }).catch(() => {});
        setStep("email");
    }

    if (step === "code") {
        return (
            <CodeStep
                email={email}
                destination={destination}
                requestEmail={requestEmail}
                onChangeEmail={changeEmail}
                openingWait={openingWait}
            />
        );
    }
    return (
        <EmailStep
            domain={domain}
            initial={emailFieldValue(email, domain)}
            requestEmail={requestEmail}
            onSent={(address, askedAt) => {
                setEmail(address);
                setOpeningWait({ askedAt, left: resendWaitLeft(askedAt, Date.now()) });
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
    const [refusal, setRefusal] = useState(null); // "domain" | "failed" | "limited" | null
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
        const askedAt = Date.now();
        setBusy(true);
        setRefusal(null);
        const asked = await requestEmail(address);
        setBusy(false);
        if (asked === ASKED.SENT) {
            onSent(address, askedAt);
            return;
        }
        setRefusal(asked === ASKED.LIMITED ? "limited" : "failed");
        fieldRef.current?.focus();
    }

    const otherDomain = namesAnotherDomain(value);
    const pageRefusal = refusal === "failed" ? SIGN_IN_COPY.failed : refusal === "limited" ? SIGN_IN_COPY.limited : null;
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
            {pageRefusal && <PageRefusal>{pageRefusal}</PageRefusal>}
            <BottomBar stack={pageRefusal ? "refusal" : "form"}>
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
function CodeStep({ email, destination, requestEmail, onChangeEmail, openingWait }) {
    const copy = SIGN_IN_COPY.code;
    const [code, setCode] = useState("");
    const [shown, setShown] = useState(null); // the figures a refused code keeps on screen
    const [refusal, setRefusal] = useState(null); // { state, remaining } | null
    const [failed, setFailed] = useState(false);
    const [limited, setLimited] = useState(false);
    const [checking, setChecking] = useState(false);
    const [sending, setSending] = useState(false);
    const [resent, setResent] = useState(false);
    const [wait, setWait] = useState(openingWait); // { askedAt, left } — `Resend email`'s rest
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
        if (!busy && !ended && (refusal || failed || limited)) codeField.current?.focus();
    }, [busy, ended, refusal, failed, limited]);
    useEffect(() => {
        if (ended) heading.current?.focus();
    }, [ended]);

    // `Email sent` stands for its 3 s and then gives way to the wait's count. The new
    // email's code goes in the same field, and the control that asked for it has just given
    // way, so the caret goes where the code will be typed.
    useEffect(() => {
        if (!resent) return;
        codeField.current?.focus();
        const timer = window.setTimeout(() => setResent(false), RESENT_FOR_MS);
        return () => window.clearTimeout(timer);
    }, [resent]);

    // A page the server drew mid-wait learns, once live, the press its count runs from —
    // until then the server's figure stands, so the page and its hydration draw one text.
    useEffect(() => {
        if (wait.askedAt !== null || wait.left <= 0) return;
        const start = window.setTimeout(() => {
            const now = Date.now();
            setWait((w) => (w.askedAt === null ? { askedAt: now + w.left - RESEND_COOLDOWN_MS, left: w.left } : w));
        }, 0);
        return () => window.clearTimeout(start);
    }, [wait.askedAt, wait.left]);
    // And counts down, four times a second so a figure never lingers, until the wait is over.
    useEffect(() => {
        if (wait.askedAt === null) return;
        const tick = window.setInterval(() => {
            const now = Date.now();
            setWait((w) => {
                const left = resendWaitLeft(w.askedAt, now);
                return left > 0 ? { askedAt: w.askedAt, left } : { askedAt: null, left: 0 };
            });
        }, 250);
        return () => window.clearInterval(tick);
    }, [wait.askedAt]);

    async function check(typed) {
        if (busy) return;
        setFailed(false);
        setLimited(false);
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
        const askedAt = Date.now();
        setSending(true);
        setFailed(false);
        setLimited(false);
        const asked = await requestEmail(email);
        setSending(false);
        if (asked === ASKED.LIMITED) {
            setLimited(true);
            return;
        }
        if (asked !== ASKED.SENT) {
            setFailed(true);
            return;
        }
        setCode("");
        setShown(null);
        setRefusal(null);
        setWait({ askedAt, left: resendWaitLeft(askedAt, Date.now()) });
        // From an ended code the field comes back, and takes focus as it appears.
        if (!fromEnded) setResent(true);
    }

    const chip = <AddressChip email={email} onChange={onChangeEmail} disabled={busy} />;
    if (ended) {
        const pageRefusal = failed ? SIGN_IN_COPY.failed : limited ? SIGN_IN_COPY.limited : null;
        return (
            <div className="flex flex-1 flex-col">
                <SignInHeader heading={refusalWords} sentence={copy.endedSentence} chip={chip} headingRef={heading} />
                {pageRefusal && <PageRefusal>{pageRefusal}</PageRefusal>}
                <BottomBar stack={pageRefusal ? "refusal" : "header"}>
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
            {limited && <ResendRefusal>{SIGN_IN_COPY.limited}</ResendRefusal>}
            <p
                aria-live="polite"
                className={`${limited ? "mt-gap-lg max-sm:hidden" : "mt-sign-in-form-stack"} text-center text-body-sm text-foreground-subtle max-sm:mt-mobile-code-help-stack max-sm:px-mobile-input-message-inset-x max-sm:text-left max-sm:text-mobile-body-sm`}
            >
                {copy.resendLead}{" "}
                {/* 8 OF ROOM AFTER THE SPACE IN EVERY STATE (1e, 1a, #495), which the control's
                    own room pulls into, so its words stand 8 past the space and its face under
                    the pointer reaches back over the 8. */}
                <span aria-hidden="true" className="inline-block w-control-inline-inset-x" />
                {resent ? (
                    <span className="font-semibold">{copy.resent}</span>
                ) : wait.left > 0 ? (
                    // Taking no press, and kept out of the line's announcements: the count
                    // would be read out every second (1j). Where it ends, the control is.
                    <span aria-live="off" className="font-semibold tabular-nums">
                        {copy.resendIn(wait.left)}
                    </span>
                ) : (
                    // Its room either side is pulled back out of the line, so the line is no
                    // taller and no wider for it (1e, 1a). WHILE ITS EMAIL IS ASKED FOR IT IS
                    // 0f's WORKING (#495): its words keep their place unseen, and after 300ms
                    // an Accent spinner on a 25% track stands centered in them, `Sending…` for
                    // assistive tech alone. Nothing is disabled, so focus stays on it.
                    <button
                        type="button"
                        aria-disabled={busy || undefined}
                        aria-busy={sending || undefined}
                        data-busy={sending || undefined}
                        onClick={() => sendNewEmail({ fromEnded: false })}
                        className="group/resend relative -my-[calc((var(--height-control-inline)-var(--text-body-sm--line-height))/2)] -mx-control-inline-inset-x inline-flex h-control-inline items-center rounded-control px-control-inline-inset-x align-baseline font-semibold text-primary not-aria-disabled:hover:bg-selected aria-disabled:pointer-events-none max-sm:h-auto max-sm:-my-[calc((var(--spacing-mobile-touch-target)-var(--text-mobile-body-sm--line-height))/2)] max-sm:py-[calc((var(--spacing-mobile-touch-target)-var(--text-mobile-body-sm--line-height))/2)] max-sm:active:opacity-mobile-pressed"
                    >
                        <span className="transition-[visibility] duration-0 group-data-busy/resend:invisible group-data-busy/resend:delay-busy">{copy.resend}</span>
                        <span className="invisible absolute inset-0 flex items-center justify-center transition-[visibility] duration-0 group-data-busy/resend:visible group-data-busy/resend:delay-busy">
                            <span aria-hidden="true" className="block size-spinner animate-spinner rounded-full border-2 border-code-resend-spinner-track border-t-current" />
                            <span className="sr-only">{SIGN_IN_COPY.sending}</span>
                        </span>
                    </button>
                )}
            </p>
        </form>
    );
}
