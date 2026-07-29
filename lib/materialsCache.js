// Materials cache refresh (#18) — the one place that decides what a generated
// PO contributes to the item axis: which identity rows exist, which per-vendor
// prices they carry, and which PO lines point at them.
//
// Kept out of lib/poGeneration.js so PO generation owns only the PO; the two
// meet at one line in generatePOForApprovedPR, after its rollback block.
//
// THREE WRITES PER MATERIAL, and they are not interchangeable:
//   1. Materials        — identity (Item Name + Size + Unit). Find-or-create.
//   2. Material Prices  — this vendor's latest price for it. Genuine upsert.
//   3. PO Items.Material — the link that makes the item axis exist at all.
//
// Step 3 is why this is not merely a price cache. Materials' Committed/Signed/
// Invoiced Qty are rollups over Materials."PO Items", so a PO line that is
// never linked contributes NOTHING to them — it is invisible on the material
// axis while looking perfectly fine on the document axis. That is also why the
// link is written for EVERY line sharing a material, not just the one whose
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

import { upsertMaterial } from "./airtable/materials";
import { upsertMaterialPrice } from "./airtable/materialPrices";
import { setPOItemMaterial } from "./airtable/poItems";
import { normalizeItemText } from "./itemNaming";

/**
 * Material identity WITHIN one PO. Vendor is not part of it — Materials is
 * keyed on the item alone (#18), and a PO has exactly one Vendor anyway.
 *
 * Normalized the same way upsertMaterial normalizes and getMaterialByKey
 * compares, so two lines Airtable would consider the same material are the same
 * key here too. If these disagreed, one material would be upserted twice and the
 * second write would contend with the first for the same row.
 */
function withinPOKey({ itemName, size, unit }) {
    return [
        normalizeItemText(itemName).toLowerCase(),
        normalizeItemText(size).toLowerCase(),
        (unit || "").trim().toLowerCase(),
    ].join("::");
}

/**
 * The cacheable lines of one PO, grouped by material.
 *
 * Each entry carries `item` (the LAST line seen for that material, whose price
 * is the one cached) and `poItemIds` (EVERY line for it, all of which get the
 * Material link). Two lines of one material in a PO are real — split
 * quantities, staged deliveries — and "latest price" has no meaningful answer
 * between two prices bearing the same date, so last-wins is the deterministic
 * choice and is what the per-key lock would have produced anyway.
 *
 * Skipped, and every skip is reported rather than silent:
 *   - no Item Name — there is no identity to create.
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
export function collectMaterialsCacheEntries(poItems) {
    const byKey = new Map();
    const skipped = [];

    for (const item of poItems || []) {
        if (!item || !normalizeItemText(item.itemName)) {
            skipped.push({ poItemId: item?.poItemId, reason: "no Item Name" });
            continue;
        }
        if (!item.unit) {
            skipped.push({ poItemId: item.poItemId, itemName: item.itemName, reason: "no Unit" });
            continue;
        }
        if (!Number.isFinite(item.unitPrice)) {
            skipped.push({ poItemId: item.poItemId, itemName: item.itemName, reason: "no numeric Unit Price" });
            continue;
        }

        const key = withinPOKey(item);
        const group = byKey.get(key);
        if (group) {
            group.item = item;
            group.poItemIds.push(item.id);
        } else {
            byKey.set(key, { item, poItemIds: [item.id] });
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
 * write for price) plus one link update per PO line, so a wide PO fired off with
 * Promise.all would burst against it. The cost is real and lands on the
 * approving user's request; the same reasoning as confirming attachment ingests
 * one at a time (CLAUDE.md "File uploads").
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

    const { entries, skipped } = collectMaterialsCacheEntries(poItems);
    const failed = [];
    let updated = 0;
    let linked = 0;

    for (const { item, poItemIds } of entries) {
        try {
            // 1. Identity. Returns the existing row untouched when there is
            //    one — the first recorded spelling of a name is kept.
            const material = await upsertMaterial({
                itemName: item.itemName,
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

            // 3. Every line of this material, not just the one above, or the
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
