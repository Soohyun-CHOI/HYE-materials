// A delivery's activity (#680): what `Delivery Log` records has happened to a recorded delivery,
// and every word its page says about it.
//
// ONE EVENT IS WRITTEN AND TWO ARE CHOICES. `Address corrected` is #680's: the delivery's address was
// corrected from one of its job's addresses to another, which moves its stock with it. `Order
// attached` is #277's — the office attaching a delivery recorded with no order to one — and stands
// in the select because Airtable writes a select's choices only when the field is made; nothing
// writes it yet, and its words are that issue's to choose.
//
// PURE AND OFFLINE-SAFE: `lib/airtable/deliveryLog.js` takes the events from here, the page its
// rows and words, and the offline tier pins both.

/** `Delivery Log."Event"`'s choices, the screen's words. #680 writes the first alone. */
export const DELIVERY_LOG_EVENTS = Object.freeze({
    ADDRESS_CORRECTED: "Address corrected",
    ORDER_ATTACHED: "Order attached",
});

/** Every word the delivery's activity says. */
export const DELIVERY_ACTIVITY_COPY = Object.freeze({
    heading: "Activity",
    addressCorrected: (from, to) => `Address corrected from ${from} to ${to}`,
    by: (name) => `by ${name}`,
});

/**
 * The delivery's activity, newest first: one row per `Delivery Log` row — `{ key, text, by, at }`,
 * `by` the person's id and `at` the instant, for the page to name and draw. An address the base no
 * longer resolves reads as an em dash rather than an id, and an event with no words here yet reads
 * as itself, so a row #277 writes before its words land is still shown.
 */
export function deliveryActivity(entries, addressLabelById) {
    const label = (link) => addressLabelById.get((link ?? [])[0]) ?? "—";
    return [...(entries ?? [])]
        .sort((a, b) => String(b.eventAt ?? "").localeCompare(String(a.eventAt ?? "")) || String(b.deliveryLogId ?? "").localeCompare(String(a.deliveryLogId ?? ""), "en", { numeric: true }))
        .map((entry) => ({
            key: entry.id,
            text:
                entry.event === DELIVERY_LOG_EVENTS.ADDRESS_CORRECTED
                    ? DELIVERY_ACTIVITY_COPY.addressCorrected(label(entry.formerAddress), label(entry.address))
                    : String(entry.event ?? ""),
            by: (entry.recordedBy ?? [])[0] ?? null,
            at: entry.eventAt ?? null,
        }));
}
