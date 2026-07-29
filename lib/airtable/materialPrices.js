import { base, TABLES, withKeyLock, formulaString } from "./client";

/**
 * Material Prices is the item × vendor table (#18): the latest known unit price
 * for one material FROM one vendor, plus which PO that price came from and when.
 *
 * It exists because the three things #18 serves have two different axes. Price
 * is only meaningful per vendor — "what does this cost" has a different answer
 * per supplier, and averaging them would answer nobody's question. Purchase
 * history and on-order quantity are the opposite: they have to aggregate across
 * vendors, because "how much of this material do we have on order" does not care
 * who is supplying it. One table could not be keyed both ways, so Materials
 * holds identity (and the cross-vendor rollups) and this holds the per-vendor
 * price.
 *
 * Still a latest-value cache, not history: price history is read from PR Items
 * (see CLAUDE.md), and #19's price search reads this table for the current
 * figure per vendor.
 *
 * Computed here, never written: Price Label (formula over the two links),
 * Material Record ID and Vendor Record ID (lookups). The two lookups are what
 * make the row findable by ids at all — filterByFormula cannot compare a link
 * field to a record id, so this is the same exception CLAUDE.md already records
 * for parent-link filtering.
 */
export async function getMaterialPrice({ materialRecordId, vendorRecordId }) {
    const records = await base(TABLES.MATERIAL_PRICES)
        .select({
            filterByFormula: `AND(
                {Material Record ID} = "${formulaString(materialRecordId)}",
                {Vendor Record ID} = "${formulaString(vendorRecordId)}"
            )`,
            maxRecords: 1,
        })
        .firstPage();

    if (records.length === 0) return null;
    return recordToMaterialPrice(records[0]);
}

function recordToMaterialPrice(record) {
    return {
        id: record.id,
        priceLabel: record.get("Price Label"),
        material: record.get("Material") || [],
        vendor: record.get("Vendor") || [],
        unitPrice: record.get("Unit Price"),
        latestDate: record.get("Latest Date"),
        latestPO: record.get("Latest PO") || [],
    };
}

/**
 * Upsert the latest price for one material × vendor pair. Unlike
 * upsertMaterial, this one genuinely updates on a match: price, date and
 * source PO are exactly the latest-value fields the cache exists to carry.
 *
 * Its own lock, keyed on the pair rather than on the material, because the
 * contended resource is a different row: two vendors' prices for one material
 * are two records and must not serialize against each other, while two PO lines
 * of the same material from the same vendor must. Both locks can be held in one
 * refresh (materialsCache.js takes the material lock, releases it, then takes
 * this one), never nested.
 *
 * Note the lock cannot cover the identity step as well: the material record id
 * is only known after upsertMaterial has returned, so the two are sequential by
 * construction. That is fine — a concurrent caller either finds the material
 * already created or waits on the material lock, and then contends here on the
 * same pair key.
 */
export async function upsertMaterialPrice({
                                              materialRecordId,
                                              vendorRecordId,
                                              unitPrice,
                                              latestDate,
                                              latestPORecordId,
                                          }) {
    const lockKey = ["price", materialRecordId, vendorRecordId].join("::");

    return withKeyLock(lockKey, async () => {
        const existing = await getMaterialPrice({ materialRecordId, vendorRecordId });

        const fields = {
            "Unit Price": unitPrice,
            "Latest Date": latestDate,
            "Latest PO": latestPORecordId ? [latestPORecordId] : [],
        };

        if (existing) {
            const record = await base(TABLES.MATERIAL_PRICES).update(existing.id, fields);
            return recordToMaterialPrice(record);
        }

        // Material and Vendor are the natural key, so they are only ever
        // written on create — a matched row already carries them.
        const record = await base(TABLES.MATERIAL_PRICES).create({
            Material: materialRecordId ? [materialRecordId] : [],
            Vendor: vendorRecordId ? [vendorRecordId] : [],
            ...fields,
        });

        return recordToMaterialPrice(record);
    });
}
