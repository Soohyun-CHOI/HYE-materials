# Material PO Automation — Project Context

Read automatically by Claude Code at the start of every session.

**If the Airtable MCP connector is available, prefer querying the live base schema over trusting this document for exact field types — this file can drift, but the rules below stay authoritative.**

---

## What this project is

Replacing an email-and-Excel-based Purchase Request → Purchase Order → Invoice workflow (Hanyang ENG, a construction company) with a web app owning the full lifecycle.

## Architecture

- Next.js (App Router, JavaScript, Tailwind), deployed on Vercel.
- Airtable as data store only (base: "Material Purchases"). All business logic — ID generation, signing-chain rules, PDF generation, notifications, variance checks, locking — lives in the backend. Airtable formulas are only used for pure data transforms (`PR Items.Amount = Qty × Rate`, address formatting), never workflow logic.
- Auth: magic link only (decided over email/password — see "Auth" section below), restricted to company email domain, verified. New signups always land as plain Employee (`Is Admin: false`) — promotion to Admin/President is a manual Airtable edit.

## Service layer pattern

- `lib/airtable/client.js` — shared connection, `TABLES` constants, `getLinkedRecords()`, `withKeyLock()`.
- `lib/airtable/{table}.js` — one file per table, plain async functions. Build only what the current phase needs.
- `lib/ids.js` — all ID generation.
- `AIRTABLE_API_KEY` server-side only, never in the client bundle.

---

## Data model (16 tables)

**Users**: User Name (primary), Email, Phone, Role (`Employee`/`President`), Is Admin, Status (`Active`/`Inactive`), Created At.

**Jobs**: Job Code (primary), Job Name, Business Unit, Line, PIC/Manager (link → Users) + Phone/Email (Lookups), Delivery/Alternate Address (link → Addresses, single).

**Vendors**: Vendor Name (primary), PIC Name/Phone/Email (plain text, external contact — not linked to Users), Address (link, single), Purchase Orders (Lookup via PR chain).

**Purchase Requests**: PR ID (`HYE-PR-YYMMDD-##`, backend-generated), Requester/Job/Vendor (links, single), Created Date, Status (`Draft`/`In Review`/`Approved`/`Converted to PO` — no Rejected), Current Signer Step, Total Amount (rollup), Notes, Quotation File (Lookup).

**PR Signers** — dynamic ordered approval chain, the core design of this system:
- Requester assigns an arbitrary ordered list of signers (any mix of people) at PR creation — not a fixed panel.
- Each signer's turn: Approve, Edit and continue, or Return for correction (to any earlier signer, including requester or self — pauses and resumes from that point, never restarts).
- Editing after someone signed does NOT invalidate their approval. Integrity = full edit history (Edit Log / Correction Requests), not record-locking.
- Once a signer's turn has passed, they can't edit further, but their approval stands regardless of later changes.
- Fields: PR Signer ID (`{PR ID}-{seq}`), PR/Signer (link, single), Sequence Order, Status (`Pending`/`Approved`/`Edited`/`Returned`), Signed At, Notes.

**PR Items**: PR Item ID (`{PR ID}-{seq}`), PR (link, single), Item Name, Size, Unit, Qty, Rate, Amount = live formula (stays editable pre-PO), Remark.

**Correction Requests**: logs "return for correction." Correction Request ID, PR, Initiated By, Sent To (any earlier signer/requester/self), Notes, Requested At, Resolved At, Status (`Pending`/`Resolved`).

**Edit Log**: field-level change history. Edit Log ID, PR, Changed By, Field Name (select: Item Name/Size/Unit/Qty/Rate/Remark), Old Value, New Value, Changed At.

**Purchase Orders**: strict 1:1 with PR (single-record both sides). PO ID (`HYE-PO-YYMMDD-##`), PR (link), Vendor (Lookup via PR, not duplicated), Quotation File (Lookup, PO→PR→Quotations→File), Our PIC/Manager (links), Created Date, President Signed(+At), Status (`Draft`/`Signed`/`Sent to Vendor`), PO PDF File (the one real output file this system produces), Total Amount (rollup), Delivery Address Used (`Primary`/`Alternate`).

**PO Items**: frozen snapshot copied from PR Items at PO-generation time — NOT live. PO Item ID (`{PO ID}-{seq}`), PO (link), Item Name, Size, Unit, Qty, Rate, Amount = static value, backend-written, never a formula (must never drift after issuance to a vendor), Remark.

**Quotations**: Quotation ID (`{PR ID}-Q{seq}`, backend-generated child ID), Vendor Quotation Code (human-entered, vendor's own number), Vendor/PR (links, single), File (attachment, not auto-parsed — unfixed-form documents, extraction deliberately out of scope).

**Invoices**: Invoice ID (`HYE-INV-YYMMDD-##` — top-level ID, same tier as PR/PO, NOT a child ID, since Invoice-PO is many-to-many), Vendor Invoice Code (human-entered), Vendor (link), Issue/Due Date, Amount Due, Shipping Fee, Paid(+Date) — lean, actual payment is external.

**Invoice–PO Link**: join table for the many-to-many. Primary field is plain autoNumber (pure relationship table, no readable label needed). Both link fields single-record — many-to-many achieved via multiple join rows.

**Invoice Items**: true child of Invoice. Invoice Item ID (`{Invoice ID}-{seq}`), Invoice + PO (links, single — each line reconciles against exactly one PO), Item Name, Qty, Unit Price, Amount (live formula), Variance Flag (checkbox, backend-set via reconciliation logic, not a formula).

**Addresses**: Address Label (primary, human-picked, NOT an auto-ID — readability matters for the link-picker), Line 1/2, City, State, Zip, Country, Formatted Address (formula). Linked from Jobs/Vendors, single-record enforced.

**Materials**: latest-price cache, upserted as PRs get signed. Natural key = Item Name + Size + Unit + Vendor (all four, not fewer). Unit Price, Latest Job/PO (links), Latest Date. NOT the source of price history (that's PR Items). No Currency field — USD only.

**Auth Tokens**: Token (primary, random hex string), Email, Expires At, Used, Created At. Single-use, 15-min TTL, backend-generated. Deliberately separate from Users (which is linked from most other tables in this base) — transient auth-flow data, not identity data.

---

## ID generation (`lib/ids.js`)

1. Top-level document IDs — PR ID / PO ID / Invoice ID: `HYE-PR-YYMMDD-##` / `HYE-PO-YYMMDD-##` / `HYE-INV-YYMMDD-##`, independent daily-reset counters, backend-generated. Invoice ID is here (not a child ID) specifically because Invoice-PO is many-to-many.
2. Child-table IDs (PR Item, PR Signer, Correction Request, Edit Log, PO Item, Quotation, Invoice Item): `{Parent ID}-{seq}`, resets per parent, backend-generated.
3. Vendor-issued codes (`Vendor Quotation Code`, `Vendor Invoice Code`): human-entered, not backend-generated, not guaranteed unique on their own — always scope lookups by Vendor too.

Naming: guaranteed-unique auto-generated fields -> `X ID`. Human-typed descriptive/picker text -> `X Label` or plain name (never converted to an auto-ID — e.g. `Address Label`, `Vendor Name`).

Date/time naming: calendar-only dates -> `X Date` (`Created Date`, `Issue Date`, `Paid Date`). Time-meaningful timestamps -> `X At` (`Signed At`, `Changed At`, `Created At`). Pick based on whether time-of-day actually matters for that field.

---

## Querying parent/child data — required pattern

`filterByFormula` cannot match a link field against a record ID (it evaluates to the linked record's display text instead). Required approach:

- Counting or listing a parent's children: read the parent's own reverse-link field via `.find(parentRecordId)`, never filter the child table. `parentRecord.get(parentLinkFieldName).length` for counts; `getLinkedRecords()` (`lib/airtable/client.js`) fetches each child by ID in parallel for listing. Reverse-link fields are core link data with no propagation lag — safe to trust immediately after a sibling record is created.
- Exception: `materials.js:getMaterialByKey`'s Vendor comparison uses a `Vendor Record ID` lookup field, since Materials' natural key doesn't map to any single parent's reverse-link array. Plain fields in that key (Item Name, Size, Unit) filter normally.

## Concurrency: `withKeyLock()`

`generateChildId` and `upsertMaterial` both read current state then write based on it — unsafe under genuinely concurrent calls (e.g. `Promise.all` targeting the same parent/key). Both are wrapped in `withKeyLock()` (`lib/airtable/client.js` — per-key promise chain, no external dependency), keyed on `{parentTableName}:{parentRecordId}:{parentLinkFieldName}` for IDs, and the normalized natural key (`LOWER(TRIM(...))` + Vendor record ID) for Materials. The entire read-then-write sequence must be inside the lock, not just the read step.

Known residual risks:
1. `withKeyLock` only serializes within one process/invocation, not across separate serverless invocations — two genuinely simultaneous requests touching the same key could still race. Judged low-probability given the signing chain already serializes who can act on a PR to one signer at a time.
2. Double-submit (double-click) is a separate, higher-probability risk not covered by the reasoning above — needs frontend handling (disable submit / `isSubmitting` guard on click) once PR/PO forms exist in Phase 1/2. Not a backend concern; track as a form-building checklist item.

---

## Auth (`lib/auth.js`, `lib/session.js`, `lib/email.js`)

Magic link only, not email/password — decided so verification (mandatory per the issue) and login are the same mechanism, and no password hash ever sits in Airtable (not a hardened secrets store; other staff have collaborator access to unrelated tables in this same base).

- `requestMagicLink(email)`: domain check (`ALLOWED_EMAIL_DOMAIN` env var) first, then issues a token and emails it. Does NOT create a Users record yet — that only happens in `verifyMagicLink`, once the token is actually confirmed, so an unconfirmed attempt never creates an orphaned Employee row.
- `verifyMagicLink(token)`: consumes the token, finds-or-creates the User, starts the session. The find-or-create is wrapped in `withKeyLock` keyed by normalized email — same duplicate-write race as `generateChildId`/`upsertMaterial`, same fix, since two valid tokens for one new email opened close together could otherwise both see "no user" and both create one.
- `lib/airtable/authTokens.js`: token CRUD against `Auth Tokens`. `consumeAuthToken` is wrapped in `withKeyLock` keyed by the token itself, so the same link can't be consumed twice by near-simultaneous requests.
- `lib/session.js`: `iron-session`, httpOnly/Secure/SameSite=Lax cookie. Payload is deliberately just `{ userId }` — Role/Is Admin/Status are never cached in the cookie, since promotion and deactivation (both manual Airtable edits) must take effect immediately, not whenever a long-lived session happens to expire. Route-protection logic (issue #4, not yet built) should use `getCurrentUser()` (below), not trust the cookie.
- `getCurrentUser()` (`lib/session.js`): resolves a session into the actual User, and is the required way to do so — never call `getUserByRecordId(session.userId)` directly. Airtable's `.find()` *rejects* for a record ID that no longer exists rather than returning null, so a session that outlives its Users record (deleted, or just stale test data) would otherwise crash the calling page instead of behaving like "not logged in." Found this the hard way: it crashed the home page with an Airtable `NOT_AUTHORIZED` error during testing. `getCurrentUser()` catches that and returns `null` — but only for that specific case. It checks `err.error === "NOT_AUTHORIZED"` (confirmed empirically to be exactly how Airtable reports a missing record, not a distinguishable 404) rather than a blanket catch-all; any other failure (bad API key, rate limiting, a real outage, network errors — confirmed distinguishable via `err.error === "AUTHENTICATION_REQUIRED"` etc.) is logged via `console.error` and re-thrown, so a real infrastructure problem surfaces as an error instead of silently masquerading as a logged-out user.
- `lib/email.js`: Resend. Its SDK returns `{ data, error }` instead of throwing on API failures (invalid key, unverified sending domain, etc.) — `sendMagicLinkEmail` explicitly checks `error` and throws; without that check a failed send silently looks like a success to the caller (confirmed while testing — this was a real bug, not a hypothetical). Re-verified against a real Resend account and a deliberately-wrong-but-real-shaped key, not just the empty-key case.
- Required env vars: `SESSION_SECRET`, `RESEND_API_KEY`, `ALLOWED_EMAIL_DOMAIN`, `EMAIL_FROM` (optional, has a fallback `from` address). All follow the same fail-fast-at-module-load pattern as `AIRTABLE_API_KEY` — a missing one breaks `next build` entirely, not just the requests that touch it. Same list needs setting in Vercel's project env vars before deploy — `.env.local` never ships.
- Verified end-to-end against a real Resend account and a real company inbox — request, email delivery, click-through verify, session, sign-out all confirmed working.
- Not built: rate-limiting on `requestMagicLink` (someone could spam a company email with sign-in links), role-based route protection (issue #4).

---

## Git workflow rules

- Never commit directly to `main`. One branch per issue: `{issue#}-{short-desc}`.
- Commit format: `{type}: {description} (#{issue#})` — types: `feat`/`fix`/`chore`/`refactor`.
- PR description must include `Closes #{issue#}`.
- Squash merge is configured on this repo — the PR description becomes the final commit message body on `main`, not the individual branch commits. Write PR descriptions with that in mind.
- Line-wrap by destination: commit message bodies and PR descriptions wrap at 72 chars; issue comments don't need wrapping.
- If an issue's core logic turns out to already be implemented as a byproduct of another issue's work, don't silently close it via a PR's `Closes #`. Comment on that issue first explaining what already covers it, then close it from there.
- GitHub Milestones = Phases (0–5), Issues = tasks within a phase.
- Stay scoped to the current issue's Milestone unless told otherwise.
- Don't open a PR unless explicitly asked to.
- Never run `git commit` yourself, even when asked to "finish" a task. Write the commit message to `commit-msg.txt` at the repo root (overwrite, don't append) instead; the user reviews the diff and commits manually. `commit-msg.txt` is gitignored — never remove that entry.

---

## Build phases

0. Foundations — Next.js scaffold, Airtable service layer, auth, ID generation (in progress)
1. PR creation + dynamic signing chain — first real milestone, replaces the email loop
2. PO generation — mostly plumbing given Airtable-side design already done
3. Invoice handling — many-to-many reconciliation, variance checking
4. Materials price history + reporting
5. Deferred: automated quotation/invoice parsing, real payment integration, formal rejection flow, multi-PIC vendors, backup president approver

## Open decisions (don't block Phase 0/1)

- Variance tolerance rule (exact vs. %) — blocks Phase 3
- Notification channel assumed email, not yet built — blocks Phase 1 completion
- Double-submit frontend guard — needed once PR/PO forms exist (Phase 1/2)