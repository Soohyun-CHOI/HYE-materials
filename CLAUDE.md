# HYE USA Portal — Project Context

Read automatically by Claude Code at the start of every session.

**If the Airtable MCP connector is available, prefer querying the live base schema over trusting this document for exact field types — this file can drift, but the rules below stay authoritative.**

---

## Before you edit — required reading by area

The reasoning behind each area lives under `docs/notes/`, not here. These are instructions rather than suggestions: read the named file before editing anything under the paths it governs, because the decisions in it are not recoverable from the code.

| Before editing | Read first |
|---|---|
| `app/deliveries/**`, `app/invoices/**`, `lib/delivery*.js`, `lib/overage*.js`, `lib/invoice*.js`, `lib/variance.js` | `docs/notes/deliveries-and-invoices.md` |
| `app/pos/**`, `lib/po*.js` | `docs/notes/purchase-orders.md` |
| `app/prs/**`, `lib/prSigning.js`, `lib/prDraft.js` | `docs/notes/purchase-requests.md` |
| `app/materials/**`, `lib/material*.js` | `docs/notes/materials.md` |
| `lib/airtable/**`, `lib/airtableFormula.js`, `lib/airtableOps.js` | `docs/notes/airtable-access.md` **and** `docs/notes/naming.md` |
| `lib/ids.js`, `lib/idSequence.js` | `docs/notes/id-generation.md` |
| `lib/authz*.js`, `lib/prVisibility.js`, `lib/invoiceVisibility.js`, `app/api/**` | `docs/notes/authorization.md` |
| `lib/blobIngest.js`, `lib/prDraft.js`, `app/prs/new/**` | `docs/notes/uploads-and-drafts.md` |
| `scripts/**` | `docs/notes/verification.md` |
| renaming a field, a screen word or an identifier | `docs/notes/naming.md` |
| what a screen carries, or adding or removing a page | `docs/briefs/README.md` |

`docs/notes/backlog.md` is the open-work list and is not tied to a path — see the last section.

**`lib/airtable/**` is governed by TWO files and both are required reading before an edit there** — `airtable-access.md` for how the base is queried, `naming.md` for what a field may be called.

**Never reference these with `@path` syntax.** An `@` import loads at session start, which is the cost this split exists to remove.

## Where new writing goes

**This file states rules; `docs/notes/` holds the derivations.** #211 alone added 8,798 bytes here, and at that rate twenty-six issues undo this split entirely — so it survives only if new writing is routed rather than appended.

- A **rule that binds code outside its own area** → here, as a bullet in the section that already owns that kind of rule. **Never a new `###` section for an issue**: that is the shape that produced the fourteen sections this split removed.
- **Derivation, evidence, measurements, alternatives weighed, what an earlier pass got wrong** → the `docs/notes/` file for the area. No size limit there.
- **Why one module exists, and the constraints on editing it** → that module's own file header.
- A new **field** → the Data model list: name, type, link topology. Its rationale goes to the area notes file.
- A new **module** → one line in Service layer pattern, `path — what it owns`.
- **What a screen carries, the distinctions it must show, and a word locked on it** → `docs/briefs/`, one file per page (#260). A page added, removed or given new content updates its brief in the SAME COMMIT; `offline/screen-briefs.mjs` fails on a page with no brief and on a tone the shared brief does not list.
- If no area file fits, add one and an index row above it, in the same commit.
- **The audience test decides ties.** A rule whose readers are wider than any one glob stays here; a rule only its own area's editor needs goes to that area's file. That is why "records in this base are not removed as tidying-up" is here rather than in `verification.md`.

**A budget, not a guideline.** An issue's whole delta to this file should sit under roughly 400 bytes — #211's would have been 410 under these rules, against the 8,798 it actually took. `offline/notes-index.mjs` fails the build when this file passes **55,000 bytes**. When that fires, move a section out; do not raise the ceiling.

## What this project is

Replacing an email-and-Excel-based Purchase Request -> Purchase Order -> Invoice workflow (Hanyang ENG, a construction company) with a web app owning the full lifecycle. The core problem isn't any single step but that the three were never connected: the same order lived in a spreadsheet, an email thread, and a vendor's invoice with nothing tying them together, so reconciling what was ordered against what was invoiced was manual and after the fact.

## How the work flows

Site staff talk to a vendor first and get a quotation — that happens outside the app, and it is why a PR arrives with the vendor and the prices already settled. The requester raises the PR with that quotation attached and names an ordered chain of signers. Each signer approves, edits and continues, or returns it for correction to anyone earlier. Full approval generates the PO as a frozen snapshot of the items, the President signs it, and office staff send that PDF to the vendor — also outside the app, which is why the PO is the one document this system emits. The vendor's invoice comes back to office staff, who enter it and reconcile it line by line against the PO.

Three kinds of people, and the distinction is organizational rather than a privilege ladder. **Site staff** are non-Admin Employees: they raise PRs, sign, and withdraw their own. **Office staff** all run with `Is Admin: true`, so gating something to Admin scopes it to the office — invoicing is Admin because invoicing is office work, not because Admin is more trusted. The **President** signs POs; nothing else is role-specific to them. Vendors have no account and never touch the app.

What that boundary implies keeps coming up: a decision made before a PR exists cannot be helped by a form inside one (#19), and a status describing something that happens outside the app has nobody to set it (#144).


## Architecture

- Next.js (App Router, JavaScript, Tailwind), deployed on Vercel.
- Airtable as data store only (base: "Material Purchases"). All business logic lives in the backend. Airtable formulas only for pure data transforms, never workflow logic.
- Auth: magic link only, restricted to company email domain, verified. New signups always land as plain Employee (Is Admin: false) — promotion is a manual Airtable edit.


### Editing the Airtable schema

**The schema is editable by either of us, and a schema change ships in the SAME COMMIT as the code that reads it.** No production data exists yet, so the moment to fix a name or a shape is now.

**Renaming a field is safe.** Airtable resolves a field by id, not by text, so a rename carries every formula, rollup, lookup and view filter with it. The only thing it breaks is a string literal in this repo, and those are enumerable: `record.get("...")`, a `filterByFormula` fragment, a `fields:` projection, a `parentLinkFieldName`. Rename the field, grep the old name across `lib/`, `app/` and `scripts/`, fix every hit, and commit both halves together. **Grep after the change, not before** — what matters is that nothing survives.

**THE GREP COMING BACK EMPTY IS NOT THE LAST STEP — READ EVERY HUNK.** A blanket substitution also hits *a different identifier that happens to share the old name*, and nothing warns about it: not a type error, not a lint error, not a failing check. Ask of each renamed identifier whether it is the one the field is named after. Where the renamed thing is pure, call it both ways and compare.

**A schema edit may not be assumed scriptable.** The Metadata API cannot write everything, and what it refuses is measured rather than read off the documentation — `docs/notes/airtable-access.md` has the figures, including which of the refusals force an invariant onto the DATA instead.

**Deleting or retyping a field is not the same as renaming it.** A rename preserves every value; a type change can silently drop them. Records in this base are not to be removed as tidying-up.

## Service layer pattern

One module per rule, and **one rule, one implementation** — see below. Each entry is the path and what it owns; why it owns it is in the `docs/notes/` file for its area.

- `lib/airtable/client.js` — shared connection, `TABLES`, `getLinkedRecords()`, `withKeyLock()`, and the batched readers `findChildRecords` / `findByRecordIds` / `findByFieldValues`. Throws at module load without `AIRTABLE_API_KEY`.
- `lib/airtable/{table}.js` — one file per table, plain async functions.
- `lib/airtableOps.js` — the Airtable operation counter and its attribution scope. Server-only; a forbidden root for client bundles.
- `lib/airtableFormula.js` — `formulaString`, the one escape for an interpolated value, plus the whole-formula builders `orByRecordId` / `orByField` / `andSearchAll` / `prefixMatch`.
- `lib/ids.js` — all ID generation: the lock, the query and the create.
- `lib/idSequence.js` — the pure half: the daily ID families, the eight child relations in `CHILD_KINDS`, `nextSequence`, `formatSequentialId`.
- `lib/productName.js` — `PRODUCT_NAME` and `SIGN_IN_TITLE`. Not the company's legal name, which is `lib/poPdf.js:HYE_BUYER_NAME`.
- `lib/authTokenState.js` — whether a magic-link token can still be used: the five states, their copy, `TOKEN_TTL_MINUTES`.
- `lib/units.js` — `CANONICAL_UNITS`, the JS source of truth for the Unit select list.
- `lib/editLogFields.js` — the labels an `Edit Log` row can be about. No call site may pass `createEditLogEntry` a string literal.
- `lib/variance.js` — invoice/PO variance checks, and `VARIANCE_COPY`: the two kinds named apart (#179).
- `lib/itemNaming.js` — `normalizeItemText`: trim, collapse internal whitespace, case untouched.
- `lib/prItemMerge.js` — identical PR item rows are one item on save (#170): the six-field key, `isEmptyItemRow`, and `PR_ITEM_MERGE_COPY`. Applied in `parseFormState`, previewed by the form.
- `lib/materialsCache.js` — the three writes a generated PO makes to the item axis, and the per-entry best-effort loop.
- `lib/materialHistory.js` — the two queries behind `/materials` and `/materials/[materialId]`, and the per-row identifier gate.
- `lib/materialPriceView.js` — the view rules for those screens: query→tokens, row ordering, the lowest-price mark, the quantity caveat.
- `lib/poItemQty.js` — what leaves an order open: `uninvoicedQty`, `hasUninvoicedQty`, `countsAsOrdered`, and `hasUninvoicedItems` per order.
- `lib/poListView.js` — the PO list's ordering, Status text, three empty states, and which approved PRs have no PO with both voices of that copy (#176).
- `lib/poDocuments.js` — an order's two document lists: the invoices charging it and the deliveries filling it, folded to one entry per document, their ordering, their empty states and `PO_DOCUMENTS_COPY`.
- `lib/poWithdraw.js` — the PO-withdrawal predicate, both voices of its copy, and the guarded write.
- `lib/poSend.js` — sending a signed order to the vendor (#281): `PO_SENT_STATUS`, the five refusals, and the screen and mail copy. The mail's words are here rather than in `lib/email.js` because that file's inline HTML is outside the vocabulary check's reach.
- `lib/poUnsigned.js` — `isPOUnsigned` and the signal wherever an order is offered for an invoice (#198): the picker's option label and `UNSIGNED_COPY`.
- `lib/poPickerOptions.js` — which orders one slot's PO dropdown may offer (#242): `PO_ORIGIN`, the searched-order claim rule, the one-slot-one-order exclusion, and detection's claim over an entry the search put there.
- `lib/blobIngest.js` — `confirmIngestThenDelete`, and `isOurBlobUrl` (also the detect-po SSRF host predicate).
- `lib/quotationReuse.js` — `shouldReuseQuotation`: when a re-saved Draft keeps its existing Quotation record.
- `lib/directPurchase.js` — the way out of an invoice with no order (#272): `directPurchaseBlocked`, the one predicate the modal and the action share, and `DIRECT_PURCHASE_COPY`.
- `lib/directPurchaseClaim.js` — the strip's rows and the Draft a site raises from one. Credentialed.
- `lib/prKind.js` — which of three kinds a request is (#272), read from two reverse-links and **stored in no field**, plus the mark for each and the signer's sentence. Ordinary carries none.
- `lib/prWait.js` — a record waiting for a request: `WAIT_STAGE`, and the listed-against-offered split both strips above `/prs` obey (#272).
- `lib/deliveryAllocation.js` — the allocation rule (`planDelivery`), its replay (`recomputeOverDelivery`), `ALLOCATION_COPY`, and the dropdown helpers the form imports.
- `lib/deliveryCandidates.js` — the Job → Lines → PRs → POs → PO Items walk that finds ordered items. Credentialed.
- `lib/deliveryStatus.js` — delivered against invoiced against ordered: the judgment, `STATUS_COPY`, the list filters, the worklist order. Both order-scope summaries live here (#235), and `AWAITING_DELIVERY_DAYS` (#263).
- `lib/deliveryReconciliation.js` — the two batched walks joining invoices to deliveries through `Invoice Items` → `PO Item` ← `Delivery Items`. Credentialed.
- `lib/deliveryInvoiceLink.js` — the invoice/delivery pairing rule, its dropdown options and every refusal.
- `lib/deliveryInvoiceMatch.js` — the COMPUTED pairing (#231): containment, the price gate, a delivery's remaining capacity, the rival clause and its tie-break, `PAIRING_COPY`. One predicate serves both directions.
- `lib/deliveryInvoiceCandidates.js` — which invoices a delivery may name, which deliveries an invoice may name, and the guarded write. Credentialed.
- `lib/deliveryAccess.js` — `canAccessJobDeliveries`, the one Job-scope rule for deliveries.
- `lib/deliveryDelete.js` — the delete predicate, the three voices of the confirmation, and the guarded write.
- `lib/overage.js` — the overage request's judgment and `OVERAGE_COPY`. `overageAgreement` (#265), the quotation-supplying invoice and its ordering (#219), `awaitsOverageRequest` and the signer-copy rule (#217).
- `lib/overagePR.js` — the read and write sides of the correction: the facts, the uncorrected-excess list (#217), the Draft it creates, and the apply step. Credentialed.
- `lib/invoiceItemFold.js` — `foldInvoiceItems`: a split invoice item reads as one row again.
- `lib/invoiceOrderBreakdown.js` — an invoice's items under the orders they charge (#237): the same-set test that decides whether they appear, the per-order quantity, the no-ordered-item exclusion, `ORDER_BREAKDOWN_COPY`.
- `lib/invoiceDeliveryEntries.js` — the invoice detail's delivery entries (#241): one per folded item, its members' shares added rather than re-clamped, and no entry where nothing disagrees.
- `lib/prVisibility.js` — `canViewPR`, the one row-visibility rule for a PR.
- `lib/invoiceVisibility.js` — `seesEveryInvoice` and `getVisibleInvoiceIds`, the walk that reaches `canViewPR` from an invoice. Credentialed.
- `lib/authzWrap.js` — the guard-wrapper factories. Nothing here imports `next/*`.
- `app/components/modalStyles.js` — `MODAL_BACKDROP` / `MODAL_CARD`, the single source for modal styling.
- `app/components/DeliveryStatusMarks.js` — `StatusChip` / `QualifierMarker`. Presentational only; the semantic tone comes from `lib/deliveryStatus.js`.
- `AIRTABLE_API_KEY` is server-side only and never in the client bundle.

### One rule, one implementation

Two implementations of one judgment diverge, and catching the divergence then needs a third thing. A duplication is not closed by "leave it as two for now": if there is a real reason to keep two, that reason has to be a **measurable condition**, and the path to merging when it lifts has to be written down.

## Data model (22 tables)

Field lists and link topology only. Why a field is shaped the way it is lives in the `docs/notes/` file for its area — see the index above.

**Users**: User Name (primary), Email, Phone, Role (Employee/President), Is Admin, Status (Active/Inactive), Created At, Assigned Jobs (link -> Jobs, multiple, optional).

**Jobs**: Job Code (primary), Job Name, Business Unit, PIC/Manager (link -> Users) + Phone/Email (Lookups), Delivery/Alternate Address (link -> Addresses, single), Lines/Users (reverse-links).

**Lines**: child of Jobs. Line Label (primary, formula = {Job} - {Line Name}), Line Name (human-entered), Job (link, single).

**Vendors**: Vendor Name (primary), PIC Name/Phone/Email (plain text, external), Address (link, single), Purchase Orders (Lookup via PR chain).

**Purchase Requests**: PR ID (HYE-PR-YYMMDD-##), Requester/Vendor (links, single), Line (link, single), Job (Lookup via Line, read-only), Created At (datetime, UTC — timestamped per the *At convention), Status (Draft/In Review/Approved/PO Signed/Withdrawn; PO Signed fires when President signs the generated PO), Withdrawn At (datetime, UTC, *At convention — stamped only when withdrawn, #122), Current Signer Step, Items Subtotal (rollup, PR Items only), Shipping Fee (optional currency; fixed once set, changeable only via Edit and continue), Total Amount (formula = Items Subtotal + Shipping Fee, blank = 0), Notes, Quotation Files (Lookup, plural).

**PR Signers** — dynamic ordered approval chain:

**PR Items**: PR Item ID, PR (link), Item Name, Size, Unit (single select, canonical list — see Units), Qty, Unit Price, Amount = live formula, Remark (free text only), Quotation (link, single -> Quotations — auto-linked when only one exists, dropdown once 2+, never silently reassigned).

**Correction Requests**: Correction Request ID, PR, Initiated By, Sent To, Notes, Requested At, Resolved At, Status (Pending/Resolved).

**Edit Log**: Edit Log ID, PR, Changed By, `Field` (select — exactly the seven labels the code can write: the six `ITEM_FIELD_LABELS` values plus `Shipping Fee`), Old Value, New Value, Changed At, Notes (optional). Append-only: no update function, and `editLog.js` deliberately has none.

**Purchase Orders**: strict 1:1 with PR. PO ID (HYE-PO-YYYYMMDD-## — 4-digit year, the one exception to the 2-digit convention), PR (link), Vendor (Lookup via PR), Quotation File (Lookup), Our PIC/Manager (links), Created Date, President Signed(+At), Status (Awaiting Signature/Signed/**Sent to Vendor**/Withdrawn — the third revived in #281, which writes it as a byproduct of the send; see `purchase-orders.md` for the five status readers that had to move with it), Withdrawn At (datetime, UTC, *At convention — stamped in the same write as Status -> Withdrawn, #138), Sent At / Sent By (link -> Users, single, app-enforced) / Sent To (text — the address used) — the three facts of one send, written in the same operation as Status -> Sent to Vendor and never rewritten, since a second send is refused (#281), PO PDF File, Items Subtotal (rollup, PO Items only), Shipping Fee (plain currency, frozen copy from PR at PO-generation time), Total Amount (formula = Items Subtotal + Shipping Fee, blank = 0 — PO PDF's TOTAL line), Delivery Address Used (Primary/Alternate — internal only), Uninvoiced Items (rollup, SUM of PO Items."Has Uninvoiced Qty").

**PO Items**: frozen snapshot from PR Items at PO-generation — NOT live. PO Item ID, PO (link), Item Name, Size, Unit (single select, same list), Qty, Unit Price, Amount = static value, Remark, Invoice Items (reverse-link, multiple — partial invoicing is real), Has Uninvoiced Qty (formula = `IF({Qty} - {Invoiced Qty} > 0, 1, 0)`). No free-text/user-facing Unit entry point; the snapshot fields are written only by lib/poGeneration.js.

**Quotations**: Quotation ID ({PR ID}-Q{seq}), Vendor Quotation Code (human-entered), Vendor/PR (links, single), File (attachment, required at creation in-app). At least one required per PR; can have more than one over its lifetime (dynamic list on PR form, or later via Edit and continue).

**Invoices**: Invoice ID (HYE-INV-YYMMDD-##), Vendor Invoice Code (human-entered), Vendor (link), Issue/Due Date, Amount Due ("Vendor's Stated Total" — never auto-overwritten by the backend, unlike Items Subtotal/Calculated Total/Variance Flag; human edits allowed and recompute variance — #117), Shipping Fee, Tariff (optional), Sales Tax (optional, #283 — currency; on `Invoices` only, since neither a PR nor a PO states a tax), Items Subtotal (rollup), Calculated Total (formula = Items Subtotal + Shipping Fee + Tariff + Sales Tax, blank = 0), Variance Flag (checkbox, backend-set), Paid(+Date), File (attachment, required), Delivery (link -> Deliveries, single, optional — app-enforced, #210).

**Invoice-PO Link**: join table, many-to-many. Primary = plain autoNumber. Both link fields single-record.

**Invoice Items**: Invoice Item ID, Invoice + PO (links, single), PO Item (link, single), Item Name, Size, Unit (single select, same list), Qty, Unit Price, Amount = live formula, Variance Flag (checkbox, backend-set), Remark (shared, Unit Price/Qty discrepancies). Size/Unit are frozen copies from the linked PO Item, reference-only, no edit path (mismatch = wrong PO Item picked). **`PO Item` is required, and by this app rather than by the schema — Airtable cannot make a link field required (#278).** Only a PR takes typed items, so a charge with no ordered item behind it is not a state this app has: `createInvoiceAction` refuses one and `createInvoiceItem` throws.

**Addresses**: Address Label (primary), Line 1/2, City, State, Zip Code, Country, Formatted Address (formula).

**Materials**: **item identity** (#18). Natural key = Item Name + Size + Unit. `Unit` is the same 19-value single select as the three item tables (see Units). Writable: those three fields, and nothing else. Computed: `Material Label` (primary, formula = `Item Name` + `_Size` + `_Unit`, omitting blanks), `_Record ID`, the `Committed Qty` / `Signed Qty` / `Invoiced Qty` rollups and the `Uninvoiced Qty` formula. The `Material Prices` and `PO Items` links are both maintained from the far side. USD only.

**Material Prices**: item × vendor (#18). Natural key = Material + Vendor. `Price Label` (primary, formula over the two links), `Material` / `Vendor` (links, single), `Unit Price`, `Latest Date` (calendar), `Latest PO` (link), and `Material Record ID` / `Vendor Record ID` lookups. Still a latest-value cache.

**Deliveries**: one recorded delivery (#162). `Delivery ID` (HYE-DL-YYMMDD-##), `Job` / `Vendor` (links, single), `Packing List PO` (link, single, optional), `Received Date` (calendar), `Recorded By` (link → Users, single), `Created At` (datetime, UTC), `Notes` (long text, optional), `Packing List File` (attachment, required at creation), `Delivery Items` (reverse-link), `Invoices` (reverse-link, plural).

**Delivery Items**: one allocated slice of a delivery (#162). `Delivery Item ID` ({Delivery ID}-{seq}, 3 digits), `Delivery` (link, single), `PO Item` (link, single, **optional**), `Material` (link, single), `Item Name` / `Size` / `Unit` (frozen reference copies), `Qty`, `Over Delivered` (checkbox, backend-set).

**Direct Purchases**: material a site bought with no order behind it (#272). `Direct Purchase ID` (HYE-DP-YYMMDD-##), `Vendor` / `Job` (links, single; Job required, and app-enforced), `Vendor Invoice Code`, `Issue Date` (calendar), `File` (attachment, required at creation), `Notes`, `Recorded By` (link → Users, single), `Created At` (datetime, UTC), `Purchase Request` (link, single, optional). No items, no total and no status — what a row is waiting for is read from that last link and the request's own `Status`. **The request's KIND is read from the same link and stored nowhere else**.

**Auth Tokens**: Token (primary), Email, Expires At, Used, Created At. Single-use, 15-min TTL.

### Units (PR Items / PO Items / Invoice Items / Materials / Delivery Items)

One single-select field, shared 19-value list: EA, FT, SET, LS, LOT, M, ROLL, PCS, SHEET, M/D, FIT, SQFT, IN, Lengths, KG, PSI, TUBES, PACK, ST.

- JS source of truth is `lib/units.js:CANONICAL_UNITS`; `scripts/import/add_unit_options.py` keeps a duplicate list Python cannot import, and `offline/unit-options.mjs` asserts the two agree.
- **Never use `typecast` on a Unit write.** It invents an option, which is how a canonical list silently gains a 20th value. Omit an empty Unit instead — `Unit: ""` is a request to create an empty option and is refused.
- Choice colors are part of the list and only `add_unit_options.py` can set them, on field CREATE. Leave the Unit field off a new table and let the script add it.
- **A choice added by hand in Airtable is invisible to every file-only check** — `verify-unit-options-18.mjs` is what compares the live fields against the canonical list.

### Screen words and the fields behind them

**A screen word is not a field name**, and a code identifier may diverge from the field it reads on purpose. Before naming a field, a screen word or an identifier, read `docs/notes/naming.md` — it holds the word-to-field table, the conventions (`X ID` / `X Label` / `X Date` / `X At`, a checkbox takes a participle, a subtraction is named for what it subtracts, plain `Qty` for a row's own quantity) and the divergences that are deliberate.

- **A CONCEPT WITH A TABLE BEHIND IT TAKES THAT TABLE'S NAME, AND NOTHING ELSE MAY BORROW THE WORD.** `Deliveries` → a delivery, never a shipment or an arrival; `Invoices` → an invoice, never a bill; `Lines` → a Job's line, so a `PO Items` row is an **ordered item**; `Correction Requests` → a correction is what a signer sends back, so what #167 raises for an excess is an **overage request** (#272). Where no table owns the word, `naming.md` records the one that wins — which is why it is `ordered item` and not `PO item` — and a deliberate divergence is a row in the same table with its reason. Where the participle will not carry a transitive sentence the verb is `charges` — `No invoice charges this order yet.` — never `invoices`. **Identifiers are bound and were swept in #227**, and `offline/line-vocabulary.mjs` inventories the ones that legitimately keep a barred stem, with a reason each. What no check can hold is prose, which is why the rule is here.

## ID generation (lib/ids.js)

1. Top-level IDs (PR/PO/Invoice/Delivery/Direct Purchase): daily-reset counters sharing one rule. PO uses a 4-digit year; the rest use 2-digit.
2. Child-table IDs: `{Parent ID}-{seq}`, resetting per parent, same **max + 1** rule.
3. Vendor-issued codes (Vendor Quotation Code, Vendor Invoice Code): human-entered, scoped by Vendor.

**The counter counts the ID prefix and never a date field**, and the sequence is **max + 1**, never count + 1. Both rules and the eight child relations are in `lib/idSequence.js`; `lib/ids.js` owns the lock, the query and the create, and no counting reaches a call site. Read `docs/notes/id-generation.md` before touching either.

Naming: auto-generated → `X ID`. Human-typed → `X Label` / plain name. Calendar-only → `X Date`. Time-meaningful → `X At`.

## Querying parent/child data

`filterByFormula` cannot match a link field against a record ID. Read the parent's reverse-link field via `.find(parentRecordId)` (`getLinkedRecords()`), never filter the child table directly. **The children themselves are read in one query per 50 ids, never one `find()` per child (#193)** — `findChildRecords`, which keeps the link array's order and throws on an id that does not resolve. A caller already holding the parent record passes its link array and skips the parent find; a reader that takes only an id cannot. Exception: `materialPrices.js:getMaterialPrice` uses the `Material Record ID` / `Vendor Record ID` lookups, because a price row is keyed by two links and has no parent whose reverse-link would do.

**Client bundle safety — an import is an execution.** No `"use client"` file may import anything that reaches `lib/airtable/` or `lib/airtableOps.js`, at any depth. Nothing tree-shakes away a dependency whose evaluation has side effects, so a pure helper in a credentialed module has to MOVE rather than be imported selectively. `next build` does not catch this. A `"use server"` file is a boundary, not a dependency. Enforced by `offline/client-import-safety.mjs`.

**Formula injection — every interpolation escapes.** The one escape is `lib/airtableFormula.js:formulaString`, and every interpolation in `lib/` and `app/` goes through it or through a whole-formula builder from that module. A field name is a `{...}` reference and is never escaped; a builder refuses one containing a brace. An empty id list yields `FALSE()`, never an empty `OR()`. Enforced by `offline/formula-escaping.mjs`, which fails closed.

**Every Airtable operation is counted** (`lib/airtableOps.js`); only one inside a `withOpsLabel` scope is attributed. An unlabeled screen has no before and after. Printed when `AIRTABLE_OPS_LOG` is set: counting is always on, printing is gated. The count is a FLOOR — retries and raw `fetch()` to the Metadata API are invisible to it.

**EVERY ENTRY POINT OPENS A SCOPE, and a new page, Server Action export or Route Handler method that opens none is a failing check** (#224). The label is derived from the path and the export name rather than chosen — `withOpsLabel`'s own doc has the four forms — and `offline/airtable-ops.mjs` fails a mismatch, so a typo cannot become a bucket. The unit is the EXPORT, never the file.

Read `docs/notes/airtable-access.md` before changing any of the three.

## Concurrency: withKeyLock()

`generateChildId`, `upsertMaterial` and `upsertMaterialPrice` wrap read-then-write in `withKeyLock()`. It serializes only within one process or invocation, so double-submit still needs frontend disable-on-click guards.

**The two material locks use different keys on purpose:** identity locks on the normalized `Item Name + Size + Unit` triple, price on `material + vendor`. Two vendors' prices for one material are two rows and must not serialize against each other; two ordered items of one material from one vendor must. `lib/materialsCache.js` takes them in sequence, never nested.

A service-layer function with no caller is verified by nothing — `upsertMaterial` sat unused from Phase 0 to #18 carrying three defects.

## File uploads (Vercel Blob -> Airtable)

Every file — quotation files, invoice files, generated PO PDFs, packing list photos — is written to Vercel Blob first and then handed to Airtable as an attachment URL, which Airtable fetches to keep its own copy. **Airtable's copy is the copy of record.**

- `lib/blobIngest.js:confirmIngestThenDelete` owns the sequence. Call sites pass `{ table, recordId, field, blobUrl, attachmentId }` and never restate it.
- **Cleanup is scheduled at the END of the enclosing action, never straight after the attachment write**, and with `after()` rather than awaited. Every one of these actions rolls back on failure and the user's retry re-submits the same Blob URL, so no Blob object may outlive its ingest *and the action that ingested it*.
- **Confirmation signal**: the attachment no longer carries the URL we submitted. An empty field counts as NOT ingested — an attachment write pointing at a URL Airtable cannot fetch returns success and silently leaves the field empty.
- Poll every 300 ms with a 10 s ceiling; targets are confirmed one at a time. **A timeout keeps the object** and logs it: one orphan beats an empty attachment. On a *failed* attachment write the object is deleted immediately.
- Cleanup is best-effort: a failed `del()` is logged and nothing more.
- **Airtable's own attachment URLs are short-lived (~2h), so nothing durable may store one** — re-read the record instead. Rendering a stale one is a recoverable annoyance; **re-submitting one as an attachment is data loss.**
- **An attachment that did not change is not rewritten.** `Quotations.File` has exactly one writer, `createQuotation`; `Deliveries."Packing List File"` has exactly two, and the second refuses any url that is not a fresh Blob upload. Enforced by `offline/source-shape.mjs`.
- Size limits are uneven: `/api/invoices/upload` caps at 20MB, `/api/quotations/upload` sets none. Both restrict content type to PDF/JPEG/PNG.

Read `docs/notes/uploads-and-drafts.md` before changing an upload path or `persistPRFromForm`.

## Auth (lib/auth.js, lib/session.js, lib/email.js, lib/authz.js)

- Magic link only, restricted to the company email domain. `requestMagicLink()` domain-checks then emails a link; `consumeAuthToken` spends the token under `withKeyLock`. New signups always land as plain Employee (`Is Admin: false`); promotion is a manual Airtable edit.
- **THE LINK POINTS AT A PAGE, AND OPENING IT CONSUMES NOTHING.** `/login/confirm?token=…` reads the row and offers a button; `POST /api/auth/verify` is the only thing that spends the token. Mail security scanners open links before the recipient does, and a `GET` that consumed spent the token first. TTL is 15 minutes and single-use.
- The validity rule is `lib/authTokenState.js`, so the page reaches the same verdict without consuming. An unreadable `Expires At` counts as EXPIRED.
- **The POST refuses a cross-origin submission** — the token authenticates the request but not the submitter's intent, and login CSRF would let a victim author under another identity. `Origin` is compared against `Host`, and absence fails open.
- `lib/session.js`: iron-session, payload `{ userId }`. `getCurrentUser()` treats a missing Users record as logged-out and re-throws real Airtable errors. `getActiveUser()` also treats `Status: Inactive` as logged-out.
- Env vars: `SESSION_SECRET`, `RESEND_API_KEY`, `ALLOWED_EMAIL_DOMAIN`, `EMAIL_FROM` (optional). Fail-fast at module load; set in Vercel too.
- **Resend's domain is verified, so mail delivers to any address.**
- **There is no user-creation screen.** A Users record appears as a side effect of a first magic-link sign-in and in no other way. `lib/airtable/users.js:addAssignedJob` is the only writer of `Assigned Jobs` and is additive.
- The product is named in one place, `lib/productName.js`. `offline/product-name.mjs` fails on any superseded name under `app/` or `lib/`, and on `PRODUCT_NAME`'s value appearing as a literal outside its own module.

## Route protection (lib/authz.js)

**Operating convention:** office staff run with `Is Admin: true`; a non-Admin Employee is site staff. Gating an endpoint to Admin scopes it to the office, not to a higher trust tier.

- `requireUser()` / `requireRole(role)` / `requireAdmin()` / `requirePresident()` are for Server Components and Actions. All redirect to `/login` with no session. On insufficient permission `requireRole`/`requireAdmin` return `{ authorized: false }` for the caller to render; `requirePresident()` throws. Route Handlers cannot use these — they call `getActiveUser()` or `requireAdminApi()`, which return the user or a 401/403 `Response`.
- **Gate a new endpoint with a wrapper**, not a bare call: `withAdminApi`, `withAdminAction`, `withPresidentAction`. A wrapped export cannot run its body unauthorized, because the body is an argument the wrapper decides whether to call.
- **Caller obligation for the flag helpers:** `requireAdmin()` only *reports* the decision. A caller that does not act on `{ authorized }` protects nothing.
- **Re-authorization rule:** every directly-callable endpoint re-authorizes to the level of the strictest page that renders its UI. A page being the only caller is not a substitute — Route Handlers and Server Actions are reachable directly.
- Any route that fetches a caller-supplied URL also restricts it to our Vercel Blob host, independent of auth.
- **Role-scoped:** `app/admin/**` and the invoice write paths (`/invoices/new`, `/invoices/[id]/edit`, and the edit/delete/Paid-toggle actions) are Admin-only. Reading payment status is President-or-Admin.
- **Row-scoped, not role-scoped:** `/prs`, `/prs/[prId]`, `/pos`, `/pos/[poId]`, `/invoices`, `/invoices/[invoiceId]`. All need only an active session to reach, then decide per record through `canViewPR` — for the invoice routes via `lib/invoiceVisibility.js`, which owns the walk and no predicate of its own. **A refusal renders the ordinary not-found text**: never confirm that a record exists outside someone's scope.
- **`canViewPR`, in order, first match wins:** a `Draft` is visible only to its Requester, ahead of everything; then President/Admin; then the Requester; then anyone assigned to the PR's Job; then a signer on the chain; then the recipient of a correction request. The last two are status-agnostic and cost no queries. A missing link array throws rather than refusing.
- **Enforced by `offline/authz-structure.mjs`**, which enumerates every `app/api/**/route.js` and every `"use server"` export and requires each to be wrapped or listed as an exemption with a reason. A stale exemption fails. **What a pass proves is narrow** — for an exempt export, only that the helper is named somewhere inside it; order is not checked.

- **A NEW SURFACE THAT SHOWS A PR, A PO OR AN INVOICE GATES PER RECORD, NOT PER ROLE**, and it does so by calling `canViewPR` — never by writing its own comparison. This is the rule most easily missed, because adding a route touches no file under `lib/authz*.js` and nothing fails when it is skipped: the page simply shows everyone everything.

Read `docs/notes/authorization.md` before adding an endpoint, an exemption or a visibility clause.

## Utility scripts (scripts/)

```
scripts/
  tests/offline/       standing tier — plain node, no credentials, run by npm test in CI
  tests/verify-*.mjs   credentialed tier — writes fixtures to the shared base, by hand only
  tests/_fixtures.mjs  the cleanup contract every credentialed script goes through
  import/              reusable one-time backfills (Python)
  demo/                seed scripts, kept in the repo and NOT deleted from Airtable
  wrap-72.mjs          the 72-char wrap rule, executable — spans stay whole, --check verifies
```

- `scripts/tests/offline/` — the standing tier: plain `node`, no env vars, no Airtable, no dev server, creates nothing. `npm test` runs all of it and CI runs `npm test` on every push. The runner SCANS the directory, so a new check is in CI automatically. Files beginning with `_` are shared helpers.
- `npx eslint .` runs in CI as its own `lint` job and stays clean; a rule this repo deliberately breaks gets a scoped disable with its reason, never a tolerated error (#187).
- `scripts/tests/verify-*.mjs` — the credentialed tier: needs `.env.local`, writes throwaway fixtures to the shared base, human-initiated and deliberately not in CI. **Do not run these casually** — one run costs hundreds of Airtable operations.
- `scripts/import/` — reusable one-time backfills (Python). `scripts/demo/` — seed scripts, kept in the repo and NOT deleted from Airtable.
- **Where a new check goes is not a judgment call:** importing `lib/airtable/client.js`, or anything that imports it, puts a check in the credentialed tier, because that module throws at load without credentials.
- **Exit codes are mandatory for anything that computes a verdict:** 0 all clear, 1 something failed, 2 no failures but a part could not run. **A leak is 1, not 2** — a run that left rows on the shared base needs a hand.
- **A credentialed script's fixtures are deleted within the run that created them**, through `scripts/tests/_fixtures.mjs`. Its run tag must be unique per run (`V###-msosjxto`); a fixed prefix silently becomes a base sweep. Pinned by `offline/fixture-cleanup.mjs`.
- **Airtable formulas, rollups and lookups are outside CI entirely.** They are not in the repo and no file-only check can see them, so when a judgment rule lives on the Airtable side, a credentialed check must read the live schema or the live values and compare. The Metadata API does not expose a rollup's aggregation function at all.
- **What a green CI run does NOT mean:** that authorization is enforced. Source shape is not execution — a gate inside `if (false)` satisfies a structural check. Green means nothing cheap regressed.
- **Dummy records already in the base are deliberate, not leftovers.** Nothing in this base is to be removed as tidying-up.
- **Two permanent fixture accounts, a pair — do not delete either or change their flags.** `authz-fixture@` proves a refusal, `scoped-fixture@` proves that a row-scoped surface admits, and `soo@` is Admin and assigned; `verification.md` has the flags and what each is for.
- A session for any of them is minted with `createAuthToken` plus a form POST to `/api/auth/verify`.

- **A new offline check needs an anti-vacuity assertion in the same file** — something that proves the check can see what it is looking for. "X is absent" and "the traversal found nothing" are the same result, and a check that cannot fail is worse than no check because it reads as coverage.
- **The offline tier cannot see rendering.** It reads source and pure functions; it never renders a page, so a column that does not appear, a width that wraps and a field that reaches the browser are all invisible to it. Those are checked in a browser with the two fixture accounts and the finding written into the PR.

Read `docs/notes/verification.md` before adding a check, a script or a seed.

## Git workflow rules

- Never commit to main. One branch per issue: {issue#}-{short-desc}.
- Commit format: `{type}: {description} (#{issue#})` — feat / fix / chore / refactor / docs (project markdown/CLAUDE.md changes) / test (changes under scripts/tests/).
- PR description must include `Closes #{issue#}`. Squash merge — PR description becomes the final commit body.
- PR title is the representative commit's subject. Body opens on `Closes #{issue#}` — no issue summary before it — then four sections: **What this delivers** (a list of what changed), **Key design decisions** (a paragraph per decision, bold lead-in, five paragraphs at most), **Testing** (a table of check and result), **Not in this issue** (what a reader would look for and not find, and where it went).
- **A decision earns a paragraph only if somebody who does not know it could undo it.** A reason that strengthens a conclusion rather than holds it up is cut, and a measurement recorded in a docstring or the area notes is cited rather than repeated.
- `Testing` carries only what was actually verified, and carries no methodology and no sentence that would read the same on every branch — how a session was minted, how an empty state was reached, that new copy was re-read against the ban lists. What was not verified is left out rather than disclaimed. Nothing is described as finished, complete, done or deployed — `implemented and merged` is a fact about the branch.
- A doc-only PR with no issue omits the `Closes` line and says so in its first line. The body itself goes in pr-body.md at repo root, gitignored alongside commit-msg.txt.
- Issue title is a plain noun or verb phrase — no closing period, no commit-type prefix. Issue body is one or two paragraphs of prose: no subheadings, no bullets, no line breaks inside a paragraph, and it says WHAT changes rather than how.
- **The body is what the issue IS, stated without a tense, so it has to be true now** — a changed scope or decision, or an implementation that diverges from it, is fixed IN the body. A comment is what the issue is NOT: a finding from another issue's work, a measurement, a record of what was observed at the time. The test is whether the sentence still reads as true and useful with no date attached to it. When a comment makes the body stale, the body is edited and the comment stays.
- Line-wrap commit bodies + PR descriptions at 72 chars, table rows and fenced blocks included, and NEVER inside a backtick span — wrap around it. A span too wide even without its backticks moves to a fenced block — a COMMIT-MESSAGE escape only, since a PR body is copied whole into a web form where a fence breaks, so a PR body splits the span or rephrases instead. `scripts/wrap-72.mjs` is that rule executable (`--check` reports without rewriting), and its output is read rather than trusted: it passes table rows through untouched, since wrapping one breaks the table, so keep cells short and move long explanation to prose under the table; and it reflows list items, which has altered a marker before now. Prompts/comments don't need wrapping.
- Wrap literal `<tag>`-looking text in backticks in PR descriptions; write an issue reference as bare #num so GitHub autolinks it.
- If an issue is already covered by other work, comment explaining why, then close — never silently close via Closes #.
- Milestones = Phases (0-6) or standalone cross-cutting milestones. Stay scoped to the current issue's Milestone unless told otherwise.
- **A comment or doc line that is FALSE about the current code or base is corrected on sight (#181)**, in whatever commit found it, rather than filed as a follow-up. It changes no behavior, and deferring costs more than fixing: an entry someone has to read, triage and schedule. **The boundary is falsity against improvement** — correcting a lie is maintenance, making a comment better is scope. Anything that changes behavior, moves code, or needs a judgment about what the right answer is stays out of scope as before.
- Don't open a PR unless asked. Never commit yourself — write commit-msg.txt at repo root (gitignored), user commits manually.
- All GitHub content, project markdown, and web-app-facing text is English regardless of conversation language.
- **That English is US English** — prose as well as identifiers, and in code comments as much as in user-facing copy. `behavior`, `judgment`, `canceled`, `labeled`, `catalog`, `gray`, `normalize`, `license`, `while` (not `whilst`). The one thing it does NOT reach is a value that belongs to something outside this repo — an Airtable select option, a dependency's package name (`@img/colour` in `package-lock.json`), a third-party field or CSS keyword — where the external spelling is the correct one and changing it breaks a lookup rather than fixing a style. Enforced under `app/` and `lib/` by `offline/us-english.mjs` (#215), which is scoped there so that documentation — this line included — can cite a form without being excused for it.
- **Every text this repo puts on GitHub uses the repository's vocabulary** — issue titles, bodies and comments, PR titles and bodies, commit messages. Same words as the code and the docs, for the same reason: one thing named twice is two things to whoever reads only one of them.

---


## Open work with no issue

**Everything here is work recorded as needing doing that has no issue tracking it.** Once an issue exists the tracker is the record and the line goes — not replaced by a "tracked as #N" annotation, which would mean a doc edit every time an issue closes. The numbers in the headings are the *parent* issues these came out of, not tracking references.

**This file records no phase, milestone or branch status at all.** What has merged is in the git history and in the tracker, and a document that restates it goes stale without anyone noticing.

**The lists themselves are in `docs/notes/backlog.md`** — the withdraw, upload, row-visibility and verification follow-ups, and the unfiled items under them. They are read when picking up work, not when doing it, which is why they are not here.
