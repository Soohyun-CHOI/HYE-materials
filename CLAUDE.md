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
- lib/airtable/{table}.js — one file per table, plain async functions.
- lib/ids.js — all ID generation.
- lib/units.js — CANONICAL_UNITS, single JS-side source of truth for the Unit select list.
- lib/variance.js — invoice/PO variance checks.
- AIRTABLE_API_KEY server-side only, never in the client bundle.

---

## Data model (19 tables)

**Users**: User Name (primary), Email, Phone, Role (Employee/President), Is Admin, Status (Active/Inactive), Created At, Assigned Jobs (link -> Jobs, multiple, optional).

**Jobs**: Job Code (primary), Job Name, Business Unit, PIC/Manager (link -> Users) + Phone/Email (Lookups), Delivery/Alternate Address (link -> Addresses, single), Lines/Users (reverse-links).

**Lines**: child of Jobs. Line Label (primary, formula = {Job} - {Line Name}), Line Name (human-entered), Job (link, single).

**Vendors**: Vendor Name (primary), PIC Name/Phone/Email (plain text, external), Address (link, single), Purchase Orders (Lookup via PR chain).

**Purchase Requests**: PR ID (HYE-PR-YYMMDD-##), Requester/Vendor (links, single), Line (link, single), Job (Lookup via Line, read-only), Created At (datetime, UTC — timestamped per the *At convention; migrated from date-only Created Date in #105), Status (Draft/In Review/Approved/PO Signed/Withdrawn; PO Signed fires when President signs the generated PO), Withdrawn At (datetime, UTC, *At convention — stamped only when withdrawn, #122), Current Signer Step, Items Subtotal (rollup, PR Items only), Shipping Fee (optional currency; fixed once set, changeable only via Edit and continue), Total Amount (formula = Items Subtotal + Shipping Fee, blank = 0), Notes, Quotation Files (Lookup, plural).
  - **Withdrawn (#122)** is the documented exception to the "no Rejected status" posture: it's the Requester's own *self-retraction* of a submitted PR (circumstances changed / submitted in error), NOT a signer's rejection — signers keep Return for correction. It's a state transition (not a delete — contrast Draft delete): the PR, signer chain, correction history, and Edit Log all stay on record. Requester-only, allowed **only from In Review** this pass, terminal (no revive — re-request = a new PR). The Status flip is the single lever needed (every actionable path is gated behind In Review); Pending signers / open Correction Requests / Current Signer Step are left untouched to preserve the audit trail, and the signer progress bar drops correction arcs off-In-Review so a withdrawn PR reads as ended. `getSubmittedPRs` returns Withdrawn PRs (they aren't Drafts) so they stay visible/filterable in the #119 list. Withdraw from **Approved** is deferred to a follow-up: an Approved PR already holds an auto-generated Draft PO, and `signPOAction` doesn't yet check PR status, so signing it would resurrect the PR — that PO-lifecycle guard must land with the Approved case.

**PR Signers** — dynamic ordered approval chain:
- Requester assigns an ordered signer list at creation, each tagged Confirmation Type (Approval/Agreement) — label only, same underlying action.
- Each turn: Approve/Agree, Edit and continue, or Return for correction (to any earlier signer/requester/self — pauses/resumes, never restarts; nested corrections are a LIFO stack, each resolve unwinds one level).
- Editing after signing does NOT invalidate approval.
- Fields: PR Signer ID, PR/Signer (link, single), Sequence Order, Status (Pending/Approved/Edited/Returned), Confirmation Type, Signed At, Notes (no input on plain Approve/Agree; Edit and continue/Return still collect it).
- PR detail page: linear progress bar (`lib/prSigning.js:getSignerChainProgress` + `app/prs/[prId]/SignerProgressBar.js`), current state only. Paused (passed through, pushed back by correction) shares neutral color with not-yet-reached, dashed border only. Correction Requests.Sent To stores only a user id (ambiguous if Requester = a Signer); progress bar defaults to signer interpretation — doesn't affect the actual state machine (uses Current Signer Step).

**PR Items**: PR Item ID, PR (link), Item Name, Size, Unit (single select, canonical list — see Units), Qty, Unit Price, Amount = live formula, Remark (free text only), Quotation (link, single -> Quotations — auto-linked when only one exists, dropdown once 2+, never silently reassigned).

**Correction Requests**: Correction Request ID, PR, Initiated By, Sent To, Notes, Requested At, Resolved At, Status (Pending/Resolved).

**Edit Log**: Edit Log ID, PR, Changed By, Field Name (select — item fields, Shipping Fee, Unit Price), Old Value, New Value, Changed At, Notes (optional).

**Purchase Orders**: strict 1:1 with PR. PO ID (HYE-PO-YYYYMMDD-## — 4-digit year, the one exception to the 2-digit convention), PR (link), Vendor (Lookup via PR), Quotation File (Lookup), Our PIC/Manager (links), Created Date, President Signed(+At), Status (Draft/Signed/Sent to Vendor), PO PDF File, Items Subtotal (rollup, PO Items only), Shipping Fee (plain currency, frozen copy from PR at PO-generation time), Total Amount (formula = Items Subtotal + Shipping Fee, blank = 0 — PO PDF's TOTAL line), Delivery Address Used (Primary/Alternate — internal only).

**PO Items**: frozen snapshot from PR Items at PO-generation — NOT live. PO Item ID, PO (link), Item Name, Size, Unit (single select, same list), Qty, Unit Price, Amount = static value, Remark, Invoice Items (reverse-link, multiple — partial invoicing is real). No free-text/user-facing Unit entry point; only written by lib/poGeneration.js.

**Quotations**: Quotation ID ({PR ID}-Q{seq}), Vendor Quotation Code (human-entered), Vendor/PR (links, single), File (attachment, required at creation in-app). At least one required per PR; can have more than one over its lifetime (dynamic list on PR form, or later via Edit and continue).

**Invoices**: Invoice ID (HYE-INV-YYMMDD-##), Vendor Invoice Code (human-entered), Vendor (link), Issue/Due Date, Amount Due ("Vendor's Stated Total" — never auto-overwritten by the backend, unlike Items Subtotal/Calculated Total/Variance Flag; human edits allowed and recompute variance — #117), Shipping Fee, Tariff (optional, toggle-revealed), Items Subtotal (rollup), Calculated Total (formula = Items Subtotal + Shipping Fee + Tariff, blank = 0), Variance Flag (checkbox, backend-set), Paid(+Date), File (attachment, required).

**Invoice-PO Link**: join table, many-to-many. Primary = plain autoNumber. Both link fields single-record.

**Invoice Items**: Invoice Item ID, Invoice + PO (links, single), PO Item (link, single), Item Name, Size, Unit (single select, same list), Qty, Unit Price, Amount = live formula, Variance Flag (checkbox, backend-set), Remark (shared, Unit Price/Qty discrepancies). Size/Unit are frozen copies from the linked PO Item, reference-only, no edit path (mismatch = wrong PO Item picked). Blank on a free-text line (no PO Item to copy from). Free-text "Other" option is currently hidden from the form UI (see Status).

**Addresses**: Address Label (primary), Line 1/2, City, State, Zip, Country, Formatted Address (formula).

**Materials**: latest-price cache. Natural key = Item Name + Size + Unit + Vendor. Unit Price, Latest Line/Job/PO/Date. Not the price-history source (that's PR Items). USD only.

**Auth Tokens**: Token (primary), Email, Expires At, Used, Created At. Single-use, 15-min TTL.

### Units (PR Items / PO Items / Invoice Items)

One single-select field, shared 19-value list: EA, FT, SET, LS, LOT, M, ROLL, PCS, SHEET, M/D, FIT, SQFT, IN, Lengths, KG, PSI, TUBES, PACK, ST.
- JS source of truth: `lib/units.js` CANONICAL_UNITS, dropdown on PRForm.js/EditAndContinueForm.js. Out-of-list existing values are preserved as an extra option, never silently blanked.
- `scripts/import/add_unit_options.py` keeps its own duplicate list (Python can't import JS).
- Airtable's Metadata API can't edit a select field's option list; only way to add a choice is `typecast=True` via a normal record write — the script cycles a throwaway scratch record per table.

---

## ID generation (lib/ids.js)

1. Top-level IDs (PR/PO/Invoice): independent daily-reset counters. PO uses 4-digit year; PR/Invoice use 2-digit.
2. Child-table IDs: {Parent ID}-{seq}, resets per parent.
3. Vendor-issued codes (Vendor Quotation Code, Vendor Invoice Code): human-entered, scope by Vendor.

Naming: auto-generated -> `X ID`. Human-typed -> `X Label`/plain name. Calendar-only -> `X Date`. Time-meaningful -> `X At`.

---

## Querying parent/child data

filterByFormula can't match a link field against a record ID. Read the parent's reverse-link field via .find(parentRecordId) (getLinkedRecords() in client.js), never filter the child table directly. Exception: materials.js:getMaterialByKey uses a Vendor Record ID lookup field.

## Concurrency: withKeyLock()

generateChildId and upsertMaterial wrap read-then-write in withKeyLock(). Serializes only within one process/invocation. Double-submit needs frontend disable-on-click guards.

---

## Auth (lib/auth.js, lib/session.js, lib/email.js, lib/authz.js)

- Magic link only. requestMagicLink() domain-checks then emails a token; verifyMagicLink() consumes it (withKeyLock-protected), finds-or-creates the User.
- lib/session.js: iron-session, payload `{ userId }`. getCurrentUser() treats a missing Users record as logged-out, re-throws real Airtable errors.
- getActiveUser() (lib/authz.js) also treats Status: Inactive as logged-out.
- requireUser()/requireRole(role)/requireAdmin(): Server Component/Action helpers. Route Handlers use getActiveUser() + 401/403 JSON.
- No proxy.js/middleware — each page's own requireUser() call is the gate.
- Env vars: SESSION_SECRET, RESEND_API_KEY, ALLOWED_EMAIL_DOMAIN, EMAIL_FROM (optional). Fail-fast at module load; set in Vercel too.
- Resend still sandbox mode — can only deliver to the account owner's address. Domain verification needed before real multi-user use.
- Not built: rate-limiting on requestMagicLink.

---

## Route protection (lib/authz.js)

app/admin/jobs|vendors|lines/new — Admin-only, Server Action re-checks requireAdmin(). app/pos/[poId] and app/invoices/[invoiceId] — viewing is President-or-Admin; invoices/[invoiceId]'s Paid toggle action is Admin-only.

---

## Utility scripts (scripts/)

- scripts/tests/ — temporary/verification, deleted from Airtable after use.
- scripts/import/ — reusable one-time backfills. Python via `requests` + `.env.local` (import_jobs.py, add_unit_options.py).
- scripts/demo/ — kept in repo, NOT deleted from Airtable: seed_demo_fixtures.mjs (demo Job 26-DEMO-01 + Line/Vendor/Address, skip-if-exists), make-invoice-pdf.mjs (demo invoice PDF from a real PO). Demo runs from one account standing in for every role; President access via temporarily flipping Role.
- lib/airtable/addresses.js has createAddress() (writer) for the demo seed script.

---

## Git workflow rules

- Never commit to main. One branch per issue: {issue#}-{short-desc}.
- Commit format: `{type}: {description} (#{issue#})` — feat / fix / chore / refactor / docs (project markdown/CLAUDE.md changes) / test (changes under scripts/tests/).
- PR description must include `Closes #{issue#}`. Squash merge — PR description becomes the final commit body.
- Line-wrap commit bodies + PR descriptions at 72 chars. Prompts/comments don't need wrapping.
- Wrap literal `<tag>`-looking text in backticks in PR descriptions.
- If an issue is already covered by other work, comment explaining why, then close — never silently close via Closes #.
- Milestones = Phases (0-5) or standalone cross-cutting milestones. Stay scoped to the current issue's Milestone unless told otherwise.
- Don't open a PR unless asked. Never commit yourself — write commit-msg.txt at repo root (gitignored), user commits manually.
- All GitHub content, project markdown, and web-app-facing text is English regardless of conversation language.

---

## Status

**Phase 0-3** (Foundations, PR creation, PO generation, Invoice handling) — done.

**Phase 4** (Materials price history + reporting) — not started.

**Phase 5** (AI-assisted invoice PDF line-item parsing) — not started.

**PR Draft Support** (milestone) — #72 (save PR as draft) done; #73 (resume-prompt on re-entry) and #74 (draft list page) not started. Save/submit share one persist path (`persistPRFromForm` in `app/prs/new/actions.js`): first Save Draft mints the real PR ID + Status Draft, re-saves update the same record and rebuild children (create-new-then-delete-old). Submit promotes the same Draft record to In Review (PR ID/Created At/history continuous). `lib/prDraft.js:loadPRDraft(prId)` is the reload contract #73/#74 call to hydrate the form; drafts relax all submit-time validation and order by Created At (#105).

**Known follow-ups, not yet scheduled**:
- (none currently — the Invoice list page + create-redirects-to-detail follow-up was resolved in #115.)
