"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, withAdminAction } from "@/lib/authz";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getAssetByAssetId, updateAssetJob } from "@/lib/airtable/assets";
import { getAssetLogByAsset, updateCreatedEntryJob } from "@/lib/airtable/assetLog";
import { ASSET_COPY } from "@/lib/assetView";
import { ASSET_OFFICE_COPY as COPY, planOfficeActs, readJobChange } from "@/lib/assetOfficeActs";
import { assetPath } from "@/lib/assetRoutes";
import { withOpsLabel } from "@/lib/airtableOps";

/*
 * What the office does to an asset nothing has happened to (#583), from the asset's page — in a
 * file of its own, as the catalog's are (#527): every action in `actions.js` is a site manager's,
 * and these are the office's, `withAdminAction` round a handler kept in, which
 * `offline/site-manager.mjs` holds file by file. #582's deletion is the second.
 *
 * A REFUSAL RE-RENDERS THE PAGE AS IT ANSWERS (#378), and its sentence is said where the page
 * says a refused press, under the status, or over the dialog's actions while the dialog stands
 * open; every call site binds the return (#185, `offline/action-refusal-shape.mjs`). The refusal
 * is written out in each place, as the catalog's are, because that check reads the wrapper's
 * off the thunk handed to it.
 */

/**
 * Change the job of an asset whose history holds its `Created` entry alone (#583) — the entry's
 * `Job`, then the asset's, and the asset's number, label and status as they were.
 *
 * THE OFFICE'S, AND THE ASSET'S NOTHING-YET ASKED AGAIN ON A FRESH READ. The wrapper refuses a
 * reader who is not the office; `planOfficeActs` asks the rest of what this asset's history holds
 * now. An asset whose link array names anything but one row has had something happen to it, so
 * the plan is asked of those ids with nothing read; one row is read, and its event decides.
 *
 * THE ENTRY FIRST, AND NOTHING PUT BACK. `readJobChange` says which halves differ from the job
 * chosen. A failed entry write writes nothing and throws, as a failed `Asset Log` row does on the
 * page's other acts. A failed asset write after it is named on the page and logged with its
 * record id, never written back: the entry is the record, and a Save of the same job writes the
 * asset alone (`ASSET_OFFICE_COPY.halfDone`).
 *
 * NO LOCK. Both writes set a value, so two Saves of one job land as one; two of different jobs
 * land as the later, as two notes do (#533). **Unobserved, and recorded here rather than
 * guarded**: a site manager recording an event on the same asset in the instant of a change can
 * pass the plan in another invocation, so the asset's `Job` may take the change after the event's
 * own; one more event writes it again from that event. A lock would serialize one process only.
 *
 * SEVEN OPERATIONS: the session twice — the wrapper's gate and this body — the asset, its one row
 * and the job list, and the two writes. A Save that moves nothing is the first five and lands; a
 * refusal is at most the first five and the page drawn again.
 *
 * ON SUCCESS IT REDIRECTS TO THE PAGE IT CAME FROM AND SAYS NOTHING (#321): the history's `Created`
 * entry names the new job, and so does every list.
 */
export const changeAssetJobAction = withAdminAction(() => {
    refresh();
    return { error: COPY.noAccess };
}, changeAssetJobHandler);

async function changeAssetJobHandler(prevState, formData) {
    return withOpsLabel("changeAssetJobAction", async () => {
        const user = await requireUser();

        // The printed id, which the page was reached by, looked up as the page looks it up.
        const asset = await getAssetByAssetId(String(formData.get("assetId") ?? ""));
        if (!asset) return refuse(ASSET_COPY.notFoundHeading);

        const rowIds = asset.assetLog || [];
        const [log, jobs] =
            rowIds.length === 1
                ? await Promise.all([getAssetLogByAsset(asset.id, { rowIds }), getAllJobs()])
                : // The ids stand for the rows, which the plan counts and need not read.
                  [rowIds.map((id) => ({ id })), []];
        const plan = planOfficeActs({ user, log, jobs });
        const answer = readJobChange(plan, {
            jobId: String(formData.get("jobId") ?? ""),
            assetJobRecordId: asset.job?.[0] ?? null,
        });
        if (answer.refusal) return refuse(answer.refusal);

        if (answer.writesEntry) {
            await updateCreatedEntryJob({ asset, entry: log[0], jobRecordId: answer.jobRecordId });
        }
        if (answer.writesAsset) {
            try {
                await updateAssetJob({ assetRecordId: asset.id, jobRecordId: answer.jobRecordId });
            } catch (error) {
                console.error("Asset job not updated after its Created entry was moved (#583)", {
                    assetRecordId: asset.id,
                    assetId: asset.assetId,
                    jobRecordId: answer.jobRecordId,
                    error,
                });
                const codeOf = (id) => jobs.find((job) => job.id === id)?.jobCode ?? "";
                return refuse(COPY.halfDone({ from: codeOf(asset.job?.[0]), to: codeOf(answer.jobRecordId) }));
            }
        }

        redirect(assetPath(asset.assetId));
    });
}

/** A refusal and the page drawn again with it (#378), `actions.js`' `refuse` in this file. */
function refuse(error) {
    refresh();
    return { error };
}
