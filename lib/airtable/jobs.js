import { base, TABLES } from "./client";
import { formulaString } from "../airtableFormula";

/**
 * Find a job by its Job Code (human-entered, not backend-generated —
 * readability in the link-picker UI matters more than machine-uniqueness).
 * Returns null if not found.
 */
export async function getJobByCode(jobCode) {
    const records = await base(TABLES.JOBS)
        .select({
            filterByFormula: `{Job Code} = "${formulaString(jobCode)}"`,
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
 * Find a job by its Airtable record ID — needed wherever a Lookup only
 * surfaces the linked record ID rather than display text (e.g. Purchase
 * Requests.Job, see CLAUDE.md's PR detail page gotcha), and PO generation
 * needs the Job's PIC/Manager to default Purchase Orders."Our PIC"/"Our
 * Manager". Returns null if not found.
 */
export async function getJobByRecordId(recordId) {
    const record = await base(TABLES.JOBS).find(recordId);
    if (!record) return null;

    return {
        id: record.id,
        jobCode: record.get("Job Code"),
        jobName: record.get("Job Name"),
        businessUnit: record.get("Business Unit"),
        pic: record.get("PIC"),
        picPhone: record.get("PIC Phone"),
        picEmail: record.get("PIC Email"),
        manager: record.get("Manager"),
        managerPhone: record.get("Manager Phone"),
        managerEmail: record.get("Manager Email"),
        deliveryAddress: record.get("Delivery Address"),
        alternateDeliveryAddress: record.get("Alternate Delivery Address"),
        // Issue #162 — reverse-links, core link data with no propagation lag
        // (see client.js:getLinkedRecords), so exposing them costs no extra
        // fetch. `lines` is the first step of the Job -> Lines -> PRs -> POs ->
        // PO Items walk that finds a Job's order lines, since PO Items carries
        // no Job of its own; `deliveries` is what the deliveries list reads.
        lines: record.get("Lines") || [],
        deliveries: record.get("Deliveries") || [],
    };
}

/**
 * List all Jobs — used to populate the Job picker on the PR creation form
 * (Requester picks a Job first, then a Line under it — see
 * lib/airtable/lines.js:getAllLines()).
 */
export async function getAllJobs() {
    const records = await base(TABLES.JOBS).select().all();

    return records.map((record) => ({
        id: record.id,
        jobCode: record.get("Job Code"),
        jobName: record.get("Job Name"),
        // Issue #162 — two reverse-links the delivery surfaces read. This select
        // passes no `fields`, so Airtable already returns both on every record:
        // exposing them costs no query and saves one per Job, which is what the
        // callers would otherwise have paid to find the same ids. `lines` is the
        // first step of the Job -> Lines -> PRs -> POs -> PO Items walk, and
        // having it here is what lets that walk batch across every accessible Job
        // at once instead of per Job.
        lines: record.get("Lines") || [],
        deliveries: record.get("Deliveries") || [],
    }));
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
