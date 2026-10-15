"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import Breadcrumb from "@/app/components/Breadcrumb";
import { Button, FilterChip, SearchField, ToggleChip } from "@/app/components/Controls";
import Dot from "@/app/components/Dot";
import ListFrame from "@/app/components/ListFrame";
import { ListHeader, Pager, TABLE_HEAD, TABLE_ROW } from "@/app/components/ListTable";
import { FILTER_BAR_COPY } from "@/lib/listFilters";
import { ASSET_CATALOG_COPY as COPY, filterCatalogRows } from "@/lib/assetCatalog";
import { ASSET_LIST_COPY, ASSET_LIST_FACETS, pageOfAssetCategories, pagerPosition, readAssetListFilters } from "@/lib/assetListView";
import { ASSET_CATEGORIES_PATH, assetCatalogPath } from "@/lib/assetRoutes";

// 1l's columns: the name, which takes the room the rest leave, then the size, the maker, the
// part number, the category, the type, the class and how many items stand under the row, each
// at 1l's width, 20 apart.
const COLUMNS =
    "grid-cols-[minmax(0,1fr)_var(--width-catalog-size)_var(--width-catalog-maker)_var(--width-catalog-part-number)_var(--width-catalog-category)_var(--width-catalog-type)_var(--width-catalog-class)_var(--width-catalog-items)]";

/** The columns in 1l's order, by what each holds. */
const COLUMN_ORDER = ["level3", "size", "maker", "partNumber", "level2", "level1", "assetClass", "assetCount"];

/**
 * The catalog (1l, #527): the bar back to Tools & Equipment, the head with how many rows it
 * holds, the band that narrows them, the rows and the pager.
 *
 * EVERY ROW IS HERE, AND THE BAND NARROWS THEM IN THE BROWSER, as the category list's does
 * (`AssetCategoryList.js` has why): the page reads the whole table, so a chip, a search, the
 * toggle and a step to another page fetch nothing, and the address follows by
 * `history.replaceState`, read back by `useSearchParams`, so a reload and a copied link carry
 * what the band holds. **The band is 1a's, and so is its reading** — `readAssetListFilters` and
 * `filterAssetCategoryRows` under `lib/assetCatalog.js:filterCatalogRows` — with the toggle, read
 * here as the literal `1` the path writes.
 *
 * THE HEAD SCROLLS AWAY WITH THE BAND UNDER THE BAR, AND THE NAME COMES INTO THE BAR ONCE IT HAS
 * GONE (1l, as 1d draws a category's page): `Catalog`, and the head's `N of M` after a dot while
 * the band narrows.
 */
export default function CatalogList({ rows, groups }) {
    const params = useSearchParams();
    const asked = { ...readAssetListFilters(params), discontinued: params.get("discontinued") === "1" };
    const [typed, setTyped] = useState(asked.q);
    const reading = filterCatalogRows(rows, groups, { ...asked, q: typed });
    const page = pageOfAssetCategories(reading.rows, params.get("page"));

    const write = (filters, toPage = 1) => window.history.replaceState(null, "", assetCatalogPath(toPage, filters));
    const search = (text) => {
        setTyped(text);
        write({ ...reading.held, q: text });
    };
    const clearAll = () => {
        setTyped("");
        write({});
    };

    const count = reading.narrowed ? FILTER_BAR_COPY.count(reading.rows.length, reading.total) : reading.total;
    const emptied = reading.narrowed && reading.rows.length === 0;

    return (
        <ListFrame
            top={
                <Breadcrumb
                    levels={[{ label: ASSET_LIST_COPY.heading, href: ASSET_CATEGORIES_PATH }]}
                    title={
                        <>
                            {COPY.heading}
                            {reading.narrowed && (
                                <>
                                    <Dot />
                                    <span className="font-normal text-foreground-subtle tabular-nums">{count}</span>
                                </>
                            )}
                        </>
                    }
                />
            }
            header={<ListHeader title={COPY.heading} count={count} noun={ASSET_LIST_COPY.itemNoun(reading.rows.length)} underBreadcrumb />}
            band={
                <>
                    <SearchField label={COPY.searchLabel} value={typed} onChange={search} clearLabel={COPY.clearSearch} />
                    {ASSET_LIST_FACETS.map((facet) => (
                        <FilterChip
                            key={facet}
                            label={ASSET_LIST_COPY.facetLabel[facet]}
                            options={reading.facets[facet].map(({ value, count: held }) => ({ value, label: value, count: held }))}
                            values={reading.held[facet]}
                            onChange={(values) => write({ ...reading.held, [facet]: values })}
                            clearLabel={ASSET_LIST_COPY.clearFacet[facet]}
                            several={ASSET_LIST_COPY.selectedCount}
                        />
                    ))}
                    <ToggleChip
                        label={COPY.discontinuedOnly}
                        on={reading.held.discontinued}
                        onChange={(on) => write({ ...reading.held, discontinued: on })}
                        clearLabel={COPY.clearDiscontinued}
                    />
                </>
            }
            footer={
                reading.rows.length > 0 && (
                    <Pager
                        range={ASSET_LIST_COPY.range({ from: page.from + 1, to: page.to, total: page.total })}
                        position={pagerPosition(page)}
                        previous={{ onPress: page.page > 1 ? () => write(reading.held, page.page - 1) : undefined, label: ASSET_LIST_COPY.previous }}
                        next={{ onPress: page.page < page.pageCount ? () => write(reading.held, page.page + 1) : undefined, label: ASSET_LIST_COPY.next }}
                    />
                )
            }
        >
            <div role="table" aria-label={COPY.heading}>
                <div role="row" className={`${TABLE_HEAD} ${COLUMNS}`}>
                    {COLUMN_ORDER.map((key) => (
                        <span key={key} role="columnheader" className={key === "assetCount" ? "text-right" : "truncate"}>
                            {COPY.columns[key]}
                        </span>
                    ))}
                </div>
                {page.rows.map((row) => (
                    <div key={row.id} role="row" className={`${TABLE_ROW} ${COLUMNS}`}>
                        {/* The name, and after it a discontinued row's mark at 13 in Ink 3 (1l). */}
                        <span role="cell" className="flex min-w-0 items-baseline gap-gap whitespace-nowrap">
                            <span className="min-w-0 truncate">{row.level3}</span>
                            {row.discontinued && <span className="shrink-0 text-body-sm text-foreground-subtle">{COPY.discontinued}</span>}
                        </span>
                        <span role="cell" className="truncate tabular-nums">
                            {row.size}
                        </span>
                        <span role="cell" className="truncate">
                            {row.maker}
                        </span>
                        <span role="cell" className="truncate tabular-nums">
                            {row.partNumber}
                        </span>
                        <span role="cell" className="truncate">
                            {row.level2}
                        </span>
                        <span role="cell" className="truncate">
                            {row.level1}
                        </span>
                        <span role="cell" className="truncate">
                            {row.assetClass}
                        </span>
                        {/* A row nothing stands under says `0` in Ink 3, as 1a's counts do. */}
                        <span role="cell" className={`text-right tabular-nums ${row.assetCount === 0 ? "text-foreground-subtle" : ""}`}>
                            {row.assetCount}
                        </span>
                    </div>
                ))}
            </div>
            {/* What a band that emptied the list says, under a Rule where the rows stood (1l). */}
            {emptied && (
                <div className="flex flex-col items-center gap-list-emptied-stack border-t border-divider py-list-emptied-inset-y text-center">
                    <p className="text-body">{COPY.noneMatch}</p>
                    <Button variant="bordered" size="md" onClick={clearAll}>
                        {COPY.clearAll}
                    </Button>
                </div>
            )}
        </ListFrame>
    );
}
