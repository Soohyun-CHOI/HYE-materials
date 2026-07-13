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
 * Find a vendor by Airtable record ID — needed wherever a Lookup only
 * surfaces the linked record ID rather than display text. Confirmed via
 * Airtable's field config (issue #10's design) that Purchase Orders.Vendor
 * is itself a Lookup through PR -> Purchase Requests.Vendor (a link field,
 * not text), so po.vendor is a raw Vendor record ID, same as the already-
 * documented Purchase Requests.Job gotcha. Returns null if not found.
 */
export async function getVendorByRecordId(recordId) {
    const record = await base(TABLES.VENDORS).find(recordId);
    if (!record) return null;

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
 * List all Vendors — used to populate the Vendor picker on the PR
 * creation form.
 */
export async function getAllVendors() {
    const records = await base(TABLES.VENDORS).select().all();

    return records.map((record) => ({
        id: record.id,
        vendorName: record.get("Vendor Name"),
    }));
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
