// remainingQty / hasRemainingQty — the un-invoiced remainder of a PO line
// (#48, extracted in #18).
//
// Pinned because the negative case is a deliberate behaviour that reads like a
// bug: more invoiced than ordered must stay negative, not clamp to 0. Three call
// sites used to compute this inline (getInvoicingStatusByPO, isPoOpen, and the
// invoice actions' over-invoicing warning); the rule is one function now, and a
// future "let's not show negatives" simplification is what these cases catch.
//
// lib/poItemQty.js imports nothing, which is what lets this be offline.

import { remainingQty, hasRemainingQty } from "../../../lib/poItemQty.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "PO line remainder — remainingQty / hasRemainingQty (#18)";

export function run({ check, log }) {
    log("remainingQty:");
    check("nothing invoiced yet leaves the whole qty", remainingQty({ qty: 10, invoicedQty: 0 }), 10);
    check("partial invoicing leaves the rest", remainingQty({ qty: 10, invoicedQty: 4 }), 6);
    check("fully invoiced leaves zero", remainingQty({ qty: 10, invoicedQty: 10 }), 0);

    // The one that matters. A vendor over-billing, or an invoice line pointed at
    // the wrong PO Item, is a real state the PO detail page and the invoice form
    // both surface distinctly. Clamping at 0 would make it indistinguishable
    // from an exactly-fulfilled line.
    check("OVER-invoiced stays negative, never clamped", remainingQty({ qty: 10, invoicedQty: 13 }), -3);

    // Airtable returns undefined for an empty rollup, not 0, so these are the
    // shapes the real callers pass.
    check("an absent invoiced rollup counts as none", remainingQty({ qty: 10, invoicedQty: undefined }), 10);
    check("an absent qty counts as zero", remainingQty({ qty: undefined, invoicedQty: 3 }), -3);
    check("an empty argument object is zero", remainingQty({}), 0);

    log("");
    log("hasRemainingQty — #57's whole definition of an 'open' PO line:");
    check("something left is open", hasRemainingQty({ qty: 10, invoicedQty: 4 }), true);
    check("exactly fulfilled is NOT open", hasRemainingQty({ qty: 10, invoicedQty: 10 }), false);
    // Falls out of the strict comparison rather than needing a case of its own,
    // and is the answer the invoice picker wants: an over-billed line does not
    // need another invoice against it.
    check("over-invoiced is NOT open", hasRemainingQty({ qty: 10, invoicedQty: 13 }), false);
    check("a zero-qty line is not open", hasRemainingQty({ qty: 0, invoicedQty: 0 }), false);
    check("an uninvoiced line is open", hasRemainingQty({ qty: 1, invoicedQty: undefined }), true);

    log("");
    log("the two agree by construction:");
    for (const [qty, invoicedQty] of [[10, 0], [10, 10], [10, 13], [0, 0]]) {
        check(
            `qty=${qty} invoiced=${invoicedQty}: hasRemainingQty matches remainingQty > 0`,
            hasRemainingQty({ qty, invoicedQty }),
            remainingQty({ qty, invoicedQty }) > 0
        );
    }
}

if (isMain(import.meta.url)) standalone(title, run);
