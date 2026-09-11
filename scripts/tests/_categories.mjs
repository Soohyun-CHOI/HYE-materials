// The catalog slice a verification fixture draws from (#356).
//
// WHY THE CREDENTIALED TIER NEEDED ONE AT ALL. #355 made a request item's
// identity a picked `Category`, and #358 taught every script in `scripts/demo/`
// to pick one — but its scope was that directory, so the twelve scripts under
// `scripts/tests/` went on typing item names. That was survivable while
// `upsertMaterial` still keyed on the name; #356 keys it on the category, so a
// fixture without one now produces either a throw (`upsertMaterial`) or an
// ordered item the item axis never sees (`refreshMaterialsCacheForPO` skips it
// and reports `no Category`). The second is the dangerous half: the script's
// own subject still passes and the material it was asserting about is simply
// not there.
//
// ONE BRANCH, AND IT IS DISJOINT FROM EVERY DEMO SEED'S. `_seed_categories.mjs`
// gives each seed a level-1 branch of its own because two scenarios sharing a
// material become each other's delivery candidates (#18). The same argument
// applies across the tier boundary and adds one of its own: a verification run
// DELETES its fixtures, and `upsertMaterial` finds-or-creates — so a verify
// script reusing a demo seed's category would upsert onto the demo's own
// `Materials` row and then delete it. `scripts/demo/reset_demo.mjs` would put it
// back; nothing would say it had gone. Branch 17 is used by no seed.
//
// HARD-CODED FOR THE SAME REASON THE SEEDS' ARE. A leaf code is unique across
// the tree and stable, `resolveVerifyCategories` throws on one the catalog does
// not have rather than quietly fixturing something else, and
// `offline/seed-categories.mjs` checks every code against the committed CSV — so
// a typo fails in CI rather than several hundred operations into a run.

import { getCategoriesByLeafCode } from "../../lib/airtable/materialCategories.js";

export { materialKeyFor } from "../demo/_seed_categories.mjs";

/**
 * Leaf codes under `17 Plumbing Piping Materials (Supply & Drain)`, in a fixed
 * order so a script can take "the first two" and mean the same two every run.
 *
 * Twelve is more than any one script uses. They are shared rather than
 * partitioned per script: the tier is human-initiated and one run at a time, and
 * every run deletes what it made, so two scripts naming the same category are
 * never on the base together — which is not true of the demo seeds, whose rows
 * are permanent and coexist.
 */
export const VERIFY_CATEGORY_CODES = Object.freeze([
    "1701003001", // Pipe Insulation > NBR/EPDM Elastomeric Foam > Tube Insulation
    "1701003002", // Pipe Insulation > NBR/EPDM Elastomeric Foam > Roll / Sheet
    "1701005001", // Pipe Insulation > Insulation Jacketing (Finish)
    "1701006001", // Pipe Insulation > Fiberglass Pipe Insulation
    "1701008001", // Pipe Insulation > Pipe Protection Cover
    "1701009001", // Pipe Insulation > Mineral Wool Insulation
    "1702003001", // Valve > Other
    "1704001003", // Pipe Support Materials > Pipe Hanger > Standard
    "1704001005", // Pipe Support Materials > Pipe Hanger > Clevis Hanger
    "1704002001", // Pipe Support Materials > Strut Framing System > Strut Channel
    "1704002002", // Pipe Support Materials > Strut Framing System > Bracket
    "1704003001", // Pipe Support Materials > Pipe Saddle > Saddle
]);

/**
 * The categories above, resolved in one query, in declared order.
 *
 * Throws on a code the catalog does not have, which is what makes hard-coding
 * safe — and `getCategoriesByLeafCode` throws again if two rows share a code,
 * so a fixture can never be built against an ambiguous path.
 */
export async function resolveVerifyCategories() {
    const byCode = await getCategoriesByLeafCode([...VERIFY_CATEGORY_CODES]);

    const missing = VERIFY_CATEGORY_CODES.filter((code) => !byCode.has(code));
    if (missing.length > 0) {
        throw new Error(
            `Material Categories: ${missing.length} leaf code(s) this fixture names are not in ` +
            `the catalog (${missing.join(", ")}). Load it with ` +
            `scripts/import/create_material_categories_354.mjs, or fix the codes in ` +
            `scripts/tests/_categories.mjs.`
        );
    }
    return VERIFY_CATEGORY_CODES.map((code) => byCode.get(code));
}
