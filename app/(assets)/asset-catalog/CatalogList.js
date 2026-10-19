"use client";

import { useSearchParams } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import Breadcrumb from "@/app/components/Breadcrumb";
import { Button, Checkbox, FilterChip, SearchField, ToggleChip } from "@/app/components/Controls";
import { ListFrameFill, SelectionBar } from "@/app/components/ListFrame";
import { ListHeader, Pager, TABLE_HEAD_FILL, TABLE_ROW_FILL, TABLE_ROW_LINK, TABLE_ROW_SELECTED } from "@/app/components/ListTable";
import { MenuButton } from "@/app/components/Menu";
import { useTooltip } from "@/app/components/Tooltip";
import { FILTER_BAR_COPY } from "@/lib/listFilters";
import { ASSET_CLASS_VALUES } from "@/lib/assetCategory";
import { ASSET_CATALOG_COPY as COPY, filterCatalogRows } from "@/lib/assetCatalog";
import {
    ASSET_LIST_COPY,
    ASSET_LIST_FACETS,
    pageOfAssetCategories,
    pagerPosition,
    pageSelection,
    readAssetListFilters,
    toggleAsset,
    togglePage,
} from "@/lib/assetListView";
import { ASSET_CATEGORIES_PATH, assetCatalogPath } from "@/lib/assetRoutes";
import { setAssetCategoriesClassAction } from "./actions";
import { EntryDialog, RemoveDialog } from "./CatalogDialogs";

// 1l's columns: the box, the name, which takes the room the rest leave, then the size, the
// maker, the part number, the category, the type, the class and how many items stand under the
// row, each at 1l's width, 20 apart — the widths of 2026-10-16, which laid the list on Fill.
const COLUMNS =
    "grid-cols-[var(--size-icon)_minmax(0,1fr)_var(--width-catalog-size)_var(--width-catalog-maker)_var(--width-catalog-part-number)_var(--width-catalog-category)_var(--width-catalog-type)_var(--width-catalog-class)_var(--width-catalog-items)]";

/** The columns in 1l's order, by what each holds. */
const COLUMN_ORDER = ["level3", "size", "maker", "partNumber", "level2", "level1", "assetClass", "assetCount"];

/** The cells after the name, each cut to its column with an ellipsis, the figures tabular. */
const CUT_CELLS = [
    { key: "size", figures: true },
    { key: "maker" },
    { key: "partNumber", figures: true },
    { key: "level2" },
    { key: "level1" },
    { key: "assetClass" },
];

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
 *
 * A VALUE ITS COLUMN CUTS SHOWS WHOLE ABOVE ITS CELL UNDER THE POINTER (1l): every column but the
 * count ends its text in an ellipsis, and the row hands the tooltip the cell the pointer is on.
 *
 * THE HEAD OPENS `New category` AND `Add to catalog`, AND A ROW'S NAME OPENS ITS EDIT (1l) — the
 * name a button whose box covers the row, as a link covers 1a's, named by the row's whole name.
 * Each opening mounts its dialog anew, so it starts from what it was opened on; the question
 * before a removal opens as the edit closes, after it in the tree, so it takes the row's name
 * for its opener and hands focus back there (`DialogFrame.js`).
 *
 * A BOX ON EVERY ROW SELECTS IT, AND THE SELECTION OUTLIVES A PAGE OR A NARROWING (1l, as 1d's
 * does): it is held here and not in the address, since nothing but `Set class` reads it and
 * that acts at once; a row the page no longer holds drops out of it. `Set class` gives every row
 * selected the class chosen and clears the selection; a press that wrote nothing says why in the
 * bar's own column.
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

    const [selected, setSelected] = useState([]);
    const selection = selected.filter((id) => rows.some((row) => row.id === id));
    const pageIds = page.rows.map((row) => row.id);
    const pageState = pageSelection(selection, pageIds);
    const notOnPage = selection.filter((id) => !pageIds.includes(id)).length;
    const [classRefusal, setClassRefusal] = useState(null);
    const [classing, startClassing] = useTransition();
    const reasonId = useId();
    const select = (next) => {
        setClassRefusal(null);
        setSelected(next);
    };
    const setClass = (assetClass) => {
        setClassRefusal(null);
        startClassing(async () => {
            const classed = await setAssetCategoriesClassAction(selection, assetClass);
            setClassRefusal(classed?.error ?? null);
            if (classed?.done) setSelected([]);
        });
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
                label={COPY.heading}
                // This page's box: its state is this page's alone, and a partly selected page
                // shows as mixed.
                columnHead={
                    <div role="row" className={`${TABLE_HEAD_FILL} ${COLUMNS}`}>
                        <span role="columnheader" className="flex self-center">
                            <Checkbox
                                label={ASSET_LIST_COPY.selectPage}
                                checked={pageState === "all"}
                                indeterminate={pageState === "some"}
                                onChange={() => select(togglePage(selection, pageIds))}
                            />
                        </span>
                        {COLUMN_ORDER.map((key) => (
                            <span key={key} role="columnheader" className={key === "assetCount" ? "text-right" : "truncate"}>
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
                // 1l's bar, 1d's own: the count, how many are on other pages, the way out, and `Set
                // class`, its menu opening above it.
                overlay={
                    <SelectionBar
                        shown={selection.length > 0}
                        label={COPY.selectionBar}
                        count={selection.length}
                        notOnPage={notOnPage}
                        words={{ count: ASSET_LIST_COPY.selectedCount, notOnPage: ASSET_LIST_COPY.notOnPage }}
                        clearLabel={ASSET_LIST_COPY.clearSelection}
                        onClear={() => select([])}
                        reason={classRefusal}
                        reasonId={reasonId}
                    >
                        <MenuButton
                            look="bordered"
                            label={COPY.setClass}
                            placement="above"
                            locked={classing}
                            items={ASSET_CLASS_VALUES.map((assetClass) => ({ key: assetClass, label: COPY.classOption(assetClass), onSelect: () => setClass(assetClass) }))}
                        />
                    </SelectionBar>
                }
                overlayShown={selection.length > 0}
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
                    <div key={row.id} role="row" {...tip.cutProps()} className={`${TABLE_ROW_FILL} ${COLUMNS} ${selection.includes(row.id) ? TABLE_ROW_SELECTED : ""}`}>
                        <span role="cell" className="flex self-center">
                            <Checkbox label={COPY.selectRow(row.itemName)} checked={selection.includes(row.id)} onChange={() => select(toggleAsset(selection, row.id))} />
                        </span>
                        {/* The name, which opens the row's edit across the whole row, and after it
                            a discontinued row's mark at 13 in Ink 3 (1l). */}
                        <span role="cell" className="flex min-w-0 items-baseline gap-gap whitespace-nowrap">
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
