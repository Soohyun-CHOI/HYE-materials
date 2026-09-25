# Purchase requests — the reasoning

Governs `app/prs/**`, `lib/prSigning.js`, `lib/prDraft.js`. **Read this before editing there** — CLAUDE.md carries only the rules that bind code outside this area; the derivation, the evidence and the alternatives weighed are here.

Moved verbatim out of CLAUDE.md — nothing in this file was rewritten. The migration was audited line by line and the result is in the pull request that created this file.

### Purchase Requests

- **The `/prs` list heads `Job` and carries no discipline (#314).** It headed
  `Job / Discipline` from #119 to that issue, one cell from two fields joined by a
  middot, and that pairing was never argued: #119's issue body listed `job/line` among
  the row's fields and #168 copied the shape to `/pos` as "the same shape as the other
  two". So the four document lists carried one fact three ways, which is what the
  design pass saw by reading their briefs side by side. The removal loses nothing here
  — `/prs/[prId]` names both the job and the discipline and always has — and it takes
  `getAllDisciplines()` off the page with the column, measured at 15 operations against
  16. The order list's half of the same change cost more and is in
  `purchase-orders.md`. **A discipline is how a request is FILED**, which is why it
  belongs to a request's own screen rather than to a row a reader scans.
- **`Created At` was `Created Date` and was date-only until #105.** The migration is
  provenance rather than a rule — the rule is the `*At` convention itself, which
  CLAUDE.md's ID-generation section states for every table — so it sits here after the
  routing pass that followed #263. What it explains for a reader of old code: a
  same-day pair had no order before #105, and `lib/ids.js` no longer reads any date
  field at all (#164), so nothing now depends on this field's precision.
- **Withdrawn (#122)** is the documented exception to the "no Rejected status" posture: it's the Requester's own *self-retraction* of a submitted PR (circumstances changed / submitted in error), NOT a signer's rejection — signers keep Return for correction. It's a state transition (not a delete — contrast Draft delete): the PR, signer chain, edit-request history, and the PR Edit Log all stay on record. Requester-only, allowed **only from In Review** this pass, terminal (no revive — re-request = a new PR). The Status flip is the single lever needed (every actionable path is gated behind In Review); Pending signers / open edit requests / Current Signer Step are left untouched to preserve the audit trail, and the signer progress bar drops correction arcs off-In-Review so a withdrawn PR reads as ended. `getSubmittedPRs` returns Withdrawn PRs (they aren't Drafts) so they stay visible/filterable in the #119 list. PR withdrawal stays **In Review-only**, and there is no plan to extend it to Approved: once a PR is approved its PO exists, and "we're not ordering after all" is a decision about the *order*, so it's expressed as the PO's own terminal `Withdrawn` (#138, see Purchase Orders below) — an Approved PR really was approved and its signer chain records that. The PR-status check that was once wanted in `signPOAction` therefore no longer applies rather than being satisfied: the guard added in #138 checks **PO** status, and since a PR is never withdrawn past In Review, an Approved PR's PO can't be signed out from under a withdrawn PR.

- **The request carries a `Delivery Address` since #385, and the reasoning is in
  `docs/notes/addresses.md`** rather than here — it is the second of four issues
  on that axis and the design it settles binds #386 and #387. What a reader of
  THIS file needs: the link is required at SUBMIT and not at save, which is every
  other required field's shape on this form; the form's two branches are a way of
  picking and nothing stores which was used; and `/prs/new` grew by exactly one
  operation for it (14 → 15, measured as a requester).

### PR Signers

- Requester assigns an ordered signer list at creation, each tagged Confirmation Type (Approval/Agreement) — label only, same underlying action.
- Each turn: Approve/Agree, Edit and continue, or Return for correction (to any earlier signer/requester/self — pauses/resumes, never restarts; nested corrections are a LIFO stack, each resolve unwinds one level).
- Editing after signing does NOT invalidate approval.
- Fields: PR Signer ID, PR/Signer (link, single), Sequence Order, Status (Pending/Approved/Edited/Returned), Confirmation Type, Signed At, Notes (no input on plain Approve/Agree; Edit and continue/Return still collect it).
- PR detail page: linear progress bar (`lib/prSigning.js:getSignerChainProgress` + `app/prs/[prId]/SignerProgressBar.js`), current state only. Paused (passed through, pushed back by correction) shares neutral color with not-yet-reached, dashed border only. `PR Edit Requests."Sent To"` stores only a user id (ambiguous if Requester = a Signer); progress bar defaults to signer interpretation — doesn't affect the actual state machine (uses Current Signer Step).

### PR Items

- **`Item Name` IS NO LONGER TYPED (#355).** A row picks a `Category` — four ordered levels narrowed from the catalog — and the name is written from that category's `Category Label` at save time. It stays a field on this table and stays a frozen copy, exactly as `PO Items` then copies it and `Invoice Items` copies that; what changed is where the string comes from. **The two are not allowed to disagree**, which is why no screen offers the name as free text any more: `/prs/new` has no name input, and Edit and continue picks a category too since #367 — it showed the name read-only in between, because a signer changing it without the category would be silent and #356 keys the material on the category. **The pair is `lib/materialCategory.js:categoryItemFields` since #367**, one expression at both call sites, so the guarantee is the code's rather than each screen's. The bullet below still governs the string's SHAPE, since `createItem` normalizes on the way in as it always has; it simply has nothing left to collapse in a label an Airtable formula composed from trimmed cells.
- **`Item Name` and `Size` are normalized on save (#18)** — trimmed, internal whitespace runs collapsed, **case left exactly as typed** (`lib/itemNaming.js`). Applied in `prItems.js` create/update, i.e. the service layer, so the PR form and Edit and continue cannot drift apart on it. This is the origin of the whole chain — PO Items copy these values and Invoice Items copy those — so normalizing once here covers every table downstream. **`Materials` was keyed on them too until #356**, which moved identity to `Category` + `Size` + `Unit`; `Size` is still normalized by this rule and is where the remaining duplication lives, and the name axis has nothing left to reconcile because nobody types one. Case is deliberately untouched because this exact string is printed on the PO PDF the vendor receives, where `SCH 40 PVC` / `304SS` / `NPT` are correct as written and the stored value is the only copy; case-insensitivity is the *lookup's* job instead (`LOWER(TRIM(...))` in `getMaterialByKey`), which is reversible. **No stored match-key field**, deliberately: a second field is one more thing that can fall out of step with the write path meant to fill it. Rows created before #18 are not normalized, which is why `upsertMaterial` normalizes again on its way in.

### PR Edit Log

- **`Item Name` LEFT THE WRITABLE SET AND `Category` TOOK ITS PLACE (#367), AND THE AIRTABLE SIDE WAS A RENAME.** What a signer can change is the category; the name is composed from it and written in the same update, so a turn that changed an item writes ONE row whose subject is the item rather than two rows about a string. Its `Old Value` is the item's stored `Item Name` — the frozen copy of the old label, so the row states what the document actually said and costs no read — and its `New Value` is the new label. **The choice was renamed in the Airtable UI rather than added beside the old one, and the measurement is what allowed that:** `PR Edit Log` held **0 rows** at the time (counted twice, and after #358's seed run, which cannot produce one — no seed calls `createEditLogEntry`, and the only path that does is a signing turn in a browser). A rename with no rows re-points no history, so #181's field-identity rule has nothing to bite on, and the option kept its place in the list and its color off the palette `typecast` cannot reproduce. **Had one row held it, the answer would have been the other one** — keep `Item Name` as history and add `Category` — and `verify-edit-log-fields-181.mjs` is what says which case you are in.
- **THE FIRST BROWSER RUN OF #367 FAILED ON THIS, WHICH IS THE BLAST RADIUS BELOW REPRODUCED RATHER THAN RECALLED.** The code shipped the label before the choice existed, and the edit turn died with `INVALID_MULTIPLE_CHOICE_OPTIONS: Insufficient permissions to create new select option ""Category""`, 422 — the whole turn rolled back, the screen said `Something went wrong saving your changes. Please try again.`, and no retry could ever have succeeded. Worth keeping because it is the cheapest possible demonstration that the Airtable hand step is not optional: every offline check was green at the time.
- **`Field`, not `Field Name` (#181).** `X Name` on this base is a human-entered display name (`Item Name`, `Vendor Name`, `PIC Name`); this is one option from a closed list, and that family takes no `Name` (`Status`, `Role`, `Unit`, `PO Status`). Beside its own siblings it is also the better word — `Field` / `Old Value` / `New Value` is subject, before, after. `Edited Field` was rejected as a modifier doing no work, since `Changed By` and `Changed At` already say every row is an edit. The mapper key and the create parameter followed it to `field`, which also stops colliding with this repo's other `fieldName` — an Airtable field's name in the schema sense (`lib/airtableFormula.js`, `client.js:findByFieldValues`).
- **`Field` POINTS AT A COLUMN'S IDENTITY, NOT AT THE LABEL THAT HAPPENED TO BE IN USE — so a renamed field takes its log rows with it.** #78 renamed the PR Item field `Rate` → `Unit Price`; the three rows that still read `Rate` now read `Unit Price` and the `Rate` option is gone, so the option list is exactly the seven labels the code can write. Where a field is **deleted** and a different one takes over its job, old rows keep their old option instead: there is no identity left to follow.
  - **The test is objective — does the Airtable field id survive.** A rename preserves it, a delete-and-recreate breaks it, so the same fact that makes renaming safe at all (#167: the name is a rendering, the id is the storage) is what discriminates the two cases. This is not a judgment call about how much history to keep.
  - **Why update rather than preserve.** `Field` is a singleSelect, so it holds a *copy* of the label and a rename does not reach the copy. If the copy stands in for the identity, it has to be corrected whenever the identity survives — otherwise reading a row requires knowing the rename history, that knowledge lives in exactly one place, and the cost of carrying it accumulates for every later reader. **Nothing audited is lost:** `Old Value` and `New Value` are untouched, so the recorded fact stays as written and only the pointer moves.
  - **#181's first pass argued the opposite and was wrong, and the two mistakes are recorded so the conclusion is not flipped back.** It said "an append-only log keeps the vocabulary of its own time". First, it treated those three rows as evidence when they are dummy data. Second and worse, it read `Rate` → `Unit Price` as a **replacement** when it was a **rename**, which conflates *the label was different then* with *the subject was different then* — only the latter would justify keeping an old option. The rows were re-pointed and the option deleted by hand in the UI, because the Metadata API cannot write a select's option list at all (**measured on this field: a PATCH carrying `options.choices` returns 422 while a description-only PATCH returns 200**).
- **`typecast` is gone from `createEditLogEntry` (#181), and the two options it minted are why.** The comment defending it said auto-adding a missing choice "can't produce garbage choices" because the value is always one of a fixed set of constants. True of the names, false about the consequence: typecast gives every option it creates the same default color and nothing can recolor it, so `Unit Price` (minted when #78 landed) and `Shipping Fee` (when #69 did) sit at `blueLight2` while the original six walk a palette — visible in a schema dump and unfixable through the API. All seven labels the code can write now exist, so the write needs no help, and a label that does not exist should fail loudly rather than mint an eighth. Same posture as `createDeliveryItem` on `Unit`, and the same hazard `DRUM` demonstrated on PR Items. **Both halves measured on the live base:** a registered label still writes with no typecast, and `"Quotation"` is refused with `INVALID_MULTIPLE_CHOICE_OPTIONS: Insufficient permissions to create new select option ""Quotation""` — the same refusal `Materials` gives for `Unit: ""` — with the option list identical before and after.
- **THE BLAST RADIUS OF THAT REFUSAL IS THE WHOLE TURN, not a log line, and it is worth knowing before adding a label.** Both call sites sit inside `editAndContinueAction`'s `try`, and its `catch` reverts every touched item, the Shipping Fee, the Quotations created that turn and the signer's own status, then returned *"Something went wrong saving your changes. Please try again."* — advice that would be wrong **forever** for this cause, since no retry can succeed until the choice exists in the Airtable UI. **This said two of those reverts were `.catch(() => {})`; there were five silent reverts, not two** — three by that shape and two more by a `Promise.allSettled` whose results were discarded, which is the same silence spelled differently. Corrected per #181 by #188, which is also where the sentence went: a rollback that does not finish now says so and names what it left. The retry sentence still stands where the rollback DID finish, and for this cause it is still wrong forever.
- **Deliberately NOT made best-effort outside that rollback**, which is `lib/materialsCache.js`'s shape for stopping a derived artifact from undoing what produced it. The asymmetry is re-derivability: a materials cache rebuilds from `PO Items` and a PO PDF regenerates from its PO, but a PR Edit Log row records the **old value**, which stops existing the moment `updateItem` lands. Best-effort would apply a price change and lose the only record of what it changed — a hole in the evidence trail this table exists to be. **A refused turn beats an unlogged edit**, so the rollback stays and the fix is for the label set never to drift.
- **BOTH HALVES OF THE LABEL/CHOICE PAIR NOW EXIST, and `Unit` is the precedent for why one is not enough** — `offline/unit-options.mjs` proves the files agree, `verify-unit-options-18.mjs` proves the fields do, and a hand-added option passes the first while failing the second. PR Edit Log is the same pair:
  - `scripts/tests/offline/edit-log-fields.mjs` (CI, every push) enumerates every label the code can send and fails when one is ADDED, with the remedy in the assertion text — create the Airtable choice first, since the Metadata API cannot (422 on `options.choices`) and shipping the label without it blocks the edit turn. It also pins `typecast` at zero, and asserts on the AST that no call site passes a string literal, which is what keeps the enumeration complete. Since #181 moved the labels to `lib/editLogFields.js` it imports them rather than parsing the Server Action as text; what it still reads as source is the call-site SHAPE. Verified by mutation: an added label and a restored `typecast` each fail it.
  - `scripts/tests/verify-edit-log-fields-181.mjs` (credentialed, by hand) compares that module against the live option list, and is the only thing that can see a choice DELETED in Airtable. **It reads the rows as well as the schema, because whether an unwritable choice is legitimate is decidable rather than a judgment:** held by at least one row it is history this table is entitled to keep (a field deleted and replaced leaves rows pointing at an identity that is gone), held by none it is `DRUM`'s exact shape — a hand edit or a half-finished rename — and fails. That is a deliberate divergence from `verify-unit-options-18.mjs`, which fails on any extra option, and the reason is that for Units there is no legitimate case. Verified by mutation on all three branches, without touching Airtable, by mutating the module instead.
  - **The one-off measurement is now a standing assertion.** #181 counted seven labels against seven choices by hand; the script asserts the equality, the order, and that no row has an empty `Field`. It creates nothing, so there is no fixture to clean up, and it prints the commit and whether the tree was dirty (#172's header).
- **THE BLIND SPOT THAT MOTIVATED THE SECOND HALF WAS DEMONSTRATED, NOT IMAGINED:** #181 deleted the `Rate` choice by hand, because no API can, and every file-only check stayed green through it. That is why the credentialed half exists rather than being deferred. What remains uncovered is narrower and worth naming: no check watches this table's APPEND path, so "a row was written when one should have been" is still only observable by using the app. (This used to cite `test-updates.js` as naming Edit Log in prose; #174 deleted that script.)

### A rollback that does not finish (#188)

Four rollbacks in `app/prs/[prId]/actions.js` put a turn back when something in it
throws. None of them could say it had failed, so the base was left in a state
neither outcome describes and the screen described the other one.

- **THE COUNT IN THE ISSUE BODY WAS TWO AND THE COUNT IS FIVE, which is worth
  keeping because the second shape is the one that reads as handled.**
  `.catch(() => {})` at least looks like a decision; `Promise.allSettled` looks like
  care taken, and it is the same silence — the results were built and thrown away.
  Three sites of the first, two of the second in `editAndContinueAction`, and two
  more of the first in `finishTurn`, which runs inside the same turn. Ten sites
  across the file once `approveAction` and `returnForCorrectionAction` are counted.
- **`Please try again.` DOES NOT MERELY MISDESCRIBE THE STATE, IT COMPLETES IT, and
  this is the half of the issue its body did not carry.** Traced through the code
  rather than reasoned about: the form still holds the submitted values, and a
  second submit re-reads the items — which, when their restore failed, now hold the
  edited values. `changes` comes out empty, so no `PR Edit Log` row is written, and the
  turn commits. The edit is applied and its log is gone, permanently, which is
  exactly the outcome the issue exists to prevent. The Shipping Fee case is the same
  shape; a failed destroy instead leaves the retry writing a second set of history
  entries or a second Quotation.
- **SO THE REPORT IS NAMES, NOT A COUNT.** One failed restore and three leave
  different states in different places, and which promise rejected is already known
  at the moment it rejects — a count would say how bad and never where, sending the
  reader to open all eight. The INSTRUCTION is single, because what the person must
  do is the same in every case; only the list varies.
- **THE WORDS FOLLOW `SEND_REFUSAL.recordFailed` (#281) BECAUSE IT IS THE SAME CLASS
  OF NEWS** — a write that partly landed, where the reader's instinct is the wrong
  move. What happened, do not repeat it and why, ask for the record to be corrected
  in Airtable. The negative imperative was checked against the app's other refusals
  before being written: the house mood is imperative (`Add at least one item.`,
  `Reload the form and try again.`) and #179's split puts this on the instruction
  side rather than the state side, so the strength did not have to be traded away.
- **#206's SHAPE APPLIES BY HALVES, AND THE HALF THAT DOES NOT IS THE INSTRUCTIVE
  ONE.** Its first half — the settled results are read rather than discarded — is
  this fix. Its second — a failed child throws before the parent goes — is wrong
  here: what fails is the ROLLBACK, so there is nothing after it to abort, and a
  throw would replace the sentence with the framework's error page, taking from the
  reader the only account of what happened. `deleteDeliveryAsUser` can throw because
  its operation stays retryable; this one is reported precisely because it does not.
  The destroys also stay concurrent, since the ids are independent rows with no
  parent among them.
- **ONE PLACE WHERE #206's PRECONDITION DOES APPLY: a Quotation an unrestored item
  still points at is kept.** Airtable clears a link when its target is destroyed, so
  destroying it would take that item's `Quotation` to empty — and unlike every other
  failure in that catch, that one is unreportable, because the record the reader
  would be sent to look at is the record that went. Keeping it leaves a quotation on
  the request, visible on the page and named in the sentence. Its Blob object is kept
  with it for free: #140's cleanup is scheduled below the catch and a rolled-back turn
  never reaches it.
- **THE REPORT NEVER REACHES AIRTABLE.** Recording a failed Airtable write into
  Airtable is not a report but a second failure, and `PR Edit Log."Field"` is a closed
  list only a hand edit can extend (#181), so the row could not be written even on a
  healthy base. Screen and server log, and the two carry different things: the screen
  names what is left, the log adds the record ids, because the person relaying the
  sentence is not the person who will open the base.
- **WHY ALL FOUR ROLLBACKS AND NOT THE ONE THE ISSUE NAMES.** `finishTurn` re-throws
  into the edit turn's own catch, so its two silent restores are that turn's; and it
  is shared with `approveAction`, which would then report its callee's failures and
  not its own. `returnForCorrectionAction` is forced by nothing and was taken anyway,
  because leaving it is the second mutant this work guards against — the catch fixed
  in one place while another site goes on swallowing, in the same file.
- **WHAT IS STILL SILENT, and it is deliberate rather than missed:**
  `lib/poGeneration.js` has the identical shape and is `backlog.md`'s own entry
  (#296), and five creation rollbacks elsewhere discard settled destroys. Those leave
  an unreferenced record rather than a half-applied edit, which is a different
  judgment about what to say.

### The three moments on the request form were already the reader's (#374)

Every screen that draws a stored instant had it resolving against the server;
this form was the exception, and the exception carried a different defect.
`PRForm.js` is a Client Component, so its two draft labels and its duplicate
warning called `toLocaleString` in the browser and got the reader's zone right.

- **AND GOT IT RIGHT TWICE, WHICH IS THE PROBLEM.** A Client Component is
  server-rendered first, so the same call ran once on the server and once on the
  browser — different zones, same node, which is a hydration mismatch. The resume
  prompt is the reachable one: `showResumePrompt` is `useState(Boolean(initialDraft)
  && !autoResume)`, so it is true during the server render whenever the requester
  has a draft, and the timestamp inside it is in the first paint.
- **IT IS INVISIBLE ON ONE MACHINE, WHICH IS WHY IT SURVIVED.** In development the
  server and the browser are the same computer in the same zone, so the two renders
  agree and nothing warns. It separates on Vercel, where the server is UTC — the
  same split that made the Server Components wrong, reaching this file by another
  route.
- **NOT DEMONSTRATED ON THIS BASE, AND THE REASON IS A WRITE.** The prompt needs a
  `Draft` purchase request and there are none; raising one is a base write this
  issue did not take. What WAS demonstrated is the mechanism, on the component this
  issue adds: telling its server render it was the browser reproduced
  `Hydration failed because the server rendered text …` on `/prs/[prId]` with the
  dev server in UTC, and the shipped shape produces no such message on any of the
  four screens.
- **SO THE FIX IS THE SAME COMPONENT THE SERVER-RENDERED SCREENS TAKE**, rather
  than a second arrangement for a form that was already half right. Nothing is
  formatted until the render is the browser's, so the markup and the render that
  hydrates it are identical by construction.
### Picking a category on the signer's edit form (#367)

#355 locked `Item Name` on Edit and continue because the name is composed from
the category and a signer changing one without the other would reach the vendor
on a purchase order. The lock closed that window and took a signer's ability to
change the item with it, so a wrong item cost a return to the requester. This
gives the signer the same four-level picker the requester used.

- **THE LOCK WAS THE SCREEN'S AND NOT THE CODE'S, WHICH IS THE PART #355 DID NOT
  KNOW.** `editAndContinueAction` went on diffing `itemName` out of `itemsJson`
  and writing whatever the submission carried; a Server Action is directly
  callable, so the read-only input constrained a browser and nothing else. The
  window #355 believed it had closed was open the whole time. It closes here by
  REMOVING the key from `ITEM_FIELD_LABELS` rather than by leaving it unused —
  the diff walks `Object.keys` of that map, so a key that stays is a write that
  stays. The only thing this action can now put in `Item Name` is the label of a
  category that was picked.
- **THE ROLLBACK RESTORES THE CATEGORY BESIDE THE NAME, AND THE BROWSER RUN
  PROVED IT RATHER THAN THE READING.** The turn's restore list gained
  `categoryRecordId`; without it a failed turn would put the old NAME back over
  the new CATEGORY and report the rollback as clean — this issue's own defect,
  reached through its own error path. It was exercised by accident and for real:
  the 422 above rolled a live turn back, and the record came back holding
  `Stainless Steel (SUS) > Tube > SUS 316L > EP ERW` in both fields.
  `offline/rollback-report.mjs`'s field count moved 7 → 8 for it, which is that
  assertion doing its job.
- **THE REFUSAL IS ABOUT THE PICK, NOT ABOUT THE ROW, and that is where this
  screen parts from `createPRAction`.** Submitting a request refuses any item
  without a category, because that is the moment every row has to be complete. An
  edit turn is later than that moment: a signer who cannot settle a row somebody
  else raised would be unable to EDIT a request they can still APPROVE outright,
  since approving touches no item. So a row that arrived without a category and
  was left alone passes, a half-picked one is refused, and **clearing a stored
  category is refused too** — without that clause an empty picker would silently
  save the stored category back, a screen disagreeing with its own write. The
  rule is `lib/materialCategory.js:refuseUnsettledCategory` and the four states
  are pinned in `offline/category-picker.mjs`.
- **THE TREE IS READ ONLY WHEN IT IS THE READER'S TURN, AND THAT IS WHERE #355's
  MEASUREMENT DOES NOT CARRY OVER.** `/prs/new` pays `getCategoryTree`'s 8 list
  operations on every load because everyone there is entering items. This page is
  a reading surface for everyone `canViewPR` admits and an acting surface for one
  of them, so the cost follows the turn. **Measured 2026-09-14 on
  `HYE-PR-260911-01`, both figures on the same record and the same commit:** as
  the current signer `16 ops, 8 tables, 8 repeats (list 15, find 1)` with
  `Material Categories ×8 (list 8)`; as an Admin who is not up, `8 ops, 7 tables,
  1 repeats (list 7, find 1)` with no `Material Categories` row at all. So a
  reader pays nothing and the actor pays 8, all of them `list` on one table,
  which is this file's paging reading rather than a 1 + N.
  - **THE 8 IS LOWER THAN #193's RECORDED 11 AND THE RECORD IS NOT WRONG.** This
    request carries no quotation, no edit request and no edit log row, and
    `findChildRecords` on an empty link array costs zero — so three of the page's
    child levels were free on the record measured. The figure to carry forward is
    the DELTA, which is the tree and is the same on any record.
- **WHAT THE BROWSER RUN COULD NOT REACH, stated rather than implied.** The
  successful write — the pair landing on the record and the `Category` row
  appearing in the History — needs the Airtable choice, and the run happened
  before the hand step. What it did reach: the picker opening on the stored path,
  a deeper level clearing when its parent changes, the refusal sentence on a
  half-picked row with nothing written, and the rollback above.
- **EVERY `<select>` IN THIS APP RESETS AFTER A SERVER ACTION RETURNS, AND IT IS
  NOT THIS ISSUE'S DOING.** Measured with a `data-probe` attribute on the render:
  after a refusal React had rendered `value="01"` on the first level while the DOM
  read `""` and `selectedIndex` 0 — React 19 resets the form when an action
  settles, and a controlled `<select>` carries no `selected` ATTRIBUTE for
  `form.reset()` to fall back to, so it lands on the placeholder. **The Unit
  select on the same form does it too**, which is what dates the behavior to
  before this branch and scopes it beyond this screen: `/prs/new`'s Job,
  Discipline, Vendor and Unit controls share the shape. Component state survives
  intact — the hidden `itemsJson` still held the picked codes — so nothing is
  written wrongly; what the reader sees after a refusal is emptier than what the
  form holds. Left alone here deliberately: the fix belongs once, wherever the
  form action is bound, rather than inside one picker.

### Quotations

- **`File` is written in exactly one place: `createQuotation` (#142).** `updateQuotation` handles the code only and deliberately has no `file` parameter. The reason is measured: re-submitting an attachment url Airtable itself gave us returns success and silently empties the field once that url has expired, so every additional writer is another way to lose a file. Enforced by `scripts/tests/offline/source-shape.mjs` — one `File` property in that module, inside `createQuotation`, and none in `updateQuotation`.

### The out-of-list Unit value on the PR form

- **Out-of-list existing values are preserved as an extra option only in `EditAndContinueForm.js`** (`app/prs/[prId]/EditAndContinueForm.js`, the `!CANONICAL_UNITS.includes(row.unit)` branch). `PRForm.js` maps the canonical list flat, so a hydrated Draft item holding an out-of-list Unit renders with nothing selected — the value survives a save untouched (it is still in React state, and `updateItem` only fires on change) but *displays* as blank, and is overwritten if the Requester touches that dropdown. Currently unreachable: no out-of-list value exists on any of the four fields. Not fixed here — it is PR-form scope, tracked separately.

### Merging identical item rows (#170)

Two rows agreeing on name, size, unit, unit price, remark and quotation are one
`PR Item` with a combined quantity. The rule is `lib/prItemMerge.js`, the guarantee is
`parseFormState`, and the form previews the same function rather than applying it.

- **MERGING IS NOT FOLDING, AND THE THREE FOLDS ARE NOT REUSABLE HERE.** #241
  (`lib/invoiceItemFold.js`, `lib/invoiceDeliveryEntries.js`) and #238
  (`groupRowsByItemAndOrder`) leave the records alone and regroup them per screen,
  because the split they read is real: a corrective split and an over-delivery
  boundary are per-row judgments the data has to keep. Here there is no judgment on
  the row and nothing to preserve — two identical rows are one item typed twice — so
  the fix is at the write and no screen folds afterwards. The direction is the
  opposite one and the modules are cited rather than shared.
- **THE MERGE IS IN `parseFormState`, WHICH IS EARLIER THAN IT LOOKS LIKE IT NEEDS TO
  BE.** `persistPRFromForm` is the write and would have been the obvious home, but
  `findDuplicatePR` (#61) runs before it and keys a row on name + qty + unit price: two
  rows of 5 against a stored 10 are different keys, so an unmerged submission would
  miss the duplicate warning for a PR that was itself merged on save. Parsing is the
  one point both actions pass through, so everything downstream — per-item validation,
  the duplicate check, the write — sees one set of items.
- **THE FORM PREVIEWS AND DOES NOT MERGE, and it could not merge even if that were
  wanted.** The guarantee has to be the action's: a Server Action is directly callable
  and a client bundle is not something this app controls. And the hidden `itemsJson` is
  serialized at render, so merging in a submit handler would not reach the FormData the
  submission already carries. So `describeMerge` reads the same function the action
  writes with and the notice states what WILL happen — which is also the only side of
  the save it can state, since a Draft save returns a confirmation without
  re-hydrating the rows, so an after-the-fact notice would describe rows still on
  screen unmerged.
- **THE KEY'S NORMALIZATION IS #18's, AND THE ASYMMETRY IS THE WHOLE POINT.** Name and
  Size compare through `normalizeItemText` AND lower case, because `getMaterialByKey`
  looks a material up with `LOWER(TRIM(...))` and `upsertMaterial` locks on the
  lower-cased triple: `Pipe` and `pipe` are ONE material, so leaving them as two rows
  would produce the two-ordered-items-one-material state this issue exists to remove.
  The comparison follows the LOOKUP, not the storage, and the stored text stays as
  typed (#18: it is printed on the PO PDF). A remark is trimmed and its whitespace
  collapsed but keeps its case — nothing forces otherwise and it is prose the vendor
  reads, so merging `URGENT` into `urgent` would drop one human's words. Both
  directions are asserted, since tidying one into the other is the plausible later
  edit.
- **THE UNIT PRICE COMPARES AS A NUMBER AND A MISSING ONE IS A VALUE.** `10` and
  `10.00` are one price. A blank or unparseable price normalizes to one token rather
  than `NaN`, which never equals itself — a Draft save runs no per-item validation, so
  two price-less rows are reachable and would otherwise never merge.
- **THE QUOTATION IS IN THE KEY, WHICH THE ISSUE'S FIVE FIELDS DID NOT COVER.** Which
  of the PR's quotations a row cites is part of what makes two rows the same row, since
  a merge across two quotations would drop one of the links #67 put there. Same grade
  of fact as the unit price: one material quoted twice is two quotes, and which quote a
  row came from is what a person needs when checking the PR against the vendor's paper.
- **EVERY SAVE MERGES, INCLUDING A DRAFT'S, and that follows the generation model
  rather than fighting it.** `persistPRFromForm` already destroys and recreates
  `PR Items` on every re-save (#142 reconciles only Quotations), so merging each time
  costs nothing new — and it keeps a re-opened Draft and the final PR identical.
  Merging only at submit would make those two disagree.
- **`isEmptyItemRow` MOVED INTO THE RULE'S MODULE RATHER THAN BEING RESTATED.** The
  merge needs the same answer the write path needs, and the first draft of this module
  had a second copy that forgot `unit` — a row with only a Unit picked would have been
  treated as untouched. One implementation, imported by both, and the offline check
  pins the `unit` clause directly.
- **WHAT NO CHECK MAY CLAIM, and the issue says so: existing PRs are not backfilled.**
  So "no PR on this base carries the same item twice" is not a property of the base.
  What is checkable is the rule over rows plus one source-shape assertion — that
  `parseFormState` calls the merge and neither action merges anywhere else — and that
  assertion is the only place the GUARANTEE rather than the arithmetic can be pinned
  without a dev server.
- **THE WRITE SIDE IS MEASURED, and this is `saveDraftAction`'s first recorded
  figure.** A browser reaches a Server Action through the form it is bound to, and the
  label #224 opened prints, so a before and after on one saved Draft is a real
  measurement — what a browser cannot do is call the action with fabricated input,
  which is a separate issue. Three rows of one material (two identical, one at another
  price) saved as a Draft: **13 ops before, 10 after**, with `PR Items` going 5 to 3
  (create 3 to 2, list 2 to 1 — the second create's child-ID query goes with it).
  Verified on `TESTQA-01`, the manual QA job, and the Draft was deleted through the
  app's own `deleteDraftAction`; 0 rows carrying `170-TEST` remain.
- **Not in this issue:** existing PRs, `editAndContinueAction` (which diffs items in
  place by record id and never re-creates a generation, so it has no equivalent save
  point), and the workaround the issue body cites — see below.
- **THE ISSUE BODY'S SECOND PARAGRAPH IS STALE AND THIS BRANCH DOES NOT ACT ON IT.**
  It says two `PO Items` of one material in one PO leave which one undecided, "the
  sub-case #162 records and works around". #165 removed that: `sortCandidates` is a
  total order, #162's `narrowed.length === 1` test is gone rather than widened, and the
  deliveries note records in its own words that this "does not wait on #170". There is
  no workaround left to preserve — what remains is a total order that resolves the
  ordered item by fill order, which merging neither helps nor harms.

### A request that has not found its requester yet (#272)

A site buys material directly from a vendor with no order behind it. The invoice
reaches the office, `/invoices/new` has no order for it to charge, and the office
cannot raise the request either — so the office records what the invoice says on a
new table, `Direct Purchases`, and the site raises the request from it.

- **IT IS A TABLE FOR A STRUCTURAL REASON, NOT A PREFERENCE, and the reason is one
  field.** `Purchase Requests."Job"` is a Lookup THROUGH `Discipline` — the two words
  in this bullet said `Line`, which #280 renamed the table out of and this sweep
  missed; corrected per #181 by #314. The office learns
  the Job by telephone and cannot learn the discipline — #19's boundary, that a decision
  made before a request exists cannot be helped by a form inside one — so a request
  record physically cannot carry the one value that decides which site sees the row.
  Two further reasons stand behind that one and would each need an exception of its
  own: `canViewPR`'s first clause shows a `Draft` to its Requester and nobody else,
  which is what protects every unfinished request in the app, so an office-owned
  Draft would reach the site by widening a rule that has nothing to do with this
  case; and `Requester` is written at create, while the whole point is that the
  requester is the site staff who bought the material.
- **AN INVOICE ENTERED EARLY WAS THE OTHER CANDIDATE AND IS CLOSED BY #278.** The
  office is holding an invoice, so recording it as one is the obvious thought. But an
  `Invoice Items` row requires an ordered item now, and an invoice with no items is
  not a state this app has — it would also enter the invoice list, the variance
  checks and the awaiting-delivery walk, each of which would need a case for a
  document that charges nothing.
- **NO ITEMS ON THE TABLE, AND THE MEASUREMENT DECIDED IT.** `/invoices/new` locks
  its items section until at least one order is selected (`itemsReady`), so in the
  dead end that produces these rows the office has typed no items and cannot: a
  fifth items table would have to come with a form of its own, a sixth `Unit` select
  that only `add_unit_options.py` may create, a ninth `CHILD_KINDS` entry — and it
  would break the sentence #278 leaned on, that only a purchase request takes typed
  items. The invoice travels as the `File` and the requester types the items into
  the request, which is where a human types one. What the strip would lose is a row
  that says what was bought, and `Notes` carries that instead: it is where the
  office writes what it learned on the telephone. Adding the child table later is
  purely additive — the claim would seed `PR Items` from it instead of leaving them
  empty — so nothing here forecloses it.
- **NO STATUS FIELD AND NO KIND FIELD.** What a row is waiting for is read from
  `Purchase Request` and, when that is set, from the request's own `Status`; the
  request's kind is read from the same link. Both are the rule this issue settled
  for the overage side too — a link that exists is the fact, and a field beside it
  is a second copy nothing would notice going stale.
- **What it costs: one ID family.** `HYE-DP-YYMMDD-##`, the fifth in `ID_KINDS`, and
  it takes the daily-prefix rule unchanged — see `id-generation.md` for why this is
  the family whose own record carries the most tempting date field to count instead.

### Listing and offering are two questions (#272)

Both strips above `/prs` hand a record to somebody who will raise a request from
it, and both had the same hole until this issue: the row left the list the moment
anybody pressed the button.

- **THE DEFECT WAS LIVE AND IS WORTH STATING PLAINLY.** `awaitsOverageRequest`
  answered false as soon as any request covered the excess, `Draft` included, and
  the strip selected on it alone. So the first person to press the button took the
  row off everyone else's screen — and if they then closed the tab, the excess was
  visible on no screen at all: `canViewPR`'s first clause shows a `Draft` to its
  requester and nobody else, the strip had let it go, and the delivery detail's
  banner is the only other place it appears. The direct purchase would have
  inherited exactly that, since its claim also produces a Draft.
- **SO THE ONE TEST BECAME TWO, AND THE RULE IS `lib/prWait.js`'s.** A record is
  LISTED until the request it produced has been submitted; the control is OFFERED
  only while nothing covers it. Between them is a state with a chip and no button:
  somebody has a draft, nobody has been asked to approve it, and the row says so
  with their name on it. The row leaves when the request reaches `In Review`,
  which is the moment `/prs` itself starts carrying the fact under `canViewPR`.
- **THE NAME IN THE CHIP COMES FROM `lib/userName.js`,** which is what every
  other screen that prints a person reads. It is their FIRST name (#381) — this
  chip reports somebody rather than asking the reader to pick them, and the
  pickers and the two vendor-facing surfaces are the places that print both
  names. **This paragraph named `Users."User Name"` and said the value was the
  email's local part because nothing else set it**; that field is `First Name`
  now, typed by its owner at their first sign-in, and the local part survives
  only as a fallback for a row nobody has named yet. Naming people a second way
  here would still be the mistake.
- **THE TWO CLAUSES ARE ORDERED IN `overageStillWaiting`, and the case that forces
  it is #167's own:** a withdrawn overage ORDER reopens a row whose request says
  `PO Signed`, so `overagePRState` is asked first and only a row nothing offers
  falls through to the stage. Asking the stage first would drop that row silently.
- **WHY TWO STRIPS RATHER THAN ONE.** They were weighed as one list and kept
  apart: the rows come from different tables under different gates, the actions
  take different records, and the refusals are different closed sets, so a merged
  strip would need a row that is two row types and an action that is two actions —
  the duplication a merge removes, moved inside. What they share is shared as
  code: the pattern, the wait rule, and #256's ordering.
- **THE CHECK IS `offline/pr-wait.mjs`, AND ITS FIRST ASSERTION IS THE MUTANT.**
  Collapse the two answers back into one and every screen still renders: either
  every row has a button, or every row vanishes the moment somebody drafts a
  request — the state that shipped. So the first thing asserted is that the two
  answers diverge at all, before any per-stage detail. Verified by mutation:
  making `stillWaiting` mean `requestOfferable` fails it on the first line.

### A save that names a request asks whose it is (#440)

`persistPRFromForm` took `existingDraftRecordId` off the form and rewrote the request
it named, and `getPRByRecordId` returns any request by id — so a call naming someone
else's request, or one already submitted, rewrote it, and `createPRAction` then put it
back to `In Review` at step 1 and mailed its first signer. `editAndContinueAction`
linked an item to whatever `existing:` quotation id it was handed.

- **THE SAME DEFECT HAD A SCREEN PATH, WHICH IS WHAT MADE THE WORDING MATTER.** The
  same draft open in two tabs: once one tab submits, the other's `Save draft` rewrote
  the request's fields and rebuilt its `PR Items` and `PR Signers` as a new generation
  — fresh `Pending` signer rows, so every approval already given was destroyed — and
  its `Submit PR` reset the chain. A draft deleted in the other tab made every save
  here fail with `Couldn't save the draft. Please try again.`, which no retry could
  change. So two of the refusals below have readers who forged nothing.
- **COUNTED OVER EVERY WRITE THAT TAKES A RECORD ID, AND THE BODY'S THREE WERE THE
  WHOLE OF IT.** All sixteen `"use server"` files and eleven route handlers: the
  delete, the withdrawal, the order's withdrawal, send and document, and every signing
  turn already asked the owner before writing, and the child ids a save carries —
  `quotations[].recordId` (#438) and an edit turn's item ids — were already held to
  the parent. What had nothing asking was `existingDraftRecordId` on the two save
  paths and the `existing:` choice.
- **ONE JUDGMENT FOR THE THREE DRAFT WRITES, IN `lib/prRequester.js`.** Saving and
  submitting re-target the draft a form holds and deleting removes it, and all three
  ask whether the request is the reader's own Draft. `deleteDraftAction` asked status
  before identity and said `You can only delete your own drafts.` to a stranger, which
  confirmed that a request by that guessable PR ID existed; it takes the same
  `ownDraftRefusal` now. **Identity first**: somebody else's request, in any status,
  answers exactly as an id that resolves to nothing — `That draft no longer exists.`,
  the words that delete already had — and `This draft has already been submitted. Open
  it from the PR list.` is said only to the requester, who can open their own request
  in every status anyway. One sentence for both would tell the second-tab reader that
  a request they can see does not exist.
- **THE REQUESTER IS THE FIRST LINKED USER, AND ALL TWENTY-EIGHT READS OF THE FIELD
  GO THROUGH THAT MODULE.** Ten sites compared `pr.requester?.[0]` with the reader and
  #248's `getDraftsByRequester` asked `includes`; the module's header carries why the first
  element won and what membership would have handed a pasted second user. Moving only
  the comparisons was weighed and refused: `prSigning`'s requester turn binds the
  first element to a variable and compares it elsewhere, which no check can follow,
  while "nothing else reads `.requester`" is one that `offline/pr-requester.mjs` holds
  with no exemption list — `lib/userName.js`'s shape from #381.
- **FIRST, AHEAD OF THE DUPLICATE CHECK.** The judgment lives in `resumedDraft` and
  both save actions call it straight after parsing, so nothing is computed about the
  named record before its owner is known. #438 had put the draft's reads at the head
  of `persistPRFromForm`, but `findDuplicatePR` runs earlier than that on a submit and
  leaves the named request out of its comparison — so a stranger's unconfirmed submit
  could come back as a duplicate warning naming another request, its requester and its
  date, in the refusal's place. `persistPRFromForm` now takes the judged draft rather
  than reading one. The warning's own habit of naming a request its reader may not see
  is older than this and is in `backlog.md`.
- **A READ THAT THROWS IS `gone` ONLY WHEN AIRTABLE ANSWERED ABOUT THE RECORD.** An id
  that resolves to nothing throws rather than returning null — `403 NOT_AUTHORIZED`,
  for one that never existed and for a deleted one alike — and the key had read the
  session one operation earlier, so the 403 is about the record. A 5xx or a lost
  connection keeps the retryable failure it always had, because reading it as `gone`
  makes the form let go of a draft that still exists and the next save makes a second
  one. **An id of another table does not throw at all**: `find` hands back that
  table's row (`airtable-access.md`), so identity is what refuses it, and a `Users`
  row maps to `status: "Active"` — which status asked first would have called
  `submitted`.
- **`gone` LETS THE FORM GO OF THE DRAFT; `submitted` DOES NOT.** A draft that is gone
  can only keep what was typed as a new request, so the form clears its record id and
  says so, exactly as it does when this tab's own list deletes the open draft — one
  `detachFromDraft` for both. A submitted draft must not become a second request for
  one in review, so the form keeps it and the sentence sends the reader to the list.
  **The list's own path had a dead end of its own, from #438 on**: the entries it
  hydrated kept the gone draft's quotation record ids and Airtable's urls for their
  files, so the next save was refused as `changedElsewhere` and told the reader to
  reopen a draft that no longer existed. `lib/quotationReuse.js:detachQuotations`
  releases them — every record id goes, a file that came from the draft goes with it,
  a file picked this session stays — and the notice says when files went. **The
  draft's row leaves the form's list of saved drafts on both paths too**, which the
  browser walk is what found: the list's own delete had always dropped the row, and a
  `gone` answer left it, so the notice said the draft was deleted beside a list
  still counting it.
- **THE EDIT TURN ASKS ABOUT THE QUOTATION IT WOULD LINK, AND NOTHING MORE.** The
  request's own quotations are `pr.quotationRowIds`, on the record `loadPRContext`
  already read — the reverse link the page built the dropdown from — so the question
  costs nothing. Only a choice that differs from the item's stored link is asked,
  because only that one is written; refusing an unchanged stored link would lock the
  whole turn over a row somebody else linked wrongly. `readQuotationChoice` is the one
  reader of the `existing:`/`new:` encoding, before the `try`, and the loop inside it
  walks what was judged.
- **WHAT IT COSTS, MEASURED ON THE DEV SERVER'S LEDGER.** A refused save, submit or
  delete stops at 2 operations — the session and the one request read. A refused edit
  turn stops at 8, which are the reads that turn already made before its `try`. The
  accepted paths read what they read before: the one request read moved to the front
  of the save rather than being added to it.
- **`offline/owner-before-write.mjs` HOLDS THE ORDER FOR EVERY READ OF A REQUEST BY
  ID.** Its inventory classifies each call, its judged rows require the judgment to be
  asked about the record read, outside every `try`, before the first side effect and
  before anything else touches the record or its id — and what counts as a side effect
  is derived from `base(...)` writes, mail and Blob calls rather than listed. Two rows
  carry an excuse from the last clause, `withdrawAction` and `withdrawPOAsRequester`,
  which test for existence before ownership; `backlog.md` has why that is left, and
  the excuse fails the check the day it stops being needed.

### Three kinds, and where the kind lives (#272)

A signer approving a request is making one of three different decisions —
whether to buy something, whether to accept an excess that already arrived and
was invoiced, or whether to accept a purchase somebody already made — and until
this issue the screen said nothing about which. #167's request carried its kind
in a sentence written into `Notes` and in a banner derived on its own page; the
list could not tell them apart at all, and the third kind did not exist yet.

- **THE KIND IS TWO LINKS AND NO FIELD, and the alternatives were weighed rather
  than skipped.** A `Kind` select on `Purchase Requests` was the obvious shape and
  is the one this rejected: an overage request already HAS a record pointing at it
  (`Delivery Items."Overage PR"`), so a field would be a second home for a fact the
  base already states — it would need writing by every path that ever creates one,
  nothing would fail if a future path forgot, and the request would then read as
  ORDINARY. That is the worst failure available to a mark whose only job is to say
  "this one is not". Deriving everything was the other option and it could not
  express the third kind at all: at the moment the office records a direct purchase
  there is no invoice record, no delivery and no order to derive from. So the third
  kind got a record of its own — which is `Direct Purchases`, and which is also
  what makes the link symmetric with the overage side.
- **WHICH IS WHY THERE IS NO CHECKBOX.** An earlier pass of this design had one,
  `Already Bought`, set by the office's write. Once the hand-off became a table
  with a link back to the request, the checkbox was a second copy of what the link
  said, written in the same transaction — exactly the shape the paragraph above
  rejects. What it would have bought is a `filterByFormula`, and `/prs` filters in
  the browser over rows it already holds.
- **BOTH LINKS ARE FREE.** `recordToPR` carries both arrays because Airtable's
  symmetric field puts them on the record, so `prKind` costs no query on any screen
  holding a mapped request — `/prs` reads it for every row and `/prs/[prId]` for
  one, and neither spends an operation.
- **THE WORDS ARE `Overage` AND `Direct purchase`, AND ORDINARY IS SILENT.** The
  ban on `correction` is in `naming.md`; what belongs here is the silence. A mark
  on every row makes the exceptional rows ordinary, which is the failure the mark
  exists to prevent — the same judgment #232 made when it deleted a caption whose
  only content was "nothing unusual here", and the same one every strip makes by
  rendering nothing when there is nothing. The silence is a computed answer: the
  derivation runs on every request and returns `ordinary`.
- **THE SIGNER GETS A SENTENCE, THE LIST GETS A MARK, AND ONLY ONE KIND NEEDS
  BOTH.** A chip cannot say what approving means, and that is the whole ground of
  this issue, so the direct-purchase kind carries a sentence on the request's own
  page: the material was bought before any request existed, here is the vendor and
  their own invoice number, and approving accepts a purchase already made. The
  overage kind deliberately has none — #167's banner is already in that slot and
  says more than a kind sentence could, so a second one would be two voices for one
  fact.
- **THE CHECK IS `offline/pr-kind.mjs`, AND ITS FIRST ASSERTION IS THE MUTANT.** A
  deriver that always answers the same kind leaves every screen looking ordinary —
  no chip anywhere, which is exactly the ordinary day — or puts one word on every
  exceptional row, which reads as a decision. So the first thing asserted is that
  the three inputs produce three DIFFERENT answers. Verified by mutation: replacing
  the body with `return PR_KIND.ordinary` fails it on the first line. The
  precedence when both links are set is pinned too, though the app cannot produce
  such a request: "cannot happen" is not a reason to leave the answer to the order
  two clauses were written in.

### What the request list filters by (#324)

Five axes, from a bar `/prs` shares with the other three document lists. The rule that decides which closed sets become filters is `lib/listFilters.js`, and its derivation is in `docs/notes/deliveries-and-invoices.md`; this is what it settled here.

- **THE PICKERS' OPTIONS CAME FROM THE READER'S ASSIGNMENTS AND NOW COME FROM THE VISIBLE ROWS, WHICH IS `/pos`'s RULE ADOPTED RATHER THAN A NEW ONE.** `docs/notes/purchase-orders.md` recorded the divergence when that page was written: assignments are wrong in both directions. An assignment with no request on it is an option that empties the table, and a request visible only through `canViewPR` clause 5 or 6 — a signer, or an edit-request recipient, neither of which implies assignment — was a row in the list that no filter could reach. That note called the fix "a UI decision", made it where the page was new, and said the divergence would close here. It leaks nothing: every job and every vendor named is already on a row this reader can read, in a column they can read it in.
- **`Requested by me` RATHER THAN `Raised by me`, AND THIS LIST IS THE ONE THAT MOVED.** The two request-side lists read one field — `Purchase Requests."Requester"`, from the row here and through the parent request on `/pos` — so they may not be two words, and `/pos` said `Requested by me` while this said `Raised by me`. The tie-break is which word is true of the OTHER list's row: an order is generated when a request is fully approved and #138 records that it carries no requester of its own, so nobody raises one and `Raised by me` is false there. `Requested by me` is true of both, and on this list it matches the `Requester` column head exactly where `Raised by me` introduced a verb no column uses.
  - **BOTH BRIEFS WERE QUOTING THE LOSING WORD.** `docs/briefs/prs.md` and `docs/briefs/pos.md` each said `Raised by me`, so the PO brief had been false about its own screen since it was written — found while settling this and corrected here rather than filed (#181).
- **THE KIND IS A FILTER AND THE RULE PRODUCES IT.** `prKind` reads whether two of the request's own reverse-link arrays are non-empty and reads no field of any other document, so it is a state the request is in rather than a wait: a direct-purchase request never becomes ordinary. `lib/prKind.js` had already written down that the kind cannot be selected in a `filterByFormula` and that this costs nothing because "`/prs` filters in the browser over rows it already holds" — which is exactly the arrangement the filter uses.
  - **TWO OPTIONS AND NEVER `Ordinary`.** `PR_KIND_COPY.chip` is deliberately `null` for the ordinary kind, on the ground that "a word on every row makes the exceptional rows ordinary". A select offering `Ordinary` would coin that word in the one place a reader would then meet it. The labels are read off `chip` rather than written again, so a mark and the option that narrows to it cannot come apart. A select that is not a partition of the rows is this screen's existing shape: the status select already offers four of five values, because a Draft never reaches this list.
- **THE THREE EMPTY STATES, AND `/prs` HAD TWO.** The brief recorded the defect itself — the second sentence "covers both an empty base and a reader whose scope is empty, and it does not distinguish them" — and the fix costs nothing, since `getSubmittedPRs()` returns every submitted request before the gate and the page was already holding that array. The rule is `lib/poListView.js`'s, written when `/pos` was built and obeyed only there until now.
- **THE BAR IS DRAWN FROM THE ROWS BEFORE ANY FILTER.** Keyed off what survived, it disappears exactly when a filter has emptied the list — the one moment `Clear all filters` is what the reader wants — and leaves them editing the address bar. `offline/list-filters.mjs` walks the implication exhaustively rather than reading it off the code, because the mutant is one identifier.
- **NEITHER STRIP IS NARROWED.** `OverageStrip` and `DirectPurchaseStrip` are gated by the delivery rule and by job access rather than by `canViewPR`, and each heading carries a count of what is waiting; a filtered count under an unfiltered sentence is the heading lying.

### What the request list searches (#325)

A box above the bar, on `/prs` as on the other three. The rule that decides what a list searches is `lib/listFilters.js` and its derivation is in `docs/notes/deliveries-and-invoices.md`; this is what it settled here.

- **A REQUEST IS AN INTERNAL DOCUMENT AND HAS NO SECOND NAME, WHICH THE LIVE SCHEMA CONFIRMS.** `Purchase Requests` holds `PR ID` and nothing else a person could be reading off paper. Nobody outside the company ever names a request: the vendor's involvement is the quotation, which happens before the request exists (#19), and the vendor never sees the request itself.
- **TWO VENDOR-SIDE NAMES ARE ONE LINK AWAY AND NEITHER IS SEARCHED.** `Quotations."Vendor Quotation Code"` is on the quotation's row, and a request may carry several; `Direct Purchases."Vendor Invoice Code"` is on the direct purchase's row, and only a request of that kind has one at all. Both name ANOTHER document, which is the far side of the rule's line, and both would cost this page a read of a table it does not fetch.
  - **THE SECOND ONE IS THE TEMPTING CASE AND IS WORTH THE SENTENCE.** #272's direct-purchase request exists precisely because a site bought material against a vendor's invoice, so a reader holding that invoice really is holding a name for something. What they are holding names the DIRECT PURCHASE — the record `lib/directPurchaseClaim.js` already puts in a strip above this list, with the code in it — and that strip is where the reader carrying one looks.
- **THE `Kind` MARKS ARE NOT SEARCHABLE WORDS.** `Overage` and `Direct purchase` are the select's business (#324); the box matches names, and a mark is a state.
- **NEITHER STRIP IS NARROWED BY THE BOX**, for the reason neither is narrowed by the bar: each heading carries a count of what is waiting.

### Refusing a request figure the order cannot carry (#308)

#254 put two predicates in `lib/variance.js` and enforced them on the invoice write path, on the ground that the guard sits downstream of every copy. It does, and that premise is untouched here. What it could not stop is the timing: a figure typed on a request was accepted, frozen into `PO Items` at approval, printed on the PDF the office sends the vendor, and refused only when somebody entered the invoice for it — an order that becomes uninvoiceable through the app after it has already been placed. This section is the request half; `docs/notes/purchase-orders.md` carries the freeze and the retry.

- **THE BODY SAID TWO WRITE PATHS AND THE CODE HAS FOUR, WHICH IS WHAT THE READING FOUND.** `createPRAction` and `editAndContinueAction` are the two a person types into. `saveDraftAction` writes `PR Items` rows with no per-item validation at all (#72, deliberately), and `lib/overagePR.js` writes one from a delivery's excess. Only the first two reach `PO Items` — a Draft's rows are destroyed and rebuilt from the submitted `itemsJson` at submit, and the overage Draft is submitted through `createPRAction` like any other — so guarding those two is what closes the chain. The other two matter for a different reason, below.
- **THE DRAFT REFUSES TOO, AND THAT IS A DECISION RATHER THAN A SWEEP.** Once `createItem` throws, a Draft save with `2.5` in a quantity box fails inside `persistPRFromForm` and the requester meets `Couldn't save the draft. Please try again.` — the exact shape #254 spent an issue removing from the invoice form, on an input they could have fixed. So the Draft asks the predicates too. **#72 is not bent by this**: a Draft is allowed to be half-FINISHED, and a fraction is not an unfinished state but a wrong value. The coercion is what keeps the two apart — the Draft path asks through `toNumberOrUndefined`, which is what `persistPRFromForm` already writes with, and both predicates abstain on `undefined`, so a row with an empty quantity saves exactly as it did before.
  - **THE SUBMIT PATH USES `parseFloat` INSTEAD, and the difference is which question was already answered.** `createPRAction` refuses a blank one line above with `Every item needs a quantity and a unit price.`, so by the time the precision test runs there is a figure; `isWholeQty("3")` is false, which is why every one of these call sites parses first.
- **THE EDIT TURN CHECKS EVERY SUBMITTED ROW, NOT ONLY THE CHANGED ONES, AND TWO THINGS FORCE THAT.** A row broken outside this app — the hand edit in the Airtable UI that #254 records as reaching nothing — would otherwise ride through on a turn that edited its remark. And #188's rollback restores the STORED figures, so a turn allowed to begin over a bad row would meet the service guard on the way back out and report a failed restore, which is that issue's worst state reached through this one's guard. Refusing the whole submission before the `try` closes both, and the figure is in an editable box on the same screen, which is the condition #254 required of a refusal like this.
  - **IT ALSO CLOSES A `NaN` THAT WAS REACHING AIRTABLE.** The edit form declares no `required` on either figure, so an emptied box became `parseFloat("") === NaN`, was diffed as a change, and was written — a 422 the signer met as a generic failure. The same `parseFloat` the diff uses now feeds the predicate, so the refusal arrives first and names the figure.
- **THE SHIPPING FEE ASKS `isWholeCentPrice` AND NEVER `isWholeQty`.** It is summed beside the item amounts into `Purchase Orders."Total Amount"`, which is the TOTAL line the vendor reads, and it is multiplied by nothing — there is no quantity for the other half of the rule to be about. That is the whole of why it is in this issue: the justification for holding an item's unit price to a cent is that the total lands on one, and this term is in the same total.
  - **`SHIPPING_FEE_PRECISION_COPY` IS A THIRD STRING AND #330 IS THE TEST IT PASSES.** `Every item's unit price has to be a whole number of cents.` has the wrong subject — a shipping fee is not an item and has no unit price. The predicate is shared and the subject is not, which is exactly the split #330 drew between a submission with no rows and a record with none.
  - **IT IS NAMED FOR THE FIGURE RATHER THAN FOR THE SCREEN**, so the invoice side reuses it rather than coining a second sentence about `Invoices."Shipping Fee"` — which is one of the three terms of `Calculated Total` that nothing yet holds to a cent. `docs/notes/backlog.md` carries that.
  - **IT DOES NOT REPLACE `Shipping Fee must be a number.`** That refusal answers whether a figure was typed at all and this one answers where it lands; an empty box and `1.005` are two mistakes whose readers need two sentences. `isWholeCentPrice(NaN)` is false, so one string COULD have covered both — with the wrong subject on the blank case, which is the same error one field over.
- **THE GUARDS MOVED TO `lib/variance.js` AND THAT WAS FORCED BY ARITHMETIC.** `assertWholeQty` and `assertWholeCentPrice` were private to `lib/airtable/invoiceItems.js` with one caller each. This issue gives them five more — `createItem`, `updateItem`, `createPOItem`, `createPR`/`updatePR` and `createPO` — and four copies of a four-line throw is the duplication CLAUDE.md's own section forbids. They sit beside the predicates they wrap and the tolerance they are the premise for. `assertWholeCentPrice` gained a `field` argument, defaulting to `Unit Price`, because the figure is no longer always one.
- **NOTHING ON THE BASE IS BLOCKED BY THIS, COUNTED RATHER THAN ASSUMED.** 43 `PR Items`, 39 `PO Items`, 24 `Invoice Items` and 25 `Delivery Items` rows: **0 fractional quantities and 0 sub-cent prices**. `Purchase Requests."Shipping Fee"` is set on 4 of 41 and `Purchase Orders."Shipping Fee"` on 4 of 37, all whole-cent. So no standing record becomes un-editable, and the refusals below are about what arrives next rather than about repairing anything. **This issue repairs no record and changes no schema.**
  - **WHAT WOULD HAPPEN IF ONE EXISTED is worth stating because the count could change by hand.** A signer opening the edit turn on such a row is refused on submit, with the figure in an editable box in front of them — recoverable. An Approved request's items are past editing in this app, so a row broken after approval is repaired in Airtable; the PO retry is what says so.
