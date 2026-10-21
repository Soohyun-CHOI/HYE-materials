// The demo's scripts reach the test base alone (#537).
//
// WHY. The demo's records — its jobs, its accounts, its vendors and addresses, the documents of the
// materials flow — were removed from the live base by `scripts/import/remove_demo_data_537.mjs`,
// which leaves the site's real records alone there, and they stay on the test base for checking
// changes. Every script in this directory seeds that demo, empties it or rebuilds it, so on the live
// base one would put the demo back among the real records, or — `wipe_base.mjs`, `reset_demo.mjs` —
// empty the real documents with it. Each asks this module as its first statement and stops on true.
//
// JUDGED BY THE BASE THE RUN RESOLVES (#534). `lib/airtableBase.js` reads the same environment the
// client and every REST script here resolve their base from, so the answer is the base the run's
// own writes would reach. A run that cannot resolve one — a missing key — is refused as well: a run
// that cannot say where it writes is held as though it wrote to the live one, as
// `scripts/protectedTables.mjs` holds it.
//
// NO FLAG LETS A RUN PAST IT, for that module's reason: a way round is a write waiting for the run
// that takes it. The day the live base wants a demo again is a change to this module.
//
// TWO SCRIPTS HERE DO NOT ASK, and `offline/demo-test-base-only.mjs` names them with why:
// `mint_session.mjs` makes one sign-in row, a browser walk's way in on either base, and
// `make-invoice-pdf.mjs` reads an order and writes a file to disk. The helpers beginning `_` are
// imported by scripts that ask.
//
// IMPORTS ONE MODULE, `lib/airtableBase.js`, which imports nothing, so a REST script run with no
// loader imports this, and so does the offline tier.

import { resolveAirtableBase } from "../../lib/airtableBase.js";

/**
 * Whether a demo script must stop before it reads or writes anything, saying so: true on the live
 * base and on an environment that names no base it can reach, false on the test base. `env` is the
 * run's own unless a check hands it one.
 */
export function refusesLiveBase({ script, env = process.env, log = console.error }) {
    let base;
    try {
        base = resolveAirtableBase(env);
    } catch (error) {
        log(`REFUSED, before anything: ${script} cannot say which base it reaches — ${error.message}. Nothing was read or written.`);
        return true;
    }
    if (!base.live) return false;
    log(
        `REFUSED, before anything: ${script} writes the demo, and the live base (named by ${base.namedBy}) holds the site's ` +
            "records alone since #537 — the demo is the test base's. Nothing was read or written."
    );
    return true;
}
