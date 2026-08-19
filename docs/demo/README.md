# Demo

What this directory holds, and the order things run in.

`runbook.md` is the thing to have open while presenting: six acts, one screen at a
time, with the exact values to type. Everything else here is setup.

## The scripts

All three live in `scripts/demo/` and all three take the same two flags
(`--env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs`).

| Script | What it does |
|---|---|
| `wipe_base.mjs` | Empties every table except `Users`, children first. Dry run unless `--confirm`. |
| `seed_full_demo.mjs` | Builds the whole demo set. Bootstraps its own Job, Line, vendors and addresses, so it runs on an empty base. `--cleanup` removes what it made; `--only=NAME,NAME` narrows both. |
| `mint_session.mjs` | Prints a sign-in link for an account with no mailbox. |

`seed_demo_fixtures.mjs` still exists and still runs on its own, but the full seed
calls its `ensureDemoFixtures()` — you do not need to run it first.

## Rebuilding from nothing

```bash
node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/demo/wipe_base.mjs --confirm
```

```bash
node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/demo/seed_full_demo.mjs
```

About ten minutes, most of it real purchase-order generation. Re-running the seed
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
