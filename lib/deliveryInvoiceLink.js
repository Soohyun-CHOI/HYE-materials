// The invoice-to-delivery pairing (#210) — which bills a delivery may name, what
// the dropdown calls them, and why one is refused.
//
// THE OFFICE RULE IS NOW A FIELD. `Invoices."Delivery"` is n:1 — one invoice names
// one shipment, one shipment can carry several invoices — which is the containment
// premise #166 could only state in prose written down where the data can hold it.
// Everything this module owns follows from that asymmetry: the SINGLE side is the
// one that can be taken, so a refusal is always about an invoice and never about a
// delivery.
//
// SINGLE-RECORD IS ENFORCED HERE, NOT BY THE SCHEMA. The Metadata API refuses
// `prefersSingleRecordLink` on field CREATE and on field UPDATE alike (422,
// measured in #167 and re-measured when this field was created), so the Airtable
// field is multi and this app is what keeps it to one — exactly as
// `Invoice Items."PO Item"` and `Delivery Items."Overage PR"` already are. That is
// why `linkedDelivery` below flattens rather than trusting, and why the invariant
// is a property of the stored rows rather than of the field.
//
// SET FROM THE DELIVERY SIDE, WHICH IS THE ORDER THE DOCUMENTS ARRIVE IN. The
// vendor emails the invoice when the material ships, so the bill is normally on
// hand FIRST and the packing list that comes with the material carries its number.
// So the recorder pairs them, at entry or later on the delivery's own edit page —
// never on the invoice, where the office would have to know which shipment a
// number belongs to.
//
// WHY A DROPDOWN AND NOT THE NUMBER TYPED IN. #211 opened the invoice routes to
// anyone who may see the order behind an invoice item, so a site recorder can
// already read their own job's invoices; before that a picker would have had to
// show invoice IDs to someone barred from the invoice list, and typing was the
// only shape that disclosed nothing. With that barrier gone the dropdown is
// strictly better: it cannot be mistyped and it cannot name an invoice that does
// not exist. What it still cannot do is invent one — see LINK_COPY.emptyList.
//
// Pure and dependency-free, because the entry form imports it: an import is an
// execution, so a module that reaches lib/airtable/ crashes the browser bundle
// (lib/deliveryCandidates.js is the measured case). The credentialed half — the
// gated read of the candidates and the guarded write — is
// lib/deliveryInvoiceCandidates.js.

/** Why an invoice cannot be paired with this delivery. Keys, so a reworded message fails nothing. */
export const LINK_REFUSED = {
    notFound: "not-found",
    wrongVendor: "wrong-vendor",
    takenByAnother: "taken-by-another",
    outOfScope: "out-of-scope",
};

/**
 * The one delivery an invoice names, flattened.
 *
 * THE WHOLE OF THE SINGLE-RECORD ENFORCEMENT ON THE READ SIDE. The field is multi
 * in Airtable because nothing can make it otherwise, so every reader takes the
 * first entry and no reader iterates: a second link could only arrive by hand, and
 * treating it as meaningful would spread one hand edit into two contradictory
 * answers on two screens.
 */
export function linkedDelivery(invoice) {
    return (invoice?.delivery || [])[0] ?? null;
}

/**
 * May this invoice be paired with this delivery — and if not, why.
 *
 * ORDER MATTERS, and it is the order in which a reader can act on the answer.
 * `out-of-scope` is tested before anything about the invoice's content, because a
 * caller who may not see the record must not learn from the refusal whether its
 * vendor matches; `taken-by-another` comes last, because it is the only refusal
 * that is about a decision somebody already made rather than about a mistake.
 *
 * ALREADY NAMING **THIS** DELIVERY IS NOT A REFUSAL. Re-submitting the same
 * pairing is what a double-click and a re-saved edit form both do, so it has to be
 * a no-op rather than an error — the same posture `upsertMaterial` takes.
 *
 * `visible` is the caller's answer from lib/invoiceVisibility.js, passed in rather
 * than computed: the row-visibility rule is `canViewPR` and this module must not
 * grow a second one.
 *
 * `visible` IS REQUIRED, AND OMITTING IT THROWS. The first version tested
 * `visible === false`, so as not to confuse "refused" with "not asked" — which made
 * a caller who forgot the argument pass the gate, and a permission check whose
 * DEFAULT is admit is the wrong direction whatever its reason. Nothing asserted
 * that the one caller passed it, so the safety of that shape rested on a fact no
 * check could see.
 *
 * A THROW RATHER THAN A SOURCE-SHAPE ASSERTION, and the choice is
 * verification.md's own: "source shape is not execution — a gate inside `if (false)`
 * satisfies a structural check". An AST check over call sites cannot see an indirect
 * call and cannot judge the value passed either; a throw is a property of the
 * function, exercised by the offline tier rather than inspected. It is also the call
 * `lib/airtableFormula.js:orByField` already makes for a caller bug — "a caller
 * passing one is a bug and a throw says so at the call". A missing argument here is
 * a programming error, not a state a user can reach, so a 500 is the honest report;
 * every state a user CAN reach is one of the four keys below.
 *
 * CHECKED BEFORE ANYTHING ELSE, including whether the invoice exists. The argument
 * contract is not conditional on the answer, and a caller that resolved no invoice
 * still knows what it asked (`checkInvoicePairing` passes `false` there).
 *
 * WHAT THE THROW DOES NOT PROVE: that the value is right. A caller passing
 * `visible: true` unconditionally satisfies it, and nothing here could tell. That
 * is the credentialed tier's and the browser's to establish, which is why
 * `offline/invoice-visibility.mjs` pins that the one caller reaches
 * `getVisibleInvoiceIds` at all.
 */
export function invoiceLinkRefusal({ invoice, deliveryRecordId, vendorRecordId, visible } = {}) {
    if (typeof visible !== "boolean") {
        throw new Error(
            "invoiceLinkRefusal: `visible` is required and must be a boolean — the caller's " +
                "answer from lib/invoiceVisibility.js. It used to default to admitting, which " +
                "made a forgotten argument a passed gate (#210)."
        );
    }
    if (!invoice) return LINK_REFUSED.notFound;
    if (!visible) return LINK_REFUSED.outOfScope;
    // A bill from another supplier cannot describe this shipment, and the vendor is
    // not editable on a delivery, so this can only be a wrong pick.
    if (vendorRecordId && (invoice.vendor || [])[0] !== vendorRecordId) {
        return LINK_REFUSED.wrongVendor;
    }
    const held = linkedDelivery(invoice);
    if (held && held !== deliveryRecordId) return LINK_REFUSED.takenByAnother;
    return null;
}

/**
 * The invoices offerable for one delivery, narrowed to its vendor.
 *
 * VENDOR IS THE WHOLE NARROWING, AND NOT THE JOB. An invoice can bill orders on
 * more than one job (lib/airtable/invoices.js on the join table), so narrowing by
 * job could hide the right bill; narrowing by vendor cannot, because a delivery
 * has exactly one vendor and a bill from another supplier is never the answer. The
 * viewer's own scope is already applied by the caller through
 * lib/invoiceVisibility.js, so this is a semantic filter rather than a gate.
 *
 * AN ALREADY-PAIRED INVOICE STAYS ON THE LIST, and that is #162's decision applied
 * a second time. Its item dropdown is deliberately WIDER than the candidate set —
 * a fully delivered item is listed, saying `fully delivered`, because dropping it
 * would land the recorder on "not in the dropdown", which says it may never have
 * been ordered here and would be false. The same is true of an invoice somebody
 * has already paired: it exists, it is this vendor's, and the recorder holding a
 * packing list that names it needs to be told where it went rather than shown a
 * gap. So it is listed, unselectable, naming the delivery that holds it.
 *
 * Sorted NEWEST FIRST by `Issue Date`, matching the invoice list's own order, with
 * `Invoice ID` breaking ties — the same monotonic-within-a-day key #164 made that
 * list use. An undated bill sorts LAST rather than first, the call sortCandidates
 * and sortLongestWaitingFirst both make: a data gap must not take the top of a
 * list a reader scans from the top.
 */
export function availableInvoiceOptions(options, { vendorRecordId } = {}) {
    const list = (options || []).filter(
        (o) => !vendorRecordId || o.vendorRecordId === vendorRecordId
    );

    return list.sort((a, b) => {
        const da = a.issueDate || "";
        const db = b.issueDate || "";
        if (da !== db) {
            if (!da) return 1;
            if (!db) return -1;
            return db.localeCompare(da);
        }
        return (b.invoiceId || "").localeCompare(a.invoiceId || "");
    });
}

/**
 * One option's label: THE VENDOR'S OWN NUMBER FIRST.
 *
 * That ordering is the one thing about this dropdown that is not cosmetic. The
 * recorder is reading a packing list the vendor wrote, so the number in front of
 * them is `Vendor Invoice Code` — our `Invoice ID` is this app's name for the
 * record and appears second, as the identity of the thing they are picking. A
 * label that led with ours would be sorted and scanned on a string the document in
 * their hand does not carry.
 *
 * `·` separates the identity, ` — ` introduces the qualifier, the shape
 * itemOptionLabel already uses for the item dropdown.
 */
export function invoiceOptionLabel(option) {
    const identity = [option?.vendorInvoiceCode, option?.invoiceId, option?.issueDate]
        .filter(Boolean)
        .join(" · ");
    if (!option?.linkedDeliveryRecordId) return identity;
    // The delivery is NAMED only when the reader may reach it. A delivery is
    // Job-scoped, and an invoice can bill two jobs, so the one holding it is not
    // always in view — and naming it would confirm a record outside someone's
    // scope, which no surface here does.
    return option.linkedDeliveryId
        ? `${identity} — already on ${option.linkedDeliveryId}`
        : `${identity} — already on another delivery`;
}

// ---------------------------------------------------------------------------
// Copy
//
// ONE OBJECT, TWO GROUPS. `field` addresses the recorder about to pair the two
// documents (second person, present), the way ALLOCATION_COPY.preview does;
// `refused` is what a Server Action says when it re-derives the answer and
// disagrees with the form. Same vocabulary as #166: `delivered`, never `arrived`;
// `ordered item`, never `line`; and facts rather than verdicts.
//
// `describeLinkRefusal` BELOW CLAIMS THAT NEITHER THE FORM NOR THE ACTION INVENTS A
// SECOND PHRASING, AND THAT IS TRUE OF `refused` AND NOT OF `field`. Recorded here
// as a fact rather than fixed, because the fix is a copy decision rather than a
// correction. What is outside this object today: the edit form holds
// `Attach an invoice`, `Select an invoice…` and `None attached yet.` as JSX
// literals, and the entry form holds `Not on the packing list…`. And the two screens
// state the same rule at different densities — `label` and `optional` render on the
// entry form only, `oneEach` on the edit form only, so the entry form greys an
// already-paired option (`disabled` on its own) while the sentence explaining why is
// on the other screen.
//
// THE DIVERGENCE ITSELF IS DEFENSIBLE AND ITS LOCATION IS NOT. The two screens do
// different acts — one asks which number is on the packing list, the other attaches
// a bill to a shipment that already exists — so one wording for both would be worse
// than two. But then BOTH voices belong in this module, the way
// `refused.takenByAnother` carries its two, rather than one here and one in JSX
// where nothing pins its vocabulary and no check can see it drift.
//
// The Layer A copy pass will come back to this place; nothing is moved here.

/**
 * The fact both `taken-by-another` voices open with: this bill is on some other
 * shipment, and one bill belongs to one shipment. No trailing punctuation, because
 * one voice continues into an action and the other stops here.
 *
 * NAMES THE SHIPMENT ONLY WHEN THE CALLER COULD NAME IT. `deliveryId` is null when
 * the holder is outside the reader's Job scope, and no surface in this app confirms
 * a record outside someone's scope.
 */
const takenByAnotherFact = (f) =>
    `${f?.invoiceId ?? "That invoice"} is already attached to ` +
    `${f?.deliveryId ? `delivery ${f.deliveryId}` : "another delivery"}. ` +
    "One invoice belongs to one delivery";

export const LINK_COPY = {
    field: {
        /** The label, which says which number to look for and where. */
        label: () => ({
            key: "label",
            text: "Invoice number on the packing list",
        }),
        /**
         * WHY BLANK IS A NORMAL ANSWER, said where the blank is. The bill usually
         * arrives first, but not always, and an invoice nobody has entered yet
         * cannot be picked — so the screen has to make leaving it empty read as a
         * choice rather than as an omission.
         */
        optional: () => ({
            key: "optional",
            text:
                "Optional. Leave it blank if the invoice has not been entered yet — it can be " +
                "attached from this delivery later, and until then the invoice reads as awaiting " +
                "delivery.",
        }),
        /** No invoice from this vendor has been entered at all. */
        emptyList: (f) => ({
            key: "empty-list",
            text:
                `No invoice from ${f?.vendorName ?? "this vendor"} has been entered yet, so there ` +
                "is nothing to attach. Record the delivery now and attach the invoice once the " +
                "office enters it.",
        }),
        /** The containment rule, as the reason the control takes one value. */
        oneEach: () => ({
            key: "one-each",
            text:
                "One invoice belongs to one delivery, so a bill already attached elsewhere is " +
                "listed but cannot be picked. A delivery can carry more than one invoice.",
        }),
    },

    refused: {
        [LINK_REFUSED.notFound]: () => ({
            key: LINK_REFUSED.notFound,
            text: "That invoice no longer exists.",
        }),
        // Deliberately the same sentence as notFound. A caller outside an
        // invoice's scope must not be able to tell it apart from one that is not
        // there — the posture every row-scoped surface in this app takes.
        [LINK_REFUSED.outOfScope]: () => ({
            key: LINK_REFUSED.outOfScope,
            text: "That invoice no longer exists.",
        }),
        [LINK_REFUSED.wrongVendor]: () => ({
            key: LINK_REFUSED.wrongVendor,
            text:
                "That invoice is from a different vendor, so it cannot be the bill for this " +
                "delivery.",
        }),
        /**
         * TWO VOICES, AND THE DIFFERENCE IS WHETHER THE READER CAN REACH THE
         * SHIPMENT HOLDING IT — #206's rule applied to a refusal rather than to a
         * banner: naming an action the reader cannot take is worse than saying
         * nothing, which is why that issue's qualifier has two voices instead of
         * three.
         *
         * A delivery is Job-scoped and an invoice can bill two jobs, so the shipment
         * holding a bill is not always in view. `invoiceOptionLabel` already makes
         * that distinction and stops at "already on another delivery"; the refusal
         * has to make it too, or it sends someone to a page that will tell them the
         * delivery does not exist.
         *
         * SO THE FACT IS SHARED AND ONLY THE ACTION IS CONDITIONAL, the arrangement
         * `noLongerOverSentence` uses in lib/overage.js. Both voices say the bill is
         * taken and say the rule that makes it exclusive; only the reachable one says
         * what to do about it. What NOT to do is invent a second thing for the
         * unreachable voice to suggest — "ask the office" names a process this app
         * does not model, and the reader can see the invoice, so the fact is enough
         * to act on however they act on it.
         */
        [LINK_REFUSED.takenByAnother]: (f) =>
            f?.deliveryId
                ? {
                      key: LINK_REFUSED.takenByAnother,
                      text: `${takenByAnotherFact(f)} — detach it there first if this is the right shipment.`,
                  }
                : { key: LINK_REFUSED.takenByAnother, text: `${takenByAnotherFact(f)}.` },
    },
};

/**
 * The one sentence a refusal deserves, so neither the form nor the action invents
 * a second phrasing for a state this module already words.
 *
 * Returns null when there is nothing to refuse, which is what lets a caller write
 * `describeLinkRefusal(...) ?? proceed()`.
 */
export function describeLinkRefusal(refusal, facts = {}) {
    const builder = LINK_COPY.refused[refusal];
    return builder ? builder(facts) : null;
}
