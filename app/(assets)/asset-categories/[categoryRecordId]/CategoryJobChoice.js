"use client";

import { useSearchParams } from "next/navigation";
import { readAssetIds } from "@/lib/assetRoutes";
import JobChoice from "../../JobChoice";

// The job level of a category's own breadcrumb (#509; in its head until #519), handed the label run selected on it so a
// change of job keeps the run (#443). The selection is read off the address here, as
// `AssetList.js` reads it, because a press rewrites the address without a render and the
// page's own reading would be stale; and it is read beside this page, which is the screen
// the parameter belongs to. A reader who selects nothing — not a site manager (#506) — has
// none read, so a copied link's `id` does not ride the choice either. It is handed the order the
// list is sorted in too (#540), which a change of job keeps.
export default function CategoryJobChoice({ jobs, job, categoryRecordId, selects, sort }) {
    const params = useSearchParams();
    const selection = selects ? readAssetIds(params.getAll("id")) : [];
    return <JobChoice look="crumb" jobs={jobs} job={job} categoryRecordId={categoryRecordId} selection={selection} sort={sort} />;
}
