// Where a delivery actually arrived (#387) — the default the entry form offers,
// and every word it says about it.
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
// without choosing between rivals — the same posture `lib/deliveryInvoiceMatch.js`
// takes on a tie, which this form already renders in amber.
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
// `DeliveryForm.js` import it and the offline tier pin it.

/**
 * The address a delivery should open on, from the ordered items its plan attaches
 * rows to.
 *
 * Takes the ORDERED ITEMS rather than the orders, because that is what the plan
 * produces and what both the form and the action already hold — the same reason
 * `describeDeliveryPairings` takes planned rows. One order contributes once
 * however many of its ordered items the delivery touched.
 *
 * `empty` IS A STATE AND NOT AN ERROR: the form asks before anything is picked,
 * and a control with no sentence under it is what "the app has nothing to claim
 * yet" looks like. `lib/deliveryInvoiceMatch.js` makes the same call one control
 * up, where the pairing box is simply absent.
 *
 * AN ORDER WITH NO ADDRESS NEITHER AGREES NOR DISAGREES. It is excluded from the
 * rival test and counted in `partly`, because "this order says nothing" is not a
 * second opinion — and on this base 34 of 35 orders say nothing, so treating
 * silence as disagreement would make every mixed delivery read as a conflict.
 */
export function deliveryAddressDefault(orderedItems) {
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
 * THE LABEL, THE GROUP HEADINGS AND BOTH REFUSALS ARE IMPORTED RATHER THAN RE-COINED.
 * `/prs/new` asks the same question about the same table and `lib/addressChoice.js`
 * already owns those six strings; a second wording would be two words for one fact
 * the first time either was reworded. What is NEW here is only the three sentences
 * about where the default came from, because that question does not arise on a form
 * whose default is the job's.
 *
 * THE GRAY/AMBER SPLIT IS THIS SCREEN'S OWN GRAMMAR, inherited rather than invented:
 * gray reports what the app did, amber asks a person to check something. The pairing
 * box above these fields uses the identical split, and `partly` and `disagree` are
 * amber for the same reason a tie-break is — they are the two cases where the app
 * has an answer it is not sure of.
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
};
