"use client";

import {
    CATEGORY_PICKER_COPY,
    narrowCategories,
    pickCategoryLevel,
} from "@/lib/materialCategory";

/**
 * One item row's category, picked through the four ordered levels of HQ's tree
 * (#355), on both screens that reach an item (#367).
 *
 * WHY IT IS A COMPONENT RATHER THAN A SECOND COPY OF THE JSX. #355 put this
 * inline in `app/prs/new/PRForm.js`, which was right for one screen; #367 gives
 * the signer's edit form the same control, and the issue's own requirement is
 * that the signer reaches an item the way the requester did. Two copies of forty
 * lines would be two screens drifting apart one class at a time — the failure
 * the requirement is about — so the picker moved and both forms render this.
 *
 * WHAT IT OWNS IS THE CONTROL, AND THE RULES STAY IN `lib/materialCategory.js`:
 * `narrowCategories` decides what each level may offer, `pickCategoryLevel`
 * clears the deeper levels, and every word comes from `CATEGORY_PICKER_COPY`.
 * That module imports nothing, which is what lets a `"use client"` file read the
 * same rule the server writes with (CLAUDE.md, client bundle safety) and what
 * lets the offline tier call it — this file it cannot load at all.
 *
 * IT HOLDS NO STATE. `codes` comes in and a new four-code array goes out, so the
 * two forms keep their own row state in their own shapes and neither has to know
 * how a level is cleared.
 */

// The picker's own look, rather than a class threaded in from each form: it is
// one control on two screens and a restyle should reach both from one place.
const selectClass = "rounded border border-zinc-300 px-2 py-1";

export default function CategoryPicker({ categories, codes, itemName, hadCategory, onChange }) {
    // Recomputed per render rather than stored: it is a pure function of the
    // fetched tree and four codes, so caching it would be a second copy of the
    // same answer.
    const walk = narrowCategories(categories, codes);
    const nothingPicked = !(codes || []).some(Boolean);

    // The three states below the pickers are exclusive, and only one of them is
    // about a complete path. `cleared` and `fromBeforeTheCatalog` differ by
    // whether this row ever had a category — see CATEGORY_PICKER_COPY, where
    // showing the second for the first is the copy defect #367 closed.
    const note = walk.complete
        ? { className: "text-zinc-700", text: CATEGORY_PICKER_COPY.resolved(walk.selected.label).text }
        : nothingPicked && hadCategory && itemName
          ? { className: "text-amber-800", text: CATEGORY_PICKER_COPY.cleared(itemName).text }
          : nothingPicked && itemName
            ? {
                  className: "text-amber-800",
                  text: `${CATEGORY_PICKER_COPY.fromBeforeTheCatalog.text} ${itemName}`,
              }
            : null;

    return (
        <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                {walk.levels.map((level, depth) => (
                    <select
                        key={depth}
                        aria-label={CATEGORY_PICKER_COPY.levels[depth]}
                        value={level.chosen}
                        disabled={level.options.length === 0}
                        onChange={(e) => onChange(pickCategoryLevel(codes, depth, e.target.value))}
                        className={selectClass}
                    >
                        <option value="">
                            {level.options.length === 0
                                ? CATEGORY_PICKER_COPY.awaitingParent(depth).text
                                : CATEGORY_PICKER_COPY.levels[depth]}
                        </option>
                        {level.options.map((option) => (
                            <option key={option.code} value={option.code}>
                                {option.name}
                            </option>
                        ))}
                    </select>
                ))}
            </div>
            {note ? <p className={`mt-2 text-sm ${note.className}`}>{note.text}</p> : null}
        </>
    );
}
