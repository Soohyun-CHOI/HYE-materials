# Purchase requests — the reasoning

Governs `app/prs/**`, `lib/prSigning.js`, `lib/prDraft.js`. **Read this before editing there** — CLAUDE.md carries only the rules that bind code outside this area; the derivation, the evidence and the alternatives weighed are here.

Moved verbatim out of CLAUDE.md — nothing in this file was rewritten. The migration was audited line by line and the result is in the pull request that created this file.

### Purchase Requests

- **Withdrawn (#122)** is the documented exception to the "no Rejected status" posture: it's the Requester's own *self-retraction* of a submitted PR (circumstances changed / submitted in error), NOT a signer's rejection — signers keep Return for correction. It's a state transition (not a delete — contrast Draft delete): the PR, signer chain, correction history, and Edit Log all stay on record. Requester-only, allowed **only from In Review** this pass, terminal (no revive — re-request = a new PR). The Status flip is the single lever needed (every actionable path is gated behind In Review); Pending signers / open Correction Requests / Current Signer Step are left untouched to preserve the audit trail, and the signer progress bar drops correction arcs off-In-Review so a withdrawn PR reads as ended. `getSubmittedPRs` returns Withdrawn PRs (they aren't Drafts) so they stay visible/filterable in the #119 list. PR withdrawal stays **In Review-only**, and there is no plan to extend it to Approved: once a PR is approved its PO exists, and "we're not ordering after all" is a decision about the *order*, so it's expressed as the PO's own terminal `Withdrawn` (#138, see Purchase Orders below) — an Approved PR really was approved and its signer chain records that. The PR-status check that was once wanted in `signPOAction` therefore no longer applies rather than being satisfied: the guard added in #138 checks **PO** status, and since a PR is never withdrawn past In Review, an Approved PR's PO can't be signed out from under a withdrawn PR.

### PR Signers

- Requester assigns an ordered signer list at creation, each tagged Confirmation Type (Approval/Agreement) — label only, same underlying action.
- Each turn: Approve/Agree, Edit and continue, or Return for correction (to any earlier signer/requester/self — pauses/resumes, never restarts; nested corrections are a LIFO stack, each resolve unwinds one level).
- Editing after signing does NOT invalidate approval.
- Fields: PR Signer ID, PR/Signer (link, single), Sequence Order, Status (Pending/Approved/Edited/Returned), Confirmation Type, Signed At, Notes (no input on plain Approve/Agree; Edit and continue/Return still collect it).
- PR detail page: linear progress bar (`lib/prSigning.js:getSignerChainProgress` + `app/prs/[prId]/SignerProgressBar.js`), current state only. Paused (passed through, pushed back by correction) shares neutral color with not-yet-reached, dashed border only. Correction Requests.Sent To stores only a user id (ambiguous if Requester = a Signer); progress bar defaults to signer interpretation — doesn't affect the actual state machine (uses Current Signer Step).

### PR Items

- **`Item Name` and `Size` are normalized on save (#18)** — trimmed, internal whitespace runs collapsed, **case left exactly as typed** (`lib/itemNaming.js`). Applied in `prItems.js` create/update, i.e. the service layer, so the PR form and Edit and continue cannot drift apart on it. This is the origin of the whole chain — PO Items copy these values, Invoice Items copy those, Materials is keyed on them — so normalizing once here covers every table downstream. Case is deliberately untouched because this exact string is printed on the PO PDF the vendor receives, where `SCH 40 PVC` / `304SS` / `NPT` are correct as written and the stored value is the only copy; case-insensitivity is the *lookup's* job instead (`LOWER(TRIM(...))` in `getMaterialByKey`), which is reversible. **No stored match-key field**, deliberately: a second field is one more thing that can fall out of step with the write path meant to fill it. Rows created before #18 are not normalized, which is why `upsertMaterial` normalizes again on its way in.

### Edit Log

- **`Field`, not `Field Name` (#181).** `X Name` on this base is a human-entered display name (`Item Name`, `Vendor Name`, `PIC Name`); this is one option from a closed list, and that family takes no `Name` (`Status`, `Role`, `Unit`, `PO Status`). Beside its own siblings it is also the better word — `Field` / `Old Value` / `New Value` is subject, before, after. `Edited Field` was rejected as a modifier doing no work, since `Changed By` and `Changed At` already say every row is an edit. The mapper key and the create parameter followed it to `field`, which also stops colliding with this repo's other `fieldName` — an Airtable field's name in the schema sense (`lib/airtableFormula.js`, `client.js:findByFieldValues`).
- **`Field` POINTS AT A COLUMN'S IDENTITY, NOT AT THE LABEL THAT HAPPENED TO BE IN USE — so a renamed field takes its log rows with it.** #78 renamed the PR Item field `Rate` → `Unit Price`; the three rows that still read `Rate` now read `Unit Price` and the `Rate` option is gone, so the option list is exactly the seven labels the code can write. Where a field is **deleted** and a different one takes over its job, old rows keep their old option instead: there is no identity left to follow.
  - **The test is objective — does the Airtable field id survive.** A rename preserves it, a delete-and-recreate breaks it, so the same fact that makes renaming safe at all (#167: the name is a rendering, the id is the storage) is what discriminates the two cases. This is not a judgment call about how much history to keep.
  - **Why update rather than preserve.** `Field` is a singleSelect, so it holds a *copy* of the label and a rename does not reach the copy. If the copy stands in for the identity, it has to be corrected whenever the identity survives — otherwise reading a row requires knowing the rename history, that knowledge lives in exactly one place, and the cost of carrying it accumulates for every later reader. **Nothing audited is lost:** `Old Value` and `New Value` are untouched, so the recorded fact stays as written and only the pointer moves.
  - **#181's first pass argued the opposite and was wrong, and the two mistakes are recorded so the conclusion is not flipped back.** It said "an append-only log keeps the vocabulary of its own time". First, it treated those three rows as evidence when they are dummy data. Second and worse, it read `Rate` → `Unit Price` as a **replacement** when it was a **rename**, which conflates *the label was different then* with *the subject was different then* — only the latter would justify keeping an old option. The rows were re-pointed and the option deleted by hand in the UI, because the Metadata API cannot write a select's option list at all (**measured on this field: a PATCH carrying `options.choices` returns 422 while a description-only PATCH returns 200**).
- **`typecast` is gone from `createEditLogEntry` (#181), and the two options it minted are why.** The comment defending it said auto-adding a missing choice "can't produce garbage choices" because the value is always one of a fixed set of constants. True of the names, false about the consequence: typecast gives every option it creates the same default color and nothing can recolor it, so `Unit Price` (minted when #78 landed) and `Shipping Fee` (when #69 did) sit at `blueLight2` while the original six walk a palette — visible in a schema dump and unfixable through the API. All seven labels the code can write now exist, so the write needs no help, and a label that does not exist should fail loudly rather than mint an eighth. Same posture as `createDeliveryItem` on `Unit`, and the same hazard `DRUM` demonstrated on PR Items. **Both halves measured on the live base:** a registered label still writes with no typecast, and `"Quotation"` is refused with `INVALID_MULTIPLE_CHOICE_OPTIONS: Insufficient permissions to create new select option ""Quotation""` — the same refusal `Materials` gives for `Unit: ""` — with the option list identical before and after.
- **THE BLAST RADIUS OF THAT REFUSAL IS THE WHOLE TURN, not a log line, and it is worth knowing before adding a label.** Both call sites sit inside `editAndContinueAction`'s `try`, and its `catch` reverts every touched item, the Shipping Fee, the Quotations created that turn and the signer's own status, then returns *"Something went wrong saving your changes. Please try again."* — advice that would be wrong **forever** for this cause, since no retry can succeed until the choice exists in the Airtable UI. Two of those reverts are `.catch(() => {})`, so a failed revert is silent too.
- **Deliberately NOT made best-effort outside that rollback**, which is `lib/materialsCache.js`'s shape for stopping a derived artifact from undoing what produced it. The asymmetry is re-derivability: a materials cache rebuilds from `PO Items` and a PO PDF regenerates from its PO, but an Edit Log row records the **old value**, which stops existing the moment `updateItem` lands. Best-effort would apply a price change and lose the only record of what it changed — a hole in the evidence trail this table exists to be. **A refused turn beats an unlogged edit**, so the rollback stays and the fix is for the label set never to drift.
- **BOTH HALVES OF THE LABEL/CHOICE PAIR NOW EXIST, and `Unit` is the precedent for why one is not enough** — `offline/unit-options.mjs` proves the files agree, `verify-unit-options-18.mjs` proves the fields do, and a hand-added option passes the first while failing the second. Edit Log is the same pair:
  - `scripts/tests/offline/edit-log-fields.mjs` (CI, every push) enumerates every label the code can send and fails when one is ADDED, with the remedy in the assertion text — create the Airtable choice first, since the Metadata API cannot (422 on `options.choices`) and shipping the label without it blocks the edit turn. It also pins `typecast` at zero, and asserts on the AST that no call site passes a string literal, which is what keeps the enumeration complete. Since #181 moved the labels to `lib/editLogFields.js` it imports them rather than parsing the Server Action as text; what it still reads as source is the call-site SHAPE. Verified by mutation: an added label and a restored `typecast` each fail it.
  - `scripts/tests/verify-edit-log-fields-181.mjs` (credentialed, by hand) compares that module against the live option list, and is the only thing that can see a choice DELETED in Airtable. **It reads the rows as well as the schema, because whether an unwritable choice is legitimate is decidable rather than a judgment:** held by at least one row it is history this table is entitled to keep (a field deleted and replaced leaves rows pointing at an identity that is gone), held by none it is `DRUM`'s exact shape — a hand edit or a half-finished rename — and fails. That is a deliberate divergence from `verify-unit-options-18.mjs`, which fails on any extra option, and the reason is that for Units there is no legitimate case. Verified by mutation on all three branches, without touching Airtable, by mutating the module instead.
  - **The one-off measurement is now a standing assertion.** #181 counted seven labels against seven choices by hand; the script asserts the equality, the order, and that no row has an empty `Field`. It creates nothing, so there is no fixture to clean up, and it prints the commit and whether the tree was dirty (#172's header).
- **THE BLIND SPOT THAT MOTIVATED THE SECOND HALF WAS DEMONSTRATED, NOT IMAGINED:** #181 deleted the `Rate` choice by hand, because no API can, and every file-only check stayed green through it. That is why the credentialed half exists rather than being deferred. What remains uncovered is narrower and worth naming: no check watches this table's APPEND path, so "a row was written when one should have been" is still only observable by using the app. (This used to cite `test-updates.js` as naming Edit Log in prose; #174 deleted that script.)

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
  field.** `Purchase Requests."Job"` is a Lookup THROUGH `Line`. The office learns
  the Job by telephone and cannot learn the Line — #19's boundary, that a decision
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
- **THE NAME IN THE CHIP IS `Users."User Name"`,** which is what every other
  screen prints for a person. It is the email's local part today (`chkim`),
  because a Users row is created by a first magic-link sign-in and nothing else
  sets it; a real display name is one edit per row in Airtable and improves every
  screen at once. Naming people a second way here would be the mistake.
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
