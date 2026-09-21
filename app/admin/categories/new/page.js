import { requireAdmin } from "@/lib/authz";
import { getCategoryTree } from "@/lib/airtable/materialCategories";
import { CATEGORY_CREATION_COPY as COPY } from "@/lib/categoryCreation";
import { withOpsLabel } from "@/lib/airtableOps";
import CategoryForm from "./CategoryForm";

export const metadata = { title: COPY.heading };

/**
 * Adding a path to the catalog (#368) — the fourth `/admin` create form, and the
 * first screen in this app that writes a `Material Categories` row.
 *
 * ADMIN, AND `/addresses/new` IS THE CONTRAST RATHER THAN THE PRECEDENT. Gating
 * something to Admin scopes it to the OFFICE rather than to a higher trust tier
 * (CLAUDE.md), and the catalog is the office's the way a job code and a vendor
 * are: #384 put address creation outside `/admin` because where material goes is
 * the site's own fact, and the tree HQ maintains is the opposite — the site asks
 * for a path and the office adds it. **There is deliberately no path to this
 * screen from inside the request form**: a requester who cannot find a category
 * asks, and a requester who can edit the catalog is a different job.
 *
 * ONE READ, EIGHT OPERATIONS, AND IT IS THE READ `/prs/new` ALREADY MAKES.
 * `getCategoryTree` is the whole catalog in one query at Airtable's 100-record
 * page, bounded by the tree rather than by anything the company accumulates — and
 * it is what lets this form narrow to a parent, list the level-3 children that
 * parent already has, draft the item name and warn about a name that is taken, all
 * without a request per keystroke. The tree goes to a Client Component, which is
 * the same shape and the same cost that screen pays.
 *
 * NO `searchParams`, WHICH IS THE ONE PLACE THIS DIVERGES FROM ITS THREE SIBLINGS.
 * They redirect to `?created=…` and read the confirmation back off the URL — three
 * of the four screens `offline/url-parameters.mjs` records as keeping a line
 * because their action lands on no document. A category has no detail screen
 * either, so the same reasoning applies; what differs is the mechanism, and
 * `/addresses/new` (#384) is the newer answer: the action RETURNS what it wrote and
 * the form renders it, so nothing outlives the sentence in an address bar (#321).
 *
 * The column is its siblings' — the same narrow centered shell the three
 * `/admin` creates use. The path this screen previews is a sentence and wraps like
 * one; nothing here decides a width the design pass has not.
 */
export default async function NewCategoryPage() {
    return withOpsLabel("/admin/categories/new", () => renderNewCategoryPage());
}

async function renderNewCategoryPage() {
    const { authorized } = await requireAdmin();
    if (!authorized) {
        return (
            <div className="flex flex-1 items-center justify-center p-8">
                <p>{COPY.notAdmin}</p>
            </div>
        );
    }

    const categories = await getCategoryTree();

    return (
        <div className="mx-auto w-full max-w-sm p-8">
            <h1 className="text-2xl font-semibold">{COPY.heading}</h1>
            <p className="mt-2 text-sm text-zinc-600">{COPY.intro}</p>

            <CategoryForm categories={categories} />
        </div>
    );
}
