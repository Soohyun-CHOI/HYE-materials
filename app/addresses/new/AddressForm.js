"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ADDRESS_RETURN_COPY } from "@/lib/addressChoice";
import { createAddressAction } from "./actions";
import {
    ADDRESS_CREATION_COPY as COPY,
    ADDRESS_COUNTRIES,
    DEFAULT_COUNTRY,
    addressesOnJob,
    matchExistingAddress,
} from "@/lib/addressCreation";

/**
 * The address form (#384).
 *
 * IT IMPORTS `lib/addressCreation.js` AND NOTHING ELSE FROM `lib/`, which is
 * #162's rule: an import is an execution, so a `"use client"` file that reaches
 * `lib/airtable/` at any depth crashes in the browser rather than failing a lint
 * rule. That module is pure by construction and every word below comes out of it.
 *
 * THE TWO LISTS ARE THE PAGE'S, ALREADY LOADED, so the preview and the job's own
 * addresses cost no request per keystroke and no request per job picked.
 *
 * `addresses` GOES STALE THE MOMENT IT ARRIVES and that is the point of the
 * preview being a preview: the action asks Airtable under a lock and returns the
 * same sentence. What the browser can say is that a label matched something it
 * already knew about, which is what stops most second rows before a submit.
 *
 * AND A SUCCESSFUL CREATE REFRESHES, BECAUSE OTHERWISE THIS SCREEN CONTRADICTS
 * ITSELF — found in a browser rather than reasoned about. The action only
 * RETURNS, so nothing re-renders the page that loaded `addresses`: the first
 * create printed `Created Round Rock Compressor Station - Site on 26-DEMO-01.`
 * with `No address is recorded on 26-DEMO-01 yet.` still under it, one true line
 * and one false one on one screen. `router.refresh()` is #378's answer to exactly
 * that shape — it carries the returned message AND a fresh render, where a
 * `redirect()` would drop the message and a browser-held list would make the
 * panel a guess rather than what the base holds. It costs one re-render, which is
 * this page's 3 operations.
 *
 * THE FORM IS CLEARED IN THE SAME EFFECT, so `ready for another` is true rather
 * than a description of a form still holding the last one — and so the duplicate
 * preview does not immediately fire on the address just written, which is
 * correct and reads as an objection directly under a line saying it worked.
 */
export default function AddressForm({ myJobs, otherJobs, addresses, initialJobId, fromPrId }) {
    const [state, formAction, pending] = useActionState(createAddressAction, null);
    const [addressLabel, setAddressLabel] = useState("");
    const [jobId, setJobId] = useState(initialJobId || "");
    const router = useRouter();
    const formRef = useRef(null);

    // Keyed on the state object rather than on a boolean, so two creates in a row
    // each fire it — `useActionState` hands back a new object per submission.
    //
    // THE EFFECT SETS NO STATE, AND THAT IS THE LINT RULE APPLIED RATHER THAN
    // WORKED AROUND. `react-hooks/set-state-in-effect` refuses a `setState` here
    // and it is right to: clearing the label mirror belongs to the RESET, not to
    // the render that followed it. `form.reset()` dispatches a `reset` event, so
    // `onReset` below is where the mirror is cleared — which also means a
    // `<button type="reset">` added later would work without a second rule.
    useEffect(() => {
        if (!state?.addressLabel) return;
        formRef.current?.reset();
        router.refresh();
    }, [state, router]);

    // The two groups are the page's; this holds the flat list the chosen job is
    // resolved out of, so the grouping is a rendering rather than a second set.
    const allJobs = useMemo(() => [...(myJobs || []), ...(otherJobs || [])], [myJobs, otherJobs]);
    const job = allJobs.find((candidate) => candidate.id === jobId) ?? null;
    const taken = matchExistingAddress(addressLabel, addresses);
    const onJob = useMemo(() => addressesOnJob(job, addresses), [job, addresses]);

    return (
        <>
            {/* #385 — THE REQUEST THAT SENT THE READER HERE, AND THE WAY BACK.
                Both are always on screen while `?from=` is set rather than only
                after a create: somebody who finds the address already exists came
                for nothing and still has to get back. The draft was saved before
                they left, so `?draft=` returns them to everything they typed. */}
            {fromPrId && (
                <p className="mt-4 rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
                    <span className="text-zinc-600">{ADDRESS_RETURN_COPY.came(fromPrId)}</span>{" "}
                    <Link
                        href={`/prs/new?draft=${encodeURIComponent(fromPrId)}`}
                        className="underline"
                    >
                        {ADDRESS_RETURN_COPY.back(fromPrId)}
                    </Link>
                </p>
            )}

        <form
            ref={formRef}
            action={formAction}
            // The label is the one field React controls, so a DOM reset cannot
            // clear it — the mirror is cleared here instead. The JOB is
            // deliberately not: somebody recording two addresses for one site
            // should not have to pick it twice.
            onReset={() => setAddressLabel("")}
            className="mt-6 space-y-4"
        >
            {state?.error && (
                <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {state.error}
                </p>
            )}

            {state?.addressLabel && (
                <p className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
                    {COPY.created({ addressLabel: state.addressLabel, jobCode: state.jobCode })}
                </p>
            )}

            <div>
                <label htmlFor="addressLabel" className="block text-sm font-medium">
                    {COPY.labelLabel}
                </label>
                <input
                    id="addressLabel"
                    name="addressLabel"
                    required
                    value={addressLabel}
                    onChange={(e) => setAddressLabel(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
                />
                <p className="mt-1 text-xs text-zinc-500">{COPY.labelHint}</p>
                {/* The same sentence the action returns on a real collision, said
                    while there is still time to change the box above it — and
                    SUPPRESSED WHILE THE REFUSAL IS SAYING IT, which a browser found
                    rather than a check: submitting a taken label rendered the one
                    sentence twice, ten lines apart, the red box and this line at
                    once. One fact stated twice is the defect #233 spent an issue
                    separating on another screen. The comparison is against the
                    sentence rather than against `state.error` being set, so a
                    DIFFERENT refusal — a missing field, with a taken label still in
                    the box — keeps this line, where it is the only thing saying so. */}
                {taken && state?.error !== COPY.labelTaken(taken.addressLabel) && (
                    <p className="mt-1 text-xs text-amber-700">{COPY.labelTaken(taken.addressLabel)}</p>
                )}
            </div>

            <div>
                <label htmlFor="line1" className="block text-sm font-medium">
                    {COPY.streetLabel}
                </label>
                <input
                    id="line1"
                    name="line1"
                    required
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
                />
            </div>

            <div>
                <label htmlFor="line2" className="block text-sm font-medium">
                    {COPY.suiteLabel}
                </label>
                <input
                    id="line2"
                    name="line2"
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
                />
            </div>

            <div>
                <label htmlFor="city" className="block text-sm font-medium">
                    {COPY.cityLabel}
                </label>
                <input
                    id="city"
                    name="city"
                    required
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
                />
            </div>

            <div>
                <label htmlFor="state" className="block text-sm font-medium">
                    {COPY.stateLabel}
                </label>
                <input
                    id="state"
                    name="state"
                    required
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
                />
            </div>

            <div>
                <label htmlFor="zipCode" className="block text-sm font-medium">
                    {COPY.zipLabel}
                </label>
                <input
                    id="zipCode"
                    name="zipCode"
                    required
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
                />
            </div>

            <div>
                <label htmlFor="country" className="block text-sm font-medium">
                    {COPY.countryLabel}
                </label>
                {/* MAPPED FROM THE FIELD'S OWN LIST RATHER THAN TYPED, which is
                    `lib/units.js:CANONICAL_UNITS`' shape: these are Airtable option
                    names and not words this repository chooses, and no `typecast`
                    reaches the value, so one that is not an option fails the write
                    instead of inventing a third. */}
                <select
                    id="country"
                    name="country"
                    defaultValue={DEFAULT_COUNTRY}
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
                >
                    {ADDRESS_COUNTRIES.map((country) => (
                        <option key={country} value={country}>
                            {country}
                        </option>
                    ))}
                </select>
            </div>

            <div>
                <label htmlFor="jobId" className="block text-sm font-medium">
                    {COPY.jobLabel}
                </label>
                <select
                    id="jobId"
                    name="jobId"
                    value={jobId}
                    onChange={(e) => setJobId(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
                >
                    <option value="">{COPY.jobUnchosen}</option>
                    {/* `/prs/new`'s grouping, and its three labels. Every job is
                        offered and the reader's own are first — see the page's
                        header for why an assignment groups here rather than
                        gating. */}
                    {myJobs.length > 0 && (
                        <optgroup label={COPY.jobGroupMine}>
                            {myJobs.map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>
                                    {candidate.jobCode}
                                </option>
                            ))}
                        </optgroup>
                    )}
                    <optgroup label={myJobs.length > 0 ? COPY.jobGroupRest : COPY.jobGroupOnly}>
                        {otherJobs.map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                                {candidate.jobCode}
                            </option>
                        ))}
                    </optgroup>
                </select>
            </div>

            {/* #384 — THE FIRST READER OF `Addresses."Jobs"`, and the reason this
                screen shows anything at all beyond a form. Somebody sent here
                because the address they wanted was not in a picker is one keystroke
                from recording a second spelling of one the job already uses, so the
                job's own addresses are on the screen while they type. The empty
                case is a sentence rather than a silence: an absent list cannot be
                told apart from one that looked and found nothing. */}
            {job && (
                <div className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
                    {onJob.length === 0 ? (
                        <p className="text-zinc-600">{COPY.noneOnJob(job.jobCode)}</p>
                    ) : (
                        <>
                            <p className="text-zinc-600">{COPY.onJob(job.jobCode)}</p>
                            <ul className="mt-1 list-disc pl-5">
                                {onJob.map((address) => (
                                    <li key={address.id}>{address.addressLabel}</li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>
            )}

            <button
                type="submit"
                disabled={pending}
                className="w-full rounded bg-foreground px-3 py-2 text-background disabled:opacity-50"
            >
                {COPY.submit}
            </button>
        </form>
        </>
    );
}
