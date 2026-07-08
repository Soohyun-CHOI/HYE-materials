import { base, TABLES } from "./client";

/**
 * Look up the latest-price cache entry by natural key: Item Name + Size +
 * Unit + Vendor. Item Name/Size/Unit are plain text (formula-filterable),
 * but Vendor is a link field, which Airtable formulas can't filter on
 * reliably — so we filter by the text fields first, then narrow by Vendor
 * in JS (same pattern used in lib/ids.js's generateChildId).
 */
export async function getMaterialByKey({ itemName, size, unit, vendorRecordId }) {
    const records = await base(TABLES.MATERIALS)
        .select({
            filterByFormula: `AND({Item Name} = "${itemName}", {Size} = "${size}", {Unit} = "${unit}")`,
        })
        .all();

    const match = records.find((record) => {
        const linked = record.get("Vendor");
        return Array.isArray(linked) && linked.includes(vendorRecordId);
    });

    return match ? recordToMaterial(match) : null;
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
}
