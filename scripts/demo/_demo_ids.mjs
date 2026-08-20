// Which record belongs to which demo scenario — read off the base, one implementation.
//
// TWO CALLERS NEED THE SAME ANSWER AND MUST NOT DERIVE IT TWICE. `seed_full_demo.mjs`
// prints the presenter's id table from it; `reset_demo.mjs` checks the post-reset state
// with it. A second copy of "the OVER delivery is the one whose Notes carry
// `[DEMO26:OVER]`" would be a second thing to keep in step with the seed, and the
// failure would be silent: a resolver that finds nothing prints the same placeholder as
// a scenario that failed to seed.
//
// THREE TAGS, ONE PER RECORD KIND, each on the record itself rather than inferred
// through links:
//
//   Purchase Requests  `Notes` contains `[DEMO26:SCENARIO]`, and a scenario that
//                      raises several orders adds a second tag so the table does not
//                      have to guess from creation order.
//   Deliveries         `Notes`, same shape.
//   Invoices           `Vendor Invoice Code` is `LSP-SCENARIO-MMDD`. There is no free
//                      text field on `Invoices` to hide a tag in, and this one renders
//                      on two screens — so it reads like a supplier's own numbering
//                      instead of like a marker.
//
// KEYS ARE NORMALIZED WITHOUT UNDERSCORES, because those two places cannot both keep
// them: `Notes` is free text and carries `OVER_BLOCKED` as written, while an invoice
// code has to look like a document number and carries `OVERBLOCKED`. Normalizing both
// sides is what lets one lookup serve both.

import { base, TABLES } from "../../lib/airtable/client.js";
import { orByRecordId } from "../../lib/airtableFormula.js";

/** The marker in a PR's or a delivery's `Notes`. */
export const TAG = "DEMO26";

/** The leading segment of a seeded invoice's `Vendor Invoice Code`. */
export const INVOICE_CODE_PREFIX = "LSP";

const TAG_PATTERN = new RegExp(`\\[${TAG}:([A-Z_]+)\\]`, "g");
const CODE_PATTERN = new RegExp(`^${INVOICE_CODE_PREFIX}-([A-Z0-9]+)-\\d{4}$`);

/** Scenario names lose their underscores, so the two storage shapes agree. */
export const normalizeScenario = (name) => String(name).replace(/_/g, "");

/** Every scenario tag in one Notes value. */
export const tagsIn = (text) => [...String(text || "").matchAll(TAG_PATTERN)].map((m) => m[1]);

/** The scenario a `Vendor Invoice Code` names, or null if it is not one of ours. */
export const scenarioInInvoiceCode = (code) =>
    (String(code || "").match(CODE_PATTERN) || [null, null])[1];

/**
 * Everything this seed made, grouped by scenario.
 *
 * Returns `{ byScenario, untagged, counts }`:
 *
 *   byScenario  Map of normalized scenario name -> `{ prs, pos, deliveries, invoices }`,
 *               each an array of `{ recordId, displayId }` sorted by display id.
 *   untagged    the records that carry no tag at all, per kind. On a base straight out
 *               of a reset this is empty by construction, which is exactly why it is
 *               worth reporting: anything in it was created by hand or by a rehearsal.
 *   counts      row totals per kind, so a caller can say what it looked at.
 *
 * Four selects plus one batched read of the orders. `fields` is narrowed on each,
 * because a caller wants identity and tags rather than whole records.
 */
export async function resolveDemoRecords() {
    const [prRecords, deliveryRecords, invoiceRecords] = await Promise.all([
        base(TABLES.PURCHASE_REQUESTS).select({ fields: ["PR ID", "Notes", "Purchase Orders"] }).all(),
        base(TABLES.DELIVERIES).select({ fields: ["Delivery ID", "Notes"] }).all(),
        base(TABLES.INVOICES).select({ fields: ["Invoice ID", "Vendor Invoice Code"] }).all(),
    ]);

    const byScenario = new Map();
    const put = (name, kind, entry) => {
        const key = normalizeScenario(name);
        if (!byScenario.has(key)) {
            byScenario.set(key, { prs: [], pos: [], deliveries: [], invoices: [] });
        }
        byScenario.get(key)[kind].push(entry);
    };

    const untagged = { prs: [], pos: [], deliveries: [], invoices: [] };
    const taggedPoRecordIds = [];

    for (const r of prRecords) {
        const names = tagsIn(r.get("Notes"));
        const entry = { recordId: r.id, displayId: r.get("PR ID") };
        if (names.length === 0) {
            untagged.prs.push(entry);
            // A PO under an untagged request is an untagged PO. Its own id is resolved
            // in the batched read below, so only the record id is known here.
            for (const id of r.get("Purchase Orders") || []) untagged.pos.push({ recordId: id, displayId: null });
            continue;
        }
        for (const name of names) {
            put(name, "prs", entry);
            for (const id of r.get("Purchase Orders") || []) taggedPoRecordIds.push([name, id]);
        }
    }

    for (const r of deliveryRecords) {
        const names = tagsIn(r.get("Notes"));
        const entry = { recordId: r.id, displayId: r.get("Delivery ID") };
        if (names.length === 0) untagged.deliveries.push(entry);
        for (const name of names) put(name, "deliveries", entry);
    }

    for (const r of invoiceRecords) {
        const name = scenarioInInvoiceCode(r.get("Vendor Invoice Code"));
        const entry = { recordId: r.id, displayId: r.get("Invoice ID") };
        if (!name) untagged.invoices.push(entry);
        else put(name, "invoices", entry);
    }

    // One batched read for the orders, so a scenario can be asked for its PO ID.
    const wanted = [...new Set([...taggedPoRecordIds.map(([, id]) => id), ...untagged.pos.map((p) => p.recordId)])];
    const poIdByRecordId = new Map();
    for (let i = 0; i < wanted.length; i += 50) {
        const page = await base(TABLES.PURCHASE_ORDERS)
            .select({ fields: ["PO ID"], filterByFormula: orByRecordId(wanted.slice(i, i + 50)) })
            .all();
        for (const po of page) poIdByRecordId.set(po.id, po.get("PO ID"));
    }
    for (const [name, recordId] of taggedPoRecordIds) {
        if (poIdByRecordId.has(recordId)) {
            put(name, "pos", { recordId, displayId: poIdByRecordId.get(recordId) });
        }
    }
    for (const p of untagged.pos) p.displayId = poIdByRecordId.get(p.recordId) ?? null;

    for (const group of byScenario.values()) {
        for (const kind of ["prs", "pos", "deliveries", "invoices"]) {
            group[kind].sort((a, b) => String(a.displayId).localeCompare(String(b.displayId)));
        }
    }

    return {
        byScenario,
        untagged,
        counts: {
            prs: prRecords.length,
            deliveries: deliveryRecords.length,
            invoices: invoiceRecords.length,
            pos: poIdByRecordId.size,
        },
    };
}

/** The four kinds, named once so a caller cannot invent a fifth. */
export const KINDS = ["prs", "pos", "deliveries", "invoices"];

/**
 * AN UNKNOWN KIND THROWS, and that is this module's own defect turned into a guard.
 * The first version of the seed's id table asked for `"pr"` while this stored `"prs"`,
 * and every lookup came back `undefined` — which the table renders as "NOT ON THE
 * BASE", the same words a scenario that genuinely failed to seed produces. So a typo
 * read as 34 missing scenarios. Optional chaining is what made it silent; refusing an
 * unknown key is what makes it loud.
 */
function group(byScenario, name, kind) {
    if (!KINDS.includes(kind)) {
        throw new Error(`unknown kind "${kind}" — expected one of ${KINDS.join(", ")}`);
    }
    return byScenario.get(normalizeScenario(name))?.[kind] ?? [];
}

/**
 * One display id, or undefined when the scenario is not on the base.
 *
 * `n` picks among a scenario's several records of one kind, in display-id order —
 * used where a scenario deliberately makes more than one, like OVER_BLOCKED's three
 * deliveries.
 */
export function pick(byScenario, name, kind, n = 0) {
    return group(byScenario, name, kind)[n]?.displayId;
}

/** The same, as a record id, for a caller that needs to read the record's children. */
export function pickRecordId(byScenario, name, kind, n = 0) {
    return group(byScenario, name, kind)[n]?.recordId;
}
