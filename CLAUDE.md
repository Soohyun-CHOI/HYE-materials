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

**Purchase Requests**: PR ID (HYE-PR-YYMMDD-##), Requester/Vendor (links, single), Line (link, single), Job (Lookup via Line, read-only), Created Date, Status (Draft/In Review/Approved/PO Signed — no Rejected; PO Signed fires when the President signs the generated PO, not when the PO is merely created — see Purchase Orders), Current Signer Step, Total Amount (rollup), Notes, Quotation File (Lookup).

**PR Signers** — dynamic ordered approval chain:
- Requester assigns an arbitrary ordered list of signers at PR creation, each tagged Approval or Agreement (Confirmation Type) — a procedural label only, not a workflow branch: the confirm-and-advance action is identical either way, it only changes what the signing UI and history log call it ("Approve"/"Approved" vs "Agree"/"Agreed").
- Each turn: Approve (or Agree, per tag), Edit and continue, or Return for correction (to any earlier signer/requester/self — pauses and resumes, never restarts). Edit and continue and Return are neither Approval nor Agreement — they keep their own distinct labels regardless of a signer's Confirmation Type.
- Editing after signing does NOT invalidate approval.
- Fields: PR Signer ID, PR/Signer (link, single), Sequence Order, Status (Pending/Approved/Edited/Returned), Confirmation Type (Approval/Agreement), Signed At, Notes.

**PR Items**: PR Item ID, PR (link), Item Name, Size, Unit, Qty, Rate, Amount = live formula, Remark (free text only — never conflate with Quotation Code, which lives on Quotations, not here), Quotation (link, single — same pattern as Invoice Items -> PO Item; auto-linked to the PR's sole Quotation when there's only one, user-picked via a dropdown once 2+ exist, never silently changed when a 2nd Quotation is added later).

**Correction Requests**: Correction Request ID, PR, Initiated By, Sent To, Notes, Requested At, Resolved At, Status (Pending/Resolved).

**Edit Log**: Edit Log ID, PR, Changed By, Field Name (select), Old Value, New Value, Changed At.

**Purchase Orders**: strict 1:1 with PR. PO ID (HYE-PO-YYYYMMDD-## — 4-digit year, the one exception to this project's 2-digit-year convention, matching real historical PO numbers for PDF auto-detection), PR (link), Vendor (Lookup via PR), Quotation File (Lookup), Our PIC/Manager (links), Created Date, President Signed(+At), Status (Draft/Signed/Sent to Vendor), PO PDF File, Total Amount (rollup), Delivery Address Used (Primary/Alternate — internal tracking only, never a UI choice; PDF always prints both addresses when a Job has an Alternate).

**PO Items**: frozen snapshot from PR Items at PO-generation time — NOT live. PO Item ID, PO (link), Item Name, Size, Unit, Qty, Rate, Amount = static value, Remark, Invoice Items (reverse-link, multiple — a PO Item can have more than one Invoice Item against it; line-level partial invoicing is real, same reasoning as PO-level).

**Quotations**: Quotation ID ({PR ID}-Q{seq}), Vendor Quotation Code (human-entered), Vendor/PR (links, single), File (attachment, not auto-parsed, required at creation in the app's own flow even though Airtable itself can't enforce that). At least one Quotation is required per PR (not optional) — a PR always needs the vendor's actual quote on file. A PR can have more than one over its lifetime (a Vendor can send more than one quote) — created via a dynamic list on the PR submission form and, for one added after the PR already exists, via Edit and continue.

**Invoices**: Invoice ID (HYE-INV-YYMMDD-##, top-level), Vendor Invoice Code (human-entered), Vendor (link), Issue/Due Date, Amount Due (labeled "Vendor's Stated Total" on the form — vendor's own printed total, compared against but never overwritten by the calculated total), Shipping Fee, Tariff (optional, added via a toggle rather than always shown), Paid(+Date), File (attachment, required).

**Invoice-PO Link**: join table for many-to-many. Primary = plain autoNumber. Both link fields single-record.

**Invoice Items**: Invoice Item ID, Invoice + PO (links, single), PO Item (link, single — the specific PO line this invoice line reconciles against), Item Name, Qty, Unit Price, Amount (live formula), Variance Flag (checkbox, backend-set), Remark (shared field for Unit Price and Qty discrepancy notes).

**Addresses**: Address Label (primary, human-picked), Line 1/2, City, State, Zip, Country, Formatted Address (formula).

**Materials**: latest-price cache. Natural key = Item Name + Size + Unit + Vendor. Unit Price, Latest Line (link, single), Latest Job (Lookup via Latest Line), Latest PO, Latest Date. Not the source of price history (that's PR Items). USD only.

**Auth Tokens**: Token (primary), Email, Expires At, Used, Created At. Single-use, 15-min TTL.

---

## ID generation (lib/ids.js)

1. Top-level IDs — PR ID / PO ID / Invoice ID: independent daily-reset counters, backend-generated. PO ID uses 4-digit year; PR ID/Invoice ID use 2-digit — PO is the one exception, to match real historical PO numbers for PDF auto-detection.
2. Child-table IDs (PR Item, PR Signer, Correction Request, Edit Log, PO Item, Quotation, Invoice Item): {Parent ID}-{seq}, resets per parent.
3. Vendor-issued codes (Vendor Quotation Code, Vendor Invoice Code): human-entered, not unique alone — always scope by Vendor too.

Naming: auto-generated unique fields -> `X ID`. Human-typed picker text -> `X Label`/plain name.
Date/time naming: calendar-only -> `X Date`. Time-meaningful -> `X At`.

---

## Querying parent/child data

filterByFormula cannot match a link field against a record ID. Required: read the parent's own reverse-link field via .find(parentRecordId) for counts/listing (getLinkedRecords() in client.js), never filter the child table directly. Exception: materials.js:getMaterialByKey uses a Vendor Record ID lookup field.

## Concurrency: withKeyLock()

generateChildId and upsertMaterial wrap their read-then-write sequence in withKeyLock() to prevent duplicate IDs/records under concurrent calls. Known residual risk: only serializes within one process/invocation, not across serverless invocations — judged low-probability given the signing chain already serializes PR actions. Double-submit needs frontend disable-on-click guards, not a backend concern.

---

## Auth (lib/auth.js, lib/session.js, lib/email.js, lib/authz.js)

- Magic link only. requestMagicLink() domain-checks then emails a token; verifyMagicLink() consumes the token (withKeyLock-protected) and finds-or-creates the User.
- lib/session.js: iron-session, payload is just { userId }. getCurrentUser() resolves session -> User, treating a missing Users record as "not logged in" while re-throwing real Airtable errors.
- getActiveUser() (lib/authz.js) additionally treats Status: Inactive as logged-out.
- requireUser()/requireRole(role)/requireAdmin(): Server Component/Action helpers. Route Handlers use getActiveUser() directly + 401/403 JSON.
- No proxy.js/middleware — Role/Is Admin can't be cached in a cookie, so a proxy gate would only check "is there a session," no better than each page's own requireUser() call.
- Required env vars: SESSION_SECRET, RESEND_API_KEY, ALLOWED_EMAIL_DOMAIN, EMAIL_FROM (optional). Fail-fast at module load. Must be set in Vercel too.
- Current Resend account is a replacement account, still sandbox mode (no verified sending domain) — can only deliver to the account owner's own address. Not a practical problem yet (one real user). Domain verification steps documented below, do before real multi-user use.
- Not built: rate-limiting on requestMagicLink.

### Deploy-readiness: verify a Resend sending domain

1. Resend dashboard -> Domains -> Add Domain. Use a subdomain (e.g. mail.hyeusa.com), not root hyeusa.com. Region is immutable once created.
2. Add the ~3 generated DNS records (MX, SPF TXT, DKIM TXT/CNAME) at the real DNS provider; optional DMARC TXT recommended. Cloudflare: keep DNS-only, not proxied.
3. Click Verify DNS Records; propagation usually minutes, up to 72h.
4. Once verified, update EMAIL_FROM (in .env.local and Vercel).

---

## Route protection (lib/authz.js)

Reference usage: app/admin/jobs/new, app/admin/vendors/new, app/admin/lines/new — Admin-only forms, Server Action re-checks requireAdmin() independently of the page. app/pos/[poId] is President-or-Admin (Admins need it for day-to-day invoice reconciliation, not just the President signing).

Phase 0's exit test (create a Job/Vendor/User through the app, not directly in Airtable) is satisfied.

---

## Utility scripts (scripts/)

- scripts/tests/ — temporary/verification scripts (JS or Python), deleted from Airtable after use.
- scripts/import/ — reusable one-time backfill scripts (e.g. import_jobs.py — import-not-sync). scripts/import/data/ and output/ gitignored.
- scripts/demo/ — reusable live-demo prep, kept in repo and NOT deleted from Airtable (unlike scripts/tests):
    - seed_demo_fixtures.mjs: creates a demo Job (26-DEMO-01, deliberately off the real Job Code pattern) + Line + Vendor + Address, via the real service-layer functions (not raw writes). Skip-if-exists, safe to re-run before every demo.
    - make-invoice-pdf.mjs: given a PO ID (only known once a PO is actually generated mid-demo), generates a matching demo invoice PDF (scripts/demo/output/, gitignored) pulling that PO's real Vendor/PO Items, for demoing #46's PDF auto-detection live.
    - Demo runs entirely from one login-capable account standing in for every Requester/Signer role (PR Signers can hold the same User in multiple slots) — President access handled by temporarily flipping that account's Role in Airtable.
- lib/airtable/addresses.js has createAddress() (writer, not just a reader) — added for the demo seed script, reused from the real service layer rather than a one-off raw call.

---

## Git workflow rules

- Never commit directly to main. One branch per issue: {issue#}-{short-desc}. Non-issue work (docs, tooling): a plain descriptive branch name, no issue number.
- Commit format: {type}: {description} (#{issue#}) — feat/fix/chore/refactor.
- PR description must include Closes #{issue#}. Squash merge is configured — PR description becomes the final commit body on main.
- Line-wrap: commit bodies + PR descriptions at 72 chars (these enter git history). Issue comments and Claude Code prompts don't need wrapping (never enter git history).
- Watch for literal `<tag>`-looking text (e.g. `<select>`) in PR descriptions -- GitHub's Markdown renderer treats an unclosed one as real HTML and swallows everything after it into the tag. Wrap in backticks.
- If an issue's logic is already covered by another issue's work, comment explaining why first, then close — never silently close via a PR's Closes #.
- GitHub Milestones = Phases (0-5), Issues = tasks within a phase. Stay scoped to the current issue's Milestone unless told otherwise.
- Don't open a PR unless explicitly asked to.
- Never run git commit yourself. Write the commit message to commit-msg.txt at the repo root (overwrite, gitignored); the user commits manually.

---

## Build phases

0. Foundations — done.
1. PR creation + dynamic signing chain — done (issues #5, #6, #8, #9).
2. PO generation — done (issues #10, #12/#13; #11 closed as unnecessary).
3. Invoice handling — in progress.
4. Materials price history + reporting — not started.
5. AI-assisted invoice PDF line-item parsing — new Milestone, not started. Deferred from Phase 3 since real vendor invoice layouts vary too much for a single positional heuristic (confirmed against 20 real vendor invoices across most of the company's actual monthly vendors).