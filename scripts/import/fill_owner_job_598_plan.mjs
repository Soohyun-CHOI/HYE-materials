// What `fill_owner_job_598.mjs` judges, apart from the base it judges (#598): which assets take the
// job they stand on as their `Owner Job`, what its ledger says of each, and what a revert takes back.
//
// A MODULE OF ITS OWN SO THE OFFLINE TIER CAN HOLD IT. The script imports `lib/airtable/client.js`,
// which throws without credentials, so a judgment kept inside it is reached only by a run against a
// base — and the judgment is the run's whole safety: a row that already names an owner job is left
// alone, a row with no job or with several is told and not written, and a revert clears only a row
// still holding what the ledger wrote. `offline/asset-loan.mjs` holds each against rows of its own.
//
// IT DECIDES NOTHING THE APP DECIDES. Which job an asset belongs to is the app's from #598 on — the
// registration's, then nobody's but the office's change of job (#583); what is here is the one
// answer for the assets that stood before it: the job each stands on, since nothing had lent one.
// Imports nothing.

export const SCRIPT = "fill_owner_job_598";

/** Airtable's ceiling on the rows one request writes. */
export const ROWS_PER_REQUEST = 10;

/**
 * What a fill writes and leaves (#598): `fills`, each `{ id, assetId, status, jobId }` — an asset
 * whose `Owner Job` is empty and which stands on one job, given that job — and `held`, each `{ id,
 * assetId, why }`, an asset left as it is and said why: one already naming an owner job, one on no
 * job, one on several. `rows` are the assets as read, `{ id, assetId, status, job, ownerJob }` with
 * the two links as arrays, in the order read.
 */
export function planFill(rows) {
    const fills = [];
    const held = [];
    for (const row of rows || []) {
        const job = Array.isArray(row.job) ? row.job : [];
        const owner = Array.isArray(row.ownerJob) ? row.ownerJob : [];
        if (owner.length > 0) held.push({ id: row.id, assetId: row.assetId, why: "owned", ownerJob: owner });
        else if (job.length === 0) held.push({ id: row.id, assetId: row.assetId, why: "no job" });
        else if (job.length > 1) held.push({ id: row.id, assetId: row.assetId, why: "several jobs" });
        else fills.push({ id: row.id, assetId: row.assetId, status: row.status ?? null, jobId: job[0] });
    }
    return { fills, held };
}

/** The ledger's line for one fill, written before the request carrying it leaves. */
export function fillLine(fill) {
    return { type: "fill", id: fill.id, assetId: fill.assetId, before: [], after: [fill.jobId] };
}

/**
 * What a revert of one ledger clears and leaves (#598): `clears`, each `{ id, assetId }`, a row the
 * ledger filled that still holds the one job it wrote; `held`, each `{ id, assetId, why }`, a row
 * gone from the base or since given another owner job — left, and said. `lines` are the ledger's,
 * `rows` the assets as read now, by record id.
 */
export function planRevert(lines, rows) {
    const byId = new Map((rows || []).map((row) => [row.id, row]));
    const clears = [];
    const held = [];
    for (const line of (lines || []).filter((each) => each?.type === "fill")) {
        const row = byId.get(line.id);
        const owner = Array.isArray(row?.ownerJob) ? row.ownerJob : [];
        if (!row) held.push({ id: line.id, assetId: line.assetId, why: "not on the base" });
        else if (owner.length !== 1 || owner[0] !== line.after?.[0]) held.push({ id: line.id, assetId: line.assetId, why: "changed since" });
        else clears.push({ id: line.id, assetId: line.assetId });
    }
    return { clears, held };
}

/** The fills by the job each takes, `{ jobId, count }` in the order first met. */
export function fillsByJob(fills) {
    const counts = new Map();
    for (const fill of fills || []) counts.set(fill.jobId, (counts.get(fill.jobId) ?? 0) + 1);
    return [...counts].map(([jobId, count]) => ({ jobId, count }));
}

/** The pieces of a list, `size` to a piece. */
export function inBatches(items, size = ROWS_PER_REQUEST) {
    return Array.from({ length: Math.ceil((items || []).length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
}
