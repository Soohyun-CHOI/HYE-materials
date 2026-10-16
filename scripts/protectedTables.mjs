// The two tables no script writes (#531): `Assets` and `Asset Log` hold the site's records.
//
// WHY. From 2026-10-15 the assets on the base are the ones the sites registered and every
// `Asset Log` row is an event somebody performed — a check-out on a job, a check-in, a
// retirement. Nothing in this repository rebuilds them: a label printed for an asset points at
// its row, and an event is true of a moment that is gone. So the app's own screens are their
// one writer, and a script — a credentialed check, an import, a demo seed, a revert — that would
// create, update or delete a row of either, or rename or redescribe either table or its fields,
// asks this module first and stops before its first write. The check for a run's own fixtures
// does not change that: a fixture created in one of these tables is a row on the site's list
// for as long as the run lasts, and a run killed before its cleanup leaves it there.
//
// A TABLE THEY LINK TO IS REACHED THROUGH THEM WHEN IT IS EMPTIED. `Assets."Category"`,
// `Assets."Job"`, `Asset Log."Job"` and `Asset Log."Recorded By"` point at `Asset Categories`,
// `Jobs` and `Users`, and Airtable empties a link to a deleted row in the row that held it — so
// a run deleting every row of one of those (`wipe_base.mjs`) rewrites the two tables without
// naming them. A run deleting chosen rows of one asks itself whether any asset stands on them,
// as `replace_asset_catalog_528.mjs --remove` already does; a whole table emptied cannot.
//
// NO FLAG LETS A RUN PAST IT, and that is the point rather than an omission: a way round is a
// write waiting for the run that takes it. The day these tables stop being the site's records
// is a change to this module, made in its own commit.
//
// WHAT IT CANNOT SEE. It answers about the tables a script names to it; a script that writes
// without asking is caught by `offline/protected-tables.mjs`, which finds every script under
// `scripts/` naming either table or a writer of them and requires the question before the
// writes. Source order is not execution order, and that check says so where it holds it.
//
// IMPORTS NOTHING, so a script run with no loader — `scripts/import/`'s and `scripts/demo/`'s
// REST scripts — can import it, and so can the offline tier. The names are the base's, and the
// check holds them equal to `lib/airtable/client.js:TABLES`.

/** The tables no script writes: the site's assets and what has happened to them. */
export const PROTECTED_TABLES = Object.freeze(["Assets", "Asset Log"]);

/** The tables a protected row links to, which no script empties of every row. */
export const PROTECTED_LINK_TARGETS = Object.freeze(["Asset Categories", "Jobs", "Users"]);

/**
 * Whether a run must stop before its first write, saying so: `writes` are the tables it would
 * write a row or a schema change to, `wipes` the tables it would empty of every row. True when
 * either reaches a protected table — `wipes` a table one links to as well — after printing the
 * refusal through `log`; false, saying nothing, otherwise. The caller stops on true.
 */
export function refusesProtectedWrite({ script, writes = [], wipes = [], log = console.log }) {
    const reached = [
        ...new Set([
            ...writes.filter((table) => PROTECTED_TABLES.includes(table)),
            ...wipes.filter((table) => PROTECTED_TABLES.includes(table) || PROTECTED_LINK_TARGETS.includes(table)),
        ]),
    ];
    if (reached.length === 0) return false;
    log(`REFUSED, before any write: ${script} would write ${reached.join(" and ")}.`);
    log(
        "Assets and Asset Log hold the site's records since #531 — every item registered and every event " +
            "recorded against one — so no script writes, deletes or reshapes either, or empties a table they link to. " +
            "Nothing was written."
    );
    return true;
}
