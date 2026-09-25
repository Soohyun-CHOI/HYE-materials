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
| `lib/listFilters.js`, `app/components/ListFilterBar.js` | `docs/notes/deliveries-and-invoices.md` |
| `app/addresses/**`, `lib/address*.js` | `docs/notes/addresses.md` |
| `app/(tools)/**`, `lib/tool*.js` | `docs/notes/tools.md` |
| `lib/airtable/**`, `lib/airtableFormula.js`, `lib/airtableOps.js` | `docs/notes/airtable-access.md` **and** `docs/notes/naming.md` |
| `lib/ids.js`, `lib/idSequence.js` | `docs/notes/id-generation.md` |
| `lib/auth.js`, `lib/authz*.js`, `lib/prVisibility.js`, `lib/invoiceVisibility.js`, `app/login/**`, `app/api/**` | `docs/notes/authorization.md` |
| `lib/blobIngest.js`, `lib/prDraft.js`, `app/prs/new/**`, `lib/file*.js`, `app/components/File*.js`, `app/components/PdfPages.js` | `docs/notes/uploads-and-drafts.md` |
| `scripts/**`, `eslint.config.mjs` | `docs/notes/verification.md` |
| renaming a field, a screen word or an identifier | `docs/notes/naming.md` |
| what a screen carries, or adding or removing a page | `docs/briefs/README.md` |

`docs/notes/backlog.md` is the open-work list and is not tied to a path — read when picking up work, not when doing it.

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
- **Every string a screen can render** → nowhere. `scripts/screen-strings.mjs` produces the list on demand (#288), and `docs/briefs/strings/` records only what it CANNOT produce and what no reader can reach. A file per screen was built, measured and dropped; the README there carries the figures and how a naming decision is made from the tool instead.
- **No phase, milestone or branch status, ever.** What has merged is in the git history and in the tracker, and a document that restates it goes stale without anyone noticing.
- If no area file fits, add one and an index row above it, in the same commit.
- **The audience test decides ties.** A rule whose readers are wider than any one glob stays here; a rule only its own area's editor needs goes to that area's file. That is why "records in this base are not removed as tidying-up" is here rather than in `verification.md`.

**A budget, not a guideline.** An issue's whole delta to this file should sit under roughly 400 bytes — #211's would have been 410 under these rules, against the 8,798 it actually took. `offline/notes-index.mjs` fails the build when this file passes **55,000 bytes**. When that fires, move a section out; do not raise the ceiling.

## What this project is

Replacing an email-and-Excel-based Purchase Request -> Purchase Order -> Invoice workflow (Hanyang ENG, a construction company) with a web app owning the full lifecycle. The core problem isn't any single step but that the three were never connected: the same order lived in a spreadsheet, an email thread, and a vendor's invoice with nothing tying them together, so reconciling what was ordered against what was invoiced was manual and after the fact.

## How the work flows

Site staff talk to a vendor first and get a quotation — that happens outside the app, and it is why a PR arrives with the vendor and the prices already settled. The requester raises the PR with that quotation attached and names an ordered chain of signers. Each signer approves, edits and continues, or returns it for correction to anyone earlier. Full approval generates the PO as a frozen snapshot of the items, the President signs it, and **the order is placed by emailing that PDF to the vendor from inside the app (#281)** — sending it IS placing it, which is why the requester who raised the request may do it as well as the office. The vendor's invoice comes back to office staff, who enter it and reconcile it line by line against the PO.

Three kinds of people, and the distinction is organizational rather than a privilege ladder. **Site staff** are non-Admin Employees: they raise PRs, sign, and withdraw their own. **Office staff** all run with `Is Admin: true`, so gating something to Admin scopes it to the office — invoicing is Admin because invoicing is office work, not because Admin is more trusted. The **President** signs POs; nothing else is role-specific to them. Vendors have no account and never touch the app.

What that boundary implies keeps coming up: a decision made before a PR exists cannot be helped by a form inside one (#19), and a status describing something that happens outside the app has nobody to set it (#144).


## Architecture

- Next.js (App Router, JavaScript, Tailwind), deployed on Vercel.
- Airtable as data store only (base: "Material Purchases"). All business logic lives in the backend. Airtable formulas only for pure data transforms, never workflow logic.
- Auth: magic link only, restricted to company email domain, verified. New signups always land as plain Employee (Is Admin: false) — promotion is a manual Airtable edit.


### Editing the Airtable schema

**The schema is editable by either of us, and a schema change ships in the SAME COMMIT as the code that reads it.** No production data exists yet, so the moment to fix a name or a shape is now.

**Renaming a field is safe and the procedure is mechanical**: a rename carries every formula, rollup and view filter with it, so the only thing it breaks is a string literal here — and a grep coming back empty does not finish it. `airtable-access.md` has the mechanism, the read-every-hunk step and the near-miss behind them.

**A schema edit may not be assumed scriptable.** The Metadata API cannot write everything, and what it refuses is measured rather than read off the documentation — `docs/notes/airtable-access.md` has the figures, including which of the refusals force an invariant onto the DATA instead. **A new table's Unit field is one of them** — leave it off and let `scripts/import/add_unit_options.py` create it.

**Deleting or retyping a field is not the same as renaming it.** A rename preserves every value; a type change can silently drop them. Records in this base are not to be removed as tidying-up.

## Service layer pattern

One module per rule, and **one rule, one implementation** — see below. Each entry is the path and what it owns; why it owns it is in the `docs/notes/` file for its area.

- `lib/airtable/client.js` — the shared connection, the table names, the batched readers and `withKeyLock()`. Throws at module load without `AIRTABLE_API_KEY`.
- `lib/airtable/{table}.js` — one file per table, plain async functions.
- `lib/airtableOps.js` — the Airtable operation counter and its attribution scope. Server-only; a forbidden root for client bundles.
- `lib/airtableFormula.js` — `formulaString`, the one escape for an interpolated value, and the whole-formula builders.
- `lib/ids.js` — all ID generation: the lock, the query and the create.
- `lib/idSequence.js` — the pure half: the daily ID families and the child relations.
- `lib/productName.js` — the product's name. Not the company's legal name, which is `lib/poPdf.js:HYE_BUYER_NAME`.
- `lib/userName.js` — the name a screen prints for a user (#381). **A name field is read nowhere else.**
- `lib/authTokenState.js` — whether a magic-link token can still be used, and the TTL.
- `lib/loginDestination.js` — where a signed-out reader was headed (#373).
- `lib/units.js` — `CANONICAL_UNITS`, the JS source of truth for the Unit select list.
- `lib/editLogFields.js` — the labels a `PR Edit Log` row can be about. No call site may pass `createEditLogEntry` a string literal.
- `lib/variance.js` — invoice/PO variance checks and `VARIANCE_COPY` (#179), plus the cent rule (#254, #308, #405). **Nothing writes a quantity or a currency figure into an item, a document total, or either side of the invoice header comparison without asking them.**
- `lib/itemNaming.js` — `normalizeItemText`: trim, collapse internal whitespace, case untouched.
- `lib/searchTokens.js` — how a typed query becomes match tokens (#325), for both of the app's search boxes.
- `lib/prItemMerge.js` — identical PR item rows are one item on save (#170), and `PR_ITEM_MERGE_COPY`.
- `lib/rollbackReport.js` — what a failed rollback in the signing chain reports (#188).
- `lib/materialCategory.js` — a category's composed label and the walk that narrows to one (#354, #355, #367), plus the `Category`+`Item Name` pair no call site may spell apart. **Nothing here writes a label.**
- `lib/airtable/materialCategories.js` — the catalog's three reads (#355, #356) and its one write (#368). **A duplicate leaf code throws rather than letting a row win.**
- `lib/categoryCreation.js` — adding a path to the catalog (#368): the 900 block, the resolve-or-mint, the drafted name and every word the screen says.
- `lib/addressCreation.js` — creating an address (#384): the label key, the addresses a job uses, the refusals and every word the screen says.
- `lib/addressChoice.js` — how a form asks where material goes, on both screens that ask (#385, #387). **A request stores an ADDRESS and not a choice.**
- `lib/materialIdentity.js` — what makes two ordered items the same material (#356). The lock key, the cache's grouping key and `getMaterialByKey`'s values all come from here.
- `lib/materialsCache.js` — the three writes a generated PO makes to the item axis, and the per-entry best-effort loop.
- `lib/toolStatus.js` — the tools track's two closed vocabularies and the three maps over them (#334, #335, #362, #363). No call site passes `createToolLogEntry` a string literal.
- `lib/toolJob.js` — the job a `Tool Log` row is filed against (#363), and the picker's words.
- `lib/toolRegistration.js` — registering tool items (#338): the key, the ceiling, and every word the screen says.
- `lib/toolItemView.js` — what one tool item's page shows (#340), and every word it says.
- `lib/toolRoutes.js` — every address on the tools axis (#348), and the code a label prints (#411). **That code and the printed path's segment are one string.**
- `lib/toolLabelQR.js` — the QR symbol a tool label carries (#351).
- `lib/toolLabelSheet.js` — the sheet a tool label prints on (#353).
- `lib/toolTransition.js` — what a person may record against a tool item (#362, #363): the two transitions, the refusals, and every word it says.
- `lib/toolListView.js` — the two tools list screens (#339), the app's first paging, and every word they say.
- `lib/materialHistory.js` — the two queries behind `/materials` and `/materials/[materialId]`, and the per-row identifier gate.
- `lib/materialPriceView.js` — the view rules for those screens: row ordering, the lowest-price mark, the quantity caveat, and `MATERIAL_SEARCH_COPY` (#357).
- `lib/poItemQty.js` — what leaves an order open: `uninvoicedQty`, `hasUninvoicedQty`, `countsAsOrdered`, and `hasUninvoicedItems` per order.
- `lib/poListView.js` — the PO list's Status text, its empty states, and both strips above it (#176, #295).
- `lib/listFilters.js` — what the four document lists filter by (#324), search by (#325) and page by (#326), and every word the bar and the foot say. **`LIST_PAGE_SIZE` is the one place a page size lives and no screen reads it** — the cut is after the gate and after the bar, so the read stays whole. **A closed set a list renders is a filter when the document or its item rows hold it, and a strip's subject when it lies along a wait.** **A box searches the names ON THE ROW — the id, a second name the row itself carries, the vendor and the job — never another document's.**
- `lib/poDocuments.js` — an order's two document lists: the invoices charging it and the deliveries filling it, and `PO_DOCUMENTS_COPY`.
- `lib/poWithdraw.js` — the PO-withdrawal predicate, both voices of its copy, and the guarded write.
- `lib/poSend.js` — sending a signed order to the vendor (#281): `PO_SENT_STATUS`, the refusals, and the screen and mail copy. `SIGNED_NOTICE_COPY` (#290) is the mail telling the requester to place it.
- `lib/poQuotations.js` — the quotations an order's document carries (#40): every one, in `Quotation ID` order, told apart by contents, each turned into pages, and the refusal naming one it cannot append.
- `lib/poDeliveryAddress.js` — the address an order freezes (#386): read from the request and never from the job.
- `lib/poUnsigned.js` — `isPOUnsigned` and the signal wherever an order is offered for an invoice (#198). `AWAITING_SIGNATURE_COPY` (#292) is the mail asking the President to sign.
- `lib/poPickerOptions.js` — which orders one slot's PO dropdown may offer (#242).
- `lib/blobIngest.js` — `confirmIngestThenDelete`.
- `lib/fileSource.js` — `isOurBlobUrl`, our own store and no other (#438), and `assertOurBlobFiles`, every attachment writer's backstop.
- `lib/fileLinks.js` — where an uploaded file is reached (#331), and the viewer's words. Pure — `"use client"` files import it.
- `lib/fileView.js` — how a drawn file is sized, turned and sharpened (#433).
- `lib/uploadLimit.js` — the one ceiling every user upload is held to (#146): `MAX_UPLOAD_BYTES`, the refusal's words, and the guard every upload form opens its try with.
- `lib/quotationReuse.js` — `shouldReuseQuotation`: when a re-saved Draft keeps its existing Quotation record, and `planQuotationEntry`, what a save does with each entry (#438), and `detachQuotations`, what a form keeps once its draft is gone (#440).
- `lib/directPurchase.js` — the way out of an invoice with no order (#272): the one predicate the modal and the action share, and `DIRECT_PURCHASE_COPY`.
- `lib/directPurchaseClaim.js` — the strip's rows and the Draft a site raises from one. Credentialed.
- `lib/prKind.js` — which of three kinds a request is (#272), the mark for each and the signer's sentence.
- `lib/prWait.js` — a record waiting for a request: `WAIT_STAGE`, and the listed-against-offered split both strips above `/prs` obey (#272).
- `lib/deliveryAllocation.js` — the allocation rule (`planDelivery`), its replay (`recomputeOverDelivery`), `ALLOCATION_COPY`, and the dropdown helpers the form imports.
- `lib/deliveryAddress.js` — where a delivery arrived (#387): the default taken from the orders it attaches to. **A job's address defaults `/prs/new` and nothing else, and a recorded delivery's is never rewritten — stock is counted by it.**
- `lib/deliveryCandidates.js` — the Job → Disciplines → PRs → POs → PO Items walk that finds ordered items. Credentialed.
- `lib/deliveryStatus.js` — delivered against invoiced against ordered: the judgment, `STATUS_COPY`, the list filters, the worklist order. All three order-scope summaries live here (#311), and `AWAITING_DELIVERY_DAYS` (#263). **A screen showing an invoice never compares `Due Date` to today (#316)** — `invoicePayment` hands back the verdict and its day count.
- `lib/deliveryReconciliation.js` — the two batched walks joining invoices to deliveries through `Invoice Items` → `PO Item` ← `Delivery Items`. Credentialed.
- `lib/deliveryInvoiceLink.js` — the invoice/delivery pairing rule, its dropdown options and every refusal.
- `lib/deliveryInvoiceMatch.js` — the COMPUTED pairing (#231): containment, the price gate, a delivery's remaining capacity, the rival clause and its tie-break, `PAIRING_COPY`. One predicate serves both directions.
- `lib/deliveryInvoiceCandidates.js` — which invoices a delivery may name, which deliveries an invoice may name, and the guarded write. Credentialed.
- `lib/deliveryAccess.js` — `canAccessJobDeliveries`, the one Job-scope rule for deliveries.
- `lib/deliveryDelete.js` — the delete predicate, the three voices of the confirmation, and the guarded write.
- `lib/overage.js` — the overage request's judgment, the quotation-supplying invoice, and `OVERAGE_COPY` (#217, #219, #265).
- `lib/overagePR.js` — the read and write sides of the correction: the facts, the Draft it creates, and the apply step (#217). Credentialed.
- `lib/invoiceJob.js` — the job an invoice charges for (#314): one judgment, walked from the orders it charges, **taking no reader** so two readers cannot see two values on one row.
- `lib/invoiceItemFold.js` — `foldInvoiceItems`: a split invoice item reads as one row again.
- `lib/invoiceItemsMissing.js` — an invoice holding no item rows (#330): the predicate and the one sentence its screen and `updateInvoiceAction` share. **The create path's refusal is a DIFFERENT fact and keeps its own words.**
- `lib/invoiceOrderBreakdown.js` — an invoice's items under the orders they charge (#237), and `ORDER_BREAKDOWN_COPY`.
- `lib/invoiceDeliveryEntries.js` — the invoice detail's delivery entries (#241), one per folded item.
- `lib/prRequester.js` — who raised a request, and whether a write may take it as the reader's own draft (#440). **Nothing else reads `Requester` off a request.**
- `lib/prVisibility.js` — `canViewPR`, the one row-visibility rule for a PR.
- `lib/invoiceVisibility.js` — `seesEveryInvoice` and `getVisibleInvoiceIds`, the walk that reaches `canViewPR` from an invoice. Credentialed. **`seesEveryInvoice` answers only whether the walk can be skipped (#309): payment carries no gate.**
- `lib/authzWrap.js` — the guard-wrapper factories. Nothing here imports `next/*`.
- `app/components/modalStyles.js` — `MODAL_BACKDROP` / `MODAL_CARD`, the single source for modal styling. **A modal is for an act that cannot be undone; an act that can is edited in place (#318)** — about where an ACT goes, not about an overlay performing none: `/prs/new`'s three are a prompt, a picker and a notice. **Anything that opens over the page — modal or not — opens from the keyboard, closes on `Escape` as well as by its opener, and hands focus back to that opener.**
- `app/components/listTableWidth.js` — `LIST_TABLE_CLASS`, the width the list tables are held to (#183). **A table on a different page shell declares its own and is not a stale copy.**
- `app/components/FileFrame.js` — how an uploaded file is drawn, and what is said when it cannot be (#331, #422, #433). **A screen showing a file calls it; a second frame or `<img>` for one is a duplication.**
- `app/components/PdfPages.js` — a PDF's pages, drawn by the app (#433). **The one module that draws a page, and the only one that loads PDF.js.**
- `app/components/Instant.js` — a stored instant, drawn in the reader's own zone (#374). **A time renders in the reader's zone and names none; the one surface with no reader — the order document — names the zone it used.** No Server Component may format one.
- `app/components/CategoryPicker.js` — the four-level category control, on both screens that reach an item (#367). No state and no sentence of its own.
- `app/components/DeliveryStatusMarks.js` — `StatusChip` / `QualifierMarker`. Presentational only; the semantic tone comes from `lib/deliveryStatus.js`.
- `AIRTABLE_API_KEY` is server-side only and never in the client bundle.

A service-layer function with no caller is verified by nothing — `upsertMaterial` sat unused from Phase 0 to #18 carrying three defects. **An export nothing outside its own file imports now fails a check (#182).**

### One rule, one implementation

Two implementations of one judgment diverge, and catching the divergence then needs a third thing. A duplication is not closed by "leave it as two for now": if there is a real reason to keep two, that reason has to be a **measurable condition**, and the path to merging when it lifts has to be written down.

## Data model (26 tables)

Field lists and link topology only. Why a field is shaped the way it is lives in the `docs/notes/` file for its area — see the index above.

**Users**: First Name (primary, typed at the first sign-in, blank until then), Last Name, Email, Phone, Role (Employee/President), Is Admin, Status (Active/Inactive), Created At, Assigned Jobs (link -> Jobs, multiple, optional).

**Jobs**: Job Code (primary), Job Name, Business Unit, PIC/Manager (link -> Users) + Phone/Email (Lookups), Delivery Address (link -> Addresses, single — the DEFAULT; `Alternate Delivery Address` went in #384), Disciplines/Users/Addresses (reverse-links).

**Disciplines**: child of Jobs. Discipline Label (primary, formula = {Job} & "_" & {Discipline Name} — an underscore, as `Material Label` joins; this line said ` - ` until #280 read the live formula), Discipline Name (human-entered), Job (link, single). Was `Lines` until #280.

**Vendors**: Vendor Name (primary), PIC Name/Phone/Email (plain text, external), Address (link, single), Purchase Orders (Lookup via PR chain).

**Purchase Requests**: PR ID (HYE-PR-YYMMDD-##), Requester/Vendor (links, single), Discipline (link, single), Job (Lookup via Discipline, read-only), Delivery Address (link -> Addresses, single, app-enforced — required at submit, #385), Created At (datetime, UTC — timestamped per the *At convention), Status (Draft/In Review/Approved/PO Signed/Withdrawn; PO Signed fires when President signs the generated PO), Withdrawn At (datetime, UTC, *At convention — stamped only when withdrawn, #122), Current Signer Step, Items Subtotal (rollup, PR Items only), Shipping Fee (optional currency; fixed once set, changeable only via Edit and continue), Total Amount (formula = Items Subtotal + Shipping Fee, blank = 0), Notes, Quotation Files (Lookup, plural).

**PR Signers** — dynamic ordered approval chain:

**PR Items**: PR Item ID, PR (link), Category (link, single -> Material Categories, app-enforced — **the item's identity since #355; `Item Name` is written from its `Item Name` and typed nowhere, #416**), Item Name, Size, Unit (single select, canonical list — see Units), Qty, Unit Price, Amount = live formula, Remark (free text only), Quotation (link, single -> Quotations — auto-linked when only one exists, dropdown once 2+, never silently reassigned).

**PR Edit Requests**: PR Edit Request ID, PR, Initiated By, Sent To, Notes, Requested At, Resolved At, Status (Pending/Resolved). Was `Correction Requests` until #333.

**PR Edit Log**: PR Edit Log ID, PR, Changed By, `Field` (select — exactly the seven labels the code can write: the six `ITEM_FIELD_LABELS` values plus `Shipping Fee`), Old Value, New Value, Changed At, Notes (optional). Append-only: no update function, and `prEditLog.js` deliberately has none.

**Purchase Orders**: strict 1:1 with PR. PO ID (HYE-PO-YYMMDD-## — #313 took the 4-digit year off and rewrote the stored ones), PR (link), Vendor (Lookup via PR), Quotation File (Lookup), Our PIC/Manager (links), Created Date, President Signed(+At), Status (Awaiting Signature/Signed/**Sent to Vendor**/Withdrawn — the third revived in #281), Withdrawn At (datetime, UTC, *At convention — stamped in the same write as Status -> Withdrawn, #138), Sent At / Sent By (link -> Users, single, app-enforced) / Sent To (text — the address used) — one send, one write, never rewritten (#281), PO PDF File, Items Subtotal (rollup, PO Items only), Shipping Fee (plain currency, frozen copy from PR at PO-generation time), Total Amount (formula = Items Subtotal + Shipping Fee, blank = 0 — PO PDF's TOTAL line), Delivery Address (link -> Addresses, single, app-enforced — frozen copy of the PR's at generation, #386; blank where the PR has none), Uninvoiced Items (rollup, SUM of PO Items."Has Uninvoiced Qty").

**PO Items**: frozen snapshot from PR Items at PO-generation — NOT live. PO Item ID, PO (link), Item Name, Size, Unit (single select, same list), Qty, Unit Price, Amount = static value, Remark, Invoice Items (reverse-link, multiple — partial invoicing is real), Has Uninvoiced Qty (formula = `IF({Qty} - {Invoiced Qty} > 0, 1, 0)`). No free-text/user-facing Unit entry point; the snapshot fields are written only by lib/poGeneration.js.

**Quotations**: Quotation ID ({PR ID}-Q{seq}), Vendor Quotation Code (human-entered), Vendor/PR (links, single), File (attachment, required at creation in-app). At least one required per PR; can have more than one over its lifetime (dynamic list on PR form, or later via Edit and continue).

**Invoices**: Invoice ID (HYE-INV-YYMMDD-##), Vendor Invoice Code (human-entered), Vendor (link), Issue/Due Date, Amount Due ("Vendor's Stated Total" — never auto-overwritten by the backend; human edits allowed and recompute variance, #117), Shipping Fee, Tariff (optional), Sales Tax (optional currency, #283 — on `Invoices` only), Items Subtotal (rollup), Calculated Total (formula = Items Subtotal + Shipping Fee + Tariff + Sales Tax, blank = 0), Variance Flag (checkbox, backend-set), Paid Date (calendar — its presence IS the payment, `Sent At`'s shape; the `Paid` checkbox went in #318), File (attachment, required), Delivery (link -> Deliveries, single, optional — app-enforced, #210), Recorded By (link -> Users, #382).

**Invoice-PO Link**: join table, many-to-many. Primary = plain autoNumber. Both link fields single-record.

**Invoice Items**: Invoice Item ID, Invoice + PO (links, single), PO Item (link, single, app-enforced — #278), Item Name, Size, Unit (single select, same list), Qty, Unit Price, Amount = live formula, Variance Flag (checkbox, backend-set), Remark (shared, Unit Price/Qty discrepancies). Size/Unit are frozen copies from the linked PO Item, reference-only, no edit path (mismatch = wrong PO Item picked). Only a PR takes typed items, so a charge with no ordered item behind it is not a state this app has.

**Addresses**: Address Label (primary, human-typed, app-enforced unique — the one `X Label` primary NOT composed, #384), Line 1/2, City, State, Zip Code, Country, Formatted Address (formula), Jobs (link -> Jobs, multiple, #384).

**Materials**: **item identity** (#18). Natural key = **Category + Size + Unit** (#356 — it was `Item Name` + Size + Unit, and a name was typed). `Category` (link, single -> Material Categories, app-enforced), `Size`, `Unit` (the same 19-value single select as the three item tables, see Units) are the only writable fields. Computed: `Item Name`, `Category Code` and `Category Path` (lookups through `Category`, of `Item Name`, `Level 4 Code` and `Category Label` — the last is searched and never rendered, #416), `Material Label` (primary, formula = `Item Name` + `_Size` + `_Unit`, omitting blanks — the lookup concatenates BARE, no `ARRAYJOIN`), `_Record ID`, the `Committed Qty` / `Signed Qty` / `Invoiced Qty` rollups and the `Uninvoiced Qty` formula. The `Material Prices`, `PO Items` and `Delivery Items` links are all maintained from the far side. USD only.

**Material Categories**: HQ's four-level tree, one row per path (#354). `Category Label` (primary, formula; the rule is `lib/materialCategory.js`), `Level 1–4 Code` / `Level 1–4 Category` (all singleLineText; **a code is text and never a number**), `Item Name` (singleLineText — the readable name, **stored and never composed**: eight templates produce it, so a hand-added path gets a label for free and no name, #415), `Materials` (reverse-link, #356). Reference data, loaded re-runnably from a committed CSV, keyed on `Level 4 Code`. **A leaf the office adds in the app takes the 900 block and a name no other category carries (#368).**

**Material Prices**: item × vendor (#18). Natural key = Material + Vendor. `Price Label` (primary, formula over the two links), `Material` / `Vendor` (links, single), `Unit Price`, `Latest Date` (calendar), `Latest PO` (link), and `Material Record ID` / `Vendor Record ID` lookups. Still a latest-value cache.

**Deliveries**: one recorded delivery (#162). `Delivery ID` (HYE-DL-YYMMDD-##), `Job` / `Vendor` (links, single), `Packing List PO` (link, single, optional), `Delivery Address` (link -> Addresses, single, app-enforced — required at entry, written once, #387), `Received Date` (calendar), `Recorded By` (link → Users, single), `Created At` (datetime, UTC), `Notes` (long text, optional), `Packing List File` (attachment, required at creation), `Delivery Items` (reverse-link), `Invoices` (reverse-link, plural).

**Delivery Items**: one allocated slice of a delivery (#162). `Delivery Item ID` ({Delivery ID}-{seq}, 3 digits), `Delivery` (link, single), `PO Item` (link, single, **optional**), `Material` (link, single), `Item Name` / `Size` / `Unit` (frozen reference copies), `Qty`, `Over Delivered` (checkbox, backend-set).

**Direct Purchases**: material a site bought with no order behind it (#272). `Direct Purchase ID` (HYE-DP-YYMMDD-##), `Vendor` / `Job` (links, single; Job required, and app-enforced), `Vendor Invoice Code`, `Issue Date` (calendar), `File` (attachment, required at creation), `Notes`, `Recorded By` (link → Users, single), `Created At` (datetime, UTC), `Purchase Request` (link, single, optional). No items, no total and no status — what a row is waiting for is read from that last link and the request's own `Status`. **The request's KIND is read from the same link and stored nowhere else**.

**Tools**: the KIND a tool is bought as (#334) — first table of the tools track, which shares this base, this login and these people with everything above it. `Tool Name` (primary, human-entered, app-enforced unique; no minted ID, as `Vendors` and `Materials` have none), `Tool Items` (reverse-link).

**Tool Items**: one physical tool, the thing a QR label is stuck to (#334). `Tool Item ID` (HYE-TL-YYMMDD-###, primary, 3-digit sequence — the label prints and the QR carries it WITHOUT the `HYE-TL-` token, #411), `Tool` (link, single), `Status` (In Stock/Out/Retired), `Job` (link → Jobs, single, **required and app-enforced**), `Tool Log` (reverse-link). **`Status` and `Job` are both caches of the last `Tool Log` row, written by this app and never by an Airtable formula.** No `Created At`: the `Registered` log row holds it.

**Tool Log**: what has happened to one tool item, append-only (#334). `Tool Log ID` ({Tool Item ID}-{seq}, 3 digits), `Tool Item` (link, single), `Event` (select — Registered/Checked Out/Checked In/Retired), `Job` (link → Jobs, single, **on every row and never blank**, which is what makes the previous row the previous job — so **no `Former Job` is stored**; where each event learns it is in `tools.md`), `Recorded By` (link → Users, single), `Event At` (datetime, UTC), `Checked Out To` (text — the person a tool item was handed to, **on `Checked Out` rows and blank on the other three, app-enforced both ways**; no account exists for these people, #376). `Notes` was here until #363 dropped the rule it existed for.

**Auth Tokens**: Token (primary), Email, Expires At, Used, Created At. Single-use, 15-min TTL.

### Units

One shared 19-value single select, source of truth `lib/units.js:CANONICAL_UNITS`. **Never use `typecast` on a Unit write** — it invents an option, which is how a canonical list silently gains a 20th value; omit an empty Unit instead. The derivation is in `airtable-access.md`; what a NEW table owes this list is under `Editing the Airtable schema`.

### Screen words and the fields behind them

**A screen word is not a field name**, and a code identifier may diverge from the field it reads on purpose. Before naming a field, a screen word or an identifier, read `docs/notes/naming.md` — it holds the word-to-field table, the conventions (`X ID` / `X Label` / `X Date` / `X At`, a checkbox takes a participle, a subtraction is named for what it subtracts, plain `Qty` for a row's own quantity) and the divergences that are deliberate.

- **A CONCEPT WITH A TABLE BEHIND IT TAKES THAT TABLE'S NAME, AND NOTHING ELSE MAY BORROW THE WORD.** `Deliveries` → a delivery, never a shipment or an arrival; `Invoices` → an invoice, never a bill; `Disciplines` → a Job's discipline (`Lines` until #280, which freed `line` from every table and left it naming no row at all); `PR Edit Requests` → an edit request, and `correction` is owned by no table since #333 — what bars it for #167's excess is now the screen's own word for a send-back (**overage request**, #272). Where no table owns the word, `naming.md` records the one that wins — which is why it is `ordered item` and not `PO item` — and a deliberate divergence is a row in the same table with its reason. Where the participle will not carry a transitive sentence the verb is `charges` — `No invoice charges this order yet.` — never `invoices`, and `charges` is a verb ONLY: an `Invoice Items` row is an **invoice item**, never a charge (#303). **Identifiers are bound and were swept in #227**, and `offline/line-vocabulary.mjs` inventories the ones that legitimately keep a barred stem, with a reason each. What no check can hold is prose, which is why the rule is here.
- **A CHILD TABLE TAKES ITS PARENT'S NAME, AND AN APPEND-ONLY EVENT TABLE ITS SUBJECT AND `Log` (#333)**; the `TABLES` key is that name in SCREAMING_SNAKE (`offline/table-field-names.mjs`). A screen word the schema term may not follow back is an entry in `docs/briefs/design-copy-findings.md`.
- **EVERY DOCUMENT LIST HEADS ONE COLUMN `Job` AND CARRIES NO DISCIPLINE (#314)** — a discipline is how a request is filed, so it stays on the two screens that hold one. Held by `offline/job-column.mjs`.
- **A WORD THE DESIGN CHANGES IS SWEPT IN THE SAME COMMIT.** Screens are implemented one at a time, so the string left on another screen leaves the app half in the old word, and a check under `scripts/tests/offline/` holding it by value guards a word the app no longer says while passing. `scripts/screen-strings.mjs` finds the screens; a grep of that directory finds the checks.
- **EACH ITEM TABLE'S ROW TAKES ITS OWN TABLE'S NAME IN THE SINGULAR (#303)**; the modifier drops where no second kind of item row is in the string, and **a sentence naming two carries both**. A label takes its screen's subject, so every items table stays headed `Items`. Held by `offline/item-row-nouns.mjs`.
- **AN ACTION SAYS WHAT IT DID BY ARRIVING, AND NO SCREEN READS A CONFIRMATION OFF THE URL (#321)** — a parameter saying so outlives the sentence and shows a stranger a confirmation for an act they did not take. Four screens keep a line because their action lands on no document. `offline/url-parameters.mjs` inventories every parameter and holds both directions.

## ID generation (lib/ids.js)

Read `docs/notes/id-generation.md` before touching `lib/ids.js` or `lib/idSequence.js` — it holds the counter rule, the six daily families and the nine child relations.

## Querying parent/child data

`filterByFormula` cannot match a link field against a record ID. Read the parent's reverse-link field via `.find(parentRecordId)` (`getLinkedRecords()`), never filter the child table directly. **The children themselves are read in one query per 50 ids, never one `find()` per child (#193)** — `findChildRecords`, which keeps the link array's order and throws on an id that does not resolve. Exception: `materialPrices.js:getMaterialPrice` uses the `Material Record ID` / `Vendor Record ID` lookups, because a price row is keyed by two links and has no parent whose reverse-link would do.

**Client bundle safety — an import is an execution.** No `"use client"` file may import anything that reaches `lib/airtable/` or `lib/airtableOps.js`, at any depth. Nothing tree-shakes away a dependency whose evaluation has side effects, so a pure helper in a credentialed module has to MOVE rather than be imported selectively. `next build` does not catch this. A `"use server"` file is a boundary, not a dependency. Enforced by `offline/client-import-safety.mjs`.

**Formula injection — every interpolation escapes.** The one escape is `lib/airtableFormula.js:formulaString`, and every interpolation in `lib/` and `app/` goes through it or through a whole-formula builder from that module. Enforced by `offline/formula-escaping.mjs`, which fails closed.

**Every Airtable operation is counted** (`lib/airtableOps.js`); only one inside a `withOpsLabel` scope is attributed. An unlabeled screen has no before and after.

**EVERY ENTRY POINT OPENS A SCOPE, and a new page, Server Action export or Route Handler method that opens none is a failing check** (#224). The label is derived from the ROUTE and the export name rather than chosen — `withOpsLabel`'s own doc has the four forms — and `offline/airtable-ops.mjs` fails a mismatch, so a typo cannot become a bucket. The unit is the EXPORT, never the file.

Read `docs/notes/airtable-access.md` before changing any of the three.

## Concurrency: withKeyLock()

`withKeyLock()` serializes a read-then-write within one process or invocation ONLY, so a double-submit still needs a frontend disable-on-click guard. **Two locks are never nested** — a writer needing a second one takes them in sequence, as `lib/materialsCache.js` does. Which call sites take it, and why the two material locks use different keys, are in `airtable-access.md`.

## File uploads (Vercel Blob -> Airtable)

Every user file is written to Vercel Blob first and then handed to Airtable as an attachment URL, which Airtable fetches to keep its own copy. **Airtable's copy is the copy of record.** `lib/blobIngest.js:confirmIngestThenDelete` owns the sequence.

- **Airtable's own attachment URLs die at a wall-clock instant, so nothing durable may store one and NO SCREEN RENDERS ONE (#331)** — a file is served by `/api/files`, which re-reads per request. **Re-submitting one as an attachment is data loss.**
- **One size ceiling for every user upload, minted into the token and never compared after the bytes land** (#146) — a refusal that measures late leaves an object to clean up, and a multipart request is refused outright because the signed ceiling does not bind one.
- **Every attachment url is on our own Blob store (#438).** An action handed a caller's url refuses any other before its first write; the writer throws as the backstop. Held by `offline/file-source.mjs`.

Read `docs/notes/uploads-and-drafts.md` before changing an upload path or `persistPRFromForm` — it holds the ingest sequence, the confirmation signal, the poll figures and the writer counts.

## Auth (lib/auth.js, lib/session.js, lib/email.js, lib/authz.js)

- Magic link only, restricted to the company email domain. `requestMagicLink()` domain-checks then emails a link; `consumeAuthToken` spends the token under `withKeyLock`. New signups always land as plain Employee (`Is Admin: false`) and **with no name** — `requireUser()` sends a nameless reader to `/login/name` (#381); promotion is a manual Airtable edit.
- **The POST refuses a cross-origin submission** — `Origin` against `Host`, and absence fails open.
- `lib/session.js`: iron-session, payload `{ userId }`. `getCurrentUser()` treats a missing Users record as logged-out and re-throws real Airtable errors. `getActiveUser()` also treats `Status: Inactive` as logged-out.
- Env vars: `SESSION_SECRET`, `RESEND_API_KEY`, `ALLOWED_EMAIL_DOMAIN`, `EMAIL_FROM` (optional). Fail-fast at module load; set in Vercel too.
- **There is no user-creation screen.** A Users record appears as a side effect of a first magic-link sign-in and in no other way. `lib/airtable/users.js:addAssignedJob` is the only writer of `Assigned Jobs` and is additive.
- The product is named in one place, `lib/productName.js`. `offline/product-name.mjs` fails on any superseded name under `app/` or `lib/`, and on `PRODUCT_NAME`'s value appearing as a literal outside its own module.

## Route protection (lib/authz.js)

**Operating convention:** office staff run with `Is Admin: true`; a non-Admin Employee is site staff. Gating an endpoint to Admin scopes it to the office, not to a higher trust tier.

- `requireUser()` / `requireAdmin()` are for Server Components and Actions; both redirect to `/login` with no session, and `requireAdmin` returns `{ authorized: false }` for the caller to render. **`requireRole` and `requirePresident` are internal to `lib/authz.js` (#182)** — a President gate is `withPresidentAction`. Route Handlers cannot use these — they call `getActiveUser()` or `requireAdminApi()`, which return the user or a 401/403 `Response`.
- **A SIGNED-OUT READER RETURNS TO WHERE THEY WERE (#373).** `requireUser()` carries the address into `/login`, and the sign-in flow hands it back. `proxy.js` stamps that address and **gates nothing** — authorization stays in the page.
- **Gate a new endpoint with a wrapper**, not a bare call: `withAdminApi`, `withAdminAction`, `withPresidentAction`. A wrapped export cannot run its body unauthorized, because the body is an argument the wrapper decides whether to call.
- **A `withAdminAction` refusal follows the call site (#185):** an action whose every call site BINDS the return returns `{ error }`, and one any call site invokes without binding throws — `useActionState` and an awaited call observe a return, a bare `<form action>` discards it. It is a conjunction, so a non-binding caller is the thing to change. Held by `offline/action-refusal-shape.mjs`.
- **A REFUSAL ABOUT THE PAGE BEING OUT OF DATE REFRESHES AS IT REFUSES (#378).** An action that only returns re-renders nothing, so the sentence is the one true line on a screen contradicting it; `refresh()` carries it and a fresh render together, where `redirect()` would drop it. Not where a re-render would cost the reader typed input.
- **A READ STATE IS NEVER REPLACED BY THE CONTROL THAT EDITS IT (#318).** A control may be absent for a reader who may not act, or closed for one who may; the fact it edits is stated either way and never twice.
- **Caller obligation for the flag helpers:** `requireAdmin()` only *reports* the decision. A caller that does not act on `{ authorized }` protects nothing.
- **Re-authorization rule:** every directly-callable endpoint re-authorizes to the level of the strictest page that renders its UI. A page being the only caller is not a substitute — Route Handlers and Server Actions are reachable directly.
- Any route or action that fetches a caller-supplied URL, or hands one to Airtable, restricts it to our own Blob store, independent of auth.
- **Role-scoped:** `app/admin/**` and the invoice write paths (`/invoices/new`, `/invoices/[invoiceId]/edit`, and the edit, delete and payment actions) are Admin-only.
- **Row-scoped, not role-scoped:** `/prs`, `/prs/[prId]`, `/pos`, `/pos/[poId]`, `/invoices`, `/invoices/[invoiceId]`. All need only an active session to reach, then decide per record through `canViewPR` — for the invoice routes via `lib/invoiceVisibility.js`, which owns the walk and no predicate of its own. **A refusal renders the ordinary not-found text**, a write's too: never confirm that a record exists outside someone's scope.
- **Enforced by `offline/authz-structure.mjs`**, which enumerates every `app/api/**/route.js` and every `"use server"` export and requires each to be wrapped or listed as an exemption with a reason. A stale exemption fails. An exemption's per-record comparison is held by `offline/owner-before-write.mjs` wherever a request is read by id (#440).

- **A NEW SURFACE THAT SHOWS A PR, A PO OR AN INVOICE GATES PER RECORD, NOT PER ROLE**, and it does so by calling `canViewPR` — never by writing its own comparison. This is the rule most easily missed, because adding a route touches no file under `lib/authz*.js` and nothing fails when it is skipped: the page simply shows everyone everything.

Read `docs/notes/authorization.md` before adding an endpoint, an exemption or a visibility clause.

## Utility scripts (scripts/)

- `npm test` runs the whole offline tier and CI runs it on every push; `npx eslint .` is a second CI job and stays clean, a rule this repo deliberately breaks taking a scoped disable with its reason rather than a tolerated error (#187). **It resolves names under `scripts/` since #426** — `no-undef` and, since #427, `no-unused-vars`, against Node's globals alone, since flat config MERGES globals and the wide set would leave a rule reporting 0 while blind. **An unread binding may still be load-bearing**, so read one before deleting it.
- **Do not run a `verify-*.mjs` casually** — one run costs hundreds of Airtable operations.
- **Dummy records already in the base are deliberate, not leftovers.** Nothing in this base is to be removed as tidying-up.
- **What a green CI run does NOT mean:** that authorization is enforced, or that anything rendered. Source shape is not execution — a gate inside `if (false)` satisfies a structural check — and this tier never opens a page, so a column that does not appear, a width that wraps and a field that reaches the browser are all invisible to it. Those are checked in a browser with the two fixture accounts and the finding written into the PR. Green means nothing cheap regressed.

Read `docs/notes/verification.md` before adding a check, a script or a seed — it holds the directory map, the tier boundary and where a new check goes, the exit codes, the fixture-cleanup contract and its run tag, the two permanent fixture accounts, the anti-vacuity rule, and why an Airtable formula or rollup is outside CI entirely.

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
