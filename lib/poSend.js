// Sending a signed order to the vendor (#281) — the whole concern in one module:
// which orders may be sent, both voices of the screen copy, and the mail itself.
// The same shape `lib/poWithdraw.js` has for withdrawal, minus the write, which
// stays in the action because the send has to happen first (see below).
//
// THIS IS THE FIRST MAIL THIS APP SENDS OUTSIDE THE COMPANY. The four sends in
// `lib/email.js` before it all go to staff — a magic link to a company address, and
// three notifications to a signer, the President and a requester. Two things follow.
//
// `From` STAYS `FROM_ADDRESS` AND THE REPLY PATH IS `Reply-To`. Resend will only
// send from a verified domain, so a sender's own address cannot go in `From`; putting
// it in `Reply-To` is what makes the vendor's reply reach the person who pressed the
// button rather than a shared mailbox nobody reads.
//
// THE MAIL'S WORDS ARE HERE RATHER THAN IN `lib/email.js`, WHICH IS A DEPARTURE FROM
// THE OTHER FOUR. Those four write their HTML inline, where
// `offline/line-vocabulary.mjs` cannot see it — that check walks `*_COPY` constants
// and nothing else. Every other send is read by a colleague who would recognize a
// wrong word; this one is read by a vendor who would not, so it is the one that has
// to be inside the vocabulary check. The other four are not moved here: their wording
// is their own issues' and this one adds a constant beside them rather than rewriting
// them.
//
// PURE AND IMPORT-FREE, so `offline/po-send.mjs` can pin all of it and so the form
// can read the copy without reaching a credentialed module.

/**
 * The Status value a successful send writes.
 *
 * REVIVED FROM #144, WHICH REMOVED IT, AND THAT ISSUE'S OWN BODY IS THE AUTHORITY
 * FOR REVIVING IT. It removed the option because nothing wrote it and because the
 * state it recorded was not needed to say an invoice was expected — "Invoice entry
 * also stays open to any signed PO rather than being narrowed to ordered ones, which
 * was the main thing this status would have enabled". That purpose is untouched here:
 * the invoice-side queries exclude only `Withdrawn`, so a sent order still reaches
 * the picker, and `offline/source-shape.mjs` already pins that the excluded status is
 * interpolated in exactly one place. #144 named the condition that would bring the
 * option back, and this is it.
 *
 * `sent` RATHER THAN `ordered` OR `emailed`. `ordered` is spent: an `ordered item` is
 * a `PO Items` row, and `countsAsOrdered` counts an order as ordered whenever it is
 * not withdrawn, signature or no — so the same word would carry two meanings on one
 * screen. `emailed` puts the means in the name and goes wrong the day the route does.
 * That `sent` says nothing about what happened at the vendor's end is honest rather
 * than weak: the app cannot see a bounce, and this field records what the app did.
 */
export const PO_SENT_STATUS = "Sent to Vendor";

/**
 * Why an order cannot be sent, keyed so the page and the action cannot disagree.
 *
 * `already-sent` IS THE ONE THAT IS NOT A REFUSAL ON SCREEN. A sent order shows the
 * record of the send where the button was, so a reader never meets this text; the
 * action still needs it, because a Server Action is directly callable.
 */
export const SEND_REFUSAL = {
    withdrawn: "This PO was withdrawn, so it can't be sent to the vendor.",
    unsigned: "This PO hasn't been signed yet, so there is no order document to send.",
    "no-document": "This PO has no document on file yet, so there is nothing to attach.",
    "no-address":
        "This vendor has no PIC Email on record, so there is nowhere to send this. Add one on the vendor's record first.",
    "already-sent": "This PO has already been sent to the vendor.",
};

/**
 * May this order be sent, and if not, why?
 *
 * Pure — the caller passes an already-loaded order and the vendor's address, the same
 * contract as `getPOWithdrawEligibility` and `canViewPR`.
 *
 * THE ORDER OF THE TESTS IS THE ORDER A READER WOULD FIX THEM IN, and the first two
 * are the gates the regeneration control already has: a withdrawn order gets no new
 * documents (#138, and mailing one to the vendor is the strongest form of that), and
 * the PDF exists only after the signature.
 *
 * `no-document` IS THE FIFTH CONDITION AND IT IS REAL RATHER THAN DEFENSIVE. Signing
 * generates the PDF in a separate try/catch, so a signed order with an empty
 * `PO PDF File` is a state this app produces — it is why the regeneration control
 * exists at all. A send from there would have nothing to attach.
 *
 * `alreadySent` READS `Sent At` AND NOT `Status`. The two are written together, so
 * they only disagree after a hand edit in Airtable, and there the timestamp is the
 * fact while the status is the stage.
 */
export function getPOSendEligibility({ po, vendorEmail }) {
    if (po?.status === "Withdrawn") {
        return { eligible: false, reason: "withdrawn" };
    }
    if (!po?.presidentSigned) {
        return { eligible: false, reason: "unsigned" };
    }
    if (!po?.poPdfFile?.[0]?.url) {
        return { eligible: false, reason: "no-document" };
    }
    if (!vendorEmail) {
        return { eligible: false, reason: "no-address" };
    }
    if (po?.sentAt) {
        return { eligible: false, reason: "already-sent" };
    }
    return { eligible: true, reason: null };
}

// ---------------------------------------------------------------------------
// Copy

export const SEND_COPY = {
    /** The control, beside the order document's download link. */
    button: "Send to vendor",
    pending: "Sending...",
    /**
     * The record of the send, where the button was.
     *
     * ONE SEND, SO NO `last`. A second send is refused once one has succeeded, which
     * is what lets this sentence name the send rather than the most recent one. The
     * three facts are the three fields, in the order somebody asks for them.
     */
    sent: ({ address, when, by }) =>
        `Sent to ${address} on ${when}${by ? ` by ${by}` : ""}.`,
    /**
     * What a reader who cannot send is told instead. Only the four states a reader can
     * reach on this page — `already-sent` has the sentence above rather than a
     * refusal.
     */
    refusal: SEND_REFUSAL,
    /**
     * What went wrong, for the person who pressed the button.
     *
     * TWO FAILURES AND THEY ARE NOT THE SAME NEWS. `sendFailed` means nothing left
     * the app, so pressing again is a first send rather than a second. `recordFailed`
     * means the vendor has the order and the record does not say so — the reader has
     * to know that, because the one thing they must not do is assume it never went.
     */
    sendFailed: "Couldn't send this PO to the vendor. Nothing was sent — try again.",
    recordFailed:
        "The PO was emailed to the vendor, but recording the send failed. Do not send it again — the vendor has it. Ask for the record to be corrected in Airtable.",
    /**
     * The mail itself.
     *
     * ADDRESSED TO A VENDOR, WHICH IS WHY IT NAMES THE COMPANY AND NOT THE PRODUCT.
     * `From` carries the product's name, which means nothing to a vendor, so the body
     * names the buyer the way the order document does. `buyerName` is passed in rather
     * than imported: it belongs to `lib/poPdf.js:HYE_BUYER_NAME`, which reaches Blob
     * and so cannot be imported here.
     *
     * IT DOES NOT RESTATE THE ORDER. The attached document is the order, and a mail
     * that summarized it would be a second version of the same figures — the thing
     * this app exists to stop. The total is named once, so a vendor can see at a
     * glance that the right document arrived.
     *
     * THE LAST LINE IS WHAT `Reply-To` IS FOR, said out loud. A vendor who does not
     * know that replying reaches a person will look up a phone number instead.
     *
     * `buyerName` IS THE SENTENCE'S SUBJECT, AND THAT IS THE FIX FOR A REAL DEFECT
     * RATHER THAN A STYLE. The body read `… from ${buyerName}. The order total is …`
     * and the name is `HANYANGENG USA INC.`, so the first send went out saying
     * `HANYANGENG USA INC..` — the name's own abbreviating period plus the sentence's.
     * In the subject position the next word is always a lowercase verb, so nothing
     * this template writes can abut the name's punctuation, whatever the name is.
     * **The two fixes that look easier are both wrong**: stripping a trailing period
     * would have the app editing somebody else's legal name, and appending one only
     * when the name does not end in a period is a branch that is wrong for the first
     * vendor-facing name that ends in some other way. The template does not inspect
     * the name at all.
     */
    mail: {
        subject: ({ poId, buyerName }) => `Purchase Order ${poId} from ${buyerName}`,
        html: ({ poId, buyerName, vendorName, totalAmount, senderName }) =>
            [
                `<p>Dear ${vendorName},</p>`,
                `<p>${buyerName} has issued purchase order <strong>${poId}</strong>,`,
                ` attached, for a total of ${totalAmount}.</p>`,
                `<p>Please confirm receipt. Replying to this message reaches`,
                ` ${senderName} directly.</p>`,
            ].join(""),
        /** The attachment's filename, when the stored one is missing. */
        fallbackFilename: (poId) => `${poId}.pdf`,
    },
};
