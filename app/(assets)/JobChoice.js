"use client";

import { useRouter } from "next/navigation";
import { Choice, Field } from "@/app/components/Controls";
import { FILTERED_LISTS, axesFor } from "@/lib/listFilters";
import { ASSET_LIST_COPY as COPY } from "@/lib/assetListView";
import { assetCategoryPath, assetCategoriesPath } from "@/lib/assetRoutes";

// `All jobs` is the document lists' job picker's own word for the same choice, read where
// it is built: every document list carries the one job axis, so any of them answers.
// `offline/list-filters.mjs` holds that word to `lib/listFilters.js`.
const ALL_JOBS = axesFor(FILTERED_LISTS[0]).find((axis) => axis.param === "job").words.all;

// The job an asset list is narrowed to (#509), in the list's head — 0n's place for a list's
// one control, beside `Add tools` — as 0l's choice: `All jobs` first, which is the whole of
// what the reader starts from, and then each job they may narrow to by its code, as the
// registration's choice names them. Design is drawing the control; this is the closest the
// app already draws, and it is held to no width of its own until then, so it is as wide as
// what it shows.
//
// WHAT IT OFFERS AND WHAT IT HOLDS ARE THE PAGE'S, from `lib/assetListView.js:assetListScope`,
// the one judgment the page read its rows by. This file only turns a choice into an address.
//
// A CHOICE IS A NAVIGATION, AND IT ADDS A HISTORY ENTRY. The page reads only the narrowed
// scope's assets, so a new job is a new read, and Back returns to the scope before it.
// The page goes back to its first, since a page of one scope is no page of another. On a
// category's own list it keeps the label run selected (#443), which `CategoryJobChoice.js` beside
// that page hands it — a selection outlives a page turn, and a change of job is one more of
// those, the run's ids off it counted `not on this page`. `/asset-categories` selects nothing.
export default function JobChoice({ jobs, job, categoryRecordId = null, selection = [] }) {
    const router = useRouter();
    const options = [{ value: "", label: ALL_JOBS }, ...jobs.map(({ id, jobCode }) => ({ value: id, label: jobCode }))];

    const choose = (next) => {
        if (next === (job ?? "")) return;
        const chosen = next || null;
        router.push(categoryRecordId ? assetCategoryPath(categoryRecordId, 1, selection, { job: chosen }) : assetCategoriesPath(1, chosen));
    };

    // AS WIDE AS ITS LONGEST OPTION, AND NO WIDTH OF ITS OWN. A choice's list takes the field's
    // width (0a Menu), so a field as wide as `All jobs` cut every code in the list to
    // `26-DEM…` — seen in a browser. Each option is laid unseen in the one grid cell the
    // field stands in, with the field's own side room, gap and chevron, so the cell is the
    // widest of them and no value is chosen ahead of Design's drawing.
    return (
        <div className="inline-grid">
            <div className="col-start-1 row-start-1 min-w-0">
                <Field label={COPY.jobLabel} labelAs="span" labelHidden>
                    <Choice name="job" options={options} value={job ?? ""} onChange={choose} />
                </Field>
            </div>
            {options.map((option) => (
                <span
                    key={option.value}
                    aria-hidden="true"
                    className="invisible col-start-1 row-start-1 flex h-0 gap-gap overflow-hidden border px-input-inset-x text-body whitespace-nowrap"
                >
                    {option.label}
                    <span className="size-icon-sm shrink-0" />
                </span>
            ))}
        </div>
    );
}
