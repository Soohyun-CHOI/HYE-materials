import { Fragment } from "react";
import Dot from "@/app/components/Dot";

/**
 * What a category is, in the caption under its name — its type and its category,
 * `Tool · Power tools`, the design's since #519 (1d, 1f, 1j) — under a category's own
 * heading, and on an asset's page led by the asset's id at a desk and alone under the name on
 * a phone. A caption is 0e's word for the line a record says under its title.
 *
 * THE TWO THE NAME DOES NOT SAY, AND NOTHING THE NAME SAYS. A category is named
 * `{Level 3} {Size}, {Maker} ({Part Number})`, so its name, size, maker and part number are
 * on the line above already; the caption says the type and the category, which no name holds.
 * It said the whole path from #507 to #519 — `Class A · Tool > DEMO Machining > DEMO Angle
 * Grinder > 4-1/2" > DEMO Makita > GA4570`, the class first — the closest the app drew until the
 * design drew the line, and the class after the category from #519 until #552 took it off the
 * catalog (`Tool · Power tools · Class B`).
 *
 * THE VALUES IN INK AGAINST THE LINE'S INK 3, AND IN INK 2 ON A PHONE (1j), whose caption
 * draws them a step lighter under its 22 title; the dots are the dates' and the history's
 * (`Dot`), 9 either side. `lead` is what stands first — the asset's id at a desk, which the
 * page hands over in its own face.
 *
 * A PART THE CATEGORY LACKS IS LEFT OUT, AND WITH NOTHING THERE IS NO CAPTION. Every category a
 * registration may pick has its type and its category, so a part left out is a row filed under
 * no group since its items were added; no word stands in for it, and the catalog's check
 * (`scripts/import/classify_asset_categories_514.mjs`) is where such a row is reported.
 */
export default function CategoryCaption({ category, lead = null, className = "" }) {
    // A value in Ink against the line's Ink 3, and in Ink 2 below the phone's edge (1j). It was
    // `Controls.js`'s `NoteEmphasis` from #507, read by this caption alone, until the phone's
    // ink made it the caption's own: a control module draws no phone size outside a sheet.
    const value = (text) => <span className="text-foreground-default tabular-nums max-sm:text-foreground-muted">{text}</span>;
    const parts = [lead, category?.level1 ? value(category.level1) : null, category?.level2 ? value(category.level2) : null].filter(Boolean);
    if (parts.length === 0) return null;
    return (
        <p className={className}>
            {parts.map((part, index) => (
                <Fragment key={index}>
                    {index > 0 && <Dot />}
                    {part}
                </Fragment>
            ))}
        </p>
    );
}
