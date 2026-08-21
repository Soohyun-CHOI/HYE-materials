# Demo

What this directory holds, and the order things run in.

`runbook.md` is the thing to have open while presenting: six acts, one screen at a
time, with the exact values to type. Everything else here is setup.

## Between rehearsals — the one command

A rehearsal leaves the base changed, not just fuller: Act IV's correction re-points
the over-delivered row onto the corrective order and clears its flag, and Act I's
approvals advance the signing chain. Neither rewinds, so the way back is a rebuild.
That is one command:

```bash
node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/demo/reset_demo.mjs --confirm
```

**Measured: 4m 13s, ~1,365 Airtable operations** (88 wipe, 1,262 seed, 15 check).
Without `--confirm` it is a dry run that reports what it would do and changes
nothing.

It runs the wipe, clears the Blob objects a script wrote, runs the seed, and then
reads the base back to check the four things a rehearsal moves — the over-delivery
is over again with no correction against it, the waiting invoice names no delivery,
the waiting delivery has no invoice, and its order is uninvoiced — plus that no record
outside the seed's own survived. Six checks; a failure exits 1.

**Two things to do after it finishes.** Sign in again — the wipe cleared Auth
Tokens and every session with them. And re-print the id table, because the ids
change on every rebuild:

```bash
node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/demo/seed_full_demo.mjs --only=NONE
```

## The scripts

All live in `scripts/demo/` and all take the same two flags
(`--env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs`).

| Script | What it does |
|---|---|
| `reset_demo.mjs` | Wipe, then seed, then check. Dry run unless `--confirm`. Calls the two below rather than reimplementing them, passing this run's node flags through. |
| `wipe_base.mjs` | Empties every table except `Users`, children first. Dry run unless `--confirm`. |
| `seed_full_demo.mjs` | Builds the whole demo set. Bootstraps its own Job, Line, vendors and addresses, so it runs on an empty base. `--cleanup` removes what it made; `--only=NAME,NAME` narrows both. |
| `mint_session.mjs` | Prints a sign-in link for an account with no mailbox. |
| `_demo_ids.mjs` | Which record belongs to which scenario. Read by the seed's id table and by the reset's check, so the two cannot disagree. |

`seed_demo_fixtures.mjs` still exists and still runs on its own, but the full seed
calls its `ensureDemoFixtures()` — you do not need to run it first.

## What the reset does not clean

**Vercel Blob keeps a rehearsal's abandoned uploads.** Every upload goes to Blob
first and is deleted once Airtable has ingested it, scheduled at the end of the
enclosing action — so abandoning a half-filled invoice form leaves the object
behind, because the action that would have cleaned it never finished.

The reset deletes the objects a *script* wrote (`LSP-`, `HYE-PO-`, and the older
seeds' prefixes) and leaves the rest alone. It cannot tell a rehearsal's upload
from anything else: every upload uses `addRandomSuffix: true` over the **original
filename**, so its pathname is whatever file was picked. Measured on this store,
100 of 156 objects match a script pattern and 56 do not — and among those 56 is a
48KB real vendor document somebody uploaded by hand, which is why the script
reports the remainder instead of guessing.

To clear them by hand:

```bash
npx vercel blob list
```

```bash
npx vercel blob del <url>
```

At ~3MB total this is not worth doing often. Nothing breaks if it is never done —
Airtable holds the copy of record, and an orphaned Blob object is referenced by
nothing.

## Rebuilding from nothing, step by step

`reset_demo.mjs --confirm` does both of these in order and checks the result. Run
them separately only when a step needs watching.

```bash
node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/demo/wipe_base.mjs --confirm
```

```bash
node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/demo/seed_full_demo.mjs
```

The seed is most of the time — 3–4 minutes of real purchase-order generation and
Blob ingest waits. Re-running the seed
creates nothing it already made, so an interrupted run finishes on the next attempt.

Then print the id table, which resolves every id from the base rather than from
what a run happened to create — so it prints the same thing on a run that made
nothing:

```bash
node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/demo/seed_full_demo.mjs --only=NONE
```

The **ids change every rebuild**. `runbook.md` names them, so re-print the table
above after any rebuild and reconcile before presenting.

## What the wipe does not restore

`Users` is the one table the wipe spares, because it is the one nothing can
rebuild: a row appears as a side effect of a first magic-link sign-in and in no
other way. That includes `authz-fixture@` and `scoped-fixture@`, which the
authorization checks and Act VI both need.

The 36 real company jobs are deleted and come back from
`scripts/import/import_jobs.py --folder ./data`, which reads the six Excel files
in the repo. It writes Job Code, Job Name and Business Unit only — no PIC, no
manager, no address, no Lines — and it skips any code off the `##-USA-@@`
pattern, which is why it never touches the demo Job.

## Verified

Every state named in `runbook.md` was opened in a browser on this data. Where a
state turned out not to render, the seed was fixed and the state re-checked; six
such cases are recorded in the runbook's Appendix B along with three that cannot
be shown at all and why.
