// Where a request's material goes (#385) — how the form asks, what it offers,
// and every word it says.
//
// THE REQUEST STORES AN ADDRESS AND NOT A CHOICE, which is the sentence the rest
// of this module follows from. `Purchase Requests."Delivery Address"` is one link
// whether the requester took the job's default or picked another, so the two
// branches are a way of PICKING rather than a distinction the base keeps. That is
// why nothing here is written to a field, why a resumed draft has to derive which
// branch it was, and why the action validates an id instead of re-deciding a
// branch — see `addressChoiceFromStored` below.
//
// WHY THE BRANCH EXISTS AT ALL, since one picker with the default preselected
// would store the same link. The common case is the job's usual place, and a
// branch turns that into one glance instead of a scan of every address on the
// base. It is also what answers "what narrows the list": a requester using the
// default never opens it.
//
// AND THE BRANCH COLLAPSES WHERE THERE IS NOTHING TO DEFAULT TO. No job on this
// base holds a `Delivery Address` and no screen in this app sets one, so a job
// with no default is the ordinary state rather than an edge — a two-way question
// whose first answer is unreachable would be a screen drawing a distinction its
// data cannot make, which is what #384 took off `/pos/[poId]`. With no default
// the picker is simply shown, and the copy says why.
//
// THE LIST IS EVERY ADDRESS, GROUPED, AND NOT THE JOB'S ALONE. Borrowing a place
// another job already uses is the case this whole chain started from, so offering
// only `addressesOnJob` would leave a requester recording a second row for a
// place that already has one — #384's own defect, one screen over. Grouping is
// the narrowing, in `/prs/new`'s own `My Jobs` / `All Jobs` shape.
//
// PURE AND OFFLINE-SAFE. It imports `./addressCreation.js` for `addressesOnJob`
// with the extension spelled out (#19's precedent), and that module is pure too.
// Nothing here reaches `lib/airtable/`, so `PRForm.js` can import it — an import
// is an execution, and a credentialed module in a `"use client"` file is a
// browser crash rather than a lint error.
//
// EVERY STRING THE CONTROL RENDERS IS IN `ADDRESS_CHOICE_COPY` AND NONE IS IN
// JSX, so the vocabulary checks and `scripts/screen-strings.mjs` can read them.
// `Street address` is `lib/addressCreation.js`'s business; nothing here spells a
// field name at all.

import { addressesOnJob } from "./addressCreation.js";

/**
 * Which addresses the picker offers, in two groups.
 *
 * `addressesOnJob` IS CALLED RATHER THAN COPIED, and this is its second caller —
 * #384 wrote it for the create screen's duplicate panel and left no move
 * condition beside it. The condition is written now: **a third caller, or a
 * caller that wants the job's addresses WITHOUT the create screen's framing,
 * moves it to a module named for the question rather than for the screen.** Two
 * callers under a name that still describes what it computes is not drift; what
 * would be is a second implementation of "which addresses does this job use",
 * since that answer is a union of two links and getting it wrong is silent.
 *
 * THE SECOND GROUP HOLDS EVERY OTHER ADDRESS, VENDOR ADDRESSES INCLUDED, and
 * that is a decision rather than an oversight. `Addresses` holds two kinds of
 * place — somewhere we ship TO and somewhere a vendor IS — and filtering the
 * second out would need a rule no other screen states, while hiding an answer a
 * requester may actually want: collecting from a supplier's counter is ordinary
 * on this axis. Nothing is hidden and the grouping does the work.
 *
 * THE CONDITION FOR A SEARCHABLE CONTROL, measurable rather than a matter of
 * taste: when the second group no longer fits a screen — about twenty rows — the
 * shape to take is `app/admin/disciplines/new/JobCombobox.js`, which is this
 * app's answer to a picker too long to scan. Three addresses today.
 */
export function addressOptions(job, addresses) {
    const onJob = addressesOnJob(job, addresses);
    const onJobIds = new Set(onJob.map((address) => address.id));
    const others = (addresses || [])
        .filter((address) => !onJobIds.has(address.id))
        .sort((a, b) => (a.addressLabel || "").localeCompare(b.addressLabel || "", "en-US"));
    return { onJob, others };
}

/** The job's default address, or null. One expression, because three call sites ask. */
export function jobDefaultAddressId(job) {
    return job?.deliveryAddress?.[0] ?? null;
}

/**
 * Which branch a stored address came back as, for a resumed draft.
 *
 * THE STORED LINK CANNOT SAY WHICH BRANCH WROTE IT, and that is correct rather
 * than lossy: a requester who opened the picker and chose the job's default
 * anyway recorded the same fact as one who took the default branch. So this reads
 * the address against the job's default and reports the branch that DISPLAYS it
 * truthfully, which is all a resumed form needs.
 *
 * A stored address that is no longer the job's default comes back as a pick,
 * which is also right: the request still says where its material goes, and the
 * job having moved on does not change that.
 */
export function addressChoiceFromStored({ storedAddressId, defaultAddressId }) {
    if (storedAddressId && storedAddressId === defaultAddressId) {
        return { useJobDefault: true, pickedAddressId: "" };
    }
    if (storedAddressId) return { useJobDefault: false, pickedAddressId: storedAddressId };
    // Nothing stored: a draft saved before an address was picked. The default
    // branch is offered when there is one to offer, because that is the answer
    // most requests want and preselecting it costs the requester nothing to
    // change.
    return { useJobDefault: Boolean(defaultAddressId), pickedAddressId: "" };
}

/**
 * The address id a submission carries, from the branch and the picker.
 *
 * ONE FUNCTION, AND THE FORM IS ITS ONLY CALLER ON PURPOSE. The action does not
 * re-derive the branch, because there is no branch to re-derive: what arrives is
 * an address id and what the action owes is a refusal when it is missing and a
 * check that it names a real row. Re-deriving would also make the write depend on
 * a job's default as it stands at SUBMIT rather than as the requester saw it —
 * which is `Purchase Orders."Sent To"`'s reading, that a record of what the app
 * did beats a re-read of terms that may have moved.
 */
export function chosenAddressId({ useJobDefault, defaultAddressId, pickedAddressId }) {
    if (useJobDefault) return defaultAddressId || "";
    return pickedAddressId || "";
}

/**
 * Every word the delivery-address control renders.
 *
 * SECOND PERSON, addressing the requester filling the form — `ALLOCATION_COPY.
 * preview`'s voice and `ADDRESS_CREATION_COPY`'s.
 */
export const ADDRESS_CHOICE_COPY = {
    label: "Delivery address",

    // The two branches. The first NAMES the address rather than referring to it,
    // so the reader is choosing between two places instead of between a place and
    // a word — and it is one builder rather than a label plus a separator the
    // form would have to spell in JSX, where no vocabulary check can read it.
    //
    // NOT `useDefault` AND `useOther`, WHICH IS A LINT RULE RATHER THAN A WORDING
    // CALL AND IS WORTH THE LINE. A key beginning with `use` is a React HOOK name,
    // so `ADDRESS_CHOICE_COPY.useDefault(label)` in a component is a conditional
    // hook call as far as `react-hooks/rules-of-hooks` can tell — measured, it
    // fails `npx eslint .` outright. The keys are named for the thing chosen
    // instead, which is what they should have said anyway.
    jobDefault: (addressLabel) => `Use this job's default address — ${addressLabel}`,
    otherAddress: "A different address",

    // THE SENTENCE FOR THE ORDINARY STATE ON THIS BASE. It says what is true of
    // the JOB rather than what the requester did wrong, because they have done
    // nothing wrong — no screen in this app sets a job's default address.
    noDefault: "This job has no default address, so pick where this request goes.",

    pickerUnchosen: "Pick an address",
    groupOnJob: "Addresses on this job",
    groupOthers: "All addresses",

    // The way out to `/addresses/new`, and the label is the whole of what makes
    // the act honest: the draft is saved first, so a requester who leaves
    // half-finished comes back to what they typed. A control reading `Add an
    // address` would be a link that silently discards a form.
    addAddress: "Save draft and add an address",
    addAddressHint:
        "Your draft is saved first, so you come back to everything you have typed.",

    // The refusal, at submit only — a draft saves without one, which is every
    // other required field's shape on this form (#72).
    required: "Pick a delivery address.",
    // An id that names no address. Unreachable from the screen, and a Server
    // Action is directly callable.
    unknown: "That address no longer exists. Pick one from the list.",
};

/**
 * Every word `/addresses/new` says when a request sent the reader there (#385).
 *
 * IT LIVES HERE RATHER THAN IN `lib/addressCreation.js` because the sentence is
 * about the REQUEST — where the reader came from and what is waiting for them —
 * and that module's subject is creating an address. #181's file-name test, read
 * before the copy was written rather than after.
 */
export const ADDRESS_RETURN_COPY = {
    came: (prId) => `${prId} is waiting for this address.`,
    back: (prId) => `Back to ${prId}`,
};
