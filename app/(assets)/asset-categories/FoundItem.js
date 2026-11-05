"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Dot from "@/app/components/Dot";
import Icon from "@/app/components/Icon";
import { ASSET_LIST_COPY } from "@/lib/assetListView";
import { assetPath } from "@/lib/assetRoutes";
import { ASSET_STATUS } from "@/lib/assetStatus";
import StatusMark from "../StatusMark";
import { readFoundHolderAction } from "./actions";

/**
 * The way to the item the band's search found by its id (1a, #541): one line under the band, on
 * the Face inside its Edge at the Control's corner, 40 tall with 12 inside — the id in its face,
 * the item's name, its status with the mark 1d draws it with and, while it is out, who holds it,
 * a dot between each — and a 16 chevron in the Accent at its end, 16 from them at least. The
 * whole line is the way to the item's own page, and Enter in the search is too.
 *
 * EVERY LINE SAYS ITS ITEM'S JOB (#612), by its code after the name and behind the same dot, in
 * Ink 2 with tabular figures — 1d's job column's look, as 1a3's `Item ID` line draws it since the
 * files of 2026-11-02. `jobCode` is the job the item stands on, the list's own for an item in the
 * table and another for one the base named at another job or kept out by the band
 * (`lib/assetListView.js:readCategoryList`). From #599 to #612 only the second said it, on the
 * reading that the band already names the list's job.
 *
 * A SERIAL NUMBER SEARCHED SAYS ITSELF AFTER THE ID (1a3, #601): `Serial number` in Ink 3 and the
 * number at 14 with even figures, 8 apart — a maker's number, which the portal's id face is not for
 * since the files of 2026-11-04's afternoon (0h, #607) — `serialNumber` comes only with an item found by its number, in
 * the table or by the base — and a number two kinds hold draws a line for each.
 *
 * IT IS A WAY THERE AND NARROWS NOTHING. The row the item stands under is the list's, under it as
 * the band left it, and the export holds that row and every asset under it; this line is in no
 * sheet (`lib/assetListExport.js`).
 *
 * THE HOLDER IS ASKED FOR, AND THE REST IS IN HAND. The id, the name and the status come with the
 * rows the page read (`filterAssetCategoryRows`' `found`), so the line is drawn as the id is
 * typed; who holds an item that is out is on its latest log row, which the page does not read, so
 * this asks for it once per id it finds out while it stands (`readFoundHolderAction`) and says
 * `Out` alone until the answer, or for good when none comes. The name is the last thing on the
 * line, so its coming moves nothing before it.
 *
 * EACH ANSWER IS KEPT UNDER THE ID IT WAS ASKED FOR, AND AN ID IS ASKED ONCE. An answer landing
 * after the search moved to another id is drawn beside no other, whichever comes back first; and
 * an effect run twice for one id — React's development check runs every effect twice on mounting
 * — asks once, where the first build of this line asked twice and counted six operations.
 */
export default function FoundItem({ found }) {
    const { assetId, status, itemName, jobCode = null, serialNumber = null } = found;
    const [holders, setHolders] = useState({});
    const asked = useRef(new Set());
    useEffect(() => {
        if (status !== ASSET_STATUS.OUT || asked.current.has(assetId)) return;
        asked.current.add(assetId);
        readFoundHolderAction(assetId).then(
            (answer) => setHolders((was) => ({ ...was, [assetId]: answer?.holder ?? null })),
            () => {}
        );
    }, [assetId, status]);
    const holder = status === ASSET_STATUS.OUT ? (holders[assetId] ?? null) : null;

    return (
        <Link
            href={assetPath(assetId)}
            className="group flex h-found-item items-center gap-found-item-inline rounded-control border border-selected-border bg-selected px-found-item-inset-x text-body text-foreground-default outline-none hover:bg-selected-hover focus-visible:border-border-focus"
        >
            <span className="flex min-w-0 flex-1 items-center overflow-hidden whitespace-nowrap">
                <span className="shrink-0 font-id text-body-sm tracking-id">{assetId}</span>
                {/* Found by its serial number (1a3, #601): the value's name in Ink 3, then the number with
                    even figures (0h, #607), after the id and before the name. */}
                {serialNumber && (
                    <>
                        <Dot />
                        <span className="shrink-0 text-foreground-subtle">{ASSET_LIST_COPY.serialLabel}</span>
                        <span className="ml-gap shrink-0 tabular-nums">{serialNumber}</span>
                    </>
                )}
                <Dot />
                <span className="min-w-0 truncate">{itemName}</span>
                {jobCode && (
                    <>
                        <Dot />
                        <span className="shrink-0 text-foreground-muted tabular-nums">{jobCode}</span>
                    </>
                )}
                <Dot />
                <span className="flex shrink-0 items-center gap-gap text-foreground-muted">
                    <StatusMark status={status} />
                    <span className="flex items-baseline">
                        <span>{status}</span>
                        {holder && (
                            <>
                                <Dot />
                                <span>{holder}</span>
                            </>
                        )}
                    </span>
                </span>
            </span>
            <Icon name="chevron-right" className="size-icon shrink-0 text-primary group-hover:text-primary-hover" />
        </Link>
    );
}
