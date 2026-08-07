import { base, TABLES, findByRecordIds } from "./client";
import { formulaString } from "../airtableFormula";
import { hasUninvoicedQty } from "../poItemQty";
import { generateNextPOId } from "../ids";

/**
 * The terminal "requester decided not to order after all" Status option
 * (issue #138). Lives here rather than in lib/poWithdraw.js because it's
 * this table's own vocabulary — the filterByFormula strings below and the
 * write in poWithdraw.js both need it, and defining it here keeps the
 * dependency one-way (poWithdraw -> purchaseOrders) instead of circular.
 * The Airtable select option itself is added by hand outside the repo.
 */
export const PO_WITHDRAWN_STATUS = "Withdrawn";

/**
 * Find a PO by its backend-generated PO ID.
 * Returns null if not found.
 */
export async function getPOById(poId) {
    const records = await base(TABLES.PURCHASE_ORDERS)
        .select({
            filterByFormula: `{PO ID} = "${formulaString(poId)}"`,
            maxRecords: 1,
        })
        .firstPage();

    if (records.length === 0) return null;
    return recordToPO(records[0]);
}

/**
 * Many POs by record id, batched (#19). The material-axis screens need each
 * source PO's `PO ID` (to show and link) and its `PR` link (to judge whether the
 * viewer may see identifiers at all), for every row on the page at once — so one
 * `.find()` per row is exactly what #143 ruled out.
 */
export async function getPOsByRecordIds(recordIds) {
    return (await findByRecordIds(TABLES.PURCHASE_ORDERS, recordIds)).map(recordToPO);
}

/**
 * Find a PO by its Airtable record ID.
 * Returns null if not found.
 */
export async function getPOByRecordId(recordId) {
    const record = await base(TABLES.PURCHASE_ORDERS).find(recordId);
    if (!record) return null;
    return recordToPO(record);
}

function recordToPO(record) {
    return {
        id: record.id,
        poId: record.get("PO ID"),
        pr: record.get("PR"),
        vendor: record.get("Vendor"), // Lookup via PR — read-only
        quotationFile: record.get("Quotation File"), // Lookup — read-only
        ourPic: record.get("Our PIC"),
        ourManager: record.get("Our Manager"),
        createdDate: record.get("Created Date"),
        presidentSigned: record.get("President Signed") || false,
        presidentSignedAt: record.get("President Signed At"),
        status: record.get("Status"),
        // Issue #138 — stamped in the same write as Status -> Withdrawn
        // (lib/poWithdraw.js), never cleared. Blank on every PO that was
        // never withdrawn. UTC ISO instant, *At convention, mirroring
        // Purchase Requests."Withdrawn At" (#122).
        withdrawnAt: record.get("Withdrawn At"),
        poPdfFile: record.get("PO PDF File"),
        // Issue #138 — reverse-links read by the withdraw eligibility
        // predicate ("does this PO have an invoice against it"). Core link
        // data, no propagation lag (see client.js:getLinkedRecords), so
        // exposing them here costs no extra fetch and needs no rollup.
        // Invoice-PO Link holds one join row per invoice; Invoice Items is
        // the per-line reverse-link, used only as a safety net.
        invoicePoLinks: record.get("Invoice-PO Link") || [],
        invoiceItems: record.get("Invoice Items") || [],
        // Issue #19 — the line-item reverse-link, same category as the two
        // above: core link data with no propagation lag, so exposing it costs
        // nothing. It lets the material-axis screens fetch exactly the lines of
        // the POs they already have, instead of every line a material ever had.
        poItems: record.get("PO Items") || [],
        // Issue #78 — renamed from "Total Amount": rollup of PO Items only,
        // before Shipping Fee.
        itemsSubtotal: record.get("Items Subtotal"),
        deliveryAddressUsed: record.get("Delivery Address Used"),
        // Issue #78 — plain copy of the PR's Shipping Fee, frozen at
        // PO-generation time (createPO), same pattern as PO Items
        // snapshotting PR Items. Replaces #69's "PR Shipping Fee" Lookup.
        shippingFee: record.get("Shipping Fee"),
        // New formula (Items Subtotal + Shipping Fee) — the PO's true
        // final figure, and what's printed as the PO PDF's TOTAL line.
        totalAmount: record.get("Total Amount"),
    };
}

/**
 * The status condition both invoice-side PO readers share, in ONE place.
 *
 * It was two separate strings, and each carried the same two-status `AND(...)`.
 * A change to one would have left the other answering differently — and both feed
 * the SAME SCREEN, the invoice form's picker and its "show all / search" escape
 * hatch, so the divergence would have shown up as a PO the dropdown hides and the
 * search finds. That is the exact asymmetry #168 was diagnosing when it found
 * this, so fixing one while creating another was not an option.
 *
 * WHY IT IS INTERPOLATED RATHER THAN ASSIGNED. `filterByFormula` cannot be handed
 * this constant directly: offline/formula-escaping.mjs fails a value that is not a
 * template literal, because it cannot verify a formula passed by variable. So each
 * reader keeps its own template literal and interpolates this fragment, which is
 * listed in that check's exemption table — replacing the narrower
 * `PO_WITHDRAWN_STATUS` entry rather than adding to it, so the list stays at one.
 */
const PO_NOT_WITHDRAWN = `{Status} != "${PO_WITHDRAWN_STATUS}"`;

/**
 * Every PO except withdrawn ones — the PO picker on the Invoice entry form
 * (issue #14), and the set its search escape hatch covers.
 *
 * NAMED FOR THE FILTER, NOT FOR A BUSINESS RULE, and #168 is why. It used to also
 * exclude `Awaiting Signature`, on the stated ground that "a PO that hasn't even
 * been signed/sent to the vendor yet can't have a real vendor invoice against it".
 * THAT GROUND IS FALSE and the base disproves it: `HYE-PO-20260805-02` is Awaiting
 * Signature and carries an invoice. Two normal paths produce it. Site staff order
 * outside the app and the PR/PO follow as a record, which is the same fact #162
 * cites for not filtering delivery candidates on signature status and the reason
 * `Committed Qty` and `Signed Qty` are separate fields. And a corrective PO (#167)
 * exists *because* material already arrived, so the excess invoice can precede it
 * by construction — the vendor bills for what it shipped.
 *
 * `Withdrawn` stays excluded (#138): that order will never receive an invoice, so
 * offering it as a target for one would be offering a mistake.
 *
 * A name like `getInvoiceablePOs` would be true today and silently false the day a
 * second un-invoiceable status appears, since this is a DENYLIST (#144) and admits
 * whatever it does not name. Naming the exclusion cannot rot that way.
 *
 * `vendor` here is the raw Vendor record ID (Purchase Orders.Vendor is a Lookup
 * through PR -> Purchase Requests.Vendor, itself a link field — same gotcha
 * already documented for `po.vendor` elsewhere) — callers resolve it against
 * `getAllVendors()`, same pattern as the PR detail page's Job/Vendor/Line
 * resolution.
 */
export async function getPOsExceptWithdrawn() {
    const records = await base(TABLES.PURCHASE_ORDERS)
        .select({
            filterByFormula: `${PO_NOT_WITHDRAWN}`,
        })
        .all();

    return records.map(recordToPO);
}

/**
 * Server-side search over the complete set above (issue #57's "Show all / search
 * closed POs" escape hatch) — matches PO ID substrings only.
 *
 * It described itself as "the *complete* invoiceable PO set" while excluding
 * Awaiting Signature, so "complete" was not true; #168 narrowed the filter to
 * match, and the status condition now comes from PO_NOT_WITHDRAWN so this and
 * getPOsExceptWithdrawn cannot answer differently about the same PO.
 *
 * Vendor-name search isn't offered: Purchase Orders.Vendor is a Lookup through
 * PR -> Purchase Requests.Vendor, not a direct link, so it can't be filtered
 * server-side the way CLAUDE.md's link-field-filtering rule already documents for
 * other tables; Vendor scoping instead stays entirely client-side in
 * InvoiceForm.js (posForVendor), same as the default open-POs list.
 */
export async function searchPOs(query) {
    // Issue #18 — was an inline copy of this same escape. One rule, one
    // implementation: lib/airtableFormula.js:formulaString, shared with every
    // other filterByFormula that interpolates a value (#159 finished the sweep).
    const records = await base(TABLES.PURCHASE_ORDERS)
        .select({
            filterByFormula: `AND(${PO_NOT_WITHDRAWN}, SEARCH(LOWER("${formulaString(query)}"), LOWER({PO ID})))`,
        })
        .all();

    return records.map(recordToPO);
}

/**
 * Every PO, whatever its status — the /pos list (#168).
 *
 * THIS NAME WAS REBOUND, AND IT WAS EMPTY WHEN THIS TOOK IT. Before #168 it meant
 * "every PO except Awaiting Signature and Withdrawn", which is `getPOsExceptWithdrawn`
 * above with a filter narrowed to one status. The commit that renamed it measured
 * the old name at zero occurrences across the repo before this one reused it, so
 * the two meanings never coexisted in a single tree — see that commit's message,
 * which is the only place that measurement survives.
 *
 * HAVING NO FILTER IS THE CONTRACT HERE, not an omission, and the failure mode is
 * why it is worth stating. A list shows what it shows: add a status condition and
 * the matching rows stop appearing, with nothing on screen to say a row was
 * withheld. Every status belongs — `Awaiting Signature` is the President's own
 * worklist, and `Withdrawn` is kept on record rather than deleted (#138), exactly
 * as the PR list keeps withdrawn PRs (#122). `offline/source-shape.mjs` asserts
 * this function builds no `filterByFormula`.
 *
 * Row-level visibility is NOT this function's job — /pos filters with `canViewPR`
 * against each PO's parent PR, the same gate /pos/[poId] uses.
 *
 * SORTED BY `PO ID` DESCENDING, SERVER-SIDE, exactly as getAllInvoices sorts by
 * `Invoice ID`. A PO ID is `HYE-PO-YYYYMMDD-##`, fixed width and zero-padded
 * throughout, so a plain string sort already gives chronological order and the
 * within-day sequence — InvoiceForm.js states the same property of this same ID
 * format. That is why /pos shows no Created column: the order IS the date order,
 * and #164's counter makes the ID prefix the one thing nobody can backdate.
 *
 * A `sort` is not a filter. The no-filterByFormula contract above is about rows
 * being silently withheld; ordering hides nothing.
 */
export async function getAllPOs() {
    const records = await base(TABLES.PURCHASE_ORDERS)
        .select({ sort: [{ field: "PO ID", direction: "desc" }] })
        .all();

    return records.map(recordToPO);
}

/**
 * Whether a PO still has at least one PO Item with uninvoiced
 * quantity (issue #57's definition of "open" — Purchase Orders.Status has
 * no "Closed" option; openness is entirely this computed check, not a
 * stored field). Deliberately a separate, sequential implementation
 * rather than reusing getInvoicingStatusByPO() (#48) directly: that
 * function reads every item's figures, which is exactly right when the
 * caller needs the full per-item breakdown (the PO detail page, the Item
 * dropdown), but wasteful here where all getOpenPOs() below needs is a
 * yes/no per PO. This walks PO Items one at a time and returns the
 * instant it finds one with uninvoiced qty, so an open PO with an
 * unfulfilled item early in its list is cheap to confirm.
 *
 * Issue #18 — the fetch strategy above is still deliberately its own, but the
 * rule is not: this was the THIRD implementation of "qty minus invoiced",
 * pairing its own per-Invoice-Item fetch with its own subtraction. The invoiced
 * total is now PO Items."Invoiced Qty" (a rollup of the same SUM) and the
 * subtraction is lib/poItemQty.js, so all three sites read one figure and apply
 * one rule. It also drops a fetch per Invoice Item, which was the most wasteful
 * part of the walk this comment was defending.
 */
export async function isPoOpen(poRecordId) {
    const poRecord = await base(TABLES.PURCHASE_ORDERS).find(poRecordId);
    const poItemIds = poRecord.get("PO Items") || [];

    for (const poItemId of poItemIds) {
        const poItemRecord = await base(TABLES.PO_ITEMS).find(poItemId);

        if (
            hasUninvoicedQty({
                qty: poItemRecord.get("Qty"),
                invoicedQty: poItemRecord.get("Invoiced Qty"),
            })
        ) {
            return true;
        }
    }

    return false;
}

/**
 * getPOsExceptWithdrawn(), narrowed to open ones (issue #57) — the invoice
 * form's default PO list, since new invoices are almost always against recent,
 * in-progress POs and the full historical list only grows over time. Not
 * a filterByFormula-level filter (openness can't be expressed as one —
 * see isPoOpen()'s comment), so this still fetches every non-withdrawn PO's
 * header record, then checks each one's openness in parallel. A fully-
 * invoiced PO is never truly hidden from the app — see the "Show all /
 * search closed POs" UI in InvoiceForm.js, which queries the complete set
 * server-side on demand instead.
 *
 * ITS OWN DEFINITION IS UNCHANGED by #168 — not withdrawn, and something left to
 * invoice. Unsigned POs now reach it only because the superset widened.
 */
export async function getOpenPOs() {
    const pos = await getPOsExceptWithdrawn();
    const openFlags = await Promise.all(pos.map((po) => isPoOpen(po.id)));
    return pos.filter((_, i) => openFlags[i]);
}

/**
 * Create a PO from a signed PR. PO ID is backend-generated. Vendor,
 * Quotation File, Items Subtotal, and Total Amount are Lookups/rollup/
 * formula — never set directly. Shipping Fee (issue #78) is a plain copy
 * of the PR's own Shipping Fee at this exact moment — frozen going
 * forward, same as PO Items snapshotting PR Items.
 */
export async function createPO({
                                    prRecordId,
                                    ourPicId,
                                    ourManagerId,
                                    deliveryAddressUsed,
                                    shippingFee,
                                }) {
    const record = await generateNextPOId((poId) =>
        base(TABLES.PURCHASE_ORDERS).create({
            "PO ID": poId,
            PR: [prRecordId],
            "Our PIC": ourPicId ? [ourPicId] : [],
            "Our Manager": ourManagerId ? [ourManagerId] : [],
            "Created Date": new Date().toISOString().slice(0, 10),
            // A freshly generated PO starts unsigned, awaiting the
            // President's signature (#133 renamed this status from "Draft").
            Status: "Awaiting Signature",
            "Delivery Address Used": deliveryAddressUsed,
            ...(shippingFee !== undefined && shippingFee !== null ? { "Shipping Fee": shippingFee } : {}),
        })
    );

    return recordToPO(record);
}

/**
 * Partial update of a PO — e.g. president signing, status transitions,
 * attaching the generated PDF. `withdrawnAt` (issue #138) is accepted here
 * so the withdrawal timestamp can be written in the SAME call as Status ->
 * Withdrawn (lib/poWithdraw.js), never as a second write that could leave a
 * withdrawn PO with no recorded time; only ever set, never cleared.
 */
export async function updatePO(
    recordId,
    { presidentSigned, presidentSignedAt, status, poPdfFile, withdrawnAt }
) {
    const fields = {};
    if (presidentSigned !== undefined)
        fields["President Signed"] = presidentSigned;
    if (presidentSignedAt !== undefined)
        fields["President Signed At"] = presidentSignedAt;
    if (status !== undefined) fields["Status"] = status;
    if (poPdfFile !== undefined) fields["PO PDF File"] = poPdfFile;
    if (withdrawnAt !== undefined) fields["Withdrawn At"] = withdrawnAt;

    const record = await base(TABLES.PURCHASE_ORDERS).update(recordId, fields);
    return recordToPO(record);
}
