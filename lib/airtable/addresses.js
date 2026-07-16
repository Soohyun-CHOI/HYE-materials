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

/**
 * Create a new Address record. Address Label is the primary field but is
 * human-picked, not backend-generated (see CLAUDE.md's Addresses entry) —
 * callers choose something readable, e.g. "Conklin Metal - Main". Formatted
 * Address is a formula, never set here.
 */
export async function createAddress({ addressLabel, line1, line2, city, state, zipCode, country }) {
    const record = await base(TABLES.ADDRESSES).create({
        "Address Label": addressLabel,
        "Line 1": line1 || "",
        "Line 2": line2 || "",
        City: city || "",
        State: state || "",
        "Zip Code": zipCode || "",
        Country: country || "USA",
    });

    return { id: record.id, addressLabel: record.get("Address Label") };
}
