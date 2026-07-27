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
- lib/poWithdraw.js — the PO-withdrawal concern in one module (#138): the eligibility predicate, both voices of its user-facing copy, and the guarded write. New call sites import from here rather than re-deriving the rule or re-wording the copy.
- lib/blobIngest.js — confirm-then-delete for uploaded files (#140), plus `isOurBlobUrl`. Every upload path imports `confirmIngestThenDelete` instead of restating the sequence. See "File uploads" below.
- AIRTABLE_API_KEY server-side only, never in the client bundle.
- app/components/modalStyles.js — MODAL_BACKDROP / MODAL_CARD, the single source for modal backdrop/card styling. New modals must consume these rather than inlining the strings (width stays per-call-site: append max-w-md, or max-w-lg for wider dialogs).

---

## Data model (19 tables)

**Users**: User Name (primary), Email, Phone, Role (Employee/President), Is Admin, Status (Active/Inactive), Created At, Assigned Jobs (link -> Jobs, multiple, optional).

**Jobs**: Job Code (primary), Job Name, Business Unit, PIC/Manager (link -> Users) + Phone/Email (Lookups), Delivery/Alternate Address (link -> Addresses, single), Lines/Users (reverse-links).

**Lines**: child of Jobs. Line Label (primary, formula = {Job} - {Line Name}), Line Name (human-entered), Job (link, single).

**Vendors**: Vendor Name (primary), PIC Name/Phone/Email (plain text, external), Address (link, single), Purchase Orders (Lookup via PR chain).

**Purchase Requests**: PR ID (HYE-PR-YYMMDD-##), Requester/Vendor (links, single), Line (link, single), Job (Lookup via Line, read-only), Created At (datetime, UTC — timestamped per the *At convention; migrated from date-only Created Date in #105), Status (Draft/In Review/Approved/PO Signed/Withdrawn; PO Signed fires when President signs the generated PO), Withdrawn At (datetime, UTC, *At convention — stamped only when withdrawn, #122), Current Signer Step, Items Subtotal (rollup, PR Items only), Shipping Fee (optional currency; fixed once set, changeable only via Edit and continue), Total Amount (formula = Items Subtotal + Shipping Fee, blank = 0), Notes, Quotation Files (Lookup, plural).
- **Withdrawn (#122)** is the documented exception to the "no Rejected status" posture: it's the Requester's own *self-retraction* of a submitted PR (circumstances changed / submitted in error), NOT a signer's rejection — signers keep Return for correction. It's a state transition (not a delete — contrast Draft delete): the PR, signer chain, correction history, and Edit Log all stay on record. Requester-only, allowed **only from In Review** this pass, terminal (no revive — re-request = a new PR). The Status flip is the single lever needed (every actionable path is gated behind In Review); Pending signers / open Correction Requests / Current Signer Step are left untouched to preserve the audit trail, and the signer progress bar drops correction arcs off-In-Review so a withdrawn PR reads as ended. `getSubmittedPRs` returns Withdrawn PRs (they aren't Drafts) so they stay visible/filterable in the #119 list. PR withdrawal stays **In Review-only**, and there is no plan to extend it to Approved: once a PR is approved its PO exists, and "we're not ordering after all" is a decision about the *order*, so it's expressed as the PO's own terminal `Withdrawn` (#138, see Purchase Orders below) — an Approved PR really was approved and its signer chain records that. The PR-status check that was once wanted in `signPOAction` therefore no longer applies rather than being satisfied: the guard added in #138 checks **PO** status, and since a PR is never withdrawn past In Review, an Approved PR's PO can't be signed out from under a withdrawn PR.

**PR Signers** — dynamic ordered approval chain:
- Requester assigns an ordered signer list at creation, each tagged Confirmation Type (Approval/Agreement) — label only, same underlying action.
- Each turn: Approve/Agree, Edit and continue, or Return for correction (to any earlier signer/requester/self — pauses/resumes, never restarts; nested corrections are a LIFO stack, each resolve unwinds one level).
- Editing after signing does NOT invalidate approval.
- Fields: PR Signer ID, PR/Signer (link, single), Sequence Order, Status (Pending/Approved/Edited/Returned), Confirmation Type, Signed At, Notes (no input on plain Approve/Agree; Edit and continue/Return still collect it).
- PR detail page: linear progress bar (`lib/prSigning.js:getSignerChainProgress` + `app/prs/[prId]/SignerProgressBar.js`), current state only. Paused (passed through, pushed back by correction) shares neutral color with not-yet-reached, dashed border only. Correction Requests.Sent To stores only a user id (ambiguous if Requester = a Signer); progress bar defaults to signer interpretation — doesn't affect the actual state machine (uses Current Signer Step).

**PR Items**: PR Item ID, PR (link), Item Name, Size, Unit (single select, canonical list — see Units), Qty, Unit Price, Amount = live formula, Remark (free text only), Quotation (link, single -> Quotations — auto-linked when only one exists, dropdown once 2+, never silently reassigned).

**Correction Requests**: Correction Request ID, PR, Initiated By, Sent To, Notes, Requested At, Resolved At, Status (Pending/Resolved).

**Edit Log**: Edit Log ID, PR, Changed By, Field Name (select — item fields, Shipping Fee, Unit Price), Old Value, New Value, Changed At, Notes (optional).

**Purchase Orders**: strict 1:1 with PR. PO ID (HYE-PO-YYYYMMDD-## — 4-digit year, the one exception to the 2-digit convention), PR (link), Vendor (Lookup via PR), Quotation File (Lookup), Our PIC/Manager (links), Created Date, President Signed(+At), Status (Awaiting Signature/Signed/Sent to Vendor/Withdrawn), Withdrawn At (datetime, UTC, *At convention — stamped in the same write as Status -> Withdrawn, #138), PO PDF File, Items Subtotal (rollup, PO Items only), Shipping Fee (plain currency, frozen copy from PR at PO-generation time), Total Amount (formula = Items Subtotal + Shipping Fee, blank = 0 — PO PDF's TOTAL line), Delivery Address Used (Primary/Alternate — internal only).

- **Withdrawn (#138)** is the PO-side counterpart to PR Withdrawn: the requester decided not to order after all. Set by the **parent PR's Requester** (a PO carries no requester of its own, and needs none — nor an actor field on the withdrawal), confirmation modal, no reason capture, terminal (no revive). Eligibility is ONE shared predicate, `lib/poWithdraw.js:getPOWithdrawEligibility` — Status in {Awaiting Signature, Signed} AND no linked invoice (Invoice-PO Link join rows; the Invoice Items reverse-link is a safety net for a row stranded by a best-effort rollback). Status is tested first on purpose: a `Sent to Vendor` PO with invoices must not be told to ask an Admin to unlink, since that wouldn't help. `Sent to Vendor` is out of reach (the order has gone out — cancelling involves the vendor; no in-app path, see follow-ups). A linked invoice is evidence the order did go out, so the UI *explains* that an Admin has to unlink first rather than disabling the control. Modal copy (second person, to the actor) and page-banner copy (third person, to any viewer) sit as one pair in that same module and branch on the single condition `President Signed`. Terminal is enforced, not just labelled: `signPOAction` refuses a Withdrawn PO (without it, signing would write Status back to Signed and `syncPRStatusToPOSigned` would advance the PR), `regeneratePDFAction` refuses it — the PO PDF is the document sent to the vendor, so the line is "no new documents, existing document preserved": an already-generated PDF stays downloadable as audit trail — and `createInvoiceAction` refuses to link an invoice to one. A Withdrawn PO drops out of `getAllPOs`/`searchPOs` (the invoice picker and /api/pos/search) and out of `/api/invoices/detect-po`'s candidates, where it is reported in its own `withdrawn` bucket instead: a vendor invoice quoting a withdrawn PO number means the vendor shipped anyway or the withdrawal was a mistake, which is the only place that contradiction surfaces, so it must never read as a failed detection. Partial closure of a partly invoiced PO is out of scope (there the order went out and was partly fulfilled — a different thing).

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

## File uploads (Vercel Blob -> Airtable)

Every file — quotation files, invoice files, generated PO PDFs — is written to Vercel Blob first and then handed to Airtable as an attachment URL, which Airtable fetches to keep its own copy. **Airtable's copy is the copy of record**; the Blob object exists only so Airtable has something to fetch. Four write paths, one lifecycle (#140):

| Path | Blob write | Ingested by | Cleanup runs in |
|---|---|---|---|
| Quotation file, PR form | client `upload()` (PRForm.js) | `createQuotation` in `persistPRFromForm` | `saveDraftAction` / `createPRAction`, after their last write |
| Quotation file, Edit and continue | client `upload()` (EditAndContinueForm.js) | `createQuotation` | `editAndContinueAction`, right after its try/catch |
| Invoice file | client `upload()` (InvoiceForm.js) | `createInvoice` | `createInvoiceAction`, after the last write |
| PO PDF | server `put()` (lib/poPdf.js) | `updatePO` | `generateAndAttachPOPdf` itself |

- `lib/blobIngest.js:confirmIngestThenDelete` owns the sequence. Call sites pass `{ table, recordId, field, blobUrl }` and never restate it.
- **Cleanup runs at the END of the enclosing action, never straight after the attachment write.** All four actions roll their writes back on failure, and the user's retry re-submits the same Blob URL from the still-open form — deleting at ingest time would charge the user for a failure they didn't cause. The rule is "no Blob object outlives its ingest *and the action that ingested it*".
- **Confirmation signal**: the attachment no longer carries the URL we submitted (Airtable replaces it with its own). Deliberately not Airtable's CDN hostname (versioned) and not a populated `size`. An empty field counts as NOT ingested: an attachment write pointing at a URL Airtable can't fetch **returns success and silently leaves the field empty** (measured — a write against a deleted object was still empty 30s later).
- Observed ingest latency on this base: 825/890/913/959/943 ms (5 samples). Hence poll every 300 ms (stays inside Airtable's ~5 req/s per-base budget, ~3 polls to confirm) with a 10 s ceiling (~10x the slowest observed, so it fires on breakage rather than slowness). Targets are confirmed one at a time, so a multi-quotation PR pays ~1 s per file at the end of the action.
- **Timeout keeps the object** and logs it: a late ingest must not find a deleted URL. One orphan beats an empty attachment. Only the PO PDF path offers a user-facing retry for the not-confirmed case (`Regenerate PDF`) — the other paths have no regeneration path to offer, so they just log.
- On a *failed* attachment write the object is deleted immediately (no ingest can follow) — the two failure directions are opposite, see `generateAndAttachPOPdf`.
- Cleanup is **best-effort**: a failed `del()` is logged and nothing more, since Airtable already holds the file and failing the user's action over housekeeping would be backwards. So an orphan is still possible; this is a convention, not an absolute invariant.
- **The one orphan source that survives by design**: a file uploaded and then abandoned (form closed before submit). It was never ingested, so it has no ingest to outlive, there is no record to hang cleanup on, and finding it needs the store sweep #140 excludes.
- Airtable's own attachment URLs are short-lived signed URLs (**~2h**, confirmed empirically), so nothing durable may store one — re-read the record instead. Every in-app link (PR detail Quotations, invoice detail, PO PDF) renders Airtable's URL and can go stale on a page held open past that window; `lib/prDraft.js` carries the same caveat for a re-opened Draft. **No table holds a Blob URL or pathname in a sibling field** — the attachment field is the only record of the file, which is what makes delete-at-ingest safe.
- `Purchase Orders."Quotation File"` is a Lookup chain (PR -> Purchase Requests."Quotation Files" -> Quotations.File) exposing attachment objects on the PO. Mapped in `recordToPO`, read by nothing — not a dependency.

---

## Auth (lib/auth.js, lib/session.js, lib/email.js, lib/authz.js)

- Magic link only. requestMagicLink() domain-checks then emails a token; verifyMagicLink() consumes it (withKeyLock-protected), finds-or-creates the User.
- lib/session.js: iron-session, payload `{ userId }`. getCurrentUser() treats a missing Users record as logged-out, re-throws real Airtable errors.
- getActiveUser() (lib/authz.js) also treats Status: Inactive as logged-out.
- requireUser()/requireRole(role)/requireAdmin()/requirePresident(): Server Component/Action helpers. Failure modes differ: all four redirect to /login on no session; on insufficient permission requireRole/requireAdmin return `{ authorized: false }` (caller renders inline), while requirePresident() throws (its PO-signing callers have no per-branch UI). Route Handlers can't use these (redirect() is for the page-render pipeline) — they call getActiveUser() (any active user) or requireAdminApi() (Admin-only), which return the user or a 401/403 JSON Response.
- No proxy.js/middleware — each page's own requireUser() call is the gate.
- Env vars: SESSION_SECRET, RESEND_API_KEY, ALLOWED_EMAIL_DOMAIN, EMAIL_FROM (optional). Fail-fast at module load; set in Vercel too.
- Resend still sandbox mode — can only deliver to the account owner's address. Domain verification needed before real multi-user use.
- Not built: rate-limiting on requestMagicLink.

---

## Route protection (lib/authz.js)

**Operating convention:** office staff run with Is Admin: true; a non-Admin Employee is site staff. So gating an endpoint to Admin scopes it to the office, not merely to a higher privilege tier — e.g. the invoice routes are Admin because invoicing is office work, not because Admin is "more trusted."

app/admin/jobs|vendors|lines/new — Admin-only, Server Action re-checks requireAdmin(). app/prs (list) + app/prs/[prId] (detail) — any active user; the list applies a server-side row-visibility gate (President/Admin see all submitted PRs, an Employee sees only PRs they raised or on their assigned Jobs, #119). app/pos/[poId], app/invoices (list), and app/invoices/[invoiceId] (detail) — viewing is President-or-Admin. app/invoices/[invoiceId]/edit and the invoice edit/delete/Paid-toggle Server Actions — Admin-only.

**Caller obligation:** requireRole()/requireAdmin() only *report* the decision — a caller must destructure the returned `{ authorized }` and short-circuit on false (throw, return `{ error }`, or render a refusal). Calling one without acting on the flag protects nothing (the code runs on). requirePresident() (throws) and requireAdminApi() (returns a 401/403 Response the handler returns as-is) can't be dropped this way, which is why they're preferred for the cases that use them.

**Re-authorization rule (#134):** every directly-callable endpoint re-authorizes to the level of the strictest page that renders its UI — a page being the only caller isn't a substitute, since Route Handlers and Server Actions are reachable directly. Server Actions reuse the helpers above (signPOAction/regeneratePDFAction call requirePresident(); generatePOAction, the PO-generation retry, is Admin via requireAdmin() with a matching isAdmin render gate on app/prs/[prId]). withdrawPOAction (#138) is the per-record variant: requireUser() only settles "is this an active session", and the actual authorization is an ownership comparison against the parent PR's Requester inside lib/poWithdraw.js — no role helper fits, since the requester is typically neither President nor Admin. `/api/*`: the magic-link auth routes are intentionally public, /api/quotations/upload is any-active-user (matching the PR form that consumes it); /api/invoices/upload, /api/invoices/detect-po, /api/pos/search, /api/pos/[poRecordId]/items are Admin-only via requireAdminApi() (their sole consumer is the Admin-only invoice form). Any route that fetches a caller-supplied URL also restricts it to our Vercel Blob host (detect-po's SSRF guard), independent of auth.

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

The PR → PO → Invoice lifecycle across Phases 0–3 and the PR Draft Support milestone has been implemented and merged. Not yet started: Phase 4 (materials reporting), the AI invoice-parsing milestone (Phase 5), three standalone enhancements, and the follow-ups tracked below. "Merged" here means the work is on `main`, not that an area is closed to further change — follow-up issues may still touch any of it.

**Merged — Phase 0 (Foundations):** Airtable service layer, ID generation, magic-link auth (company-domain), role/admin route protection, admin create-forms for Jobs/Vendors/Lines. The Line form's Job field is a searchable combobox over existing Jobs (#30, `app/admin/lines/new/JobCombobox.js`).

**Merged — Phase 1 (PR creation + dynamic signing chain):** PR creation form (Job→Line picker, items, quotation file uploads, ordered signer chain with Approval/Agreement tags, optional shipping fee); signing state machine — approve / edit-and-continue / return-for-correction with a LIFO correction stack (`lib/prSigning.js`, `app/prs/[prId]/actions.js`); Edit Log; chronological approval history + linear signer progress bar (#81); next-signer email; duplicate-PR warning (#61); role-scoped PR list (#119) + detail page; requester withdraw, In Review only (#122).

**Merged — Phase 2 (PO generation):** auto-generated on full PR approval as a frozen PO Items snapshot (`lib/poGeneration.js`), President signing, PO PDF (`lib/poPdf.js`), Primary/Alternate delivery-address selection; requester withdrawal of a PO from Awaiting Signature or Signed, terminal, invoice-free only (#138, `lib/poWithdraw.js`).

**Merged — Phase 3 (Invoice handling):** manual invoice entry with PDF upload + PO auto-detect (#46/#92), Invoice Items linked to a specific PO Item (#51), variance checking (line + header, % tolerance, `lib/variance.js`), un-invoiced PO-item tracking (#48), payment tracking, invoice list/detail/edit/delete (#115/#117).

**Merged — PR Draft Support (milestone):** save-as-draft, resume-prompt on re-entry, drafts list (open/delete). Save and submit share `persistPRFromForm` (`app/prs/new/actions.js`); submit promotes the same Draft record to In Review (PR ID/Created At/history continuous); `lib/prDraft.js:loadPRDraft(prId)` hydrates the form. After a successful save the form shows a confirm modal and leaves to the PR list (#124).

**App surface (routes):** `/`, `/login`; `/prs` (list), `/prs/new`, `/prs/[prId]`; `/pos/[poId]`; `/invoices` (list), `/invoices/new`, `/invoices/[invoiceId]`, `/invoices/[invoiceId]/edit`; `/admin/{jobs,lines,vendors}/new`. API route handlers under `/api/*` (auth, quotation/invoice uploads, PO search + items, invoice PO-detect).

**Not yet started:**
- **Phase 4 — Materials price history + reporting**: #18 materials cache upsert (natural-key latest price), #19 price search view, #20 materials order log.
- **Phase 5 — AI-assisted invoice PDF line-item parsing**: #52 extract candidate line items (Qty/Price/Amount) from invoice PDF text, #53 LLM match of extracted lines to PO Items, #54 confirm screen for auto-parsed data.
- **Standalone enhancements** (no milestone): #32 job-based signer suggestions in the PR form, #33 saved signer-chain templates (personal/shared approval lines), #40 PO PDF — merge image-format Quotation files as an appendix.
- **Withdraw follow-ups (#122 + #138).** Extending PR withdraw to **Approved** is *not* one of them — that need is met by the PO's own terminal Withdrawn (#138); see the Purchase Requests note above for why the object is the PO and why the once-wanted PR-status check in `signPOAction` no longer applies. What remains:
  - **Withdrawal notifications** — no email is sent on withdrawal today, and none is written yet: this belongs to the broader notification pass over state transitions, still blocked on Resend leaving sandbox mode + domain verification. Planning note, not a description of existing code: the recipient splits two ways, and one line for it would be too narrow. A PO withdrawn from **Awaiting Signature** cancels a task the President is actively holding, so the President belongs in that branch; withdrawal from **Signed** cancels nothing pending and is office-facing (invoice reconciliation is who needs to know). PR withdraw's own case is separate again — the mid-chain signers.
  - **Cancelling after `Sent to Vendor`** — deliberately no in-app path, and none planned here. The expected handling is a vendor conversation plus manual Airtable correction; what comes back is a credit memo or a corrected invoice, which makes it invoice-side work. The app says nothing about it (the withdraw control is simply absent at that status): promising a process that doesn't exist would be worse than silence. This attaches to `Sent to Vendor` modelling generally — itself only a CLAUDE.md note at this point, with no issue open for it.
- **Upload follow-ups (#140).** The Blob lifecycle itself is covered by the "File uploads" section above — these are the two things #140 deliberately left out, plus the objects predating it:
  - **Expired-Airtable-URL re-save** (live, not latent): re-opening a Draft and saving it more than ~2h later re-submits Airtable's expired attachment URL through `createQuotation`, because `persistPRFromForm` regenerates every Quotations record from form state (`lib/prDraft.js` hydrates `url` from Airtable). The write returns success and the attachment lands **empty** — same silent-drop behaviour measured for #140. This is an Airtable-URL lifetime problem, not a Blob one, and the fix is different in kind: leave unchanged attachments alone instead of rewriting them.
  - **Direct Airtable attachment upload for the PO PDF**: the only path where the server already holds the bytes, so it could skip Blob entirely. Deliberately not bundled with #140 (same path twice in a row) and not immediate either. Note for whoever picks it up: the direct-upload endpoint has a file-size ceiling and doesn't generalise to arbitrary user uploads, so it can't become the pattern for the other three paths.
  - Objects already in the store from before #140 are cleared by hand — no sweep, no orphan-detection oracle.