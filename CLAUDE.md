# Material PO Automation — Project Context

This file is read automatically by Claude Code at the start of every session. It captures decisions made during an extensive design conversation with Claude (chat) before any code was written — context that won't be obvious from the code alone, especially the *reasons* behind non-obvious choices.

**If the Airtable MCP connector is available in this environment, prefer querying the live base schema over trusting this document for exact field IDs/types — this file can drift out of date as the schema evolves, but the design rationale below stays valid.**

---

## What this project is

Replacing an entirely email-and-Excel-based Purchase Request → Purchase Order → Invoice workflow at a construction company (Hanyang ENG) with a web app. Site and office staff currently email PDF/Excel purchase requests around for sequential sign-off, then office manually re-types everything into a PO. This app owns that whole lifecycle instead.

## Architecture

- **Frontend + backend**: Next.js (App Router, JavaScript not TypeScript, Tailwind CSS), deployed on Vercel.
- **Database**: Airtable (base ID in `.env.local` as `AIRTABLE_BASE_ID`, base name "Material Purchases"). Not a traditional DB — chosen because the team already works in Airtable for reference data, and volume is low (dozens–low hundreds of records/month).
- **Critical architecture rule**: Airtable is the data store ONLY. All business logic — ID generation, signing-chain rules, PDF generation, notifications, variance checks — lives in the Next.js backend (API routes), never in Airtable automations/formulas. Airtable formulas are only used for things that are genuinely just data transformations (e.g. `PR Items.Amount = Qty × Rate`, address formatting), never for workflow logic.
- **Auth**: email/password or magic-link, restricted to company email domain with verification. New signups always land as plain Employee (`Role: Employee`, `Is Admin: false`) — promotion to Admin or President is a manual Airtable edit, not self-service.
- No prior user accounts existed anywhere in the company's tooling before this project — this is the first auth system for this team.

## Service layer pattern (established, follow this for new tables)

- `lib/airtable/client.js` — single shared Airtable connection + `TABLES` name constants. Import from here, never create a second connection.
- `lib/airtable/{table}.js` — one file per table (e.g. `users.js`, `jobs.js`), exporting plain async functions. Only build the file for a table when the current phase actually needs it — don't pre-build all 12.
- `lib/ids.js` — all auto-generated ID logic (see ID rules below). Centralized because every phase depends on it.
- Airtable API key is server-side only (`AIRTABLE_API_KEY` in `.env.local`, never exposed to the client bundle).

---

## The full data model (15 tables) — current state as of this writing

### Users
User Name (primary), Email, Phone, Role (`Employee`/`President`), Is Admin (checkbox, independent of Role), Status (`Active`/`Inactive`), Created At. Plus several auto-generated reverse-link fields from other tables (all renamed to be unambiguous, e.g. `Jobs (as PIC)` vs `Jobs (as Manager)`, `Purchase Orders (as PIC)` vs `Purchase Orders (as Manager)`, `Correction Requests (Initiated)` vs `Correction Requests (Sent To)`).

### Jobs
Job Code (primary), Job Name, Business Unit (select: EPC/HT/SYS), Line (text — renamed from "Subcategory"), PIC (link → Users) + PIC Phone/Email (Lookups via PIC, not re-typed), Manager (link → Users) + Manager Phone/Email (Lookups), Delivery Address (link → Addresses, single-record), Alternate Delivery Address (link → Addresses, single-record).

### Vendors
Vendor Name (primary), PIC Name/Phone/Email (plain text — **external contact, deliberately NOT linked to Users**, unlike Jobs' PIC/Manager who are internal staff), Address (link → Addresses, single-record), Purchase Orders (Lookup, chained Vendor→PR→PO — shows which POs used this vendor without duplicating data).

### Purchase Requests (PR)
PR ID (plain text, **backend-generated**, format `HYE-PR-YYMMDD-##` resetting daily — see ID rules), Requester (link → Users, single), Job (link → Jobs, single), Vendor (link → Vendors, single), Created Date, Status (select: `Draft`/`In Review`/`Approved`/`Converted to PO` — **no "Rejected" status**, rejection essentially never happens in this workflow), Current Signer Step (number), Total Amount (rollup, sum of PR Items.Amount), Notes, Quotation File (Lookup, chained through the linked Quotations record's File attachment).

### PR Signers — the dynamic ordered approval chain
**This is the most important non-obvious design in the whole system.** One row per signer per PR. PR Signer ID (plain text, backend-generated, format `{PR ID}-{seq}` resetting per PR, e.g. `HYE-PR-260710-01-001`), PR (link, single), Signer (link → Users, single), Sequence Order (number — **assigned by the requester at PR creation time, not a fixed role-based panel**), Status (select: `Pending`/`Approved`/`Edited`/`Returned` — no Rejected), Signed At, Notes.

Key business rules for this table:
- Signers are NOT a fixed "3 responsibilities + 1 head" panel. The requester picks an arbitrary ordered list of people (mixing site and office staff in any order) when creating the PR.
- Each signer, at their turn, has three possible actions: **Approve as-is**, **Edit and continue** (fix a value themselves, pass forward), or **Return for correction** (send back to ANY earlier signer, including the requester or themselves — chain pauses, then resumes from where it paused once fixed, does NOT restart from the beginning).
- **Editing a value after someone has signed does NOT invalidate their earlier approval.** This is deliberate — in practice, correcting a typo'd qty/price mid-chain is common and rejection/re-approval essentially never happens. The evidence model is "log every change with full history," not "lock and force re-signing." Every edit and every correction-request gets logged (see Edit Log / Correction Requests below) — that history *is* the integrity guarantee, not a frozen record.
- Once a signer's turn has fully passed (the next signer has acted), that earlier signer can no longer edit — but their approval still stands even if later values change under them.

### PR Items
PR Item ID (plain text, backend-generated, `{PR ID}-{seq}` per PR), PR (link, single), Item Name, Size, Unit, Qty, Rate, **Amount = live Airtable formula `Qty × Rate`** (deliberately live/editable — this table is meant to stay editable pre-PO), Remark.

### Correction Requests
Logs the "return to an earlier signer" action specifically. Correction Request ID (plain text, backend-generated, `{PR ID}-{seq}`), PR (link, single), Initiated By (link → Users, single), Sent To (link → Users, single — any earlier signer, requester, or self), Notes, Requested At, Resolved At, Status (`Pending`/`Resolved`).

### Edit Log
Field-level change history — the general evidence trail (separate from Correction Requests, which is specifically about the return-for-correction action). Edit Log ID (plain text, backend-generated, `{PR ID}-{seq}`), PR (link, single), Changed By (link → Users, single), Field Name (select, bounded list: Item Name/Size/Unit/Qty/Rate/Remark), Old Value, New Value, Changed At.

### Purchase Orders (PO)
Strict **1:1 with PR** (enforced single-record-link on both sides — a PR becomes exactly one PO, matching how office currently builds POs by copying PR contents). PO ID (plain text, backend-generated, `HYE-PO-YYMMDD-##` resetting daily), PR (link, single), Vendor (**Lookup via PR**, not a duplicate link — same vendor data, one source of truth), Quotation File (Lookup, chained PO→PR→Quotations→File — two-hop chain), Our PIC (link → Users, single), Our Manager (link → Users, single), Created Date, President Signed (checkbox) + President Signed At, Status (`Draft`/`Signed`/`Sent to Vendor`), PO PDF File (attachment — **the one place in this whole system that still produces a real output file**, since it's sent to an external vendor), Total Amount (rollup), Delivery Address Used (select: `Primary`/`Alternate`).

### PO Items
Deliberately a **frozen snapshot**, copied from PR Items at the moment the PO is generated — NOT a live formula or lookup. PO Item ID (plain text, backend-generated, `{PO ID}-{seq}` per PO), PO (link, single), Item Name, Size, Unit, Qty, Rate, **Amount = static currency value written once by the backend, NOT a formula** (this is intentional: PO Items must never silently change after a PO has been issued to a vendor, even if something upstream in PR Items changes later), Remark.

### Quotations
Quotation ID (primary, plain text, **backend-generated** — treated as a 6th child-ID pattern: `{PR ID}-Q{seq}`, see "internal ID vs. vendor-issued code" below), Vendor Quotation Code (plain text, **human-entered** — the vendor's own quotation number as printed on their document, e.g. "Qte1763957"), Vendor (link, single), PR (link, single), File (attachment). Files stored as attachments only — **not auto-parsed**. Quotations are unfixed-form documents (vary per vendor) and automated extraction was deliberately scoped OUT as a much harder future-phase problem, unlike the PR itself which the app now creates natively (no PDF-reading involved for PRs at all, since the whole point was to stop relying on parsing external documents).

### Invoices / Invoice–PO Link / Invoice Items — built, Phase 3 logic not yet implemented
Invoice ID (primary, plain text, **backend-generated** — **a top-level document ID, same tier as PR ID/PO ID, NOT a child ID**. This is a deliberate correction from an earlier draft of this doc: an Invoice is not a child of any single PO, since Invoice↔PO is many-to-many — it needs its own independent daily-reset counter, exactly like PR/PO, rather than a `{Parent ID}-{seq}` pattern that assumes one parent. Format `HYE-INV-YYMMDD-##`, generated by `generateNextInvoiceId()` in `lib/ids.js`, already manually implemented — check it matches this shape rather than writing a new one), Vendor Invoice Code (plain text, **human-entered** — the vendor's own invoice number, same reasoning as Vendor Quotation Code below), Vendor (link, single), Issue Date, Due Date, Amount Due, Shipping Fee, Paid (checkbox) + Paid Date — payment tracking deliberately lean, since actual payment happens on an external site outside this app's scope.

Invoice ↔ PO is **many-to-many** via the `Invoice–PO Link` join table (primary field is a plain autoNumber — this table is pure relationship, never independently browsed or referenced by ID, so no readable label was needed here, unlike every other primary field in this base). Both `Invoice` and `PO` link fields on the join table are correctly single-record — the many-to-many is achieved through multiple join rows, not multi-select link fields. The common case is one PO having several invoices (partial shipments); one invoice spanning several POs is a real, supported edge case — and this many-to-many-ness is exactly why Invoice ID can't be a child ID of PO.

**Invoice Items**: Invoice Item ID (plain text, backend-generated, `{Invoice ID}-{seq}` per invoice — **this one IS a true child ID**, since each line item belongs to exactly one Invoice, unlike the Invoice itself relative to PO), Invoice (link, single) + PO (link, single — **critical**: each line item reconciles against exactly one PO, which is what makes line-level matching on a multi-PO invoice possible), Item Name, Qty, Unit Price, Amount (live formula `Qty × Unit Price`), Variance Flag (checkbox — deliberately **not** a formula; this gets set by backend reconciliation logic, not auto-computed in Airtable, consistent with the "logic lives in backend" rule).

### Internal ID vs. vendor-issued code — applies to Quotations and Invoices
Both Quotations and Invoices reference a real-world document issued by a vendor, not by us — so a single ID field can't do both jobs (guaranteed-unique internal identifier AND faithfully representing what the vendor actually printed). Two vendors can easily reuse the same number by coincidence (e.g. both happen to send "Invoice #1001"), so the vendor's own number is **never guaranteed unique on its own** — only the combination of (Vendor, vendor-issued code) is a real key. Resolution: split into two fields per document type —
- `Quotation ID` (child ID, `{PR ID}-Q{seq}`) / `Invoice ID` (**top-level ID**, `HYE-INV-YYMMDD-##` — see correction above, these two are NOT the same shape despite both being "internal IDs for vendor documents").
- `Vendor Quotation Code` / `Vendor Invoice Code`: human-entered, purely informational, mirrors what's on the vendor's actual document. **Never look up or match by this field alone — always scope by Vendor too**, the same rule as the Materials table's natural key (Item + Size + Unit + **Vendor**).

### Addresses
Structured reference table (Address Label primary — human-picked, NOT an auto-generated ID, since this table is a reference table like Vendors/Jobs where readability matters for the link-picker UI). Line 1, Line 2, City, State, Zip Code, Country, Formatted Address (formula). Linked from Jobs (Delivery Address, Alternate Delivery Address) and Vendors (Address), all single-record-link enforced.

### Materials — built, Phase 4 upsert logic not yet implemented
Item Name, Size, Unit, Vendor (link, single) — natural key is the combination of all four, not Item/Size/Unit alone. Unit Price, Latest Job (link, single), Latest Date, Latest PO (link, single). This is a latest-known-price cache, upserted by backend as PRs get signed. **Not** the source of price history — that lives in the dated PR Items records. The cache is just a fast "what's the current price" lookup; historical trend queries hit PR Items directly. (No separate `Currency` field — all vendors are US-based, USD assumed throughout.)

---

## ID generation rules (see `lib/ids.js`)

Three shapes, and the reasoning matters:
1. **Top-level document IDs — PR ID / PO ID / Invoice ID**: `HYE-PR-YYMMDD-##` / `HYE-PO-YYMMDD-##` / `HYE-INV-YYMMDD-##`, each resets daily on its own independent counter. Must be backend-generated (Airtable formulas can't count "how many created today," only "my row's position in the whole table ever") — these fields are plain text, not formulas, specifically so the backend can write real values into them. **Invoice ID belongs in this tier, not the child-ID tier below** — even though an Invoice is conceptually "related to" a PO, Invoice↔PO is many-to-many, so an Invoice can't be numbered as if it belongs to exactly one parent. This was corrected from an earlier draft of this doc that mistakenly treated Invoice ID as a 7th child ID.
2. **Child-table IDs** (PR Item, PR Signer, Correction Request, Edit Log, PO Item, Quotation, **Invoice Item**): `{Parent ID}-{seq}`, resets **per parent**, also backend-generated for the same reason. These were originally built as Airtable formulas concatenating things like Item Name (broke — Airtable's `-` operator is subtraction, not concatenation, and long item names were also a real risk) — moved to backend generation once true per-parent-reset numbering was wanted, which Airtable's Autonumber field (table-wide only) can't do. Quotation ID exists alongside a separate human-entered `Vendor Quotation Code` field — see the "internal ID vs. vendor-issued code" note above. Invoice Item ID is a true child of Invoice (not of PO), even though each Invoice Item also links to a PO for reconciliation purposes.
3. **Vendor-issued codes** (`Vendor Quotation Code`, `Vendor Invoice Code`): human-entered, not backend-generated at all, and not guaranteed unique — see the dedicated note above.

**Naming convention**: fields that are guaranteed-unique auto-generated identifiers are named `X ID`. Fields that are human-typed descriptive text for picking from a list (like `Address Label`, `Vendor Name`, `Job Name`) are named `X Label` or just the plain name — never converted to auto-IDs, because readability in the link-picker UI matters more there than machine-uniqueness.

**Date/time field naming**: plain `date` fields (calendar date only, time doesn't matter — e.g. when a document was created, an invoice's issue/due date) use **`X Date`** (e.g. `Created Date`, `Issue Date`, `Due Date`, `Paid Date`, `Latest Date`). `dateTime` fields (time genuinely matters — audit trail / signing events) use **`X At`** (e.g. `Signed At`, `Requested At`, `Resolved At`, `Changed At`, `President Signed At`, `Created At`). If a new field is added later, pick based on whether the *time-of-day* is meaningful for that field, not just copy whichever pattern looks similar — that's the actual test, not the suffix itself.

---

## Link-field filtering rule

Airtable's `filterByFormula` cannot compare a link field directly to a record ID — a link field evaluates to its linked record's display text in formula context, not its record ID, so `{SomeLinkField} = "recXXXXXXXXXXXXXX"` silently matches nothing.

**For counting or listing a parent's children** (ID generation via `generateChildId`, and every `getXByParent`-style function), don't filter the child table at all — read the **parent's own reverse-link field** instead (e.g. `Purchase Orders."PO Items"`, `Purchase Requests."PR Items"`). Reverse-link fields are core link data, not computed — Airtable keeps both sides of a link in sync as part of the same write, so there's no propagation lag to race against:
- **Counting** (`generateChildId` in `lib/ids.js`): `.find(parentRecordId)` on the parent, then use `parentRecord.get(parentLinkFieldName).length` as the existing count.
- **Listing** (`getXByParent`-style functions): same `.find()` to get the exact array of child record IDs, then fetch each child directly by ID in parallel — `getLinkedRecords()` in `lib/airtable/client.js` does exactly this. A record's own directly-written fields are available immediately via `.find()`; only *computed* fields (lookups/formulas/rollups) have propagation lag.

This replaced an earlier version of this pattern that filtered the child table via a `"{Parent} Record ID"` lookup field (a `RECORD_ID()` formula on the parent, pulled through the link as a lookup on the child, e.g. `PR Items.PR Record ID`). That lookup is computed asynchronously by Airtable after a record is created, so a record created moments ago — or its siblings — could be temporarily invisible to a `filterByFormula` query on it. This caused two related, reproducible bugs: `generateChildId` undercounting and issuing duplicate IDs (PO Items, consistently, across multiple test runs), and `getItemsByPO` returning zero records immediately after rapid child creation. Both are resolved now that neither counting nor listing touches a lookup field at all — verified via `scripts/test-phase0.js` (not committed): a parent created, then 3 children created in immediate succession with no delay, repeatedly produces unique sequential IDs and complete, correct read-backs.

**The lookup-field pattern is still used in exactly one place**: `materials.js:getMaterialByKey`'s Vendor comparison (`{Vendor Record ID} = "..."`). Materials isn't a simple parent→children relationship — its natural key (Item Name + Size + Unit + **Vendor**) doesn't map to any single parent's reverse-link array, so there's no equivalent "read the parent, get the exact record" shortcut available. Verified this is safe for back-to-back sequential calls (even with zero delay between them, via `scripts/test-verify.js`, not committed) — the async-lookup-lag risk described above does not apply here in practice. **Correction to an earlier version of this note**: the real residual risk here isn't lookup lag at all — see the concurrent-write race below, which affects `upsertMaterial` too.

This isn't just about ID generation — the reverse-link-first approach applies to any table that keeps growing and needs to look up rows by a parent/related link. Plain fields in a natural key (Item Name, Size, Unit on Materials) still filter normally via `filterByFormula`; only link-field components need this special handling.

**Concurrent-write race (not a lookup-lag issue) — fixed within a process, known residual risk across processes**: `generateChildId` and `upsertMaterial` both follow a "read current state, then write based on it" pattern. This is safe for sequential calls (even rapid, back-to-back, no delay) since each write completes before the next read starts. It was **not** safe for genuinely concurrent calls targeting the same parent/key (e.g. `Promise.all([...])`) — confirmed via `scripts/test-verify.js`: `generateChildId` under `Promise.all` (5 PR Items created concurrently for one PR) had **all 5 get the identical ID**; `upsertMaterial` under `Promise.all` (3 concurrent upserts, same natural key) **created 3 separate duplicate records** instead of 1.

Fixed with `withKeyLock()` (`lib/airtable/client.js`, no external dependency — a per-key promise chain: each call for a key waits for the previous call sharing that key to settle before running). `generateChildId` was restructured to take a `createFn(childId)` callback so the entire "count via parent reverse-link -> create the record with that ID" sequence runs inside one lock, keyed on `{parentTableName}:{parentRecordId}:{parentLinkFieldName}` — locking only the count step would still race, since a third caller could read a stale count in the gap between a second caller's count finishing and its `.create()` landing. `upsertMaterial` wraps its whole read-then-write body the same way, keyed on the normalized natural key (`LOWER(TRIM(...))` on Item Name/Size/Unit + Vendor record ID, matching `getMaterialByKey`'s comparison). Re-verified with the same `Promise.all` scenarios above: both now produce unique sequential IDs / a single upserted record every time.

**`withKeyLock` error handling and cleanup, verified** (`scripts/test-lock.js`, not committed): if a queued call's `fn()` rejects, the rejection propagates correctly to that call's own caller, the lock still releases, and the next queued call runs unaffected — checked both as a pure unit test and via `generateChildId` with a deliberately-throwing `createFn` wedged between two real creates on the same PR (the failure didn't consume a sequence number; the next real create still got the correct next ID). `keyQueues`'s entry for a key is removed once that key's whole chain drains, in both cases — no unbounded growth on a long-lived warm instance.

**Known residual risk — two distinct cases, not one**:
1. **Different requests, same key, genuinely concurrent** (e.g. two different signers' actions somehow touching the same PR/PO/material key at once): `withKeyLock` only serializes within a single process/function invocation, not across separate serverless invocations, so this could still race. Judged low-probability here specifically because the signing-chain design (`Current Signer Step`) already serializes *who* can act on a PR to one signer at a time — this reasoning does NOT extend to case 2 below.
2. **Same user, accidental double-submit** (double-click / double-tap on a submit button): a completely different mechanism — one user's browser firing two near-simultaneous requests for what they intend as one action. This is **not** low-probability in general (a routine, well-known web-form hazard, more likely on slow connections or unresponsive-feeling UI) and the backend lock is unlikely to help at all, since two genuinely concurrent requests are exactly the case a serverless platform tends to route to two separate instances rather than reusing one warm instance. **Needs frontend-side handling** (disable the submit button / set an `isSubmitting` guard immediately on click, before the request resolves) once the PR/PO forms are built in Phase 1/2 — not implemented yet since no frontend exists in this codebase yet. Track as a form-building checklist item, not a backend concern.

---

## Git workflow rules

- Never commit directly to `main`. One branch per issue: `{issue#}-{short-desc}` (e.g. `12-signer-chain-state-machine`).
- Commit format: `{type}: {description} (#{issue#})` — types: `feat`/`fix`/`chore`/`refactor`.
- Every PR description must include `Closes #{issue#}` so merging auto-closes the issue and updates its Milestone (Phase) progress automatically.
- GitHub Milestones = Phases (0–5), Issues = individual tasks within a phase, assigned to the matching Milestone.
- Work stays scoped to the issue's Milestone (Phase) — don't start Phase 2 work while Phase 1 issues are still open, unless explicitly told to.
- Don't open a PR unless explicitly asked to — sometimes the request is just "implement this and push to the current branch," with the PR to be opened manually later.
- **Never run `git commit` (or `git add`/`git commit`) directly — this applies even when explicitly asked to "finish" a task.** Instead, once a chunk of work is done, leave the working tree as-is and output the commit message as a copy-pasteable block:

  ```
  {type}: {short summary} (#{issue#})

  {body — bullet points on what changed and why, if non-trivial}
  ```

  The user reviews the diff and commits manually in the terminal themselves.

---

## Build phases (see full plan in `PO_Automation_Build_Plan.md` if present in this repo)

0. Foundations — Next.js scaffold, Airtable service layer, auth, ID generation (in progress now)
1. PR creation + dynamic signing chain — the real first milestone, replaces the email loop entirely
2. PO generation — mostly plumbing given how much design already happened in Airtable
3. Invoice handling — many-to-many reconciliation, variance checking (tolerance rule still undecided)
4. Materials price history + reporting
5. Explicitly deferred: automated quotation/invoice parsing, real payment integration, formal rejection flow beyond correction/return, multi-PIC vendor contacts, backup president approver

## Known open decisions (won't block Phase 0/1, will block later phases)

- Variance tolerance rule for invoice-vs-PO reconciliation (exact match vs. % tolerance) — blocks Phase 3
- Notification channel is assumed to be email but not yet built — blocks Phase 1 completion