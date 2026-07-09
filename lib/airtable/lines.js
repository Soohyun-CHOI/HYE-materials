import { base, TABLES } from "./client";

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
