import { Fragment } from "react";
import { NoteEmphasis } from "@/app/components/Controls";
import Dot from "@/app/components/Dot";
import { ASSET_CATEGORY_COPY as COPY, pathOf } from "@/lib/assetCategory";

/**
 * What a category is, in the caption under its name (#507): its class and where it sits in the
 * catalog — `Class A · DEMO Power Tools > DEMO Angle Grinder > 4-1/2"` — under a category's own
 * heading, and on an asset's page under the id and the job at a desk and under the name
 * on a phone. A caption is 0e's word for the line a record says under its title.
 *
 * THE PATH REPEATS THE NAME'S TWO PARTS, AND THAT IS WHAT IT SAYS THAT THE NAME DOES NOT. A
 * category is named `{Level 2} {Size}` with a space between, so the name cannot say where its
 * tool ends and its size begins — `Torque Wrench 1/2" Drive` — or which category holds it;
 * the path says each level as the catalog holds it. Design is drawing the caption; this is
 * the record header's line under its title, the closest the app draws (0n).
 *
 * A PART THE CATEGORY LACKS IS LEFT OUT, AND WITH NEITHER THERE IS NO CAPTION. Every category a
 * registration may pick has its three levels and a class, so a gap here is a row the office
 * emptied after its items were added; no word stands in for it, and the creation script is
 * where such a row is reported.
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
