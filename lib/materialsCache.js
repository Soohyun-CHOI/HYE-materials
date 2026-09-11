// Materials cache refresh (#18) — the one place that decides what a generated
// PO contributes to the item axis: which identity rows exist, which per-vendor
// prices they carry, and which ordered items point at them.
//
// Kept out of lib/poGeneration.js so PO generation owns only the PO; the two
// meet at one line in generatePOForApprovedPR, after its rollback block.
//
// THREE WRITES PER MATERIAL, and they are not interchangeable:
//   1. Materials        — identity (Category + Size + Unit). Find-or-create.
//   2. Material Prices  — this vendor's latest price for it. Genuine upsert.
//   3. PO Items.Material — the link that makes the item axis exist at all.
//
// THE CATEGORY COMES FROM THE REQUEST AND `PO Items` DOES NOT CARRY IT (#356).
// An ordered item's frozen `Item Name` IS the category's composed label since
// #355, so the path is on the order already — but as a string, and identity is
// keyed on the leaf code precisely so that a catalog rename does not split a
// material. `lib/poGeneration.js` therefore hands each created ordered item the
// `Category` link off the PR item it was copied from, in the same loop that
// creates it, and this module resolves those record ids to codes in ONE batched
// read per order. A `PO Items."Category"` field was weighed and not added: the
// order reaches its path in one hop through `Material` already, and the field
// would be a fourth schema change and a second hand toggle for no reader. **The
// condition for adding it is a second consumer that needs an order's catalog
// path without loading its material** — nothing has one today.
//
// Step 3 is why this is not merely a price cache. Materials' Committed/Signed/
// Invoiced Qty are rollups over Materials."PO Items", so an ordered item that is
// never linked contributes NOTHING to them — it is invisible on the material
// axis while looking perfectly fine on the document axis. That is also why the
// link is written for EVERY ordered item sharing a material, not just the one whose
// price won the dedupe below.
//
// WHY PO ITEMS AND NOT PR ITEMS for the figures. The cache answers "what did we
// last actually order, and at what price", so it reads the order of record: PO
// Items is a frozen snapshot that "must never silently change after a PO has
// been issued to a vendor" (lib/airtable/poItems.js:createPOItem), whereas PR
// Items is the price-history source #19 reads. At this moment the two are
// numerically identical — poGeneration.js copies one into the other in the same
// call, and PR Items cannot change once a PO exists (Edit and continue requires
// PR.Status = In Review) — so the choice costs no accuracy and keeps the two
// roles apart. Concretely the values used are the ones createPOItem returned,
// i.e. what Airtable stored in PO Items, so there is no re-read.
//
// Credentialed-tier only: imports the Airtable client transitively, which throws
// without AIRTABLE_API_KEY at module load. See CLAUDE.md "Verification tiers".

import { getCategoriesByRecordIds } from "./airtable/materialCategories";
import { upsertMaterial } from "./airtable/materials";
import { upsertMaterialPrice } from "./airtable/materialPrices";
import { setPOItemMaterial } from "./airtable/poItems";
import { CATEGORY_LEVELS } from "./materialCategory";
import { materialIdentityKey } from "./materialIdentity";

const LEAF_LEVEL = CATEGORY_LEVELS.length - 1;

/**
 * The cacheable ordered items of one PO, grouped by material.
 *
 * `categoryByRecordId` is the map `refreshMaterialsCacheForPO` reads in one
 * batched query — keyed by `Material Categories` record id, valued with
 * `toCategory`'s shape. It is an argument rather than a fetch so this stays a
 * pure function the way it has been since #18.
 *
 * Each entry carries `item` (the LAST ordered item seen for that material, whose price
 * is the one cached), `poItemIds` (EVERY ordered item for it, all of which get the
 * Material link) and the category both of those share. Two ordered items of one
 * material in a PO are real — split quantities, staged deliveries — and "latest
 * price" has no meaningful answer between two prices bearing the same date, so
 * last-wins is the deterministic choice and is what the per-key lock would have
 * produced anyway.
 *
 * GROUPED BY `lib/materialIdentity.js`'s KEY, the same function `upsertMaterial`
 * locks on and built from the same parts `getMaterialByKey` compares. If these
 * disagreed, one material would be upserted twice and the second write would
 * contend with the first for the same row.
 *
 * Skipped, and every skip is reported rather than silent:
 *   - NO CATEGORY (#356) — there is no identity to create. This replaced "no
 *     Item Name", which stopped being the question the moment the name became a
 *     lookup: a row with a category and a blank frozen name is a perfectly good
 *     material and used to be skipped, and a row with a name and no category is
 *     the one that has to be.
 *   - A CATEGORY THE CATALOG NO LONGER HAS — a link can outlive its row, and the
 *     leaf code is what identity is keyed on, so there is nothing to key with.
 *   - NO UNIT — deliberate (#18). A unit-less row is unusable on #19's price
 *     screen, because a unit price without a unit cannot be compared to
 *     anything; and skipping loses nothing, since the cache holds only latest
 *     values and the history lives in PR Items. It is reachable today only
 *     because a PR Item's Unit is not yet required at final submission. When it
 *     becomes required this branch turns unreachable, and the skip can be
 *     tightened into a throw — deliberately NOT a throw today, since a
 *     reachable throw here would fail a legitimate approval.
 *   - no numeric Unit Price — a price cache row with no price is noise.
 * Qty 0 and a blank Size are fine and are cached normally.
 */
export function collectMaterialsCacheEntries(poItems, { categoryByRecordId } = {}) {
    const categories = categoryByRecordId ?? new Map();
    const byKey = new Map();
    const skipped = [];

    for (const item of poItems || []) {
        if (!item) continue;
        const note = { poItemId: item.poItemId, itemName: item.itemName };

        if (!item.categoryRecordId) {
            skipped.push({ ...note, reason: "no Category" });
            continue;
        }
        const category = categories.get(item.categoryRecordId);
        const categoryCode = category?.codes?.[LEAF_LEVEL] || "";
        if (!categoryCode) {
            skipped.push({ ...note, reason: "Category not in the catalog" });
            continue;
        }
        if (!item.unit) {
            skipped.push({ ...note, reason: "no Unit" });
            continue;
        }
        if (!Number.isFinite(item.unitPrice)) {
            skipped.push({ ...note, reason: "no numeric Unit Price" });
            continue;
        }

        const key = materialIdentityKey({ categoryCode, size: item.size, unit: item.unit });
        const group = byKey.get(key);
        if (group) {
            group.item = item;
            group.poItemIds.push(item.id);
        } else {
            byKey.set(key, {
                item,
                categoryRecordId: item.categoryRecordId,
                categoryCode,
                poItemIds: [item.id],
            });
        }
    }

    return { entries: Array.from(byKey.values()), skipped };
}

/**
 * Refresh the cache for one freshly generated PO. Returns a summary rather than
 * throwing: the caller treats the whole refresh as non-fatal, and one bad
 * material must not cost the others their row either — hence a per-entry
 * try/catch rather than one around the loop.
 *
 * Sequential on purpose. Airtable's budget is ~5 req/s per base and each entry
 * costs roughly four calls (a lookup and a create for identity, a lookup and a
 * write for price) plus one link update per ordered item, so a wide PO fired off with
 * Promise.all would burst against it. The cost is real and lands on the
 * approving user's request; the same reasoning as confirming attachment ingests
 * one at a time (docs/notes/uploads-and-drafts.md).
 *
 * A missing Vendor aborts the whole refresh. Identity does not need one, but a
 * price does — Material Prices is keyed on material × vendor, and a row written
 * without a vendor could not be found by that key again. Writing identity alone
 * while silently dropping the price would leave a half-refreshed PO that reads
 * as complete, so this reports instead.
 */
export async function refreshMaterialsCacheForPO({
                                                     poItems,
                                                     vendorRecordId,
                                                     poRecordId,
                                                     latestDate,
                                                 }) {
    if (!vendorRecordId) {
        return { skippedAll: "no Vendor on the PR", attempted: 0, updated: 0, linked: 0, failed: [], skipped: [] };
    }

    // ONE READ FOR THE WHOLE ORDER, BEFORE THE LOOP. The categories are what
    // turn each ordered item's `Category` record id into the leaf code identity
    // is keyed on; reading them per entry would be the 1 + N shape #193 removed
    // everywhere else, and reading them per PO is 1 operation for a 20-item
    // order. An order whose items carry no category at all costs none.
    const categoryByRecordId = await getCategoriesByRecordIds(
        (poItems || []).map((item) => item?.categoryRecordId)
    );

    const { entries, skipped } = collectMaterialsCacheEntries(poItems, { categoryByRecordId });
    const failed = [];
    let updated = 0;
    let linked = 0;

    for (const { item, categoryRecordId, categoryCode, poItemIds } of entries) {
        try {
            // 1. Identity. Returns the existing row untouched when there is
            //    one — nothing about an existing material is rewritten, and
            //    since #356 its name is the catalog's rather than a copy.
            const material = await upsertMaterial({
                categoryRecordId,
                categoryCode,
                size: item.size,
                unit: item.unit,
            });

            // 2. This vendor's price for it.
            await upsertMaterialPrice({
                materialRecordId: material.id,
                vendorRecordId,
                unitPrice: item.unitPrice,
                latestDate,
                latestPORecordId: poRecordId,
            });

            // 3. Every ordered item of this material, not just the one above, or the
            //    Materials rollups undercount.
            for (const poItemRecordId of poItemIds) {
                await setPOItemMaterial(poItemRecordId, material.id);
                linked++;
            }

            updated++;
        } catch (err) {
            failed.push({
                itemName: item.itemName,
                message: err?.message || String(err),
            });
        }
    }

    return { attempted: entries.length, updated, linked, failed, skipped };
}
