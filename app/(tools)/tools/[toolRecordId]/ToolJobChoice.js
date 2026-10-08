"use client";

import { useSearchParams } from "next/navigation";
import { readToolItemIds } from "@/lib/toolRoutes";
import JobChoice from "../../JobChoice";

// The head's job choice on a tool's own list (#509), handed the label run selected on it so a
// change of job keeps the run (#443). The selection is read off the address here, as
// `ToolItemList.js` reads it, because a press rewrites the address without a render and the
// page's own reading would be stale; and it is read beside this page, which is the screen
// the parameter belongs to. A reader who selects nothing — not a site manager (#506) — has
// none read, so a copied link's `id` does not ride the choice either.
export default function ToolJobChoice({ jobs, job, toolRecordId, selects }) {
    const params = useSearchParams();
    const selection = selects ? readToolItemIds(params.getAll("id")) : [];
    return <JobChoice jobs={jobs} job={job} toolRecordId={toolRecordId} selection={selection} />;
}
