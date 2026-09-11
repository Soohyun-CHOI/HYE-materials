import { base, TABLES, withKeyLock } from "./client";
import { andSearchAll, formulaString } from "../airtableFormula";
import { materialIdentityKey, materialIdentityParts } from "../materialIdentity";

/**
 * Materials is the ITEM-IDENTITY table (#18): one row per distinct material,
 * natural key = Category + Size + Unit since #356. Vendor is deliberately NOT
 * part of it — a material bought from two vendors is one material with two
 * prices, which is what the Material Prices table holds (see
 * materialPrices.js). That split is what lets purchase history and on-order
 * quantity aggregate ACROSS vendors while price stays per-vendor.
 *
 * THE KEY WAS A SPELLING UNTIL #356, which is why that issue exists. Identity
 * was `Item Name` + Size + Unit with the name typed by whoever raised the
 * request, so two typings of one thing were two rows — separate price histories,
 * separate quantity rollups, and nothing downstream able to tell they were the
 * same material. `Category` is picked from the catalog, so the name axis has
 * nothing left to reconcile; `lib/materialIdentity.js` holds what replaced it and
 * why the three axes are compared differently.
 *
 * ONLY THREE FIELDS ARE WRITABLE — `Category`, `Size` and `Unit`. Everything
 * else is computed and must never be written: `Item Name` is a LOOKUP of the
 * category's `Category Label` since #356 and `Category Code` a lookup of its
 * leaf code; `Material Label` and `_Record ID` are formulas;
 * Committed/Signed/Invoiced Qty are rollups over PO Items and Uninvoiced Qty a
 * formula over two of them; the Material Prices, PO Items and Delivery Items
 * links are all maintained from the other side.
 */

/**
 * A lookup field arrives as a single-element array off a record and as a bare
 * string from a plain text field — `Item Name` is both, on either side of #356's
 * retype, and this reads either. It is not a tolerance for a multi-valued
 * lookup: `Category` is single-record, so a second value would mean a hand edit
 * that `upsertMaterial` could not have made and that nothing else could name.
 */
function firstOf(value) {
    return Array.isArray(value) ? value[0] : value;
}

/**
 * The identity row for one key, or null.
 *
 * MATCHED ON `Category Code` RATHER THAN ON THE LINK, because `filterByFormula`
 * cannot compare a link field against a record id — the same exception
 * `Material Prices."Material Record ID"` records one table over, and the whole
 * reason that lookup exists. `& ""` is how a single-element lookup is put into
 * string context on this base; `PO Items."Committed Qty"` has done it against
 * `PO Status` since #18 and `verify-materials-cache-18.mjs` Part E is what would
 * notice if it stopped working.
 *
 * The code is compared EXACTLY and Size and Unit case-insensitively, which is
 * `lib/materialIdentity.js`'s rule and the substance of #356 — see there for why
 * the three axes differ. `normalizeItemText` has already collapsed internal
 * whitespace runs in `size` on both the stored value and the argument, which is
 * the part a formula cannot do.
 *
 * NO CODE MEANS NO QUERY. An empty `Category Code` would make `{Category Code} &
 * "" = ""` true for every category-less row, which is the whole-table answer
 * `orByField`'s empty-list `FALSE()` exists to avoid one module over. A caller
 * with no category has no material to find.
 */
export async function getMaterialByKey({ categoryCode, size, unit }) {
    const parts = materialIdentityParts({ categoryCode, size, unit });
    if (!parts.categoryCode) return null;

    const records = await base(TABLES.MATERIALS)
        .select({
            filterByFormula: `AND(
                {Category Code} & "" = "${formulaString(parts.categoryCode)}",
                LOWER(TRIM({Size})) = LOWER(TRIM("${formulaString(parts.size)}")),
                LOWER(TRIM({Unit})) = LOWER(TRIM("${formulaString(parts.unit)}"))
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
        // Both lookups through `Category` since #356, so both arrive as
        // single-element arrays — `firstOf` reads them and also reads the plain
        // text `Item Name` was before the retype. A row created moments ago can
        // carry neither yet: a lookup is computed, and the create returns before
        // Airtable has filled it. Nothing reads either off a freshly created
        // record (lib/materialsCache.js takes `id` and nothing else), which is
        // why that is stated rather than waited for.
        itemName: firstOf(record.get("Item Name")),
        categoryCode: firstOf(record.get("Category Code")),
        // Single-record by app enforcement and by the hand toggle, a raw array
        // of record ids like every other link.
        category: record.get("Category") || [],
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
        uninvoicedQty: record.get("Uninvoiced Qty"),
    };
}

/**
 * Find-or-create the identity row for one material. Airtable has no composite
 * uniqueness constraint, so the backend enforces the natural key here.
 *
 * THE NAME IS NO LONGER WRITTEN AT ALL (#356), AND THE PARAGRAPH THIS REPLACES
 * IS WORTH KNOWING. `Item Name` used to be written on create and deliberately
 * NOT updated on a match — first spelling recorded wins — because rewriting it
 * per PO would let one requester's capitalization overwrite another's and change
 * the row's label under anything referencing it. That rule described the best
 * available answer while a name was typed, and it said so: "when an item catalog
 * with a dropdown exists, that becomes the authority on the canonical spelling".
 * It exists, so the name is a lookup through `Category` and the catalog IS the
 * authority — a path HQ renames renames every material under it, which is the
 * behavior first-seen-wins was standing in for. Writing the field now returns
 * 422 from Airtable, since it is computed.
 *
 * A CATEGORY IS REQUIRED AND THIS THROWS WITHOUT ONE, which is the one place the
 * refusal can be absolute. A material with no category has no name — `Item Name`
 * is empty and `Material Label`, the primary, is `_Size_Unit` — so creating one
 * is worse than not creating it. `createItem` cannot refuse the same way one
 * table up, because a Draft saves half-picked (#72) and the service layer cannot
 * tell that row from a caller that forgot; here there is no such state, so the
 * throw is safe. `lib/materialsCache.js` skips and REPORTS such an ordered item
 * before reaching this, so a legitimate approval never fails on it.
 *
 * `Size` is normalized here rather than at the call sites so no caller can
 * create an unnormalized row, and its case is preserved: that string reaches the
 * vendor on the purchase order and the stored value is the only copy (#18).
 *
 * The read-then-write runs inside withKeyLock (see client.js) — without it,
 * concurrent calls for one key each read "nothing exists yet" and each create a
 * duplicate. The lock key is `lib/materialIdentity.js`'s, the same function the
 * within-one-PO grouping uses and built from the same parts the query above
 * compares, so keys Airtable would consider equal also serialize against each
 * other here.
 */
export async function upsertMaterial({ categoryRecordId, categoryCode, size, unit }) {
    const parts = materialIdentityParts({ categoryCode, size, unit });
    const lockKey = materialIdentityKey({ categoryCode, size, unit });

    if (!lockKey || !categoryRecordId) {
        throw new Error(
            "upsertMaterial needs a category: identity is Category + Size + Unit since #356, " +
            "and a material without one has no Item Name and no Material Label. " +
            `Got categoryRecordId=${JSON.stringify(categoryRecordId ?? null)}, ` +
            `categoryCode=${JSON.stringify(parts.categoryCode)}.`
        );
    }

    return withKeyLock(lockKey, async () => {
        const existing = await getMaterialByKey({
            categoryCode: parts.categoryCode,
            size: parts.size,
            unit: parts.unit,
        });
        if (existing) return existing;

        const record = await base(TABLES.MATERIALS).create({
            Category: [categoryRecordId],
            Size: parts.size,
            // Unit is a singleSelect: an empty string is not "no value" but a
            // request to create an empty option, which Airtable refuses with
            // `Insufficient permissions to create new select option ""`
            // (measured). Omit the key instead, as prItems.js/poItems.js do for
            // the same field (#111). typecast is deliberately never used on
            // this path — it would invent an option outside CANONICAL_UNITS.
            // In practice lib/materialsCache.js skips unit-less items before
            // reaching here; this stays correct rather than relying on that.
            ...(parts.unit ? { Unit: parts.unit } : {}),
        });

        return recordToMaterial(record);
    });
}
