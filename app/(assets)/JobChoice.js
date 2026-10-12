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

// The job an asset list is narrowed to (#509), drawn the design's two ways since #519 and
// only for a reader with more than one job to choose between — the page asks that. On the
// category list it is 1a's chip in the head, `Job` and the value beside `Add items`; on a
// category's page and an asset's it is a level of the breadcrumb, 1d's and 1f's, after
// `Tools & Equipment` (`look="crumb"`). Both are `Choice`, 0l's select-only combobox, named
// by the field's `Job`.
//
// `All jobs` STAYS FIRST, WHICH THE DESIGN DOES NOT DRAW. The files draw the chip and the level
// holding a job and offer the jobs alone; but a list starts from the whole of the reader's
// jobs (#509) — every one for the office, their own for anybody else — and `All jobs` is how
// the list says it holds that, and how a reader gets back to it.
//
// WHAT IT OFFERS AND WHAT IT HOLDS ARE THE PAGE'S, from `lib/assetListView.js:assetListScope`,
// the one judgment the page read its rows by. This file only turns a choice into an address.
// On an asset's page the level holds the job the asset is on (`shownAs`), which the reader may
// not be able to choose — off their jobs — and then it shows the job's code and marks nothing.
//
// A CHOICE IS A NAVIGATION, AND IT ADDS A HISTORY ENTRY. The page reads only the narrowed
// scope's assets, so a new job is a new read, and Back returns to the scope before it.
// The page goes back to its first, since a page of one scope is no page of another. On a
// category's own list it keeps the label run selected (#443), which `CategoryJobChoice.js` beside
// that page hands it — a selection outlives a page turn, and a change of job is one more of
// those, the run's ids off it counted `not on this page`. `/asset-categories` selects nothing,
// and an asset's page lands on its category's list with nothing selected. A choice of what the
// control already holds goes nowhere, which is also what keeps a blur with the list open from
// leaving the page: the pattern chooses what is under visual focus as focus leaves, and that
// is the held option until the reader moves.
export default function JobChoice({ jobs, job, look = "chip", shownAs, categoryRecordId = null, selection = [] }) {
    const router = useRouter();
    const options = [{ value: "", label: ALL_JOBS }, ...jobs.map(({ id, jobCode }) => ({ value: id, label: jobCode }))];

    const choose = (next) => {
        if (next === (job ?? "")) return;
        const chosen = next || null;
        router.push(categoryRecordId ? assetCategoryPath(categoryRecordId, 1, selection, { job: chosen }) : assetCategoriesPath(1, chosen));
    };

    return (
        <Field label={COPY.jobLabel} labelAs="span" labelHidden>
            <Choice look={look} label={COPY.jobLabel} options={options} value={job ?? ""} onChange={choose} placeholder={shownAs} />
        </Field>
    );
}
