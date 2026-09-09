# Tools — the reasoning

Governs `lib/tool*.js` and `app/tools/**`. **Read this before editing there** — CLAUDE.md carries only the rules that bind code outside this area; the derivation, the evidence and the alternatives weighed are here.

The index row named only `lib/tool*.js` until #336, because `offline/notes-index.mjs` fails a glob that matches nothing and there was no `app/tools/` for one to match. #336 created the directory and widened the row in the same commit.

`lib/airtable/tool*.js` is additionally governed by `airtable-access.md` and `naming.md`, as all of `lib/airtable/**` is.

## What this track is (#334)

The company buys drills, grinders and the like, hands them out to sites, and gets them back when a project ends. None of that is recorded anywhere today — the only account of where a tool is, is whoever remembers carrying it. Each physical tool gets a QR label; a scan on a phone moves it between `In Stock` and `Out`, and the app can then answer what is where.

**It is not a second product.** Same app, same domain, same Airtable base, same login, same `Users` and `Jobs` as everything on the materials axis. One difference, and it is a real one: a scan happens on a phone, on site, possibly by someone wearing gloves, so the tools screens assume a mobile width while every screen above them assumes a desk (#336).

**IT DOES NOT PASS THROUGH THE OFFICE, AND THAT IS THE FACT MOST OF THIS SCHEMA FOLLOWS FROM.** A site person buys the tool, registers it, keeps it and scans it. There is no purchase request, no approval chain and no invoice; nothing here is Admin-gated, and everyone who scans needs an account only because the scan records who performed it (#337). The materials axis is the opposite shape — an order the office places and reconciles — which is why almost nothing is shared between the two beyond people and jobs.

## Where the screens stand, and the one place a width is decided (#336)

`app/tools/layout.js` wraps the whole axis; `app/tools/page.js` is the first screen on it.

**NOTHING ABOVE THE TOOLS TRACK MOVED, BECAUSE THERE WAS NOTHING TO MOVE.** The screens on the materials axis share no layout file at all — `app/layout.js` was the only one in the tree — and each declares its own container inside its own page instead: eighteen of those twenty-one pages carry an `mx-auto w-full max-w-* p-8`, twenty-two declarations in all, four pages carrying two. So "the layout the materials screens share" was a repeated habit rather than a file, and giving the tools screens one of their own displaced nothing and needed no rearrangement of the axis above.

**WHAT THE TOOLS AXIS DOES DIFFERENTLY IS HOLD THAT CONTAINER ONCE.** A width settled above lands in as many places as there are pages, which is why #258 has to visit each of them; a width settled here lands in one file. That is the single structural claim this issue makes, and the layout's own header is where a reader editing a tools page meets it — a page that declares a width of its own puts the axis back to two containers, and nothing fails when it does.

**THE CONTAINER IS EMPTY, AND THE EMPTINESS IS THE POINT RATHER THAN AN UNFINISHED EDGE.** #336 decides where a width is decided and decides no value: no width, no padding, no color, no type. The reason is `docs/briefs/_shared.md`'s opening claim — nothing about this app's appearance was designed, and there is no version of it to preserve — so a value chosen here to make the first screen look finished would become the baseline a design has to justify departing from, which is the one outcome the whole design milestone is arranged to avoid. #258 fills it. The visible consequence is recorded rather than smoothed over: the first tools screen renders with no styling at all, at a phone width and at a monitor width both.

**THE ROOT LAYOUT GAVE NOTHING UP.** Everything it holds is needed by both axes — the document shell, the two font variables, `globals.css` with its `color-scheme: light`, and the `title` template that lets every page state only its own name. **And the one thing that would have had to come down is not there:** this app has no navigation shell, so there was no nav to split into a desk shape and a phone shape. The links on `/` are that page's own content, added one at a time by the issue that added the screen behind each, and #336's is the fifth by the same precedent.

**THE TOOL ITEM DETAIL STANDS ONE LEVEL UNDER `/tools`, FLAT, AND THE QR LABEL IS WHY.** `/tools/[toolItemId]` is the address a scan opens, and it is the string the code on the sticker carries. How many characters that string has decides the symbol's version, and each version step adds four modules to every side — so at the size a sticker is printed, a longer address is a symbol whose modules are thinner, and thinner modules are a worse scan in a gloved hand on a site. A segment between `/tools` and the id would show a reader nothing and cost exactly that. **#339 inherits a consequence rather than a free choice:** the flat position under `/tools` is the tool item's, so the list of kinds either goes a level deeper or names its kind in a query parameter — which of the two is that issue's to settle.

**THE FIRST SCREEN IS ONE HEADING, AND IT READS NO TOOL TABLE.** `getAllTools` names `/tools` in its own docstring as the list of kinds, and #339 is what puts that list there; a list invented ahead of it would be a shape that issue has to argue its way out of. So the page carries the heading its table's name gives it and nothing else, and the one operation it makes is the session's user read. What it does prove is the thing #334 and #335 could not: a tools screen renders, at both widths, inside a layout of its own.

**WHO REACHES IT IS #337'S DECISION APPLIED HERE, NOT A SECOND ONE.** `requireUser()`, which is every signed-in user with no Role and no Job scoping — that issue's body states it as a fact about the axis, and a page has to name a reader before its brief can. What stays with #337 is how the person holding the phone arrives and the signal for a scan on a job the scanner is not assigned to.

**THE CHANGE OF PREMISE IS RECORDED IN `docs/briefs/_shared.md` RATHER THAN HERE**, as a fifth entry in its constraints. That file is the design work's only input and it runs in a tool that does not read this repository, so a premise recorded only here would have to be inferred from a screen brief nobody has written yet. The half that belongs in this file is the derivation above; the half that constrains a drawing — that breakpoints, touch targets and a spacing scale are being chosen with a phone case beside them rather than widened into one afterwards — belongs where the design meets it.

## The first write screen: one form, two writes, no rollback (#338)

`/tools/new` takes a tool's name and a quantity and produces one `Tools` row, that many `Tool Items` rows, and a `Registered` row in `Tool Log` for each of them. It is the first screen on this base that creates a `Tools` row, and #339 and #340 had nothing to render before it.

**THE FORM IS ONE FORM, AND THE FIND-OR-CREATE IS WHAT MAKES THAT POSSIBLE.** Naming a tool the company already owns is the ordinary case rather than an error — buying six more of a drill is the same act as buying the first six — so there is no "new tool" path beside an "add to existing tool" path. Two forms would be two write paths for one rule, which is the duplication CLAUDE.md's own section is about, and the person filling one in would have to know which of the two they were in before they knew whether the name existed.

**WHAT THE ONE FORM OWES THEM INSTEAD IS THE MATCH, STATED BEFORE THEY SUBMIT**, and it costs no query: the page loads the whole `Tools` table in one operation — `getAllTools`, the `Vendors` shape, bounded by what the company has bought — and `lib/toolRegistration.js:matchExistingTool` applies the same key in the browser. That is `lib/prItemMerge.js`'s arrangement exactly: one pure module holds the key, the action applies it, the form previews it. **The preview is not the verdict and the module's own header says so** — the list is as old as the page, so the write asks Airtable again through `getToolByName`.

**THE DUPLICATE GATE IS `upsertMaterial`'S SHAPE DOWN TO THE LOCK KEY, AND FOLLOWING IT WAS THE WHOLE DECISION.** Both tables carry a human-typed natural key Airtable cannot make unique. So: normalize inside the writer so no caller can create an unnormalized row, compare case-insensitively at the lookup, lock on the normalized lowercased key so names Airtable would call equal serialize against each other, and **do not update the name on a match** — the first spelling wins, for `upsertMaterial`'s own reason that rewriting it lets one person's capitalization overwrite another's under everything already linked to the row. The residual is `withKeyLock`'s standing one: two concurrent Vercel invocations can both read "nothing exists yet". Unlike the tool item family, the repair here is cheap — `Tools` mints no id, so a duplicate row merges by hand with no printed label going wrong.

**`/tools/new` IS SAFE BESIDE `/tools/[toolItemId]` AND THE ARGUMENT IS THE ID FORMAT RATHER THAN THE FRAMEWORK'S RULE.** Next.js matches a static segment ahead of a dynamic one, measured rather than read off the documentation: with a temporary page at `app/tools/[toolItemId]/page.js` alongside the form, `/tools/new` rendered the form and `/tools/HYE-TL-260909-001` rendered the dynamic page. **But precedence is not what makes this settled** — every `Tool Item ID` begins `HYE-TL-`, so no static segment this app could plausibly add can equal one, in either direction. The temporary page was deleted; #340 is what puts a real one there.

**AND THE FLAT SLOT BEING THE TOOL ITEM'S MEANS A TOOL'S NAME NEVER APPEARS IN A PATH, WHICH IS #339's PREMISE RATHER THAN A CONSEQUENCE FOR IT TO DISCOVER.** #336 reserved one level under `/tools` for the tool item because that address is what the QR code carries. A tool's name is human-typed and could be any string, so a route like `/tools/[toolName]` is unavailable — which is also what stops a tool somebody names `new` from colliding with this form. #339's list therefore goes a level deeper or names its tool in a query parameter, and either is fine; what is not available is the flat segment.

**THE TWO WRITES RUN IN SEQUENCE AND ARE NEVER NESTED, WHICH THE CONCURRENCY RULE DECIDES RATHER THAN A JUDGMENT ABOUT DAMAGE.** `createToolItems` holds the day-prefix lock across its whole batch; `createToolLogEntry` takes a per-tool-item lock of its own through `generateChildId`. Writing each log row inside the batch would bound the damage to one unlogged tool item and would nest two `withKeyLock` calls — which CLAUDE.md forbids and `lib/materialsCache.js` is the precedent against. So the log pass runs after the batch, and a failure in it can leave several tool items without a `Registered` row.

**WHAT AN UNLOGGED TOOL ITEM IS, AND WHY IT IS NOT REPAIRED.** The row is complete and usable — it has its printed id, `In Stock`, and a job — and what is missing is the moment it came into existence. `Tool Items` carries no `Created At` on the ground that the log's first row holds the instant, so there is no second place holding it and no way to recover it. **Writing a late `Registered` row is refused on purpose**: its `Event At` would state a time that is not when the tool item was created, and an append-only log whose rows record what was true at a moment cannot carry a row that does not. So the screen names those ids separately and the state stands. The log pass also STOPS at its first failure rather than trying the rest, which is `createToolItems`' own posture and reason: a log write that fails is failing systemically far more often than per row.

**NOTHING BATCHES A CREATE, AND THIS IS THE ISSUE `createToolItems` NAMED AS OWNING THAT DECISION.** The figure it asked for, **measured on a dev server against the live base**: `registerToolItemsAction` costs **5 + 3N operations** for a new tool and 4 + 3N for one that already exists. Confirmed at three sizes — 1 tool item under a new tool was **8** (3 list, 3 create, 2 find), 2 under an existing one **10**, and 12 under a new one **41**. The three per tool item are its own create plus the parent find and the create `generateChildId` makes for its log row; the fixed term is the session find, the two lists the page's own picker needs, and the duplicate lookup.

Batching the tool item creates ten to a request, which is Airtable's limit, takes 3N to about 2.1N — **the log rows cannot be batched at all**, since `generateChildId` mints one id per parent under one lock, so the un-batchable term dominates and the order of magnitude does not move. Against that, a failed batch of ten spends ten ids at once and makes the account the screen owes coarser. **The measurable condition for revisiting it:** if the log row ever stops needing a per-parent mint — a `Tool Log ID` that is not `{Tool Item ID}-{seq}` would do it — the un-batchable term goes and batching the creates becomes the whole cost.

**SO ONE SUBMISSION IS CAPPED, AND THE NUMBER COMES FROM ONE INVOCATION'S BUDGET.** Measured at 12 tool items: **9.0 seconds, so 0.75 s each**, which puts `MAX_TOOL_ITEMS_PER_REGISTRATION` at 100 around 75 seconds against a Vercel function's 300-second ceiling — a fourfold margin, and the figure the cap is chosen from rather than a round number. It is a local measurement and the real rate depends on the round trip, which is what the margin is for. **The refusal is not a dead end** — it tells the reader to register up to the cap and repeat, and the find-or-create path is what makes the remainder land under the same tool, so the cap costs a second submission and nothing else.

**THE IDS ARE REACHABLE FROM THE SUBMISSION'S ANSWER AND FROM NOWHERE ELSE IN THE APP YET, AND THAT IS ACCEPTED RATHER THAN OVERLOOKED.** The account names every minted `Tool Item ID` rather than counting them, because the id is what gets printed onto a sticker and a count cannot be acted on. It arrives as the action's return value, so **a reload loses it** — the rows are on the base and #339 is what lists them. That is affordable because printing labels is a later phase and there is no need to see an id again before then; it is written down because the alternative reading is that somebody forgot.

**AND THE JOB IS THE ACTOR'S OWN, WITH NO OFFICE CLAUSE, WHICH IS A SECOND PREDICATE ON PURPOSE.** `lib/toolRegistration.js:assignedJobsFor` is not `lib/deliveryAccess.js:accessibleJobs`: that one admits President and Admin to every job because invoicing and reconciliation are office work. This track does not pass through the office, and `Tool Log."Job"` is the job the event HAPPENED on — so an Admin assigned to no job has no such job and is refused, on the same screen and in the same words as anybody else with no assignment. `offline/tool-registration.mjs` holds the disagreement between the two predicates as an assertion, so a later pass that aligns them fails rather than quietly widening a write path.

## Three tables, and what each is for

`Tools` is the KIND. `Tool Items` is the object. `Tool Log` is the history.

**A tool is bought BY THE KIND and tracked ONE AT A TIME.** A company buys six of the same drill and then needs six labels, six locations and six histories under one name that a person typed once. Folding the kind and the object into one table gives you either six rows repeating the name — which is how two spellings of one kind appear and a count splits in two — or one row that cannot say where any individual drill is.

**`Tools` takes no minted ID, the way `Vendors` and `Materials` take none.** Nothing prints a kind and nobody quotes one, so the name a person types is the identity. The cost is a uniqueness rule the schema cannot hold, since Airtable has no unique constraint: `upsertTool` enforces it, find-or-create under a lock, and `getToolByName` is the comparison it makes — `Impact Driver` and `impact driver` are one tool whose count must not split.

**THIS PARAGRAPH SAID THAT LOOKUP WAS CASE-INSENSITIVE BECAUSE AIRTABLE'S `=` IS, AND AIRTABLE'S `=` IS NOT (#338).** Measured read-only against this base before anything was written: `{Vendor Name} = "brazos metals"` returned 0 rows against a stored `Brazos Metals`, the uppercased form returned 0, and `LOWER(TRIM({Vendor Name})) = LOWER(TRIM(…))` returned 1 for both. So the gate as #334 wrote it would have created a second tool under a differently cased name — the exact split this paragraph says it prevents, in the one table where the name IS the identity. The claim was in `lib/airtable/tools.js`'s header too and both are corrected. **Neither form collapses an internal whitespace run** (`Brazos  Metals` matched 0 rows either way), which is why the write side normalizes: `LOWER(TRIM(…))` is enough only because `normalizeItemText` has already collapsed the runs on both the stored value and the argument, which is exactly what `itemNaming.js` says about `Materials`.

**`Tool Items.Tool Item ID` is different in kind from every other minted ID on this base**, and it is worth saying why once. A PR ID is read on a screen; a PO ID is read on a document. This one is encoded into a QR code, glued to a drill and carried onto a site. Two rows sharing it means two tools wearing the same label, and the repair is reprinting both — see the ID section below for the width and how a batch stays contiguous.

**`Tool Log` exists because a status field answers where a tool is now and nothing about the project that just ended.** The question a site asks when a job closes is which tools went out on it — a question about the past, which the current status cannot answer once the tool has moved on. It is append-only in the shape `PR Edit Log` already has: a row records what was true at a moment, a moment does not change, so there is no update function and correcting a mistaken scan is another row.

### The name is #333's rule applied, not a coincidence

`Tools` → `Tool Items` is a child table taking its parent's name. `Tool Log` is an append-only event table taking its subject and `Log`, which is the second half of the same rule and is why it is not `Tool Item Log`: `PR Edit Log`'s subject is a PR edit rather than a `Purchase Requests` row spelled out, and the pattern is a short form of the subject plus `Log`.

`Tool Items` is also a fifth item table under #303's rule, so a row of it is a **tool item** — never a bare `item`, which on this base already names a row of `PR Items`, `PO Items`, `Invoice Items` or `Delivery Items`.

**AND A `Tools` ROW IS A `tool`, WHICH #338 SETTLED BECAUSE IT WAS ABOUT TO BE SETTLED BY ACCIDENT.** The same rule decides it — a row takes its own table's name in the singular — and nothing else may borrow the word, so a tool item is never "a tool". What made this worth writing down is that `kind` had begun to look like the answer: this file, `getAllTools`'s docstring and #336's own brief all say "kind", which is the right EXPLANATORY word for what distinguishes the two tables and the wrong one for a screen. A brief handed to the design work saying "a list of tool kinds" invites `Kind` as a column head, and that brief is corrected in #338's commit. `kind` stays in prose here, where it is explaining the split rather than naming a row.

## Status is written by this app, not computed by Airtable

`Tool Items."Status"` is a cache of the last `Tool Log` row, written by `lib/toolStatus.js`'s mapping in the same operation as the row that moved it. That is a decision rather than a limitation worked around, and **#335 removed one of the three grounds it rested on — the conclusion survives on the other two.** The removal is recorded rather than quietly dropped, so nobody re-derives the argument from a premise that is gone.

**THE GROUND THAT DIED.** #334's first and strongest reason was that a last row is not a status: the vocabularies were different sizes and `Job Changed` was a last row that left the status alone, so reading the last row's `Event` into `Status` would have written a value the option list did not contain. #335 removed that event, `STATUS_AFTER_EVENT` has no `null` entry any more, and every event now moves the status. A formula that copied the latest event's status would, on today's vocabulary, be correct.

**Airtable has no argmax.** A rollup's `MAX` is numeric, and there is no aggregation that returns the value of a field on the row where another field is highest. "The status implied by the row with the latest `Event At`" is not expressible. The workaround is to lean on rollup ordering — the link cell's order — which is not a documented guarantee, so a history that reordered for any reason would silently rewrite every tool's status.

**A formula field cannot be a `singleSelect`.** The closed option list goes, the colors go, and #339's count per status would be computed over free text. `Tool Items."Job"` has the same problem one step worse: a formula cannot be a link either, so the job cache could not exist at all on that route.

Neither of the two is checkable in this repository — both are facts about Airtable — which is why this paragraph is prose and `offline/tool-status.mjs` says so in the assertion that replaced #334's.

## Why the vocabulary is four events and three statuses

**Statuses: `In Stock`, `Out`, `Retired`. Events: `Registered`, `Checked Out`, `Checked In`, `Retired`.** #334 shipped five and eight; #335 cut them to this before a single row existed, which is the only reason it was affordable — an existing select's option list cannot be PATCHed at all, so the repair was deleting two tables and running the creation script again.

**`In Repair`, `Lost` and `Found` are gone because those things do not happen here.** A tool that breaks is thrown away and replaced rather than repaired, and nobody reports an individual tool item missing. The cost of modelling them anyway is not neutral: a status nobody will ever designate is a permanent blank in the per-status count, a dead option in the list filter, and an entry in `STATUS_AFTER_EVENT` that no code path reaches. If repair ever starts, adding an option is a hand edit in the Airtable UI — known, and cheaper than carrying three dead values until then.

**`Retired` stays because without a terminal status the count goes wrong.** A discarded tool would sit `In Stock` for good, and the only other way to correct that is deleting the record, which takes its whole log with it. It covers a tool found missing at a stock check as well as one thrown away, because on this axis those are one fact — the company no longer holds it — and which of the two it was goes in `Tool Log."Notes"`.

**`Job Changed` is gone for a different reason: the fact it recorded is already in the log.** A manager scans out their own job's tools to workers; a worker may carry one to another site; whoever manages the site it reaches scans it back in. So a tool moving between jobs shows up as a check-out on one job and the next check-in on another, and a separate event adds nothing those two rows do not already carry. **That is what makes `Tool Items."Job"` a cache rather than an attribute** — see below.

**`Registered` was added, and the deciding reason is a field that is not there.** #334 left `Created At` off `Tool Items` on the ground that the log's first row holds the instant. Without an event naming registration there is nowhere at all that answers when a tool item came into existence, and `Created At` would have to come back. `Checked In` was the alternative and reads wrong: it means a tool came back into stock, and one being registered has never been out. It is also not a fiction — the label still has to be printed and stuck on, so the `In Stock` it leaves behind describes a real tool sitting on a bench.

**The naming shapes.** A transition a person designates is named for the state it leaves the tool in, so the event and the status are the same string: `Retired`, the only one of that kind left. A transition that happens by scanning carries an action name, because the person is performing an act rather than declaring a state: `Checked Out`, `Checked In`. `Registered` is a third case — an act with no status of its own name — which is why `STATUS_AFTER_EVENT` is a map rather than something derivable from the two lists.

**What the check can and cannot hold.** `offline/tool-status.mjs` asserts that every status is produced by at least one event, which catches a dead option. It is **not** the rule applied above: what was removed were statuses nobody would ever DESIGNATE, and `In Repair` was perfectly reachable from `Sent to Repair` right up until it was deleted. The assertion would have passed on the old vocabulary and passes on the new one. Whether an event describes something that happens on a site is not a property of this source tree, and a green run is not evidence that the vocabulary is justified.

## The job is a cache on the tool item and a fact on every log row

`Tool Log."Job"` is filled on every row and never blank. It holds the job the event happened on, which is where the tool item is immediately after it.

**`Tool Items."Job"` IS A CACHE OF THAT COLUMN ON THE LATEST ROW — the same kind of value as `Status`, from the same row.** #334's description called it the job the tool belongs to, a durable attribute, and #335 corrected that: a tool does not belong to a job, it was last scanned on one. Nothing in the flow ever reassigns a tool; it moves because somebody carries it and somebody else scans it in.

It is still REQUIRED and still app-enforced, since Airtable cannot make a link field required (the limit `Invoice Items."PO Item"` lives with, #278). Never empty, because every event carries a job and registration is an event.

### Where the job comes from

**Registration, check-out and check-in all take it from the `Users."Assigned Jobs"` of whoever performs the action.** One assigned job and it is used without asking; several and it is a dropdown; there is no path anywhere that types a job.

**IT IS STORED ON THE LOG ROW AT THAT MOMENT AND NEVER LOOKED UP AFTERWARDS.** `Assigned Jobs` changes when a person moves site, so a log row that referenced the session or the user's current assignment would make an old check-out describe today's posting. That is the precise thing the per-row copy exists to prevent, and referencing it at read time would undo the whole reason `Tool Log` carries a job of its own. The screens are #338 and later; the rule is here because it constrains all of them.

### `Former Job` was considered and refused

With no blanks, the PREVIOUS row's `Job` is unambiguously the previous job — a check-in on a different job than the check-out before it IS the record of a tool changing site. Storing the pair would be one fact in two places, derivable from an ordering the log already has, and #340 renders the whole history at once so it holds both rows.

The counter-precedent is `Delivery Items."Former PO Item"` (#167), which IS stored — and the difference is the reason: there is no log on that axis, so the re-attachment destroys the only record of where the row came from. Here the log is the record.

## Open — decided, not yet enforceable

**`Notes` IS REQUIRED ON A `Retired` EVENT, AND NOTHING ENFORCES IT YET.** That event cannot be undone, and it covers two different real happenings — a tool thrown away, and a tool found missing at a stock check. With no reason written down the row does not say which, and the distinction is the only place that information can live now that `Lost` is not a status.

#334 recorded this rule against `Lost` and `Retired` both, with a second reason for `Lost` — that it is a record asking who was responsible. #335 removed that event, so the rule narrows to one event and one reason.

It is unenforceable here because **this issue writes no `Tool Log` row at all**; the screen that retires a tool is downstream of #338 and none of #335–341 covers it. So it is recorded rather than filed: the requirement has no issue, which is what this section is for.

Two constraints on whoever implements it. **Airtable cannot make a field conditionally required** — it cannot make one required at all — so this is an app rule in the shape `Tool Items."Job"` already takes, refused at the action rather than by the schema. And it is a rule about the EVENT rather than about the field, so it belongs beside `STATUS_AFTER_EVENT` in `lib/toolStatus.js`, where the event is already named.

`Tool Log."Notes"` says so in its own Airtable description, so a person reading the base meets the pending rule where the field is.

## What the schema deliberately does NOT carry

- **No `Created At` on `Tool Items`.** The `Tool Item ID` carries the day and the log's first row carries the instant; a third copy is the shape this base keeps having to remove. **That omission is what forced the `Registered` event** — with no such row there would be nowhere left holding the instant, and the field would have to come back. The two decisions hold each other up, so neither can be undone alone.
- **No `Created At` on `Tools`.** `Vendors` and `Materials`, the two tables it is modelled on, have none, and `/tools` orders by name. An Airtable `createdTime` can be added in one field CREATE if #339 wants a tiebreak.
- **No per-status rollup on `Tools`.** #339 needs a count per status and can have it from the `Tool Items` link array `getAllTools` already returns for free. The measurable condition for changing that: if `/tools` measures above roughly ten operations because of the tool item walk, the count moves into a rollup and `Purchase Orders."Uninvoiced Items"` (#244) is the worked example of the move. Five rollups nothing reads would be five fields to keep in step for nothing.
- **No `{Parent} Record ID` lookup on either child table.** After #334 deleted the seven that existed, `Material Prices` holds the only two left on the base, and those are CLAUDE.md's stated exception — a price row is keyed by two links and has no parent whose reverse-link would do. See below.
- **No `Unit` field anywhere.** A tool item is one object, not a quantity, so `add_unit_options.py` stays a five-table script — the same note `create_direct_purchases_272.py` makes for its own table.

## The tool item ID: width, and how a batch stays contiguous (#335)

`HYE-TL-YYMMDD-###`, minted by `lib/ids.js:generateNextToolItemIds`. Same daily-reset shape as every other document in the system, counting the rows whose ID carries the same prefix and never a date field (#164) — the rule that matters more here than anywhere else, because a duplicate is two labels already stuck to two tools and the repair is reprinting both.

**THE WIDTH IS 3 AND IT IS THE FIRST PER-FAMILY WIDTH ON THIS BASE.** Every other family takes `SEQ_PAD_LENGTH`, which is 2 and stays 2: `formatSequentialId` reads `padLength` through a default, so `ID_KINDS.TOOL_ITEM` declaring one leaves the other five untouched. That mechanism is not new — `CHILD_KINDS` already carries a width per relation — and it is the reason widening this sequence changed no document ID.

Three, because one registration creates many. Every other family is a document somebody raises one at a time and none has ever needed more than a handful in a day; a tool registration takes a quantity, and the first day of use is a warehouse's whole stock arriving at once. It is also not a new number — seven of the nine child relations already pad to 3.

**IT IS NOT A CEILING, WHICH IS WHY THE CHOICE IS CHEAP.** `padStart` does not truncate and `nextSequence` parses the whole tail, so the 1000th tool item of one day is `-1000` rather than a collision. The width is a statement about how the common case reads.

**A BATCH IS ONE LOCK, ONE QUERY AND N CONTIGUOUS IDS.** `mintDailyIds` holds the critical section across the whole registration; `mintDailyId` is that function with a count of 1. Minting one at a time would be wrong twice: a lock acquisition and a full day-prefix query PER tool item, which grows with the day, and — worse — two people registering at once would interleave, so one registration's tool items would come back with another's numbers scattered through them.

The direction of the delegation is forced rather than chosen: `offline/id-sequence.mjs` asserts `lib/ids.js` builds exactly one `filterByFormula` and that it is a bare `prefixMatch` call, so a batch helper with a query of its own fails CI. Two queries for one rule is how the two drift.

**AN ISSUANCE HELPER NARROWER THAN A WRITER IS NOT AVAILABLE**, and it is worth knowing before someone tries. `mintDailyIds` calls its callback INSIDE the lock, because reading the highest sequence and writing the rows that claim it must be one critical section — a helper that returned ids would hand them out with the lock already released. So `createToolItems` mints and creates in one function, exactly as `createToolLogEntry` does one level down, and for the same reason.

**WHAT THE LOCK DOES NOT COVER** is `withKeyLock`'s standing residual: it serializes within one process or invocation only, so two concurrent Vercel invocations can still read the same highest sequence and both create. Every family has lived with that window; what differs here is the repair. No distributed lock is built — that is new machinery against a risk this base has never been observed to hit — and the frontend disable-on-click guard remains the other half. The module header says so where a reader of the code will meet it.

**A DELETED TOOL ITEM FREES ITS NUMBER IF IT WAS THE HIGHEST OF ITS DAY, WHICH IS THE ONE HAZARD ON THIS AXIS WORTH KNOWING.** `nextSequence` is MAX + 1 over the live rows, so deleting the top row lowers MAX and the next mint re-issues that number — measured, not reasoned: with `HYE-TL-260908-001..009` on the base, destroying `-009` and minting again produced `-009`. That is MAX + 1 working as specified, and for an invoice it is the accepted behavior #164 settled; here the number is on a sticker, so the same behavior would put one label on two tools with nothing to notice.

**WHAT CLOSES IT IS THE VOCABULARY, NOT THE GENERATOR.** The app offers no way to delete a tool item and must not: `Retired` exists so a tool can leave the count while its row and its whole log stay, which is the same argument that kept `Retired` when `In Repair` and `Lost` went. The only remaining exposure is a hand deletion in Airtable, which this base already forbids — nothing here is removed as tidying-up. A high-water mark in place of MAX + 1 would remove the hazard outright and is refused in `id-generation.md`, with the trade written down.

**NOTHING ROLLS BACK A PARTIAL REGISTRATION.** `createToolItems` returns what it created and what it did not, and a failed create simply stops the rest. Undoing the rows before it would free ids the counter has already spent, and a later registration would re-issue them; `nextSequence` is MAX + 1, so the gap costs nothing while a reused number costs two labels on two tools. What the submission says about a short count is #338's.

**#313 IS OPEN AND THIS FAMILY DOES NOT TOUCH IT.** That issue moves `Purchase Orders`' four-digit year onto the two-digit form everything else writes; the tool item family took the two-digit form from the start, so it adds nothing to that work. `offline/id-sequence.mjs` pins the split — five families on two digits, `PO` the one that is not — so the claim stays checkable rather than remembered.

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
