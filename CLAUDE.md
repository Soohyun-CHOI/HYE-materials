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

## The full data model (12 tables) — current state as of this writing

### Users
User Name (primary), Email, Phone, Role (`Employee`/`President`), Is Admin (checkbox, independent of Role), Status (`Active`/`Inactive`), Created At. Plus several auto-generated reverse-link fields from other tables (all renamed to be unambiguous, e.g. `Jobs (as PIC)` vs `Jobs (as Manager)`, `Purchase Orders (as PIC)` vs `Purchase Orders (as Manager)`, `Correction Requests (Initiated)` vs `Correction Requests (Sent To)`).

### Jobs
Job Code (primary), Job Name, Business Unit (select: EPC/HT/SYS), Line (text — renamed from "Subcategory"), PIC (link → Users) + PIC Phone/Email (Lookups via PIC, not re-typed), Manager (link → Users) + Manager Phone/Email (Lookups), Delivery Address (link → Addresses, single-record), Alternate Delivery Address (link → Addresses, single-record).

### Vendors
Vendor Name (primary), PIC Name/Phone/Email (plain text — **external contact, deliberately NOT linked to Users**, unlike Jobs' PIC/Manager who are internal staff), Address (link → Addresses, single-record), Purchase Orders (Lookup, chained Vendor→PR→PO — shows which POs used this vendor without duplicating data).

### Purchase Requests (PR)
PR ID (plain text, **backend-generated**, format `HYE-YYYYMMDD-####` resetting daily — see ID rules), Requester (link → Users, single), Job (link → Jobs, single), Vendor (link → Vendors, single), Date Created, Status (select: `Draft`/`In Review`/`Approved`/`Converted to PO` — **no "Rejected" status**, rejection essentially never happens in this workflow), Current Signer Step (number), Total Amount (rollup, sum of PR Items.Amount), Notes, Quotation File (Lookup, chained through the linked Quotations record's File attachment).

### PR Signers — the dynamic ordered approval chain
**This is the most important non-obvious design in the whole system.** One row per signer per PR. PR Signer ID (plain text, backend-generated, format `{PR ID}-{seq}` resetting per PR, e.g. `HYE-20260710-0007-001`), PR (link, single), Signer (link → Users, single), Sequence Order (number — **assigned by the requester at PR creation time, not a fixed role-based panel**), Status (select: `Pending`/`Approved`/`Edited`/`Returned` — no Rejected), Signed At, Notes.

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
Strict **1:1 with PR** (enforced single-record-link on both sides — a PR becomes exactly one PO, matching how office currently builds POs by copying PR contents). PO ID (plain text, backend-generated, `HYE-PO-YYYYMMDD-##` resetting daily), PR (link, single), Vendor (**Lookup via PR**, not a duplicate link — same vendor data, one source of truth), Quotation File (Lookup, chained PO→PR→Quotations→File — two-hop chain), Our PIC (link → Users, single), Our Manager (link → Users, single), Created Date, President Signed (checkbox) + President Signed At, Status (`Draft`/`Signed`/`Sent to Vendor`), PO PDF File (attachment — **the one place in this whole system that still produces a real output file**, since it's sent to an external vendor), Total Amount (rollup), Delivery Address Used (select: `Primary`/`Alternate`).

### PO Items
Deliberately a **frozen snapshot**, copied from PR Items at the moment the PO is generated — NOT a live formula or lookup. PO Item ID (plain text, backend-generated, `{PO ID}-{seq}` per PO), PO (link, single), Item Name, Size, Unit, Qty, Rate, **Amount = static currency value written once by the backend, NOT a formula** (this is intentional: PO Items must never silently change after a PO has been issued to a vendor, even if something upstream in PR Items changes later), Remark.

### Quotations
Quotation ID (primary, plain text), Vendor (link, single), PR (link, single), File (attachment). Stored as attachments only — **not auto-parsed**. Quotations are unfixed-form documents (vary per vendor) and automated extraction was deliberately scoped OUT as a much harder future-phase problem, unlike the PR itself which the app now creates natively (no PDF-reading involved for PRs at all, since the whole point was to stop relying on parsing external documents).

### Invoices / Invoice–PO Link / Invoice Items — *not yet built in Airtable, planned for Phase 3*
Design already decided: Invoice ↔ PO is **many-to-many** via a join table (`Invoice–PO Link`) — the common case is one PO having several invoices (partial shipments), but one invoice spanning several POs is a real, supported edge case, not rare enough to ignore. Each **Invoice Item line** (not just the invoice header) carries its own PO reference, so a multi-PO invoice can be reconciled line-by-line against the correct PO. Payment tracking is deliberately lean — just a `Paid` checkbox + date on Invoice, since actual payment happens on an external site outside this app's scope.

### Addresses
Structured reference table (Address Label primary — human-picked, NOT an auto-generated ID, since this table is a reference table like Vendors/Jobs where readability matters for the link-picker UI). Line 1, Line 2, City, State, Zip Code, Country, Formatted Address (formula). Linked from Jobs (Delivery Address, Alternate Delivery Address) and Vendors (Address), all single-record-link enforced.

### Materials — *not yet built, planned for Phase 4*
Latest-known-price cache (item + size + unit + vendor as natural key, upserted by backend). **Not** the source of price history — that lives in the dated PR Items records. The cache is just a fast "what's the current price" lookup; historical trend queries hit PR Items directly.

---

## ID generation rules (see `lib/ids.js`)

Two shapes, and the reasoning matters:
1. **PR ID / PO ID**: `HYE-YYYYMMDD-####` / `HYE-PO-YYYYMMDD-##`, resets daily. Must be backend-generated (Airtable formulas can't count "how many created today," only "my row's position in the whole table ever") — these fields are plain text, not formulas, specifically so the backend can write real values into them.
2. **Child-table IDs** (PR Item, PR Signer, Correction Request, Edit Log, PO Item): `{Parent ID}-{seq}`, resets **per parent**, also backend-generated for the same reason. These were originally built as Airtable formulas concatenating things like Item Name (broke — Airtable's `-` operator is subtraction, not concatenation, and long item names were also a real risk) — moved to backend generation once true per-parent-reset numbering was wanted, which Airtable's Autonumber field (table-wide only) can't do.

**Naming convention**: fields that are guaranteed-unique auto-generated identifiers are named `X ID`. Fields that are human-typed descriptive text for picking from a list (like `Address Label`, `Vendor Name`, `Job Name`) are named `X Label` or just the plain name — never converted to auto-IDs, because readability in the link-picker UI matters more there than machine-uniqueness.

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

---

## Git workflow rules

- Never commit directly to main. One branch per issue: `{issue#}-{short-desc}`.
- Commit format: `{type}: {description} (#{issue#})` — types: feat/fix/chore/refactor.
- Every PR description must include `Closes #{issue#}` so merging auto-closes
  the issue and updates its Milestone progress.
- Work stays scoped to the issue's Milestone (Phase) — don't start Phase 2
  work while Phase 1 issues are still open, unless explicitly told to.