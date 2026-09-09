"use client";

import { useActionState, useState } from "react";
import {
    MAX_TOOL_ITEMS_PER_REGISTRATION,
    TOOL_REGISTRATION_COPY as COPY,
    matchExistingTool,
    toolNameKey,
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
 * STRUCTURE a design needs: a labeled control per fact, one slot every refusal
 * arrives in, and the account of what was written as a list.
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
 * THE SUBMIT IS DISABLED WHILE PENDING, which is not a nicety: `withKeyLock`
 * serializes within one invocation only, so the frontend guard is the other half
 * of every duplicate-id argument in lib/ids.js.
 */
export default function ToolRegistrationForm({ tools, jobs }) {
    const [state, formAction, pending] = useActionState(registerToolItemsAction, null);
    const [toolName, setToolName] = useState("");
    // THE LOADED LIST GOES STALE THE MOMENT THIS FORM SUCCEEDS, AND THE STALENESS
    // WAS VISIBLE. Measured in a browser: registering `DEMO Impact Driver` left the
    // preview still reading that nobody had registered it, on the same screen and
    // one line above the id it had just minted. A preview being older than the base
    // is the arrangement — the write asks Airtable again — but a screen stating
    // something the reader has just disproved is not staleness, it is a falsehood.
    // The form stays put on purpose (its account is what a person prints from), so
    // the names it has itself registered are added here rather than refetched: a
    // `router.refresh()` would buy the same answer for two more Airtable operations
    // per registration.
    // ADJUSTED DURING RENDER RATHER THAN IN AN EFFECT, which is React's own
    // guidance for state derived from a previous render and is what
    // `react-hooks/set-state-in-effect` points at — an effect here re-renders in a
    // second pass for a value already in hand.
    const [registeredHere, setRegisteredHere] = useState([]);
    const justRegistered = state?.toolName;
    if (justRegistered && !registeredHere.includes(justRegistered)) {
        setRegisteredHere([...registeredHere, justRegistered]);
    }

    const typed = toolName.trim();
    const typedKey = typed ? toolNameKey(typed) : "";
    // One answer from two sources, and the same key behind both — the tools the
    // page loaded, and the ones this page has registered since.
    const existingName =
        (typed ? matchExistingTool(typed, tools)?.toolName : null) ??
        registeredHere.find((name) => toolNameKey(name) === typedKey) ??
        null;
    const registered = state?.toolItemIds;

    return (
        <form action={formAction}>
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
                    defaultValue="1"
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

            {/* The account of what was written, and it names every minted id
                because a `Tool Item ID` is printed onto a sticker — a count
                cannot be acted on. It arrives as the action's return value rather
                than through the URL, so a reload does not repeat it and a copied
                link shows a stranger nothing (#321). */}
            {registered && (
                <div role="status">
                    <p>
                        {COPY.registered({
                            toolName: state.toolName,
                            jobCode: state.jobCode,
                            toolItemIds: registered,
                        })}
                    </p>
                    {state.shortBy > 0 && (
                        <p>
                            {COPY.shortCount({
                                requested: state.requested,
                                created: registered.length,
                            })}
                        </p>
                    )}
                    <p>{COPY.ids}</p>
                    <ul>
                        {registered.map((toolItemId) => (
                            <li key={toolItemId}>{toolItemId}</li>
                        ))}
                    </ul>
                    {state.unloggedToolItemIds.length > 0 && (
                        <>
                            <p>{COPY.unlogged}</p>
                            <ul>
                                {state.unloggedToolItemIds.map((toolItemId) => (
                                    <li key={toolItemId}>{toolItemId}</li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>
            )}
        </form>
    );
}
