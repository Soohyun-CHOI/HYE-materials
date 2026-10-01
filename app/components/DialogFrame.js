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
 * of anything a press opens over the page, with no dependency and no focus trap written
 * here. The one it does not bring is 0l's own: the first field that takes typing holds the
 * caret when the dialog opens, where the browser gives focus to the first focusable thing,
 * which in this frame is the close. So the frame moves it. A dialog no press opened asks
 * one thing more, below.
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
 * A DIALOG NO PRESS OPENED HANDS FOCUS TO THE PAGE'S HEADING WHEN IT CLOSES (#459). The
 * browser hands focus back to whatever held it when the dialog opened, which for a dialog
 * a page opens on arrival is nothing on a fresh load and, after a landing, an opener the
 * landing took away. So such a dialog is `unprompted`, and its closing puts focus on the
 * page's `h1` — where the page begins, which is where an arrival with nothing to tell
 * leaves the reader, and what a screen reader names as it lands. The heading is made
 * focusable here rather than by each page, so the rule has one implementation. A dialog
 * that opens as another closes takes focus as it opens, and hands it back to the heading
 * the same way.
 *
 * WHAT A DIALOG SAYS AND WHAT IT HOLDS UP ARE THE FRAME'S TOO (#459). `DialogMessage` is
 * 0l's one sentence, and it describes the dialog it stands in, since a dialog with no
 * field is otherwise announced by its title alone; `DialogSummary` is 0l's summary, the
 * card a dialog holds up for reference. The landing's two dialogs are the first to say
 * and to list, and #458's confirmations say the same kind of sentence.
 *
 * A DIALOG CAN HOLD A PREVIEW BESIDE WHAT IT SAYS (#457), which is the frame's second
 * build and 1i's: a pane on the Field ground the dialog's full height and flush to its
 * edges, where what it shows is drawn as it will print, and beside it a column that is
 * the Compact build inside — the head, the body and the actions, 24 all round. 0l's
 * Split takes the width its summary and its control need, and this is the same rule
 * with a preview for the control: 780 by 520, the pane 440 and the column the rest. The
 * column holds its width as the screen narrows and the pane gives way, and on a phone,
 * which 1i does not draw, the two stack in reading order — the head, the preview, then
 * what the dialog says and its actions. The labels are its one caller, and the pane is
 * what they print; their stylesheet is what takes everything else off the paper.
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
 * Where focus goes when a dialog no press opened closes: the page's heading (#459), made
 * focusable if the page did not make it so. A page with no heading keeps what the browser
 * gave back.
 */
function focusPageHeading() {
    const heading = document.querySelector("h1");
    if (!heading) return;
    if (!heading.hasAttribute("tabindex")) heading.tabIndex = -1;
    heading.focus();
}

/** The two builds' surfaces: 28 clear of every edge, the Surface corner and the Modal shadow. */
const DIALOG = "m-auto max-h-[calc(100dvh-2*var(--spacing-dialog-gutter))] w-full overflow-hidden rounded-dialog bg-white font-ui text-foreground-default shadow-dialog backdrop:bg-dialog-overlay";

/** Compact: 420 wide, 24 of room all round, one column. */
const COMPACT = "max-w-[min(var(--container-dialog),calc(100vw-2*var(--spacing-dialog-gutter)))] flex-col p-dialog-inset open:flex";

/**
 * With a preview (#457): 780 by 520, the pane 440 and the column the rest, and below the
 * phone's edge one column in reading order. The column's floor is what 780 leaves 440.
 */
const WITH_PREVIEW =
    "max-w-[min(var(--container-dialog-preview),calc(100vw-2*var(--spacing-dialog-gutter)))] flex-col open:flex " +
    "sm:h-[min(var(--height-dialog-preview),calc(100dvh-2*var(--spacing-dialog-gutter)))] sm:open:grid " +
    "sm:grid-cols-[minmax(0,var(--width-dialog-preview-pane))_minmax(calc(var(--container-dialog-preview)-var(--width-dialog-preview-pane)),1fr)] " +
    "sm:grid-rows-[auto_minmax(0,1fr)]";

/**
 * A modal dialog of 0l's Compact build: 420 wide and 28 clear of every edge of the screen,
 * 24 of room all round, the title at the Section size with a line under it 2 below, and a
 * 28 close on the right, centered on the title's line and pulled 4 out so its mark meets
 * the edge, at least 16 from the title. A figure in the title is tabular, as the design
 * sets every figure.
 *
 * `onSubmit` makes what it holds a form, which is how a dialog of fields submits: its
 * actions are inside the form with the fields they submit. `unprompted` is for a dialog
 * no press opened, which hands focus to the page's heading when it closes. `preview` is
 * the second build (#457): what it holds is drawn in a pane beside the column, which is
 * the Compact build's inside — see the header.
 */
export function DialogFrame({ open, onClose, busy = false, unprompted = false, title, subtitle, onSubmit, preview, children }) {
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
            if (unprompted) focusPageHeading();
        }
    }, [open, unprompted]);

    const ask = () => {
        if (!busy) onClose();
    };
    const Content = onSubmit ? "form" : "div";
    const withPreview = preview !== undefined;

    // The head and what the dialog holds are one arrangement in both builds. With a
    // preview they sit in the column beside the pane, so each takes the room the dialog
    // itself takes in the Compact build — the head 24 above and either side, the rest 24
    // either side and below — and they are placed in the column's two rows from the
    // phone's edge up; below it they stack with the pane between them.
    const head = (
        <div
            className={`flex shrink-0 items-start justify-between gap-dialog-header-inline ${withPreview ? "px-dialog-inset pt-dialog-inset sm:col-start-2 sm:row-start-1" : ""}`}
        >
            <div className="flex min-w-0 flex-col gap-dialog-title-stack">
                <h2 id={titleId} className="text-heading font-semibold tabular-nums">
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
    );

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
            className={`${DIALOG} ${withPreview ? WITH_PREVIEW : COMPACT}`}
        >
            {open && (
                <>
                    {head}
                    {withPreview && (
                        <div className="min-h-0 overflow-y-auto overscroll-contain bg-background-muted p-dialog-inset sm:col-start-1 sm:row-span-2 sm:row-start-1">
                            {preview}
                        </div>
                    )}
                    <Content
                        onSubmit={onSubmit}
                        className={`flex min-h-0 flex-col ${withPreview ? "px-dialog-inset pb-dialog-inset sm:col-start-2 sm:row-start-2" : ""}`}
                    >
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
 * everything fits, and none at an end the reader has reached (0l). It takes the room its
 * column has to spare, which in a dialog with a preview (#457) is what keeps the actions at
 * the column's foot; in the Compact build the column is its content's height, and there is
 * none to take.
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
        <div className="relative flex min-h-0 grow flex-col">
            <div ref={scrollerRef} className="flex min-h-0 flex-col gap-gap-lg overflow-y-auto pt-dialog-header-stack">
                {children}
            </div>
            {hidden.above && <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-divider" />}
            {hidden.below && <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-divider" />}
        </div>
    );
}

/**
 * The one sentence a dialog says (0l: 14, in Ink), and what describes the dialog it stands
 * in (#459). A dialog of fields is named by its title and needs no more, but one that tells
 * the reader something would be announced by its title alone, so this names itself as its
 * dialog's description — set before the dialog opens, since a child's layout effect runs
 * before its frame's, and taken away as it closes. A figure in it is tabular.
 */
export function DialogMessage({ children }) {
    const id = useId();
    const messageRef = useRef(null);

    useLayoutEffect(() => {
        const dialog = messageRef.current?.closest("dialog");
        if (!dialog) return undefined;
        dialog.setAttribute("aria-describedby", id);
        return () => dialog.removeAttribute("aria-describedby");
    }, [id]);

    return (
        <p ref={messageRef} id={id} className="text-body text-pretty tabular-nums text-foreground-default">
            {children}
        </p>
    );
}

/**
 * A dialog's summary (0l Split): a card on the Field ground at the Group radius, 16 inside
 * above and below and 18 either side — what a dialog holds up for reference rather than
 * asks about. What it holds lays itself out; the ids a landing names are the first (1k).
 */
export function DialogSummary({ children }) {
    return (
        <div className="rounded-card bg-background-muted px-dialog-summary-inset-x py-dialog-summary-inset-y">{children}</div>
    );
}

/**
 * The dialog's actions, on the right 8 apart and 24 under what it asks — and above them,
 * 14 over, the one line a refusal about the whole dialog takes: a 16 alert mark 8 before
 * one sentence at 13, both in Red (0l). A refusal about one field is that field's to say.
 *
 * THEY WRAP, still on the right, when they do not fit one line (#459). An action that
 * cannot act carries its reason before it (0f), and in a dialog 319 wide on a phone the
 * reason and the button beside another action are wider than the line.
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
            <div className="flex flex-wrap justify-end gap-gap">{children}</div>
        </div>
    );
}
