"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { MODAL_BACKDROP, MODAL_CARD } from "@/app/components/modalStyles";
import { TOOL_EVENT } from "@/lib/toolStatus";
import {
    RECENT_NAMES_SHOWN,
    TOOL_TRANSITION_COPY as COPY,
    jobMoveNotice,
    narrowNames,
    recentNamesFor,
} from "@/lib/toolTransition";
import { recordToolItemEventAction } from "./actions";

/**
 * The one transition this tool item's status allows (#362).
 *
 * NO MODAL, AND THE RULE IS THIS REPOSITORY'S OWN. CLAUDE.md: a modal is for an
 * act that cannot be undone; an act that can is edited in place (#318). A
 * check-out can be undone by a check-in — `lib/airtable/toolLog.js` says
 * correcting a mistaken scan is another row — so the confirmation the issue asks
 * for is that ARRIVING IS NOT ACTING. A QR opens the page, the page states the
 * printed id and the current status, and pressing this is the act. #363 is the
 * transition that cannot be undone and that issue carries the weight instead: a
 * required reason, which its own body calls what stands between a mis-tap and a
 * state the app cannot leave.
 *
 * THE COST OF THE OTHER ANSWER IS WHAT SETTLES IT RATHER THAN THE RULE ALONE. A
 * project starts with a manager scanning their job's tools out one at a time and
 * ends with them scanning back what returned, so a transition is dozens a day and
 * a second tap is dozens more. A confirmation heavy enough to be worth avoiding
 * is one people avoid, on paper, and the moment that happens this system holds
 * nothing. What a modal would add is a restatement of the id and the status the
 * page has already put in front of them.
 *
 * IT CARRIES NO CLASS, NO WIDTH, NO COLOR AND NO SPACING — #336's rule for this
 * axis, and it bites hardest here: this is the first control in the app a gloved
 * hand presses, and the size that makes it is #258's to decide. The brief says
 * so, because the design work cannot read this file.
 *
 * EVERY STRING COMES FROM `TOOL_TRANSITION_COPY`, which `offline/
 * tool-list-view.mjs` holds by failing on any JSX text under app/(tools)/.
 *
 * THE SUBMIT IS DISABLED WHILE PENDING, which is not a nicety: `withKeyLock`
 * serializes within one invocation only, so the frontend guard is the other half
 * of every double-write argument on this axis.
 */
export default function ToolTransitionForm({
    toolItemId,
    event,
    jobs,
    currentJobCode,
    recentCheckOuts,
}) {
    const [state, formAction, pending] = useActionState(recordToolItemEventAction, null);
    // One assignment is used without asking and several are chosen from, which is
    // #338's pair with no path that types a job. The state exists only for the
    // move notice below — with one job there is nothing to pick, so the value is
    // known from the start and the notice is decided on the first render.
    const [jobId, setJobId] = useState(jobs.length === 1 ? jobs[0].id : "");
    // #376 — the name, the sheet, and the refusal this form reaches on its own.
    // One piece of state behind two inputs: the field on the page and the one in
    // the sheet are the same value, so a name typed in either is the name that
    // submits.
    const [name, setName] = useState("");
    const [sheetOpen, setSheetOpen] = useState(false);
    const [nameMissing, setNameMissing] = useState(false);
    const fieldRef = useRef(null);
    const sheetRef = useRef(null);

    const chosen = jobs.find((job) => job.id === jobId) ?? null;
    const movesJob = jobMoveNotice({ from: currentJobCode, to: chosen?.jobCode });

    // WHO THIS JOB HAS RECENTLY HANDED TOOLS TO, NARROWED IN THE BROWSER. The page
    // loaded the rows for every job this reader is on; the picker decides which of
    // them this list is about, and typing narrows it further. No round trip on
    // either, which is #338's arrangement and the reason the page loads a list at
    // all rather than searching per keystroke.
    const askingForName = event === TOOL_EVENT.CHECKED_OUT;
    const recentNames = recentNamesFor(recentCheckOuts, { jobCode: chosen?.jobCode });
    const offered = narrowNames(recentNames, name);
    const shown = name.trim() ? offered : offered.slice(0, RECENT_NAMES_SHOWN);

    const closeSheet = useCallback(() => {
        if (pending) return;
        setSheetOpen(false);
        fieldRef.current?.focus();
    }, [pending]);

    useEffect(() => {
        if (!sheetOpen) return;
        sheetRef.current?.focus();
        const onKey = (e) => {
            if (e.key === "Escape") closeSheet();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [sheetOpen, closeSheet]);

    // THE FORM'S HALF OF THE REQUIREMENT, AND IT IS NOT THE BROWSER'S. A `required`
    // attribute would refuse with the browser's own bubble, which is neither this
    // app's sentence nor Design's to style — so the submit is canceled here and
    // the app's sentence goes in the one slot this form has for a refusal, the same
    // slot the action's answers arrive in. The action asks the same question again,
    // because a Server Action is reachable without this form.
    const guard = (e) => {
        if (!askingForName || name.trim()) return;
        e.preventDefault();
        setNameMissing(true);
        setSheetOpen(false);
        fieldRef.current?.focus();
    };

    const refusal = nameMissing ? COPY.nameRequired : state?.error;

    return (
        <form action={formAction} onSubmit={guard}>
            <input type="hidden" name="toolItemId" value={toolItemId} />
            {/* The event the page offered. The action re-derives it from the
                stored status and compares — it never writes this value — so a
                page opened before somebody else moved the tool is refused
                instead of recording the opposite of what the button says. */}
            <input type="hidden" name="event" value={event} />

            {refusal && <p role="alert">{refusal}</p>}

            <div>
                <label htmlFor="jobId">{COPY.jobLabel}</label>
                {jobs.length === 1 ? (
                    <>
                        <input type="hidden" name="jobId" value={jobs[0].id} />
                        <span id="jobId">{jobs[0].jobCode}</span>
                    </>
                ) : (
                    <select
                        id="jobId"
                        name="jobId"
                        required
                        value={jobId}
                        onChange={(e) => setJobId(e.target.value)}
                    >
                        <option value="" disabled>
                            {COPY.jobUnchosen}
                        </option>
                        {jobs.map((job) => (
                            <option key={job.id} value={job.id}>
                                {job.jobCode}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {/* The two `Job` values on this screen disagreeing is not a labeling
                problem, it is the tool changing site — said out loud rather than
                left for the reader to notice two different job codes under one
                word. */}
            {movesJob && <p>{movesJob}</p>}

            {/* WHO THE TOOL IS GOING TO (#376), ABOVE THE CONTROL THAT RECORDS IT.
                No separate label: the placeholder is the label, which is the
                design's, and the sheet that opens from it carries the same words as
                a title. `aria-label` says them again for a reader who never sees a
                placeholder — that is the one thing a placeholder cannot do, and it
                is not a second word because it is the same constant. */}
            {askingForName && (
                <>
                    <input
                        ref={fieldRef}
                        type="text"
                        name="checkedOutTo"
                        value={name}
                        placeholder={COPY.checkedOutToLabel}
                        aria-label={COPY.checkedOutToLabel}
                        autoComplete="off"
                        // PRESSED RATHER THAN FOCUSED, WHICH IS FORCED RATHER THAN
                        // CHOSEN. Closing hands focus back to this field, so opening
                        // on focus reopens the sheet the moment it closes — measured
                        // in a browser, where `Done` did nothing at all. A tap is a
                        // click, so the design's "touch the field" is unchanged; the
                        // keyboard needs its own way in, which CLAUDE.md requires of
                        // anything that opens over the page and a text input does not
                        // give for free.
                        onClick={() => setSheetOpen(true)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === "ArrowDown") {
                                e.preventDefault();
                                setSheetOpen(true);
                            }
                        }}
                        onChange={(e) => {
                            setName(e.target.value);
                            setNameMissing(false);
                        }}
                    />

                    {/* THE SHEET IS A PICKER AND PERFORMS NO ACT, which is what puts
                        it on the permitted side of the modal rule — `/prs/new`'s
                        three are a prompt, a picker and a notice. It opens from the
                        field, closes on `Escape`, by its own control and on the
                        backdrop, and hands focus back to the field. The chrome is
                        the app's single source; whether it rises from the bottom
                        with the keyboard is Design's, and the brief says so. */}
                    {sheetOpen && (
                        <div className={MODAL_BACKDROP} onClick={closeSheet}>
                            <div
                                ref={sheetRef}
                                role="dialog"
                                aria-modal="true"
                                aria-labelledby="checked-out-to-heading"
                                tabIndex={-1}
                                onClick={(e) => e.stopPropagation()}
                                className={`${MODAL_CARD} max-w-md`}
                            >
                                <h2 id="checked-out-to-heading">{COPY.checkedOutToLabel}</h2>
                                {/* The same value as the field behind it. On a
                                    phone the keyboard covers that one, so this is
                                    the one a person actually types into. */}
                                <input
                                    type="text"
                                    value={name}
                                    aria-label={COPY.checkedOutToLabel}
                                    autoComplete="off"
                                    autoFocus
                                    onChange={(e) => {
                                        setName(e.target.value);
                                        setNameMissing(false);
                                    }}
                                />

                                {/* THE LIST IS ABOUT A JOB, SO IT IS ABSENT UNTIL
                                    ONE IS CHOSEN — not empty, absent. Measured in a
                                    browser: a reader with two assignments can open
                                    this before touching the picker, and the empty
                                    sentence then says nothing has gone out on a job
                                    nobody has named. A person on one job never meets
                                    it, because that one is chosen from the start. */}
                                {chosen && <h3>{COPY.recentHeading}</h3>}
                                {chosen && recentNames.length === 0 ? (
                                    <p>{COPY.noRecentNames}</p>
                                ) : (
                                    <ul>
                                        {shown.map((candidate) => (
                                            <li key={candidate}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setName(candidate);
                                                        setNameMissing(false);
                                                        closeSheet();
                                                    }}
                                                >
                                                    {candidate}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                <button type="button" onClick={closeSheet}>
                                    {COPY.sheetDone}
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            <button type="submit" disabled={pending}>
                {COPY.control[event]}
            </button>
        </form>
    );
}
