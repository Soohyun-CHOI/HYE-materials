"use client";

import { useEffect, useRef, useState } from "react";
import { Refusal } from "@/app/components/Controls";
import { SIGN_IN_COPY } from "@/lib/authTokenState";

/*
 * What every sign-in step is drawn from (#473): the header a step opens with, the address
 * chip, a refusal about the whole step, and the bar its action stands in. One page and two
 * looks — a sign-in page at a desk (0o) and a step page below the phone's edge (Tools 0a) —
 * so each part is drawn once, with the phone's values under `max-sm:`.
 *
 * EVERY WORD IS THE CALLER'S, from `lib/authTokenState.js` and `lib/userName.js`, apart
 * from the chip's `Change`, which is the code step's own and the only word here.
 */

/**
 * A step's header: its title, the sentence under it, and the address chip that sentence
 * leads into, 8 apart — centered at a desk, set left on a phone (0o, Tools 0a). The title
 * takes focus when a step's state is replaced under the reader, so a screen reader names
 * the new one.
 */
export function SignInHeader({ heading, sentence, chip, headingRef }) {
    return (
        <header className="flex flex-col items-center gap-sign-in-header-gap text-center max-sm:items-start max-sm:text-left">
            <h1 ref={headingRef} tabIndex={-1} className="text-heading-lg outline-none max-sm:text-mobile-heading-lg">
                {heading}
            </h1>
            {sentence && <p className="text-body text-foreground-muted max-sm:text-mobile-body max-sm:text-foreground-subtle">{sentence}</p>}
            {chip}
        </header>
    );
}

/**
 * The address a step is about, as a chip: the avatar's initial, the address — an ellipsis
 * when it is too long, with `Change` kept — and `Change` when the step can go back to the
 * address (0o, Tools 0a Pill). One that only names who is signing in has no `Change` and
 * takes no press. On a phone its target is the least a touch target takes, without the
 * chip growing. While its step is busy it keeps its look and takes no press.
 */
export function AddressChip({ email, onChange, disabled = false }) {
    const content = (
        <>
            <span
                aria-hidden="true"
                className="flex size-avatar shrink-0 items-center justify-center rounded-full bg-selected text-body-sm font-semibold text-primary"
            >
                {email.slice(0, 1)}
            </span>
            <span className="min-w-0 truncate font-medium">{email}</span>
            {onChange && <span className="shrink-0 font-semibold text-primary">{SIGN_IN_COPY.code.change}</span>}
        </>
    );
    const chip =
        "relative inline-flex h-control max-w-full items-center gap-gap rounded-full border border-border bg-white pr-avatar-chip-inset-right pl-avatar-chip-inset-left text-left text-body text-foreground-default max-sm:h-mobile-chip max-sm:pr-mobile-chip-inset-x max-sm:pl-mobile-avatar-chip-inset-left max-sm:text-mobile-body-sm";
    if (!onChange) return <span className={chip}>{content}</span>;
    return (
        <button
            type="button"
            aria-disabled={disabled || undefined}
            onClick={disabled ? undefined : onChange}
            className={`${chip} not-aria-disabled:hover:bg-hover-subtle not-aria-disabled:active:bg-hover-subtle aria-disabled:cursor-default max-sm:before:absolute max-sm:before:inset-x-0 max-sm:before:-inset-y-[calc((var(--spacing-mobile-touch-target)-var(--height-mobile-chip))/2)]`}
        >
            {content}
        </button>
    );
}

/** The mark before what an alert says: a circle with an i in it, in Ink 2 (Tools 0a Notice). */
function InfoMark() {
    return (
        <svg viewBox="0 0 18 18" fill="none" aria-hidden="true" className="size-mobile-alert-icon shrink-0 text-foreground-muted">
            <circle cx="9" cy="9" r="7.3" stroke="currentColor" strokeWidth="1.4" />
            <path d="M9 8v4.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="9" cy="5.4" r="1" fill="currentColor" />
        </svg>
    );
}

/**
 * A refusal about the whole step — a request that did not happen. At a desk it is 0o's
 * line, the alert mark before one sentence in red, centered, 24 under the fields and 14 over
 * the action; on a phone it is the alert Tools 0a draws for what the reader did not cause
 * and cannot fix in place, 24 under the content. One of the two is drawn at any width, so
 * assistive tech hears the sentence once.
 */
export function PageRefusal({ children }) {
    return (
        <div className="mt-sign-in-form-stack">
            <div className="max-sm:hidden">
                <Refusal align="center">{children}</Refusal>
            </div>
            <div
                role="alert"
                className="hidden gap-mobile-alert-gap rounded-mobile-control bg-background-muted px-mobile-alert-inset-x py-mobile-alert-inset-y text-mobile-body text-foreground-default max-sm:flex"
            >
                <span className="flex h-[var(--text-mobile-body--line-height)] items-center">
                    <InfoMark />
                </span>
                <span>{children}</span>
            </div>
        </div>
    );
}

/** How far the keyboard covers the page from below, which the bar rides on (Tools 0a Keyboard). */
function useKeyboardCover() {
    const [cover, setCover] = useState(0);
    const [typing, setTyping] = useState(false);
    useEffect(() => {
        const view = window.visualViewport;
        const coarse = window.matchMedia("(pointer: coarse)");
        const measure = () => {
            if (view) setCover(Math.max(0, Math.round(window.innerHeight - view.height - view.offsetTop)));
        };
        // A browser that shrinks the page for its keyboard rather than covering it reports
        // no cover, so a phone with a field in use counts as typing either way.
        const onFocus = (event) => setTyping(coarse.matches && event.target instanceof HTMLInputElement);
        const onBlur = () => setTyping(false);
        measure();
        view?.addEventListener("resize", measure);
        view?.addEventListener("scroll", measure);
        document.addEventListener("focusin", onFocus);
        document.addEventListener("focusout", onBlur);
        return () => {
            view?.removeEventListener("resize", measure);
            view?.removeEventListener("scroll", measure);
            document.removeEventListener("focusin", onFocus);
            document.removeEventListener("focusout", onBlur);
        };
    }, []);
    return { cover, keyboard: cover > 0 || typing };
}

/** Whether the content above the bar runs on under it, which is when its soft edge shows. */
function useRunsUnder(markRef, barRef) {
    const [under, setUnder] = useState(false);
    useEffect(() => {
        const measure = () => {
            const mark = markRef.current?.getBoundingClientRect();
            const bar = barRef.current?.getBoundingClientRect();
            if (mark && bar) setUnder(mark.top > bar.top);
        };
        measure();
        const resize = new ResizeObserver(measure);
        resize.observe(document.body);
        window.addEventListener("scroll", measure, { passive: true });
        window.visualViewport?.addEventListener("resize", measure);
        return () => {
            resize.disconnect();
            window.removeEventListener("scroll", measure);
            window.visualViewport?.removeEventListener("resize", measure);
        };
    }, [markRef, barRef]);
    return under;
}

const BAR_STACK = {
    header: "mt-sign-in-header-stack",
    form: "mt-sign-in-form-stack",
    refusal: "mt-gap-lg",
};

/**
 * Where a step's action stands. At a desk it is the next thing in the column, `stack`
 * under what is above it: 32 under the header, 24 under a field, 14 under a refusal (0o).
 *
 * ON A PHONE IT IS THE BOTTOM BAR (Tools 0a Foot bar): at the page's foot, sticky, 16 above
 * and either side and 20 below, drawing no rule, no ground and no shadow — and while the
 * content runs on under it, a soft edge, the translucent white over a blur, fading in over
 * the 24 above it. **It rides on the keyboard**, 12 below it rather than 20, so a step's
 * action and its field are both in sight while somebody types: a browser that shrinks the
 * page for its keyboard keeps a sticky bar above it by itself — the sign-in layout asks for
 * that — and one that covers the page instead reports how far it covers, which the bar is
 * lifted by.
 */
export function BottomBar({ stack = "form", children }) {
    const markRef = useRef(null);
    const barRef = useRef(null);
    const { cover, keyboard } = useKeyboardCover();
    const under = useRunsUnder(markRef, barRef);
    return (
        <>
            <span ref={markRef} aria-hidden="true" className="block max-sm:order-last" />
            <div
                ref={barRef}
                data-keyboard={keyboard || undefined}
                style={{ "--keyboard-cover": `${cover}px` }}
                className={`${BAR_STACK[stack]} max-sm:sticky max-sm:bottom-(--keyboard-cover) max-sm:isolate max-sm:order-last max-sm:-mx-mobile-gutter max-sm:mt-auto max-sm:px-mobile-gutter max-sm:pt-mobile-bottom-bar-inset-top max-sm:pb-mobile-bottom-bar-inset-bottom max-sm:data-keyboard:pb-mobile-bottom-bar-keyboard-inset-bottom`}
            >
                <span
                    aria-hidden="true"
                    data-under={under || undefined}
                    className="pointer-events-none absolute inset-x-0 -top-mobile-bottom-bar-bleed bottom-0 -z-10 hidden bg-background-translucent opacity-0 backdrop-blur-sm transition-opacity duration-mobile-bottom-bar [mask-image:linear-gradient(transparent,black_var(--spacing-mobile-bottom-bar-bleed))] data-under:opacity-100 max-sm:block"
                />
                {children}
            </div>
        </>
    );
}
