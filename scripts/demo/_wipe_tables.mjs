// What `wipe_base.mjs` does with every table on the base: the ones it empties, in order, and the
// ones it keeps (#358).
//
// A MODULE OF ITS OWN SO THAT WHAT THE WIPE KEEPS IS SAID FROM ONE PLACE (#575). `wipe_base.mjs`
// empties ORDER and reads the kept tables back; `reset_demo.mjs` names the kept tables before it
// runs a wipe, and said "every table except Users" there from #358, when the wipe began keeping
// more, until it read these lists. Neither declares a list of its own, and
// `offline/wipe-coverage.mjs` holds both that and that every table is in one of the three.
//
// IT NAMES `Assets` AND `Asset Log` AND WRITES NOTHING. Both are kept, which is why they are here;
// `offline/protected-tables.mjs` classifies this file as one that lists them, and holds it to
// importing the client alone and calling nothing.

import { TABLES } from "../../lib/airtable/client.js";

/**
 * The deletion order, children before parents.
 *
 * `Users` IS ABSENT RATHER THAN FLAGGED, and the difference matters: a list with a
 * `skip: true` entry is one edit away from deleting the accounts, while a table that
 * is not in the list cannot be reached by the wipe at all. The assertion at the foot
 * of `wipe_base.mjs` checks these lists against `TABLES` so a table added later cannot
 * be silently missed either way.
 */
export const ORDER = [
    // The invoice side, deepest first.
    TABLES.INVOICE_ITEMS,
    TABLES.INVOICES,
    // The delivery side.
    TABLES.DELIVERY_ITEMS,
    TABLES.DELIVERIES,
    // The item axis. Prices before materials: a price row is keyed on a material and
    // a vendor, so clearing the cache first leaves nothing pointing at a gap.
    TABLES.MATERIAL_PRICES,
    TABLES.MATERIALS,
    // The order side.
    TABLES.PO_ITEMS,
    TABLES.PURCHASE_ORDERS,
    // The office's record of a purchase with no order behind it (#272), before the
    // request side: a row points AT the request a site raised from it, so clearing
    // it first leaves nothing pointing at a gap — the reason prices go before
    // materials above.
    TABLES.DIRECT_PURCHASES,
    // The request side and its history.
    TABLES.PR_EDIT_LOG,
    TABLES.PR_EDIT_REQUESTS,
    TABLES.QUOTATIONS,
    TABLES.PR_SIGNERS,
    TABLES.PR_ITEMS,
    TABLES.PURCHASE_REQUESTS,
    // Reference data. Jobs and Disciplines left #358 — see KEPT_FOR_THEIR_LINKS.
    TABLES.VENDORS,
    TABLES.ADDRESSES,
    // Independent of everything. Single-use and 15-minute-lived, so every row here is
    // either spent or stale.
    TABLES.AUTH_TOKENS,
];

/**
 * Tables the wipe cannot reach, each for a reason that is checkable rather
 * than remembered — the same standard the ORDER comments hold themselves to.
 *
 * `Users` is the original entry: an account appears as a side effect of a first
 * magic-link sign-in and in NO other way, so a deleted one comes back only when
 * that person signs in again.
 *
 * **THE OTHER FOUR WERE ADDED IN #358, AND FINDING THEM IS WHAT THAT ISSUE
 * ACTUALLY COST.** The assertion in `wipe_base.mjs` had failed since #334 put three
 * tools tables into `TABLES`, so that script exited 1 without deleting anything for
 * twenty-odd issues and nobody noticed, because nobody ran it. The guard did its
 * job; what was missing was anything that asks the question without a person
 * choosing to. `scripts/tests/offline/wipe-coverage.mjs` asks it in CI now.
 */
export const KEPT = [
    TABLES.USERS,
    // #354's catalog: 777 rows loaded from a committed CSV, plus whatever paths
    // have been added by hand since — and a hand-added path is in no file, so
    // rebuilding from the CSV would drop it silently. `materials.md` records
    // hand-adding as the normal way a path arrives, which is what makes this
    // reference data rather than demo data. Re-running the loader after a wipe
    // would also cost 78 write requests for rows that never changed.
    TABLES.MATERIAL_CATEGORIES,
    // The assets axis (#334-#362). `Asset Categories` is the office's catalog since
    // #517, revised by #528 from scripts/import/sources/asset_categories_528.csv,
    // and edited by hand after, a hand edit being in no file — so it is reference
    // data, as #354's is. `Asset Category Groups` (#528) is the same list's types
    // and categories, kept for the same reason: loaded from its own CSV and edited
    // by hand since, and a category waiting for its first item is in no file at
    // all. Its first reader is the catalog's page (#527).
    // An asset is registered through the app and is the row a printed label
    // points at, which nothing in this directory rebuilds. None of the four sits
    // on a screen the document demo shows, so clearing them would cost real work to
    // make a set of pages tidier that never render them.
    TABLES.ASSET_CATEGORIES,
    TABLES.ASSET_CATEGORY_GROUPS,
    TABLES.ASSETS,
    TABLES.ASSET_LOG,
];

/**
 * Kept because something else keeps a link INTO them, rather than for their own
 * sake — listed apart so the distinction survives the next reader.
 *
 * `Assets."Job"` is required and app-enforced, and `Asset Log."Job"` is on
 * every row and never blank. Deleting Jobs while keeping assets would leave
 * every asset and log row with a required link pointing at nothing, which is a
 * worse state than either wiping both or keeping both. `Disciplines` follows its
 * parent.
 *
 * Nothing in the document chain is left inconsistent by this: a request links a
 * discipline and a delivery links a job, and both of those go, so what survives
 * is a childless job and its childless discipline — exactly what
 * `seed_demo_fixtures.mjs` expects to find, since it is skip-if-exists.
 *
 * IT ALSO SAVES A ROW NO SEED MAKES. `26-DEMO-02` was created through
 * `/admin/jobs/new` in #338 and `seed_demo_fixtures.mjs` builds only
 * `26-DEMO-01`; `verification.md` records the second job as the only way to
 * exercise a picker with more than one choice. That is a consequence rather than
 * the reason, and it is written down so nobody removes the reason and keeps the
 * consequence by accident.
 */
export const KEPT_FOR_THEIR_LINKS = [TABLES.JOBS, TABLES.DISCIPLINES];
