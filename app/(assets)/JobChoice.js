"use client";

import { useRouter } from "next/navigation";
import { Choice, Field } from "@/app/components/Controls";
import { FILTERED_LISTS, axesFor } from "@/lib/listFilters";
import { ASSET_LIST_COPY as COPY } from "@/lib/assetListView";
import { ALL_JOBS, assetCategoryPath, assetCategoriesPath } from "@/lib/assetRoutes";

// `All jobs` is the document lists' job picker's own word for the whole of a reader's jobs,
// read where it is built, as #509 read it: every document list carries the one job axis, so any
// of them answers. `offline/list-filters.mjs` holds that word to `lib/listFilters.js`.
const ALL_JOBS_LABEL = axesFor(FILTERED_LISTS[0]).find((axis) => axis.param === "job").words.all;

// The job an asset list stands on (#509, #520), drawn the design's two ways since #519 and
// only for a reader with more than one job to choose between — the page asks that. On the
// category list it is 1a's chip at the start of the band, the job behind a pin, since the files
// of 2026-10-23 (#566), where #519 drew `Job` and the job in the head beside `Add items`; on a
// category's page and an asset's it is a level of the breadcrumb, 1d's and 1f's, after
// `Tools & Equipment` (`look="crumb"`). Both are `Choice`, 0l's select-only combobox, named
// by the field's `Job`, which neither shows.
//
// IT OFFERS `All jobs` FIRST AND THEN THE JOBS (#548), as the files draw it on all three screens.
// A list starts on the first job by its code, and `All jobs` is every job the reader may choose
// between at once, which the address carries as `ALL_JOBS`, and which the chip and the level
// say as they say a job. From #509 to #520 `All jobs` stood first as where every list started,
// and #520 took it away; it is back as a choice and not as the start.
//
// WHAT IT OFFERS AND WHAT IT HOLDS ARE THE PAGE'S, from `lib/assetListView.js:assetListScope`,
// the one judgment the page read its rows by. This file only turns a choice into an address.
// On an asset's page the level holds the job the asset is on (`shownAs`), which the reader may
// not be able to choose — off their jobs — and then it shows the job's code and marks nothing;
// it never holds `All jobs` there, since the asset is on one job whatever list it was opened from.
//
// A CHOICE IS A NAVIGATION, AND IT ADDS A HISTORY ENTRY. The page reads only the job's assets,
// so a new job is a new read, and Back returns to the job before it. The page goes back to its
// first, since a page of one job is no page of another. On the category list it keeps what the
// band holds (#520), which the list hands it as `filters` — the search and the chips narrow
// whichever job the list stands on, and the `Job` chip's jobs only all of them (#548), so a move
// to one job leaves those behind; a list drawn with no band hands none, and this file reads
// nothing off the address. On a category's own list it keeps the label run
// selected (#443), which `CategoryJobChoice.js` beside that page hands it — a selection outlives
// a page turn, and a change of job is one more of those, the run's ids off it counted `not on
// this page`. An asset's page lands on its category's list with nothing selected. A choice of
// what the control already holds goes nowhere, which is also what keeps a blur with the list
// open from leaving the page: the pattern chooses what is under visual focus as focus leaves,
// and that is the held option until the reader moves.
export default function JobChoice({ jobs, job, look = "chip", shownAs, categoryRecordId = null, selection = [], filters = {} }) {
    const router = useRouter();
    const options = [{ value: ALL_JOBS, label: ALL_JOBS_LABEL }, ...jobs.map(({ id, jobCode }) => ({ value: id, label: jobCode }))];

    const choose = (next) => {
        if (!next || next === job) return;
        router.push(categoryRecordId ? assetCategoryPath(categoryRecordId, 1, selection, { job: next }) : assetCategoriesPath(1, next, filters));
    };

    return (
        <Field label={COPY.jobLabel} labelAs="span" labelHidden>
            <Choice
                look={look}
                options={options}
                value={job ?? ""}
                onChange={choose}
                placeholder={shownAs}
            />
        </Field>
    );
}
