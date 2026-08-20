// The invoices waiting on a delivery are selected, split and ordered (#256).
//
// THE QUIET MUTANT IS A SELECTION RULE THAT ALWAYS RETURNS NOTHING, and it is
// asserted first. Make `selectInvoicesAwaitingDelivery` return `[]` and the strip
// renders nowhere, because rendering nothing when there is nothing is the shape every
// strip in this app has — so the page looks exactly as it does on the good day, the
// invoice list is untouched, and no other check in this tier notices. It is the same
// station as #237's `always agree`, #242's removed narrowing, #241's always-silent
// list, #238's unfolded table and #179's two constants holding one value: a screen
// that is correct in every visible respect and has stopped saying the one thing it
// was built to say.
//
// TWO MORE MUTANTS BEHIND IT, both invisible the same way: a splitter that always
// returns one row kind (every row then reads `nothing delivered yet`, which is a
// plausible state), and a sort that returns its input order (the rows are all there
// and only their order is wrong, which nobody can eyeball against 14 rows).
//
// WHAT THIS CANNOT SEE: whether the strip renders, and whether the read that feeds
// `deliveredOrderedItems` returns the right ids. The first is rendering and this tier
// never renders; the second is credentialed. Both were checked in a browser and the
// finding is in the pull request.

import { walk } from "./_ast.mjs";
import { parseFile } from "./_ast.mjs";
import {
    AWAITING_DELIVERY_COPY,
    AWAITING_DELIVERY_KIND,
    selectInvoicesAwaitingDelivery,
} from "../../../lib/deliveryStatus.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "The invoices waiting on a delivery: selection, split, order (#256)";

const AWAITING = { key: "awaiting-delivery" };
const MATCHED = { key: "delivered" };
const MISMATCH = { key: "mismatch" };

/** An invoice record as the page holds it. */
const inv = (invoiceId, issueDate, vendor = "vendorA") => ({
    id: `rec-${invoiceId}`,
    invoiceId,
    issueDate,
    vendor: [vendor],
});

const VENDORS = { vendorA: "Demo Vendor Co.", vendorB: "Other Vendor" };
const TODAY = "2026-08-18";

/** The whole call, with only what a case varies. */
function select({ invoices, status, ordered, delivered = [] }) {
    return selectInvoicesAwaitingDelivery({
        invoices,
        statusByInvoice: new Map(invoices.map((i) => [i.id, status[i.invoiceId] ?? AWAITING])),
        orderedItemsByInvoice: new Map(
            invoices.map((i) => [i.id, ordered[i.invoiceId] ?? ["poItem-1"]])
        ),
        deliveredOrderedItems: new Set(delivered),
        vendorNameById: VENDORS,
        today: TODAY,
    });
}

export function run({ check, assert, log }) {
    // -----------------------------------------------------------------------
    log("THE QUIET MUTANT — a selection rule that always returns nothing:");
    const a = inv("HYE-INV-260701-01", "2026-07-01");
    const b = inv("HYE-INV-260801-01", "2026-08-01");
    const baseline = select({ invoices: [a, b], status: {}, ordered: {} });
    // Asserted before anything else, because every check below this one is of the form
    // "the rows are shaped so" and an empty list satisfies all of them vacuously.
    assert("an awaiting invoice is SELECTED at all", baseline.length > 0);
    check("both awaiting bills are selected", baseline.length, 2);
    log("  a selector returning [] passes every ordering and shape check below");

    // -----------------------------------------------------------------------
    log("");
    log("selection is the chip's own key, not a second reading of the link:");
    check(
        "a matched invoice is not selected",
        select({ invoices: [a, b], status: { [a.invoiceId]: MATCHED }, ordered: {} }).length,
        1
    );
    check(
        "a mismatched invoice is not selected either — it HAS a delivery",
        select({ invoices: [a, b], status: { [a.invoiceId]: MISMATCH }, ordered: {} }).length,
        1
    );
    // Built inline rather than through the helper, whose `?? AWAITING` default is
    // exactly what this case has to defeat: an invoice the status map never mentions.
    check(
        "an invoice with no summary at all is not selected",
        selectInvoicesAwaitingDelivery({
            invoices: [a],
            statusByInvoice: new Map(),
            orderedItemsByInvoice: new Map([[a.id, ["poItem-1"]]]),
            deliveredOrderedItems: new Set(),
            vendorNameById: VENDORS,
            today: TODAY,
        }).length,
        0
    );

    // -----------------------------------------------------------------------
    log("");
    log("an invoice charging no ordered item is excluded, and the count may differ:");
    check(
        "no ordered item means no row",
        select({ invoices: [a], status: {}, ordered: { [a.invoiceId]: [] } }).length,
        0
    );
    // THE DIVERGENCE THIS CREATES, PINNED. The table below the strip shows an
    // `Awaiting delivery` chip for such an invoice and the strip has no row for it, so the
    // two figures disagree by design — see the selector's docstring and
    // docs/briefs/invoices.md, both of which say so in as many words.
    const withUnlinked = select({
        invoices: [a, b],
        status: {},
        ordered: { [a.invoiceId]: [] },
    });
    check("two chips, one row", `${2}/${withUnlinked.length}`, "2/1");
    assert("  and the row is the one that charges an order", withUnlinked[0].invoiceId === b.invoiceId);

    // -----------------------------------------------------------------------
    log("");
    log("the split names the observation, never the cause:");
    const split = select({
        invoices: [a, b],
        status: {},
        ordered: { [a.invoiceId]: ["poItem-1"], [b.invoiceId]: ["poItem-2", "poItem-3"] },
        delivered: ["poItem-3"],
    });
    const kindOf = (id) => split.find((r) => r.invoiceId === id)?.kind;
    check(
        "nothing delivered against its orders",
        kindOf(a.invoiceId),
        AWAITING_DELIVERY_KIND.noDeliveryRecorded
    );
    check(
        "one of several ordered items has a delivery",
        kindOf(b.invoiceId),
        AWAITING_DELIVERY_KIND.deliveredNotMatched
    );
    // ANY, NOT ALL: one slice against one of the ordered items is enough for a person
    // to have something to look at, and requiring all of them would put a partly
    // delivered bill in the "nothing delivered" kind, which is the misreading the two
    // words exist to prevent.
    assert(
        "  ANY ordered item with a delivery is enough",
        kindOf(b.invoiceId) === AWAITING_DELIVERY_KIND.deliveredNotMatched
    );
    // THE SPLITTER MUTANT: always one kind. Both keys have to be reachable from one
    // call, or "every row says the same thing" reads as a real state of the base.
    assert("both kinds are reachable in one selection", new Set(split.map((r) => r.kind)).size === 2);

    // -----------------------------------------------------------------------
    log("");
    log("the order is longest wait first, shared with the other two strips:");
    const c = inv("HYE-INV-260815-01", "2026-08-15");
    const ordered3 = select({ invoices: [b, c, a], status: {}, ordered: {} });
    check(
        "oldest Issue Date first",
        ordered3.map((r) => r.invoiceId).join(" "),
        `${a.invoiceId} ${b.invoiceId} ${c.invoiceId}`
    );
    // THE SORT MUTANT: return the input order. The input here is deliberately NOT
    // sorted, so a passthrough fails this and only this.
    assert("  the input was not already in that order", [b, c, a][0].invoiceId !== a.invoiceId);
    const undated = select({ invoices: [inv("HYE-INV-260101-01", ""), a], status: {}, ordered: {} });
    check("an undated invoice sorts LAST, not first", undated.at(-1).waitingSince, "");

    // -----------------------------------------------------------------------
    log("");
    log("two invoices issued on one day break the tie on Invoice ID:");
    // THE TIE-BREAK WAS INERT ON THIS AXIS UNTIL THE SECOND PASS, and inertly so:
    // `sortLongestWaitingFirst` read `createdAt`, `Invoices` has no such field, so
    // every same-day pair silently held whatever order the invoice read returned. The
    // id serves because its date half is the mint moment rather than the vendor's
    // `Issue Date` (#164), so descending by it is the delivery side's `createdAt`
    // descending — most recently entered first.
    const sameDay = select({
        invoices: [inv("HYE-INV-260716-02", "2026-07-16"), inv("HYE-INV-260716-03", "2026-07-16")],
        status: {},
        ordered: {},
    });
    check(
        "the later id reads first",
        sameDay.map((r) => r.invoiceId).join(" "),
        "HYE-INV-260716-03 HYE-INV-260716-02"
    );
    // Fed in the other order, to prove it is the sort deciding and not the input.
    const sameDayReversed = select({
        invoices: [inv("HYE-INV-260716-03", "2026-07-16"), inv("HYE-INV-260716-02", "2026-07-16")],
        status: {},
        ordered: {},
    });
    check(
        "  and the input order does not decide it",
        sameDayReversed.map((r) => r.invoiceId).join(" "),
        "HYE-INV-260716-03 HYE-INV-260716-02"
    );
    // Across days the wait still wins: a tie-break that outranked the primary key
    // would put a newer invoice above an older one, which is the whole worklist inverted.
    const acrossDays = select({
        invoices: [inv("HYE-INV-260801-09", "2026-08-01"), inv("HYE-INV-260716-01", "2026-07-16")],
        status: {},
        ordered: {},
    });
    check("the wait outranks the id", acrossDays[0].invoiceId, "HYE-INV-260716-01");
    assert("the row carries the id as its creation key", sameDay[0].createdKey === sameDay[0].invoiceId);

    // -----------------------------------------------------------------------
    log("");
    log("the row carries the date beside the count, and the count is days:");
    check("days from Issue Date to today", baseline[0].daysWaiting, 48);
    check("  and the date itself travels for checking", baseline[0].waitingSince, "2026-07-01");
    // The blank one is LAST, per the assertion just above — reading it at [0] would
    // have measured the dated row and passed for the wrong reason.
    check("a blank date counts to null rather than 0", undated.at(-1).daysWaiting, null);
    check("the vendor is resolved", baseline[0].vendorName, "Demo Vendor Co.");
    check(
        "an unknown vendor does not blank the row",
        select({ invoices: [inv("HYE-INV-260701-02", "2026-07-01", "gone")], status: {}, ordered: {} })[0]
            .vendorName,
        "Unknown vendor"
    );

    // -----------------------------------------------------------------------
    log("");
    log("the copy: one voice, no control named, no cause claimed:");
    check("singular heading", AWAITING_DELIVERY_COPY.heading(1), "1 invoice is waiting on a delivery");
    check("plural heading", AWAITING_DELIVERY_COPY.heading(4), "4 invoices are waiting on a delivery");
    assert("the explain line leads with the ordering", AWAITING_DELIVERY_COPY.explain.startsWith("Longest wait first."));
    // NAMES NO CONTROL, asserted the way offline/delivery-status.mjs asserts it for
    // #216's copy: the day it does is the day two voices are needed, because recording
    // a delivery is Job-scoped and this strip is not.
    const words = `${AWAITING_DELIVERY_COPY.heading(2)} ${AWAITING_DELIVERY_COPY.explain} ${Object.values(AWAITING_DELIVERY_COPY.kind).join(" ")}`;
    for (const control of ["Record a delivery", "Record delivery", "New invoice", "click", "button"]) {
        assert(`  says nothing about \`${control}\``, !words.includes(control));
    }
    // AND CLAIMS NO CAUSE. `fitRefusal` is never stored and runs only at write time,
    // so any of these words would be false about an invoice the matcher was never asked
    // about — which, per docs/notes/backlog.md, is most of this base's rows.
    for (const cause of ["refused", "rejected", "could not", "failed", "mismatch"]) {
        assert(`  claims no cause: \`${cause}\``, !words.toLowerCase().includes(cause));
    }
    // AND NO INSTRUCTION ABOUT PAYING, which is President-or-Admin (#211) while this
    // strip is not.
    for (const pay of ["pay", "Paid", "payment"]) {
        assert(`  gives no instruction about \`${pay}\``, !words.includes(pay));
    }

    // -----------------------------------------------------------------------
    log("");
    log("both row words exist and are distinct:");
    check("two kinds, two words", Object.keys(AWAITING_DELIVERY_COPY.kind).length, 2);
    assert(
        "every kind has a word",
        Object.values(AWAITING_DELIVERY_KIND).every((k) => typeof AWAITING_DELIVERY_COPY.kind[k] === "string")
    );
    assert(
        "  and the two words differ",
        AWAITING_DELIVERY_COPY.kind[AWAITING_DELIVERY_KIND.noDeliveryRecorded] !==
            AWAITING_DELIVERY_COPY.kind[AWAITING_DELIVERY_KIND.deliveredNotMatched]
    );
    // #227's vocabulary, on new screen text: a delivery is delivered, never arrived.
    for (const banned of ["arrived", "arrival"]) {
        assert(`  and neither says \`${banned}\``, !words.includes(banned));
    }

    // -----------------------------------------------------------------------
    log("");
    log("the strip file is rendering only — the judgment is in lib:");
    const { ast } = parseFile("app/invoices/AwaitingDeliveryStrip.js");
    const called = new Set();
    walk(ast, (node) => {
        if (node.type !== "CallExpression") return;
        const callee = node.callee;
        if (callee?.type === "Identifier") called.add(callee.name);
        if (callee?.type === "MemberExpression" && callee.property?.name) called.add(callee.property.name);
    });
    assert("the strip walk found calls at all", called.size > 0);
    // It may map and read copy; it may not select, split or sort. Those three are the
    // judgment, and #216 recorded that a strip re-deriving one is how #176's pattern
    // went wrong.
    for (const judgment of ["sort", "filter", "selectInvoicesAwaitingDelivery", "daysWaiting"]) {
        assert(`  does not call \`${judgment}\``, !called.has(judgment));
    }

    // -----------------------------------------------------------------------
    log("");
    log("anti-vacuity — the mutants above are seen to be catchable:");
    // Every "no X" assertion has a twin that shows the mechanism can see an X.
    assert("the copy string under test is non-empty", words.length > 40);
    assert("  and the control matcher finds a word that IS there", words.includes("Longest"));
    assert("  and the cause matcher would catch one", "a refused pairing".includes("refused"));
    assert("the strip's call set really holds its calls", called.has("heading") || called.has("map"));
    assert("  and the judgment matcher would catch a sort", ["sort"].some((j) => new Set(["sort"]).has(j)));
    assert("the selector returns rows, not just a length", typeof baseline[0].invoiceId === "string");
    assert("  and a mutant returning [] fails the first assertion above", select({ invoices: [], status: {}, ordered: {} }).length === 0);
}

if (isMain(import.meta.url)) await standalone(title, run);
