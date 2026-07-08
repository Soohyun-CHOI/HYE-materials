# Material PO Automation — Project Build Plan

Where things stand: the Airtable schema (12 tables) is complete, validated, and internally consistent — this plan covers building the actual application on top of it.

**Confirmed architecture:** React frontend + Vercel serverless API routes (thin backend) + Airtable as the data store. The backend owns all business logic — ID generation, signing rules, PDF generation, notifications. Airtable never runs this logic itself.

---

## Phase 0 — Foundations (no user-facing features yet)

Nothing in later phases works without this in place first.

- **Airtable service layer**: one backend module per table (or a shared client) wrapping Airtable's REST API — create/read/update calls, with the Airtable API key living only server-side, never shipped to the client.
- **Auth**: email/password or magic-link signup restricted to the company domain, with email verification (not just a string check on the domain). New signups land as plain Employee / `Is Admin: false` — promotion to President or Admin is a manual Airtable edit for now, per your decision.
- **ID generation service**: the one piece of logic every later phase depends on —
  - `PR ID` / `PO ID`: `HYE-YYYYMMDD-####` / `HYE-PO-YYYYMMDD-##`, daily-reset counter, backend-owned.
  - Child IDs (`PR Item ID`, `PR Signer ID`, `Correction Request ID`, `Edit Log ID`, `PO Item ID`): parent-prefixed, reset-per-parent counters.
- **Role-based routing**: Employee / Admin / President route protection at the app level.

**Exit test:** can create a Job, Vendor, and User record through the app (not directly in Airtable), with correctly formatted auto-generated IDs.

---

## Phase 1 — PR creation + dynamic signing chain

This is the phase that actually replaces the email-based approval loop — the biggest daily pain point — so it's worth treating as a real milestone on its own, not a stepping stone.

- **PR creation form**: requester picks Job, Vendor, enters line items (Qty × Rate auto-calculated), attaches a Quotation file, and — the key difference from a normal approval form — **assigns their own ordered list of signers**, mixing site and office people in any order.
- **Signing state machine**: tracks whose turn it is (`Current Signer Step`), and supports the three actions per signer: **approve**, **edit-and-continue**, or **return-for-correction** (to any earlier signer, or themselves) — pausing and resuming at the same point, never restarting the whole chain.
- **Edit Log**: every field change recorded (who, what, old/new value, when) — this is the evidence trail; it does *not* invalidate earlier approvals, by design.
- **Notifications**: next signer needs to be told it's their turn — email is the assumed channel; needs to actually get built here, since it was the one thing the old email system did well on its own.
- **Approval history view**: read-only trail of the full chain for a given PR.

**Exit test:** a full PR can be created, routed through a multi-person chain with at least one correction round-trip, and reach "Approved" — with zero emails or manual Excel involved.

---

## Phase 2 — PO generation

- **Auto-trigger on full PR approval**: backend generates the PO ID, copies `PR Items` → `PO Items` as a frozen snapshot (plain values, not live references — this was a deliberate design choice), and the `Vendor`/`Quotation File` lookups already built in Airtable just work since they chain through the linked PR.
- **Delivery address selection**: Primary/Alternate choice surfaced in the PO creation UI.
- **President signing**: single-step approval, same evidence-logging pattern as Phase 1.
- **PO PDF generation**: real output file, quotation appended as an appendix — this is the one place in the whole system that still produces an actual document, since it's going to an external vendor.

**Exit test:** a signed PR produces a PO with correct frozen line items, gets a president signature, and generates a downloadable PDF with the quotation attached.

---

## Phase 3 — Invoice handling

- **Manual invoice entry**: header fields (Invoice #, dates, amount due) plus line items, each line assigned to a specific PO via the `Invoice–PO Link` join table — supporting the many-to-many case (one PO with several invoices as the common case; one invoice spanning several POs as the supported edge case).
- **Variance checking**: compare invoice lines against PO Items. **Open decision carried over from earlier**: exact-match only, or a tolerance percentage for rounding/shipping? Needs to be settled before this phase's logic is final.
- **Payment tracking**: kept deliberately lean — a manual "paid" flag and date on the Invoice, since actual payment happens on an external site.

**Exit test:** an invoice spanning two POs can be entered, correctly reconciled line-by-line against the right PO, with a variance flag firing on a deliberately mismatched test row.

---

## Phase 4 — Materials price history + reporting

- **Materials cache upsert**: as PRs get signed, backend upserts the `Materials` table by the natural key (Item + Size + Unit + Vendor) — update if it exists, create if not, since Airtable has no native composite-uniqueness constraint.
- **Price search view**: "what have we paid for X from vendor Y over time" — built from `PR Items`, not from the cache table (the cache only holds the latest price; real history lives in the dated line items).
- **Materials order log**: a view/report, not a new table.

**Exit test:** after a handful of test PRs across different vendors for the same item, the search view returns the correct price history and the cache table shows only the latest value per item/vendor combination.

---

## Phase 5 — Deferred / explicitly out of scope for now

Don't build these yet — they were deliberately pushed out earlier in the design process:

- Automated extraction from quotations/invoices (unfixed-form documents — genuinely harder, different problem)
- Real payment gateway integration
- Rejection-flow handling beyond what correction/return already covers (rare in practice, per your own description)
- Expanding vendor contacts beyond a single PIC
- A formal "backup president" mechanism for PO approval (currently a single point of failure — fine for now, worth revisiting if it becomes a bottleneck)

---

## Open decisions that will block specific phases if left unresolved

| Decision | Blocks |
|---|---|
| Variance tolerance rule (exact vs. %) | Phase 3 |
| Notification channel confirmation (assumed email) | Phase 1 |
| Correction-request target UX (nudge toward requester vs. free choice) | Phase 1, cosmetic only |

Everything else needed to start Phase 0 today is already settled.
