"use client";

import { Choice, Field } from "@/app/components/Controls";
import { ASSET_LIST_COPY as COPY } from "@/lib/assetListView";

// The order a list stands in (#540), drawn the design's one way on the category list (1a), a
// kind's page (1d) and the catalog (1l): `Choice`'s sort, 0l's select-only combobox, named by the
// field's `Sort`, which it does not show, and showing the order it holds.
//
// WHAT IT OFFERS AND WHAT IT HOLDS ARE THE LIST'S: `list` is one of `lib/assetRoutes.js:LIST_SORTS`,
// whose options it offers in their order under `ASSET_LIST_COPY.sortNames`, and `sort` the order the
// list read off its address. What a choice does is the list's too — the category list and the
// catalog rewrite the address over rows already in hand, and a kind's page goes to its first page in
// the order chosen — so this only turns a pick into `onChange`. A pick of what it already holds does
// nothing, which is also what keeps a blur with the list open from writing anything: the pattern
// chooses what is under visual focus as focus leaves, the held order until the reader moves.
export default function SortChoice({ list, sort, onChange }) {
    const options = list.options.map((value) => ({ value, label: COPY.sortNames[value] }));
    return (
        <Field label={COPY.sortLabel} labelAs="span" labelHidden>
            <Choice
                look="sort"
                options={options}
                value={sort}
                onChange={(next) => {
                    if (next && next !== sort) onChange(next);
                }}
            />
        </Field>
    );
}
