"use client";

import { startTransition, useActionState, useState } from "react";
import {
    MAX_TOOL_ITEMS_PER_REGISTRATION,
    TOOL_REGISTRATION_COPY as COPY,
    matchExistingTool,
} from "@/lib/toolRegistration";
import { registerToolItemsAction } from "./actions";

/**
 * The registration form (#338).
 *
 * IT CARRIES NO CLASS, NO WIDTH, NO COLOR AND NO SPACING, which is #336's rule
 * about this axis applied one screen along rather than a shortcut. That issue put
 * the tools axis's only width container in the layout and left it empty on the
 * ground that nothing about this app's appearance was designed, so a value chosen
 * here to make the first write screen look finished would become the baseline a
 * design has to justify departing from. What the markup does carry is the
 * STRUCTURE a design needs: a labeled control per fact and one slot every refusal
 * arrives in. **It carried the account of what was written as a list until #449**,
 * which moved that to where a registration lands — the tool's own page, with every
 * id it wrote selected.
 *
 * EVERY STRING COMES FROM `TOOL_REGISTRATION_COPY`. A word written into JSX is
 * invisible to the vocabulary checks and to scripts/screen-strings.mjs, so it
 * cannot be swept when a word changes — which is the failure CLAUDE.md's
 * same-commit sweep rule is about.
 *
 * THE MATCH IS PREVIEWED FROM A LIST THE PAGE ALREADY LOADED, at no query cost:
 * `getAllTools` is one operation for the whole table and `matchExistingTool` is
 * the same key the action applies a moment later. So the person typing a name
 * sees that it names a tool the company already owns BEFORE they submit, which
 * is the one thing a find-or-create write path owes them. It is a PREVIEW and not
 * the verdict — the list is as old as the page — and the action asks Airtable.
 *
 * ITS STATE IS A REFUSAL AND NOTHING ELSE (#449). A registration that writes a tool
 * item leaves for its tool's page, so `useActionState` only ever holds `{ error }`.
 * That is also why the preview no longer adds the names this form has registered: it
 * did so because the form stayed put after a success, one registration staler than
 * its own list, and a form that is left has no second registration to be stale for.
 *
 * IT OPENS WHERE THE PAGE SAYS, AND THE PERSON HAS THE LAST WORD (#449). `prefill` is
 * where the two fields start — nothing typed and 1, or a tool's name and a count off
 * the address a registration that fell short offers — and nothing here holds either
 * against an edit: the name seeds the field's own state and the count is the input's
 * default.
 *
 * A REFUSAL LEAVES EVERY FIELD AS IT WAS, WHICH IS WHAT `submit` IS FOR (#449). React
 * 19 resets a form once an action bound through its `action` prop settles. Measured
 * here, hydrated and with the handler taken out: a refusal kept the name, which this
 * component controls, and put the count back to where the page started it and the job
 * back to its placeholder. That cost little while this form's only reachable refusal
 * was a name of nothing but spaces. A batch that wrote nothing is the refusal that says
 * to register again, and a form that has just dropped two of the three things it asks
 * to be sent again answers it wrongly. So `submit` hands the fields to the action
 * itself inside a transition, and that path resets nothing — read in the installed
 * react-dom rather than off the documentation: with the event's default prevented and
 * a transition started, its form-action listener passes `startHostTransition` a `null`
 * action, whose branch is a no-op where the other calls `requestFormReset` first, so
 * the action is not run twice either. **`action={formAction}` STAYS**: before this
 * component hydrates the handler does not exist, and what submits then is the server
 * action that prop renders — measured, a press before hydration without it became a
 * GET of this address carrying every field. The browser's own constraints still run
 * first, the action still binds through `useActionState` (#185), and a success still
 * leaves for the tool's page. `app/prs/[prId]/EditAndContinueForm.js` records the same
 * reset on a form whose submission carries state rather than fields, and why it is
 * left there.
 *
 * THE SUBMIT IS DISABLED WHILE PENDING, which is not a nicety: `withKeyLock`
 * serializes within one invocation only, so the frontend guard is the other half
 * of every duplicate-id argument in lib/ids.js.
 */
export default function ToolRegistrationForm({ tools, jobs, prefill }) {
    const [state, formAction, pending] = useActionState(registerToolItemsAction, null);
    const [toolName, setToolName] = useState(prefill.toolName);

    const typed = toolName.trim();
    const existingName = typed ? (matchExistingTool(typed, tools)?.toolName ?? null) : null;

    // See the header: the fields are read before the transition, and handing them to
    // the action here is what keeps them after a refusal. `action` stays for a press
    // that lands before this component hydrates.
    const submit = (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
    };

    return (
        <form action={formAction} onSubmit={submit}>
            {state?.error && <p role="alert">{state.error}</p>}

            <div>
                <label htmlFor="toolName">{COPY.nameLabel}</label>
                <input
                    id="toolName"
                    name="toolName"
                    required
                    autoComplete="off"
                    value={toolName}
                    onChange={(event) => setToolName(event.target.value)}
                />
                {typed !== "" && (
                    <p>
                        {existingName
                            ? COPY.matchesExisting(existingName)
                            : COPY.newTool(typed)}
                    </p>
                )}
            </div>

            <div>
                <label htmlFor="quantity">{COPY.quantityLabel}</label>
                <input
                    id="quantity"
                    name="quantity"
                    type="number"
                    required
                    min="1"
                    max={MAX_TOOL_ITEMS_PER_REGISTRATION}
                    defaultValue={String(prefill.quantity)}
                />
            </div>

            {/* One assignment is used without asking and several are chosen from —
                the two shapes the tools track settled, with no path that types a
                job. A person on no job never reaches this form; the page renders
                the refusal instead. */}
            <div>
                <label htmlFor="jobId">{COPY.jobLabel}</label>
                {jobs.length === 1 ? (
                    <>
                        <input type="hidden" name="jobId" value={jobs[0].id} />
                        <span id="jobId">{jobs[0].jobCode}</span>
                    </>
                ) : (
                    <select id="jobId" name="jobId" required defaultValue="">
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

            <button type="submit" disabled={pending}>
                {COPY.submit}
            </button>
        </form>
    );
}
