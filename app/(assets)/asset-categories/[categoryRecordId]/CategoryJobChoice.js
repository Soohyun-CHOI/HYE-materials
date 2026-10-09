"use client";

import { useSearchParams } from "next/navigation";
import { readAssetIds } from "@/lib/assetRoutes";
import JobChoice from "../../JobChoice";

// The head's job choice on a category's own list (#509), handed the label run selected on it so a
// change of job keeps the run (#443). The selection is read off the address here, as
// `AssetList.js` reads it, because a press rewrites the address without a render and the
// page's own reading would be stale; and it is read beside this page, which is the screen
// the parameter belongs to. A reader who selects nothing — not a site manager (#506) — has
// none read, so a copied link's `id` does not ride the choice either.
export default function CategoryJobChoice({ jobs, job, categoryRecordId, selects }) {
    const params = useSearchParams();
    const selection = selects ? readAssetIds(params.getAll("id")) : [];
    return <JobChoice jobs={jobs} job={job} categoryRecordId={categoryRecordId} selection={selection} />;
}
