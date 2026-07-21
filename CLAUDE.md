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
- lib/units.js — CANONICAL_UNITS, the single JS-side source of truth for the Unit select list.
- AIRTABLE_API_KEY server-side only, never in the client bundle.

---

## Data model (19 tables)

**Users**: User Name (primary), Email, Phone, Role (Employee/President), Is Admin, Status (Active/Inactive), Created At, Assigned Jobs (link -> Jobs, multiple, optional — convenience default, never access control).

**Jobs**: Job Code (primary), Job Name, Business Unit, PIC/Manager (link -> Users) + Phone/Email (Lookups), Delivery/Alternate Address (link -> Addresses, single), Lines/Users (reverse-links).

**Lines**: child of Jobs. Line Label (primary, formula = {Job} - {Line Name}), Line Name (human-entered), Job (link, single).

**Vendors**: Vendor Name (primary), PIC Name/Phone/Email (plain text, external), Address (link, single), Purchase Orders (Lookup via PR chain).

**Purchase Requests**: PR ID (HYE-PR-YYMMDD-##), Requester/Vendor (links, single), Line (link, single), Job (Lookup via Line, read-only), Created Date, Status (Draft/In Review/Approved/PO Signed — no Rejected; PO Signed fires when the President signs the generated PO), Current Signer Step, Items Subtotal (rollup, PR Items only), Shipping Fee (optional currency, Requester enters when known; fixed once set, changeable only via Edit and continue), Total Amount (formula = Items Subtotal + Shipping Fee, blank = 0 — the PR's final figure), Notes, Quotation Files (Lookup, plural — a PR can have more than one Quotation).

**PR Signers** — dynamic ordered approval chain:
- Requester assigns an arbitrary ordered list of signers at creation, each tagged Confirmation Type (Approval/Agreement) — label only, the confirm-and-advance action is identical either way.
- Each turn: Approve/Agree, Edit and continue, or Return for correction (to any earlier signer/requester/self — pauses and resumes, never restarts). Nested corrections form a real LIFO stack: each resolve unwinds exactly one level, never jumps straight to the original sender.
- Editing after signing does NOT invalidate approval.
- Fields: PR Signer ID, PR/Signer (link, single), Sequence Order, Status (Pending/Approved/Edited/Returned), Confirmation Type, Signed At, Notes (no input on plain Approve/Agree — Edit and continue and Return still collect it; Return's Notes is required and shown in History, Edit and continue's is written to Edit Log per changed field).
- PR detail page shows the chain as a linear progress bar (`lib/prSigning.js:getSignerChainProgress` + `app/prs/[prId]/SignerProgressBar.js`), current state only — History remains the full log. A signer passed through but pushed back by a correction ("paused") shares neutral color with "not yet reached", distinguished only by a dashed border. Known gap: Correction Requests.Sent To stores only a user id, ambiguous when that person is both Requester and a Signer — the progress bar defaults to the signer interpretation; this never affects the actual signing state machine, which resolves via Current Signer Step, not Sent To.

**PR Items**: PR Item ID, PR (link), Item Name, Size, Unit (single select, canonical 19-value list shared with PO Items/Invoice Items — see Units below), Qty, Unit Price, Amount = live formula, Remark (free text only), Quotation (link, single -> Quotations — auto-linked when only one exists, user-picked via dropdown once 2+ exist, never silently reassigned when a new one is added later).

**Correction Requests**: Correction Request ID, PR, Initiated By, Sent To, Notes, Requested At, Resolved At, Status (Pending/Resolved).

**Edit Log**: Edit Log ID, PR, Changed By, Field Name (select — item fields plus Shipping Fee and Unit Price), Old Value, New Value, Changed At, Notes (optional reason; shared field, older item-edit entries just leave it blank).

**Purchase Orders**: strict 1:1 with PR. PO ID (HYE-PO-YYYYMMDD-## — 4-digit year, the one exception to this project's 2-digit-year convention), PR (link), Vendor (Lookup via PR), Quotation File (Lookup), Our PIC/Manager (links), Created Date, President Signed(+At), Status (Draft/Signed/Sent to Vendor), PO PDF File, Items Subtotal (rollup, PO Items only), Shipping Fee (plain currency, copied from the PR's Shipping Fee at PO-generation time — frozen, not a Lookup), Total Amount (formula = Items Subtotal + Shipping Fee, blank = 0 — printed as the PO PDF's TOTAL line), Delivery Address Used (Primary/Alternate — internal tracking only, never a UI choice).

**PO Items**: frozen snapshot from PR Items at PO-generation time — NOT live. PO Item ID, PO (link), Item Name, Size, Unit (single select, same canonical list), Qty, Unit Price, Amount = static value, Remark, Invoice Items (reverse-link, multiple — line-level partial invoicing is real).

**Quotations**: Quotation ID ({PR ID}-Q{seq}), Vendor Quotation Code (human-entered), Vendor/PR (links, single), File (attachment, required at creation in the app's flow). At least one Quotation is required per PR; a PR can have more than one over its lifetime, created via a dynamic list on the PR form (at submission, or later via Edit and continue).

**Invoices**: Invoice ID (HYE-INV-YYMMDD-##, top-level), Vendor Invoice Code (human-entered), Vendor (link), Issue/Due Date, Amount Due (labeled "Vendor's Stated Total" — compared against but never overwritten by the calculated total), Shipping Fee, Tariff (optional, toggle-revealed), Items Subtotal (rollup of Invoice Items.Amount), Calculated Total (formula = Items Subtotal + Shipping Fee + Tariff, blank = 0 — stores what the submit-time comparison against Amount Due computes), Variance Flag (checkbox, backend-set — see Variance checking below), Paid(+Date), File (attachment, required).

**Invoice-PO Link**: join table for many-to-many. Primary = plain autoNumber. Both link fields single-record.

**Invoice Items**: Invoice Item ID, Invoice + PO (links, single), PO Item (link, single — the specific PO line this reconciles against), Item Name, Size, Unit (single select, same canonical list), Qty, Unit Price, Amount = live formula, Variance Flag (checkbox, backend-set — see Variance checking below), Remark (shared for Unit Price/Qty discrepancy notes). Size/Unit are frozen copies from the linked PO Item at line-creation time, reference-only in the invoice form with no edit path — a mismatch means the wrong PO Item was picked, not a value to correct. Blank on a free-text "Other" line (no PO Item to copy from).

**Addresses**: Address Label (primary, human-picked), Line 1/2, City, State, Zip, Country, Formatted Address (formula).

**Materials**: latest-price cache. Natural key = Item Name + Size + Unit + Vendor. Unit Price, Latest Line (link, single), Latest Job (Lookup via Latest Line), Latest PO, Latest Date. Not the source of price history (that's PR Items). USD only.

**Auth Tokens**: Token (primary), Email, Expires At, Used, Created At. Single-use, 15-min TTL.

### Units (PR Items / PO Items / Invoice Items)

All three share one single-select field with the same 19-value canonical list: EA, FT, SET, LS, LOT, M, ROLL, PCS, SHEET, M/D, FIT, SQFT, IN, Lengths, KG, PSI, TUBES, PACK, ST.
- JS source of truth: `lib/units.js` CANONICAL_UNITS, rendered as a dropdown on PRForm.js and EditAndContinueForm.js. If an existing PR Item's Unit holds a value outside this list, the dropdown still shows/preserves it as an extra option rather than blanking it — only changes on deliberate re-selection.
- `scripts/import/add_unit_options.py` keeps its own duplicate copy (Python can't import a JS module) — update both if the list changes.
- Airtable's Metadata API cannot edit a select field's option list (confirmed by direct testing — PATCHing `options.choices` 422s regardless of payload/token scope). The only way to add a choice via the API is the `typecast=True` side effect of a normal record write — add_unit_options.py cycles one throwaway scratch record per table to do this without touching real data.
- PO Items has no free-text/user-facing Unit entry point — only ever written by lib/poGeneration.js as a frozen copy from PR Items.

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
- Resend account still sandbox mode (no verified sending domain) — can only deliver to the account owner's own address. Domain verification needed before real multi-user use.
- Not built: rate-limiting on requestMagicLink.

---

## Route protection (lib/authz.js)

Reference usage: app/admin/jobs/new, app/admin/vendors/new, app/admin/lines/new — Admin-only forms, Server Action re-checks requireAdmin() independently of the page. app/pos/[poId] and app/invoices/[invoiceId] are President-or-Admin for viewing (Admins need it for day-to-day invoice reconciliation); app/invoices/[invoiceId]'s Paid toggle action is Admin-only, re-checked in its own Server Action same as the admin forms above.

---

## Utility scripts (scripts/)

- scripts/tests/ — temporary/verification scripts, deleted from Airtable after use.
- scripts/import/ — reusable one-time backfill scripts. data/ and output/ gitignored. Python, talks to Airtable directly via `requests` + `.env.local`'s AIRTABLE_API_KEY (import_jobs.py, add_unit_options.py).
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

**Phase 3** (Invoice handling) — in progress. Done: #14, #46, #51, #48, #57, #84, #17 (decision), #15, #16, #91, #92, #93 (decision), #96.

**Free-text "Other" item option** (#93 decision, #96) — hidden from the Invoice form's PO Item dropdown behind `SHOW_OTHER_ITEM_OPTION` (InvoiceForm.js, currently `false`) since no legitimate use case had surfaced; re-exposing is a one-line flip, no other code change. The backend path for a PO-Item-less Invoice Item is untouched (createInvoiceAction, lib/airtable/invoiceItems.js) — this is UI-only. No existing Invoice Items were free-text at the time this shipped.

**Payment tracking** (#16, `app/invoices/[invoiceId]`) — the first page that shows a single Invoice on its own (header, Items, Variance Flag badges), reached by ID like `app/pos/[poId]`/`app/prs/[prId]` — no Invoice list page yet, matching the same not-built-yet gap as PR/PO lists. Viewing is President-or-Admin (same reasoning as `app/pos/[poId]`); marking Paid is Admin-only, matching who already creates invoices (`createInvoiceAction`). Checking Paid requires a Paid Date (defaults to today, editable); unchecking always clears Paid Date too, so a stale date can't linger. If the invoice (header or any line) has a Variance Flag, a review warning shows above the Paid toggle — never blocking, since variance review and payment confirmation are independent judgment calls. `app/pos/[poId]/page.js`'s Invoice Item breakdown also shows a read-only Paid/Paid Date badge per line, linking to the Invoice page rather than duplicating the action there.

**Variance checking** (#15, `lib/variance.js`) — not a single uniform rule:
- Header (Invoice.Amount Due vs Calculated Total): hybrid tolerance — passes if within $5 or 1% of Calculated Total, whichever is more permissive. Invoices.Variance Flag (checkbox), computed once at invoice-creation time after Invoice Items are linked (so the Items Subtotal -> Calculated Total rollup is current).
- Line, Unit Price (Invoice Item vs its linked PO Item): near-exact match — $0.01 absolute tolerance only (floating-point/rounding noise), no percentage rule.
- Line, Qty (Invoice Item vs its linked PO Item): not a tolerance comparison. Flags when the sum of Qty across all Invoice Items linked to a given PO Item exceeds that PO Item's Qty (`getInvoicedQtyForPOItem` in poItems.js) — a creation-time snapshot, never retroactively recomputed for sibling Invoice Items created earlier against the same PO Item. Free-text "Other" lines (no PO Item link) are skipped entirely for both line checks.
- Both line checks share Invoice Items' existing Variance Flag/Remark fields. Visible on `app/pos/[poId]/page.js` — each PO Item's invoiced/remaining aggregate now expands to show the actual reconciling Invoice Items, with line- and header-level Variance Flag badges.

**Phase 4** (Materials price history + reporting) — not started.

**Phase 5** (AI-assisted invoice PDF line-item parsing) — not started.

**PR Stage Fixes & Enhancements** (milestone, cross-cutting, alongside Phase 3) — done.

**PR Draft Support** (milestone) — 3 issues created (save PR as draft; resume-prompt on re-entry; draft list page), not started.

**Naming unification** (no milestone, cross-cutting, done): Rate -> Unit Price (PR/PO Items); Total Amount -> Items Subtotal + new Total Amount = Items Subtotal + Shipping Fee (PR and PO); PO Shipping Fee is now a frozen copy, not a Lookup; Invoice gained Items Subtotal + Calculated Total. PR/PO/Invoice Items' Unit converted to a shared single-select (see Units above); Invoice Items gained Size/Unit as new fields entirely.