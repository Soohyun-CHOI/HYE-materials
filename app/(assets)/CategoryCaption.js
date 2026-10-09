import { Fragment } from "react";
import { NoteEmphasis } from "@/app/components/Controls";
import Dot from "@/app/components/Dot";
import { ASSET_CATEGORY_COPY as COPY, pathOf } from "@/lib/assetCategory";

/**
 * What a category is, in the caption under its name (#507): its class and where it sits in the
 * catalog — `Class A · Tool > DEMO Machining > DEMO Angle Grinder > 4-1/2" > DEMO Makita >
 * GA4530` — under a category's own heading, and on an asset's page under the id and the job
 * at a desk and under the name on a phone. A caption is 0e's word for the line a record says
 * under its title.
 *
 * THE PATH REPEATS THE NAME'S PARTS, AND THAT IS WHAT IT SAYS THAT THE NAME DOES NOT. A
 * category is named `{Level 3} {Size}, {Maker} ({Part Number})` with spaces between, so the
 * name cannot say where its name ends and its size begins — `Torque Wrench 1/2" Drive` — nor
 * where its maker ends and its part number begins, nor which category or type holds it; the path says each level as the catalog holds it, the
 * type first since #514, which is where a page says whether a kind is equipment or a tool.
 * Design is drawing the caption; this is the record header's line under its title, the
 * closest the app draws (0n).
 *
 * A PART THE CATEGORY LACKS IS LEFT OUT, AND WITH NEITHER THERE IS NO CAPTION. Every category a
 * registration may pick has its type, its category, its name and a class, and a size, a maker
 * and a part number only where they apply, so a level left out is either one of those three
 * or a row the office emptied after its items were added; no word stands in for it, and the
 * catalog's check (`scripts/import/classify_asset_categories_514.mjs`) is where such a row is
 * reported.
 */
export default function CategoryCaption({ category, className = "" }) {
    const path = pathOf(category);
    const assetClass = category?.assetClass ?? "";
    if (!assetClass && !path) return null;
    return (
        <p className={className}>
            {assetClass &&
                COPY.classOf(assetClass).map((part, index) =>
                    typeof part === "string" ? <Fragment key={index}>{part}</Fragment> : <NoteEmphasis key={index}>{part.emphasis}</NoteEmphasis>
                )}
            {assetClass && path && <Dot />}
            {path && <NoteEmphasis>{path}</NoteEmphasis>}
        </p>
    );
}
