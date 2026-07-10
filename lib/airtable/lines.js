import { base, TABLES } from "./client";

/**
 * List all Lines — used to populate the Line picker on the PR creation
 * form, filtered client-side to the selected Job's Lines (Job is a single
 * link, so `record.get("Job")` is a one-element array).
 */
export async function getAllLines() {
    const records = await base(TABLES.LINES).select().all();

    return records.map((record) => {
        const job = record.get("Job");
        return {
            id: record.id,
            lineLabel: record.get("Line Label"),
            lineName: record.get("Line Name"),
            jobId: Array.isArray(job) && job.length > 0 ? job[0] : null,
        };
    });
}

/**
 * Create a new Line under a Job. Line Label is a formula
 * ({Job} - {Line Name}) — Airtable computes it, we never write it directly.
 */
export async function createLine({ jobRecordId, lineName }) {
    const record = await base(TABLES.LINES).create({
        Job: jobRecordId ? [jobRecordId] : [],
        "Line Name": lineName,
    });

    return { id: record.id, lineLabel: record.get("Line Label") };
}
