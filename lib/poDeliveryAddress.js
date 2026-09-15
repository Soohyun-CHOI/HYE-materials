// Where an order's material goes (#386) — the one link a purchase order freezes,
// and every word its page says about it.
//
// THE ORDER KEEPS WHAT THE REQUESTER SAID, WHICH IS THE WHOLE POINT AND ALSO THE
// ONE THING EASIEST TO UNDO. `Purchase Orders."Delivery Address"` is a frozen copy
// of `Purchase Requests."Delivery Address"` taken at generation, in the same
// operation and for the same reason as `Shipping Fee` and every `PO Items` value:
// the purchase order PDF prints a ship-to and a vendor was sent it, so a later
// edit to the job — or to the request — must not move what the document said.
//
// SO `orderDeliveryAddressId` READS THE REQUEST AND NOTHING ELSE, and the absence
// of a fallback is the rule rather than an omission. Before #385 the address was
// read off the JOB wherever anybody needed it, `lib/poPdf.js` included, and the
// obvious-looking repair to an order with no address — `?? job.deliveryAddress[0]`
// — puts that back: the document would then follow a job the requester never
// named, changing under a vendor who has already been emailed the PDF. A request
// with no address freezes nothing, and the order's page says so.
//
// WHICH REQUESTS THOSE ARE, AND WHY THEY ARE NOT A DEFECT. #385 required the link
// at submit and backfilled nothing, so every one of the 39 requests raised before
// it exists without one. Two of those could still reach generation — the only two
// `Approved` with no order — and this issue's own browser walk spent one of them:
// `HYE-PO-20260915-02` was generated from `HYE-PR-260911-04` and froze nothing,
// which is the state that walk existed to look at. `HYE-PR-260911-05` is the one
// left. Refusing generation there was weighed and rejected: full approval is what
// generates the order, inside `approveAction` as the last signer signs, so a
// refusal would strand a fully approved request with no order and no way forward
// — a dead end built out of a field its requester was never asked for, which is
// CLAUDE.md's own reading that a decision made before a request exists cannot be
// helped by a form inside one.
//
// PURE AND OFFLINE-SAFE. Nothing here reaches `lib/airtable/`, which is what lets
// `scripts/tests/offline/po-delivery-address.mjs` import it.

/**
 * The address id a generated order freezes, or null.
 *
 * ONE EXPRESSION, AND ITS VALUE IS THE NAME PLUS THE DOC ABOVE. The arithmetic is
 * trivial; what the function carries is that the request is the only source, which
 * is invisible at the call site once it is written as a member access there.
 */
export function orderDeliveryAddressId(pr) {
    return pr?.deliveryAddress?.[0] ?? null;
}

/**
 * Every word `/pos/[poId]` says about where this order goes.
 *
 * `label` IS `ADDRESS_CHOICE_COPY.label`'s WORD AND IS PINNED TO IT BY VALUE rather
 * than imported. That module is #385's rule for PICKING an address — two branches, a
 * grouped list, a resumed draft's derivation — and an order picks nothing, so
 * importing it here would make a screen about a frozen copy depend on a form's
 * module for one string. The check asserts the two are equal instead, which fails if
 * either screen is reworded alone; `offline/address-creation.mjs` pins `/addresses/new`
 * against `PRForm.js` the same way.
 *
 * `none` SAYS ONLY WHAT THE EM DASH CANNOT. The identity block already renders a
 * missing value as `—`, so restating "no delivery address" would be the fact twice.
 * What the dash cannot carry is the consequence — the document a vendor reads has no
 * ship-to either — and what to do about it, addressed to the reader who is about to
 * send it. That reader is on this page because sending the order is done from here.
 */
export const PO_ADDRESS_COPY = {
    label: "Delivery address",
    none:
        "The purchase order PDF shows no delivery address either. " +
        "Give the vendor the address separately.",
};
