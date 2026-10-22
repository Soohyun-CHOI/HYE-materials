"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, FilterChip, SearchField } from "@/app/components/Controls";
import ListFrame from "@/app/components/ListFrame";
import { ListHeader, Pager, TABLE_HEAD, TABLE_ROW, TABLE_ROW_LINK } from "@/app/components/ListTable";
import { FILTER_BAR_COPY } from "@/lib/listFilters";
import {
    ASSET_LIST_COPY as COPY,
    ASSET_LIST_FACETS,
    emptiedListWords,
    filterAssetCategoryRows,
    pageOfAssetCategories,
    pagerPosition,
    readAssetListFilters,
} from "@/lib/assetListView";
import { assetCategoriesPath, assetCategoryPath } from "@/lib/assetRoutes";
import { ASSET_STATUS_VALUES } from "@/lib/assetStatus";
import JobChoice from "../JobChoice";

// 1a's columns since #519: the name, then a count for each status at 96, right-aligned — four
// since #531, `In repair` between `Out` and `Retired`, the order `ASSET_STATUS_VALUES` holds
// them in. The repeat is a literal a stylesheet can be built from, so the count in it is
// written here and `offline/asset-list-view.mjs` holds it to the vocabulary's length. The
// category stands in the name's cell, 20 after the name at Ink 3, and gives its room up first,
// so a long name is cut last. From #507 to #519 the class, the type and the category were
// columns of their own between the name and the counts; the band's chips filter by the type and
// the category since #520, the class too until #552, and the category page's caption says them.
const COLUMNS = "grid-cols-[minmax(0,1fr)_repeat(4,var(--width-table-count))]";

/**
 * The category list on the job it stands on (1a, #520): its head with how many items the job
 * holds, the band that filters and searches them, the rows, and the pager.
 *
 * EVERY ROW ON THE JOB IS HERE, AND THE BAND NARROWS THEM IN THE BROWSER. The page reads every
 * category on the job and counts every asset there (`summarizeAssetCategories`), so the
 * rows the band chooses among are all in hand: a chip, a search and a step to another page
 * fetch nothing. **The address follows by `history.replaceState`, as a category's selection
 * does (`[categoryRecordId]/AssetList.js` has why in full)** — no request and no history entry,
 * and `useSearchParams` reads the address back, so a reload, a copied link and a step all carry
 * what the band holds. `router.replace`, the document lists' way, would draw the page again on
 * the server at every keystroke, at four operations or more each (#560).
 *
 * WHAT THE BAND HOLDS IS READ ONCE, BY `filterAssetCategoryRows`: the rows, the count in the
 * head, every figure in a chip's list and what the next write of the address carries. The text
 * being typed is this component's own while it is typed, so a keystroke never waits on the
 * address; everything else is the address's.
 *
 * WHAT THE HEAD COUNTS. The figure alone while nothing narrows, and the document lists'
 * `N of M` once anything does, `M` being every item on the job (#520) — the job is where the
 * list stands rather than a narrowing of it. A band that empties the list says so where the
 * rows stood, naming what was typed, with one control that clears the search alone when that
 * is all that narrows and everything otherwise (`emptiedListWords`); no pager stands under it.
 *
 * THE HEAD HOLDS THE JOB'S CHIP AND THE OPENERS. `jobs` are the jobs the chip offers, for a
 * reader on several, and the chip is drawn here so it can carry what the band holds to the job
 * chosen; `catalog` is the office's way to the catalog (#527) and `opener` a site manager's, each
 * drawn by the page, which reads what it needs.
 *
 * ON ALL OF A READER'S JOBS THE BAND GAINS A `Job` CHIP (1a, #548), after `Category`: the jobs the
 * rows have an asset on, by their codes, each with how many rows it would leave, several taken at
 * once. `allJobs` is the page's answer and `jobs` what the chip may offer. It narrows rows in hand
 * as the other chips do, adding up each row's counts on the jobs taken, and rides the address as
 * more `job` values after `all`, read here with `getAll` beside the band's own reader, which the
 * catalog's page shares and which therefore reads no `job`. A move to one job leaves it behind.
 */
export default function AssetCategoryList({ rows, job, allJobs = false, jobs, catalog, opener }) {
    const params = useSearchParams();
    const asked = readAssetListFilters(params);
    const [typed, setTyped] = useState(asked.q);
    const reading = filterAssetCategoryRows(
        rows,
        { ...asked, q: typed, jobs: allJobs ? params.getAll("job") : [] },
        { jobs: allJobs ? jobs : [] }
    );
    const page = pageOfAssetCategories(reading.rows, params.get("page"));

    const write = (filters, toPage = 1) => window.history.replaceState(null, "", assetCategoriesPath(toPage, job, filters));
    const search = (text) => {
        setTyped(text);
        write({ ...reading.held, q: text });
    };
    const choose = (facet, values) => write({ ...reading.held, [facet]: values });
    const clear = ({ clearsAll }) => {
        if (!clearsAll) return search("");
        setTyped("");
        write({});
    };

    const count = reading.narrowed ? FILTER_BAR_COPY.count(reading.rows.length, rows.length) : rows.length;
    const emptied = reading.rows.length === 0 ? emptiedListWords(reading) : null;

    return (
        <ListFrame
            header={
                <ListHeader title={COPY.heading} count={count} noun={COPY.itemNoun(reading.rows.length)}>
                    {jobs && <JobChoice jobs={jobs} job={job} filters={reading.held} />}
                    {catalog}
                    {opener}
                </ListHeader>
            }
            band={
                <>
                    <SearchField label={COPY.searchLabel} value={typed} onChange={search} clearLabel={COPY.clearSearch} />
                    {ASSET_LIST_FACETS.map((facet) => (
                        <FilterChip
                            key={facet}
                            label={COPY.facetLabel[facet]}
                            options={reading.facets[facet].map(({ value, count: held }) => ({ value, label: value, count: held }))}
                            values={reading.held[facet]}
                            onChange={(values) => choose(facet, values)}
                            clearLabel={COPY.clearFacet[facet]}
                            several={COPY.selectedCount}
                        />
                    ))}
                    {allJobs && (
                        <FilterChip
                            label={COPY.jobLabel}
                            options={reading.jobOptions.map(({ value, label, count: held }) => ({ value, label, count: held }))}
                            values={reading.held.jobs}
                            onChange={(values) => choose("jobs", values)}
                            clearLabel={COPY.clearJobs}
                            several={COPY.selectedCount}
                        />
                    )}
                </>
            }
            footer={
                !emptied && (
                    <Pager
                        range={COPY.range({ from: page.from + 1, to: page.to, total: page.total })}
                        position={pagerPosition(page)}
                        previous={{ onPress: page.page > 1 ? () => write(reading.held, page.page - 1) : undefined, label: COPY.previous }}
                        next={{ onPress: page.page < page.pageCount ? () => write(reading.held, page.page + 1) : undefined, label: COPY.next }}
                    />
                )
            }
        >
            <div role="table" aria-label={COPY.heading}>
                <div role="row" className={`${TABLE_HEAD} ${COLUMNS}`}>
                    <span role="columnheader">{COPY.nameLabel}</span>
                    {ASSET_STATUS_VALUES.map((status) => (
                        <span key={status} role="columnheader" className="text-right">
                            {status}
                        </span>
                    ))}
                </div>
                {page.rows.map((row) => (
                    <div key={row.id} role="row" className={`${TABLE_ROW} ${COLUMNS}`}>
                        {/* The name gives its room up last: the category beside it shrinks a
                            thousand times as fast, 20 after it at Ink 3 (1a). */}
                        <span role="cell" className="flex min-w-0 items-baseline gap-x-table-column-inline whitespace-nowrap">
                            <span className="min-w-0 shrink truncate">
                                <Link href={assetCategoryPath(row.id, 1, [], { job })} className={TABLE_ROW_LINK}>
                                    {row.itemName}
                                </Link>
                            </span>
                            {row.level2 && <span className="min-w-0 shrink-[1000] truncate text-foreground-subtle">{row.level2}</span>}
                        </span>
                        {/* Every status on every row, a zero included: an absent one
                            would read as "not known" where a `0` reads as "none", and a zero
                            takes Ink 3. The column head is the label, so a count is never
                            carried by color alone. */}
                        {row.counts.map((entry) => (
                            <span key={entry.status} role="cell" className={`text-right tabular-nums ${entry.count === 0 ? "text-foreground-subtle" : ""}`}>
                                {entry.count}
                            </span>
                        ))}
                    </div>
                ))}
            </div>
            {/* What a band that emptied the list says, under a Rule where the rows stood (1a). */}
            {emptied && (
                <div className="flex flex-col items-center gap-list-emptied-stack border-t border-divider py-list-emptied-inset-y text-center">
                    <p className="text-body">
                        {emptied.sentence}
                        {emptied.typed && (
                            <>
                                {" "}
                                <span className="font-id text-body-sm tracking-id">{emptied.typed}</span>
                            </>
                        )}
                    </p>
                    <Button variant="bordered" size="md" onClick={() => clear(emptied)}>
                        {emptied.clear}
                    </Button>
                </div>
            )}
        </ListFrame>
    );
}
