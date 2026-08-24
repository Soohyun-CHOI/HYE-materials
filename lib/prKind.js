// What kind of request this is, for the signer who has to decide it (#272).
//
// THREE KINDS BECAUSE THERE ARE THREE DECISIONS, and a signer meeting them on one
// list cannot currently tell them apart. An ordinary request asks whether to buy
// something; an overage request asks whether to accept an excess that has already
// arrived and been invoiced; a direct-purchase request asks whether to accept a
// purchase somebody already made. Approving is the same act in the app and a
// different act in the world, and until this the screen said nothing about which.
//
// BOTH EXCEPTIONAL KINDS ARE READ FROM A LINK, AND NEITHER IS STORED. An overage
// request is pointed at by `Delivery Items."Overage PR"`; a direct-purchase
// request by `Direct Purchases."Purchase Request"`. Airtable creates the symmetric
// field on `Purchase Requests` for each, `recordToPR` already carries both arrays,
// and so the kind costs nothing to read on any screen holding a mapped request.
//
// SO THERE IS NO `Kind` FIELD, AND THAT WAS THE DECISION RATHER THAN AN OVERSIGHT.
// A field would be a second home for a fact a link already states: it would have
// to be written by every path that ever creates one of these, nothing would fail
// if a future path forgot, and the request would then read as ordinary — the worst
// possible failure for a mark whose only job is to say "this one is not". The two
// links are written by the two actions that create these requests, in the same
// transaction, or the request is rolled back.
//
// WHAT THAT COSTS, STATED: the kind cannot be selected in a `filterByFormula`, and
// a request whose record was deleted by hand loses its kind. Neither is reachable
// through the app — `/prs` filters in the browser over rows it already holds, and
// this base does not delete records — and the day a direct-purchase request can be
// raised with no `Direct Purchases` row behind it is the day a field earns its
// place. Nothing today can produce one: the claim is the only door.
//
// ORDINARY IS SILENT. See PR_KIND_COPY.
//
// Pure and import-free, so `PRListClient` may hold it and the offline tier can pin
// it — the same reason lib/poUnsigned.js is.

export const PR_KIND = {
    /** Nothing has been bought. The signer is deciding whether to buy. */
    ordinary: "ordinary",
    /** #167 — material arrived beyond an order and was invoiced. */
    overage: "overage",
    /** #272 — a site bought it directly, with no order behind it. */
    directPurchase: "direct-purchase",
};

/**
 * Which kind a request is, from the two reverse-links it already carries.
 *
 * THE ORDER IS FIXED AND THE CHECK PINS IT. A request cannot be both in practice —
 * each is created by one action from one record — but "cannot happen" is not a
 * reason to leave the answer to declaration order. The overage link wins, because
 * an overage request is the one whose own page already carries a banner explaining
 * itself; a direct-purchase mark on it would be a second, contradicting story.
 */
export function prKind(pr) {
    if (pr?.overageDeliveryItemRowIds?.length) return PR_KIND.overage;
    if (pr?.directPurchaseRowIds?.length) return PR_KIND.directPurchase;
    return PR_KIND.ordinary;
}

export const PR_KIND_COPY = {
    /**
     * The mark beside a request's id, and `null` for the ordinary kind.
     *
     * SILENCE IS THE ANSWER FOR ORDINARY, NOT A GAP. A mark exists to say this
     * decision is not the usual one; a word on every row makes the exceptional rows
     * ordinary, which is the failure it exists to prevent. It is also #232's
     * judgment applied again — that issue deleted a caption whose only content was
     * "nothing unusual here" — and the strips' own rule one level down: a standing
     * all-clear is a thing people learn to skip. Nothing is missing when nothing
     * shows: the derivation runs on every row and answers `ordinary`.
     *
     * ONE STEM, TWO WORDS, and it is the set #235 had to learn: two chips that name
     * one axis must be one grammar, or a reader takes them for two axes. `Overage`
     * is what this repository already calls an excess — the field, the modules and
     * the strip say it — and `Direct purchase` is what actually happened, a site
     * ringing a vendor and buying. Neither borrows a table's noun from another
     * concept, and both name the RECORD the request came from, which is what the
     * mark is pointing at.
     *
     * NOT A `lib/deliveryStatus.js` TONE. Those four are one closed vocabulary for
     * how far something has got on an axis; this says what kind of thing a request
     * is. Reusing one would make a single word mean a stage on one screen and a
     * classification on another, which is the reason `exception` is not a chip tone
     * either. `docs/briefs/_shared.md` records it among the distinctions that are
     * not tones.
     */
    chip: {
        [PR_KIND.ordinary]: null,
        [PR_KIND.overage]: "Overage",
        [PR_KIND.directPurchase]: "Direct purchase",
    },

    /**
     * The sentence a signer reads on the request itself — direct purchase only.
     *
     * THE OVERAGE KIND DELIBERATELY HAS NONE, and that is not an omission to fill
     * in later. #167's banner is already at the top of that request, derived from
     * the delivery row, and it says more than a kind sentence could: how much
     * arrived beyond which order, on which delivery. A second sentence beside it
     * would be two voices for one fact — so the two kinds share one slot on the
     * page and differ only in what fills it.
     *
     * IT SAYS WHAT APPROVING MEANS, which is the whole reason this issue exists. A
     * signer's decision here is not whether to buy: the material is bought, the
     * vendor has invoiced, and what is being approved is the company accepting it.
     * Naming the vendor and their own document is what lets that be checked rather
     * than taken on trust.
     */
    signer: {
        [PR_KIND.directPurchase]: (f) => ({
            key: "kind-direct-purchase",
            text:
                `This request covers material bought directly from ${f?.vendorName ?? "the vendor"}, ` +
                "before any request existed" +
                `${f?.vendorInvoiceCode ? ` — ${f.vendorInvoiceCode} is the vendor's own invoice for it, quoted here` : ""}. ` +
                "Approving it accepts a purchase already made rather than authorizing a new one.",
        }),
    },
};
