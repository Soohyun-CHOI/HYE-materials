// Delivered against invoiced against ordered (#166) — the judgment and its copy.
//
// The office cannot yet tell whether what a vendor billed for arrived, nor what
// arrived with no invoice behind it. This module is the whole of that comparison:
// what the numbers mean, what to call each outcome, and how the vendor-chasing
// worklist is ordered. Three surfaces read it — the invoice list, the invoice
// detail and the deliveries list — so the rule is here rather than three times.
//
// TWO INDEPENDENT COMPARISONS, NOT A LIST OF CASES. Delivered against invoiced,
// and then each of them against ordered. Every combination anyone can name falls
// out of those two, including the ones nobody enumerated — which is why this
// returns figures and a key rather than a hand-written case per screen.
//
// FACTS, NOT VERDICTS. At any one moment "the vendor over-billed" and "the rest
// has not arrived yet" are the SAME measurement: invoiced exceeds delivered. The
// data cannot distinguish them and neither may the copy, so it says "more billed
// than recorded as arrived". The reverse direction is the same measurement read
// from the other end and gets the same treatment. Deciding which it is belongs to
// a person, and correcting it belongs to #167.
//
// NOTHING IS STORED. There is no `Invoices.Delivery` link; the join is computed
// at read time from `Invoice Items` -> `PO Item` <- `Delivery Items`
// (lib/deliveryReconciliation.js). Whether to store it was deliberately left
// until this screen has been used.
//
// Pure and dependency-free so scripts/tests/offline/delivery-status.mjs can pin
// every clause.

/**
 * Whether an invoice line takes part in the comparison at all.
 *
 * A line with no `PO Item` names no ordered line, so there is no ordered quantity
 * to compare it against and no delivery that could correspond to it. Counting it
 * would make the invoice carrying it read as short of arriving, which is an
 * artifact of comparing something to nothing rather than a fact about the
 * delivery record.
 *
 * NOT A FREIGHT RULE, and the distinction matters because the obvious reading is
 * wrong. A vendor's freight arrives on `Invoices."Shipping Fee"`, a header field;
 * item rows are for material only. The app does not create a `PO Item`-less item
 * row at all — the free-text "Other" option is hidden
 * (`SHOW_OTHER_ITEM_OPTION = false`, #96) — so a conforming invoice has none.
 * The ones on this base today are hand-entered dummy data, which CLAUDE.md
 * records for `HYE-INV-260727-04` (its line carries a variance flag with an empty
 * `PO Item`, a combination no code path here produces).
 *
 * The rule is still needed: #96 hid the UI option and left the backend path
 * intact, so flipping that flag is the whole of re-exposing it, and a row created
 * that way would reach this comparison.
 *
 * Excluded lines are COUNTED, so a screen can say how many it did not judge
 * instead of quietly narrowing what it claims.
 */
export function countsTowardStatus(invoiceLine) {
    return Boolean(invoiceLine?.poItemRecordId);
}

/**
 * One ordered line, measured. Takes the four quantities and returns the two
 * comparisons plus everything a caller might render.
 *
 * `deliveredWithinQty` and `deliveredOverQty` arrive SEPARATED, and that is why
 * this feature reads `Delivery Items` rather than `PO Items."Delivered Qty"`:
 * that rollup sums the two into one number, and only the rows carry the
 * `Over Delivery` flag that tells them apart (#165 attaches every row, so the
 * rollup is complete — it is just no longer decomposable). A screen whose job is
 * separating "arrived against the order" from "arrived beyond it" cannot use it.
 *
 * `invoicedQty` is the LINE's total across every invoice, taken from the
 * `Invoiced Qty` rollup — not the sum of one invoice's own lines. A PO line can
 * carry two invoices, and summing only the invoice in hand would under-count the
 * line and report material as unbilled when it is billed twice over.
 *
 * COMPARISON 1 uses TOTAL delivered, within-order plus beyond. "Did the billed
 * material arrive" is a question about arrival, not about whether the order
 * covered it: 12 arriving against an order of 10 answers a bill for 12 in full.
 * Using the within-order figure would report 2 as missing when it is standing in
 * the warehouse.
 *
 * COMPARISON 2 is each side against ordered, and it is realized as two NAMED
 * facts rather than as max(delivered, invoiced) > ordered. The max form is true
 * of both cases and distinguishes neither, and the `Over Delivery` flag already
 * gives the arrival side exactly.
 *
 * Blank/absent inputs count as 0 — an Airtable rollup with nothing behind it is
 * undefined, not 0.
 */
export function lineStatus({ orderedQty, invoicedQty, deliveredWithinQty, deliveredOverQty } = {}) {
    const ordered = orderedQty || 0;
    const invoiced = invoicedQty || 0;
    const within = deliveredWithinQty || 0;
    const beyond = deliveredOverQty || 0;
    const delivered = within + beyond;

    return {
        ordered,
        invoiced,
        delivered,
        deliveredWithin: within,
        deliveredBeyondOrder: beyond,
        // Comparison 1, both directions. Clamped at 0 because each direction is
        // its own fact: a caller asking "how much is billed but not recorded as
        // arrived" wants 0, not a negative, when the answer is the other way
        // round. Contrast lib/poItemQty.js:remainingQty, which MUST stay signed
        // because there a negative is the interesting state.
        billedNotArrived: Math.max(0, invoiced - delivered),
        arrivedNotBilled: Math.max(0, delivered - invoiced),
        // Comparison 2, as the two facts the flag lets us name precisely.
        arrivedBeyondOrder: beyond,
        billedBeyondOrder: Math.max(0, invoiced - ordered),
    };
}

/**
 * Which of the six states one measured line is in. Keys, not sentences, so a
 * reworded message does not fail a check that was never about wording — the same
 * arrangement ALLOCATION_COPY uses.
 *
 * Order matters: the two "nothing" states are checked first because they are what
 * a reader needs to see, and both would otherwise fall into a difference bucket
 * and read as a discrepancy rather than as an absence.
 */
export function lineStatusKey(status) {
    const { invoiced, delivered, billedNotArrived, arrivedNotBilled } = status;
    if (invoiced === 0 && delivered === 0) return "neither";
    if (delivered === 0) return "nothing-arrived";
    if (invoiced === 0) return "nothing-invoiced";
    if (billedNotArrived > 0) return "billed-more";
    if (arrivedNotBilled > 0) return "arrived-more";
    return "matched";
}

/**
 * THE ONE PREMISE THIS FEATURE RESTS ON, and it is a statement about how the
 * office works rather than a measured fact:
 *
 *   ONE INVOICE IS CONTAINED ENTIRELY WITHIN ONE DELIVERY. A vendor does not
 *   bill for half a shipment, and an invoice is not split across arrivals.
 *
 * NOTHING IN THE DATA ENFORCES IT. There is no link between a delivery and an
 * invoice (deliberately — see the module header), no field records the pairing,
 * and no write path checks it. It is the practice the office describes, and the
 * estimate below is only as good as it. If it breaks — a vendor bills half a
 * pallet, or one invoice covers two arrivals — the estimate does not degrade
 * gracefully into "roughly right": it becomes wrong in a different way, because
 * it will hand a whole invoice a coverage that actually belongs to part of two.
 *
 * What the premise buys is the sentence below: with 80 billed across two invoices
 * and 40 arrived, the 40 satisfies ONE of them completely rather than half of
 * each. That is what makes "this one has not arrived" a statement with a
 * one-in-two chance of naming the right invoice, rather than a middle value that
 * is in the data nowhere.
 */
export const CONTAINMENT_PREMISE =
    "One invoice is contained entirely within one delivery: a vendor does not bill " +
    "for half a shipment, and an invoice is not split across arrivals. This is the " +
    "office's practice, not a constraint the data enforces.";

/**
 * Oldest bill first: `Issue Date` ascending, tie-broken by `Invoice ID`.
 *
 * `Issue Date` is the vendor's own date on their document, so it is the order the
 * bills were raised in and the right meaning for "which was settled first". It is
 * HUMAN-ENTERED AND BACKDATABLE — the property #164 learned the hard way when an
 * ID counter read such a field — so a mistyped date changes which invoice an
 * estimate favours. That is tolerable here in a way it was not there: the
 * consequence is a coin-flip landing the other way on a cell already marked as an
 * estimate, not a corrupted record. `Invoice ID` breaks ties and is monotonic
 * within a day by construction (#164).
 *
 * An undated invoice sorts LAST rather than first: it cannot claim to be the
 * oldest, and a data gap must not take priority in an ordering whose whole point
 * is age — the same call sortCandidates and sortLongestWaitingFirst both make.
 *
 * Does not mutate its input.
 */
export function sortInvoicesOldestFirst(shares) {
    return [...(shares || [])].sort((a, b) => {
        const da = a.issueDate || "";
        const db = b.issueDate || "";
        if (da !== db) {
            if (!da) return 1;
            if (!db) return -1;
            return da.localeCompare(db);
        }
        return (a.invoiceId || "").localeCompare(b.invoiceId || "");
    });
}

/**
 * Split one ordered line's arrived quantity across the invoices that bill it.
 *
 * THE BOUNDARY BETWEEN DETERMINED AND ESTIMATED IS THE LOAD-BEARING RULE OF #166,
 * which is why it is one named predicate here rather than a condition inside a
 * page. Most of the time no estimate is involved at all:
 *
 *   - ONE invoice on the line — the line's arrived-against-billed IS that
 *     invoice's answer. Nothing is guessed. This is the common case.
 *   - arrived covers EVERY bill — all of them are satisfied whatever order they
 *     are taken in, so the outcome does not depend on the ordering.
 *   - NOTHING arrived — none of them is satisfied, likewise order-independent.
 *
 * An estimate is needed in exactly one shape: two or more bills on the line AND
 * arrived that covers some but not all of them. Then the answer depends on which
 * bill the arrival belongs to, which nothing records, so it is filled
 * oldest-bill-first (sortInvoicesOldestFirst) and the result is MARKED as an
 * estimate. See CONTAINMENT_PREMISE for what makes that a coin flip between whole
 * invoices rather than an invented middle value.
 *
 * WHY ESTIMATE AT ALL, given #166's own "facts, not verdicts" rule. Refusing
 * would leave the invoice axis unable to answer "may this be paid", which is the
 * question it exists for. #165 made the same call one level down: it declined to
 * attach an over-delivery row while the right line was uncertain, and reversed
 * because not attaching was the larger error. Being approximately right about
 * WHICH bill beats being silent about WHETHER the material arrived.
 *
 * `invoices` is one entry per invoice billing this line:
 * `{ invoiceRecordId, invoiceId, issueDate, billed }`. Returns the same entries
 * with `arrived` filled in, plus the line-level `determinate` flag.
 */
export function allocateLineToInvoices({ delivered, invoices } = {}) {
    const bills = invoices || [];
    const arrivedTotal = delivered || 0;
    const totalBilled = bills.reduce((sum, b) => sum + (b.billed || 0), 0);

    // The three order-independent cases. Anything else and the ordering decides,
    // which is precisely what "estimated" means.
    const determinate = bills.length <= 1 || arrivedTotal >= totalBilled || arrivedTotal <= 0;

    let left = arrivedTotal;
    const shares = sortInvoicesOldestFirst(bills).map((bill) => {
        const take = Math.max(0, Math.min(left, bill.billed || 0));
        left -= take;
        return { ...bill, arrived: take, determinate };
    });

    return { shares, determinate, totalBilled, delivered: arrivedTotal };
}

/**
 * One invoice's own view of one ordered line: the same six-state measurement as
 * lineStatus, scoped to what THIS invoice billed and what was allocated to it.
 *
 * Deliberately reuses the line-level shape (`invoiced`/`delivered`) so
 * lineStatusKey and every copy branch work unchanged — it is the same
 * measurement at a different scope, not a second rule. The beyond-the-order facts
 * are NOT here: they are properties of the order, not of one bill, so they stay on
 * the line and the caller carries them separately.
 */
export function invoiceShareStatus({ billed, arrived, determinate = true } = {}) {
    const invoiced = billed || 0;
    const delivered = arrived || 0;
    return {
        invoiced,
        delivered,
        billedNotArrived: Math.max(0, invoiced - delivered),
        arrivedNotBilled: Math.max(0, delivered - invoiced),
        determinate: Boolean(determinate),
        // Present so a share can be fed to describeLineDetail without the two
        // beyond-order branches firing on line-level facts that are not its own.
        arrivedBeyondOrder: 0,
        billedBeyondOrder: 0,
    };
}

/**
 * An invoice's status, from its judged lines.
 *
 * COUNTS LINES, NOT QUANTITIES, and that is forced rather than chosen: lines
 * carry different Units, so adding their quantities together produces a number
 * of nothing. "2 of 3 lines" is unit-free and true.
 *
 * ATTRIBUTES TO THIS INVOICE, unlike the first version of this module. Each entry
 * is this invoice's own share of one ordered line (invoiceShareStatus), so
 * "arrived" means what was allocated to THIS bill rather than what the line
 * received in total. Refusing to attribute left the invoice axis unable to answer
 * "may this be paid" — see allocateLineToInvoices.
 *
 * `estimated` is true when ANY of its lines needed the oldest-first fill. One
 * uncertain line makes the invoice's answer uncertain, so it does not average out
 * across lines.
 *
 * `excludedCount` is the lines countsTowardStatus dropped, carried through so a
 * screen can say what it did not judge.
 */
export function summarizeInvoiceStatus(lineStatuses, excludedCount = 0) {
    const entries = lineStatuses || [];
    const judged = entries.length;
    const arrived = entries.filter((s) => s.billedNotArrived === 0).length;
    // Whether ANY quantity arrived, which is a different question from whether any
    // LINE is fully covered — and keeping them apart is what stops the copy lying.
    const anyArrived = entries.some((s) => s.delivered > 0);

    const key =
        judged === 0
            ? "no-order-lines"
            : arrived === judged
              ? "all-arrived"
              : // `none-arrived` is reserved for NOTHING having arrived, because
                // that is what its sentence says. A one-line invoice billing 13
                // with 10 recorded is not "nothing recorded as arrived yet" — it
                // has no COMPLETE line, which the count form states without
                // claiming more. Found by reading the seeded data: the first
                // version keyed this on `arrived === 0` alone and said the false
                // thing.
                arrived === 0 && !anyArrived
                ? "none-arrived"
                : "some-arrived";

    return {
        key,
        judged,
        arrived,
        excludedCount,
        anyArrived,
        // One uncertain line is enough: the invoice's answer rests on it.
        estimated: entries.some((s) => s.determinate === false),
        // Rendered as tags beside the phrase rather than folded into it: they are
        // a different comparison, and a line can be both covered and beyond the
        // order at once.
        anyArrivedBeyondOrder: entries.some((s) => s.arrivedBeyondOrder > 0),
        anyBilledBeyondOrder: entries.some((s) => s.billedBeyondOrder > 0),
    };
}

/**
 * A delivery's invoicing status, from the ordered lines its slices filled.
 *
 * "Invoiced" here means THE ORDER LINE carries invoice lines — not that this
 * arrival was billed, which is the attribution that does not exist. The copy is
 * worded to claim only that.
 *
 * `linesTouched` is one entry per distinct PO line this delivery allocated
 * against, each with whether that line has any invoice line at all.
 */
export function summarizeDeliveryInvoicing(linesTouched) {
    const total = (linesTouched || []).length;
    const invoiced = (linesTouched || []).filter((l) => l.hasInvoice).length;

    const key =
        total === 0
            ? "no-order-lines"
            : invoiced === 0
              ? "none-invoiced"
              : invoiced === total
                ? "all-invoiced"
                : "partly-invoiced";

    return { key, total, invoiced };
}

// ---------------------------------------------------------------------------
// Copy
//
// One object with paired variants, so a change to one cannot quietly leave the
// other describing something else — the arrangement ALLOCATION_COPY and
// WITHDRAW_COPY use.
//
// BUT THE AXIS IS DENSITY, NOT VOICE, AND THAT DEPARTURE IS DELIBERATE. Those two
// pair an ACTOR about to act (second person, future) against a VIEWER reading
// history (third person, past), because both concerns have someone doing
// something. This one does not: there is no action to take here and no actor to
// address — all three surfaces state a present fact to a reader. Forcing that
// axis would invent a voice with no speaker. What actually varies is room: a
// table cell has one short line, a detail section has room for the figures. So
// `column` and `detail` are the same fact at two densities. Recorded here because
// the next reader will otherwise see an axis that differs from WITHDRAW_COPY's and
// read it as an inconsistency rather than a decision.
//
// Every builder returns { key, text }. The key is what the checks pin.

const qtyUnit = (n, unit) => `${n}${unit ? " " + unit : ""}`;

export const STATUS_COPY = {
    /** One short line for a table cell. */
    column: {
        invoice: {
            "all-arrived": (s) => ({
                key: "all-arrived",
                text: s.judged === 1 ? "Arrived" : `Arrived (${s.judged} lines)`,
            }),
            "some-arrived": (s) => ({
                key: "some-arrived",
                text: `${s.arrived} of ${s.judged} lines arrived`,
            }),
            "none-arrived": (s) => ({
                key: "none-arrived",
                text: "Nothing recorded as arrived yet",
            }),
            // Every line is free text, so there is nothing to compare. Says so
            // rather than showing a state it did not measure.
            "no-order-lines": () => ({
                key: "no-order-lines",
                text: "No ordered lines to compare",
            }),
        },
        delivery: {
            // The vendor-chasing worklist's own state, and the reason this
            // feature exists at all: the month-end email asking every vendor for
            // missing invoices is what currently stands in for it.
            //
            // SHORT HERE, FULL IN `detail.line["nothing-invoiced"]`, which is the
            // density pairing doing its job rather than two different claims: the
            // deliveries list is a table-fixed column of 7.5rem and the full
            // sentence wraps every row of the commonest state, while the invoice
            // detail has room to say it with the figure.
            "none-invoiced": () => ({ key: "none-invoiced", text: "No invoice yet" }),
            "partly-invoiced": (s) => ({
                key: "partly-invoiced",
                text: `${s.invoiced} of ${s.total} invoiced`,
            }),
            "all-invoiced": () => ({ key: "all-invoiced", text: "Invoiced" }),
            "no-order-lines": () => ({
                key: "no-order-lines",
                text: "No ordered lines to compare",
            }),
        },
        /**
         * ESTIMATION IS ITS OWN ENTRY, NOT A THIRD AXIS. Every state above would
         * otherwise need a determined and an estimated variant, which is four sets
         * of copy and a broken pair — the `column`/`detail` axis is the whole
         * arrangement. So the qualifier is separate and composes with any state,
         * rendered beside the phrase as a short tag exactly as #19's `PO unsigned`
         * and #162's `over-delivery` are. Same fact at two densities, like
         * everything else here.
         */
        estimated: () => ({ key: "estimated", text: "estimated" }),
    },

    /** The same facts with their figures, for a detail section. */
    detail: {
        line: {
            matched: (s, unit) => ({
                key: "matched",
                text: `All ${qtyUnit(s.invoiced, unit)} billed recorded as arrived.`,
            }),
            "billed-more": (s, unit) => ({
                key: "billed-more",
                text:
                    `${qtyUnit(s.billedNotArrived, unit)} more billed than recorded as arrived ` +
                    `— ${qtyUnit(s.invoiced, unit)} billed, ${qtyUnit(s.delivered, unit)} recorded.`,
            }),
            "arrived-more": (s, unit) => ({
                key: "arrived-more",
                text:
                    `${qtyUnit(s.arrivedNotBilled, unit)} recorded as arrived beyond this bill ` +
                    `— ${qtyUnit(s.delivered, unit)} recorded, ${qtyUnit(s.invoiced, unit)} billed.`,
            }),
            "nothing-arrived": (s, unit) => ({
                key: "nothing-arrived",
                text: `Nothing recorded as arrived yet against the ${qtyUnit(s.invoiced, unit)} billed.`,
            }),
            "nothing-invoiced": (s, unit) => ({
                key: "nothing-invoiced",
                text: `No invoice recorded for this yet — ${qtyUnit(s.delivered, unit)} recorded as arrived.`,
            }),
            neither: () => ({
                key: "neither",
                text: "Nothing billed and nothing recorded as arrived.",
            }),
        },
        /**
         * The same qualifier at detail density, where there is room to say WHY
         * rather than only that it is one. Composes with any state above.
         */
        estimated: () => ({
            key: "estimated",
            text:
                "This order line carries more than one bill and the arrivals cannot be " +
                "told apart, so the oldest bill is treated as settled first.",
        }),
        /** The two beyond-the-order facts, shown as tags beside a line. */
        beyondOrder: {
            arrived: (s, unit) => ({
                key: "arrived-beyond-order",
                text: `${qtyUnit(s.arrivedBeyondOrder, unit)} arrived beyond the order`,
            }),
            billed: (s, unit) => ({
                key: "billed-beyond-order",
                text: `${qtyUnit(s.billedBeyondOrder, unit)} more billed than ordered`,
            }),
        },
    },
};

/** The column phrase for one invoice summary. */
export function describeInvoiceColumn(summary) {
    return STATUS_COPY.column.invoice[summary.key](summary);
}

/** The column phrase for one delivery summary. */
export function describeDeliveryColumn(summary) {
    return STATUS_COPY.column.delivery[summary.key](summary);
}

/**
 * Every sentence one measured line deserves on a detail section: its state, then
 * any beyond-the-order fact. Two comparisons, so up to two messages — a line can
 * be fully covered AND have material beyond the order.
 */
export function describeLineDetail(status, unit = "") {
    const messages = [STATUS_COPY.detail.line[lineStatusKey(status)](status, unit)];
    // The qualifier goes immediately after the state it qualifies, before the
    // beyond-order facts, which are about the ORDER and not about this bill.
    if (status.determinate === false) messages.push(STATUS_COPY.detail.estimated());
    if (status.arrivedBeyondOrder > 0) {
        messages.push(STATUS_COPY.detail.beyondOrder.arrived(status, unit));
    }
    if (status.billedBeyondOrder > 0) {
        messages.push(STATUS_COPY.detail.beyondOrder.billed(status, unit));
    }
    return messages;
}

// ---------------------------------------------------------------------------
// Ordering

/**
 * The vendor-chasing worklist: longest-waiting arrival first.
 *
 * `Received Date` ASCENDING, because the question is how long the material has
 * been sitting here unbilled, and that starts when it arrived — not when someone
 * typed it in. It is the semantically right field and it is human-entered and
 * backdatable, which #164 learned the hard way when an ID counter read one. The
 * consequence here is milder than a duplicate ID — a mistyped date sits at the
 * top of a worklist rather than corrupting a record — but it is the same
 * property, so it is written down rather than discovered again.
 *
 * `Created At` DESCENDING as the tie-break, matching the default list's
 * tie-break direction exactly. Only the primary key flips between the two
 * orderings; keeping the secondary one identical means the tie-break is for
 * stability alone and carries no meaning of its own that could disagree between
 * the two views.
 *
 * Does not mutate its input.
 */
export function sortLongestWaitingFirst(rows) {
    return [...(rows || [])].sort((a, b) => {
        const ra = a.receivedDate || "";
        const rb = b.receivedDate || "";
        if (ra !== rb) {
            // An undated arrival sorts LAST rather than first: it cannot claim to
            // have waited longest, and a data gap must not take the top of a
            // worklist — the same call lib/deliveryAllocation.js:sortCandidates
            // makes for the head of its FIFO queue.
            if (!ra) return 1;
            if (!rb) return -1;
            return ra.localeCompare(rb);
        }
        return (b.createdAt || "").localeCompare(a.createdAt || "");
    });
}
