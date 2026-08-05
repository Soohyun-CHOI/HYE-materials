// Raising an overage PR from an over-delivery (#167) — the judgment and its copy.
//
// #162 records a delivery, #165 attaches the excess to a PO line anyway, #166
// shows it. This is the step that squares the RECORD with it: a corrective PR for
// the difference, and once its PO exists the excess moves onto that PO's own
// ordered item — the delivery row is re-attached and its flag clears, and the
// invoice line splits so the overage order is billed rather than reading as never
// invoiced.
//
// THE EXCESS NEEDS NO ARITHMETIC, and that is #162's decision paying off: an
// over-delivery is its OWN Delivery Items row whose `Qty` IS the excess ("the
// flagged quantity IS the excess with no arithmetic"). So nothing here subtracts
// ordered from delivered.
//
// WHICH BILL CARRIES THE EXCESS IS #166'S AMBIGUITY, SO IT IS #166'S ORDERING —
// `sortInvoicesOldestFirst`, imported rather than restated. What is NOT reused is
// `allocateLineToInvoices`'s `determinate` flag, and the reason is that it answers
// a different question: there, determinacy means the outcome does not depend on the
// order the bills are taken in, so a delivery covering EVERY bill is determinate.
// Here the question is which bill's line the excess quantity sits in, and a
// delivery covering every bill leaves that wide open. Two bills on the ordered
// item is the whole condition (`inferred` below). The premise sentence IS shared
// (`INFERRED_PREMISE`), so the two markers cannot come to explain themselves
// differently.
//
// Pure and dependency-free apart from that one sibling, so
// scripts/tests/offline/overage.mjs can pin every clause. The import spells its
// extension out for the same measured reason lib/materialPriceView.js and
// lib/deliveryAllocation.js do — the offline tier runs under plain `node`, which
// cannot resolve the extensionless intra-lib imports the rest of the app leaves to
// Next.
import { INFERRED_PREMISE, sortInvoicesOldestFirst } from "./deliveryStatus.js";

/** Why a row cannot be corrected. Keys, so a reworded message fails nothing. */
export const OVERAGE_BLOCKED = {
    notOverDelivered: "not-over-delivered",
    noOrderedItem: "no-ordered-item",
    alreadyRaised: "already-raised",
    noInvoice: "no-invoice",
    spansInvoices: "spans-invoices",
    noInvoiceFile: "no-invoice-file",
};

/**
 * WHETHER A CORRECTION IS PENDING IS READ, NEVER STORED — the linked PR's own
 * Status is the source, which is what makes a withdrawal reopen the row with no
 * write anywhere.
 *
 *   none       — no link, or the linked PR was Withdrawn. The row is offerable.
 *   pending    — Draft or In Review. Someone is on it; do not offer it again.
 *   generated  — Approved or PO Signed, so the overage PO exists.
 *
 * An unrecognized status is treated as `pending` rather than `none`: a status
 * option added to the field later must not silently make a live correction
 * offerable a second time. That is the opposite default from #144's denylist, and
 * deliberately so — here admitting what we do not recognize is the harmful
 * direction.
 *
 * READING ONE HOP FURTHER, to the overage PO's own status, for the same reason the
 * PR's status is read rather than a boolean stored. A PR cannot be withdrawn past
 * In Review (#122), so once its PO exists the PR is stuck at `PO Signed` forever —
 * but the PO itself can be withdrawn (#138) while it carries no invoice, which is
 * exactly the `not-applied` state. Without this clause such a row would read as
 * `generated` and never be offerable again, locked out by a correction that no
 * longer exists.
 *
 * `overagePO` is optional; omitting it only means a withdrawn overage order is not
 * noticed.
 */
export function overagePRState(overagePR, overagePO) {
    if (!overagePR?.status) return "none";
    if (overagePR.status === "Withdrawn") return "none";
    if (overagePR.status === "Draft" || overagePR.status === "In Review") return "pending";
    if (overagePR.status === "Approved" || overagePR.status === "PO Signed") {
        // A withdrawn overage order is no correction at all. Reaching here with the
        // excess ALREADY moved is the known gap CLAUDE.md records — `Delivered Qty`
        // has no status condition, so the excess would quietly leave the order book
        // — and it is unreachable today, because an applied overage carries an
        // invoice line and #138 refuses to withdraw a PO that has one.
        return overagePO?.status === "Withdrawn" ? "none" : "generated";
    }
    return "pending";
}

/**
 * The ordered item this row's excess belongs to, in every state.
 *
 * `Original PO Item ?? PO Item`, which is the reading the field names were chosen
 * to make legible: before the apply step the row's own `PO Item` IS the original,
 * and afterwards that names the overage order while the provenance link holds the
 * original. One expression rather than a branch at each of the four readers.
 *
 * A VERB, because the stored field now shares its name with what it holds
 * (`row.originalPOItemRecordId`) and only one of the two can be the plain noun. The
 * one that RESOLVES is the one that had to move.
 */
export function resolveOriginalPOItem(row) {
    return row?.originalPOItemRecordId ?? attachedPOItemRecordId(row);
}

/**
 * The ordered item a row is attached to RIGHT NOW.
 *
 * Reads the mapper's own shape — `poItem` is a link array, single-record only by
 * app convention — so nothing here has to be handed a flattened copy. The
 * distinction from resolveOriginalPOItem above matters exactly once: after the
 * apply step this is the OVERAGE order's item and that one is still the original's.
 */
export function attachedPOItemRecordId(row) {
    return (row?.poItem || [])[0] ?? null;
}

/**
 * Has the excess actually moved? THE FLAG IS THE SIGNAL, and it can be trusted
 * because the apply step clears `Over Delivery` in the SAME `update()` that
 * re-attaches the row to the overage PO's ordered item. Airtable applies one
 * record write atomically, so the two cannot half-happen — a row carrying an
 * `Overage PR` link with the flag still set means the apply step did not run.
 *
 * That is the only signal there is. No email can be sent (Resend is still in
 * sandbox mode), and the apply step sits OUTSIDE PO generation's rollback on
 * purpose, so a failure there leaves the PO standing and this asymmetry behind.
 */
export function isOverageApplied(row) {
    return Boolean(row?.overagePRRecordId) && !row?.overDelivery;
}

/**
 * Which bill's line the excess sits in, and whether that had to be inferred.
 *
 * OLDEST FIRST — #166's ordering, on #166's fields (`issueDate`, then
 * `invoiceId`). `bills` is one entry per invoice line on the ordered item:
 * `{ invoiceItemRecordId, invoiceRecordId, invoiceId, issueDate, qty, unitPrice,
 * hasFile }`.
 *
 * THE EXCESS MUST FIT INSIDE THE CHOSEN BILL'S LINE. When it does not, the excess
 * spans two invoices, which is out of scope: there is no single quotation to
 * attach, so the button is hidden and says so rather than picking a second
 * invoice's file. Under oldest-first that condition is exactly "the oldest bill's
 * line is smaller than the excess", so it falls out of the ordering rather than
 * needing a rule of its own.
 */
export function selectOverageBill(bills, excessQty) {
    const ordered = sortInvoicesOldestFirst(bills || []);
    // Two bills on the ordered item is the WHOLE condition — see the module
    // header on why allocateLineToInvoices's determinacy does not transfer.
    const inferred = ordered.length > 1;

    if (ordered.length === 0) {
        return { bill: null, inferred: false, blocked: OVERAGE_BLOCKED.noInvoice };
    }
    const bill = ordered[0];
    if ((bill.qty || 0) < (excessQty || 0)) {
        return { bill: null, inferred, blocked: OVERAGE_BLOCKED.spansInvoices };
    }
    return { bill, inferred, blocked: null };
}

/**
 * May this row be corrected, and with what.
 *
 * Order matters. `already-raised` is tested before anything about the invoice,
 * because a row someone is already correcting must not be reported as blocked for
 * a reason the reader would then try to fix — the same reasoning
 * getPOWithdrawEligibility gives for testing status before invoices.
 *
 * `excess` is the row's own `Qty` (see the module header).
 */
export function overageEligibility({ row, bills, overagePR, overagePO } = {}) {
    if (!row?.overDelivery) {
        return { eligible: false, blocked: OVERAGE_BLOCKED.notOverDelivered, inferred: false };
    }
    if (!attachedPOItemRecordId(row)) {
        return { eligible: false, blocked: OVERAGE_BLOCKED.noOrderedItem, inferred: false };
    }
    if (overagePRState(overagePR, overagePO) !== "none") {
        return { eligible: false, blocked: OVERAGE_BLOCKED.alreadyRaised, inferred: false };
    }

    const picked = selectOverageBill(bills, row.qty);
    if (picked.blocked) {
        return { eligible: false, blocked: picked.blocked, inferred: picked.inferred };
    }
    if (!picked.bill.hasFile) {
        return { eligible: false, blocked: OVERAGE_BLOCKED.noInvoiceFile, inferred: picked.inferred };
    }

    return {
        eligible: true,
        blocked: null,
        bill: picked.bill,
        inferred: picked.inferred,
        excess: row.qty || 0,
    };
}

/**
 * Which banner one over-delivery deserves, from the link and the flag alone.
 *
 *   null          — nothing to say (no live correction).
 *   pending       — a correction is being raised; the excess has not moved.
 *   applied       — settled: the excess is on the overage order and billed there.
 *   not-applied   — the overage PO exists and the excess never moved. THE ONE
 *                   FAILURE THIS FEATURE CAN LEAVE, and the only place it shows.
 */
export function overageBannerState({ row, overagePR, overagePO } = {}) {
    const state = overagePRState(overagePR, overagePO);
    if (state === "none") return null;
    if (state === "pending") return "pending";
    return isOverageApplied(row) ? "applied" : "not-applied";
}

// ---------------------------------------------------------------------------
// Copy
//
// ONE OBJECT, TWO GROUPS, and the axis is WHICH DOCUMENT IS BEING READ rather
// than voice or density. `preview` addresses the person about to raise the
// correction (second person, future), the way ALLOCATION_COPY.preview does.
// `banner` addresses whoever later opens one of THREE documents that all describe
// the same correction from different sides — the overage PR, the overage PO, and
// the original PO — so what varies is which of them is "this one" and therefore
// what still needs explaining.
//
// The state does NOT multiply that: `pending`, `invoiceCaveat` and `notApplied`
// are shared entries appended to whichever first sentence the site chose, so
// three sites × three states stays 3 + 3 rather than 9.
//
// SAME VOCABULARY AS #166: `delivered`, never `arrived`; `ordered item`, never
// `line`, since a `Line` on this base is a child of a Job. And facts, never
// verdicts — nothing here says the vendor over-billed or shipped wrong.

const qtyUnit = (n, unit) => `${n}${unit ? " " + unit : ""}`;
const itemLabel = (f) => [f.itemName, f.size].filter(Boolean).join(" ");

export const OVERAGE_COPY = {
    preview: {
        /**
         * What the button is about to do. Names every input it takes from
         * somewhere the reader cannot see on this page — the invoice's unit price
         * and its file — because those are what they would otherwise have to
         * trust blindly.
         */
        summary: (f) => ({
            key: "preview-summary",
            text:
                `This will raise a purchase request for ${qtyUnit(f.excess, f.unit)} of ` +
                `${itemLabel(f)} at ${f.unitPriceLabel} each — the excess delivered beyond ` +
                `what ${f.originalPoId} ordered. ${f.invoiceId} is billing for it already, so ` +
                `its file becomes the quotation and its code the vendor quotation code.`,
        }),
        /** Why the answer above rests on an ordering nothing records. */
        inferred: () => ({
            key: "preview-inferred",
            text: `Inferred: ${INFERRED_PREMISE}, so the oldest bill is treated as carrying the excess.`,
        }),
        /**
         * The chain is copied from the original request, minus anyone who is no
         * longer active — a chain that stops at a departed signer cannot be
         * unstuck from inside the app, so it is better to arrive one signer short
         * and say so.
         */
        signersDropped: (n) => ({
            key: "preview-signers-dropped",
            text:
                `${n} signer${n === 1 ? "" : "s"} on the original request ${n === 1 ? "is" : "are"} ` +
                `no longer active and ${n === 1 ? "was" : "were"} left out. Add who should sign ` +
                `before submitting.`,
        }),
        /** Nothing was copied at all, so the draft has no chain yet. */
        signersEmpty: () => ({
            key: "preview-signers-empty",
            text:
                "None of the original request's signers is still active, so the draft opens " +
                "with no signing chain. Assign one before submitting.",
        }),
        /** The draft is editable, which is the point of stopping there. */
        draft: () => ({
            key: "preview-draft",
            text:
                "It opens as a draft, so quantity, price and signers can all be changed before " +
                "it is submitted.",
        }),
        blocked: {
            [OVERAGE_BLOCKED.notOverDelivered]: () => ({
                key: OVERAGE_BLOCKED.notOverDelivered,
                text: "Nothing on this row was delivered beyond the order.",
            }),
            [OVERAGE_BLOCKED.noOrderedItem]: () => ({
                key: OVERAGE_BLOCKED.noOrderedItem,
                text:
                    "This row names no ordered item, so there is no order for a correction to " +
                    "be a correction of.",
            }),
            [OVERAGE_BLOCKED.alreadyRaised]: (f) => ({
                key: OVERAGE_BLOCKED.alreadyRaised,
                text: `${f?.overagePrId ?? "A request"} already covers this excess.`,
            }),
            [OVERAGE_BLOCKED.noInvoice]: () => ({
                key: OVERAGE_BLOCKED.noInvoice,
                text:
                    "No invoice bills this ordered item yet. The vendor's invoice is what the " +
                    "correction quotes from, so there is nothing to attach until one is entered.",
            }),
            // Out of scope, and the reason is the quotation rather than the
            // arithmetic: two invoices means two files, and a PR takes one.
            [OVERAGE_BLOCKED.spansInvoices]: () => ({
                key: OVERAGE_BLOCKED.spansInvoices,
                text:
                    "The excess is larger than the oldest bill on this ordered item, so it spans " +
                    "more than one invoice. There is no single quotation to attach — raise the " +
                    "correction by hand.",
            }),
            [OVERAGE_BLOCKED.noInvoiceFile]: (f) => ({
                key: OVERAGE_BLOCKED.noInvoiceFile,
                text: `${f?.invoiceId ?? "That invoice"} has no file attached, so there is nothing to quote from.`,
            }),
        },
    },

    banner: {
        /** Reading the corrective request itself. */
        overagePR: (f) => ({
            key: "banner-overage-pr",
            text:
                `This request covers ${qtyUnit(f.excess, f.unit)} of ${itemLabel(f)} delivered ` +
                `beyond what ${f.originalPoId} ordered, on delivery ${f.deliveryId}.`,
        }),
        /** Reading the corrective order. */
        overagePO: (f) => ({
            key: "banner-overage-po",
            text:
                `This order covers ${qtyUnit(f.excess, f.unit)} of ${itemLabel(f)} delivered ` +
                `beyond what ${f.originalPoId} ordered, on delivery ${f.deliveryId}. ` +
                `${f.overagePrId} is the request behind it.`,
        }),
        /**
         * Reading the order that was over-delivered. NAMES THE DELIVERY RATHER
         * THAN CLAIMING "this order was over-delivered", because one delivery can
         * fill two orders of the same material and the excess attaches to the last
         * one filled — so this banner is reachable from an order that was not
         * itself exceeded. Naming the delivery and the item is true either way.
         */
        originalPO: (f) => ({
            key: "banner-original-po",
            text:
                `Delivery ${f.deliveryId} delivered ${qtyUnit(f.excess, f.unit)} of ` +
                `${itemLabel(f)} beyond what was ordered. ${f.overagePrId} covers the ` +
                `difference${f.overagePoId ? ` (${f.overagePoId})` : ""}.`,
        }),

        /** Appended while the correction is still a request. */
        pending: (f) => ({
            key: "banner-pending",
            text:
                `${f.overagePrId} is still being approved, so the excess is still on ` +
                `${f.originalPoId}'s ordered item.`,
        }),
        /**
         * THE ACCOUNTING CAVEAT, and the reason the banner outlives signature. An
         * overage order read on its own looks like a duplicate with no quotation
         * of its own; worse, the invoice attached to it also bills the original
         * order, so nobody reconciling a payment against that invoice can match it
         * to either order's total alone.
         */
        invoiceCaveat: (f) => ({
            key: "banner-invoice-caveat",
            text:
                `${f.invoiceId} bills both orders, so a payment against it will not match ` +
                `${f.thisPoId ?? "this order"}'s total on its own.`,
        }),
        /**
         * The asymmetry PO generation can leave behind. Says what did not happen
         * and where the excess still is, because there is no notification and this
         * is the only place it surfaces.
         */
        notApplied: (f) => ({
            key: "banner-not-applied",
            text:
                `The excess has not moved yet: ${f.overagePoId ?? "the overage order"} exists, but ` +
                `delivery ${f.deliveryId}'s extra ${qtyUnit(f.excess, f.unit)} is still on ` +
                `${f.originalPoId}'s ordered item and ${f.invoiceId ?? "the invoice"} still bills ` +
                `that order for it.`,
        }),
    },
};

/**
 * Every message the preview should show, in order. All the branching lives here so
 * neither the modal nor the Server Action decides which case it is looking at.
 *
 * A blocked row gets ONE message — the reason — because nothing else it might say
 * is true, the same shape describePlan uses for a blocked delivery plan.
 */
export function describeOveragePreview(eligibility, facts = {}) {
    if (!eligibility?.eligible) {
        const builder = OVERAGE_COPY.preview.blocked[eligibility?.blocked];
        return builder ? [builder(facts)] : [];
    }

    const messages = [OVERAGE_COPY.preview.summary({ ...facts, excess: eligibility.excess })];
    if (eligibility.inferred) messages.push(OVERAGE_COPY.preview.inferred());
    if (facts.signersEmpty) messages.push(OVERAGE_COPY.preview.signersEmpty());
    else if (facts.signersDropped > 0) {
        messages.push(OVERAGE_COPY.preview.signersDropped(facts.signersDropped));
    }
    messages.push(OVERAGE_COPY.preview.draft());
    return messages;
}

/**
 * Every message one banner should show, in order, for one site.
 *
 * `site` is `overagePR` / `overagePO` / `originalPO`. Returns [] when there is
 * nothing to say, so a page renders no empty box.
 */
export function describeOverageBanner({ site, state, facts = {} } = {}) {
    const first = OVERAGE_COPY.banner[site];
    if (!first || !state) return [];

    const messages = [first(facts)];
    if (state === "pending") {
        messages.push(OVERAGE_COPY.banner.pending(facts));
        // No caveat: until the split happens the invoice bills one order only, so
        // saying it spans two would be false.
        return messages;
    }
    if (state === "not-applied") {
        messages.push(OVERAGE_COPY.banner.notApplied(facts));
        return messages;
    }
    messages.push(OVERAGE_COPY.banner.invoiceCaveat(facts));
    return messages;
}
