// Recording a direct purchase from the invoice that has no order (#272).
//
// THE DEAD END THIS LEAVES. The office is on `/invoices/new` with a vendor's
// invoice and there is no order for it to charge: either the vendor's number
// matches nothing this app holds, or an order matches and its ordered items are
// not what the invoice charges for. The second is a judgment only a person can
// make — the app cannot know that `Elbow 90` was not what this document is about
// — so there is no state to hang a conditional affordance on, and the way out is
// a control that is always there. It sits beside the order picker, which is
// where the reader is when they run out of orders, and next to #57's search
// toggle, which is the other escape hatch from the same control.
//
// WHAT THE OFFICE CAN AND CANNOT SUPPLY, which is the whole shape of the modal.
// It has the vendor, the invoice's own number and date, and the document; it
// learns the Job on the telephone. It does NOT have the Line — that is #19's
// boundary, and it is why `Direct Purchases` is a table at all (see
// `docs/notes/purchase-requests.md`). It also has no items: `/invoices/new` locks
// its items section until an order is picked, so at the dead end there is nothing
// typed to carry, and the requester types them into the request from the document
// traveling with the row.
//
// NOTHING HERE DECIDES WHO MAY DO IT. The page is Admin-only and the action
// re-authorizes the same way; this module is the words and the one predicate they
// are about, so a client component may hold it and the offline tier can pin it.
// Pure and import-free, the same reason `lib/poPickerOptions.js` is.

/** Why this invoice cannot be recorded as a direct purchase yet. */
export const DIRECT_PURCHASE_BLOCKED = {
    noVendor: "no-vendor",
    noFile: "no-file",
    noJob: "no-job",
};

/**
 * The first thing missing, or null when the record can be written.
 *
 * ORDER IS THE ORDER A READER FIXES THEM IN, not a precedence: the vendor sits at
 * the top of the form, the file is the section under it, and the Job is asked for
 * inside the modal. A reader told about the last one first would go looking past
 * two empty fields.
 *
 * THE FORM AND THE ACTION ASK THE SAME FUNCTION. A Server Action is directly
 * callable, so the action's call is the guarantee and the modal's is the
 * courtesy — but a second implementation would let the two disagree about what
 * `blank` means, which is exactly how a button comes to offer something the
 * server refuses.
 */
export function directPurchaseBlocked({ vendorId, fileUrl, jobId } = {}) {
    if (!vendorId) return DIRECT_PURCHASE_BLOCKED.noVendor;
    if (!fileUrl) return DIRECT_PURCHASE_BLOCKED.noFile;
    if (!jobId) return DIRECT_PURCHASE_BLOCKED.noJob;
    return null;
}

const invoiceLabel = (f) => f?.vendorInvoiceCode || "this invoice";

export const DIRECT_PURCHASE_COPY = {
    /**
     * The control, and it is a question rather than an instruction because the
     * reader is the one who knows the answer. The app cannot tell an invoice with
     * no purchase order from one whose purchase order it has simply not been shown.
     *
     * IT NAMES WHAT THIS APP IS MISSING, NOT WHAT THE SITE FAILED TO DO. `Bought
     * without an order?` stood here and spent `order` on the ACT of ordering, which
     * is not what happened and not what the word means on this base: the site DID
     * order — it rang the vendor and placed one — and `Purchase Orders` owns the
     * noun (#269), so an `order` on a screen is a row of that table. What is absent
     * is that row, which is exactly the state the reader is looking at when the
     * picker beside this control has nothing to offer. So the question is about the
     * app's gap, in the app's own abbreviation for it.
     */
    affordance: "No PO for this invoice?",

    modal: {
        heading: "Record a direct purchase",
        /**
         * What the button is about to do, in the shape OVERAGE_COPY.preview uses:
         * name every input it takes from somewhere the reader cannot see, and every
         * one it will not take at all.
         *
         * `bought directly, with no PO in this app to charge it to` RATHER THAN
         * `bought with no order behind it`. The site placed an order — that is what
         * buying from a vendor is — so the sentence would have been false about the
         * world as well as spending a word `Purchase Orders` owns. What is missing is
         * the row, and `charge it to` is this screen's own verb for what an invoice
         * does to one (#274).
         *
         * NAMES WHAT THE SITE STILL HAS TO SUPPLY WITHOUT NAMING THE FIELD, and that
         * is the copy ban rather than a preference: the bare word is barred in a copy
         * constant (`offline/line-vocabulary.mjs`), which it was when `Lines` was a
         * table and still is now that the table is `Disciplines` — the premise moved
         * to #303's rule and the bar did not (#280). Saying which part of the job it
         * was for is the same fact in the reader's words, and it explains why the site
         * has to be the one to do it. **The field is `Discipline` now, so naming it
         * would no longer trip the ban at all; the sentence stays as written because
         * what it buys is the reader's words rather than the check's silence.**
         */
        summary: (f) => ({
            key: "dp-summary",
            text:
                `This records ${invoiceLabel(f)} as material the site bought directly, ` +
                "with no PO in this app to charge it to. The file you attached becomes " +
                "the evidence, and the site raises the purchase request from it: what was " +
                "bought, which part of the job it was for, and who signs are all theirs " +
                "to fill in, because the invoice says none of them.",
        }),
        /**
         * The Job is the one thing the office has to go and find out, so the field
         * says what it decides rather than merely being labeled.
         */
        job: (f) => ({
            key: "dp-job",
            text:
                "Pick the job it was bought for — that is what puts the record in front of " +
                `the right site. ${f?.jobKnown ? "" : "The invoice does not say it; the site does."}`.trim(),
        }),
        notes: {
            key: "dp-notes",
            text:
                "Anything you learned on the telephone — who bought it, what it was for — " +
                "goes in the note. It is the only thing the site's list can say about what " +
                "this was, since no items are recorded here.",
        },
        /**
         * THE COST OF LEAVING, SAID BEFORE IT IS PAID. The invoice cannot be entered
         * until the request is approved and its purchase order signed, so this form's
         * contents are not kept and there is nothing to come back to.
         *
         * `its purchase order` IN FULL, because this is the one sentence here where
         * the word means the record and the reader has to follow a chain to it: the
         * request they are about to cause becomes an order, and that order is what
         * this invoice will finally charge.
         */
        abandons: {
            key: "dp-abandons",
            text:
                "This invoice cannot be entered until the request is approved and its " +
                "purchase order signed, so nothing else you have typed on this form is kept.",
        },
        confirm: "Record it",
        cancel: "Cancel",
    },

    /** One sentence per missing input, in the order above. */
    blocked: {
        [DIRECT_PURCHASE_BLOCKED.noVendor]: "Pick the vendor at the top of the form first.",
        [DIRECT_PURCHASE_BLOCKED.noFile]:
            "Attach the vendor's invoice first — the record is that document.",
        [DIRECT_PURCHASE_BLOCKED.noJob]: "Pick the job it was bought for.",
    },

    /**
     * The strip above `/prs`, and it is built to the shape #176 set — above the
     * list, a counted heading, one explanatory line, one row per case, and nothing
     * at all when there is nothing. It stands beside the over-delivery strip rather
     * than merging with it: the two are gated by different rules, their actions take
     * different records, and their refusals are different sets. What they share is
     * the pattern and the wait rule (`lib/prWait.js`).
     */
    strip: {
        heading: (n) =>
            n === 1
                ? "1 direct purchase is waiting for a request"
                : `${n} direct purchases are waiting for a request`,
        /**
         * NAMES WHO RECORDED IT AND WHO ACTS, because this is the one strip in the
         * app whose rows were put there by another person rather than derived from
         * the data. A reader seeing an invoice they did not enter, for material they
         * may not have bought, needs to know both halves before pressing anything.
         */
        explain:
            "Longest wait first. The office recorded these from a vendor's invoice; " +
            "whoever bought the material raises the request here.",
        /** No document number on the vendor's own invoice, which is allowed. */
        noCode: "no invoice number",
        /** The row's link to the document the office attached. */
        file: "View invoice",
    },

    /**
     * Claiming one: what the site is about to take on.
     *
     * A PREVIEW RATHER THAN A BARE BUTTON, the rule #217 states for the strip beside
     * this one — both surfaces that raise a request from a record show what the
     * request will arrive with, because pressing it makes you its requester.
     */
    claim: {
        heading: "Raise the request for this purchase",
        summary: (f) => ({
            key: "dp-claim",
            text:
                `This opens a draft purchase request in your name, with ${f?.vendorName ?? "the vendor"} ` +
                `and ${f?.vendorInvoiceCode ? `their invoice ${f.vendorInvoiceCode}` : "their invoice"} ` +
                "already attached as its quotation. What is not filled in is what only you " +
                "know: what was bought, which part of the job it was for, and who signs.",
        }),
        /**
         * THE DRAFT DOES NOT END THE WAIT, and saying so is what makes the strip's
         * own behavior legible: the row stays here with your name on it until the
         * request is submitted, which is also what stops it from disappearing if you
         * close the tab.
         */
        stays: {
            key: "dp-claim-stays",
            text:
                "The purchase stays on this list, marked as yours, until you submit the " +
                "request — a draft is visible to nobody else.",
        },
        confirm: "Raise the request",
        cancel: "Cancel",
    },

    /**
     * Why a claim was refused, when the page in front of somebody has gone stale.
     *
     * TWO VOICES FOR THE TWO STAGES, because what a reader does about them differs:
     * a draft needs the person holding it, and a submitted request needs nothing at
     * all. The strip is what usually says the first — this is the same fact reaching
     * the one person whose tab was open when it changed.
     */
    refused: {
        gone: "That direct purchase no longer exists.",
        taken: (f) =>
            `${f?.holderName ?? "Somebody"} already has a draft for this purchase. Ask them to ` +
            "submit it, or to delete it if it should be started again.",
        raised: (f) =>
            `${f?.prId ?? "A request"} has already been raised for this purchase, so there is ` +
            "nothing left to do here.",
    },

    /**
     * What the office reads when it lands back on an empty form.
     *
     * NAMES THE JOB RATHER THAN THE READER'S NEXT STEP, because the office has
     * none: the next move belongs to the site, and saying so is what stops someone
     * waiting for a screen of their own to change.
     */
    recorded: (f) => ({
        key: "dp-recorded",
        text:
            `${f?.directPurchaseId ?? "The direct purchase"} is recorded and waiting on ` +
            `${f?.jobCode ?? "that job"}'s list for someone there to raise the purchase request.`,
    }),
};
