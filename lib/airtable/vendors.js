import { base, TABLES } from "./client";

/**
 * Find a vendor by Vendor Name (primary field, human-entered).
 * Returns null if not found.
 */
export async function getVendorByName(vendorName) {
    const records = await base(TABLES.VENDORS)
        .select({
            filterByFormula: `{Vendor Name} = "${vendorName}"`,
            maxRecords: 1,
        })
        .firstPage();

    if (records.length === 0) return null;

    const record = records[0];
    return {
        id: record.id,
        vendorName: record.get("Vendor Name"),
        picName: record.get("PIC Name"),
        picPhone: record.get("PIC Phone"),
        picEmail: record.get("PIC Email"),
        address: record.get("Address"),
    };
}

/**
 * Create a new Vendor record. PIC Name/Phone/Email are plain text —
 * deliberately NOT linked to Users, since a vendor's contact is external
 * staff, unlike a Job's PIC/Manager.
 */
export async function createVendor({
                                        vendorName,
                                        picName,
                                        picPhone,
                                        picEmail,
                                        addressId,
                                    }) {
    const record = await base(TABLES.VENDORS).create({
        "Vendor Name": vendorName,
        "PIC Name": picName || "",
        "PIC Phone": picPhone || "",
        "PIC Email": picEmail || "",
        Address: addressId ? [addressId] : [],
    });

    return { id: record.id, vendorName: record.get("Vendor Name") };
}
