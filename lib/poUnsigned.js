// Whether an order is still unsigned, and the signal that says so wherever one is
// offered for an invoice (#198).
//
// WHY THIS IS A SIGNAL AND NOT A FILTER, which is the whole shape of the issue. Site
// can only order once the President has signed and the PO PDF has gone out, so a
// vendor invoice against a PO still at `Awaiting Signature` always means something
// happened outside that rule — the site ordered directly and the office is recording
// it after the fact, or an overage order (#167) exists precisely because material
// already delivered. #168 stopped excluding those POs from the invoice-side queries for
// exactly that reason: an invoice against an unsigned order is the thing that must not
// be lost. What #168 left behind is that such a PO reaches the picker carrying nothing
// at all, so the office selects one without learning the order was never approved.
//
// SO IT SITS BESIDE `isOpen`, NOT IN A BUCKET. `/api/invoices/detect-po` puts a
// withdrawn PO in a bucket of its own because such a PO must never become a
// selectable candidate; an unsigned one must STAY selectable, so it belongs on the
// candidate as a flag, in the same category as `isOpen` — a fact that changes what a
// reader knows and nothing about what the form does.
//
// THE JUDGMENT RUNS ON THE SERVER, ONCE PER SURFACE, AND THE CLIENT ONLY READS THE
// ANSWER. `isPOUnsigned` takes a PO record and is called in exactly three places: the
// invoice form's page mapper, the detect route, and the PO search route. Each hands
// the client a plain `unsigned` boolean, so no client component compares a status
// string — which is the reason this module exists rather than a `po.status === ...`
// spelled out at three call sites that could drift apart. `offline/po-unsigned.mjs`
// asserts that `InvoiceForm.js` carries no such comparison.
//
// THE WORDING NAMES WHAT IS OBSERVED AND NOT WHY. The record cannot say which of the
// two causes it is, so the copy says the President has not signed it and stops. The
// precedent is the `withdrawn` bucket, whose note reports the contradiction and asks a
// human to resolve it rather than guessing between a vendor who shipped anyway and a
// withdrawal made in error. What is inverted here is the selection clause: withdrawn
// says it was NOT selected, and this says it was.
//
// AND THE BANNER'S TONE IS NOT RAISED. `withdrawn` forces `level: "warning"` because
// nothing can be invoiced against such a PO; here invoicing is the normal path, so
// raising the tone would make the office read ordinary work as a problem. This is the
// same grade as `isOpen: false`, which changes the sentence and not what auto-fills.
//
// `lib/materialPriceView.js:statusTag` IS DELIBERATELY NOT REUSED, and #168 already
// recorded one refusal of the same kind for `/pos`: that function is a three-status
// tag for the material screens, silent for `Signed`, worded `PO unsigned` because it
// renders beside a VENDOR name and has to name its subject. A picker option is already
// the PO's own id, so naming the subject again would repeat it. **The condition for
// merging the two is measurable**: the day this signal needs the withdrawn or
// unknown-status branches too, one function covers both and this one goes. Until then
// what they share is the status string, which is named here.
//
// PURE AND IMPORT-FREE, so a client component can import it and so
// scripts/tests/offline/po-unsigned.mjs can pin it.

/**
 * The one status string this judgment reads. Named so that a later sweep of the other
 * two places that spell it (`lib/poWithdraw.js:PO_WITHDRAWABLE_STATUSES`, `/pos`'s own
 * filter list) has something to adopt; neither is changed here, both being about
 * something else — what may be withdrawn, and what a reader may filter by.
 */
export const PO_UNSIGNED_STATUS = "Awaiting Signature";

/**
 * Is this order still unsigned?
 *
 * READS `status`, NEVER `presidentSigned`, and the two are not interchangeable: a PO
 * withdrawn before it was ever signed has `presidentSigned: false` and is NOT awaiting
 * a signature — that order ended. Keying on the checkbox would call it unsigned, which
 * is why the offline check pins that exact case.
 *
 * Server-side by intent rather than by dependency (it is pure): the callers hand the
 * client a boolean.
 */
export function isPOUnsigned(po) {
    return po?.status === PO_UNSIGNED_STATUS;
}

/**
 * What a picker option reads. TEXT, NOT A CHIP, and that is a constraint rather than a
 * preference: an `<option>` holds no markup, so the signal has to be part of the
 * label. The search escape hatch renders its results as buttons and COULD carry a
 * styled tag, and uses this same text anyway — the two feed one picker (#168), and one
 * grammar is the point.
 *
 * Takes the client-side shape (`{ poId, unsigned }`), which every source of a PO in
 * that form normalizes to: the page's mapper, the search response, and the detect
 * response's merge.
 */
export function poOptionLabel(po) {
    const poId = po?.poId || "";
    return po?.unsigned ? `${poId} — ${UNSIGNED_COPY.option}` : poId;
}

// ---------------------------------------------------------------------------
// Copy
//
// In a `*_COPY` constant rather than written into the form, so
// `offline/line-vocabulary.mjs` can read it — that check walks copy constants and
// cannot see text inlined in a component, which is how #138's own withdrawn note
// currently sits outside its reach. That note is not moved here: it is #138's wording
// and this issue adds one clause beside it rather than rewriting it.

export const UNSIGNED_COPY = {
    /** The one word a picker option adds. */
    option: "unsigned",
    /**
     * The clause the detect banner appends when a scanned PO number resolves to an
     * unsigned order. Leading space, because it is concatenated after whatever else
     * detection found — the same shape as the withdrawn and unconfirmed notes.
     *
     * Says what was observed, that the PO was still selected, and that recording such
     * an invoice is possible. It does NOT say why the order is unsigned, and it does
     * not tell the office what to do: an earlier draft ended "an invoice against an
     * unsigned order has to be recorded", which reads as an instruction about work the
     * office is already doing correctly.
     */
    detected: (poIds) => {
        const ids = (poIds || []).filter(Boolean);
        const many = ids.length > 1;
        return {
            key: "unsigned-detected",
            text:
                ` ${ids.join(", ")} ${many ? "are" : "is"} unsigned: the President has` +
                ` not signed ${many ? "them" : "it"}. ${many ? "They were" : "It was"}` +
                ` still selected — an invoice can be recorded against an unsigned order.`,
        };
    },
};
