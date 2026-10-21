"use client";

import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import Breadcrumb from "@/app/components/Breadcrumb";
import { Button, FilterChip, SearchField, ToggleChip } from "@/app/components/Controls";
import { ListFrameFill } from "@/app/components/ListFrame";
import { ListHeader, Pager, TABLE_HEAD_FILL, TABLE_ROW_FILL, TABLE_ROW_LINK } from "@/app/components/ListTable";
import { useTooltip } from "@/app/components/Tooltip";
import { FILTER_BAR_COPY } from "@/lib/listFilters";
import { ASSET_CATALOG_COPY as COPY, filterCatalogRows } from "@/lib/assetCatalog";
import { ASSET_LIST_COPY, ASSET_LIST_FACETS, pageOfAssetCategories, pagerPosition, readAssetListFilters } from "@/lib/assetListView";
import { ASSET_CATEGORIES_PATH, assetCatalogPath } from "@/lib/assetRoutes";
import { EntryDialog, RemoveDialog } from "./CatalogDialogs";

// 1l's columns since 2026-10-21 (0b Row): the name, then the size, the maker, the part number,
// the category, the type and how many items stand under the row, 20 apart. A table whose columns
// are compared row against row, so the three free-text columns and the name take a least width
// each and share what is left by weight, the name 2 and the others 1, and the size, the type and
// the count are fixed — every figure 1l's. The class stood between the type and the count, and a
// box before the name, from #527 until #552.
const COLUMNS =
    "grid-cols-[minmax(var(--min-width-catalog-name),2fr)_var(--width-catalog-size)_minmax(var(--min-width-catalog-maker),1fr)_minmax(var(--min-width-catalog-part-number),1fr)_minmax(var(--min-width-catalog-category),1fr)_var(--width-catalog-type)_var(--width-catalog-items)]";

// The table's least width, the columns at their least and the 20s between them (0b Row: "a
// table's least width lets the longest real value of every column show whole"), held by the head
// row and every row alike, so a lane narrower than it scrolls the two sideways together
// (`ListFrameFill`). Both rows are box-content, so it is their text's width, the 32 and the 36
// outside it.
const LEAST =
    "min-w-[calc(var(--min-width-catalog-name)+var(--width-catalog-size)+var(--min-width-catalog-maker)+var(--min-width-catalog-part-number)+var(--min-width-catalog-category)+var(--width-catalog-type)+var(--width-catalog-items)+6*var(--spacing-table-column-inline))]";

// The name's column holds at the table's start as it scrolls (0b Row): sticky, and pulled out
// over the row's 32 so its ground meets the window's edge; an opaque ground, white at rest and
// the row's Wash under the pointer, and a 1px Band at its end while the table stands scrolled.
const PINNED =
    "sticky left-0 z-1 -ml-page-gutter flex min-w-0 items-center self-stretch pl-page-gutter group-data-scrolled-sideways/fill:shadow-[1px_0_0_var(--color-divider-strong)]";

/** The columns in 1l's order, by what each holds. */
const COLUMN_ORDER = ["level3", "size", "maker", "partNumber", "level2", "level1", "assetCount"];

/** The cells after the name, each cut to its column with an ellipsis, the figures tabular. */
const CUT_CELLS = [{ key: "size", figures: true }, { key: "maker" }, { key: "partNumber", figures: true }, { key: "level2" }, { key: "level1" }];

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
 * A LIST ON FILL (1l since 2026-10-16, #538): the column's whole width, the bar, the head and the
 * band holding still and the rows scrolling between the column head and the pager
 * (`ListFrameFill`). From #527 to #538 it was 1d's shape at the 1080 measure, the head and the
 * band scrolling away under the bar and the name coming into the bar; Fill brings no name in.
 * Narrower than the table at its least, it scrolls sideways with the name's column held at its
 * start (1l since 2026-10-21, #552).
 *
 * A VALUE ITS COLUMN CUTS SHOWS WHOLE ABOVE ITS CELL UNDER THE POINTER (1l): every column but the
 * count ends its text in an ellipsis, and the row hands the tooltip the cell the pointer is on.
 *
 * THE HEAD OPENS `New category` AND `Add to catalog`, AND A ROW OPENS ITS EDIT (1l) — a press
 * anywhere on it, as 1l's row takes one, and its name a button named by the row's whole name,
 * which the keyboard and assistive tech reach. The name's held column is a box of its own for
 * what is positioned inside it, so the button's own box covers that column and the row takes
 * the press beside it. Each opening mounts its dialog anew, so it starts from what it was opened
 * on; the question before a removal opens as the edit closes, after it in the tree, so it takes
 * the row's name for its opener and hands focus back there (`DialogFrame.js`).
 *
 * NO ROW IS SELECTED. A box on every row selected it from #527, for `Set class` alone, which
 * gave every row selected one class; #552 took the class off the catalog, and the box, the
 * page's box and the selection bar went with the one act they were for, as 1l draws the list
 * since 2026-10-21.
 */
export default function CatalogList({ rows, groups }) {
    const params = useSearchParams();
    const asked = { ...readAssetListFilters(params), discontinued: params.get("discontinued") === "1" };
    const [typed, setTyped] = useState(asked.q);
    const reading = filterCatalogRows(rows, groups, { ...asked, q: typed });
    const page = pageOfAssetCategories(reading.rows, params.get("page"));

    // The dialog open, and the question, each mounted anew for an opening.
    const openings = useRef(0);
    const [entry, setEntry] = useState(null);
    const [entryShown, setEntryShown] = useState(false);
    const [removing, setRemoving] = useState(null);
    const [removeShown, setRemoveShown] = useState(false);
    const openEntry = (opened) => {
        openings.current += 1;
        setEntry({ ...opened, key: openings.current });
        setEntryShown(true);
    };
    const openRemove = (row) => {
        openings.current += 1;
        setEntryShown(false);
        setRemoving({ row, key: openings.current });
        setRemoveShown(true);
    };

    // A press on a row beside its name is a press on the name, which takes focus first, so the
    // edit hands focus back to it on closing as it does after a press on the name itself.
    const pressRow = (event) => {
        if (event.target.closest("button")) return;
        const name = event.currentTarget.querySelector("button");
        name?.focus();
        name?.click();
    };

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
    const tip = useTooltip({ placement: "above" });

    return (
        <>
            <ListFrameFill
                top={<Breadcrumb levels={[{ label: ASSET_LIST_COPY.heading, href: ASSET_CATEGORIES_PATH }]} />}
                header={
                    <ListHeader title={COPY.heading} count={count} noun={ASSET_LIST_COPY.itemNoun(reading.rows.length)} underBreadcrumb fill>
                        {/* 1l's two openers, 8 apart. */}
                        <div className="flex items-center gap-gap">
                            <Button variant="bordered" onClick={() => openEntry({ mode: "category" })}>
                                {COPY.newCategoryTitle}
                            </Button>
                            <Button onClick={() => openEntry({ mode: "add" })}>{COPY.addTitle}</Button>
                        </div>
                    </ListHeader>
                }
                band={
                    <>
                        <SearchField label={COPY.searchLabel} value={typed} onChange={search} clearLabel={COPY.clearSearch} />
                        {/* 1l draws each chip's list as a lane of its own up to 340, where 1a's
                            never scroll: the catalog offers every category its groups hold (#555). */}
                        {ASSET_LIST_FACETS.map((facet) => (
                            <FilterChip
                                key={facet}
                                label={ASSET_LIST_COPY.facetLabel[facet]}
                                options={reading.facets[facet].map(({ value, count: held }) => ({ value, label: value, count: held }))}
                                values={reading.held[facet]}
                                onChange={(values) => write({ ...reading.held, [facet]: values })}
                                clearLabel={ASSET_LIST_COPY.clearFacet[facet]}
                                several={ASSET_LIST_COPY.selectedCount}
                                lane="max-h-catalog-filter-list"
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
                label={COPY.heading}
                // The name's head is held at the start with the name's column, on the head's own
                // Sticky ground at rest and on white once the table scrolls under it (0b Row).
                columnHead={
                    <div role="row" className={`${TABLE_HEAD_FILL} ${COLUMNS} ${LEAST}`}>
                        {COLUMN_ORDER.map((key) => (
                            <span
                                key={key}
                                role="columnheader"
                                className={
                                    key === "level3"
                                        ? `${PINNED} group-data-scrolled-sideways/fill:bg-white`
                                        : key === "assetCount"
                                          ? "text-right"
                                          : "truncate"
                                }
                            >
                                {COPY.columns[key]}
                            </span>
                        ))}
                    </div>
                }
                footer={
                    reading.rows.length > 0 && (
                        <Pager
                            fill
                            range={ASSET_LIST_COPY.range({ from: page.from + 1, to: page.to, total: page.total })}
                            position={pagerPosition(page)}
                            previous={{ onPress: page.page > 1 ? () => write(reading.held, page.page - 1) : undefined, label: ASSET_LIST_COPY.previous }}
                            next={{ onPress: page.page < page.pageCount ? () => write(reading.held, page.page + 1) : undefined, label: ASSET_LIST_COPY.next }}
                        />
                    )
                }
                // What a band that emptied the list says, under a Rule where the rows stood (1l).
                empty={
                    emptied && (
                        <div className="flex flex-col items-center gap-list-emptied-stack border-t border-divider py-list-emptied-inset-y text-center">
                            <p className="text-body">{COPY.noneMatch}</p>
                            <Button variant="bordered" size="md" onClick={clearAll}>
                                {COPY.clearAll}
                            </Button>
                        </div>
                    )
                }
            >
                {page.rows.map((row) => (
                    <div
                        key={row.id}
                        role="row"
                        {...tip.cutProps()}
                        onClick={pressRow}
                        className={`group/row cursor-pointer ${TABLE_ROW_FILL} ${COLUMNS} ${LEAST}`}
                    >
                        {/* The name, held at the table's start, and after it a discontinued row's
                            mark at 13 in Ink 3 (1l). */}
                        <span role="cell" className={`${PINNED} gap-gap whitespace-nowrap bg-white group-hover/row:bg-pinned-column-hover`}>
                            <span data-cut="" className="min-w-0 truncate">
                                <button
                                    type="button"
                                    aria-label={COPY.editRow(row.itemName)}
                                    onClick={() => openEntry({ mode: "edit", row })}
                                    className={`${TABLE_ROW_LINK} cursor-pointer text-left`}
                                >
                                    {row.level3}
                                </button>
                            </span>
                            {row.discontinued && <span className="shrink-0 text-body-sm text-foreground-subtle">{COPY.discontinued}</span>}
                        </span>
                        {CUT_CELLS.map(({ key, figures }) => (
                            <span key={key} role="cell" className="min-w-0">
                                <span data-cut="" className={`block truncate ${figures ? "tabular-nums" : ""}`}>
                                    {row[key]}
                                </span>
                            </span>
                        ))}
                        {/* A row nothing stands under says `0` in Ink 3, as 1a's counts do. */}
                        <span role="cell" className={`text-right tabular-nums ${row.assetCount === 0 ? "text-foreground-subtle" : ""}`}>
                            {row.assetCount}
                        </span>
                    </div>
                ))}
            </ListFrameFill>
            {tip.element}
            {entry && (
                <EntryDialog
                    key={entry.key}
                    entry={entry}
                    open={entryShown}
                    onClose={() => setEntryShown(false)}
                    onRemove={openRemove}
                    rows={rows}
                    groups={groups}
                />
            )}
            {removing && <RemoveDialog key={removing.key} row={removing.row} open={removeShown} onClose={() => setRemoveShown(false)} />}
        </>
    );
}
