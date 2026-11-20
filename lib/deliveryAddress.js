// Where a delivery actually arrived (#387) — the default the entry form offers,
// which addresses a delivery may stand at and how a recorded one's is corrected
// (#680), and every word both screens say about it.
//
// A DELIVERY'S ADDRESS IS ONE OF ITS JOB'S (#680), at entry and when it is
// corrected, because a job's stock is counted at it (#675): an address that is not
// the job's would put the job's material where none of its screens can say why.
// The job's addresses are `lib/jobAddresses.js:addressesOnJob`, the union the
// request form groups by; the request form still offers every address, because a
// request says where material is to GO and may name a supplier's counter.
//
// CORRECTING ONE IS A FIX TO THE RECORD, NOT A MOVE (#680). #387 left the field
// write-once on the ground that moving a recorded delivery moves stock, and a stock
// movement with no record of itself was undesigned. #680 settles it: a wrong
// address is corrected in place — the stock follows, since it is read off the
// delivery — with a row on the delivery's activity saying who moved it from where,
// and refused when the address it leaves would go below zero. Material that really
// moved after it was delivered is #677's sending and receiving, which leaves the
// delivery where it was.
//
// IT IS A SEPARATE FACT FROM WHERE THE MATERIAL WAS ORDERED TO, which is the whole
// reason the field exists. #386 froze the requester's address onto the order, so
// the order says where it was MEANT to go; a delivery says where it turned up.
// Usually those agree, which is why the order's address is the default rather than
// a blank — but the recorder is standing in front of the pallet and the order is
// not, so the control is theirs to change.
//
// THE DEFAULT IS WHAT THE ORDERS AGREE ON, AND NOTHING ELSE. One delivery can
// attach to several orders: `planDelivery` fills oldest-order-first across every
// candidate ordered item for a (job, vendor, material), and two MATERIALS on one
// packing list are planned independently and land wherever their own orders are.
// So there may be one address, several, or none, and this function reports which
// without choosing between rivals. #231's invoice pairing took the same posture on a
// tie, in amber on this form, until #640 removed it.
//
// IT DOES NOT FALL BACK TO THE JOB'S DEFAULT ADDRESS, and that is the decision
// worth stating because the fallback costs nothing and looks like a kindness.
// Three things against it. A delivery address is a claim about where material
// PHYSICALLY ARRIVED, and a job's default is a habit rather than evidence.
// Inventory is counted per address from here on, so a prefilled guess a busy
// recorder accepts puts stock in the wrong place and leaves nothing on screen to
// say so. And reading a job's address live is exactly what #384, #385 and #386
// spent three issues removing — `Jobs."Delivery Address"` is a form default on
// `/prs/new` and nothing else now. What replaces the convenience is the picker's
// own grouping: `addressOptions` puts the job's own addresses first, so the usual
// place is one click away without the app asserting it.
//
// PURE AND OFFLINE-SAFE. Nothing here reaches `lib/airtable/`, which is what lets
// `DeliveryForm.js` import it and the offline tier pin it; the correction's reads
// and writes are `lib/deliveryAddress.server.js`.

import { ADDRESS_CHOICE_COPY } from "./addressChoice.js";
import { addressesOnJob } from "./jobAddresses.js";

/**
 * The address a delivery should open on, from the ordered items its plan attaches
 * rows to.
 *
 * Takes the ORDERED ITEMS rather than the orders, because that is what the plan
 * produces and what both the form and the action already hold. One order
 * contributes once however many of its ordered items the delivery touched.
 *
 * `empty` IS A STATE AND NOT AN ERROR: the form asks before anything is picked,
 * and a control with no sentence under it is what "the app has nothing to claim
 * yet" looks like.
 *
 * AN ORDER WITH NO ADDRESS NEITHER AGREES NOR DISAGREES. It is excluded from the
 * rival test and counted in `partly`, because "this order says nothing" is not a
 * second opinion — and on this base 34 of 35 orders say nothing, so treating
 * silence as disagreement would make every mixed delivery read as a conflict.
 *
 * AN AGREED ADDRESS THAT IS NOT ONE OF THE JOB'S IS NO DEFAULT (#680), and is
 * `not-on-job` instead: a request may name any address — a supplier's counter, a
 * place another job uses — and its order freezes it, while a delivery stands at one
 * of its job's. `jobAddressIds` is that set; with none given, every address is.
 */
export function deliveryAddressDefault(orderedItems, jobAddressIds = null) {
    const addressByOrder = new Map();
    for (const item of orderedItems || []) {
        if (!item?.poRecordId) continue;
        if (!addressByOrder.has(item.poRecordId)) {
            addressByOrder.set(item.poRecordId, item.deliveryAddressRecordId ?? null);
        }
    }

    const orderCount = addressByOrder.size;
    if (orderCount === 0) return { state: "empty", addressId: null, orderCount: 0, partly: false };

    const named = [...new Set([...addressByOrder.values()].filter(Boolean))];
    if (named.length === 0) {
        return { state: "no-order-address", addressId: null, orderCount, partly: false };
    }
    if (named.length > 1) {
        return { state: "disagree", addressId: null, orderCount, partly: false };
    }
    if (jobAddressIds && !new Set(jobAddressIds).has(named[0])) {
        return { state: "not-on-job", addressId: null, orderCount, partly: false };
    }
    return {
        state: "agreed",
        addressId: named[0],
        orderCount,
        partly: [...addressByOrder.values()].some((id) => !id),
    };
}

/**
 * Every word this control says that is not already `ADDRESS_CHOICE_COPY`'s.
 *
 * THE LABEL, THE PLACEHOLDER AND BOTH REFUSALS ARE IMPORTED RATHER THAN RE-COINED.
 * `/prs/new` asks the same question about the same table and `lib/addressChoice.js`
 * already owns those strings; a second wording would be two words for one fact the
 * first time either was reworded. The two group headings are that form's alone since
 * #680, which narrowed this list to the job's addresses and left one group. What is
 * NEW here is the sentences about where the default came from, because that question
 * does not arise on a form whose default is the job's, and #680's: a job with no
 * address, the way to add one, and the refusal of an address that is not the job's.
 *
 * THE GRAY/AMBER SPLIT IS THIS SCREEN'S OWN GRAMMAR, inherited rather than invented:
 * gray reports what the app did, amber asks a person to check something. #231's
 * pairing box used the identical split until #640 removed it, and `partly` and
 * `disagree` are amber for the reason its tie-break was — they are the two cases where
 * the app has an answer it is not sure of.
 *
 * NO KEY BEGINS WITH `use`: `COPY.useX()` in a component reads as a conditional HOOK
 * call to `react-hooks/rules-of-hooks` and fails `npx eslint .` outright. See
 * docs/notes/naming.md, and `ADDRESS_CHOICE_COPY` for where that was measured.
 */
export const DELIVERY_ADDRESS_COPY = {
    // Gray. It names no order id: with several orders that would be a list, and the
    // allocation preview directly above already names every one of them.
    taken: (orderCount) =>
        orderCount === 1
            ? "Taken from the order this delivery attaches to."
            : "Taken from the orders this delivery attaches to.",

    // Amber, appended to `taken`. The app has an address and a gap in the evidence,
    // which is the one shape where it should say what it is standing on.
    partly: "Some of these orders record no address, so check the material was delivered there.",

    // Gray. It says what is true of the ORDER rather than what the recorder did
    // wrong — `ADDRESS_CHOICE_COPY.noDefault`'s voice, one screen over — because
    // they have done nothing wrong: 34 of the 35 orders on this base record none.
    noOrderAddress: (orderCount) =>
        orderCount === 1
            ? "The order this delivery attaches to records no delivery address, so pick where the material was delivered."
            : "None of the orders this delivery attaches to records a delivery address, so pick where the material was delivered.",

    // Amber. Nothing is preselected, because picking one of two rivals is the guess
    // this module exists not to make.
    disagree:
        "These items were ordered to different addresses, so pick where the material was delivered.",

    // Gray, #680. The orders agree on an address that is not the job's, so nothing is
    // preselected — `noOrderAddress`'s voice: it says what is true of the ORDERS, and
    // the recorder has done nothing wrong.
    notOnJob: (orderCount) =>
        orderCount === 1
            ? "The order this delivery attaches to names an address that is not one of this job's, so pick where the material was delivered."
            : "The orders this delivery attaches to name an address that is not one of this job's, so pick where the material was delivered.",

    // #680 — a job with no address takes no delivery, since a delivery stands at one of
    // its job's. Said under the job as soon as it is picked, before anything is typed,
    // with the way to add one. The correction says it of a job with no OTHER address.
    noJobAddress: (jobCode) => `${jobCode} has no address yet, so no delivery can be recorded on it.`,
    addAddress: "Add an address to this job",

    // #680 — the refusal for an address that is not the job's. Unreachable from either
    // screen, whose lists hold the job's alone, and a Server Action is directly callable.
    offJob: "That address is not one of this job's. Pick one from the list.",
};

/** Where the address form opens on a job, so a reader adding the job's first address lands on it. */
export function addAddressPath(jobCode) {
    return `/addresses/new?job=${encodeURIComponent(jobCode ?? "")}`;
}

/**
 * The addresses a recorded delivery's address may be corrected to (#680): its job's, less the
 * one it stands at — the same answer the entry form offers, asked of the same function.
 */
export function correctionOptions(job, addresses, standingAddressId) {
    return addressesOnJob(job, addresses).filter((address) => address.id !== standingAddressId);
}

/**
 * Why a correction is refused before anything is read again, as a key of
 * `correctionRefusalText`, or null: no address picked, one that names no row, a page drawn
 * before the delivery's address changed, the address it already stands at, or one that is not
 * the job's. A closed job and a count below zero are the server's to ask
 * (`lib/deliveryAddress.server.js`), off what it reads.
 *
 * `shownAddressId` IS WHAT THE PAGE WAS DRAWN WITH, so two corrections from two open pages cannot
 * both say they moved the delivery from the same place: the second finds the delivery somewhere
 * else and is refused as out of date (#378's refusal, which refreshes as it refuses).
 */
export function correctionRefusal({ job, addresses, standingAddressId, shownAddressId, chosenAddressId }) {
    if (!chosenAddressId) return "required";
    if (!(addresses ?? []).some((address) => address.id === chosenAddressId)) return "unknown";
    if ((shownAddressId ?? "") !== (standingAddressId ?? "")) return "moved";
    if (chosenAddressId === standingAddressId) return "same";
    if (!addressesOnJob(job, addresses).some((address) => address.id === chosenAddressId)) return "off-job";
    return null;
}

/**
 * Every word the correction says that is not already another constant's (#680). The label is
 * `ADDRESS_CHOICE_COPY.label`, and the refusals for no address, an unknown one and one off the job
 * are the entry form's, so a refusal reads the same whichever screen made it.
 */
export const DELIVERY_ADDRESS_CORRECTION_COPY = {
    lead: "Correct this if the delivery was recorded at the wrong address. What it delivered is counted where it stands, so its stock moves with it.",
    standsOffJob: (addressLabel) => `${addressLabel} is not one of this job's addresses.`,
    noOther: (jobCode) => `${jobCode} has no other address to correct this delivery to.`,
    submit: "Correct address",
    busy: "Correcting…",
    refusals: {
        same: "This delivery is already at that address. Pick a different one.",
        moved: "This delivery's address was changed since this page was opened. Nothing was changed — here it is as it stands now.",
        "below-zero": (names, addressLabel) =>
            `Correcting this delivery's address would take ${names} at ${addressLabel} below zero, because some of it has been issued there. ` +
            "The address was not changed.",
        failed: "Something went wrong correcting this delivery's address. Nothing was changed — please try again.",
    },
};

/** A correction's refusal in words: the key `correctionRefusal` or the server returned. */
export function correctionRefusalText(refusal, { names = "", addressLabel = "" } = {}) {
    if (refusal === "required") return ADDRESS_CHOICE_COPY.required;
    if (refusal === "unknown") return ADDRESS_CHOICE_COPY.unknown;
    if (refusal === "off-job") return DELIVERY_ADDRESS_COPY.offJob;
    if (refusal === "below-zero") return DELIVERY_ADDRESS_CORRECTION_COPY.refusals["below-zero"](names, addressLabel);
    return DELIVERY_ADDRESS_CORRECTION_COPY.refusals[refusal] ?? DELIVERY_ADDRESS_CORRECTION_COPY.refusals.failed;
}
