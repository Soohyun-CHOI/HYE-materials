// What leaves an order open, at both levels: uninvoicedQty / hasUninvoicedQty,
// the uninvoiced remainder of an ordered item (#48, extracted in #18);
// hasUninvoicedItems, the same question asked of a whole order (#244); and
// countsAsOrdered, which #169 moved here from lib/materialPriceView.js — the
// condition for moving it was CLAUDE.md's, not that module's.
//
// Pinned because the negative case is a deliberate behavior that reads like a
// bug: more invoiced than ordered must stay negative, not clamp to 0. Three call
// sites used to compute this inline (getInvoicingStatusByPO, isPoOpen, and the
// invoice actions' over-invoicing warning); the rule is one function now, and a
// future "let's not show negatives" simplification is what these cases catch.
//
// WHAT THIS FILE CANNOT SEE, since #244 put half of one judgment in Airtable:
// whether `PO Items."Has Uninvoiced Qty"` still agrees with hasUninvoicedQty, and
// whether `Purchase Orders."Uninvoiced Items"` still sums it. Both are live-value
// facts and both are scripts/tests/verify-open-orders-244.mjs's. What is here is
// only the JS side of the pair.
//
// lib/poItemQty.js imports nothing, which is what lets this be offline.
//
// #685 — ONE NAME PER QUANTITY, OVER THE WHOLE TREE. The quantity countsAsOrdered
// reads is `orderedQty`, `PO Items."Ordered Qty"`: an ordered item's `Qty`, or 0 when
// its order was withdrawn. It was `committedQty`, and `orderedQty` meant an ordered
// item's own `Qty`, which is `orderedItemQty` now. A rename in two steps leaves two
// misses no check of behavior here can see, because both sit in a caller under
// `app/` or in a `.server.js` this tier never runs: a `committedQty` left behind
// reads `undefined`, so nothing counts as ordered; and an `orderedQty` still handed
// an item's `qty` counts a withdrawn order. So the last section reads every source
// file under `app/`, `lib/` and `scripts/` for the two shapes. What it cannot see is
// a positional argument, which carries no name — `checkQuantityVariance`'s second.

import { readdirSync, readFileSync } from "node:fs";
import {
    uninvoicedQty,
    hasUninvoicedQty,
    hasUninvoicedItems,
    countsAsOrdered,
} from "../../../lib/poItemQty.js";
import { parseSource, repoPath, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title =
    "Ordered item quantity judgments and their names — uninvoiced remainder, open order, counts-as-ordered (#18, #169, #244, #685)";

/** This file, which names the retired identifier in order to look for it. */
const THIS_FILE = "scripts/tests/offline/po-item-qty.mjs";

/** The directories the two names travel through. */
const SCANNED_DIRS = ["app", "lib", "scripts"];

/** Every `.js` and `.mjs` file under a directory, as repo-relative posix paths. */
function sourceFiles(dir, out = []) {
    for (const entry of readdirSync(repoPath(dir), { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) sourceFiles(rel, out);
        else if (/\.m?js$/.test(entry.name)) out.push(rel);
    }
    return out;
}

/** An expression that hands over an item's own `qty`: `qty`, `item.qty`, `item?.qty`. */
function handsItemQty(node) {
    const inner = node?.type === "ChainExpression" ? node.expression : node;
    if (inner?.type === "Identifier") return inner.name === "qty";
    return inner?.type === "MemberExpression" && !inner.computed && inner.property?.name === "qty";
}

/**
 * What one source says under the two names: the line of every `committedQty` — an
 * identifier, a property or a string — and of every `orderedQty` property handed an
 * item's `qty`, with how many `orderedQty` and `orderedItemQty` properties it holds.
 */
export function quantityNames(source, label) {
    const lineOf = (offset) => source.slice(0, offset).split("\n").length;
    const found = { committed: [], orderedFromQty: [], ordered: 0, orderedItem: 0 };
    walk(parseSource(source, label).ast, (node) => {
        if ((node.type === "Identifier" && node.name === "committedQty") || (node.type === "Literal" && node.value === "committedQty")) {
            found.committed.push(lineOf(node.start));
        }
        if (node.type !== "Property") return;
        const key = node.key?.type === "Identifier" ? node.key.name : node.key?.value;
        if (key === "orderedItemQty") found.orderedItem++;
        if (key !== "orderedQty") return;
        found.ordered++;
        if (handsItemQty(node.value)) found.orderedFromQty.push(lineOf(node.start));
    });
    return found;
}

export function run({ check, log }) {
    log("uninvoicedQty:");
    check("nothing invoiced yet leaves the whole qty", uninvoicedQty({ qty: 10, invoicedQty: 0 }), 10);
    check("partial invoicing leaves the rest", uninvoicedQty({ qty: 10, invoicedQty: 4 }), 6);
    check("fully invoiced leaves zero", uninvoicedQty({ qty: 10, invoicedQty: 10 }), 0);

    // The one that matters. A vendor over-invoicing, or an invoice item pointed at
    // the wrong PO Item, is a real state the PO detail page and the invoice form
    // both surface distinctly. Clamping at 0 would make it indistinguishable
    // from an exactly-fulfilled ordered item.
    check("OVER-invoiced stays negative, never clamped", uninvoicedQty({ qty: 10, invoicedQty: 13 }), -3);

    // Airtable returns undefined for an empty rollup, not 0, so these are the
    // shapes the real callers pass.
    check("an absent invoiced rollup counts as none", uninvoicedQty({ qty: 10, invoicedQty: undefined }), 10);
    check("an absent qty counts as zero", uninvoicedQty({ qty: undefined, invoicedQty: 3 }), -3);
    check("an empty argument object is zero", uninvoicedQty({}), 0);

    log("");
    log("hasUninvoicedQty — #57's whole definition of an 'open' PO line:");
    check("something left is open", hasUninvoicedQty({ qty: 10, invoicedQty: 4 }), true);
    check("exactly fulfilled is NOT open", hasUninvoicedQty({ qty: 10, invoicedQty: 10 }), false);
    // Falls out of the strict comparison rather than needing a case of its own,
    // and is the answer the invoice picker wants: an over-billed ordered item does not
    // need another invoice against it.
    check("over-invoiced is NOT open", hasUninvoicedQty({ qty: 10, invoicedQty: 13 }), false);
    check("a zero-qty line is not open", hasUninvoicedQty({ qty: 0, invoicedQty: 0 }), false);
    check("an uninvoiced line is open", hasUninvoicedQty({ qty: 1, invoicedQty: undefined }), true);

    log("");
    log("the two agree by construction:");
    for (const [qty, invoicedQty] of [[10, 0], [10, 10], [10, 13], [0, 0]]) {
        check(
            `qty=${qty} invoiced=${invoicedQty}: hasUninvoicedQty matches uninvoicedQty > 0`,
            hasUninvoicedQty({ qty, invoicedQty }),
            uninvoicedQty({ qty, invoicedQty }) > 0
        );
    }

    log("");
    log("hasUninvoicedItems — the same question about a whole order (#244):");
    check("an order with one such item is open", hasUninvoicedItems({ uninvoicedItems: 1 }), true);
    check("several are still just open", hasUninvoicedItems({ uninvoicedItems: 4 }), true);
    check("none left is NOT open", hasUninvoicedItems({ uninvoicedItems: 0 }), false);
    // Airtable leaves a rollup empty when the link array is, so an order with no
    // ordered items arrives as undefined — the same "not open" the item walk this
    // replaced reached by never entering its loop.
    check("an order with no ordered items is not open", hasUninvoicedItems({}), false);
    check("an absent rollup is not open", hasUninvoicedItems({ uninvoicedItems: undefined }), false);

    // IT READS THE COUNT AND DOES NOT RE-DERIVE THE PER-ITEM RULE. The two take
    // disjoint argument shapes, so a caller cannot feed one the other's figures
    // and get an answer by accident: the order-level function ignores qty and
    // invoicedQty entirely, which is what these two cases say out loud. If it
    // ever started subtracting for itself, the first of them would go true.
    check(
        "an order-level call ignores per-item quantities",
        hasUninvoicedItems({ qty: 10, invoicedQty: 0 }),
        false
    );
    check(
        "and a per-item call ignores the order-level count",
        hasUninvoicedQty({ uninvoicedItems: 3 }),
        false
    );

    // MOVED HERE FROM material-price-view.mjs BY #169, with the function itself.
    log("");
    log("countsAsOrdered — reads #18's Ordered Qty, does not re-derive it:");
    check("a live ordered item counts", countsAsOrdered({ orderedQty: 5 }), true);
    // Ordered Qty is IF(status = Withdrawn, 0, Qty), so this IS the withdrawn
    // case — without this file naming a status string.
    check("a withdrawn PO's ordered item does not", countsAsOrdered({ orderedQty: 0 }), false);
    check("a blank rollup does not", countsAsOrdered({}), false);
    // Deliberately indistinguishable from withdrawn, which is why #19's screen
    // takes its LABEL from PO Status and only the judgment from here.
    check("a Qty-0 ordered item on a live PO also does not", countsAsOrdered({ orderedQty: 0 }), false);

    // #685 — the two names, read over the tree. See the header for why here.
    log("");
    log("#685 — `orderedQty` is the quantity on orders not withdrawn, `orderedItemQty` an item's own:");
    const files = SCANNED_DIRS.flatMap((dir) => sourceFiles(dir)).filter((file) => file !== THIS_FILE);
    check("this file is among the files walked, and is left out by name", sourceFiles("scripts").includes(THIS_FILE), true);
    check("more than 300 files walked under app + lib + scripts", files.length > 300, true);
    check("  .mjs files among them", files.some((file) => file.endsWith(".mjs")), true);
    const unread = [];
    const committed = [];
    const orderedFromQty = [];
    let ordered = 0;
    let orderedItem = 0;
    for (const file of files) {
        let found;
        try {
            found = quantityNames(readFileSync(repoPath(file), "utf8"), file);
        } catch {
            unread.push(file);
            continue;
        }
        committed.push(...found.committed.map((line) => `${file}:${line}`));
        orderedFromQty.push(...found.orderedFromQty.map((line) => `${file}:${line}`));
        ordered += found.ordered;
        orderedItem += found.orderedItem;
    }
    for (const file of unread) log(`  could not parse ${file}`);
    check("files this could not read", unread.length, 0);
    for (const at of committed) log(`  ${at}  committedQty`);
    check("a `committedQty` left anywhere — it reads undefined, and nothing counts", committed.length, 0);
    for (const at of orderedFromQty) log(`  ${at}  orderedQty handed an item's qty`);
    check("an `orderedQty` handed an item's own `qty` — it would count a withdrawn order", orderedFromQty.length, 0);
    // ANTI-VACUITY: the walk has to see both names in use, and the matcher has to say
    // yes to each shape and no to the two correct ones.
    check("the tree hands over `orderedQty` in at least ten places", ordered >= 10, true);
    check("and `orderedItemQty` in at least ten", orderedItem >= 10, true);
    const planted = (source) => quantityNames(source, "planted.js");
    check("a planted `committedQty` property is caught", planted("f({ committedQty: it.committedQty });").committed.length, 2);
    check("a planted `committedQty` string is caught", planted('const has = "committedQty" in over;').committed.length, 1);
    check("a planted `orderedQty: it.qty` is caught", planted("f({ orderedQty: it.qty });").orderedFromQty.length, 1);
    check("  and `orderedQty: item?.qty`", planted("f({ orderedQty: item?.qty });").orderedFromQty.length, 1);
    check("  and `orderedQty: qty`", planted("const r = { orderedQty: qty };").orderedFromQty.length, 1);
    check("while `orderedQty: it.orderedQty` passes", planted("f({ orderedQty: it.orderedQty });").orderedFromQty.length, 0);
    check("  and `orderedItemQty: it.qty` passes", planted("f({ orderedItemQty: it.qty });").orderedFromQty.length, 0);
}

if (isMain(import.meta.url)) standalone(title, run);
