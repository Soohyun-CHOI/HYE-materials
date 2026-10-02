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
 * a dialog out from under its own write was the retirement modal's rule (#363), and it
 * holds for Escape as much as for the close. A press on the backdrop does nothing. 0l does
 * not draw one closing, and a dialog of fields that shut on a stray press would lose what
 * was typed into it. The one exception is 1f's sheets, below, which the design draws
 * closing on what lies behind them and which hold nothing a press could lose.
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
 * and to list, and the retirement says the same kind of sentence (#458).
 *
 * A QUESTION BEFORE AN ACT THAT CANNOT BE UNDONE IS 0l's CONFIRM (#458): `recordId` makes
 * the line under the title the record's id, in the id face at 13 and Ink, and nothing
 * else — the title asks and names the record, the one sentence says what the act ends.
 * The retirement is its first caller.
 *
 * BELOW THE PHONE'S EDGE A DIALOG MARKED `sheet` IS TOOLS 0a's SHEET (#458): at the foot of
 * the screen and its full width, the top corners 28, cast upward over Shadow ink at 24%, a
 * handle 12 from its top and the title 14 above and below at 17 and 600, no close, the
 * actions stacked full width with the commitment over `Cancel`, and 20 at the foot plus the
 * device's safe area. A Confirm drawn so is 0a's sheet that confirms: no handle, the title
 * 24 from its top, the id 4 under it at 15 in Ink 3, the sentence 14 below. The tool item
 * page's dialogs are the ones a phone opens, so they are the callers; every other dialog on
 * the frame is a desk's. The frame marks the dialog `data-sheet` — `drawer` or `confirm` —
 * and what it holds takes its phone sizes from `max-sm:in-data-[sheet]:` classes, so CSS
 * decides both conditions and none of it is a second account of the phone's edge.
 *
 * 1f's THREE SHEETS ARE PARTS ON THIS FRAME, built to be opened as they are. The job sheet
 * and the name sheet beside the tool item page, and the retirement's Confirm, close on a
 * press on what lies behind them while drawn as sheets (`closesOnBackdrop`), the name
 * sheet on its handle too (`onHandlePress`), and the name sheet ends in `done`, a text
 * button at its head's end in place of the close, since it holds a field (0a Sheet). They
 * open from the page's dialogs today, and from #463's foot bar — 1f's — with nothing about
 * them changed.
 *
 * A DIALOG TAKEN OFF THE PAGE WHILE OPEN HANDS FOCUS BACK AS ITS CLOSING WOULD (#458). The
 * browser restores focus when it is asked to close a dialog and not when the dialog is
 * removed, which leaves focus on the document. So the frame keeps what opened it: focus
 * goes back there while the page still has it — the check-out's opener, which a refusal
 * re-rendering the page in place can turn into the check-in's press — and to the page's
 * heading when it went with the dialog, as on every landing on the tool item page: the
 * router answers an action's redirect by remounting the tree under the component that
 * called it, and the retirement's question leaves with its opener. The heading is where
 * #459 sends a dialog nothing opened.
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
 * THE ONLY FRAME ON THE TOOLS AXIS SINCE #458. The tool item page's retirement and the
 * check-out's name sheet were drawn on `app/components/modalStyles.js` until then, and
 * `offline/dialog-frame.mjs` fails a file under `app/(tools)/` that imports it. The screens
 * above this axis keep `modalStyles.js` until #258, which is where they take the design's
 * frame and the file's own header says so.
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

/**
 * Where focus goes when a dialog is taken off the page while open (#458): back to what
 * opened it, as the browser's own closing would, or to the page's heading when that went
 * with the dialog or cannot take focus.
 */
function focusAfterRemoval(opener) {
    if (opener?.isConnected) {
        opener.focus();
        if (document.activeElement === opener) return;
    }
    focusPageHeading();
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
 * Below the phone's edge, a dialog marked `sheet` (#458): flush with the foot of the screen
 * and its full width, the top corners 28 and none below, no room of its own but 20 at the
 * foot plus the safe area — what it holds takes its own sides — cast upward over Shadow ink
 * at 24%. `--dialog-sheet` is how a press on the backdrop learns which layout it is in.
 */
const SHEET =
    "max-sm:mx-0 max-sm:mt-auto max-sm:mb-0 max-sm:max-w-none max-sm:rounded-t-mobile-drawer max-sm:rounded-b-none max-sm:px-0 max-sm:pt-0 " +
    "max-sm:pb-[calc(var(--spacing-mobile-drawer-inset-bottom)+env(safe-area-inset-bottom))] max-sm:shadow-mobile-drawer " +
    "max-sm:backdrop:bg-mobile-drawer-overlay max-sm:[--dialog-sheet:1]";

/** Whether a dialog is laid out as a sheet right now — below the phone's edge, and marked so. */
function laidOutAsSheet(dialog) {
    return getComputedStyle(dialog).getPropertyValue("--dialog-sheet").trim() === "1";
}

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
 * the Compact build's inside — see the header. `recordId` is 0l's Confirm, and `sheet`,
 * `closesOnBackdrop`, `onHandlePress` and `done` are the phone's sheet (#458), the header
 * again.
 */
export function DialogFrame({
    open,
    onClose,
    busy = false,
    unprompted = false,
    title,
    subtitle,
    recordId,
    onSubmit,
    preview,
    sheet = false,
    closesOnBackdrop = false,
    onHandlePress,
    done,
    children,
}) {
    const dialogRef = useRef(null);
    // What held focus as the dialog opened — its opener — and none for a dialog no press
    // opened, whose focus goes to the heading however it leaves.
    const openerRef = useRef(null);
    const titleId = useId();

    useLayoutEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (open && !dialog.open) {
            openerRef.current = unprompted || document.activeElement === document.body ? null : document.activeElement;
            dialog.showModal();
            dialog.querySelector("input:not([type=hidden])")?.focus();
        } else if (!open && dialog.open) {
            dialog.close();
            if (unprompted) focusPageHeading();
        }
    }, [open, unprompted]);

    // Taken off the page while open: once the removal has run, focus goes back to the
    // opener or to the heading. A dialog React only pretends to take away and puts back,
    // as Strict Mode does in development, is still in the document by then and leaves
    // focus where it is.
    useLayoutEffect(() => {
        const dialog = dialogRef.current;
        return () => {
            if (!dialog?.open) return;
            const opener = openerRef.current;
            queueMicrotask(() => {
                if (!dialog.isConnected) focusAfterRemoval(opener);
            });
        };
    }, []);

    const ask = () => {
        if (!busy) onClose();
    };
    const Content = onSubmit ? "form" : "div";
    const withPreview = preview !== undefined;
    const confirm = recordId !== undefined;

    // What lies behind is the dialog's own box only past its edges: a press inside it that
    // lands on no child — its room at the foot — is still a press on the sheet.
    const onBackdropPress = (event) => {
        const dialog = event.currentTarget;
        if (event.target !== dialog || !laidOutAsSheet(dialog)) return;
        const box = dialog.getBoundingClientRect();
        const outside = event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
        if (outside) ask();
    };

    // The head and what the dialog holds are one arrangement in both builds. With a
    // preview they sit in the column beside the pane, so each takes the room the dialog
    // itself takes in the Compact build — the head 24 above and either side, the rest 24
    // either side and below — and they are placed in the column's two rows from the
    // phone's edge up; below it they stack with the pane between them. As a sheet the head
    // takes the phone's sides, and 14 above and below its title — or, confirming, 24 above.
    const head = (
        <div
            className={`flex shrink-0 items-start justify-between gap-dialog-header-inline ${withPreview ? "px-dialog-inset pt-dialog-inset sm:col-start-2 sm:row-start-1" : ""} max-sm:in-data-[sheet=drawer]:px-mobile-gutter max-sm:in-data-[sheet=drawer]:py-mobile-drawer-title-inset-y max-sm:in-data-[sheet=confirm]:px-mobile-gutter max-sm:in-data-[sheet=confirm]:pt-mobile-confirm-inset-top`}
        >
            <div className="flex min-w-0 flex-col gap-dialog-title-stack max-sm:in-data-[sheet=confirm]:gap-mobile-confirm-title-stack">
                <h2 id={titleId} className="text-heading font-semibold tabular-nums max-sm:in-data-[sheet]:text-mobile-heading">
                    {title}
                </h2>
                {confirm ? (
                    <p className="font-id text-body-sm tracking-id text-foreground-default max-sm:in-data-[sheet]:text-mobile-body-sm max-sm:in-data-[sheet]:text-foreground-subtle">
                        {recordId}
                    </p>
                ) : (
                    subtitle && <p className="text-body-sm text-foreground-muted">{subtitle}</p>
                )}
            </div>
            {done ? (
                <div className="-mr-mobile-drawer-header-action-inset-x flex h-[var(--text-mobile-heading--line-height)] shrink-0 items-center">
                    <button
                        type="button"
                        onClick={done.onPress}
                        className="flex h-mobile-touch-target items-center rounded-full px-mobile-drawer-header-action-inset-x text-mobile-heading font-semibold text-primary active:opacity-mobile-pressed"
                    >
                        {done.label}
                    </button>
                </div>
            ) : (
                <div className="-mr-dialog-close-offset flex h-[var(--text-heading--line-height)] shrink-0 items-center max-sm:in-data-[sheet]:hidden">
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
            )}
        </div>
    );

    return (
        <dialog
            ref={dialogRef}
            aria-labelledby={titleId}
            data-sheet={sheet ? (confirm ? "confirm" : "drawer") : undefined}
            onCancel={(event) => {
                event.preventDefault();
                ask();
            }}
            onClose={() => {
                if (open) onClose();
            }}
            onClick={closesOnBackdrop ? onBackdropPress : undefined}
            className={`${DIALOG} ${withPreview ? WITH_PREVIEW : COMPACT}${sheet ? ` ${SHEET}` : ""}`}
        >
            {open && (
                <>
                    {sheet && !confirm && (
                        // The handle: 36 by 4 on the Edge, 12 from the sheet's top — drawn, and
                        // a press on it closes a sheet that says so (1f's name sheet).
                        <div aria-hidden="true" onClick={onHandlePress} className="hidden shrink-0 justify-center pt-mobile-drawer-inset-top max-sm:flex">
                            <span className="h-mobile-drawer-handle w-mobile-drawer-handle rounded-full bg-border" />
                        </div>
                    )}
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
 * none to take. As a sheet (#458) it takes the phone's sides and its fields stand 20 apart
 * right under the title's block (Tools 0a Field label) — or, confirming, the sentence 14
 * under the id.
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
            <div
                ref={scrollerRef}
                className="flex min-h-0 flex-col gap-gap-lg overflow-y-auto pt-dialog-header-stack max-sm:in-data-[sheet]:px-mobile-gutter max-sm:in-data-[sheet=drawer]:gap-mobile-field-stack max-sm:in-data-[sheet=drawer]:pt-0 max-sm:in-data-[sheet=confirm]:pt-mobile-confirm-id-stack"
            >
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
 * before its frame's, and taken away as it closes. A figure in it is tabular. In a sheet it
 * is the phone's sentence, 16 (Tools 0a Event, #458).
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
        <p ref={messageRef} id={id} className="text-body text-pretty tabular-nums text-foreground-default max-sm:in-data-[sheet]:text-mobile-body">
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
 * The rows a sheet lists to choose from (Tools 0a Sheet, #458): each at least 56, 16 at
 * Ink with 15 and 16 inside, an Inner rule between two that starts 16 in and runs to the
 * sheet's edge, and a check in Accent at the end of the one already chosen. A row takes
 * the Wash while held, as a control does under a press (0a). 1f's job sheet and name sheet
 * list theirs this way; a press on a row is the row's `onPress`.
 */
export function SheetRows({ rows }) {
    return (
        <ul role="list" className="flex min-h-0 flex-col overflow-y-auto">
            {rows.map((row, index) => (
                <li key={row.key} className="flex shrink-0 flex-col">
                    {index > 0 && <div aria-hidden="true" className="ml-mobile-drawer-row-inset-x h-px bg-divider-subtle" />}
                    <button
                        type="button"
                        aria-current={row.chosen ? "true" : undefined}
                        onClick={row.onPress}
                        className="flex min-h-mobile-drawer-row items-center justify-between gap-gap px-mobile-drawer-row-inset-x py-mobile-drawer-row-inset-y text-left text-mobile-body text-foreground-default outline-none focus-visible:bg-hover-subtle active:bg-hover-subtle"
                    >
                        <span className="min-w-0 truncate">{row.label}</span>
                        {row.chosen && (
                            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-mobile-drawer-row-icon shrink-0 text-primary">
                                <path d="M3 8.5 6.2 11.7 13 4.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        )}
                    </button>
                </li>
            ))}
        </ul>
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
 *
 * AS A SHEET THEY STACK (#458): 20 under what the sheet holds, each the sheet's width and 12
 * apart, the commitment over the text button that cancels — Tools 0a's sheet that confirms,
 * which is the one arrangement 0a gives a sheet's actions, so a sheet of fields takes it too.
 * The commitment is written last and drawn first, so the order a keyboard meets them at a
 * desk — `Cancel`, then the act — is the order in the markup at both widths.
 */
export function DialogActions({ refusal, children }) {
    return (
        <div className="flex shrink-0 flex-col gap-gap-lg pt-dialog-inset max-sm:in-data-[sheet]:px-mobile-gutter max-sm:in-data-[sheet]:pt-mobile-drawer-body-stack">
            {refusal && (
                <p role="alert" className="flex items-center gap-gap text-body-sm text-danger max-sm:in-data-[sheet]:text-mobile-body-sm">
                    <AlertMark />
                    <span>{refusal}</span>
                </p>
            )}
            <div className="flex flex-wrap justify-end gap-gap max-sm:in-data-[sheet]:flex-col-reverse max-sm:in-data-[sheet]:gap-mobile-drawer-action-stack">
                {children}
            </div>
        </div>
    );
}
