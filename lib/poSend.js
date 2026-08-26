// Sending a signed order to the vendor (#281) — the whole concern in one module:
// which orders may be sent, both voices of the screen copy, and the two mails, the
// vendor's and the one that tells the requester their turn has come (#290).
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
// THE MAILS' WORDS ARE HERE RATHER THAN IN `lib/email.js`, WHICH IS A DEPARTURE FROM
// THE OTHER TWO. Those two write their HTML inline, where
// `offline/line-vocabulary.mjs` cannot see it — that check walks `*_COPY` constants
// and nothing else. Every other send is read by a colleague who would recognize a
// wrong word; the vendor's is read by somebody who would not, so it is the one that
// has to be inside the vocabulary check. #290 then moved a second one for a different
// reason — see `SIGNED_NOTICE_COPY`, whose body has to be CALLABLE by a check rather
// than merely readable. #292 moved the third for that same reason, to
// `lib/poUnsigned.js`, on the rule that a mail carrying a FIGURE has to be callable;
// the two that carry none keep their wording where their own issues put it.
//
// PURE, so `offline/po-send.mjs` can pin all of it and so the form can read the copy
// without reaching a credentialed module. It was import-free until #292, which put
// `formatUSD` inside the two bodies that print money — `lib/format.js` is pure and
// imports nothing itself, and the extension is spelled out because the offline tier
// runs under plain `node` with no loader, which is `lib/poDocuments.js`'s shape for
// the same import.
import { formatUSD } from "./format.js";

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
 * WHO MAY SEND AN ORDER TO ITS VENDOR: the office, or the requester of the purchase
 * request behind it.
 *
 * **THE REQUESTER IS HERE BECAUSE SENDING THE ORDER *IS* PLACING IT.** A purchase
 * order emailed to a vendor with the document attached is the order — not a
 * formality that follows one. So this is the act #138 built the withdrawal control
 * around: "site staff place the vendor order and are the ones who decide not to". The
 * person who decides to order and the person who decides not to have to be the same
 * person, or that issue's reasoning does not hold.
 *
 * **THE OFFICE IS HERE BECAUSE THE TWO ACTS ARE NOT SYMMETRIC IN CONSEQUENCE.**
 * Not withdrawing leaves everything as it was; not sending stops the work. A single
 * requester on leave would stall an approved, signed order with nobody able to move
 * it, so the people who have always done this by hand keep being able to.
 *
 * THE SHAPE IS `lib/deliveryAccess.js:canAccessJobDeliveries`'s, deliberately: the
 * office short-circuit first, then the per-record comparison. That module is the
 * precedent for a mixed axis — its own note says "a site employee assigned to the Job
 * must pass and an Admin on no job must too" — and it is why the actions here are
 * `requireUser()` plus this predicate rather than a role wrapper.
 *
 * **THE DOCUMENT CONTROL SHARES THIS PREDICATE, and that is the point rather than
 * reuse for its own sake.** Sending needs a document to attach, so whoever may send
 * must be able to produce the one the signature should have produced; a requester who
 * may send but must ask the office to generate is blocked on the office with no signal
 * that they are.
 *
 * Pure, so `offline/po-send.mjs` can pin every clause.
 */
export function canSendPOToVendor(user, pr) {
    if (!user || !pr) return false;
    if (user.role === "President" || user.isAdmin === true) return true;
    return (pr.requester || [])[0] === user.id;
}

/**
 * Why an order cannot be sent, keyed so the page and the action cannot disagree.
 *
 * FOUR, AND `already-sent` IS NOT ONE OF THEM. Being already sent is not a failure —
 * it is the answer to the question the presser asked, and it has its own voice below.
 */
export const SEND_REFUSAL = {
    withdrawn: "This PO was withdrawn, so it can't be sent to the vendor.",
    unsigned: "This PO hasn't been signed yet, so there is no order document to send.",
    "no-document": "This PO has no document on file yet, so there is nothing to attach.",
    "no-address":
        "This vendor has no PIC Email on record, so there is nowhere to send this. Add one on the vendor's record first.",
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
     * What a reader who cannot send is told instead. Two of the four are reachable on
     * the page; the other two are answered higher up by the page's own shape and are
     * kept for a caller that does not come through it.
     */
    refusal: SEND_REFUSAL,
    /**
     * WHAT THE SECOND PRESSER SEES, AND IT IS NOT AN ERROR.
     *
     * Two people may send now — the requester and the office — so both can be looking
     * at an unsent order while one of them presses. The other's screen is a moment
     * stale and their button still works. `Sent At` makes the action refuse, which is
     * the same judgment that refuses a resend, so nothing new decides it.
     *
     * BUT THE ANSWER IS INFORMATION RATHER THAN FAILURE. Nothing went wrong: the
     * vendor has the order, which is what the presser wanted. So it names who sent it
     * and when, and the form renders it away from the red box the refusals use.
     */
    alreadySent: ({ address, when, by }) =>
        `Already sent${by ? ` by ${by}` : ""} on ${when}, to ${address}. Nothing was sent again.`,
    /**
     * BESIDE THE CONTROL THAT MAKES THE MISSING DOCUMENT, and it exists because the
     * requester did not create this state and has no way to know what it means.
     *
     * The document should have been produced by the signature — `signPOAction`
     * generates it in a try/catch of its own, so a signed order with an empty
     * `PO PDF File` is that step having failed and nothing else. Three things a reader
     * needs: that it was supposed to exist, that pressing makes it now, and that
     * sending becomes possible once it does — which is the question they came here
     * with.
     *
     * SHOWN TO EVERYONE WHO HAS THE CONTROL, not to the requester alone. The office
     * did not create the state either.
     */
    documentMissing:
        "This PO's document should have been created when it was signed, and that step " +
        "failed. Generating it here creates the same document, and the order can be sent " +
        "to the vendor once it exists.",
    /**
     * The two refusals the document control needs, beside the send's own four.
     *
     * `notYours` is BOTH actions' — the axis is one predicate, so the sentence is one
     * too. It names the two who may act rather than a role, because neither of them is
     * one.
     *
     * `documentExists` is the contract this branch narrowed. It reads as "nothing to
     * do" rather than as a failure, because for anybody coming through the screen it
     * cannot happen.
     */
    notYours:
        "Only the person who raised the purchase request, or the office, can send this PO to the vendor.",
    documentExists:
        "This PO already has its document, so there is nothing to generate. Download it above.",
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
     * `totalAmount` IS A NUMBER AND THIS BODY FORMATS IT (#292). It arrived formatted
     * until then, which put the one step that can be forgotten at the call site — and
     * #290 found it forgotten on the third of these mails, where a total of
     * `220.00000000000003` went out with every digit. A body that owns its own
     * rendering has nothing for a caller to remember. **A string reaching this is
     * still wrong and is still silent** — `formatUSD` coerces it to `$0.00` — so
     * `offline/mail-money.mjs` asserts on the AST that every call site hands over the
     * order's own field rather than a call or a literal.
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
                ` attached, for a total of ${formatUSD(totalAmount)}.</p>`,
                `<p>Please confirm receipt. Replying to this message reaches`,
                ` ${senderName} directly.</p>`,
            ].join(""),
        /** The attachment's filename, when the stored one is missing. */
        fallbackFilename: (poId) => `${poId}.pdf`,
    },
};

/**
 * The mail the requester gets when the President signs their order (#290).
 *
 * IT IS AN INSTRUCTION NOW AND IT WAS A NOTICE BEFORE, WHICH IS #281's DOING RATHER
 * THAN A REWORDING. Signing was the end of this app's part in an order, so the mail
 * announced a completed fact — subject `PO … signed — … is confirmed`, body `has been
 * signed`, link `Open {prId}` — and left the reader nothing to do. Sending the order
 * IS placing it, and `canSendPOToVendor` above puts that in the requester's hands, so
 * the one message that tells them the signature happened now has to tell them what is
 * waiting. The two `lib/email.js` sends that already ask for something say
 * `Action needed:`, and this joins them.
 *
 * THE WORDS ARE HERE FOR A DIFFERENT REASON THAN `SEND_COPY.mail`'s, AND BOTH REASONS
 * ARE WORTH KEEPING. That one is read by a vendor who would not recognize a wrong
 * word, so it has to be inside `offline/line-vocabulary.mjs`. This one is read by a
 * colleague — but `lib/email.js` throws at module load without `RESEND_API_KEY`, so the
 * offline tier can never import it, and a body assembled inside that file can never be
 * CALLED by a check. As a pure builder it can: the quiet mutant this issue guards
 * against is the caller not passing the order's url, and only a callable body lets a
 * check see what the mail then says. The vocabulary coverage comes along free.
 *
 * IT NAMES THE ACT AND NEVER THE CONTROL, WHICH IS WHAT KEEPS IT TRUE IN BOTH STATES.
 * `notifyPOSigned` fires BEFORE `generateAndAttachPOPdf` in `signPOAction`, and that
 * step can fail — so at the moment this mail is written nobody knows whether the page
 * it points at will offer `Send to vendor` or the control that makes the missing
 * document. Quoting the button would have been the natural cross-pin and would read as
 * a lie on the branch `SEND_COPY.documentMissing` exists for. Pointing at the page
 * instead is true either way, and that sentence is already there to explain the rest.
 *
 * THE REQUEST IS AN IDENTIFIER AND NOT A DESTINATION. The link was the request's and is
 * the order's, because everything the reader now has to do happens on the order's page.
 * The request's id stays in the text for the one thing it is still needed for:
 * a requester knows their own `PR ID` and has never seen this `PO ID`, which is
 * generated, so without it the mail names nothing they recognize.
 *
 * THE TOTAL IS FORMATTED HERE, AND THIS PARAGRAPH SAID THE OPPOSITE (#292). It read
 * "formatted by the caller … arrives as a string", which was true of this builder and
 * of `SEND_COPY.mail` both — and it is the shape #290 had just been written to fix one
 * instance of: the step a caller can forget was still at the call site, and the third
 * of these mails had forgotten it. The builder takes the number and renders it, so
 * #233's rule reaches the mail with nothing for a caller to remember.
 */
export const SIGNED_NOTICE_COPY = {
    subject: ({ poId }) => `Action needed: send PO ${poId} to the vendor`,
    html: ({ poId, prId, poUrl, vendorName, totalAmount }) =>
        [
            `<p><strong>${poId}</strong> — the order for your request ${prId} —`,
            ` has been signed.</p>`,
            `<p>Vendor: ${vendorName}<br>Total Amount: ${formatUSD(totalAmount)}</p>`,
            `<p>Placing the order is the next step: <a href="${poUrl}">open ${poId}</a>`,
            ` and send it to the vendor from that page. Sending the order to the vendor`,
            ` is what places it.</p>`,
        ].join(""),
};
