import { base, TABLES, withKeyLock } from "./client";
import { andSearchAll, formulaString } from "../airtableFormula";
import { normalizeItemText } from "../itemNaming";

/**
 * Materials is the ITEM-IDENTITY table (#18): one row per distinct material,
 * natural key = Item Name + Size + Unit. Vendor is deliberately NOT part of it
 * — a material bought from two vendors is one material with two prices, which
 * is what the Material Prices table holds (see materialPrices.js). That split
 * is what lets purchase history and on-order quantity aggregate ACROSS vendors
 * while price stays per-vendor.
 *
 * Everything except those three fields is computed and must never be written:
 * Material Label and _Record ID are formulas; Committed/Signed/Invoiced Qty are
 * rollups over PO Items and Outstanding Qty a formula over two of them; the
 * Material Prices and PO Items links are both maintained from the other side
 * (Material Prices.Material, PO Items.Material).
 *
 * Look up by natural key. Compared via LOWER(TRIM(...)) so a difference of case
 * or of leading/trailing space cannot split one material into two rows;
 * normalizeItemText has already collapsed internal whitespace runs on both the
 * stored value and the argument, which is the part a formula cannot do.
 */
export async function getMaterialByKey({ itemName, size, unit }) {
    const records = await base(TABLES.MATERIALS)
        .select({
            filterByFormula: `AND(
                LOWER(TRIM({Item Name})) = LOWER(TRIM("${formulaString(normalizeItemText(itemName))}")),
                LOWER(TRIM({Size})) = LOWER(TRIM("${formulaString(normalizeItemText(size))}")),
                LOWER(TRIM({Unit})) = LOWER(TRIM("${formulaString(unit)}"))
            )`,
            maxRecords: 1,
        })
        .firstPage();

    if (records.length === 0) return null;
    return recordToMaterial(records[0]);
}

export async function getMaterialByRecordId(recordId) {
    return recordToMaterial(await base(TABLES.MATERIALS).find(recordId));
}

/**
 * How many identity rows exist at all (#19). The price screen uses it to tell
 * "nothing matches what you typed" apart from "nothing is indexed yet", which
 * are different answers and read very differently to someone who has been
 * buying this material for years.
 */
export async function countMaterials() {
    const records = await base(TABLES.MATERIALS).select({ fields: ["Item Name"] }).all();
    return records.length;
}

/**
 * Identity rows for #19's price screen — matched when tokens are given, and the
 * whole list when they are not.
 *
 * **No tokens means BROWSE, not "no results".** The screen shows the list under
 * the search bar before anything is typed, so an empty query is a legitimate
 * request for everything rather than an empty search. Note the contrast with
 * `andSearchAll`, whose empty-needle case deliberately yields `FALSE()`: that is
 * the right contract for a predicate builder, so the browse case skips
 * `filterByFormula` entirely instead of asking it for a match-all.
 *
 * Browse order is alphabetical by `Material Label`, sorted server-side so the
 * cap below takes the first N of a stable order rather than an arbitrary N.
 * Alphabetical rather than most-recently-priced because the dates live on
 * Material Prices, one level down, and the cap is applied before those are
 * fetched — ordering by them would mean capping on a figure this query cannot
 * see.
 *
 * Tokens come from lib/materialPriceView.js:buildSearchTokens and are AND-ed,
 * each as a case-insensitive substring of `Material Label` — the primary formula
 * field holding `Item Name_Size_Unit`. Matching the LABEL rather than `Item Name`
 * alone is what makes `2" pipe` find `Pipe_2"_EA` regardless of the order the two
 * words were typed. The tradeoff is that a token can match the size or unit
 * segment; see buildSearchTokens for why that is acceptable rather than a defect.
 *
 * Every token is interpolated, so every token goes through formulaString — this
 * is the first place in the app where a value typed by a user reaches a formula
 * (#159's sweep found none), and `2"` is a completely ordinary thing to type
 * here.
 *
 * `limit` bounds both the page and the follow-up queries that fan out from these
 * rows: lib/materialHistory.js batches by record id, and an unbounded result set
 * would grow those OR-lists without bound. It now bounds the browse list too,
 * which is the case most likely to grow. A truncated result is reported to the
 * caller rather than silently trimmed.
 */
export async function searchMaterials(tokens, { limit = 25 } = {}) {
    const browsing = !Array.isArray(tokens) || tokens.length === 0;

    const records = await base(TABLES.MATERIALS)
        .select({
            ...(browsing ? {} : { filterByFormula: andSearchAll("Material Label", tokens) }),
            sort: [{ field: "Material Label", direction: "asc" }],
            // One more than the limit, so "there are more" is known rather than
            // guessed from a full page.
            maxRecords: limit + 1,
        })
        .all();

    return {
        materials: records.slice(0, limit).map(recordToMaterial),
        truncated: records.length > limit,
    };
}

function recordToMaterial(record) {
    return {
        id: record.id,
        materialLabel: record.get("Material Label"),
        itemName: record.get("Item Name"),
        size: record.get("Size"),
        unit: record.get("Unit"),
        // Reverse-links, both written from the far side.
        materialPrices: record.get("Material Prices") || [],
        poItems: record.get("PO Items") || [],
        // Rollups over PO Items; blank when nothing links here yet, which
        // Airtable reports as undefined rather than 0.
        committedQty: record.get("Committed Qty"),
        signedQty: record.get("Signed Qty"),
        invoicedQty: record.get("Invoiced Qty"),
        outstandingQty: record.get("Outstanding Qty"),
    };
}

/**
 * Find-or-create the identity row for one material. Airtable has no composite
 * uniqueness constraint, so the backend enforces the natural key here.
 *
 * ITEM NAME IS NOT UPDATED ON A MATCH — the first spelling recorded wins. A
 * name is not a latest-value field: rewriting it on every PO would make one
 * requester's capitalisation quietly overwrite another's, and the row's label
 * would change under anything already referencing it. When an item catalogue
 * with a dropdown exists, that becomes the authority on the canonical spelling;
 * until then, first-seen is at least stable. The consequence to know about is
 * that the stored spelling may not match the newest PO's — which is why the
 * lookup is case-insensitive rather than relying on them agreeing.
 *
 * Inputs are normalized here rather than at the call sites so no caller can
 * create an unnormalized row: PR Items are normalized on save, but rows created
 * before #18 are not, and a legacy-shaped name must still land on the right
 * material.
 *
 * The read-then-write runs inside withKeyLock (see client.js) — without it,
 * concurrent calls for one key each read "nothing exists yet" and each create a
 * duplicate. The lock key is the normalized triple, matching the comparison
 * getMaterialByKey makes, so keys Airtable would consider equal also serialize
 * against each other here.
 */
export async function upsertMaterial({ itemName, size, unit }) {
    const cleanName = normalizeItemText(itemName);
    const cleanSize = normalizeItemText(size);
    const lockKey = ["material", cleanName.toLowerCase(), cleanSize.toLowerCase(), (unit || "").trim().toLowerCase()].join("::");

    return withKeyLock(lockKey, async () => {
        const existing = await getMaterialByKey({ itemName: cleanName, size: cleanSize, unit });
        if (existing) return existing;

        const record = await base(TABLES.MATERIALS).create({
            "Item Name": cleanName,
            Size: cleanSize,
            // Unit is a singleSelect: an empty string is not "no value" but a
            // request to create an empty option, which Airtable refuses with
            // `Insufficient permissions to create new select option ""`
            // (measured). Omit the key instead, as prItems.js/poItems.js do for
            // the same field (#111). typecast is deliberately never used on
            // this path — it would invent an option outside CANONICAL_UNITS.
            // In practice lib/materialsCache.js skips unit-less items before
            // reaching here; this stays correct rather than relying on that.
            ...(unit ? { Unit: unit } : {}),
        });

        return recordToMaterial(record);
    });
}
