# Material PO Automation — Project Context

Read automatically by Claude Code at the start of every session.

**If the Airtable MCP connector is available, prefer querying the live base schema over trusting this document for exact field types — this file can drift, but the rules below stay authoritative.**

---

## What this project is

Replacing an email-and-Excel-based Purchase Request -> Purchase Order -> Invoice workflow (Hanyang ENG, a construction company) with a web app owning the full lifecycle.

## Architecture

- Next.js (App Router, JavaScript, Tailwind), deployed on Vercel.
- Airtable as data store only (base: "Material Purchases"). All business logic — ID generation, signing-chain rules, PDF generation, notifications, variance checks, locking — lives in the backend. Airtable formulas only for pure data transforms (PR Items.Amount = Qty x Rate, address formatting), never workflow logic.
- Auth: magic link only, restricted to company email domain, verified. New signups always land as plain Employee (Is Admin: false) — promotion is a manual Airtable edit.

## Service layer pattern

- lib/airtable/client.js — shared connection, TABLES constants, getLinkedRecords(), withKeyLock().
- lib/airtable/{table}.js — one file per table, plain async functions. Build only what the current phase needs.
- lib/ids.js — all ID generation.
- AIRTABLE_API_KEY server-side only, never in the client bundle.

---

## Data model (18 tables)

**Users**: User Name (primary), Email, Phone, Role (Employee/President), Is Admin, Status (Active/Inactive), Created At, Assigned Jobs (link -> Jobs, multiple, optional — convenience default for picker sorting, never access control).

**Jobs**: Job Code (primary), Job Name, Business Unit, PIC/Manager (link -> Users) + Phone/Email (Lookups), Delivery/Alternate Address (link -> Addresses, single), Lines/Users (reverse-links).

**Lines**: child of Jobs. Line Label (primary, formula = {Job} - {Line Name}, since Line Name alone isn't unique across Jobs), Line Name (human-entered), Job (link, single).

**Vendors**: Vendor Name (primary), PIC Name/Phone/Email (plain text, external — not linked to Users), Address (link, single), Purchase Orders (Lookup via PR chain).

**Purchase Requests**: PR ID (HYE-PR-YYMMDD-##), Requester/Vendor (links, single), Line (link, single — the actual field picked), Job (Lookup via Line, read-only), Created Date, Status (Draft/In Review/Approved/Converted to PO — no Rejected), Current Signer Step, Total Amount (rollup), Notes, Quotation File (Lookup).

**PR Signers** — dynamic ordered approval chain, the core design:
- Requester assigns an arbitrary ordered list of signers at PR creation — not a fixed panel.
- Each turn: Approve, Edit and continue, or Return for correction (to any earlier signer/requester/self — pauses and resumes, never restarts).
- Editing after signing does NOT invalidate approval. Integrity = full edit history, not record-locking.
- Fields: PR Signer ID, PR/Signer (link, single), Sequence Order, Status (Pending/Approved/Edited/Returned), Signed At, Notes.

**PR Items**: PR Item ID, PR (link), Item Name, Size, Unit, Qty, Rate, Amount = live formula (editable pre-PO), Remark.

**Correction Requests**: Correction Request ID, PR, Initiated By, Sent To, Notes, Requested At, Resolved At, Status (Pending/Resolved).

**Edit Log**: Edit Log ID, PR, Changed By, Field Name (select), Old Value, New Value, Changed At.

**Purchase Orders**: strict 1:1 with PR (single-record both sides). PO ID (HYE-PO-YYYYMMDD-## — 4-digit year, the one exception to this project's 2-digit-year convention, matching real historically-issued PO numbers so PDF auto-detection can use one regex for both), PR (link), Vendor (Lookup via PR), Quotation File (Lookup), Our PIC/Manager (links), Created Date, President Signed(+At), Status (Draft/Signed/Sent to Vendor), PO PDF File, Total Amount (rollup), Delivery Address Used (Primary/Alternate — internal tracking only, never a UI choice; PDF always prints both addresses when a Job has an Alternate).

**PO Items**: frozen snapshot from PR Items at PO-generation time — NOT live. PO Item ID, PO (link), Item Name, Size, Unit, Qty, Rate, Amount = static value, backend-written, never a formula, Remark.

**Quotations**: Quotation ID ({PR ID}-Q{seq}), Vendor Quotation Code (human-entered), Vendor/PR (links, single), File (attachment, not auto-parsed).

**Invoices**: Invoice ID (HYE-INV-YYMMDD-##, top-level, not a child ID since Invoice-PO is many-to-many), Vendor Invoice Code (human-entered), Vendor (link), Issue/Due Date, Amount Due, Shipping Fee, Paid(+Date), File (attachment, required).

**Invoice-PO Link**: join table for many-to-many. Primary = plain autoNumber. Both link fields single-record — many-to-many via multiple join rows.

**Invoice Items**: Invoice Item ID, Invoice + PO (links, single — each line reconciles against exactly one PO), Item Name, Qty, Unit Price, Amount (live formula), Variance Flag (checkbox, backend-set, not a formula).

**Addresses**: Address Label (primary, human-picked, not an auto-ID), Line 1/2, City, State, Zip, Country, Formatted Address (formula).

**Materials**: latest-price cache. Natural key = Item Name + Size + Unit + Vendor. Unit Price, Latest Line (link, single), Latest Job (Lookup via Latest Line), Latest PO, Latest Date. Not the source of price history (that's PR Items). USD only.

**Auth Tokens**: Token (primary), Email, Expires At, Used, Created At. Single-use, 15-min TTL. Separate from Users.

---

## ID generation (lib/ids.js)

1. Top-level IDs — PR ID / PO ID / Invoice ID: independent daily-reset counters, backend-generated. PO ID uses 4-digit year (YYYYMMDD); PR ID/Invoice ID use 2-digit (YYMMDD) — PO is the one exception, to match real historical PO numbers for PDF auto-detection.
2. Child-table IDs (PR Item, PR Signer, Correction Request, Edit Log, PO Item, Quotation, Invoice Item): {Parent ID}-{seq}, resets per parent.
3. Vendor-issued codes (Vendor Quotation Code, Vendor Invoice Code): human-entered, not unique alone — always scope by Vendor too.

Naming: auto-generated unique fields -> `X ID`. Human-typed picker text -> `X Label`/plain name.
Date/time naming: calendar-only -> `X Date`. Time-meaningful -> `X At`.

---

## Querying parent/child data

filterByFormula cannot match a link field against a record ID. Required: read the parent's own reverse-link field via .find(parentRecordId) for counts/listing (getLinkedRecords() in client.js), never filter the child table directly. Exception: materials.js:getMaterialByKey uses a Vendor Record ID lookup field (Materials' natural key doesn't map to a single parent).

## Concurrency: withKeyLock()

generateChildId and upsertMaterial wrap their read-then-write sequence in withKeyLock() (per-key promise chain, keyed on parent+link or normalized natural key) to prevent duplicate IDs/records under concurrent calls.

Known residual risks: (1) only serializes within one process/invocation, not across serverless invocations — judged low-probability given the signing chain already serializes PR actions; (2) double-submit needs frontend disable-on-click guards, not a backend concern.

---

## Auth (lib/auth.js, lib/session.js, lib/email.js, lib/authz.js)

- Magic link only (no password ever stored). requestMagicLink() domain-checks then emails a token; verifyMagicLink() consumes the token (withKeyLock-protected) and finds-or-creates the User.
- lib/session.js: iron-session, payload is just { userId } — Role/Is Admin/Status never cached, so promotion/deactivation takes effect immediately. getCurrentUser() resolves session -> User, treating a missing Users record as "not logged in" (not a crash) while re-throwing real Airtable errors.
- getActiveUser() (lib/authz.js) additionally treats Status: Inactive as logged-out.
- requireUser()/requireRole(role)/requireAdmin(): Server Component/Action helpers. requireRole accepts a single role or array. Route Handlers use getActiveUser() directly + 401/403 JSON (redirect() doesn't work there).
- No proxy.js/middleware — Role/Is Admin can't be cached in a cookie, so a proxy gate would only check "is there a session," no better than each page's own requireUser() call.
- Required env vars: SESSION_SECRET, RESEND_API_KEY, ALLOWED_EMAIL_DOMAIN, EMAIL_FROM (optional). Fail-fast at module load, same as AIRTABLE_API_KEY. Must be set in Vercel too.
- **Current Resend account is a replacement account** (prior one's login email became inaccessible), still sandbox mode (no verified sending domain) — can only deliver to the account owner's own address. Not a practical problem yet (Airtable has one real user). Domain verification planned once the project is further along — see "Deploy-readiness: verify a Resend sending domain" below for the exact steps when that time comes.
- Not built: rate-limiting on requestMagicLink.

### Deploy-readiness: verify a Resend sending domain (do before real multi-user use)

1. Resend dashboard -> Domains -> Add Domain. Use a **subdomain** (e.g. mail.hyeusa.com), not root hyeusa.com (root likely has existing MX records that would conflict). Region is immutable once created.
2. Add the ~3 generated DNS records (MX, SPF TXT, DKIM TXT/CNAME) at the real DNS provider for hyeusa.com; optional DMARC TXT recommended too. If using Cloudflare, keep records DNS-only (grey cloud), not proxied.
3. Click Verify DNS Records; propagation usually minutes, Resend rechecks for up to 72h.
4. Once verified, update EMAIL_FROM (in .env.local and Vercel) to an address on the verified subdomain.

---

## Utility scripts (scripts/)

- scripts/tests/ — temporary/verification scripts (JS or Python).
- scripts/import/ — reusable one-time backfill scripts (e.g. import_jobs.py — import-not-sync, existing Job Codes always skipped, never updated). scripts/import/data/ and output/ are gitignored.

---

## Git workflow rules

- Never commit directly to main. One branch per issue: {issue#}-{short-desc}.
- Commit format: {type}: {description} (#{issue#}) — feat/fix/chore/refactor.
- PR description must include Closes #{issue#}. Squash merge is configured — PR description becomes the final commit body on main.
- Line-wrap: commit bodies + PR descriptions at 72 chars; issue comments don't need wrapping (never enter git history).
- If an issue's logic is already covered by another issue's work, comment explaining why first, then close — never silently close via a PR's Closes #.
- GitHub Milestones = Phases (0-5), Issues = tasks within a phase. Stay scoped to the current issue's Milestone unless told otherwise.
- Don't open a PR unless explicitly asked to.
- Never run git commit yourself. Write the commit message to commit-msg.txt at the repo root (overwrite, gitignored); the user commits manually.

---

## Build phases

0. Foundations — done (Next.js scaffold, Airtable service layer, auth, ID generation, route protection).
1. PR creation + dynamic signing chain — done (issues #5, #6, #8, #9).
2. PO generation — done (issues #10, #12/#13; #11 closed as unnecessary).
3. Invoice handling — in progress (see below).
4. Materials price history + reporting — not started.
5. Deferred: real payment integration, formal rejection flow beyond correction/return, multi-PIC vendors, backup president approver.

### Phase 3 status (Invoice handling)

Done:
- **#14 — Manual invoice entry** (app/invoices/new, Admin-only): header + line items, PO picked at header seeds each line's PO. Rollback follows the create-then-delete pattern (Invoice -> Items -> one Invoice-PO Link row per distinct PO used). Invoice file attachment is required (unlike optional Quotations) — Blob URL written in the same create() call as the Invoice record, no intermediate state. Variance checking explicitly out of scope (Variance Flag always false), blocked on #17.
- **#46 — Auto-detect PO number(s) from uploaded invoice PDF**: extraction triggers client-side right after Blob upload (not at submit), via pdf-parse (serverExternalPackages: ["pdf-parse","pdfjs-dist"] needed in next.config.mjs to avoid a Turbopack worker-bundling break). Regex /HYE-PO-\d{8}-\d{2}/g, deduped, checked against real data via getPOById() -> confirmed/unconfirmed. Vendor conflict across confirmed POs = treated as uncertain, no auto-fill. A parse/fetch failure returns an empty result (looks identical to "nothing detected"), never an error.
- **PDF Upload / Manual Entry tabs** (InvoiceForm.js): one form/one state tree, `activeTab` only reorders the same three sections (File/Header/Items) — detection always runs regardless of active tab. Switching tabs never loses attached/detected/typed data.
- **Header PO is multi-select** (not a single "default"): `selectedPoIds` array + `applyPoSelection()` as the single sync function handling every transition. Exactly 1 PO selected -> all items forced to it, no per-item picker shown. 2+ selected -> per-item picker appears, restricted to only the selected POs (not the full Vendor catalog) — this is what closes the earlier gap where a line could end up on a PO the header never claimed. Removing a PO resets only the item(s) using it. #46 detection wires into this by calling applyPoSelection() with all confirmed PO IDs.

Not yet started (new issues to create/prioritize, in this order):
- Track un-invoiced PO Items (shipment/receipt status per PO Item) — pure read/aggregation, no new schema, narrows candidates for the item-matching feature below.
- Suggest PO Item matches for invoice line items (similarity-based, human-confirmed) — real invoice samples show item names never match PR/PO names exactly, repeated generic Item Codes covering different items, and non-item lines (Freight) mixed into item tables. Target is ranked candidate suggestions + one-click confirm, not exact auto-match. Manual entry (dropdown of that invoice's PO's items, plus a free-text "other" escape hatch) is the fallback.
- #15 — Variance checking (invoice vs PO reconciliation): blocked on the still-open tolerance-rule decision (#17: exact match vs. % tolerance). Should be sequenced after the two items above, since variance checking presumes line-item matching is already trustworthy.
- #40 — image-based Quotations (non-PDF) merge into PO PDF appendix — deferred, PDF-only for now.

Known real-world consideration for variance-rule design: real invoice samples show partial shipments are routine (Ordered != Shipped is normal, not an error) — the eventual tolerance rule needs to account for this, not just flag any Qty mismatch.