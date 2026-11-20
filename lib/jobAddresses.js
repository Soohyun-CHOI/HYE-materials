// The addresses a job uses (#384) — one question, asked by four screens since #680: the address
// form's list of the job's own (#384), the request form's first group (#385), and the delivery
// forms, where it is the whole list a delivery's address is chosen from, at entry and when it is
// corrected (#680).
//
// MOVED HERE FROM `lib/addressCreation.js` WHEN ITS MOVE CONDITION FIRED (#680). That module is
// named for the create screen, and the condition written beside this function there was a third
// caller, or one wanting the answer without that screen's framing — then it belongs in a module
// named for the question. The delivery forms are both: the third caller, and the first that uses
// the answer as a RULE rather than as a list to scan.
//
// PURE AND OFFLINE-SAFE, and it imports nothing: the address form, the request form and the
// delivery form are all `"use client"`, and an import is an execution.

/**
 * The addresses one job uses, out of a loaded list, by label.
 *
 * THE UNION OF TWO LINKS, AND TAKING THE UNION IS WHAT REMOVES AN INVARIANT RATHER THAN ADDING
 * ONE. A job reaches an address two ways: `Addresses."Jobs"` names every job that uses it, and
 * `Jobs."Delivery Address"` names the one that is the default. The obvious alternative was to
 * require the default to be a member of the set and enforce that in the app — which is a rule with
 * no schema behind it, no writer (nothing in the app writes a job's default address), and a silent
 * failure mode: a default missing from the set is exactly the address this list has to show, since
 * it is the one a requester is most likely to retype. Reading both links asks no one to keep
 * anything in step.
 *
 * NO MARK ON THE DEFAULT, DELIBERATELY. The address form lists these so a person does not type a
 * fifth spelling of a place that already has a row, and which of them is the job's default does
 * not change that. The word for the default belongs to the request form, where a requester chooses
 * between the default and a different one.
 *
 * SORTED BY LABEL, CASE-INSENSITIVELY, because the list is scanned rather than ranked and the label
 * is the only thing on each row.
 */
export function addressesOnJob(job, addresses) {
    if (!job) return [];
    const defaultIds = new Set(job.deliveryAddress || []);
    return (addresses || [])
        .filter((address) => defaultIds.has(address.id) || (address.jobs || []).includes(job.id))
        .sort((a, b) => (a.addressLabel || "").localeCompare(b.addressLabel || "", "en-US"));
}

/** Whether an address is one of a job's, by `addressesOnJob`'s answer and no second reading of it. */
export function isAddressOnJob(job, addresses, addressRecordId) {
    return Boolean(addressRecordId) && addressesOnJob(job, addresses).some((address) => address.id === addressRecordId);
}
