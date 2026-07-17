# Material PO Automation — Project Context

Read automatically by Claude Code at the start of every session.

**If the Airtable MCP connector is available, prefer querying the live base schema over trusting this document for exact field types — this file can drift, but the rules below stay authoritative.**

---

## What this project is

Replacing an email-and-Excel-based Purchase Request -> Purchase Order -> Invoice workflow (Hanyang ENG, a construction company) with a web app owning the full lifecycle.

## Architecture

- Next.js (App Router, JavaScript, Tailwind), deployed on Vercel.
- Airtable as data store only (base: "Material Purchases"). All business logic lives in the backend. Airtable formulas only for pure data transforms, never workflow logic.
- Auth: magic link only, restricted to company email domain, verified. New signups always land as plain Employee (Is Admin: false) — promotion is a manual Airtable edit.

## Service layer pattern

- lib/airtable/client.js — shared connection, TABLES constants, getLinkedRecords(), withKeyLock().
- lib/airtable/{table}.js — one file per table, plain async functions. Build only what the current phase needs.
- lib/ids.js — all ID generation.
- AIRTABLE_API_KEY server-side only, never in the client bundle.

---

## Data model (19 tables)

**Users**: User Name (primary), Email, Phone, Role (Employee/President), Is Admin, Status (Active/Inactive), Created At, Assigned Jobs (link -> Jobs, multiple, optional — convenience default, never access control).

**Jobs**: Job Code (primary), Job Name, Business Unit, PIC/Manager (link -> Users) + Phone/Email (Lookups), Delivery/Alternate Address (link -> Addresses, single), Lines/Users (reverse-links).

**Lines**: child of Jobs. Line Label (primary, formula = {Job} - {Line Name}), Line Name (human-entered), Job (link, single).

**Vendors**: Vendor Name (primary), PIC Name/Phone/Email (plain text, external), Address (link, single), Purchase Orders (Lookup via PR chain).

**Purchase Requests**: PR ID (HYE-PR-YYMMDD-##), Requester/Vendor (links, single), Line (link, single), Job (Lookup via Line, read-only), Created Date, Status (Draft/In Review/Approved/PO Signed — no Rejected; PO Signed fires when the President signs the generated PO), Current Signer Step, Items Subtotal (rollup of PR Items only — renamed from "Total Amount" in #78), Shipping Fee (optional currency — issue #69, entered by the Requester when known; fixed once set, changeable only via Edit and continue), Total Amount (formula = Items Subtotal + Shipping Fee, blank treated as 0 — renamed from "Grand Total" in #78; this is the PR's true final figure), Notes, Quotation Files (Lookup, plural — a PR can have more than one Quotation).

**PR Signers** — dynamic ordered approval chain:
- Requester assigns an arbitrary ordered list of signers at PR creation, each tagged Confirmation Type (Approval/Agreement) — label only; the confirm-and-advance action is identical, it only changes what the signing UI/history log call it.
- Each turn: Approve/Agree (per tag), Edit and continue, or Return for correction (to any earlier signer/requester/self — pauses and resumes, never restarts). Edit and continue / Return keep their own labels regardless of Confirmation Type.
- Editing after signing does NOT invalidate approval.
- Fields: PR Signer ID, PR/Signer (link, single), Sequence Order, Status (Pending/Approved/Edited/Returned), Confirmation Type (Approval/Agreement), Signed At, Notes.

**PR Items**: PR Item ID, PR (link), Item Name, Size, Unit, Qty, Unit Price (renamed from "Rate" in #78, matching Invoice Items' naming for the same concept), Amount = live formula, Remark (free text only), Quotation (link, single -> Quotations — same pattern as Invoice Items -> PO Item; auto-linked to the PR's sole Quotation when only one exists, user-picked via dropdown once 2+ exist, never silently reassigned when a new Quotation is added later).

**Correction Requests**: Correction Request ID, PR, Initiated By, Sent To, Notes, Requested At, Resolved At, Status (Pending/Resolved).

**Edit Log**: Edit Log ID, PR, Changed By, Field Name (select — item fields plus "Shipping Fee" and "Unit Price", issues #69/#78), Old Value, New Value, Changed At, Notes (optional — reason for the change; shared field, not field-specific, so older item-edit entries just leave it blank).

**Purchase Orders**: strict 1:1 with PR. PO ID (HYE-PO-YYYYMMDD-## — 4-digit year, the one exception to this project's 2-digit-year convention), PR (link), Vendor (Lookup via PR), Quotation File (Lookup), Our PIC/Manager (links), Created Date, President Signed(+At), Status (Draft/Signed/Sent to Vendor), PO PDF File, Items Subtotal (rollup of PO Items only — renamed from "Total Amount" in #78), Shipping Fee (plain currency, frozen copy of the PR's Shipping Fee at PO-generation time — issue #78, replaces the earlier "PR Shipping Fee" Lookup from #69: confirmed no live path changes PR.Shipping Fee once a PO exists, since Edit and continue requires PR.Status = In Review), Total Amount (formula = Items Subtotal + Shipping Fee, blank treated as 0 — new in #78, and what's printed as the PO PDF's TOTAL line), Delivery Address Used (Primary/Alternate — internal tracking only, never a UI choice).

**PO Items**: frozen snapshot from PR Items at PO-generation time — NOT live. PO Item ID, PO (link), Item Name, Size, Unit, Qty, Unit Price (renamed from "Rate" in #78), Amount = static value, Remark, Invoice Items (reverse-link, multiple — line-level partial invoicing is real).

**Quotations**: Quotation ID ({PR ID}-Q{seq}), Vendor Quotation Code (human-entered), Vendor/PR (links, single), File (attachment, required at creation in the app's flow — Airtable itself can't enforce this at the schema level). At least one Quotation is required per PR; a PR can have more than one over its lifetime, created via a dynamic list on the PR form (at submission or, for later ones, via Edit and continue).

**Invoices**: Invoice ID (HYE-INV-YYMMDD-##, top-level), Vendor Invoice Code (human-entered), Vendor (link), Issue/Due Date, Amount Due (labeled "Vendor's Stated Total" — compared against but never overwritten by the calculated total), Shipping Fee, Tariff (optional, toggle-revealed), Items Subtotal (rollup of Invoice Items.Amount — issue #78), Calculated Total (formula = Items Subtotal + Shipping Fee + Tariff, blank treated as 0 — issue #78; stores what the submit-time comparison against Amount Due already computed in-memory, doesn't change that comparison/warning logic), Paid(+Date), File (attachment, required).

**Invoice-PO Link**: join table for many-to-many. Primary = plain autoNumber. Both link fields single-record.

**Invoice Items**: Invoice Item ID, Invoice + PO (links, single), PO Item (link, single — the specific PO line this reconciles against), Item Name, Qty, Unit Price, Amount = live formula, Variance Flag (checkbox, backend-set), Remark (shared for Unit Price/Qty discrepancy notes).

**Addresses**: Address Label (primary, human-picked), Line 1/2, City, State, Zip, Country, Formatted Address (formula).

**Materials**: latest-price cache. Natural key = Item Name + Size + Unit + Vendor. Unit Price, Latest Line (link, single), Latest Job (Lookup via Latest Line), Latest PO, Latest Date. Not the source of price history (that's PR Items). USD only.

**Auth Tokens**: Token (primary), Email, Expires At, Used, Created At. Single-use, 15-min TTL.

---

## ID generation (lib/ids.js)

1. Top-level IDs — PR ID / PO ID / Invoice ID: independent daily-reset counters, backend-generated. PO ID uses 4-digit year; PR ID/Invoice ID use 2-digit.
2. Child-table IDs (PR Item, PR Signer, Correction Request, Edit Log, PO Item, Quotation, Invoice Item): {Parent ID}-{seq}, resets per parent.
3. Vendor-issued codes (Vendor Quotation Code, Vendor Invoice Code): human-entered, not unique alone — always scope by Vendor too.

Naming: auto-generated unique fields -> `X ID`. Human-typed picker text -> `X Label`/plain name.
Date/time naming: calendar-only -> `X Date`. Time-meaningful -> `X At`.

---

## Querying parent/child data

filterByFormula cannot match a link field against a record ID. Always read the parent's own reverse-link field via .find(parentRecordId) for counts/listing (getLinkedRecords() in client.js), never filter the child table directly. Exception: materials.js:getMaterialByKey uses a Vendor Record ID lookup field.

## Concurrency: withKeyLock()

generateChildId and upsertMaterial wrap their read-then-write sequence in withKeyLock() to prevent duplicate IDs/records under concurrent calls. Serializes only within one process/invocation, not across serverless invocations. Double-submit needs frontend disable-on-click guards, not a backend concern.

---

## Auth (lib/auth.js, lib/session.js, lib/email.js, lib/authz.js)

- Magic link only. requestMagicLink() domain-checks then emails a token; verifyMagicLink() consumes the token (withKeyLock-protected) and finds-or-creates the User.
- lib/session.js: iron-session, payload is `{ userId }`. getCurrentUser() resolves session -> User, treating a missing Users record as "not logged in" while re-throwing real Airtable errors.
- getActiveUser() (lib/authz.js) additionally treats Status: Inactive as logged-out.
- requireUser()/requireRole(role)/requireAdmin(): Server Component/Action helpers. Route Handlers use getActiveUser() directly + 401/403 JSON.
- No proxy.js/middleware — Role/Is Admin can't be cached in a cookie, so each page's own requireUser() call is the gate.
- Required env vars: SESSION_SECRET, RESEND_API_KEY, ALLOWED_EMAIL_DOMAIN, EMAIL_FROM (optional). Fail-fast at module load. Must be set in Vercel too.
- Resend account still sandbox mode (no verified sending domain) — can only deliver to the account owner's own address. Domain verification needed before real multi-user use (Resend dashboard -> Domains -> Add Domain on a subdomain -> add DNS records -> verify -> update EMAIL_FROM).
- Not built: rate-limiting on requestMagicLink.

---

## Route protection (lib/authz.js)

Reference usage: app/admin/jobs/new, app/admin/vendors/new, app/admin/lines/new — Admin-only forms, Server Action re-checks requireAdmin() independently of the page. app/pos/[poId] is President-or-Admin (Admins need it for day-to-day invoice reconciliation).

---

## Utility scripts (scripts/)

- scripts/tests/ — temporary/verification scripts, deleted from Airtable after use.
- scripts/import/ — reusable one-time backfill scripts. data/ and output/ gitignored.
- scripts/demo/ — reusable live-demo prep, kept in repo, NOT deleted from Airtable:
  - seed_demo_fixtures.mjs: creates demo Job (26-DEMO-01) + Line + Vendor + Address via real service-layer functions. Skip-if-exists.
  - make-invoice-pdf.mjs: given a PO ID, generates a matching demo invoice PDF (output/, gitignored) for demoing PDF auto-detection.
  - Demo runs from one login-capable account standing in for every Requester/Signer role; President access via temporarily flipping that account's Role in Airtable.
- lib/airtable/addresses.js has createAddress() (writer) for the demo seed script, reused from the real service layer.

---

## Git workflow rules

- Never commit directly to main. One branch per issue: {issue#}-{short-desc}. Non-issue work: plain descriptive branch name.
- Commit format: `{type}: {description} (#{issue#})` — feat/fix/chore/refactor.
- PR description must include `Closes #{issue#}`. Squash merge configured — PR description becomes the final commit body on main.
- Line-wrap: commit bodies + PR descriptions at 72 chars. Issue comments and Claude Code prompts don't need wrapping.
- Wrap literal `<tag>`-looking text in backticks in PR descriptions (GitHub's Markdown renderer can swallow content into an unclosed tag).
- If an issue's logic is already covered by another issue's work, comment explaining why first, then close — never silently close via a PR's Closes #.
- GitHub Milestones = Phases (0-5) or standalone cross-cutting milestones (e.g. "PR Stage Fixes & Enhancements", "PR Draft Support"). Stay scoped to the current issue's Milestone unless told otherwise.
- Don't open a PR unless explicitly asked to.
- Never run git commit yourself. Write the commit message to commit-msg.txt at the repo root (overwrite, gitignored); the user commits manually.
- All GitHub milestones/issues/PRs, project markdown, and web-app-facing text are in English, regardless of what language the conversation with Claude happens in.

---

## Status

**Phase 0** (Foundations), **Phase 1** (PR creation + signing chain), **Phase 2** (PO generation) — done.

**Phase 3** (Invoice handling) — in progress. Done: #14, #46, #51, #48, #57. Remaining: #15, #16, #17.

**Phase 4** (Materials price history + reporting) — not started.

**Phase 5** (AI-assisted invoice PDF line-item parsing) — separate milestone, not started. Deferred since real vendor invoice layouts vary too much for a single positional heuristic.

**PR Stage Fixes & Enhancements** (milestone, cross-cutting, alongside Phase 3) — #61, #62, #63, #66, #67, #69 done. #70 (reconsider whether Approve needs a Notes field at all) open.

**PR Draft Support** (milestone) — 3 issues created (save PR as draft; resume-prompt on re-entry; draft list page), not started.

**#78** (no milestone, cross-cutting PR/PO/Invoice naming unification) — done: Rate -> Unit Price (PR Items/PO Items), Total Amount -> Items Subtotal + new Total Amount = Items Subtotal + Shipping Fee (PR and PO), PO Shipping Fee switched from a Lookup to a plain copy frozen at PO-generation time, Invoice gained Items Subtotal + Calculated Total (additive only, Amount Due/comparison logic untouched).