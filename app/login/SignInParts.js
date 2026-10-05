"use client";

import { Notice, Refusal } from "@/app/components/Controls";
import { SIGN_IN_COPY } from "@/lib/authTokenState";

/*
 * What every sign-in step is drawn from (#473): the header a step opens with, the address
 * chip, and a refusal about the whole step. One page and two looks — a sign-in page at a
 * desk (0o) and a step page below the phone's edge (Tools 0a) — so each part is drawn once,
 * with the phone's values under `max-sm:`. The bar a step's action stands in was here too,
 * and the alert a phone draws for a refusal; both are `app/components/`'s since #463, when
 * the tool item page came to draw them.
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
            <div className="sm:hidden">
                <Notice>{children}</Notice>
            </div>
        </div>
    );
}
