# Inventory

Route: `/materials`
Who reaches it: an Admin, for every job, and a site manager, for the jobs they are
assigned to. Anyone else signed in reaches it and is told no job's inventory is open
to them.

## What it answers

Which job's materials do I want to look at? It is the way into a job's inventory and
nothing more: a reader with one job never sees it, and is taken straight to that
job's list.

## What it always carries

- The screen's name, `Inventory`.
- One entry per job the reader may open, by job code, with the job's name beside it,
  in job-code order. Each opens that job's list (`/materials/[jobCode]`).

## What it carries only sometimes

- **A reader with no job to open** reads one sentence saying so, and no list.
- **A closed job is listed** like an open one. Closing a job stops it being offered
  where a job is newly chosen; the material still at its addresses is still there and
  still issued and sent from.

## What must agree elsewhere

- The rail's `Inventory` item opens this screen, and is the current section on all
  three Inventory screens.
- Who may open a job here is who may open its list and record on it — one rule,
  `canAccessJobInventory`.
