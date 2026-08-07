// The per-line quantity judgements: uninvoicedQty / hasUninvoicedQty, the
// uninvoiced remainder of a PO line (#48, extracted in #18), and countsAsOrdered,
// which #169 moved here from lib/materialPriceView.js — the condition for moving
// it was CLAUDE.md's, not that module's.
//
// Pinned because the negative case is a deliberate behaviour that reads like a
// bug: more invoiced than ordered must stay negative, not clamp to 0. Three call
// sites used to compute this inline (getInvoicingStatusByPO, isPoOpen, and the
// invoice actions' over-invoicing warning); the rule is one function now, and a
// future "let's not show negatives" simplification is what these cases catch.
//
// lib/poItemQty.js imports nothing, which is what lets this be offline.

import { uninvoicedQty, hasUninvoicedQty, countsAsOrdered } from "../../../lib/poItemQty.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "PO line quantity judgements — uninvoiced remainder, counts-as-ordered (#18, #169)";

export function run({ check, log }) {
    log("uninvoicedQty:");
    check("nothing invoiced yet leaves the whole qty", uninvoicedQty({ qty: 10, invoicedQty: 0 }), 10);
    check("partial invoicing leaves the rest", uninvoicedQty({ qty: 10, invoicedQty: 4 }), 6);
    check("fully invoiced leaves zero", uninvoicedQty({ qty: 10, invoicedQty: 10 }), 0);

    // The one that matters. A vendor over-billing, or an invoice line pointed at
    // the wrong PO Item, is a real state the PO detail page and the invoice form
    // both surface distinctly. Clamping at 0 would make it indistinguishable
    // from an exactly-fulfilled line.
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
    // and is the answer the invoice picker wants: an over-billed line does not
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

    // MOVED HERE FROM material-price-view.mjs BY #169, with the function itself.
    log("");
    log("countsAsOrdered — reads #18's Committed Qty, does not re-derive it:");
    check("a live line counts", countsAsOrdered({ committedQty: 5 }), true);
    // Committed Qty is IF(status = Withdrawn, 0, Qty), so this IS the withdrawn
    // case — without this file naming a status string.
    check("a withdrawn PO's line does not", countsAsOrdered({ committedQty: 0 }), false);
    check("a blank rollup does not", countsAsOrdered({}), false);
    // Deliberately indistinguishable from withdrawn, which is why #19's screen
    // takes its LABEL from PO Status and only the judgement from here.
    check("a Qty-0 line on a live PO also does not", countsAsOrdered({ committedQty: 0 }), false);
}

if (isMain(import.meta.url)) standalone(title, run);
