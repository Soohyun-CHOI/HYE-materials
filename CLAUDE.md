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

## Data model (18 tables)

**Users**: User Name (primary), Email, Phone, Role (`Employee`/`President`), Is Admin, Status (`Active`/`Inactive`), Created At, Assigned Jobs (link → Jobs, multiple, optional — the Job(s) this employee usually works). A person can be assigned to more than one Job, and the assignment can change, so this is a convenience default for narrowing pickers (see Phase 1 below), never an access-control restriction — an Employee is not blocked from picking a Job/Line outside their Assigned Jobs.

**Jobs**: Job Code (primary), Job Name, Business Unit, PIC/Manager (link → Users) + Phone/Email (Lookups), Delivery/Alternate Address (link → Addresses, single), Lines (reverse-link, children — see **Lines** below), Users (reverse-link of Users.Assigned Jobs, above).

**Lines**: child of Jobs — a Job can have multiple Lines (process/production lines within a site). Line Label (primary, formula = `{Job} – {Line Name}`, since Line Name alone isn't guaranteed unique across Jobs — e.g. more than one site uses plain "FAB"), Line Name (human-entered), Job (link → Jobs, single), Purchase Requests / Materials (reverse-links — see below).

**Vendors**: Vendor Name (primary), PIC Name/Phone/Email (plain text, external contact — not linked to Users), Address (link, single), Purchase Orders (Lookup via PR chain).

**Purchase Requests**: PR ID (`HYE-PR-YYMMDD-##`, backend-generated), Requester/Vendor (links, single), Line (link → Lines, single — the actual field a Requester picks), Job (Lookup via Line, read-only — auto-follows the picked Line, so a mismatched Job/Line pairing is structurally impossible), Created Date, Status (`Draft`/`In Review`/`Approved`/`Converted to PO` — no Rejected), Current Signer Step, Total Amount (rollup), Notes, Quotation File (Lookup).

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

**Materials**: latest-price cache, upserted as PRs get signed. Natural key = Item Name + Size + Unit + Vendor (all four, not fewer). Unit Price, Latest Line (link → Lines, single), Latest Job (Lookup via Latest Line, read-only — same auto-follow pattern as Purchase Requests.Job), Latest PO (link), Latest Date. NOT the source of price history (that's PR Items). No Currency field — USD only.

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
- `lib/session.js`: `iron-session`, httpOnly/Secure/SameSite=Lax cookie. Payload is deliberately just `{ userId }` — Role/Is Admin/Status are never cached in the cookie, since promotion and deactivation (both manual Airtable edits) must take effect immediately, not whenever a long-lived session happens to expire. Route-protection logic (`lib/authz.js`, below) uses `getCurrentUser()`, not the cookie.
- `getCurrentUser()` (`lib/session.js`): resolves a session into the actual User, and is the required way to do so — never call `getUserByRecordId(session.userId)` directly. Airtable's `.find()` *rejects* for a record ID that no longer exists rather than returning null, so a session that outlives its Users record (deleted, or just stale test data) would otherwise crash the calling page instead of behaving like "not logged in." Found this the hard way: it crashed the home page with an Airtable `NOT_AUTHORIZED` error during testing. `getCurrentUser()` catches that and returns `null` — but only for that specific case. It checks `err.error === "NOT_AUTHORIZED"` (confirmed empirically to be exactly how Airtable reports a missing record, not a distinguishable 404) rather than a blanket catch-all; any other failure (bad API key, rate limiting, a real outage, network errors — confirmed distinguishable via `err.error === "AUTHENTICATION_REQUIRED"` etc.) is logged via `console.error` and re-thrown, so a real infrastructure problem surfaces as an error instead of silently masquerading as a logged-out user.
- `lib/email.js`: Resend. Its SDK returns `{ data, error }` instead of throwing on API failures (invalid key, unverified sending domain, etc.) — `sendMagicLinkEmail` explicitly checks `error` and throws; without that check a failed send silently looks like a success to the caller (confirmed while testing — this was a real bug, not a hypothetical). Re-verified against a real Resend account and a deliberately-wrong-but-real-shaped key, not just the empty-key case.
- Required env vars: `SESSION_SECRET`, `RESEND_API_KEY`, `ALLOWED_EMAIL_DOMAIN`, `EMAIL_FROM` (optional, has a fallback `from` address). All follow the same fail-fast-at-module-load pattern as `AIRTABLE_API_KEY` — a missing one breaks `next build` entirely, not just the requests that touch it. Same list needs setting in Vercel's project env vars before deploy — `.env.local` never ships.
- Verified end-to-end against a real Resend account and a real company inbox — request, email delivery, click-through verify, session, sign-out all confirmed working.
- Not built: rate-limiting on `requestMagicLink` (someone could spam a company email with sign-in links).

---

## Route protection (`lib/authz.js`)

Built on `getCurrentUser()`, not the session cookie (see above). Only the reusable helpers exist so far — no Phase 1/2 pages exist yet to apply them to. Each future protected page/API route calls these directly; there is no centralized route table and no `proxy.js` (see below for why).

- `getActiveUser()`: like `getCurrentUser()`, except a `Status: Inactive` user is also treated as not logged in. Kept separate from `getCurrentUser()` on purpose — that function answers "does this session still resolve to a Users record" (and `app/page.js` uses it as-is, Inactive or not, just to show who's signed in); this answers "is that user allowed to be treated as logged in for authorization purposes." Deactivation (someone who left the company) must take effect immediately against an existing, still-valid session cookie, the same reasoning as why Role/Is Admin aren't cached in the cookie. Verified manually: flipping a test user's Status to Inactive mid-session, with no other change, turned their existing session into a redirect-to-`/login` on the next `requireUser()` call.
- `requireUser()`: for Server Components/Server Actions. Redirects to `/login` if not logged in (or Inactive); returns the user otherwise.
- `requireRole(role)`: calls `requireUser()` first (same redirect-to-`/login` behavior), then checks Role. Returns `{ user, authorized }` rather than redirecting on a role mismatch — the caller renders its own "no permission" UI, since the user's identity is real, they just lack this permission (different from "not logged in"). `role` accepts a single Role string or an array (`requireRole(["President", "Employee"])`) — array support from the start, so a route that later needs to allow more than one role doesn't need a signature change.
- `requireAdmin()`: same `{ user, authorized }` shape as `requireRole`, gates on `Is Admin`.
- Route Handlers (API routes) should NOT use these — `next/navigation`'s `redirect()` throws a digest error meant for the page-rendering pipeline, not a plain Request/Response function. Call `getActiveUser()` directly there instead and return a 401/403 JSON response, matching the existing pattern in `app/api/auth/request/route.js` (`NextResponse.json({ error }, { status })`).
- No `proxy.js` (Next 16 renamed `middleware.js` to `proxy.js`, and it now defaults to the Node.js runtime instead of Edge — worth knowing since a lot of Middleware-era guidance assumes Edge). Deliberately not adding one: since Role/Is Admin/Status can never be cached in the cookie, the only check a `proxy.js` could do cheaply (per Next's own guidance: avoid DB calls in Proxy, it runs on every request including prefetches) is "is there a session cookie at all" — which doesn't save anything over each page just calling `requireUser()` itself. Revisit only if Phase 1/2 accumulate enough protected pages that a first-line "must be logged in" gate becomes worth the added layer.
- Reference usage: `app/admin/jobs/new`, `app/admin/vendors/new`, `app/admin/lines/new` — minimal Admin-only forms wired straight to the existing `createJob`/`createVendor`/`createLine` (`lib/airtable/jobs.js`/`vendors.js`/`lines.js`), no new business logic. Each page pairs with an `actions.js` Server Action for the actual mutation; **the Server Action calls `requireAdmin()` again independently of the page**, since Server Actions are callable directly (e.g. via devtools) regardless of what the page rendered — a page-level check alone only gates the UI, not the mutation. `app/admin/lines/new` takes a Job Code text input rather than a Job picker/dropdown — it resolves the record via the existing `getJobByCode()` instead of adding a new "list all Jobs" function just for this form.

Phase 0's exit test ("create a Job, Vendor, and User record through the app, not directly in Airtable") is satisfied: Job/Vendor via the admin forms above, User via the existing magic-link signup flow (`createUser` in `lib/auth.js:verifyMagicLink`, already verified end-to-end). The exit test's "correctly formatted auto-generated IDs" clause doesn't apply to Job/Vendor specifically — `Job Code`/`Vendor Name` are deliberately human-entered, not backend-generated (see the ID-naming rule above); auto-generated-ID verification is what issue #3's PR/PO/Invoice ID test already covered.

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

0. Foundations — Next.js scaffold, Airtable service layer, auth, ID generation, role-based route protection (done)
1. PR creation + dynamic signing chain — first real milestone, replaces the email loop
2. PO generation — mostly plumbing given Airtable-side design already done
3. Invoice handling — many-to-many reconciliation, variance checking
4. Materials price history + reporting
5. Deferred: automated quotation/invoice parsing, real payment integration, formal rejection flow, multi-PIC vendors, backup president approver

### Phase 1 requirement: Line picker defaults to the Requester's Assigned Jobs (done — `app/prs/new`)

On the PR creation form, the field a Requester actually picks is Line (Job just follows via Lookup — see **Purchase Requests** above). Implemented as a two-step Job → Line picker rather than a single Line dropdown, since a UX pass on the issue decided Job-first reads more naturally for a field that's conceptually "pick the site, then the line within it": selecting a Job filters the Line `<select>` to that Job's Lines (client-side, against a Lines list already fetched once — no extra round trip). The logged-in Requester's `Users.Assigned Jobs`, if set, shapes the Job `<select>` via two `<optgroup>`s — "My Jobs" (Assigned Jobs, listed first) and "All Jobs"/"Jobs" (everything else) — never hiding options, just surfacing the common case first. Empty Assigned Jobs collapses to a single unlabeled "Jobs" group with the full list.

### PR creation (`app/prs/new`, issue #5)

- `app/prs/new/page.js` (Server Component, `requireUser()`-gated — any active Employee/President, not Admin-only): fetches Jobs/Lines/Vendors/active Users once and passes them to `PRForm.js`.
- `app/prs/new/PRForm.js` (Client Component): Job→Line cascading selects, Vendor select, Notes, and a repeatable Items list (`useState` array — `addItem`/`removeItem`/`updateItem`, one object per row) with a client-side Qty×Rate preview per row and a running total. That preview is informational only — the real `Amount` is Airtable's live formula (see **PR Items** above), never written by the client. Items and the signer order (below) are serialized to hidden `<input type="hidden">` JSON fields (`itemsJson`, `signerIdsJson`) so the whole form still submits as one Server Action call via plain `FormData`, matching the rest of the app's Server Action pattern rather than a bespoke fetch/API-route path.
- `app/prs/new/SignerList.js`: the ordered signer-assignment UI — pick a person from a dropdown to append them, drag rows (`@dnd-kit/core` + `@dnd-kit/sortable`) to reorder. Array order becomes `Sequence Order` on submit. Chosen over a plain "N dropdowns" layout since reordering people-you-just-picked is common when assembling a signing chain and drag is more direct than re-picking from N separate selects; chosen over building it from scratch since dnd-kit is the maintained modern option (react-beautiful-dnd is deprecated) and includes keyboard support.
- `app/prs/new/actions.js` (`createPRAction`, bound via `useActionState` like `app/admin/lines/new`): validates, then writes `PR → PR Items (sequential loop) → PR Signers (sequential loop, `Sequence Order` = array index + 1) → PR.Status/Current Signer Step`, in that order. Sequential (not `Promise.all`) so each `generateChildId` call sees the prior sibling already reflected in the parent's reverse-link count. Submission itself sets `Status: "In Review"` + `Current Signer Step: 1` — assigning the signer chain in the same step as creation means submitting **is** starting the review chain, not saving an inert Draft for a separate "submit for review" action later (that boundary intentionally sits with issue #6's signing state machine, not here).
- **Rollback on partial failure**: Airtable has no cross-table transactions. If any write fails after the PR record itself was created (e.g. the 3rd of 5 signers), everything created so far (Signers, then Items, then the PR) is deleted best-effort, in reverse order, before surfacing the error — so a failed submission leaves no trace instead of a confusing half-built PR. Verified manually by temporarily forcing a failure mid-chain and confirming Airtable was left clean.
- **Quotation file attachment: deferred, not in this form yet — split out to issue #34** (was part of #5's original scope; commented on #5 explaining the split rather than dropping it silently). Airtable's attachment field only accepts a fetchable URL, not a raw upload, so this needs its own file storage step first. Decided: **Vercel Blob** (`@vercel/blob`, client-side direct upload via `@vercel/blob/client` to stay under Server Action body-size limits, `access: "public"` since Airtable must be able to fetch the URL to copy it into its own attachment storage) — chosen over S3/R2 since the project already deploys to Vercel and this needs no new cloud account. In-app preview should use the Vercel Blob URL directly (stable, ours) rather than Airtable's returned attachment URL (known to not always stay valid long-term), with Airtable's copy kept as the durable record-side reference. Blocked on `BLOB_READ_WRITE_TOKEN` (Vercel dashboard → connect a Blob store to the project) not being set up yet.
- Prerequisite fixes made alongside this issue: `createPR()` (`lib/airtable/purchaseRequests.js`) still wrote directly to `Job` from an earlier, pre-Lines-table version — fixed to take `lineId` instead (`Job` is a read-only Lookup, per the Lines-table schema). `users.js`'s `recordToUser()` didn't expose `Assigned Jobs` at all — added, since the Job→Line default-sort above depends on it. Same "found while implementing the next issue" pattern as issue #29.
- New "list all" functions added (none existed before — every prior table file only had single-record lookups): `getAllJobs()`, `getAllLines()` (`lib/airtable/jobs.js`/`lines.js`), `getAllVendors()` (`vendors.js`), `getActiveUsers()` (`users.js`, Status-filtered only — both Employee and President can be signers, so not Role-filtered).
- **Gotcha found while building the PR detail page (issue #6):** `Purchase Requests.Job` is a Lookup through `Line`, but it looks up `Lines.Job` — itself a link field — so `pr.job` (via `getPRById`/`getPRByRecordId`) is a raw **Job record ID**, not display text. Resolve it against `getAllJobs()` (same pattern already used for `pr.vendor`/`pr.line` against `getAllVendors()`/`getAllLines()`) before rendering — don't assume a Lookup field is human-readable without checking what it's actually configured to surface.

### Signing state machine (`app/prs/[prId]`, `lib/prSigning.js`, issue #6)

Picks up exactly where `app/prs/new` leaves off: a PR already starts `In Review` at `Current Signer Step: 1`, so this is purely "the current signer takes one of three actions." All the Airtable read/write functions this needed (`updateSigner`, `updatePR`, `updateItem`, `createEditLogEntry`, `createCorrectionRequest`/`resolveCorrectionRequest`) already existed from earlier phases — nothing to fix at that layer this time, unlike issues #3/#5/#29.

- **`Current Signer Step` sentinel**: `1..N` is a PR Signer's `Sequence Order`; `0` means "the Requester's turn." Nothing sets it to `0` except a signer returning a PR for correction and targeting the Requester (who isn't necessarily one of the PR Signers at all — the return-for-correction target list is Requester-or-earlier-signer, not just earlier-signers). Whenever the step is `0`, there is always exactly one `Pending` Correction Request with `Sent To` = the Requester — `lib/prSigning.js:computeAdvance()` relies on that invariant rather than special-casing the Requester.
- **Three actions, one screen**: `app/prs/[prId]/page.js` shows the PR (read-only) plus, only to whoever's actual turn it is (`lib/prSigning.js:getCurrentTurn()`, cross-checked against the logged-in user), three entry-point buttons that each reveal their own inline sub-form (`SigningPanel.js` — progressive disclosure, not separate pages). On the Requester's turn (step `0`), only **Edit and continue** is offered — Approve/Return for correction aren't meaningful for the person who authored the PR (nobody earlier to return to, and "approving your own PR" isn't a real decision point).
- **Return for correction**: target picker defaults to the Requester (product decision — by far the most common case), with a dropdown covering "any earlier signer, including themselves" (`getReturnTargets()`: Requester + signers with `Sequence Order <=` the current signer's own). Recorded as a `Correction Requests` row (`Initiated By`/`Sent To`/`Notes`) plus the current signer's own `PR Signers.Status → "Returned"` (not `Signed At` — they delegated, they didn't sign) plus `PR.Current Signer Step` jumping straight to the target's step. The initiator is always a PR Signer, never the Requester (Requester's turn only allows editing, not returning) — `computeAdvance()` depends on that too.
- **Resume, not restart**: no new field was added to track "where a return paused" — it's derived from the existing `Correction Requests` table. Resolving a turn (Approve or Edit and continue) looks for a `Pending` Correction Request whose `Sent To` matches whoever's acting (`findPendingCorrectionForActor()`, matched by person rather than "the most recent one," since returns can nest — a return can itself be returned further before the first one resolves, leaving more than one `Pending` Correction Request on the same PR at once); if found, it's marked `Resolved` and `Current Signer Step` jumps back to the *initiator's* own step (not the next sequential signer) — and that initiator's `PR Signers.Status` is reset from `Returned` back to `Pending` so the UI shows them as actionable again. If no matching correction is pending, it's a normal forward advance to the next `Sequence Order`, or `PR.Status → "Approved"` if that was the last signer.
- **Edit and continue**: inline-editable Items table, diffed server-side against what's actually on record (not trusted from the client) — one `Edit Log` entry per **changed field** (matching its per-field granularity), one `updateItem()` per touched item (batching its changed fields into a single write). CLAUDE.md's "editing doesn't invalidate earlier approvals" rule needs no special enforcement: earlier signers' `PR Signers` records are never touched by this action, so their `Status`/`Signed At` simply stay whatever they were.
- **Rollback**: extends #5's create-then-delete pattern to cover **updates** too, since most of what these three actions do is mutate existing records rather than create new ones — each action snapshots the specific fields it's about to change before writing, and on any failure restores those exact snapshots (Airtable field-clear uses `null`, not `""`, for date fields — passing `""` to a `dateTime` field errors). `finishTurn()` (shared by Approve and Edit-and-continue) internally rolls back its own Correction-Request-resolve + resumed-signer-reset + PR update on failure, so the caller only has to revert what it wrote before calling it.
- Both the page (which actions render) and every Server Action (`approveAction`/`editAndContinueAction`/`returnForCorrectionAction`) independently recompute `getCurrentTurn()` and check it against `requireUser()`'s result — same "page check is UX only, the mutation re-checks for real" principle as the Admin forms' `requireAdmin()`.
- Verified end-to-end against the real Airtable base and a real browser session, including the full pause/resume path (signer 1 returns to the Requester → Requester edits a Qty → resumes to signer 1, whose status resets from `Returned` to `Pending` → signers 1, 2, 3 approve in order → `PR.Status: "Approved"`) and a forced-failure rollback test on Approve. The "not your turn" guard was later re-verified directly against the Server Actions themselves (not just the UI) — see below.
- **"Not your turn" guard, verified as a real security boundary, not just a UI convenience**: called `approveAction`/`editAndContinueAction`/`returnForCorrectionAction` directly (a temporary debug route invoking them the same way Next's Server Action RPC dispatch eventually would, bypassing `app/prs/[prId]`'s UI entirely) while logged in as a non-current signer — all three rejected with `"It's not your turn to act on this PR."` A same-request call as the actual current signer succeeded, confirming the harness itself wasn't just always blocking. Also reproduced a nested return-for-correction chain end to end (signer 3 → signer 2, then — before resolving — signer 2 → signer 1, both `Pending` simultaneously) and confirmed `findPendingCorrectionForActor()` matches and resolves them in the correct order (innermost first), resuming each initiator correctly.

### Notifications (`lib/notifications.js`, `lib/email.js`, issue #8)

"Next signer needs to be told it's their turn" — hooks into the same 4 places `Current Signer Step` (or `PR.Status`) changes, rather than a separate screen/queue:

- `app/prs/new/actions.js:createPRAction` — notifies Signer 1 right after a PR is created.
- `app/prs/[prId]/actions.js:approveAction` / `editAndContinueAction` — notify whoever `finishTurn()`'s returned `nextStep` now points to (via `getCurrentTurn()` again, reusing the pure function rather than re-deriving "who's next"). Skipped when `prApproved` is true — **no notification on final approval**, by product decision; the issue only asks for "next signer," not a completion notice.
- `app/prs/[prId]/actions.js:returnForCorrectionAction` — notifies the return target, with `context` set to the correction reason so the email explains why.
- `notifyCurrentTurn()` is called only *after* the triggering action's Airtable writes have already committed (never inside the rollback-guarded `try` block) — there's no point notifying about a state change that might still get rolled back, and conversely a failed notification must never cause a rollback of an already-correct state change.
- **Never blocks or rolls back the action that triggered it** — wrapped in its own try/catch, logs via `console.error`, swallows the error. Confirmed for real: Resend's account here is still in test/sandbox mode (no verified sending domain), so it can only actually deliver to the account owner's own address — every notification aimed at any other recipient during testing genuinely failed with a real Resend API error, and every one of those PR actions still completed successfully and redirected normally.
- `lib/email.js:sendSignerTurnEmail()` follows the exact same pattern as `sendMagicLinkEmail` (explicit `{ error }` check + throw, since Resend's SDK doesn't reject on API failures) — it's `notifyCurrentTurn()` in `lib/notifications.js` that decides to swallow that throw, not `sendSignerTurnEmail` itself.
- Link building: Server Actions don't get a request URL the way Route Handlers do, so the base URL is derived from `headers().get("host")` (`next/headers`) — `http://` for `localhost`/`127.0.0.1`, `https://` otherwise.
- **Real operational gotcha, confirmed while testing**: this Resend account can currently only deliver to its own verified address — sending to a genuinely different real inbox worked once that recipient's email was corrected to the verified address, but every other recipient failed with `"You can only send testing emails to your own email address..."`. Verifying a sending domain is required before this reaches real signers other than the account owner. Not a code gap — a one-time dashboard/DNS task, detailed below so it doesn't need re-researching at deploy time.

#### Deploy-readiness task: verify a Resend sending domain

Confirmed against Resend's own docs (resend.com/docs/dashboard/domains) — do this once, before Phase 1 actually reaches real users:

1. **Resend dashboard → Domains → Add Domain.** Enter the domain to send from.
   - **Use a subdomain, not the root `hyeusa.com`** (e.g. `mail.hyeusa.com` or `notifications.hyeusa.com`) — the root domain almost certainly already has MX records for the company's real inbound email, and Resend's own MX record would conflict with those. A subdomain isolates sending reputation from the main domain entirely and sidesteps that conflict.
   - Pick a region when prompted — **this is immutable once the domain is created**; the only fix for a wrong region later is deleting and recreating the domain (redoing DNS).
2. Resend generates the DNS records to add — for a new domain this is typically **3 required records**:
   - **MX** — region-specific value (looks like `feedback-smtp.{region}.amazonses.com`), priority `10`. Routes bounce/complaint feedback back to Resend.
   - **TXT** (SPF) — lists the IP ranges allowed to send as this domain.
   - **TXT or CNAME** (DKIM) — public key Resend uses to sign outgoing mail; hosted at `resend._domainkey.<the subdomain>`, not at the bare domain.
   - Optionally a 4th **TXT (DMARC)** record — not required by Resend to reach "Verified," but improves deliverability/anti-spoofing; worth adding at the same time since it's the same DNS access.
3. **Add the exact records Resend shows** (name/host, type, value — copy verbatim) at whatever DNS provider actually manages `hyeusa.com`'s DNS. Common mistakes to avoid:
   - Adding them to the root domain instead of the subdomain used in step 1.
   - If the DNS provider is Cloudflare: leave these records **DNS-only / grey cloud**, not proxied (orange cloud) — a proxied record won't verify.
   - Some registrars auto-append the domain to whatever you type in the "Name/Host" field — if a record ends up looking like `resend._domainkey.mail.hyeusa.com.hyeusa.com`, that's the cause; enter just the subdomain portion or add a trailing dot per that provider's convention.
4. Back in the Resend dashboard, click **Verify DNS Records**. Propagation is usually minutes but can take hours; Resend keeps rechecking automatically for **up to 72 hours** before marking it `failed`. Status progression: `not_started` → `pending` → `verified` (or `failed`/`partially_verified`).
   - Can also be checked directly, without waiting on the dashboard: `dig TXT <subdomain> +short`, `dig MX <subdomain> +short`, `dig CNAME resend._domainkey.<subdomain> +short`.
5. Once `verified`, update `EMAIL_FROM` (already a recognized env var — see the Auth section above) from the current fallback `onboarding@resend.dev` to an address on the newly verified (sub)domain, e.g. `Material PO Automation <notifications@mail.hyeusa.com>`. Set it in both `.env.local` and Vercel's project env vars, same as every other required env var in this project.

### Approval history view (`app/prs/[prId]/page.js`, issue #9)

Purely a presentation task, not a new-logic one — `getCorrectionRequestsByPR()` and `getEditLogByPR()` (`lib/airtable/correctionRequests.js`/`editLog.js`) already existed and were already exercised by #6/#8, just never rendered anywhere. No writes, so #5/#6's rollback pattern doesn't apply here — nothing to roll back on a page that only reads.

- Rendered as **one merged, chronologically-sorted timeline** on the existing PR detail page (not a separate route/tab) — a product decision, since three separate lists (signers/corrections/edits) would force the reader to cross-reference timestamps by hand to reconstruct what actually happened and in what order.
- Sources merged: PR creation (`Created Date` + Requester), each `PR Signers.Signed At` (labeled "approved" or "edited and continued" based on `Status`), each `Correction Requests` row (`Requested At` for the return, plus a synthesized "resolved" entry at `Resolved At`), each `Edit Log` entry (`Changed At`, field, old→new).
- **"Resolved by" isn't a stored field** on Correction Requests (only `Resolved At` is) — inferred as the `Sent To` person instead, since resolving a correction only ever happens as a side effect of that person's own turn (see `lib/prSigning.js:findPendingCorrectionForActor`). No new field/data needed.
- **Gotcha found while building this**: `Created Date` is calendar-only (no time-of-day — see the ID-generation section's date/time naming rule), but `new Date("YYYY-MM-DD")` parses as UTC midnight; converting that straight to a browser's local timezone for display can shift it to the *previous* day (reproduced: showed "7/9" for a PR actually created "7/10"). Fixed by building the `Date` from its `(year, month, day)` components directly (`formatDateOnly()`) instead of round-tripping through UTC — every other timeline entry is a real timestamp (`Signed At`/`Requested At`/`Changed At`) and doesn't have this problem, only the one calendar-only field does.
- No new auth: the PR detail page already required only `requireUser()` (any active Employee/President, not restricted to participants) — History is additive content on that same already-open page, not a new access surface.
- Verified end-to-end against the real Airtable base, satisfying Phase 1's exit test directly: created a PR, routed it through a 2-signer chain with one correction round-trip (signer 1 → Requester, Requester edited a Qty, resumed to signer 1), reached `Approved` — and confirmed History rendered all six events (create, return, edit, resolve, two approvals) in the correct chronological order with the date-shift bug fixed.

## Open decisions (don't block Phase 0/1)

- Variance tolerance rule (exact vs. %) — blocks Phase 3
- Notification channel: confirmed as email and built (issue #8) — but Resend's sending domain isn't verified yet, so it currently only delivers to the Resend account owner's own address. See "Deploy-readiness task: verify a Resend sending domain" above for the exact steps.
- Double-submit frontend guard — done for `app/prs/new` (submit button disabled while `useActionState`'s `pending` is true); still needed once PO forms exist (Phase 2)
- Quotation file upload on the PR creation form (issue #34) — blocked on `BLOB_READ_WRITE_TOKEN` (Vercel Blob) being set up; see `app/prs/new` above