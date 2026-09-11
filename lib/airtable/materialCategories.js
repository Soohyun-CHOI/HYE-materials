import { base, findByRecordIds, TABLES } from "./client";
import { CATEGORY_LEAF_CODE, CATEGORY_LEVELS, toCategory } from "../materialCategory";
import { orByField } from "../airtableFormula";

/**
 * `Material Categories` is HQ's four-level tree as reference data (#354): 777
 * rows, one per path, each carrying the code and the English name at every
 * level. Nothing in this app writes to it — the rows arrive from
 * `scripts/import/create_material_categories_354.mjs`, and a path the tree does
 * not have is added directly in Airtable, which `docs/notes/materials.md`
 * records as the reason `Category Label` is a formula.
 *
 * THIS MODULE DID NOT SHIP WITH THE TABLE, DELIBERATELY. #354 created the table
 * and left the reader out, because a service-layer function with no caller is
 * verified by nothing — CLAUDE.md's own example is `upsertMaterial`, which sat
 * unused from Phase 0 to #18 carrying three defects. It arrives here with its
 * first caller, the request form.
 */

/**
 * The whole tree, for a form that narrows through it.
 *
 * ONE READ RATHER THAN ONE PER LEVEL, AND THAT IS MEASURED RATHER THAN
 * PREFERRED. Airtable pages at 100 records, so `.all()` over 777 rows is 8 list
 * operations. A query per level cannot beat that, because the first level needs
 * the 39 distinct level-1 values and **Airtable has no DISTINCT** — that step
 * alone scans the same 777 rows for the same 8 operations, and then adds a round
 * trip to the user for every level after it. So the per-level shape is strictly
 * worse on both axes rather than a trade.
 *
 * WHAT THE 8 IS BOUNDED BY is the catalog, not the company's history: it grows
 * when HQ adds a path and never with the number of requests, orders or
 * documents. That is the same reading `getDeliveryCandidates` gets — one query
 * per page, independent of how much work the base has seen — and the opposite of
 * the shape #244 removed from `/invoices/new`, where the cost carried a term in
 * the order count and therefore had no ceiling. `docs/notes/airtable-access.md`
 * states the criterion: the number that matters is the shape.
 *
 * The projection is the five values the form actually needs. It does not reduce
 * the operation count — page count follows row count — but it is most of the
 * response body, and the tree is handed to a Client Component.
 */
export async function getCategoryTree() {
    const records = await base(TABLES.MATERIAL_CATEGORIES)
        .select({
            fields: ["Category Label", ...CATEGORY_LEVELS.flatMap((l) => [l.code, l.name])],
            // Alphabetical by the composed path, so every level's options come
            // out in a stable order without the caller sorting four times. The
            // primary is the label, so this is one sort the base can do.
            sort: [{ field: "Category Label", direction: "asc" }],
        })
        .all();

    return records.map((record) =>
        toCategory({
            id: record.id,
            label: record.get("Category Label"),
            ...Object.fromEntries(
                CATEGORY_LEVELS.flatMap((l) => [
                    [l.code, record.get(l.code)],
                    [l.name, record.get(l.name)],
                ])
            ),
        })
    );
}

/**
 * The categories a set of leaf codes names, keyed by leaf code.
 *
 * THE WRITE PATH NEEDS RECORD IDS AND THE FORM CARRIES CODES, which is the one
 * place those two representations meet. A leaf code is unique across the whole
 * tree (777 of 777, asserted in `offline/material-categories.mjs`), so this is a
 * lookup rather than a search — but it is a `filterByFormula` on a text field
 * rather than a record-id match, because the browser has no business holding a
 * record id it did not fetch this render.
 *
 * One query for every code an item list carries, through `orByField`, rather
 * than one per item: a 20-item request costs 1 operation here, not 20. An empty
 * list yields `FALSE()` inside the builder and is short-circuited before it
 * reaches the base at all.
 */
export async function getCategoriesByLeafCode(leafCodes) {
    const wanted = Array.from(new Set((leafCodes || []).filter(Boolean)));
    if (wanted.length === 0) return new Map();

    const records = await base(TABLES.MATERIAL_CATEGORIES)
        .select({
            filterByFormula: orByField(CATEGORY_LEAF_CODE, wanted),
            fields: ["Category Label", ...CATEGORY_LEVELS.flatMap((l) => [l.code, l.name])],
        })
        .all();

    // A DUPLICATE LEAF CODE THROWS RATHER THAN LETTING THE LAST ROW WIN, and
    // that is the whole reason this loop is not a one-liner. Nothing keeps leaf
    // codes unique: Airtable cannot make a text field unique — the same limit
    // `tools.md` records for `Tools."Tool Name"` — and this app never writes a
    // category row, so there is no write to serialize and none of
    // `upsertMaterial`'s normalize-lock-compare shape can attach.
    //
    // #368 MAKES THIS RARE AND DOES NOT MAKE IT UNNECESSARY, which is worth
    // saying here so the next reader does not delete it as superseded. Today a
    // path is added by hand in Airtable, so a mistyped code is an ordinary
    // slip; after #368 an admin screen picks the parent and computes the next
    // number, so nobody types one on the usual path. Hand editing the table
    // stays possible either way — the rows are reference data anyone with the
    // base open can touch — so this stops being the common case and becomes the
    // last net under it.
    //
    // WHAT LAST-WRITE-WINS WOULD COST is not an error but a wrong document. The
    // picker deduped by code and kept the row whose label sorts first; this
    // query has no sort at all, so the winner here is Airtable's return order
    // and the two tie-breaks need not agree. The requester would pick one path,
    // the link would point at the other, and `Item Name` — frozen from that
    // row's label — is what the vendor reads on the purchase order. So this
    // refuses, naming both records, in `findChildRecords`' posture: a loud
    // failure beats a silent wrong answer.
    const byCode = new Map();
    for (const record of records) {
        const code = record.get(CATEGORY_LEAF_CODE);
        const already = byCode.get(code);
        if (already) {
            throw new Error(
                `${TABLES.MATERIAL_CATEGORIES}: ${CATEGORY_LEAF_CODE} ${code} is on more than one ` +
                `row (${already.recordId}, ${record.id}). A leaf code names one category; ` +
                `delete or renumber one of them in Airtable.`
            );
        }
        byCode.set(
            code,
            toCategory({
                id: record.id,
                label: record.get("Category Label"),
                ...Object.fromEntries(
                    CATEGORY_LEVELS.flatMap((l) => [
                        [l.code, record.get(l.code)],
                        [l.name, record.get(l.name)],
                    ])
                ),
            })
        );
    }
    return byCode;
}

/**
 * The categories a set of record ids names, keyed by record id — the direction
 * `getCategoriesByLeafCode` runs in reverse.
 *
 * THIS IS THE READER THE COMMENT BELOW SAID WOULD NEVER BE NEEDED, AND THE
 * COMMENT WAS RIGHT ABOUT SCREENS AND SILENT ABOUT THE WRITE PATH. A `PR Items`
 * row carries a `Category` link and every SCREEN showing one has already fetched
 * the whole tree for its pickers, so a screen resolves a row's category in
 * memory for 0 operations. `lib/materialsCache.js` holds no tree and cannot: it
 * runs at PO generation, one request after the form, and #356 keys
 * `upsertMaterial` on the category's LEAF CODE while what a PR item stores is a
 * record id. So this is the one place the two representations have to be
 * resolved in that direction, and it arrives with that caller rather than ahead
 * of it.
 *
 * ONE QUERY PER 50 IDS AND NONE PER ITEM, through `findByRecordIds` — a 20-item
 * order costs 1 operation here. Ids that do not resolve are simply absent from
 * the map, which is what lets the caller SKIP the ordered item and report it
 * rather than fail a whole approval; `findChildRecords`' refuse-a-short-result
 * posture is for a parent's own link array, where a missing child is a broken
 * document, and a category deleted from the catalog is not that.
 */
export async function getCategoriesByRecordIds(recordIds) {
    const wanted = Array.from(new Set((recordIds || []).filter(Boolean)));
    if (wanted.length === 0) return new Map();

    const records = await findByRecordIds(TABLES.MATERIAL_CATEGORIES, wanted, {
        fields: ["Category Label", ...CATEGORY_LEVELS.flatMap((l) => [l.code, l.name])],
    });

    return new Map(
        records.map((record) => [
            record.id,
            toCategory({
                id: record.id,
                label: record.get("Category Label"),
                ...Object.fromEntries(
                    CATEGORY_LEVELS.flatMap((l) => [
                        [l.code, record.get(l.code)],
                        [l.name, record.get(l.name)],
                    ])
                ),
            }),
        ])
    );
}

// THERE IS DELIBERATELY NO SINGLE-RECORD `getCategoryByRecordId`, and the
// batched reader above is not one. A screen resolves a row's category from the
// tree it already holds, for 0 operations; a caller wanting one category reads
// it as a set of one, which costs the same query and cannot become the per-row
// read `findChildRecords` exists to prevent.
