# Tools — the reasoning

Governs `lib/tool*.js`, and `app/tools/**` once #336 creates it. **Read this before editing there** — CLAUDE.md carries only the rules that bind code outside this area; the derivation, the evidence and the alternatives weighed are here.

The index row names only `lib/tool*.js` today, because `offline/notes-index.mjs` fails a glob matching nothing and there is no `app/tools/` yet. #336 widens the row in the commit that creates the route group.

`lib/airtable/tool*.js` is additionally governed by `airtable-access.md` and `naming.md`, as all of `lib/airtable/**` is.

## What this track is (#334)

The company buys drills, grinders and the like, hands them out to sites, and gets them back when a project ends. None of that is recorded anywhere today — the only account of where a tool is, is whoever remembers carrying it. Each physical tool gets a QR label; a scan on a phone moves it between `In Stock` and `Out`, and the app can then answer what is where.

**It is not a second product.** Same app, same domain, same Airtable base, same login, same `Users` and `Jobs` as everything on the materials axis. One difference, and it is a real one: a scan happens on a phone, on site, possibly by someone wearing gloves, so the tools screens assume a mobile width while every screen above them assumes a desk (#336).

**IT DOES NOT PASS THROUGH THE OFFICE, AND THAT IS THE FACT MOST OF THIS SCHEMA FOLLOWS FROM.** A site person buys the tool, registers it, keeps it and scans it. There is no purchase request, no approval chain and no invoice; nothing here is Admin-gated, and everyone who scans needs an account only because the scan records who performed it (#337). The materials axis is the opposite shape — an order the office places and reconciles — which is why almost nothing is shared between the two beyond people and jobs.

## Three tables, and what each is for

`Tools` is the KIND. `Tool Items` is the object. `Tool Log` is the history.

**A tool is bought BY THE KIND and tracked ONE AT A TIME.** A company buys six of the same drill and then needs six labels, six locations and six histories under one name that a person typed once. Folding the kind and the object into one table gives you either six rows repeating the name — which is how two spellings of one kind appear and a count splits in two — or one row that cannot say where any individual drill is.

**`Tools` takes no minted ID, the way `Vendors` and `Materials` take none.** Nothing prints a kind and nobody quotes one, so the name a person types is the identity. The cost is a uniqueness rule the schema cannot hold, since Airtable has no unique constraint: #338 refuses a second kind with the same name through `getToolByName`, and that lookup is case-insensitive because Airtable's `=` on a text field is — `Impact Driver` and `impact driver` are one kind whose count must not split.

**`Tool Items.Tool Item ID` is different in kind from every other minted ID on this base**, and it is worth saying why once. A PR ID is read on a screen; a PO ID is read on a document. This one is encoded into a QR code, glued to a drill and carried onto a site. Two rows sharing it means two tools wearing the same label, and the repair is reprinting both. #335 owns the format and the width.

**`Tool Log` exists because a status field answers where a tool is now and nothing about the project that just ended.** The question a site asks when a job closes is which tools went out on it — a question about the past, which the current status cannot answer once the tool has moved on. It is append-only in the shape `PR Edit Log` already has: a row records what was true at a moment, a moment does not change, so there is no update function and correcting a mistaken scan is another row.

### The name is #333's rule applied, not a coincidence

`Tools` → `Tool Items` is a child table taking its parent's name. `Tool Log` is an append-only event table taking its subject and `Log`, which is the second half of the same rule and is why it is not `Tool Item Log`: `PR Edit Log`'s subject is a PR edit rather than a `Purchase Requests` row spelled out, and the pattern is a short form of the subject plus `Log`.

`Tool Items` is also a fifth item table under #303's rule, so a row of it is a **tool item** — never a bare `item`, which on this base already names a row of `PR Items`, `PO Items`, `Invoice Items` or `Delivery Items`.

## Status is written by this app, not computed by Airtable

`Tool Items."Status"` is a cache of the last `Tool Log` row. It is nonetheless written by `lib/toolStatus.js`'s mapping in the same operation as the row that moved it, and that is a decision rather than a limitation worked around. Three grounds, and the first is the one that settles it.

**A LAST ROW IS NOT A STATUS.** The two vocabularies are different sizes — five statuses against eight events — and `Job Changed` is a last row that leaves the status alone. Reading the last row's `Event` into `Status` would write `Job Changed` into a field whose option list does not contain it. So turning an event into a status is a MAPPING, and a mapping is workflow logic, which CLAUDE.md keeps out of Airtable formulas. `STATUS_AFTER_EVENT` is that mapping and `Job Changed` is its only `null`; `offline/tool-status.mjs` pins that it stays the only one, because if a second appears the argument on this page needs re-making.

**Airtable has no argmax.** A rollup's `MAX` is numeric, and there is no aggregation that returns the value of the field on the row where another field is highest. The workaround is to lean on rollup ordering — the link cell's order — which is not a documented guarantee, so a history that reordered for any reason would silently rewrite every tool's status.

**A formula field cannot be a singleSelect**, so the closed option list, the colors and the filterability all go, and #339's count per status would be over free text.

## The job is on the tool item AND on every log row

`Tool Items."Job"` is required and app-enforced — Airtable cannot make a link field required, the same limit `Invoice Items."PO Item"` lives with (#278). **There is no state it would be empty in**: the tool belongs to a job from the moment a site person registers it, `In Stock` means at rest ON its job rather than belonging to nobody, and a tool in repair, lost or retired still has the job it last belonged to. It is changeable (#341) because a tool outlives the project it was bought for.

That last sentence is exactly why `Tool Log` carries its own `Job`: the current job says nothing about where the tool was in March, and where it was in March is the question. The log's copy is the job the tool item belongs to immediately AFTER the event.

### `Former Job` was considered and refused

#341 says the job change writes a row naming BOTH jobs, which reads like a `Job` plus a `Former Job`. It is not, because **`Tool Log."Job"` is filled on every row and never blank** — so the PREVIOUS row's `Job` is unambiguously the previous job, and a `Job Changed` row names where the tool went while the row before it names where it came from. Storing the pair would be one fact in two places, derivable from an ordering the log already has, and #340 renders the whole history at once so it holds both rows anyway.

The counter-precedent is `Delivery Items."Former PO Item"` (#167), which IS stored — and the difference is the reason: there is no log on that axis, so the re-attachment destroys the only record of where the row came from. Here the log is the record.

## Why the event vocabulary is shaped the way it is

Eight values, in two naming shapes, and the split is which transitions a person designates.

- A transition somebody chooses on a screen is named for the state it leaves the tool in, so the event and the status are **the same string**: `Lost`, `Retired`.
- A transition that happens by SCANNING carries an action name of its own, because the person scanning is performing an act rather than declaring a state: `Checked Out`, `Checked In`.

**`Lost` is not `Marked Lost`.** `Retired` already stands as one string on both axes, so prefixing only the other one would be an exception dressed as consistency. Nothing is lost by the collision — an event and a status are different fields on different tables, and `STATUS_AFTER_EVENT` is where the two meet, in code, unambiguously.

The three repair-and-recovery events keep names of their own because none of them is its own status: `Sent to Repair` leaves the tool `In Repair`, and `Returned from Repair` and `Found` both leave it `In Stock`.

**`Found → In Stock` is the one resulting status that is a judgment** rather than a reading of the event's own name. A tool that turns up is accounted for again but is not thereby back at work; if it is in fact on a site, the scan that puts it there is a `Checked Out` and says so. Restoring whatever status preceded the `Lost` was the alternative and is refused because it needs the log walked backwards, which is the work the cached field exists to avoid.

**Title case with lowercase particles is the base's convention rather than a choice made here** — `Purchase Orders."Status"` spells `Sent to Vendor` and `Awaiting Signature`. A preposition is lowercase unless it is the first or last word. This matters more than usual because **an existing select's option list cannot be written through the Metadata API at all** (422, measured; see `airtable-access.md`), so a casing slip is a hand edit in the UI plus a rewrite of every row carrying the old string. `offline/tool-status.mjs` holds the casing rule by value for that reason.

## Open — decided, not yet enforceable

**`Notes` IS REQUIRED ON A `Lost` AND ON A `Retired` EVENT, AND NOTHING ENFORCES IT YET.** The two have different reasons and both are strong enough to make the field conditional. `Lost` is a record that asks who was responsible, so a row saying only that a tool is gone is the half of the record that costs nothing to write and answers nothing. `Retired` cannot be undone — it is the one terminal status — so the reason has to survive the decision.

It is unimplemented because **this issue creates the tables and writes no row at all**; the screens that set those two statuses are downstream of #338 and none of #335–341 covers them. So it is recorded here rather than filed: the requirement has no issue, which is what this section is for.

Two constraints on whoever implements it. **Airtable cannot make a field conditionally required** — it cannot make one required at all — so this is an app rule in the shape `Tool Items."Job"` already takes, refused at the action rather than by the schema. And it is a rule about the EVENT rather than about the field, so it belongs beside `STATUS_AFTER_EVENT` in `lib/toolStatus.js`, where the two events are already named, rather than in whichever form happens to write them first.

`Tool Log."Notes"` says so in its own Airtable description, so a person reading the base meets the pending rule where the field is.

## What the schema deliberately does NOT carry

- **No `Created At` on `Tool Items`.** The `Tool Item ID` carries the day and the log's first row carries the instant; a third copy is the shape this base keeps having to remove.
- **No `Created At` on `Tools`.** `Vendors` and `Materials`, the two tables it is modelled on, have none, and `/tools` orders by name. An Airtable `createdTime` can be added in one field CREATE if #339 wants a tiebreak.
- **No per-status rollup on `Tools`.** #339 needs a count per status and can have it from the `Tool Items` link array `getAllTools` already returns for free. The measurable condition for changing that: if `/tools` measures above roughly ten operations because of the tool item walk, the count moves into a rollup and `Purchase Orders."Uninvoiced Items"` (#244) is the worked example of the move. Five rollups nothing reads would be five fields to keep in step for nothing.
- **No `{Parent} Record ID` lookup on either child table.** After #334 deleted the seven that existed, `Material Prices` holds the only two left on the base, and those are CLAUDE.md's stated exception — a price row is keyed by two links and has no parent whose reverse-link would do. See below.
- **No `Unit` field anywhere.** A tool item is one object, not a quantity, so `add_unit_options.py` stays a five-table script — the same note `create_direct_purchases_272.py` makes for its own table.

## The reverse links needed no disambiguation, and that is worth recording

Five link fields, five auto-created inverses, and all five are the name we would have chosen, so none was renamed: `Tools."Tool Items"`, `Jobs."Tool Items"`, `Tool Items."Tool Log"`, `Jobs."Tool Log"`, `Users."Tool Log"`.

Two links land on `Jobs`, which looks like the case `Users."PR Edit Requests (Initiated)"` and `"(Sent To)"` exist for. It is not. **Every disambiguated inverse on this base is two or more links from ONE source table** — `Purchase Orders (as PIC / as Manager / as Sender)`, `Jobs (as PIC / as Manager)`, the `PR Edit Requests` pair. Airtable names an inverse after the SOURCE TABLE, so two links from two different tables land already distinct.

## The ninth child relation, registered before anything writes a row

`"Tool Items::Tool Log"` is in `CHILD_KINDS` from the commit that creates the table, and `lib/airtable/toolLog.js:createToolLogEntry` is the `generateChildId` call site that makes it legal. Deferring the registration to #338 was proposed and reversed: the alternative was stating `{Tool Item ID}-{seq}` in the Airtable field description and having the next issue read it back out, which is one rule written twice in two places neither of which can check the other.

**`offline/id-sequence.mjs` requires a CALL SITE, not a writer with a screen behind it.** Its walker finds any `generateChildId(...)` under `lib/` and never asks whether anything calls that function in turn — measured by running it, 110 of 110 with the ninth relation registered and nothing but the credentialed check calling it.

**An issuance helper narrower than a writer is not available**, which is worth knowing before someone tries. `generateChildId` calls `createFn` INSIDE the per-parent lock, and that is the whole mechanism preventing two concurrent scans from minting one id; a helper that returned an id for the caller to use would hand it out with the lock already released. Minting and creating are one function by construction.

The relation shares its name from the moment it exists, which is the composite-key census confirming itself: `Tool Log` is carried by `Tool Items`, `Users` and `Jobs` the moment it exists, so a registry keyed on the bare field name would have had three candidates to be wrong about. See `id-generation.md`.

## The seven parent Record ID lookups deleted alongside (#334)

`PR Signers`, `PR Items`, `Quotations`, `PR Edit Requests` and `PR Edit Log` each carried a `PR Record ID` lookup, and `Invoice Items` carried `Invoice Record ID` and `PO Record ID`. All seven are gone; `Material Prices."Material Record ID"` and `"Vendor Record ID"` stay, are read by `getMaterialPrice`, and must not be swept with them.

**Nothing read the seven** — measured across `lib/`, `app/` and `scripts/`, the three names survive only in comments — and **no formula, rollup or lookup on the base referenced them**, measured by field id against the whole schema before the deletion. Each of the six tables had exactly one default `Grid view`.

**Deleting a lookup destroys nothing**, which is the fact that made this safe rather than merely tidy: a lookup stores no value, so recreating it with the same configuration restores the same cells. CLAUDE.md's warning that a type change can silently drop values is about a data field and does not reach this.

**The positive reason, which the `_Record ID` formulas do NOT share:** these seven existed only to support filtering a child table by its parent's record id, which this repository forbids — that lookup is computed asynchronously and undercounts siblings created right after the parent, reproduced for PO Items (`lib/ids.js:generateChildId`). Deleting them makes the banned query unwritable rather than merely forbidden. `PO Items."PO Record ID"` had additionally been MISCONFIGURED for as long as it existed (see `purchase-orders.md`), which is the same hazard one step further along.

**The six `_Record ID` formulas were examined and all six kept.** `Materials._Record ID` and `Vendors._Record ID` are load-bearing for the two `Material Prices` lookups. The other four — `Users`, `Purchase Requests`, `Purchase Orders`, `Invoices` — have no consumer at all now, and are kept anyway: they sit on the PARENT table so they enable nothing wrong, they are a human affordance for copying a record id out of the grid into a `verify-*` run, they cost nothing as formulas, and deleting four of six would leave an asymmetry the next reader has to re-derive.

`offline/table-field-names.mjs` gained the three names. They are **the first `RETIRED` entries with no successor field at all** — a third kind after a rename (#280, #333) and a replaced field (#318's `Paid` → `Paid Date`) — because what replaces the query is a method rather than a name: read the parent's reverse-link, which `getLinkedRecords` has always done.

---
