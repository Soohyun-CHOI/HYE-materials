import { base, TABLES } from "./client";

/**
 * List all Disciplines — used to populate the Discipline picker on the PR
 * creation form, filtered client-side to the selected Job's Disciplines (Job is
 * a single link, so `record.get("Job")` is a one-element array).
 */
export async function getAllDisciplines() {
    const records = await base(TABLES.DISCIPLINES).select().all();

    return records.map(recordToDiscipline);
}

/**
 * One Discipline by record id (#314).
 *
 * `/pos/[poId]` holds a request's `Discipline` link and one id, so it wants the row
 * rather than the table. Reading the whole table for one label is what
 * `getAllDisciplines` is for — a picker filling a dropdown — and using it here would
 * be a select where a find is the shape.
 *
 * ONE MAPPER, WHICH IS THE HALF WORTH SAYING. The reader is trivial and the mapper is
 * not: `Job` is a single link arriving as an array, and a second copy of that
 * flattening is the drift `getInvoiceItemsByRecordIds`'s own docstring records this
 * repo avoiding when #167 moved a private reader into a table module.
 */
export async function getDisciplineByRecordId(recordId) {
    const record = await base(TABLES.DISCIPLINES).find(recordId);
    if (!record) return null;
    return recordToDiscipline(record);
}

function recordToDiscipline(record) {
    const job = record.get("Job");
    return {
        id: record.id,
        disciplineLabel: record.get("Discipline Label"),
        disciplineName: record.get("Discipline Name"),
        jobId: Array.isArray(job) && job.length > 0 ? job[0] : null,
    };
}

/**
 * Create a new Discipline under a Job. Discipline Label is a formula
 * ({Job} & "_" & {Discipline Name}) — Airtable computes it, we never write it
 * directly. The separator is an underscore, the same shape `Material Label`
 * uses; this docstring said ` - ` until #280 read the live formula.
 */
export async function createDiscipline({ jobRecordId, disciplineName }) {
    const record = await base(TABLES.DISCIPLINES).create({
        Job: jobRecordId ? [jobRecordId] : [],
        "Discipline Name": disciplineName,
    });

    return { id: record.id, disciplineLabel: record.get("Discipline Label") };
}
