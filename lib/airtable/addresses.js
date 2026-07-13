import { base, TABLES } from "./client";

/**
 * Find an address by Airtable record ID. First consumer is PO PDF
 * generation (issue #13) — Jobs.Delivery Address / Alternate Delivery
 * Address and Vendors.Address are all links to this table, but nothing
 * before now ever needed to read an Address's own fields, so no service
 * file existed for this table yet. Returns null if not found.
 */
export async function getAddressByRecordId(recordId) {
    const record = await base(TABLES.ADDRESSES).find(recordId);
    if (!record) return null;

    return {
        id: record.id,
        addressLabel: record.get("Address Label"),
        line1: record.get("Line 1"),
        line2: record.get("Line 2"),
        city: record.get("City"),
        state: record.get("State"),
        zipCode: record.get("Zip Code"),
        country: record.get("Country"),
        formattedAddress: record.get("Formatted Address"),
    };
}
