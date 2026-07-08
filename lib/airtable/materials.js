import { base, TABLES, withKeyLock } from "./client";

/**
 * Look up the latest-price cache entry by natural key: Item Name + Size +
 * Unit + Vendor. Item Name/Size/Unit are plain text, compared via
 * LOWER(TRIM(...)) so casing/whitespace differences don't split the same
 * material into two "different" cache rows. Vendor is a link field, which
 * can't be compared to a record ID directly in filterByFormula (Airtable
 * formulas see a link field as its linked record's display text) — so it's
 * compared through the "Vendor Record ID" lookup field instead, same
 * pattern as every other parent-link filter in this codebase.
 */
export async function getMaterialByKey({ itemName, size, unit, vendorRecordId }) {
    const records = await base(TABLES.MATERIALS)
        .select({
            filterByFormula: `AND(
                LOWER(TRIM({Item Name})) = LOWER(TRIM("${itemName}")),
                LOWER(TRIM({Size})) = LOWER(TRIM("${size}")),
                LOWER(TRIM({Unit})) = LOWER(TRIM("${unit}")),
                {Vendor Record ID} = "${vendorRecordId}"
            )`,
            maxRecords: 1,
        })
        .firstPage();

    if (records.length === 0) return null;
    return recordToMaterial(records[0]);
}

function recordToMaterial(record) {
    return {
        id: record.id,
        itemName: record.get("Item Name"),
        size: record.get("Size"),
        unit: record.get("Unit"),
        vendor: record.get("Vendor"),
        unitPrice: record.get("Unit Price"),
        latestJob: record.get("Latest Job"),
        latestDate: record.get("Latest Date"),
        latestPO: record.get("Latest PO"),
    };
}

/**
 * Upsert the latest-known-price cache as PRs get signed, keyed by the
 * natural key (Item Name + Size + Unit + Vendor). Updates the existing
 * record if found, otherwise creates one — Airtable has no native
 * composite-uniqueness constraint, so the backend enforces it here.
 * This cache only ever holds the latest value; historical price trends
 * are read from PR Items directly, not from this table.
 *
 * The whole read-then-write sequence runs inside a per-natural-key lock
 * (withKeyLock, see lib/airtable/client.js) — without it, concurrent calls
 * for the same key (e.g. multiple PR items resolving to the same material
 * upserting around the same moment via Promise.all) can each read "nothing
 * exists yet" before any of them writes, and each create a duplicate
 * record. The lock key is normalized (trim + lowercase) to match the
 * LOWER(TRIM(...)) comparison getMaterialByKey uses, so keys that would
 * match in Airtable also serialize against each other here.
 */
export async function upsertMaterial({
                                          itemName,
                                          size,
                                          unit,
                                          vendorRecordId,
                                          unitPrice,
                                          latestJobId,
                                          latestDate,
                                          latestPORecordId,
                                      }) {
    const lockKey = [itemName, size, unit]
        .map((s) => (s || "").trim().toLowerCase())
        .concat(vendorRecordId)
        .join("::");

    return withKeyLock(lockKey, async () => {
        const existing = await getMaterialByKey({ itemName, size, unit, vendorRecordId });

        const fields = {
            "Unit Price": unitPrice,
            "Latest Job": latestJobId ? [latestJobId] : [],
            "Latest Date": latestDate,
            "Latest PO": latestPORecordId ? [latestPORecordId] : [],
        };

        if (existing) {
            const record = await base(TABLES.MATERIALS).update(existing.id, fields);
            return recordToMaterial(record);
        }

        const record = await base(TABLES.MATERIALS).create({
            "Item Name": itemName,
            Size: size || "",
            Unit: unit || "",
            Vendor: vendorRecordId ? [vendorRecordId] : [],
            ...fields,
        });

        return recordToMaterial(record);
    });
}
