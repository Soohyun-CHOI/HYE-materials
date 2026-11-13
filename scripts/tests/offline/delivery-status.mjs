// Delivered against invoiced against ordered (#166, #640) — the pure judgment.
//
// Since #640 invoices and deliveries meet only through the ordered items both name,
// and one rule says which document a cumulative total answers: oldest first, in entry
// order. So this pins the fill, its order, the two-valued invoice chip it produces, the
// delivery axis's three, and the words; the order and payment axes below are #169's,
// #235's and #311's and unchanged.
//
// "IT IS GONE" IS A CLAIM ABOUT SOURCE RATHER THAN ABOUT BEHAVIOR, so the last section
// asserts on the AST that the names #210 and #640 removed appear nowhere in the module,
// with anti-vacuity, since "the walk found nothing" and "the identifier is absent" are
// the same result.
//
// WHAT A PASS DOES NOT PROVE. That the totals handed to the fill were the right ones:
// whether `Delivered Qty` and `Invoiced Qty` are what Airtable holds, and whether every
// row on an ordered item reached the fill, are properties of
// lib/deliveryStatus.server.js and are seen in a browser on the test base.

import {
    AWAITING_INVOICE_COPY,
    daysWaiting,
    STATUS_COPY,
    describeDeliveryColumn,
    describeInvoiceColumn,
    describeInvoiceItemFill,
    describeInvoiceOverdue,
    describeInvoiceWait,
    byEntryOrder,
    fillNeedsOrder,
    fillOldestFirst,
    invoicePayment,
    describePOColumn,
    isNotFullyInvoiced,
    orderedItemDelivery,
    describePOPaymentColumn,
    summarizePODeliveryStatus,
    summarizePOInvoicingStatus,
    summarizePOPaymentStatus,
    describePOInvoicingColumn,
    orderedItemInvoicing,
    sortLongestWaitingFirst,
    summarizeDeliveryInvoicing,
    summarizeInvoiceStatus,
} from "../../../lib/deliveryStatus.js";
// The namespace too, so the module's own export list can be asserted on — #211
// deleted one export and #210 deleted four more, and "it is gone" is not a claim a
// named import can make.
import * as deliveryStatus from "../../../lib/deliveryStatus.js";
// #311 — the order detail's badge word, imported so the payment chip's third value is
// asserted to AGREE with it rather than pinned as a second literal. `lib/poDocuments.js`
// is pure and offline-loadable, which is what makes the agreement checkable at all.
import { PO_DOCUMENTS_COPY } from "../../../lib/poDocuments.js";
import { parseFile, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Delivery status — delivered vs invoiced vs ordered (#166, #640)";

export function run({ check, log, assert }) {
    // --- #640: THE ONE RULE — OLDEST FIRST, IN ENTRY ORDER -----------------
    log("an ordered item's total fills the other side's rows oldest first (#640):");
    // THE QUIET MUTANT IS AN ORDER THAT IS NOT THE ENTRY ORDER. A fill poured in the
    // order the rows arrived — record id, or link-array order — gives the same totals
    // and answers the wrong invoice, and nothing on a screen could tell. So the first
    // assertion is that the order is the ID's, whatever order the rows are handed in.
    const entry = (id, entryKey, qty) => ({ id, entryKey, qty });
    const handedLatestFirst = [
        entry("b", "HYE-INV-260911-20-001", 13),
        entry("a", "HYE-INV-260911-19-001", 13),
    ];
    const filled = fillOldestFirst(13, handedLatestFirst);
    check("the first entered takes what was delivered", filled.get("a"), 13);
    check("  and the later one waits behind it", filled.get("b"), 0);
    // The test base's own pair, measured when #640 recomputed it: an ordered item of
    // 10, 13 delivered, invoiced 13 + 13. `-19` reads Matched and `-20` Awaiting.
    const reversed = fillOldestFirst(13, [...handedLatestFirst].reverse());
    check("  whichever order the rows came in", reversed.get("a"), 13);
    check("part of one row when the total runs out inside it", fillOldestFirst(10, [entry("a", "X-001", 6), entry("b", "X-002", 6)]).get("b"), 4);
    check("nothing over a row's own quantity", fillOldestFirst(100, [entry("a", "X-001", 6)]).get("a"), 6);
    check("nothing negative from a negative total", fillOldestFirst(-5, [entry("a", "X-001", 6)]).get("a"), 0);
    check("a nullish call is an empty map", fillOldestFirst().size, 0);

    log("");
    log("entry order is the child ID, numeric, with a missing ID last:");
    const order = (keys) =>
        keys
            .map((k, i) => ({ id: `r${i}`, entryKey: k }))
            .sort(byEntryOrder)
            .map((r) => r.entryKey)
            .join(" ");
    check("an earlier day first", order(["HYE-INV-260912-01-001", "HYE-INV-260911-02-001"]), "HYE-INV-260911-02-001 HYE-INV-260912-01-001");
    check("numeric, so a day's hundredth follows its ninety-ninth", order(["HYE-INV-260911-100-001", "HYE-INV-260911-99-001"]), "HYE-INV-260911-99-001 HYE-INV-260911-100-001");
    check("an invoice's own items in their order", order(["HYE-INV-260911-01-002", "HYE-INV-260911-01-001"]), "HYE-INV-260911-01-001 HYE-INV-260911-01-002");
    check("a row with no ID sorts last", order(["", "HYE-INV-260911-01-001"]), "HYE-INV-260911-01-001 ");

    log("");
    log("the order only matters when the total covers some and not all:");
    check("nothing delivered needs no order", fillNeedsOrder(0, 26), false);
    check("everything delivered needs none either", fillNeedsOrder(26, 26), false);
    check("  nor more than everything", fillNeedsOrder(30, 26), false);
    check("part of it does", fillNeedsOrder(13, 26), true);
    // AND THE SHORTCUT AGREES WITH THE FILL — the property the detail page's skipped
    // read rests on. Outside the boundary, filling a SUBSET gives each row exactly what
    // filling every row would.
    const all = [entry("a", "X-001", 5), entry("b", "X-002", 7)];
    for (const capacity of [0, 12, 20]) {
        const whole = fillOldestFirst(capacity, all);
        const subset = fillOldestFirst(capacity, [all[1]]);
        check(`  a subset fills alike at ${capacity}`, subset.get("b"), whole.get("b"));
    }

    // --- THE INVOICE: TWO VALUES ------------------------------------------
    log("");
    log("an invoice is Matched once every item is answered, Awaiting until then:");
    const item = (qty, f) => ({ qty, filled: f });
    check("every item answered", summarizeInvoiceStatus({ items: [item(10, 10), item(5, 5)] }).key, "matched");
    check("one item short is enough", summarizeInvoiceStatus({ items: [item(10, 10), item(5, 4)] }).key, "awaiting-delivery");
    check("nothing answered", summarizeInvoiceStatus({ items: [item(10, 0)] }).key, "awaiting-delivery");
    // An invoice with no item is not vacuously Matched (#330's hand-emptied record).
    check("no items reads awaiting, not matched", summarizeInvoiceStatus({ items: [] }).key, "awaiting-delivery");
    check("nullish does not throw", summarizeInvoiceStatus().key, "awaiting-delivery");
    check("`partly` is some of it answered", summarizeInvoiceStatus({ items: [item(10, 3)] }).partly, true);
    check("  and not none of it", summarizeInvoiceStatus({ items: [item(10, 0)] }).partly, false);
    check("  nor all of it", summarizeInvoiceStatus({ items: [item(10, 10)] }).partly, false);
    check("counts items, never quantities", summarizeInvoiceStatus({ items: [item(10, 10), item(5, 4)] }).covered, 1);

    log("");
    log("the wait beside the chip, counted from the Issue Date (#640):");
    const waiting = summarizeInvoiceStatus({ items: [item(10, 0)] });
    const matched = summarizeInvoiceStatus({ items: [item(10, 10)] });
    check("an awaiting invoice says how long", describeInvoiceWait(waiting, "2026-11-01", "2026-11-12")?.text, "11d");
    check("a matched one says nothing", describeInvoiceWait(matched, "2026-11-01", "2026-11-12"), null);
    check("an undated one says nothing", describeInvoiceWait(waiting, "", "2026-11-12"), null);
    check("nor one dated after today", describeInvoiceWait(waiting, "2026-11-20", "2026-11-12"), null);
    check("it is daysWaiting's count, not a second one", describeInvoiceWait(waiting, "2026-10-01", "2026-11-12")?.days, daysWaiting("2026-10-01", "2026-11-12"));

    // --- the delivery axis: QUANTITIES, NOT AN EXISTENCE TEST --------------
    log("");
    log("a delivery is invoiced when the fill reaches what it brought:");
    const dl = (delivered, invoiced) => ({ poItemRecordId: `recPOI${delivered}${invoiced}`, delivered, invoiced });
    check("nothing invoiced — the vendor-chasing state", summarizeDeliveryInvoicing([dl(10, 0), dl(5, 0)]).key, "awaiting-invoice");
    check("both ordered items invoiced in full", summarizeDeliveryInvoicing([dl(10, 10), dl(5, 5)]).key, "invoiced");
    check("one of two invoiced", summarizeDeliveryInvoicing([dl(10, 10), dl(5, 0)]).key, "partly-invoiced");
    // A delivery can carry material nobody has invoiced yet, so "does this delivery
    // have an invoice" would read `Invoiced` while half of it is still owed.
    check("a delivery of two materials with one invoiced is PARTLY", summarizeDeliveryInvoicing([dl(10, 10), dl(8, 0)]).key, "partly-invoiced");
    check("part of one ordered item invoiced is partly too", summarizeDeliveryInvoicing([dl(10, 4)]).key, "partly-invoiced");
    // A `no-ordered-items` dash stood on both of these (#278); what is left is a
    // hand-emptied link, answered with the more useful of two wrong answers.
    check("no ordered items at all", summarizeDeliveryInvoicing([]).key, "awaiting-invoice");
    check("nullish does not throw", summarizeDeliveryInvoicing(null).key, "awaiting-invoice");
    assert(
        "  and it stays on the vendor-chasing worklist rather than reading as settled",
        isNotFullyInvoiced(summarizeDeliveryInvoicing([]).key)
    );
    check("counts the ordered items it judged", summarizeDeliveryInvoicing([dl(10, 10), dl(5, 0)]).total, 2);
    // THE FILL ON THIS SIDE: two deliveries of 6 on one ordered item, invoiced 8. The
    // first entered is answered in full and the second for 2 — Invoiced, then Partly.
    const deliveries = fillOldestFirst(8, [entry("d2", "HYE-DL-260911-05-001", 6), entry("d1", "HYE-DL-260911-04-001", 6)]);
    check("the first delivery entered is invoiced", summarizeDeliveryInvoicing([dl(6, deliveries.get("d1"))]).key, "invoiced");
    check("  and the next partly", summarizeDeliveryInvoicing([dl(6, deliveries.get("d2"))]).key, "partly-invoiced");

    // --- THE CHIPS ---------------------------------------------------------
    log("");
    log("a list cell is a CHIP: a closed set of values, and no figures:");
    check("every item answered", describeInvoiceColumn(matched).text, "Matched");
    check("anything still to come", describeInvoiceColumn(waiting).text, "Awaiting delivery");
    // #640 — TWO VALUES, AND THE ERROR WORD IS GONE WITH ITS KEY. `Delivery variance`
    // compared an invoice with the one delivery it named; a shortfall is a wait now.
    check("the invoice axis is two values", Object.keys(STATUS_COPY.column.invoice).join(","), "matched,awaiting-delivery");
    assert("  and none of them is a stage word", !Object.values(STATUS_COPY.column.invoice).some((f) => /partly/i.test(f().text)));
    check("invoiced", describeDeliveryColumn(summarizeDeliveryInvoicing([dl(10, 10)])).text, "Invoiced");
    check("partly invoiced", describeDeliveryColumn(summarizeDeliveryInvoicing([dl(10, 10), dl(5, 0)])).text, "Partly invoiced");
    check("awaiting invoice", describeDeliveryColumn(summarizeDeliveryInvoicing([dl(10, 0)])).text, "Awaiting invoice");
    check("an entry-less delivery", describeDeliveryColumn(summarizeDeliveryInvoicing([])).text, "Awaiting invoice");

    // A FRACTION IS NOT A CHIP VALUE. It changes per row, so the set stops being
    // closed; the wait travels BESIDE the chip for exactly this reason.
    const everyChip = [
        ...Object.values(STATUS_COPY.column.invoice).map((f) => f({ judged: 2, covered: 1 })),
        ...Object.values(STATUS_COPY.column.delivery).map((f) => f({ invoiced: 1, total: 2 })),
        // #169's axis joins the sweep below rather than restating it.
        ...Object.values(STATUS_COPY.column.po).map((f) => f({ ordered: 2, complete: 1 })),
    ];
    for (const chip of everyChip) {
        assert(`chip "${chip.text}" carries no figure`, !/\d/.test(chip.text));
    }
    check("both complete states share a tone", STATUS_COPY.column.invoice.matched().tone, STATUS_COPY.column.delivery.invoiced().tone);
    check("both empty states too", STATUS_COPY.column.invoice["awaiting-delivery"]().tone, STATUS_COPY.column.delivery["awaiting-invoice"]().tone);
    assert(
        "no dash on either document axis",
        !("no-ordered-items" in STATUS_COPY.column.delivery) &&
            !("no-ordered-items" in STATUS_COPY.column.invoice)
    );
    check("  and the order axis still has one", STATUS_COPY.column.po["nothing-ordered"]().tone, "absent");
    assert("every chip's key names its own text", everyChip.every((c) => c.key && c.text));

    // --- the detail's table ------------------------------------------------
    log("");
    log("the detail's table — the ordered item's totals, then this invoice's share (#640):");
    const row = describeInvoiceItemFill({ qty: 200, filled: 150, ordered: 200, delivered: 150, invoiced: 200, unit: "EA" });
    check("ordered", row.ordered, "200 EA");
    check("delivered to date", row.delivered, "150 EA");
    check("invoiced to date", row.invoiced, "200 EA");
    check("this invoice", row.thisInvoice.text, "150 of 200 EA delivered");
    check("  wearing the waiting tone", row.thisInvoice.tone, "waiting");
    const done = describeInvoiceItemFill({ qty: 12, filled: 12, ordered: 10, delivered: 12, invoiced: 12, unit: "EA" });
    check("a row answered in full", done.thisInvoice.text, "12 of 12 EA delivered");
    check("  carries no tone", done.thisInvoice.tone, undefined);
    assert("a blank unit omits it rather than printing 'undefined'", !describeInvoiceItemFill({ qty: 2, filled: 1 }).thisInvoice.text.includes("undefined"));
    check("the two cumulative heads say whose total they are", [STATUS_COPY.detail.heads.delivered, STATUS_COPY.detail.heads.invoiced].join(" | "), "Delivered to date | Invoiced to date");

    log("");
    log("FACTS, NOT VERDICTS — and ONE WORD PER FACT:");
    const everySentence = [
        ...everyChip.map((c) => c.text),
        STATUS_COPY.detail.deliveries.none().text,
        row.thisInvoice.text,
        ...Object.values(STATUS_COPY.detail.heads),
    ];
    // At any one moment "the vendor over-billed" and "the rest has not been
    // delivered yet" are the same measurement, so the copy may not pick one.
    for (const forbidden of ["over-billed", "overbilled", "short-shipped", "underdelivered", "under-delivered", "missing", "variance", "mismatch"]) {
        assert(
            `no message says "${forbidden}"`,
            !everySentence.some((t) => t.toLowerCase().includes(forbidden))
        );
    }
    // ONE NAME PER FACT. `arrived` is the same fact as `delivered`, and this app does
    // not say `Recorded as paid` either. The `line` half moved to
    // offline/line-vocabulary.mjs (#227).
    for (const forbidden of ["arriv", "recorded as", "matched to"]) {
        assert(
            `no message says "${forbidden}"`,
            !everySentence.some((t) => t.toLowerCase().includes(forbidden))
        );
    }
    assert("every sentence is non-empty", everySentence.every((t) => t && t.length > 0));

    // --- THE FILTERS -------------------------------------------------------
    log("");
    log("the vendor-chasing filter takes BOTH incomplete states (#166):");
    // Filtering on the empty state alone would drop a delivery carrying two
    // materials where only one is invoiced — which is exactly "it is here and there
    // is no invoice for it", the thing this list exists to catch.
    check("nothing invoiced", isNotFullyInvoiced("awaiting-invoice"), true);
    check("partly invoiced", isNotFullyInvoiced("partly-invoiced"), true);
    check("fully invoiced is out", isNotFullyInvoiced("invoiced"), false);
    check("a null key does not throw", isNotFullyInvoiced(null), false);

    log("");
    log("and it exists for EVERY viewer since #211:");
    // A `resolveDeliveryFilters` rule was pinned here, and five checks with it. It
    // existed to treat `?unbilled=1` as ABSENT for a viewer whose rows carried no
    // invoicing key, because getDeliveryInvoicing was not called for them. #211
    // released that withholding, which left the rule with nothing to decide, so it
    // was deleted rather than left standing. What replaces those checks is the
    // assertion that it is really gone — a re-added gate would be a second answer to
    // a question this repo has now settled once.
    assert(
        "the withheld-filter rule is gone from the module",
        !("resolveDeliveryFilters" in deliveryStatus)
    );

    // --- the strip above /invoices (#216) ----------------------------------
    // The predicate and the ordering above are what the strip selects and sorts
    // with — they did NOT move when `?unbilled=1` left /deliveries, so they keep
    // their existing checks and gain no copies. What is new here is the waiting
    // count and the copy.
    log("");
    log("how long a delivery has waited (#216):");
    check("the day it arrived is zero", daysWaiting("2026-08-12", "2026-08-12"), 0);
    check("the day after is one", daysWaiting("2026-08-11", "2026-08-12"), 1);
    check("across a month boundary", daysWaiting("2026-07-31", "2026-08-12"), 12);
    // A LEAP-YEAR FEBRUARY, because date arithmetic done by hand is where this
    // would break and 2028 is the next one this app will see.
    check("across a leap day", daysWaiting("2028-02-28", "2028-03-01"), 2);
    check("a missing date is null, not zero", daysWaiting("", "2026-08-12"), null);
    // ASSERTED WITH `===` RATHER THAN `check`, because `check` renders its actual
    // through JSON.stringify and NaN comes out as `null` — so a genuine failure
    // here would print "got null, expected null" and read like a pass. Measured
    // while mutating this very clause.
    assert(
        "an unparseable date is null and not NaN",
        daysWaiting("not-a-date", "2026-08-12") === null
    );
    check("a missing today is null", daysWaiting("2026-08-01", ""), null);
    // NULL AND ZERO MUST NOT COLLIDE: zero means it arrived today, null means
    // there is no date to measure from, and a row renders them differently.
    assert("null is distinguishable from zero", daysWaiting("", "2026-08-12") !== 0);

    log("");
    log("what the strip says — ONE voice, because it offers no action:");
    check(
        "one delivery reads as one",
        AWAITING_INVOICE_COPY.heading(1),
        "1 delivery is waiting for an invoice"
    );
    check(
        "and two do not",
        AWAITING_INVOICE_COPY.heading(2),
        "2 deliveries are waiting for an invoice"
    );
    assert(
        "the singular and plural headings actually differ",
        AWAITING_INVOICE_COPY.heading(1) !== AWAITING_INVOICE_COPY.heading(2)
    );
    assert("the explanation is a sentence", /^[A-Z].*\.$/.test(AWAITING_INVOICE_COPY.explain.trim()));
    assert(
        "it names the ordering, which is the thing a reader cannot see",
        /longest wait first/i.test(AWAITING_INVOICE_COPY.explain)
    );
    // IT MUST NOT POINT AT A CONTROL. `/invoices` has a `New invoice` button that
    // only an Admin sees, and this strip renders for every viewer who can reach a
    // delivery — copy naming that button would describe something half its readers
    // do not have. This is the assertion that keeps the one-voice decision honest:
    // the moment the copy tells someone to press something, it needs two voices.
    for (const word of ["New invoice", "record", "button", "click", "press", "add"]) {
        assert(
            `the explanation does not point at a control ("${word}")`,
            !AWAITING_INVOICE_COPY.explain.toLowerCase().includes(word.toLowerCase())
        );
    }

    // --- the worklist order -----------------------------------------------
    log("");
    log("the vendor-chasing worklist: longest-waiting first (#166):");
    // BOTH FIELDS ARE NEUTRAL NAMES SINCE #256 — `waitingSince` when a third caller
    // began ordering by an invoice's `Issue Date`, and `createdKey` when that same
    // caller turned out to have no creation timestamp to tie-break on. These fixtures
    // carry the neutral names because that is what the function reads; which value a
    // caller puts in either is the call site's claim, and each one now states it.
    const rows = [
        { id: "b", waitingSince: "2026-07-20", createdKey: "2026-07-20T10:00:00.000Z" },
        { id: "a", waitingSince: "2026-07-10", createdKey: "2026-07-11T10:00:00.000Z" },
        { id: "c", waitingSince: "2026-07-20", createdKey: "2026-07-21T10:00:00.000Z" },
    ];
    const sorted = sortLongestWaitingFirst(rows);
    check("waiting-since ascending", sorted.map((r) => r.id).join(""), "acb");
    // The creation key DESC as the tie-break, matching the default list's direction so
    // only the primary key flips between the two orderings.
    check("ties broken by creation key descending", sorted[1].id, "c");
    // IT SORTS AN ID AS WELL AS A STAMP, which is the whole point of the second
    // rename: an `Invoice ID` rises with creation because its date half is the mint
    // moment (#164), so the same descending compare serves both kinds of value.
    const byId = sortLongestWaitingFirst([
        { id: "older", waitingSince: "2026-07-16", createdKey: "HYE-INV-260716-02" },
        { id: "newer", waitingSince: "2026-07-16", createdKey: "HYE-INV-260716-03" },
    ]);
    check("an id tie-breaks the same way a stamp does", byId[0].id, "newer");
    assert("does not mutate its input", rows[0].id === "b");
    // A data gap must not take the top of a worklist — the same call
    // sortCandidates makes for the head of its FIFO queue.
    const withUndated = sortLongestWaitingFirst([...rows, { id: "z", waitingSince: "", createdAt: "2026-01-01T00:00:00.000Z" }]);
    check("an undated row sorts LAST, not first", withUndated.at(-1).id, "z");
    // AND THE OLD NAME IS INERT, which is what makes the rename a rename rather than
    // an addition: a row carrying only `receivedDate` is undated to this function now,
    // so a call site left unconverted sorts last instead of silently sorting right.
    const legacy = sortLongestWaitingFirst([
        { id: "old", receivedDate: "2026-01-01" },
        { id: "new", waitingSince: "2026-07-01" },
    ]);
    check("a row with only the old field is treated as undated", legacy.at(-1).id, "old");
    // The same for the tie-break's old name, so an unconverted call site loses its
    // tie-break loudly — by holding input order — rather than appearing to keep one.
    const legacyTie = sortLongestWaitingFirst([
        { id: "first", waitingSince: "2026-07-16", createdAt: "2026-07-01T00:00:00.000Z" },
        { id: "second", waitingSince: "2026-07-16", createdAt: "2026-07-20T00:00:00.000Z" },
    ]);
    check("only the old tie-break field breaks no tie", legacyTie[0].id, "first");
    check("nullish does not throw", sortLongestWaitingFirst(null).length, 0);
    check("a single row is returned as-is", sortLongestWaitingFirst([rows[0]])[0].id, "b");

    // ── the PO axis: delivered against ORDERED (#169) ───────────────────────
    log("");
    log("orderedItemDelivery — one ordered item against its own order:");
    const orderedItem = (orderedQty, deliveredQty, committedQty = orderedQty) =>
        ({ orderedQty, deliveredQty, committedQty });

    check("nothing delivered is not complete", orderedItemDelivery(orderedItem(10, 0)).complete, false);
    check("and reports no delivery at all", orderedItemDelivery(orderedItem(10, 0)).anyDelivered, false);
    check("part delivered is not complete", orderedItemDelivery(orderedItem(10, 4)).complete, false);
    check("but does report a delivery", orderedItemDelivery(orderedItem(10, 4)).anyDelivered, true);
    check("exactly the ordered quantity IS complete", orderedItemDelivery(orderedItem(10, 10)).complete, true);
    // Over-delivery clears the ordered item rather than overshooting into a state
    // of its own. The within/beyond split #166 needs is exactly what this axis
    // does not.
    check("more than ordered is complete too", orderedItemDelivery(orderedItem(10, 13)).complete, true);
    check("a blank rollup reads as nothing delivered", orderedItemDelivery({ orderedQty: 10, committedQty: 10 }).delivered, 0);
    check("nullish input does not throw", orderedItemDelivery().complete, true);

    log("");
    log("summarizePODeliveryStatus — counts ordered items, never quantities:");
    const summary = (orderedItems) => summarizePODeliveryStatus(orderedItems).key;
    check("every item complete", summary([orderedItem(10, 10), orderedItem(5, 5)]), "delivered");
    check("no quantity at all", summary([orderedItem(10, 0), orderedItem(5, 0)]), "awaiting-delivery");
    check("some items complete", summary([orderedItem(10, 10), orderedItem(5, 0)]), "partly-delivered");
    // #166'S LESSON, PAID FORWARD RATHER THAN RE-LEARNED. Keying the empty state
    // on the completed COUNT made a one-item order of 13 with 10 delivered read as
    // nothing delivered.
    check("ONE item, part delivered, is partly — not awaiting", summary([orderedItem(13, 10)]), "partly-delivered");
    check("part of one item on a two-item order is partly", summary([orderedItem(10, 1), orderedItem(5, 0)]), "partly-delivered");
    check("an order with no items at all", summary([]), "nothing-ordered");
    check("nullish does not throw", summary(null), "nothing-ordered");

    // MIXED UNITS ARE WHY IT COUNTS ITEMS. Summing 5 SHEET and 5 FT gives a
    // number of nothing, so the shape below must not read as half-delivered:
    // both items are complete on their own terms.
    check(
        "two items in different units, each complete, is delivered",
        summary([orderedItem(5, 5), orderedItem(500, 500)]),
        "delivered"
    );

    log("");
    log("withdrawn orders fall out through countsAsOrdered, not a status string:");
    // A withdrawn PO's every ordered item has Committed Qty 0 (#18's formula), so the
    // judged set empties and the chip is the dash.
    const withdrawn = [orderedItem(10, 10, 0), orderedItem(5, 0, 0)];
    check("a withdrawn order reports nothing-ordered", summary(withdrawn), "nothing-ordered");
    // ANTI-VACUITY #1. The assertion above also passes if the summarizer ignored
    // its input, returned the dash for everything, or received an empty array. The
    // SAME ordered items with a live Committed Qty must therefore reach a different
    // answer — that is what shows countsAsOrdered is the thing doing the work.
    check(
        "the same lines with a live Committed Qty do NOT",
        summary([orderedItem(10, 10, 10), orderedItem(5, 0, 5)]),
        "partly-delivered"
    );
    check("a Qty-0 line on a live order is excluded too", summary([orderedItem(10, 10), orderedItem(0, 0, 0)]), "delivered");
    check("judged counts only the lines that count", summarizePODeliveryStatus(withdrawn).ordered, 0);

    log("");
    log("the chip — the invoice axis's own words, and #623 left ONE of the three shared:");
    // #623 split the complete state: `Matched` is the invoice matched to a delivery
    // that covered it, `Delivered` how much of an order has been delivered. One fact
    // each, so one word each, and the order's word may not come back to the invoice.
    check("the invoice's complete state is its own word", STATUS_COPY.column.invoice.matched().text, "Matched");
    assert(
        "  and not the order's, which stays",
        STATUS_COPY.column.po.delivered().text === "Delivered" &&
            STATUS_COPY.column.invoice.matched().text !== STATUS_COPY.column.po.delivered().text
    );
    assert("  under a key of its own", !("delivered" in STATUS_COPY.column.invoice) && "delivered" in STATUS_COPY.column.po);
    // ANTI-VACUITY #2. The word still shared is claimed to be REUSED, and nothing else
    // here would notice one axis being edited without the other. Comparing the two
    // maps is the claim itself rather than a restatement of either.
    for (const key of ["awaiting-delivery"]) {
        check(
            `"${key}" reads identically on both axes`,
            STATUS_COPY.column.po[key]().text,
            STATUS_COPY.column.invoice[key]().text
        );
        check(
            `and carries the same tone`,
            STATUS_COPY.column.po[key]().tone,
            STATUS_COPY.column.invoice[key]().tone
        );
    }
    // `partly-delivered` HAS NO SIBLING TO BE COMPARED WITH ANY MORE, and saying so
    // is the honest form of this check. #210 took the middle stage off the invoice
    // axis, where it read as progress toward a whole; here an order really is filled
    // item by item over time, so it stays — and nothing now pins its wording, which
    // is a fact about the coverage rather than a gap to paper over.
    assert(
        "the middle stage is the PO axis's alone now",
        "partly-delivered" in STATUS_COPY.column.po &&
            !("partly-delivered" in STATUS_COPY.column.invoice)
    );
    check("and it still reads as it did", STATUS_COPY.column.po["partly-delivered"]().text, "Partly delivered");
    // The dash is the one key that is NOT shared, because it is not the same fact.
    assert(
        "the dash key is named after the predicate, not after the delivery axis's case",
        Object.keys(STATUS_COPY.column.po).includes("nothing-ordered") &&
            !Object.keys(STATUS_COPY.column.po).includes("no-ordered-items")
    );
    check("and it renders as a dash", STATUS_COPY.column.po["nothing-ordered"]().text, "—");
    check("with the absent tone, so it is not a chip", STATUS_COPY.column.po["nothing-ordered"]().tone, "absent");

    // Every key the summarizer can produce has copy. A missing entry would throw
    // at render time on a page nobody exercised, which is the failure this catches.
    for (const orderedItems of [[orderedItem(10, 10)], [orderedItem(10, 0)], [orderedItem(10, 4)], []]) {
        const s = summarizePODeliveryStatus(orderedItems);
        assert(`describePOColumn resolves "${s.key}"`, Boolean(describePOColumn(s)?.text));
    }

    // ── #235: THE INVOICING AXIS AT THE SAME SCOPE ─────────────────────────
    log("");
    log("THE QUIET MUTANT — a verdict that never changes is a chip that always reads:");
    // This rule's failure mode is a constant. One word in every row looks like a
    // list where nothing has been invoiced, or one where everything has, and no other
    // check in this repository reads these keys — the station #237's `always agree`,
    // #242's removed narrowing, #241's always-silent list, #238's unfolded table and
    // #179's one word for two kinds stand at. So the first assertion is that the
    // four inputs below do not collapse to one answer.
    const orderedItemInvoice = (qty, invoiced, committed = qty) => ({
        orderedQty: qty,
        invoicedQty: invoiced,
        committedQty: committed,
    });
    const invoicing = (orderedItems) => summarizePOInvoicingStatus(orderedItems).key;
    const everyState = [
        ["invoiced", [orderedItemInvoice(10, 10), orderedItemInvoice(5, 5)]],
        ["partly-invoiced", [orderedItemInvoice(10, 10), orderedItemInvoice(5, 0)]],
        ["awaiting-invoice", [orderedItemInvoice(10, 0), orderedItemInvoice(5, 0)]],
        ["nothing-ordered", [orderedItemInvoice(10, 10, 0)]],
    ];
    const alwaysAwaiting = () => "awaiting-invoice";
    for (const [expected, orderedItems] of everyState) {
        check(`  ${expected}`, invoicing(orderedItems), expected);
    }
    assert(
        "  so a constant verdict disagrees on three of the four",
        everyState.filter(([, orderedItems]) => alwaysAwaiting(orderedItems) !== invoicing(orderedItems)).length === 3
    );

    log("");
    log("it is the delivery summary's pair, field for field:");
    // The two are claimed to be the same fold at the same scope. Comparing their
    // SHAPES is that claim rather than a restatement of either, and a field added to
    // one and not the other is what this would catch.
    const shapeOf = (o) => Object.keys(o).sort().join(",");

    // #227 held `invoiceShareStatus` and `orderedItemStatus` to one shape here; both
    // went with the comparison against one delivery (#640), and the fill's rows carry
    // the figures a detail row needs without a second shape to keep in step.
    check(
        "same result shape",
        shapeOf(summarizePOInvoicingStatus([orderedItemInvoice(10, 4)])),
        shapeOf(summarizePODeliveryStatus([orderedItem(10, 4)])).replace("anyDelivered", "anyInvoiced")
    );
    check("a half-invoiced ordered item is the middle state", invoicing([orderedItemInvoice(10, 4)]), "partly-invoiced");
    check(
        "  which the delivery axis reads the same way",
        summarizePODeliveryStatus([orderedItem(10, 4)]).key,
        "partly-delivered"
    );
    // The INVOICE axis has no middle VALUE: #210 barred it under the one-delivery
    // premise, and #640 keeps it off the chip for a different reason — the chip answers
    // "has what we are charged for arrived", and how much has is the detail's table. An
    // order's middle is its progress, so it is real here — asserted rather than assumed.
    assert(
        "the middle state exists on both order-scope axes and on neither invoice-scope one",
        "partly-invoiced" in STATUS_COPY.column.poInvoicing &&
            "partly-delivered" in STATUS_COPY.column.po &&
            !("partly-delivered" in STATUS_COPY.column.invoice)
    );

    log("");
    log("invoiced beyond the order counts as invoiced, the way delivered beyond it does:");
    check("one ordered item invoiced past its Qty", invoicing([orderedItemInvoice(10, 13)]), "invoiced");
    check("  and its own line says so", orderedItemInvoicing(orderedItemInvoice(10, 13)).complete, true);
    check(
        "  which is what the delivery axis does with an over-delivery",
        summarizePODeliveryStatus([orderedItem(10, 13)]).key,
        "delivered"
    );
    // The excess is not lost by that: it is a per-ordered-item fact, marked `(over)`
    // beside `Invoiced` and flagged as #179's `Order variance` on the item.
    check("a partly-invoiced order with one over-billed item stays partly invoiced",
        invoicing([orderedItemInvoice(10, 13), orderedItemInvoice(5, 0)]), "partly-invoiced");

    log("");
    log("a withdrawn order drops out through the same field as on the delivery axis:");
    check("nothing-ordered", invoicing([orderedItemInvoice(10, 10, 0), orderedItemInvoice(5, 0, 0)]), "nothing-ordered");
    check(
        "  and the same ordered items with a live Committed Qty do not",
        invoicing([orderedItemInvoice(10, 10, 10), orderedItemInvoice(5, 0, 5)]),
        "partly-invoiced"
    );
    check("judged counts only what counts", summarizePOInvoicingStatus([orderedItemInvoice(10, 10, 0)]).ordered, 0);

    log("");
    log("the chip — its own words, sharing the delivery axis's tones:");
    // ONE STEM, and the assertion is the whole set rather than three literals: every
    // word here has to come off `invoice`, which is what `Billed` / `Partly billed`
    // broke while `Awaiting invoice` sat beside them. #166 made the same call for
    // `arrival` against `delivery`.
    check("invoiced", STATUS_COPY.column.poInvoicing.invoiced().text, "Invoiced");
    check("partly invoiced", STATUS_COPY.column.poInvoicing["partly-invoiced"]().text, "Partly invoiced");
    assert(
        "every word in the set is built on `invoice`",
        Object.values(STATUS_COPY.column.poInvoicing)
            .map((f) => f().text)
            .filter((t) => t !== "—")
            .every((t) => /invoice/i.test(t))
    );
    assert(
        "  and none of them says `bill`",
        !Object.values(STATUS_COPY.column.poInvoicing).some((f) => /bill/i.test(f().text))
    );
    // The three words are the deliveries list's own, which is one question at two
    // scopes rather than two vocabularies for one.
    for (const key of ["invoiced", "partly-invoiced", "awaiting-invoice"]) {
        check(
            `"${key}" reads as it does on the deliveries list`,
            STATUS_COPY.column.poInvoicing[key]().text,
            STATUS_COPY.column.delivery[key]().text
        );
    }
    check("and the dash", STATUS_COPY.column.poInvoicing["nothing-ordered"]().text, "—");
    for (const [ours, theirs] of [
        ["invoiced", "delivered"],
        ["partly-invoiced", "partly-delivered"],
        ["awaiting-invoice", "awaiting-delivery"],
        ["nothing-ordered", "nothing-ordered"],
    ]) {
        check(
            `"${ours}" wears the tone "${theirs}" wears`,
            STATUS_COPY.column.poInvoicing[ours]().tone,
            STATUS_COPY.column.po[theirs]().tone
        );
    }
    assert(
        "and no word is shared with the delivery axis at this scope",
        !Object.keys(STATUS_COPY.column.poInvoicing).some(
            (k) =>
                k !== "nothing-ordered" &&
                Object.values(STATUS_COPY.column.po).some(
                    (f) => f().text === STATUS_COPY.column.poInvoicing[k]().text
                )
        )
    );
    for (const orderedItems of [[orderedItemInvoice(10, 10)], [orderedItemInvoice(10, 0)], [orderedItemInvoice(10, 4)], []]) {
        const sum = summarizePOInvoicingStatus(orderedItems);
        assert(`describePOInvoicingColumn resolves "${sum.key}"`, Boolean(describePOInvoicingColumn(sum)?.text));
    }

    // ── #311: THE PAYMENT AXIS ──────────────────────────────────────────────
    //
    // THE THIRD ORDER-SCOPE SUMMARY, AND THE ONE FOLDING DOCUMENTS RATHER THAN
    // ORDERED ITEMS. `paid` is not a fact an order holds — an order is charged by
    // several invoices and an invoice charges several orders — so what this states is
    // a fact about the DOCUMENTS, and the whole table is here because a reader of the
    // list and a reader of the order's own page must be told the same thing.
    log("");
    log("summarizePOPaymentStatus — folds invoices, never quantities (#311):");
    const TODAY = "2026-08-28";
    // #318 — A PAID INVOICE IS ONE WITH A DATE. `Invoices."Paid"` is gone from the
    // base, so the fixture's first argument still means "is it paid" and is now
    // realized as the presence of a `Paid Date` rather than as a flag. Every row of
    // the table below reads unchanged, which is the point: what moved is the field the
    // judgment asks, not the judgment.
    const PAID_ON = "2026-08-14";
    const inv = (paid, dueDate = "2026-09-30") => ({
        paidDate: paid ? PAID_ON : null,
        dueDate,
    });
    const payment = (invoices, today = TODAY) => summarizePOPaymentStatus(invoices, today).key;

    const everyPaymentState = [
        ["paid", [inv(true), inv(true)]],
        ["partly-paid", [inv(true), inv(false)]],
        ["not-paid", [inv(false), inv(false)]],
        ["nothing-invoiced", []],
    ];
    for (const [expected, invoices] of everyPaymentState) {
        check(`  ${expected}`, payment(invoices), expected);
    }
    // ANTI-VACUITY, the shape its two siblings use: a constant verdict has to
    // disagree with the table on all but one row, or the four inputs collapse.
    assert(
        "  so a constant verdict disagrees on three of the four",
        everyPaymentState.filter(([, invoices]) => payment(invoices) !== "not-paid").length === 3
    );

    // THE EMPTY SET IS THE ONE THAT COULD HAVE GONE EITHER WAY. "every invoice is
    // paid" and "none is paid" are both vacuously true of no invoices, so an order
    // nothing has charged would read as whichever the arithmetic reached first. It
    // asserts no debt instead.
    check("an order nothing charges says nothing", payment([]), "nothing-invoiced");
    check("  and that is the dash, not a chip", STATUS_COPY.column.poPayment["nothing-invoiced"]().text, "—");
    check("  wearing the tone its two siblings give an unmeasured state", STATUS_COPY.column.poPayment["nothing-invoiced"]().tone, "absent");

    log("");
    log("lateness is a second fact from the same call, not a fifth value:");
    // THE CASE THAT DECIDED THE SHAPE. One paid invoice and one late one: a closed
    // set has to pick a single value and either pick throws away something the reader
    // came for. Both survive because the badge composes.
    const mixed = summarizePOPaymentStatus([inv(true), inv(false, "2026-08-21")], TODAY);
    check("one paid and one late is still `partly-paid`", mixed.key, "partly-paid");
    assert("  and it is overdue as well", mixed.overdue);
    assert(
        "  so the two facts are carried together rather than one chosen",
        mixed.key === "partly-paid" && mixed.overdue === true
    );
    // A PAID SET CANNOT BE LATE, which is what makes the badge composable with two
    // chips and not three.
    assert(
        "a paid invoice past its due date is not overdue",
        !summarizePOPaymentStatus([inv(true, "2026-01-01")], TODAY).overdue
    );
    check("  and the chip it would compose with does not arise", payment([inv(true, "2026-01-01")]), "paid");

    log("");
    log("the boundary, and what has no boundary to cross:");
    // `dueDate < today`, so the due day itself still has time — the direction
    // lib/authTokenState.js takes with `expiresAt < now`.
    assert("the day before today is overdue", summarizePOPaymentStatus([inv(false, "2026-08-27")], TODAY).overdue);
    assert("  today itself is not", !summarizePOPaymentStatus([inv(false, "2026-08-28")], TODAY).overdue);
    assert("  and tomorrow is not", !summarizePOPaymentStatus([inv(false, "2026-08-29")], TODAY).overdue);
    // A BLANK `Due Date` IS NOT LATE — there is nothing to have passed. Reachable:
    // the field is optional on both invoice write paths, so this is an ordinary
    // record rather than a hand edit. #263's call on a null wait, one field across.
    assert("an unpaid invoice with no due date is not overdue", !summarizePOPaymentStatus([inv(false, null)], TODAY).overdue);
    assert("  nor with an empty one", !summarizePOPaymentStatus([inv(false, "")], TODAY).overdue);
    check("  and it still counts as an unpaid invoice", payment([inv(false, null)]), "not-paid");

    log("");
    log("invoicePayment carries the verdict and its figure out of one expression (#316):");
    // ON THE FUNCTION ITSELF RATHER THAN THROUGH THE FOLD, which is what this issue
    // added to the table above. Every assertion up to here reaches `invoicePayment`
    // through `summarizePOPaymentStatus`, which reads `overdue` and drops the rest —
    // so the figure the two invoice screens render was outside this table entirely.
    const judge = (paid, dueDate, today = TODAY) =>
        invoicePayment({ paidDate: paid ? PAID_ON : null, dueDate }, today);
    check(
        "it returns three fields, the third being the figure",
        shapeOf(judge(false, "2026-08-21")),
        shapeOf({ paid: 0, overdue: 0, daysOverdue: 0 })
    );
    check("a day past the due date is one day overdue", judge(false, "2026-08-27").daysOverdue, 1);
    check("  and ten days past is ten", judge(false, "2026-08-18").daysOverdue, 10);

    // THE DERIVATION ITSELF, WHICH IS THE POINT OF THE SHAPE. `overdue` is computed
    // FROM the count rather than beside it, so the two cannot disagree at the
    // boundary — the failure this would otherwise have is a cell reading `0d` while
    // claiming lateness. Asserted as an equivalence over the whole spread rather than
    // row by row, because what is being held is that one implication is the other.
    const spread = [
        [false, "2026-08-18"],
        [false, "2026-08-27"],
        [false, "2026-08-28"],
        [false, "2026-08-29"],
        [false, "2026-12-31"],
        [false, null],
        [false, ""],
        [true, "2026-01-01"],
        [true, "2026-08-27"],
    ];
    assert(
        "overdue is true exactly where the count is a day or more",
        spread.every(([paid, due]) => {
            const p = judge(paid, due);
            return p.overdue === (typeof p.daysOverdue === "number" && p.daysOverdue >= 1);
        })
    );
    // ANTI-VACUITY: an equivalence is also satisfied by a spread that is all one
    // answer, so both sides have to occur in it.
    assert(
        "  and the spread reaches both answers",
        spread.some(([p, d]) => judge(p, d).overdue) && spread.some(([p, d]) => !judge(p, d).overdue)
    );

    // NULL WHERE THE BADGE DOES NOT STAND, NEVER 0. A figure exists exactly where
    // there is something to state, so no copy branch can render `0d` and no caller
    // has to test the number as well as the verdict.
    for (const [label, paid, due] of [
        ["the due day itself", false, "2026-08-28"],
        ["a due date still ahead", false, "2026-12-31"],
        ["a blank due date", false, null],
        ["an empty one", false, ""],
        ["a paid invoice long past its due date", true, "2026-01-01"],
    ]) {
        check(`  ${label} carries no figure`, judge(paid, due).daysOverdue, null);
    }

    // THE CONTRACT THIS ISSUE CHANGED, PINNED SO IT IS A DECISION RATHER THAN A
    // SIDE EFFECT. `dueDate < today` was a STRING comparison, so an unparseable due
    // date was judged by lexical order; the count is `daysWaiting`'s now, which
    // returns null for one, and a null count is not late. `summarizePOPaymentStatus`
    // folds this function, so `/pos` and `/pos/[poId]` took the new judgment too —
    // unobserved on this base, where all 23 invoices carry a parseable date.
    log("");
    log("a date is the whole of the payment, and the flag is not consulted (#318):");
    // THE CONTRACT THIS ISSUE CHANGED, PINNED THE WAY #316's IS BELOW. `Invoices."Paid"`
    // was a checkbox beside the date; the two made four combinations of which two had a
    // meaning, and nothing refused a date on an invoice the box called unpaid. The
    // judgment reads the date now, so `paid` is its presence — and the two combinations
    // that had no meaning cannot be represented at all.
    check("an invoice with a date is paid", invoicePayment({ paidDate: PAID_ON }, TODAY).paid, true);
    check("  and one without is not", invoicePayment({ paidDate: null }, TODAY).paid, false);
    check("  nor is one with an empty string", invoicePayment({ paidDate: "" }, TODAY).paid, false);
    check("  nor one with no field at all", invoicePayment({}, TODAY).paid, false);
    // AND A FLAG IS NOT A WAY IN. A caller still handing the old shape gets the answer
    // the RECORD would give — no date, not paid — rather than the flag's. That is the
    // mutation this pins: restore the flag as the input and this row flips.
    check(
        "a `paid` flag with no date does not make an invoice paid",
        invoicePayment({ paid: true, dueDate: "2026-09-30" }, TODAY).paid,
        false
    );
    check(
        "  and a date with the flag off still does",
        invoicePayment({ paid: false, paidDate: PAID_ON }, TODAY).paid,
        true
    );
    // THE LATENESS AXIS INHERITS IT, which is the reach this change has beyond the two
    // invoice screens: only an unpaid invoice can be late, and `unpaid` is now `no date`.
    assert(
        "an invoice with a date is not late however far past its due date",
        !invoicePayment({ paidDate: PAID_ON, dueDate: "2026-01-01" }, TODAY).overdue
    );
    assert(
        "  while the same invoice with the date cleared is",
        invoicePayment({ paidDate: null, dueDate: "2026-01-01" }, TODAY).overdue
    );

    const UNPARSEABLE = "2026-00-15";
    assert("an unparseable due date is not late", !judge(false, UNPARSEABLE).overdue);
    check("  and carries no figure either", judge(false, UNPARSEABLE).daysOverdue, null);
    // The rule this replaced, run rather than described: it was a string comparison,
    // and this string sorts before today, so it used to read as overdue.
    assert("  where the string comparison it replaced said late", UNPARSEABLE < TODAY);
    assert("  and the date really is unparseable", daysWaiting(UNPARSEABLE, TODAY) === null);
    // A date that ROLLS OVER is a different case and is deliberately not one of these:
    // `Date.parse` accepts `2026-02-30` as March 2, so the two rules agree on it and
    // only a month or a day outside its range reaches the divergence above.
    assert("  while a date that rolls over is judged, not refused", judge(false, "2026-02-30").overdue);
    // The other missing input, which `summarizePOPaymentStatus` cannot produce and a
    // direct caller can. `daysWaiting` refuses it, so this needs no guard of its own.
    assert("a missing `today` judges nothing", !invoicePayment({ paidDate: null, dueDate: "2026-01-01" }).overdue);

    log("");
    log("the chip — one stem, and the word this app already had:");
    check("paid", STATUS_COPY.column.poPayment.paid().text, "Paid");
    check("partly paid", STATUS_COPY.column.poPayment["partly-paid"]().text, "Partly paid");
    // `Not paid` RATHER THAN A THIRD WORD. The app had two names for one fact before
    // #311 — `Unpaid` on the invoice list and `Not paid` on the order detail's badge
    // — and this axis converged them instead of coining `Awaiting payment` to match
    // its two siblings' third value. So the assertion is agreement with the badge,
    // not a literal: a rewording of either has to move both.
    check("not paid", STATUS_COPY.column.poPayment["not-paid"]().text, PO_DOCUMENTS_COPY.badge.notPaid);
    check("  which is the word, spelled out once here", STATUS_COPY.column.poPayment["not-paid"]().text, "Not paid");
    assert(
        "every word in the set is built on `paid`",
        Object.values(STATUS_COPY.column.poPayment)
            .map((f) => f().text)
            .filter((t) => t !== "—")
            .every((t) => /paid/i.test(t))
    );
    assert(
        "  and none of them says `unpaid`",
        !Object.values(STATUS_COPY.column.poPayment).some((f) => /unpaid/i.test(f().text))
    );
    // `partly`, never `partially` — the rule the delivery axis set and the invoicing
    // axis followed.
    check(
        "the middle word reads like its two siblings",
        STATUS_COPY.column.poPayment["partly-paid"]().text.split(" ")[0],
        STATUS_COPY.column.poInvoicing["partly-invoiced"]().text.split(" ")[0]
    );
    // The tones are the delivery axis's, so a reader crossing three chips on one row
    // meets one palette.
    for (const [ours, theirs] of [
        ["paid", "delivered"],
        ["partly-paid", "partly-delivered"],
        ["not-paid", "awaiting-delivery"],
        ["nothing-invoiced", "nothing-ordered"],
    ]) {
        check(
            `"${ours}" wears the tone "${theirs}" wears`,
            STATUS_COPY.column.poPayment[ours]().tone,
            STATUS_COPY.column.po[theirs]().tone
        );
    }

    log("");
    log("the badge, and the figures it deliberately does not carry:");
    check("its word", STATUS_COPY.column.poPaymentOverdue.text, "⚠ Overdue");
    assert(
        "it carries no tone, because it is not a value of the set",
        STATUS_COPY.column.poPaymentOverdue.tone === undefined
    );
    // NO COUNT AND NO DAY FIGURE. A day count belongs to one invoice while the badge
    // is about a set, and #233's rule bars money outright.
    assert("and no digit at all", !/\d/.test(STATUS_COPY.column.poPaymentOverdue.text));
    assert("  nor a currency mark", !/[$]/.test(STATUS_COPY.column.poPaymentOverdue.text));
    assert(
        "  and no chip on this axis carries one either",
        !Object.values(STATUS_COPY.column.poPayment).some((f) => /[\d$]/.test(f().text))
    );
    // It wears the same glyph as the app's other look-at-this badge, and there are
    // only the two.
    assert(
        "it is the same glyph the variance badge wears",
        STATUS_COPY.column.poPaymentOverdue.text.startsWith("⚠")
    );

    log("");
    log("the same badge one scope down, where the figure has one candidate (#316):");
    const late = (days) => describeInvoiceOverdue({ overdue: true, daysOverdue: days });
    check("its word carries the count", late(10).badge.text, "⚠ Overdue · 10d");
    // THE FIRST WORD IS THE ORDER LIST'S WHOLE BADGE, which is what stops one fact
    // becoming two names across three screens — #311's own convergence, held as a
    // prefix rather than as two literals that happen to agree.
    assert(
        "and it opens with the order list's badge, whole",
        late(10).badge.text.startsWith(STATUS_COPY.column.poPaymentOverdue.text)
    );
    assert(
        "  so the two are one word plus a figure, not two wordings",
        late(10).badge.text.replace(STATUS_COPY.column.poPaymentOverdue.text, "").trim() === "· 10d"
    );
    assert("it carries no tone either, being a badge and not a chip", late(10).badge.tone === undefined);
    // THE FIGURE IS WHAT THE SCOPE BUYS, so this is the one place on this axis where a
    // digit is correct — the assertion above that no order-scope string carries one
    // still stands, and these two are what it is being told apart from.
    assert("it carries a digit, which the order-scope badge may not", /\d/.test(late(10).badge.text));
    assert("  and still no currency mark", !/[$]/.test(late(10).badge.text));

    log("");
    log("and as a sentence, for the invoice's own page:");
    check(
        "it states the figure against what it counts from",
        late(10).sentence.text,
        "⚠ Overdue — this invoice is 10 days past its due date."
    );
    check("one day is singular", late(1).sentence.text, "⚠ Overdue — this invoice is 1 day past its due date.");
    assert("  and two are not", /2 days/.test(late(2).sentence.text));
    assert(
        "the sentence leads with the badge's own word, as the variance pair does",
        late(10).sentence.text.startsWith(STATUS_COPY.column.poPaymentOverdue.text)
    );
    assert("it names its subject, which a cell cannot afford", /this invoice/.test(late(10).sentence.text));
    // ONE CONDITION FOR TWO SCREENS. The slots are null together, so neither the list
    // nor the invoice's own page can decide for itself when the mark applies — which
    // is #311's divergence one scope down, and the reason this is one describer.
    for (const notLate of [
        invoicePayment({ paidDate: null, dueDate: "2026-08-28" }, TODAY),
        invoicePayment({ paidDate: null, dueDate: null }, TODAY),
        invoicePayment({ paidDate: PAID_ON, dueDate: "2026-01-01" }, TODAY),
        undefined,
    ]) {
        const described = describeInvoiceOverdue(notLate);
        assert("  both slots are null where the mark does not stand", described.badge === null && described.sentence === null);
    }
    assert(
        "  and both are filled where it does",
        Boolean(late(1).badge?.text) && Boolean(late(1).sentence?.text)
    );
    // The judgment is handed in, so this function has nothing to derive from — a
    // record passed instead would give the judgment a second home.
    check(
        "the describer reads the judgment and never a record",
        describeInvoiceOverdue({ paid: false, dueDate: "2026-01-01" }).badge,
        null
    );

    log("");
    log("describePOPaymentColumn hands over both slots, never one:");
    for (const invoices of [[inv(true)], [inv(false)], [inv(true), inv(false)], []]) {
        const sum = summarizePOPaymentStatus(invoices, TODAY);
        const described = describePOPaymentColumn(sum);
        assert(`  "${sum.key}" resolves a chip`, Boolean(described.chip?.text));
        assert(`  "${sum.key}" carries an overdue slot`, "overdue" in described);
    }
    // The slot is NULL where the badge cannot compose, so a screen renders what it is
    // given rather than re-deciding when lateness applies — `describeInvoiceLine`'s
    // named-slot rule, one axis along.
    assert(
        "the slot is null on a chip the badge cannot compose with",
        describePOPaymentColumn(summarizePOPaymentStatus([inv(true)], TODAY)).overdue === null
    );
    assert(
        "  and filled where it can",
        describePOPaymentColumn(summarizePOPaymentStatus([inv(false, "2026-08-21")], TODAY)).overdue?.text ===
            "⚠ Overdue"
    );

    log("");
    log("it is the two other order-scope summaries' pair, field for field:");
    // The same claim the invoicing axis makes of the delivery one, and the same
    // instrument. This one folds documents rather than ordered items, so the counted
    // field is named for what it counts.
    check(
        "same result shape, with `charging` where the others count ordered items",
        shapeOf(summarizePOPaymentStatus([inv(true)], TODAY)),
        shapeOf({ key: 0, charging: 0, paid: 0, overdue: 0 })
    );
    check("charging counts the documents", summarizePOPaymentStatus([inv(true), inv(false)], TODAY).charging, 2);
    check("  and paid counts the ones that are", summarizePOPaymentStatus([inv(true), inv(false)], TODAY).paid, 1);

    // ── #210: THE INFERENCE IS GONE, ON THE AST ─────────────────────────────
    //
    // ON THE SOURCE RATHER THAN ON THE NAMESPACE, and the difference matters. A
    // namespace check can only see EXPORTS, so a `determinate` still threaded
    // through a local object or a `showsThisBillShare` kept as an internal helper
    // would both pass it. The claim is that the inference left the module, so the
    // instrument has to be able to see inside it.
    //
    // ON THE AST RATHER THAN BY GREP, for the reason offline/invoice-visibility.mjs
    // gives about `.paid`: this module explains at LENGTH what it removed and why,
    // so its comments are full of the words below and a text search would fail on
    // its own documentation.
    log("");
    log("#210's inference and #640's pairing left the module, asserted on the AST:");
    const { ast } = parseFile("lib/deliveryStatus.js");

    const identifiers = new Set();
    const propertyKeys = new Set();
    let sawAnyNode = false;
    walk(ast, (node) => {
        sawAnyNode = true;
        if (node.type === "Identifier") identifiers.add(node.name);
        if (node.type === "Property") {
            if (node.key?.name) propertyKeys.add(node.key.name);
            if (typeof node.key?.value === "string") propertyKeys.add(node.key.value);
        }
    });

    // The four names #210 removed. Each was load-bearing for the estimate and none
    // has anything left to mean: `determinate` was the allocator's flag,
    // `showsThisBillShare` read it, `estimated` was the invoice-level roll-up of it,
    // and `inferred` was the copy that explained it.
    for (const gone of ["determinate", "showsThisBillShare", "estimated", "inferred"]) {
        assert(`\`${gone}\` appears nowhere in lib/deliveryStatus.js`, !identifiers.has(gone));
        assert(`  nor as an object key`, !propertyKeys.has(gone));
    }
    // The allocator itself, and the premise constant that justified it.
    assert("`allocateLineToInvoices` is gone", !identifiers.has("allocateLineToInvoices"));
    assert("  and is no longer exported", !("allocateLineToInvoices" in deliveryStatus));
    assert("`CONTAINMENT_PREMISE` is gone with it", !("CONTAINMENT_PREMISE" in deliveryStatus));

    // #640 — WHAT COMPARED AN INVOICE WITH THE ONE DELIVERY IT NAMED. Each answered a
    // question the cumulative fill replaces, and `deliveryVariance` / `delivery-variance`
    // are the retired word's builder and key.
    for (const gone of ["invoiceShareStatus", "invoiceVerdictKey", "describeInvoiceItem", "orderedItemStatus", "hasDelivery"]) {
        assert(`\`${gone}\` appears nowhere in lib/deliveryStatus.js (#640)`, !identifiers.has(gone));
        assert(`  and is not exported`, !(gone in deliveryStatus));
    }
    for (const gone of ["deliveryVariance", "delivery-variance", "verdict", "againstOrder"]) {
        assert(`\`${gone}\` is no object key here (#640)`, !propertyKeys.has(gone));
    }

    // THE TWO THAT HAD TO SURVIVE, AND #219 TOOK THEM. This block asserted the
    // opposite until then: `sortInvoicesOldestFirst` and `INFERRED_PREMISE` were kept
    // here for #167's `selectOverageInvoice`, read nowhere in this module, and pinned so
    // that a tidy-up hunting dead exports could not delete them — the exception #182
    // was carrying. #219 narrowed that question's candidates to the invoices naming the
    // delivery an excess delivered against, which is the `spansInvoices` rethink #210 left
    // as its non-goal, and moved both into lib/overage.js. The ordering is PRIVATE
    // there, so the exception is retired rather than relocated, and what this file
    // pins is the absence.
    for (const moved of ["sortInvoicesOldestFirst", "INFERRED_PREMISE"]) {
        assert(`\`${moved}\` is no longer exported here (#219)`, !(moved in deliveryStatus));
        assert(`  nor named anywhere in the module`, !identifiers.has(moved));
    }
    // AND THE ORDERING ITSELF IS GONE, not merely its name: a second sort by the same
    // field would be the duplicate implementation offline/overage.mjs asserts against
    // on the other side.
    const sortedFields = new Set();
    walk(ast, (node) => {
        if (node.type !== "CallExpression") return;
        const callee = node.callee;
        if (callee?.type !== "MemberExpression" || callee.property?.name !== "sort") return;
        const text = JSON.stringify(node.arguments);
        for (const field of ["issueDate", "waitingSince", "createdKey"]) {
            if (text.includes(field)) sortedFields.add(field);
        }
    });
    // ANTI-VACUITY FOR THAT MATCHER, and it needs its own: "no sort mentions
    // issueDate" is also what a matcher that reads no sort callback at all reports.
    // sortLongestWaitingFirst is still here, so its two fields must come back seen.
    //
    // BOTH FIELD NAMES MOVED WITH #256, and updating them here is load-bearing rather
    // than cosmetic: each rename made the sort read a different property, so an
    // assertion still naming the old one would have gone quiet — reporting "the matcher
    // works" only by finding a field no sort in this module reads. The proof and the
    // thing proved have to move together, which is why the second rename updated this
    // line in the same commit as the first one did.
    assert("  the sort matcher reads callback bodies at all", sortedFields.has("waitingSince"));
    assert("    including the tie-break beside it", sortedFields.has("createdKey"));
    // AND THE OLD NAMES ARE GONE FROM EVERY SORT HERE, which is what makes the two
    // assertions above proof rather than coincidence: a leftover `createdAt` in some
    // other sort in this module would satisfy a matcher looking for the new name while
    // one call site still fed the old one.
    const staleSortFields = new Set();
    walk(ast, (node) => {
        if (node.type !== "CallExpression") return;
        const callee = node.callee;
        if (callee?.type !== "MemberExpression" || callee.property?.name !== "sort") return;
        const text = JSON.stringify(node.arguments);
        for (const field of ["receivedDate", "createdAt"]) {
            if (text.includes(field)) staleSortFields.add(field);
        }
    });
    check(
        "no sort here still reads a pre-#256 field name",
        staleSortFields.size === 0 ? "none" : [...staleSortFields].join(", "),
        "none"
    );
    assert("and nothing here sorts invoices by Issue Date any more", !sortedFields.has("issueDate"));

    // ANTI-VACUITY FOR THE WHOLE SECTION. Every assertion above is of the form "this
    // identifier is absent", which is also what a walk that visited nothing reports —
    // and what a parse of the wrong file reports. So the same two sets must be seen
    // to contain things that ARE in the module.
    log("");
    log("  anti-vacuity — the walk is seen to find what it is looking for:");
    assert("the AST walk visited nodes at all", sawAnyNode);
    assert("it sees identifiers", identifiers.has("summarizeInvoiceStatus"));
    // Was `sharesOrderedItem` until #232 deleted it. The control has to be a name
    // the CURRENT module holds, so it moved to the one that issue added — which
    // keeps the property this line is for: proof the walk is reading the new file
    // and not a stale parse.
    // The control follows the module: `speaks` (#232) until #640 deleted it, now the
    // fill #640 added — proof the walk is reading the current file.
    assert("  including one #640 ADDED, so it is reading the new file", identifiers.has("fillOldestFirst"));
    assert("it sees object keys", propertyKeys.has("partly"));
    assert("  including one #640 named", propertyKeys.has("thisInvoice"));
    // A control on the negative direction too: a name that is genuinely absent and
    // has never been in this module must also come back absent, or the sets are
    // matching everything.
    assert("and it does not report a name that was never there", !identifiers.has("allocateLineToDeliveries"));
}

if (isMain(import.meta.url)) standalone(title, run);
