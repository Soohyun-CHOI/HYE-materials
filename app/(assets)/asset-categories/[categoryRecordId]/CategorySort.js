"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { LIST_SORTS, assetCategoryPath, readAssetIds } from "@/lib/assetRoutes";
import SortChoice from "../../SortChoice";

// The order a category's own list stands in (1d, #540), at the foot of its head's controls: newest
// change first, where the page starts, or by printed id. A choice is a navigation to the first page
// in that order, since the page reads the kind's items and cuts the page it draws by the order —
// with a history entry, as the job's choice beside it makes. It keeps the job the list stands on
// and the label run selected (#443), read off the address here as `CategoryJobChoice.js` reads it,
// and for a reader who selects nothing (#506) no run, so a copied link's `id` does not ride it.
export default function CategorySort({ categoryRecordId, job, sort, selects }) {
    const router = useRouter();
    const params = useSearchParams();
    const selection = selects ? readAssetIds(params.getAll("id")) : [];
    return (
        <SortChoice
            list={LIST_SORTS.items}
            sort={sort}
            onChange={(next) => router.push(assetCategoryPath(categoryRecordId, 1, selection, { job, sort: next }))}
        />
    );
}
