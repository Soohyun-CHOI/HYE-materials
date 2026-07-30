// The material price screens' view rules (#19).
//
// Pinned here because three of them are decisions that a later "tidy-up" would
// plausibly reverse, each for a reason that sounds good and is wrong:
//   - sorting NEWEST first rather than cheapest first,
//   - showing no "Lowest" mark when there is a single vendor,
//   - marking every tied row rather than picking one.
// Each has a case below so reversing it has to break a named test.
//
// lib/materialPriceView.js imports only lib/itemNaming.js, both pure, which is
// what lets this be offline.

import {
    buildSearchTokens,
    countsAsOrdered,
    lowestPriceRowIds,
    qtyDiffersAcross,
    sortHistoryRows,
    sortVendorRows,
    statusTag,
    MAX_SEARCH_TOKENS,
} from "../../../lib/materialPriceView.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Material price view rules (#19)";

const ids = (set) => [...set].sort().join(",");

export function run({ check, log, assert }) {
    log("buildSearchTokens — the typed query becomes match tokens:");
    check("a single word", buildSearchTokens("pipe").join("|"), "pipe");
    check("case is folded for matching", buildSearchTokens("PIPE").join("|"), "pipe");
    // The same normalization that decided how the name was STORED (#18), so a
    // user's spacing cannot miss a stored value and vice versa.
    check("internal whitespace collapses", buildSearchTokens("SCH   40").join("|"), "sch|40");
    check("ends are trimmed", buildSearchTokens("  pipe  ").join("|"), "pipe");
    check("a quote survives — sizes are written 2\"", buildSearchTokens('2" pipe').join("|"), '2"|pipe');
    check("duplicates are dropped (AND-ing a token twice narrows nothing)", buildSearchTokens("pipe pipe").join("|"), "pipe");
    check("empty query yields no tokens", buildSearchTokens("").length, 0);
    check("whitespace-only yields no tokens", buildSearchTokens("   ").length, 0);
    check("nullish yields no tokens", buildSearchTokens(undefined).length, 0);
    check(
        `capped at ${MAX_SEARCH_TOKENS} tokens`,
        buildSearchTokens("a b c d e f g h i").length,
        MAX_SEARCH_TOKENS
    );

    log("");
    log("sortVendorRows — NEWEST first, deliberately not cheapest first:");
    const vendorRows = [
        { id: "old-cheap", vendorName: "A", unitPrice: 5, latestDate: "2023-01-01", qty: 10 },
        { id: "new-dear", vendorName: "B", unitPrice: 50, latestDate: "2026-07-01", qty: 10 },
        { id: "mid", vendorName: "C", unitPrice: 20, latestDate: "2025-01-01", qty: 10 },
    ];
    check(
        "the newest row is first even though it is the most expensive",
        sortVendorRows(vendorRows).map((r) => r.id).join(","),
        "new-dear,mid,old-cheap"
    );
    check(
        "same date falls back to vendor name",
        sortVendorRows([
            { id: "z", vendorName: "Zeta", latestDate: "2026-01-01" },
            { id: "a", vendorName: "Alpha", latestDate: "2026-01-01" },
        ])
            .map((r) => r.id)
            .join(","),
        "a,z"
    );
    check(
        "a row with no date sorts last — it cannot claim recency",
        sortVendorRows([
            { id: "undated", vendorName: "A" },
            { id: "dated", vendorName: "B", latestDate: "2020-01-01" },
        ])
            .map((r) => r.id)
            .join(","),
        "dated,undated"
    );
    check("sorting does not mutate the input", vendorRows[0].id, "old-cheap");

    log("");
    log("lowestPriceRowIds — a fact, not a recommendation:");
    check(
        "the cheapest row is marked wherever it sorted",
        ids(lowestPriceRowIds(vendorRows)),
        "old-cheap"
    );
    // "Lowest of one" tells the reader nothing and dresses a single data point
    // as a comparison.
    check("a single vendor row is NOT marked", lowestPriceRowIds([{ id: "only", unitPrice: 7 }]).size, 0);
    check("an empty set of rows is not marked", lowestPriceRowIds([]).size, 0);
    // A tie is still the fact "this is the lowest price", for both rows.
    check(
        "a tie marks every tied row rather than picking one",
        ids(lowestPriceRowIds([
            { id: "a", unitPrice: 10 },
            { id: "b", unitPrice: 10 },
            { id: "c", unitPrice: 12 },
        ])),
        "a,b"
    );
    check(
        "rows without a numeric price are ignored, not treated as 0",
        ids(lowestPriceRowIds([
            { id: "priced", unitPrice: 9 },
            { id: "blank", unitPrice: undefined },
        ])),
        "priced"
    );
    check(
        "no comparable price means no mark",
        lowestPriceRowIds([{ id: "a" }, { id: "b" }]).size,
        0
    );
    check("zero is a real price, not a missing one", ids(lowestPriceRowIds([
        { id: "free", unitPrice: 0 },
        { id: "paid", unitPrice: 3 },
    ])), "free");

    log("");
    log("qtyDiffersAcross — the limit on comparing unit prices:");
    check("same quantity, no caveat", qtyDiffersAcross([{ qty: 10 }, { qty: 10 }]), false);
    check("different quantities, caveat", qtyDiffersAcross([{ qty: 10 }, { qty: 500 }]), true);
    check("one row cannot differ from itself", qtyDiffersAcross([{ qty: 10 }]), false);
    // An unknown quantity is not evidence of a difference.
    check("a missing quantity is ignored", qtyDiffersAcross([{ qty: 10 }, {}]), false);
    check("two missing quantities", qtyDiffersAcross([{}, {}]), false);

    log("");
    log("sortHistoryRows — newest first, PO ID breaks a same-day tie:");
    check(
        "dates order descending",
        sortHistoryRows([
            { id: "a", date: "2025-01-01", poId: "HYE-PO-20250101-01" },
            { id: "b", date: "2026-01-01", poId: "HYE-PO-20260101-01" },
        ])
            .map((r) => r.id)
            .join(","),
        "b,a"
    );
    // Created Date is calendar-only, so this tie is the common case, not an edge
    // one: every PO raised on the same day lands here.
    check(
        "same day falls back to the PO ID's own sequence, descending",
        sortHistoryRows([
            { id: "first", date: "2026-07-29", poId: "HYE-PO-20260729-01" },
            { id: "third", date: "2026-07-29", poId: "HYE-PO-20260729-03" },
            { id: "second", date: "2026-07-29", poId: "HYE-PO-20260729-02" },
        ])
            .map((r) => r.id)
            .join(","),
        "third,second,first"
    );
    check(
        "an undated row sorts last",
        sortHistoryRows([{ id: "undated" }, { id: "dated", date: "2020-01-01" }])
            .map((r) => r.id)
            .join(","),
        "dated,undated"
    );

    log("");
    log("countsAsOrdered — reads #18's Committed Qty, does not re-derive it:");
    check("a live line counts", countsAsOrdered({ committedQty: 5 }), true);
    // Committed Qty is IF(status = Withdrawn, 0, Qty), so this IS the withdrawn
    // case — without this file naming a status string.
    check("a withdrawn PO's line does not", countsAsOrdered({ committedQty: 0 }), false);
    check("a blank rollup does not", countsAsOrdered({}), false);
    // Deliberately indistinguishable from withdrawn, which is why the screen
    // takes its LABEL from PO Status and only the judgement from here.
    check("a Qty-0 line on a live PO also does not", countsAsOrdered({ committedQty: 0 }), false);

    log("");
    log("statusTag — silence means Signed:");
    // Signed is nearly every row, so labelling it is noise on every line.
    check("Signed gets no tag", statusTag("Signed"), null);
    check("a blank status gets no tag", statusTag(""), null);
    check("undefined gets no tag", statusTag(undefined), null);
    // Every label names its subject, because the tag renders beside the VENDOR
    // rather than beside the PO ID it describes. A bare "Withdrawn" after a
    // vendor name reads as a fact about the vendor.
    check("Awaiting Signature names the PO and stays short", statusTag("Awaiting Signature"), "PO unsigned");
    check("Withdrawn names the PO too", statusTag("Withdrawn"), "PO withdrawn");
    assert(
        "no label is ambiguous about what it describes",
        ["Awaiting Signature", "Withdrawn", "Sent to Vendor"].every((s) => statusTag(s).startsWith("PO"))
    );
    // A status option added to the Airtable field later must SHOW rather than
    // vanish — the failure mode #144 recorded for a denylist. Colon form, because
    // an arbitrary option name will not read grammatically after a bare "PO".
    check("an unknown status shows itself rather than disappearing", statusTag("Sent to Vendor"), "PO: Sent to Vendor");
}

if (isMain(import.meta.url)) standalone(title, run);
