"use client";

import { useState } from "react";
import { useField } from "@/app/components/Controls";
import { CODE_LENGTH } from "@/lib/authTokenState";

/** The boxes come in two groups of three (0o, Tools 0a Keypad). */
const GROUP = CODE_LENGTH / 2;

/**
 * The code the sign-in email carries, typed into six boxes over one real field (#473, 0o
 * Code and Tools 0a Keypad). It is named, described and marked invalid by the `Field`
 * around it.
 *
 * ONE FIELD UNDER SIX BOXES, BECAUSE THE PHONE HAS TO STAY THE PHONE. A field per box
 * would take the code from a paste one figure at a time, and the phone's offer of the code
 * it has just seen in the email fills one field; so the boxes are drawings and the field
 * under them is transparent and covers them, `numeric` and `one-time-code` as #471 made
 * it, so a press anywhere on the six lands in it. It is `text` rather than `number`, which
 * would drop a leading zero, and keeps 16 as its size, below which a phone zooms the page
 * to a field it focuses. Anything but a figure is dropped as it arrives, and there is no
 * `maxLength`, which would cut a pasted `123 456` short before its figures were picked out.
 *
 * THE BOX THAT TAKES THE NEXT FIGURE IS DRAWN AS THE FIELD'S CARET while the field holds
 * focus: an Accent border doubled to 2 by an inset ring, the one field in this app that
 * shows where typing goes that way, and a 2-wide caret blinking once a second — begun
 * again at each figure, since the caret is a new element each time, and steady under
 * reduced motion. Neither shows while a code is checked or refused.
 *
 * IT TAKES FOCUS WHEN IT APPEARS, as #471's field did — after `Continue`, after a new
 * email, and when a reload brings the step back — so the code can be typed at once.
 *
 * A REFUSED CODE KEEPS ITS FIGURES, RINGED IN RED, UNTIL THE NEXT ONE. The caller hands
 * them back as `shown`; the field itself is emptied when the code was wrong, so the next
 * figure starts a new code, and kept when it was only short.
 *
 * IT SENDS ITSELF AT ITS SIXTH FIGURE, typed or pasted: `onComplete` is called with the
 * code the moment the field holds six figures where it held fewer. `Sign in` stays for
 * the rest.
 */
export default function CodeField({ value, shown, onChange, onComplete, refused = false, busy = false, inputRef }) {
    const field = useField();
    const [focused, setFocused] = useState(false);
    const figures = (shown ?? value).split("");
    const next = Math.min(value.length, CODE_LENGTH - 1);
    const live = focused && !refused && !busy;

    const box = (index) => {
        const edge = refused ? "border-danger" : live && index === next ? "border-primary inset-ring inset-ring-primary" : "border-border";
        return (
            <div
                key={index}
                className={`flex size-code-slot shrink-0 items-center justify-center rounded-control border bg-white pt-code-slot-inset-top text-code-slot tabular-nums text-foreground-default max-sm:aspect-square max-sm:size-auto max-sm:flex-1 max-sm:rounded-mobile-control ${edge}`}
            >
                {figures[index] ??
                    (live && index === value.length && (
                        <span
                            key={value.length}
                            className="block h-code-caret w-code-caret animate-code-caret rounded-full bg-primary motion-reduce:animate-none max-sm:h-mobile-code-caret"
                        />
                    ))}
            </div>
        );
    };
    const indexes = Array.from({ length: CODE_LENGTH }, (_, index) => index);

    return (
        <div className="relative mx-auto flex gap-code-group-inline max-sm:mx-0 max-sm:w-full">
            <div className="flex gap-gap max-sm:flex-1">{indexes.slice(0, GROUP).map(box)}</div>
            <div className="flex gap-gap max-sm:flex-1">{indexes.slice(GROUP).map(box)}</div>
            <input
                ref={inputRef}
                id={field.control}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                spellCheck={false}
                value={value}
                readOnly={busy}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onChange={(event) => {
                    const typed = event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH);
                    onChange(typed);
                    if (typed.length === CODE_LENGTH && value.length < CODE_LENGTH) onComplete(typed);
                }}
                aria-describedby={field.messageId}
                aria-invalid={field.refused || undefined}
                className="absolute inset-0 h-full w-full cursor-text text-mobile-body opacity-0"
            />
        </div>
    );
}
