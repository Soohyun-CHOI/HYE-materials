import { base, TABLES } from "./client";

/**
 * Find a job by its Job Code (human-entered, not backend-generated —
 * readability in the link-picker UI matters more than machine-uniqueness).
 * Returns null if not found.
 */
export async function getJobByCode(jobCode) {
    const records = await base(TABLES.JOBS)
        .select({
            filterByFormula: `{Job Code} = "${jobCode}"`,
            maxRecords: 1,
        })
        .firstPage();

    if (records.length === 0) return null;

    const record = records[0];
    return {
        id: record.id,
        jobCode: record.get("Job Code"),
        jobName: record.get("Job Name"),
        businessUnit: record.get("Business Unit"),
        pic: record.get("PIC"),
        manager: record.get("Manager"),
        deliveryAddress: record.get("Delivery Address"),
        alternateDeliveryAddress: record.get("Alternate Delivery Address"),
    };
}

/**
 * Create a new Job record. PIC/Manager Phone/Email are Lookups via
 * PIC/Manager — never set them directly, they're read-only. Job creation
 * doesn't take Line info — Lines are created separately under a Job, via
 * lib/airtable/lines.js:createLine().
 */
export async function createJob({
                                     jobCode,
                                     jobName,
                                     businessUnit,
                                     picUserId,
                                     managerUserId,
                                     deliveryAddressId,
                                     alternateDeliveryAddressId,
                                 }) {
    const record = await base(TABLES.JOBS).create({
        "Job Code": jobCode,
        "Job Name": jobName,
        "Business Unit": businessUnit,
        PIC: picUserId ? [picUserId] : [],
        Manager: managerUserId ? [managerUserId] : [],
        "Delivery Address": deliveryAddressId ? [deliveryAddressId] : [],
        "Alternate Delivery Address": alternateDeliveryAddressId
            ? [alternateDeliveryAddressId]
            : [],
    });

    return { id: record.id, jobCode: record.get("Job Code") };
}
