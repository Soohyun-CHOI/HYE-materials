"use server";

import { withAdminAction } from "@/lib/authz";
import { createCategoryUnderLevel2 } from "@/lib/airtable/materialCategories";
import { CATEGORY_CREATION_COPY, planCategory } from "@/lib/categoryCreation";
import { withOpsLabel } from "@/lib/airtableOps";

/**
 * Add a path to the catalog (#368).
 *
 * REFUSES BY RETURNING `{ error }` BECAUSE THE CALL SITE BINDS (#185).
 * `CategoryForm.js` reads this through `useActionState`, so every refusal —
 * authorization included — lands in `state` and the form renders it in the one
 * slot it has. `/admin/jobs/new` and `/admin/vendors/new` throw for the opposite
 * reason: their pages hand the action straight to `<form action={…}>`, which
 * discards a return.
 *
 * THE JUDGMENT IS `planCategory` AND IT RUNS INSIDE THE LOCK, which is why it is
 * handed over as a callback rather than called here. It computes a code from the
 * rows under the chosen parent, so planning against rows read before the lock
 * would mean numbering against a tree another submission had already moved. See
 * `createCategoryUnderLevel2`.
 *
 * NOTHING IS RE-VALIDATED HERE, and that is the point of the pure module: the form
 * previews with the same function on the tree it loaded, and this runs it again on
 * what the base holds now. A second copy of any of it — which level 3 a name
 * resolves to, what a mark stores, which code is next — is the duplication
 * CLAUDE.md's own section is about, and the two would disagree about a submission
 * nobody would think to test.
 *
 * AN EMPTY `level2Code` COSTS ONE QUERY AND IS NOT GUARDED EARLIER, deliberately.
 * `orByField` answers a blank value with `FALSE()`, so the read comes back empty
 * and `planCategory` refuses for the right reason; a cheap guard here would be a
 * second spelling of that module's own missing-fields rule, for one operation on a
 * submission the form's `required` controls cannot make.
 *
 * THE THREE FACTS COME BACK SEPARATELY AND ARE WORDED HERE. The service module
 * builds no sentence — `createAddressIfLabelFree` draws the same line — so this is
 * where a taken name and a taken code become copy.
 */
export const createCategoryAction = withAdminAction(
    () => ({ error: CATEGORY_CREATION_COPY.notAuthorized }),
    async (prevState, formData) => {
        return withOpsLabel("createCategoryAction", async () => {
            const fields = {
                level1Code: formData.get("level1Code"),
                level2Code: formData.get("level2Code"),
                level3Choice: formData.get("level3Choice"),
                level3Name: formData.get("level3Name"),
                // A checkbox is absent from the payload when it is clear, so the
                // mark is the presence of a value rather than its content.
                level4NoDivision: formData.get("level4NoDivision") !== null,
                level4Name: formData.get("level4Name"),
                itemName: formData.get("itemName"),
            };

            const { category, refusal, existingName, takenCode } = await createCategoryUnderLevel2(
                String(fields.level2Code ?? ""),
                (rows) => planCategory(fields, rows)
            );

            if (refusal) return { error: refusal };
            if (existingName) {
                return {
                    error: CATEGORY_CREATION_COPY.nameTaken({
                        itemName: existingName.itemName,
                        label: existingName.label,
                    }),
                };
            }
            if (takenCode) return { error: CATEGORY_CREATION_COPY.codeTaken(takenCode) };

            return {
                itemName: category.itemName,
                code: category.codes[3],
                label: category.label,
            };
        });
    }
);
