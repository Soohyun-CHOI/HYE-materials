// How a demo seed picks a category, and how it proves it did (#358).
//
// WHY A SHARED MODULE RATHER THAN A FEW LINES IN EACH SEED. Seven scripts create
// request items today and an eighth will be written eventually; a rule copied
// into seven files teaches the eighth author nothing, because there is nothing
// to notice the absence of. A helper every seed CALLS is visible by its absence,
// and `scripts/tests/offline/seed-categories.mjs` reads the call sites and fails
// on a seed that creates items without going through it. That is
// `scripts/tests/_fixtures.mjs` and `offline/fixture-cleanup.mjs` one directory
// over, deliberately: the cleanup contract had the same problem and this is the
// shape that solved it.
//
// WHAT THE HOLE ACTUALLY IS. `createItem` accepts a row with no category and
// must keep doing so — a Draft saves without per-item validation (#72), and #355
// made a half-picked row a legitimate state a requester can save. So nothing in
// the service layer can refuse the shape a forgetful seed produces, and after
// #356 keys `upsertMaterial` on the category, such a row would generate a
// material with no identity at all. The refusal therefore lives where the
// knowledge is: this module knows how many category-less rows a seed MEANT to
// make, and the check knows the seed has to say.
//
// ONE LEVEL-1 BRANCH PER SEED, WHICH MAKES THE SCENARIO BOUNDARY STRUCTURAL.
// `seed_full_demo.mjs`'s own header records why scenarios must not share a
// material: allocation matches delivery candidates on the `Material` link (#18),
// so two scenarios on one material become each other's candidates and scramble
// the allocation each is trying to show. Identity is `Category` + `Size` + `Unit`
// after #356, so distinct categories are what keeps them apart — and giving each
// seed a whole branch means no two seeds can collide either, which the
// `NNN-DEMO ` name prefix used to do by putting a marker on every screen. The
// prefix went for the reason `seed_full_demo.mjs` states: the base's whole point
// is to be read by people who do not work here.
//
// THE CODES ARE HARD-CODED RATHER THAN CHOSEN AT RUN TIME, because
// `reset_demo.mjs` is run repeatedly between rehearsals and the seed prints a
// WHERE TO LOOK guide naming records. Two runs that pick different categories
// produce two different demos. A leaf code is unique across the tree and stable;
// one that has been deleted from the catalog makes `resolveSeedCategories` throw
// rather than quietly seeding something else.

import { getCategoriesByLeafCode } from "../../lib/airtable/materialCategories.js";
import { getItemsByPR } from "../../lib/airtable/prItems.js";

/**
 * The catalog slice each seed draws from, keyed by the seed's own filename.
 *
 * DISJOINT BY BRANCH, and the offline check asserts it rather than trusting the
 * comment: every code here is verified to be in the committed CSV and to appear
 * in exactly one list. A typo is therefore a failing check rather than a seed
 * that throws halfway through writing to the base.
 */
export const SEED_CATEGORIES = Object.freeze({
    // Stainless Steel (SUS) — 268 leaves, the widest branch, for the seed that
    // needs the most distinct scenarios.
    "seed_full_demo.mjs": Object.freeze([
        "0101001001", // Tube > SUS 304 > AP
        "0101002010", // Tube > SUS 316L > EP ERW
        "0102001017", // Pipe > SUS 304 > Machined / Fabricated
        "0102010006", // Pipe > A312-TP316L > Seamless SCH80
        "0103001002", // Elbow (Long) > SUS 304 > SCH10
        "0103002008", // Elbow (Long) > A403-WP304 > ERW SCH10
        "0103006009", // Elbow (Long) > A403-WP304L > Seamless SCH10
        "0104001009", // Tee > SUS 304 > PTFE Lined
        "0104007004", // Tee > A403-WP316 > Seamless SCH10
        "0105001003", // Concentric Reducer > SUS 304 > AP/MP
        "0105003001", // Concentric Reducer > A182-F304 > SW 3000LBS
        "0105015001", // Concentric Reducer > Structural Pipe (Tube) > Reducer
        "0106002001", // Union > A182 F304L > Socket Welding Type
        "0107008002", // Nipple > A312 TP304 > ERW SCH40
        "0107010004", // Nipple > A312 TP316 > Seamless SCH40
        "0108005009", // Flange > A182-F304 150# > Stub End
        "0108022004", // Flange > SUS 316L > EP Slip On / RF
        "0108030001", // Flange > PTFE Lined
        "0108042001", // Flange > SUS 304 Plate Flange, 10K > SORF (Slip-on/RF)
        "0109006012", // Ball Valve > A182 F304 (Forged) > Screw 600LBS
        "0109012015", // Ball Valve > A182 F316 (Forged) > SW 600LB
        "0111004002", // Check Valve > A351 CF8 > Flange 150LB
        "0113002004", // Globe Valve > A351 CF8 > BB OS&Y 150LBS
        "0114003002", // Butterfly Valve > Lug > 150LBS
        "0116001009", // LOK Fitting > Connector > CGA
        "0116004001", // LOK Fitting > Union
        "0116022002", // LOK Fitting > Plug & Cap > Cap
        "0118002001", // Diaphragm Valve > LOK > BA
        "0120001004", // Flexible & Bellows > Flexible Hose
        "0121005001", // Weld Fitting > Metal Face Seal (VCR)
        "0121005010", // Weld Fitting > Metal Face Seal (VCR)
        "0123003002", // Elbow (Short) > A403-WP304 > Seamless SCH10
        "0124003002", // 45D Elbow > A403-WP304 > Seamless SCH10
        "0125001003", // Reducing Tee > SUS 304 > SCH10
        "0125008003", // Reducing Tee > SUS 316L > EP
        "0127001001", // Cap Reducer > SUS 304 > AP/MP
        "0128002015", // Plug & Cap > Cap > SUS 316L
        "0131001003", // Bushing & Boss > Bushing > A182 F304L
        "0136002001", // Coupling > Full Coupling > A182 F304
        "0137002001", // Reducer Insert > A182 F304L > SW 3000LBS
        "0138002019", // Outlets > Welding Outlet > A182 F304 3000#
    ]),
    // Carbon Steel.
    "seed_delivery_status_166.mjs": Object.freeze([
        "0202007002", "0203001001", "0204001004", "0208003001", "0213003001",
        "0217005003", "0218002002", "0221005013", "0222004001", "0234001004",
        "0246002001",
    ]),
    // PVC.
    "seed_order_breakdown_237.mjs": Object.freeze([
        "0401005001", "0402001007", "0402002007", "0402004005", "0402005003",
        "0402009001", "0402009006", "0403001001", "0404004001", "0404018001",
        "0405004001",
    ]),
    // PP.
    "seed_overage_167.mjs": Object.freeze([
        "2301002001", "2301006004", "2301010003", "2301020002", "2302002003",
        "2302007001", "2303003001",
    ]),
    // Gasket.
    "seed_over_delivery_165.mjs": Object.freeze([
        "1401001001", "1401003006", "1402001003", "1406002003", "1412002001",
    ]),
    // Copper & Brass.
    "seed_material_prices.mjs": Object.freeze([
        "2501007001", "2503001001", "2504002002", "2504006001",
    ]),
    // Bolts / Nuts / Washers.
    "seed_po_backlog_176.mjs": Object.freeze([
        "3001001001", "3001005001", "3001009010", "3002004006",
    ]),
});

/**
 * The categories a seed's codes name, keyed by leaf code, in one query.
 *
 * Throws on a code the catalog does not have — which is what makes hard-coding
 * safe. A path deleted or renumbered in Airtable stops the seed before it writes
 * rather than after, and `getCategoriesByLeafCode` throws again if two rows
 * share a code.
 */
export async function resolveSeedCategories(leafCodes) {
    const wanted = Array.from(new Set(leafCodes));
    const byCode = await getCategoriesByLeafCode(wanted);

    const missing = wanted.filter((code) => !byCode.has(code));
    if (missing.length > 0) {
        throw new Error(
            `Material Categories: ${missing.length} leaf code(s) this seed names are not in the ` +
            `catalog (${missing.join(", ")}). Load it with ` +
            `scripts/import/create_material_categories_354.mjs, or fix the codes in ` +
            `scripts/demo/_seed_categories.mjs.`
        );
    }
    return byCode;
}

/**
 * One seed item, in the shape the seeds already pass around.
 *
 * IT KEEPS `itemName` ON PURPOSE, AND THAT IS ABOUT ORDERING RATHER THAN TASTE.
 * #358 landed before #356, so `getMaterialByKey` and `upsertMaterial` still keyed
 * the item axis on `Item Name` + `Size` + `Unit` — and a seed's skip check is
 * `getMaterialByKey(ITEM)`, which is how it knows it has run before. Filling the
 * name from the category's label kept every one of those working unchanged
 * while the link was written beside it, so that issue did not have to reach into
 * the material axis to change how a seed detects itself.
 *
 * #356 REKEYED IT, AND WHAT IT COST IS ONE MORE KEY ON THIS OBJECT rather than
 * the "nothing in these scripts moves" that sentence predicted. `itemName` is
 * still the frozen copy every item table keeps, so the seeds' `createItem` calls
 * are untouched — but the skip check now asks the base for a material by its
 * CATEGORY, so `categoryCode` is here for `getMaterialByKey(ITEM)` to destructure
 * and the four seeds that pass a literal instead of this object name the code
 * themselves. The prediction was right about the name and wrong about the
 * lookup, which is the distinction worth keeping: what a document FREEZES and
 * what identity is KEYED ON stopped being the same string in #356.
 *
 * `unit` defaults to `EA` because most seed rows do and a missing one is skipped
 * by the cache entirely (#18) — a unit-less item never reaches `/materials`,
 * which is usually not what a seed wanted.
 */
export function itemForCategory(category, { size = "", unit = "EA", ...rest } = {}) {
    return {
        itemName: category.label,
        categoryRecordId: category.recordId,
        // The leaf, which is what `Materials."Category Code"` holds and what
        // `getMaterialByKey` matches on (#356). Beside `categoryCodes` rather
        // than derived from it at each call site, so a seed passing this whole
        // object to either the write path or the lookup needs no adapter.
        categoryCode: category.codes[category.codes.length - 1],
        // BOTH REPRESENTATIONS, because a seed row stands in for a form row and
        // the two halves of the app hold a category differently: the write path
        // takes a record id, and `lib/prItemMerge.js:mergeKey` takes the four
        // level codes because that is what `PRForm` carries. A seed that had
        // only the record id would silently stop merging — `mergeKey` returns
        // null without a leaf code, so nothing would fold and no error would
        // say so. `seed_full_demo.mjs`'s DUP scenario asserts the merge and is
        // what caught this.
        categoryCodes: category.codes.slice(),
        size,
        unit,
        ...rest,
    };
}

/**
 * The key a seed's skip check hands `getMaterialByKey` (#356).
 *
 * A SEED KNOWS IT HAS RUN BEFORE BY FINDING ITS OWN MATERIAL, and identity is
 * `Category` + `Size` + `Unit` now, so the check asks by leaf code. Four seeds
 * build the key from a category rather than from an `itemForCategory` result —
 * they look a material up before they have an item in hand, or from a join key
 * that is a label — and this is here so `codes[3]` is written once. A seed
 * holding the item object passes that straight through instead; it carries the
 * same `categoryCode`.
 */
export function materialKeyFor(category, { size = "", unit = "EA" } = {}) {
    return { categoryCode: category.codes[category.codes.length - 1], size, unit };
}

/**
 * Prove the requests this seed made carry the categories it meant them to.
 *
 * THE COUNT IS THE ASSERTION AND `allowMissing` IS NOT AN ESCAPE HATCH. A seed
 * that means every row to have a category passes 0, which reads as a claim
 * rather than a waiver. A seed demonstrating the state #355 added to
 * `docs/briefs/prs-new.md` — a Draft row saved before the catalog existed, which
 * opens with nothing picked — passes the number it meant to leave and says why
 * in `why`. Anything else is the forgetful case this module exists to catch, and
 * the run fails before somebody reads the base and believes it.
 *
 * Reads one query per 50 requests through `getItemsByPR`, at the end of a run
 * that has already spent hundreds of operations.
 */
export async function assertItemsHaveCategories({ prRecordIds, allowMissing = 0, why = "" }) {
    const withoutCategory = [];
    for (const prRecordId of prRecordIds) {
        for (const item of await getItemsByPR(prRecordId)) {
            if (!item.category || item.category.length === 0) {
                withoutCategory.push(item.prItemId ?? item.id);
            }
        }
    }

    if (withoutCategory.length === allowMissing) {
        const note = allowMissing === 0 ? "" : ` (${allowMissing} deliberate: ${why})`;
        console.log(`  categories: every request item carries one${note}`);
        return;
    }

    throw new Error(
        `${withoutCategory.length} request item(s) have no Category and this seed allows ` +
        `${allowMissing}${why ? ` (${why})` : ""}: ${withoutCategory.join(", ")}. ` +
        `A row with no category generates a material with no identity once #356 keys the ` +
        `cache on it — pass its category through createItem, or say why it is deliberate.`
    );
}
