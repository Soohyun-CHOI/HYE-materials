"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { DIALOG_FRAME_COPY as COPY } from "@/lib/dialogFrame";

/*
 * The frame a dialog opens in — Claude Design's 0l, drawn once (#456).
 *
 * THE BROWSER'S OWN MODAL DIALOG, AND WHAT IT BRINGS IS WHY. `showModal()` puts the
 * dialog in the top layer, makes everything outside it inert — pointer and keyboard both,
 * so focus cannot wander behind it — turns Escape into a `cancel` event, and hands focus
 * back to whatever held it when the dialog closes. That is every behavior CLAUDE.md asks
 * of anything opening over the page except one, with no dependency and no focus trap
 * written here. The one it does not bring is 0l's own: the first field that takes typing
 * holds the caret when the dialog opens, where the browser gives focus to the first
 * focusable thing, which in this frame is the close. So the frame moves it.
 *
 * A DIALOG CLOSES ONLY WHEN ITS OWNER SAYS SO. Escape and the close ask `onClose`, and the
 * browser's own closing is turned down, so the owner's `open` stays the one account of
 * whether the dialog shows. While `busy` — a submission in flight — neither asks: pulling
 * a dialog out from under its own write is `RetireToolItemForm.js`'s rule, and it holds
 * for Escape as much as for the close. A press on the backdrop does nothing. 0l does not
 * draw one closing, and a dialog of fields that shut on a stray press would lose what was
 * typed into it.
 *
 * WHAT IT HOLDS IS RENDERED ONLY WHILE IT IS OPEN, so a dialog opened again starts from
 * what its opener hands it rather than from whatever it was left holding.
 *
 * ONE OF TWO FRAMES ON THE TOOLS AXIS UNTIL #458, AND THE ONLY ONE WHEN THAT LANDS. The tool
 * item page's two dialogs — the retirement and the check-out's name sheet — are still drawn
 * on `app/components/modalStyles.js`, and #458 is the issue that moves them here;
 * `offline/dialog-frame.mjs` names the two, so a third drawn on the old frame fails and
 * #458 empties the list. The screens above this axis keep `modalStyles.js` until #258,
 * which is where they take the design's frame and the file's own header says so.
 */

/** The mark before a refusal about the whole dialog: a circle and an exclamation, in Red (0l Actions). */
function AlertMark() {
    return (
        <svg viewBox="0 0 18 18" fill="none" aria-hidden="true" className="size-icon shrink-0">
            <circle cx="9" cy="9" r="7.3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M9 5.2v4.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="9" cy="12.6" r="1" fill="currentColor" />
        </svg>
    );
}

/**
 * A modal dialog of 0l's Compact build: 420 wide and 28 clear of every edge of the screen,
 * 24 of room all round, the title at the Section size with a line under it 2 below, and a
 * 28 close on the right, centered on the title's line and pulled 4 out so its mark meets
 * the edge, at least 16 from the title.
 *
 * `onSubmit` makes what it holds a form, which is how a dialog of fields submits: its
 * actions are inside the form with the fields they submit.
 */
export function DialogFrame({ open, onClose, busy = false, title, subtitle, onSubmit, children }) {
    const dialogRef = useRef(null);
    const titleId = useId();

    useLayoutEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (open && !dialog.open) {
            dialog.showModal();
            dialog.querySelector("input:not([type=hidden])")?.focus();
        } else if (!open && dialog.open) {
            dialog.close();
        }
    }, [open]);

    const ask = () => {
        if (!busy) onClose();
    };
    const Content = onSubmit ? "form" : "div";

    return (
        <dialog
            ref={dialogRef}
            aria-labelledby={titleId}
            onCancel={(event) => {
                event.preventDefault();
                ask();
            }}
            onClose={() => {
                if (open) onClose();
            }}
            className="m-auto max-h-[calc(100dvh-2*var(--spacing-dialog-gutter))] w-full max-w-[min(var(--container-dialog),calc(100vw-2*var(--spacing-dialog-gutter)))] flex-col overflow-hidden rounded-dialog bg-white p-dialog-inset font-ui text-foreground-default shadow-dialog backdrop:bg-dialog-overlay open:flex"
        >
            {open && (
                <>
                    <div className="flex shrink-0 items-start justify-between gap-dialog-header-inline">
                        <div className="flex min-w-0 flex-col gap-dialog-title-stack">
                            <h2 id={titleId} className="text-heading font-semibold">
                                {title}
                            </h2>
                            {subtitle && <p className="text-body-sm text-foreground-muted">{subtitle}</p>}
                        </div>
                        <div className="-mr-dialog-close-offset flex h-[var(--text-heading--line-height)] shrink-0 items-center">
                            <button
                                type="button"
                                aria-label={COPY.close}
                                disabled={busy}
                                onClick={ask}
                                className="flex h-dialog-close aspect-square items-center justify-center rounded-control text-foreground-subtle enabled:hover:bg-hover enabled:hover:text-foreground-default"
                            >
                                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-icon-sm">
                                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    <Content onSubmit={onSubmit} className="flex min-h-0 flex-col">
                        {children}
                    </Content>
                </>
            )}
        </dialog>
    );
}

/**
 * What a dialog asks or says, under its head: 20 from the title's line, 14 between two
 * fields. When the screen is too short for it the body scrolls between a head and actions
 * that stay put, and a Rule marks each edge its content is hidden past — none while
 * everything fits, and none at an end the reader has reached (0l).
 */
export function DialogBody({ children }) {
    const scrollerRef = useRef(null);
    const [hidden, setHidden] = useState({ above: false, below: false });

    useLayoutEffect(() => {
        const scroller = scrollerRef.current;
        if (!scroller) return undefined;
        const measure = () => {
            const above = scroller.scrollTop > 0;
            const below = scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 1;
            setHidden((was) => (was.above === above && was.below === below ? was : { above, below }));
        };
        // The observer reports on its first observation, which is the first measurement.
        const observer = new ResizeObserver(measure);
        observer.observe(scroller);
        for (const child of scroller.children) observer.observe(child);
        scroller.addEventListener("scroll", measure);
        return () => {
            observer.disconnect();
            scroller.removeEventListener("scroll", measure);
        };
    }, []);

    return (
        <div className="relative flex min-h-0 flex-col">
            <div ref={scrollerRef} className="flex min-h-0 flex-col gap-gap-lg overflow-y-auto pt-dialog-header-stack">
                {children}
            </div>
            {hidden.above && <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-divider" />}
            {hidden.below && <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-divider" />}
        </div>
    );
}

/**
 * The dialog's actions, on the right 8 apart and 24 under what it asks — and above them,
 * 14 over, the one line a refusal about the whole dialog takes: a 16 alert mark 8 before
 * one sentence at 13, both in Red (0l). A refusal about one field is that field's to say.
 */
export function DialogActions({ refusal, children }) {
    return (
        <div className="flex shrink-0 flex-col gap-gap-lg pt-dialog-inset">
            {refusal && (
                <p role="alert" className="flex items-center gap-gap text-body-sm text-danger">
                    <AlertMark />
                    <span>{refusal}</span>
                </p>
            )}
            <div className="flex justify-end gap-gap">{children}</div>
        </div>
    );
}
