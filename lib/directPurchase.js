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
     * no order from an invoice whose order it simply has not been shown.
     */
    affordance: "Bought without an order?",

    modal: {
        heading: "Record a direct purchase",
        /**
         * What the button is about to do, in the shape OVERAGE_COPY.preview uses:
         * name every input it takes from somewhere the reader cannot see, and every
         * one it will not take at all.
         */
        /**
         * NAMES WHAT THE SITE STILL HAS TO SUPPLY WITHOUT NAMING THE FIELD, and that
         * is the copy ban rather than a preference: `Lines` is a table, so the bare
         * word is barred in a copy constant (`offline/line-vocabulary.mjs`) even
         * where it is the legitimate sense, which this is — the requester really
         * does pick a `Lines` row. Saying which part of the job it was for is the
         * same fact in the reader's words, and it explains why the site has to be
         * the one to do it.
         */
        summary: (f) => ({
            key: "dp-summary",
            text:
                `This records ${invoiceLabel(f)} as material bought with no order behind ` +
                "it. The file you attached becomes the evidence, and the site raises the " +
                "purchase request from it: what was bought, which part of the job it was " +
                "for, and who signs are all theirs to fill in, because the invoice says " +
                "none of them.",
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
         * until the request is approved and its order signed, so this form's contents
         * are not kept and there is nothing to come back to.
         */
        abandons: {
            key: "dp-abandons",
            text:
                "This invoice cannot be entered until the request is approved and its order " +
                "is signed, so nothing else you have typed on this form is kept.",
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
