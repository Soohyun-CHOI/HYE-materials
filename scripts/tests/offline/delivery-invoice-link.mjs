// The invoice-to-delivery pairing (#210) — the pure rule, the dropdown's own
// narrowing and ordering, and every refusal.
//
// WHAT THIS TIER CAN AND CANNOT SEE. lib/deliveryInvoiceLink.js is pure and
// dependency-free, so every clause below is exercised rather than inspected. Its
// credentialed half (lib/deliveryInvoiceCandidates.js) reaches lib/airtable/*, so
// this file cannot call it — what THAT module has to get right is the row gate, and
// that claim is asserted on the source in offline/invoice-visibility.mjs, beside the
// same claim about the module it defers to.
//
// WHAT A PASS DOES NOT PROVE. That a refusal actually refuses. Whether a Server
// Action re-runs the guard, and whether a bill already on another shipment is really
// rejected, is behavior — measured in a browser with the two fixture accounts, and
// recorded in the PR.

import {
    LINK_COPY,
    LINK_REFUSED,
    availableInvoiceOptions,
    describeLinkRefusal,
    invoiceLinkRefusal,
    invoiceOptionLabel,
    linkedDelivery,
} from "../../../lib/deliveryInvoiceLink.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Invoice-to-delivery pairing — the rule and its refusals (#210)";

/** One invoice as the readers see it: link fields are arrays, always. */
const invoice = ({ id = "recINV1", invoiceId = "HYE-INV-260801-03", vendor = "recVEN1", delivery = null } = {}) => ({
    id,
    invoiceId,
    vendor: vendor ? [vendor] : [],
    delivery: delivery ? [delivery] : [],
});

/** One dropdown option. */
const option = (over) => ({
    invoiceRecordId: "recINV1",
    invoiceId: "HYE-INV-260801-03",
    vendorInvoiceCode: "INV-88213",
    issueDate: "2026-08-01",
    vendorRecordId: "recVEN1",
    linkedDeliveryRecordId: null,
    linkedDeliveryId: null,
    ...over,
});

export function run({ check, log, assert }) {
    // --- single-record, enforced on the read side --------------------------
    log("the link is an ARRAY in Airtable and one value in this app:");
    // prefersSingleRecordLink is refused on field CREATE and UPDATE alike, so the
    // field is multi and nothing can make it otherwise. Every reader flattens through
    // this one function, so a second link — which only a hand edit could add — cannot
    // become two contradictory answers on two screens.
    check("one link flattens to the record id", linkedDelivery(invoice({ delivery: "recDL1" })), "recDL1");
    check("no link is null, not undefined", linkedDelivery(invoice()), null);
    check("nullish does not throw", linkedDelivery(null), null);
    check("a missing key does not either", linkedDelivery({}), null);
    // A hand-added second link is read as the first and nothing iterates.
    check(
        "two links read as the first, never as a set",
        linkedDelivery({ delivery: ["recDL1", "recDL2"] }),
        "recDL1"
    );

    // --- the refusals, in the order a reader can act on them ---------------
    log("");
    log("may this invoice be paired with this delivery — and if not, why:");
    check(
        "a free bill from the right vendor is fine",
        invoiceLinkRefusal({ invoice: invoice(), deliveryRecordId: "recDL1", vendorRecordId: "recVEN1", visible: true }),
        null
    );
    check(
        "no invoice at all",
        invoiceLinkRefusal({ invoice: null, deliveryRecordId: "recDL1", visible: true }),
        LINK_REFUSED.notFound
    );
    check(
        "outside the caller's scope",
        invoiceLinkRefusal({ invoice: invoice(), deliveryRecordId: "recDL1", visible: false }),
        LINK_REFUSED.outOfScope
    );
    check(
        "another vendor's bill cannot describe this shipment",
        invoiceLinkRefusal({ invoice: invoice(), deliveryRecordId: "recDL1", vendorRecordId: "recVEN9", visible: true }),
        LINK_REFUSED.wrongVendor
    );
    check(
        "another shipment already holds it",
        invoiceLinkRefusal({
            invoice: invoice({ delivery: "recDL9" }),
            deliveryRecordId: "recDL1",
            vendorRecordId: "recVEN1",
            visible: true,
        }),
        LINK_REFUSED.takenByAnother
    );

    log("");
    log("ALREADY NAMING **THIS** DELIVERY IS NOT A REFUSAL:");
    // A double-click and a re-saved edit form both re-submit the same pairing, so it
    // has to be a no-op rather than an error — the posture upsertMaterial takes.
    check(
        "re-submitting the same pairing is admitted",
        invoiceLinkRefusal({
            invoice: invoice({ delivery: "recDL1" }),
            deliveryRecordId: "recDL1",
            vendorRecordId: "recVEN1",
            visible: true,
        }),
        null
    );
    // THE ENTRY PATH PASSES NULL, and that is the correct reading rather than a
    // special case: the delivery does not exist yet, so nothing can already name it.
    check(
        "at entry, where no delivery exists yet, any existing pairing is refused",
        invoiceLinkRefusal({
            invoice: invoice({ delivery: "recDL9" }),
            deliveryRecordId: null,
            vendorRecordId: "recVEN1",
            visible: true,
        }),
        LINK_REFUSED.takenByAnother
    );
    check(
        "  while a free bill is admitted there too",
        invoiceLinkRefusal({ invoice: invoice(), deliveryRecordId: null, vendorRecordId: "recVEN1", visible: true }),
        null
    );

    log("");
    log("the ORDER of those tests, which is what each refusal may disclose:");
    // Scope first: a caller who may not see the record must learn nothing about its
    // contents from the refusal, so an out-of-scope bill from the wrong vendor must
    // report the scope refusal rather than the vendor one.
    check(
        "out of scope beats wrong vendor",
        invoiceLinkRefusal({ invoice: invoice(), deliveryRecordId: "recDL1", vendorRecordId: "recVEN9", visible: false }),
        LINK_REFUSED.outOfScope
    );
    check(
        "  and beats taken-by-another too",
        invoiceLinkRefusal({
            invoice: invoice({ delivery: "recDL9" }),
            deliveryRecordId: "recDL1",
            visible: false,
        }),
        LINK_REFUSED.outOfScope
    );
    // Wrong vendor before taken: a wrong pick is a mistake to correct, while taken is
    // a decision somebody already made, and the reader can act on the first.
    check(
        "wrong vendor beats taken-by-another",
        invoiceLinkRefusal({
            invoice: invoice({ vendor: "recVEN9", delivery: "recDL9" }),
            deliveryRecordId: "recDL1",
            vendorRecordId: "recVEN1",
            visible: true,
        }),
        LINK_REFUSED.wrongVendor
    );
    // Detaching passes no vendor, so a pairing that somehow crossed vendors stays
    // detachable rather than being locked in by the refusal that objects to it.
    check(
        "with no vendor supplied, the vendor test is skipped",
        invoiceLinkRefusal({
            invoice: invoice({ vendor: "recVEN9", delivery: "recDL1" }),
            deliveryRecordId: "recDL1",
            visible: true,
        }),
        null
    );
    // --- `visible` IS REQUIRED, AND THE DEFAULT IS NOT ADMIT ---------------
    log("");
    log("`visible` is required, because a gate that defaults to admitting is not one:");
    // The first version tested `visible === false`, to keep "refused" apart from "not
    // asked" — which made a caller who forgot the argument pass. Nothing asserted that
    // the one caller passed it, so that shape's safety rested on a fact no check could
    // see. It throws now, which is a property of the FUNCTION rather than of its call
    // sites: verification.md's own reason to prefer this over a source-shape check is
    // that "source shape is not execution".
    const throwsWithout = (label, args) => {
        let threw = false;
        try {
            invoiceLinkRefusal(args);
        } catch {
            threw = true;
        }
        assert(label, threw);
    };
    throwsWithout("no argument at all throws", undefined);
    throwsWithout("an empty object throws", {});
    throwsWithout("a caller who forgot only `visible` throws", {
        invoice: invoice(),
        deliveryRecordId: "recDL1",
        vendorRecordId: "recVEN1",
    });
    // CHECKED BEFORE THE INVOICE EXISTS, because the argument contract is not
    // conditional on the answer. A caller that resolved nothing still knows what it
    // asked, and `checkInvoicePairing` passes `false` there.
    throwsWithout("even with no invoice to judge, so `notFound` cannot mask it", {
        invoice: null,
        deliveryRecordId: "recDL1",
    });
    // Not a truthiness test: a non-boolean is a caller bug too, and admitting `"yes"`
    // or refusing `null` silently would both be answers to a question nobody asked.
    for (const bad of [null, "true", 1, 0, {}]) {
        throwsWithout(`\`visible: ${JSON.stringify(bad)}\` throws rather than being coerced`, {
            invoice: invoice(),
            deliveryRecordId: "recDL1",
            visible: bad,
        });
    }
    // ANTI-VACUITY: the two real values must NOT throw, or the assertions above are
    // satisfied by a function that throws unconditionally.
    check(
        "`visible: true` is admitted",
        invoiceLinkRefusal({ invoice: invoice(), deliveryRecordId: "recDL1", visible: true }),
        null
    );
    check(
        "`visible: false` is refused, not thrown",
        invoiceLinkRefusal({ invoice: invoice(), deliveryRecordId: "recDL1", visible: false }),
        LINK_REFUSED.outOfScope
    );
    // WHAT THE THROW DOES NOT PROVE, said here because a reader of this section will
    // otherwise take it for more than it is: a caller passing `visible: true`
    // unconditionally satisfies every assertion above. That the one caller reaches
    // getVisibleInvoiceIds at all is pinned in offline/invoice-visibility.mjs; that it
    // reaches the RIGHT answer is the browser's and the credentialed tier's.

    // --- the dropdown's narrowing -----------------------------------------
    log("");
    log("VENDOR is the whole narrowing, and deliberately not the job:");
    const mine = option({ invoiceRecordId: "recA", vendorRecordId: "recVEN1" });
    const theirs = option({ invoiceRecordId: "recB", vendorRecordId: "recVEN9" });
    check(
        "another vendor's bill is not offered",
        availableInvoiceOptions([mine, theirs], { vendorRecordId: "recVEN1" }).map((o) => o.invoiceRecordId).join(","),
        "recA"
    );
    check(
        "no vendor yet offers everything, so the form can render before one is picked",
        availableInvoiceOptions([mine, theirs], {}).length,
        2
    );
    check("nullish does not throw", availableInvoiceOptions(null, { vendorRecordId: "recVEN1" }).length, 0);

    log("");
    log("AN ALREADY-PAIRED BILL STAYS ON THE LIST — #162's rule, one level up:");
    // Its item dropdown lists a fully delivered item rather than dropping it, because
    // dropping it lands the recorder on "not in the dropdown", which says it may never
    // have been ordered here and would be false. A bill somebody has already paired is
    // the same shape: it exists, it is this vendor's, and the recorder holding a
    // packing list that names it needs telling where it went.
    const taken = option({ invoiceRecordId: "recC", linkedDeliveryRecordId: "recDL9", linkedDeliveryId: "HYE-DL-260803-01" });
    check(
        "it is offered rather than filtered out",
        availableInvoiceOptions([mine, taken], { vendorRecordId: "recVEN1" }).length,
        2
    );
    assert(
        "  and it carries what the screen needs to disable it",
        availableInvoiceOptions([mine, taken], { vendorRecordId: "recVEN1" }).some(
            (o) => o.linkedDeliveryRecordId === "recDL9"
        )
    );

    log("");
    log("newest first, ties by Invoice ID, and an undated bill LAST:");
    const dated = (id, issueDate) => option({ invoiceRecordId: id, invoiceId: id, issueDate });
    const sorted = availableInvoiceOptions(
        [dated("HYE-INV-260701-01", "2026-07-01"), dated("HYE-INV-260810-01", "2026-08-10"), dated("HYE-INV-260710-01", "2026-07-10")],
        { vendorRecordId: "recVEN1" }
    );
    check("newest issue date first, matching the invoice list", sorted[0].invoiceId, "HYE-INV-260810-01");
    check("then the next", sorted[1].invoiceId, "HYE-INV-260710-01");
    const tied = availableInvoiceOptions(
        [dated("HYE-INV-260710-01", "2026-07-10"), dated("HYE-INV-260710-02", "2026-07-10")],
        { vendorRecordId: "recVEN1" }
    );
    check("ties broken by Invoice ID, descending to match", tied[0].invoiceId, "HYE-INV-260710-02");
    // A data gap must not take the top of a list a reader scans from the top — the
    // same call sortCandidates and sortLongestWaitingFirst both make.
    const withUndated = availableInvoiceOptions(
        [dated("HYE-INV-260101-01", ""), dated("HYE-INV-260710-01", "2026-07-10")],
        { vendorRecordId: "recVEN1" }
    );
    check("an undated bill sorts LAST, not first", withUndated.at(-1).invoiceId, "HYE-INV-260101-01");

    // --- the label ---------------------------------------------------------
    log("");
    log("the label leads with THE VENDOR'S OWN NUMBER, which is the one on the document:");
    // The recorder is reading a packing list the vendor wrote, so the string in front
    // of them is `Vendor Invoice Code`. Ours is the identity of the record they are
    // picking and comes second.
    check("all three parts, vendor code first", invoiceOptionLabel(option()), "INV-88213 · HYE-INV-260801-03 · 2026-08-01");
    assert("the vendor's code really is first", invoiceOptionLabel(option()).startsWith("INV-88213"));
    check(
        "a bill with no vendor code omits it rather than printing a gap",
        invoiceOptionLabel(option({ vendorInvoiceCode: "" })),
        "HYE-INV-260801-03 · 2026-08-01"
    );
    check("nullish does not throw", invoiceOptionLabel(null), "");

    log("");
    log("and it NAMES the shipment holding it only when the reader may reach it:");
    check(
        "in view: the delivery is named",
        invoiceOptionLabel(option({ linkedDeliveryRecordId: "recDL9", linkedDeliveryId: "HYE-DL-260803-01" })),
        "INV-88213 · HYE-INV-260801-03 · 2026-08-01 — already on HYE-DL-260803-01"
    );
    // A delivery is Job-scoped and an invoice can bill two jobs, so the holder is not
    // always in view — and naming it then would confirm a record outside someone's
    // scope, which no surface in this app does.
    check(
        "out of view: it says so without naming it",
        invoiceOptionLabel(option({ linkedDeliveryRecordId: "recDL9", linkedDeliveryId: null })),
        "INV-88213 · HYE-INV-260801-03 · 2026-08-01 — already on another delivery"
    );
    assert(
        "  and no delivery id leaks into that wording",
        !invoiceOptionLabel(option({ linkedDeliveryRecordId: "recDL9", linkedDeliveryId: null })).includes("recDL9")
    );

    // --- the copy ----------------------------------------------------------
    log("");
    log("every refusal has a sentence, and two of them say the SAME thing:");
    for (const key of Object.values(LINK_REFUSED)) {
        const described = describeLinkRefusal(key, { invoiceId: "HYE-INV-260801-03", deliveryId: "HYE-DL-260803-01" });
        assert(`\`${key}\` is worded`, Boolean(described?.text));
        check(`  and keyed by its own refusal`, described.key, key);
    }
    // A caller outside an invoice's scope must not be able to tell it apart from one
    // that is not there, which is why the two sentences are identical rather than
    // merely similar — the posture every row-scoped surface in this app takes.
    check(
        "out-of-scope reads exactly like not-found",
        describeLinkRefusal(LINK_REFUSED.outOfScope).text,
        describeLinkRefusal(LINK_REFUSED.notFound).text
    );
    assert(
        "  and neither mentions scope, permission or a job",
        !/scope|permission|allowed|job/i.test(describeLinkRefusal(LINK_REFUSED.outOfScope).text)
    );
    check("an unknown refusal is null rather than a throw", describeLinkRefusal("nonsense"), null);
    check("nullish too", describeLinkRefusal(null), null);

    log("");
    log("the taken refusal has TWO VOICES, split on whether the reader can reach it:");
    // #206's rule applied to a refusal: naming an action the reader cannot take is
    // worse than saying nothing, which is why that issue's qualifier has two voices
    // rather than three. A delivery is Job-scoped and an invoice can bill two jobs, so
    // the shipment holding a bill is not always in view — and "detach it there first"
    // then sends someone to a page that will tell them it does not exist.
    const takenNamed = describeLinkRefusal(LINK_REFUSED.takenByAnother, {
        invoiceId: "HYE-INV-260801-03",
        deliveryId: "HYE-DL-260803-01",
    }).text;
    const takenUnnamed = describeLinkRefusal(LINK_REFUSED.takenByAnother, {
        invoiceId: "HYE-INV-260801-03",
    }).text;

    log("  reachable — names the shipment and says what to do:");
    assert("it says which delivery", takenNamed.includes("HYE-DL-260803-01"));
    assert("  and which invoice", takenNamed.includes("HYE-INV-260801-03"));
    assert("  and the rule that makes it exclusive", takenNamed.includes("One invoice belongs to one delivery"));
    assert("  and the action", takenNamed.includes("detach it there first"));

    log("  out of reach — the same facts, and NO action:");
    assert("it still names the invoice", takenUnnamed.includes("HYE-INV-260801-03"));
    assert("  and still says the bill is taken", takenUnnamed.includes("another delivery"));
    assert("  and still says the rule", takenUnnamed.includes("One invoice belongs to one delivery"));
    // THE WHOLE POINT: no action, and no second one invented in its place either.
    for (const forbidden of ["detach", "ask", "contact", "the office", "instead"]) {
        assert(
            `  and never says "${forbidden}"`,
            !takenUnnamed.toLowerCase().includes(forbidden)
        );
    }
    // And it must not leak the record it declined to name. A record id would be worse
    // than the human id, since neither belongs to a reader outside its scope.
    assert("  and names no delivery at all", !/HYE-DL-|recDL/.test(takenUnnamed));

    // ANTI-VACUITY for the whole split. Every "does not contain" above is also what a
    // builder returning "" would satisfy, and the two voices must be genuinely
    // different rather than one string with a field interpolated into it.
    assert("the two voices are different sentences", takenNamed !== takenUnnamed);
    assert("  and the action really is present in the other one", takenNamed.includes("detach"));
    assert("  both are non-empty", takenNamed.length > 0 && takenUnnamed.length > 0);
    // With no invoiceId either, the voice degrades to a subject rather than printing
    // `undefined` — the same property emptyList has.
    const takenBare = describeLinkRefusal(LINK_REFUSED.takenByAnother, {}).text;
    assert("with nothing named at all it still reads", takenBare.startsWith("That invoice"));
    assert("  without printing undefined", !takenBare.includes("undefined"));
    assert("  and still names no action", !takenBare.toLowerCase().includes("detach"));

    log("");
    log("the field's own copy: a TRANSCRIPTION, behind a checkbox (#231):");
    // `optional` is gone with the always-open control it explained. Blank is no
    // longer an answer at all — it is the unticked box — and what the note has to
    // say instead is that a number read off the document beats the computation.
    assert("the `optional` note is gone", LINK_COPY.field.optional === undefined);
    // #231 removed the entry form's invoice control, so all three of its copy
    // entries lost their only caller and were deleted with it. What remains is the
    // delivery EDIT page's, which is where a computed pairing is corrected by hand.
    assert("`label` is gone with the control", LINK_COPY.field.label === undefined);
    assert("`transcribed` is gone with it", LINK_COPY.field.transcribed === undefined);
    assert(
        "what is left is exactly what the edit page reads",
        Object.keys(LINK_COPY.field).sort().join() === "emptyList,oneEach"
    );
    assert(
        "the empty list names the vendor and does not read as an error",
        LINK_COPY.field.emptyList({ vendorName: "Conklin Metal" }).text.includes("Conklin Metal")
    );
    assert(
        "  and a missing vendor name degrades rather than printing undefined",
        !LINK_COPY.field.emptyList({}).text.includes("undefined")
    );
    // The n:1 asymmetry stated where the control is, because it is the reason one
    // option can be unselectable and several can be attached.
    assert("the containment rule is on the screen", LINK_COPY.field.oneEach().text.includes("One invoice belongs to one delivery"));
    assert(
        "  including the other direction, which is the one people get wrong",
        LINK_COPY.field.oneEach().text.includes("more than one invoice")
    );

    log("");
    log("SAME VOCABULARY AS #166 — one word per fact, and facts rather than verdicts:");
    const everySentence = [
        ...Object.values(LINK_COPY.field).map((f) => f({ vendorName: "Conklin Metal" }).text),
        ...Object.values(LINK_COPY.refused).map((f) =>
            f({ invoiceId: "HYE-INV-260801-03", deliveryId: "HYE-DL-260803-01" }).text
        ),
    ];
    for (const forbidden of ["arriv", "recorded as", "over-billed", "overbilled"]) {
        assert(
            `no message says "${forbidden}"`,
            !everySentence.some((t) => t.toLowerCase().includes(forbidden))
        );
    }
    assert("every sentence is non-empty", everySentence.every((t) => t && t.length > 0));
    // Every REFUSAL is a sentence and ends like one. `field.label` is excluded on
    // purpose and is the only entry that is not a sentence at all — it is a form
    // label, and a full stop on one would be a typo rather than a convention.
    assert(
        "every refusal ends in a full stop",
        Object.values(LINK_COPY.refused).every((f) => f({}).text.trim().endsWith("."))
    );

    // --- ANTI-VACUITY -----------------------------------------------------
    // Most assertions above are of the form "this string is present" or "this
    // refusal is null", and a builder returning a constant would satisfy plenty of
    // them. So the two things that decide everything are shown to actually vary.
    log("");
    log("anti-vacuity — the rule is seen to say both yes and no:");
    assert("the refusal returns null for at least one input", everySentence.length > 0);
    assert(
        "  and a non-null refusal for another, so it is not a constant",
        invoiceLinkRefusal({ invoice: invoice({ delivery: "recDL9" }), deliveryRecordId: "recDL1", visible: true }) !==
            invoiceLinkRefusal({ invoice: invoice(), deliveryRecordId: "recDL1", visible: true })
    );
    assert(
        "the label changes when the option does, so it is not a constant either",
        invoiceOptionLabel(option()) !== invoiceOptionLabel(option({ linkedDeliveryRecordId: "recDL9" }))
    );
    assert(
        "and the narrowing removes something, so the filter is not the identity",
        availableInvoiceOptions([mine, theirs], { vendorRecordId: "recVEN1" }).length <
            availableInvoiceOptions([mine, theirs], {}).length
    );
    // The keys themselves must be distinct, or the ordering assertions above would be
    // comparing one refusal with itself.
    assert(
        "the four refusal keys are four different values",
        new Set(Object.values(LINK_REFUSED)).size === 4
    );
}

if (isMain(import.meta.url)) standalone(title, run);
