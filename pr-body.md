Closes #211

## What this delivers

`/invoices` and `/invoices/[invoiceId]` were President-or-Admin and no
reason for that was recorded anywhere. #132 wrote "the invoice pages
stay President-or-Admin" while opening the PO detail page — a scope
boundary for that issue, not a decision about this one — and #166 then
withheld vendor invoice figures from the delivery screens without
saying why either. Overturning it needed no argument demolished, so
what is recorded here is the pair of arguments that replaced it.

Both routes now carry the row-level gate #132 gave `app/pos/[poId]`.
#166's delivery-screen withholding is released to match. Payment
becomes the one thing withheld, and that line is new rather than
inherited.

## Key design decisions

**The boundary was already leaking, in two directions.** #167 hands a
site employee the vendor's own invoice PDF as the quotation on a
corrective request and puts its number in `Vendor Quotation Code`, and
`/pos/[poId]` shows that same employee the `Amount` column. What the
company agreed to pay was fully in view while what the vendor charged
was not. Separately, the person who counted the material is the only
reader positioned to notice that a vendor billed for thirteen and
shipped ten, so withholding the billed quantity from them removes the
one check that catches it.

**One rule, and the new module owns no part of it.** The judgement
stays `canViewPR`. `lib/invoiceVisibility.js` owns only the walk that
reaches a PR from an invoice, and `offline/invoice-visibility.mjs`
asserts on the AST that it imports `canViewPR`, calls it, reads none of
that function's own inputs, and never names the `Draft` status. A
second predicate there would agree with the first right up until it did
not, and nothing behavioral would notice in between.

**Any line is enough.** A multi-PO invoice is real, so one document can
bill an order the viewer raised and one they have never heard of. They
are looking for the line that is theirs; refusing the whole document
because it also covers someone else's order would hide the thing they
can actually check. An invoice with **no resolvable order** is refused
— the opposite direction from `canViewPR`'s own throw-on-missing-data,
where refusing would stall a signing chain. Here it only means an
employee does not see a document, which is the pre-#211 state.

**Two operations for a page of any size, zero for the office.** The
privileged answer is "every invoice" and needs no walk, so the reads
are paid for only by the audience whose answer depends on them. The
list runs the #166 reconciliation over the **gated** rows, so a refused
invoice's lines never reach the wire either — #169's shape.

**A rule that hides a figure on one screen and shows it on another is
not a rule.** Every row on the Job-scoped deliveries list is a delivery
on a job whose invoices the viewer may now read, so #166's `Invoiced`
column and `Not fully invoiced` filter are released.
`resolveDeliveryFilters` goes with them: it existed so `?unbilled=1`
would be treated as absent for a viewer whose rows carried no invoicing
key, and there is no such viewer left. What was left was
`{ unbilled: Boolean(a), over: Boolean(b) }` — a named rule with no
rule in it, and two callers that could no longer disagree because
nothing was left to agree about. Removed rather than left standing with
a comment, the same call that module made on `arrived-more`.

**Payment is President-or-Admin, and the line is around whether this
vendor was paid — not around the word payment.** The variance prompt
still says "review before confirming payment" for every viewer, because
it discloses no payment state. It was **hoisted out of the Payment
section** so it outlives the gate: it is the only thing that raises a
line-only variance to invoice level, which is exactly what the employee
who counted the material is here to catch.

**The line was enumerated, not assumed.** Every reader of `.paid` under
`app/` and `lib/` is registered in the offline check, and a new one
fails CI until someone decides about it. Building that list found two
leaks rather than confirming there were none:

- `/invoices` Status column — was `Paid`/`Unpaid` to anyone reaching
  the page; privileged only now, and the header becomes `Variance` for
  everyone else and keeps the badge.
- `/invoices/[id]` Payment section — was behind a role gate on the
  route; privileged only now, heading included.
- `/pos/[poId]`'s `✓ Paid` badge — already inside #132's `isPrivileged`
  branch, so unchanged.
- `lib/deliveryDelete.js`'s third voice — **was leaking.** Deletion is
  author-or-Admin on a Job-scoped record, so a site recorder was told
  in a modal that the vendor had already been paid. Behind a
  `seesPayment` flag now, stopping at the `invoiced` voice, which is
  still true and one read cheaper.
- `lib/overagePR.js`'s bill facts — **a dead `paid` field**, on the one
  invoice-reading path site staff reach. Nothing read it: no copy
  branch, no eligibility clause, no render. Removed.

**Nothing became uncomputable**, which is why the line held where it
was first drawn. The only judgement taking `Paid` as an input is the
delete confirmation's voice, and it degrades one step rather than
losing an answer. A heading with nothing under it announces a fact and
refuses to say it, so the whole Payment section goes rather than its
contents.

**No new write paths.** `updatePaidAction` is still `withAdminAction`;
recording and editing an invoice are still Admin-only. The list's
`New invoice` button is now gated on `isAdmin` so an employee is not
offered a control that lands on a refusal.

## Testing

- `npm test` — 1346 checks across 24 files, in CI.
  `offline/invoice-visibility.mjs` is 22 of them.
- **The new check was mutation-tested, four ways, each failing it:** a
  `.paid` read added to an unregistered file (1 failure), the
  `canViewPR` import replaced by a local stub (3), `seesPayment`
  defaulted to `true` (1), and an inline role test put back in the list
  page (2). The restored tree passes.
- **Its anti-vacuity assertion earned its place immediately.** The
  first version of the `.paid` scan matched only `x.paid` and so missed
  two registered files — the Airtable mapper, where the field arrives
  as `record.get("Paid")`, and the toggle form, where it arrives as a
  destructured prop. The "the scan found the mapper" assertion is what
  caught that; without it the scan would have reported a clean surface
  it had never looked at.
- **Browser, two real sessions, no flag forced in source.** Each
  account was signed in through `/login/confirm` by minting a token
  with `createAuthToken` and pressing `Confirm sign-in` — 3 Airtable
  operations for three tokens.
- `scoped-fixture@hanyangengusa.com` (non-Admin, assigned 26-DEMO-01):
  `/invoices` renders **13 rows** against an Admin's 15, last column
  header `Variance`, no `New invoice` button.
  `/invoices/HYE-INV-260804-07` renders with headings
  `Purchase Order · Items · Delivery` — **no Payment section**, no Edit
  link, no Delete button. `/invoices/HYE-INV-260716-02` keeps both the
  hoisted variance banner and the per-line `⚠ Variance` badge.
  `/deliveries` renders the `Invoiced` column and both filters, six
  columns, no horizontal scroll.
- **The two excluded invoices are the hand-entered dummies with no
  order behind them** — `HYE-INV-260727-03` renders `None linked.`
  under Purchase Orders as an Admin, so it is the no-resolvable-order
  branch that refuses them rather than the Job comparison.
- `authz-fixture@hanyangengusa.com` (non-Admin, no assigned Jobs):
  `/invoices` renders the viewer-empty state rather than the base-empty
  one ("No invoices to show. You see an invoice when it bills a
  purchase order you raised or one on a job you are assigned to"), with
  0 tables. `/invoices/HYE-INV-260804-07` renders `Invoice not found.`
  and leaks neither the vendor name nor the amount.
- `soo@hanyangengusa.com` (Admin): 7 columns, header `Status`,
  `Paid 2026-08-05`/`Unpaid`, `New invoice` present, table 832px, every
  row 29px, no horizontal scroll — the privileged view is unchanged.
- **Payment absence checked on the rendered HTML, not by eye.**
  `document.documentElement.outerHTML` was scanned for `Paid`, `paid`,
  `Unpaid`, `Not paid`, `paidDate` and `Paid Date` on every
  `scoped-fixture@` page: **0 occurrences** in 46,670 characters on
  `/invoices`, 0 in 27,010 on the invoice detail, 0 on the variance
  invoice, 0 on `/deliveries`, and 0 on
  `/deliveries/HYE-DL-260804-03`. Both pages are Server Components that
  hand nothing to a Client Component, so an unrendered field is not in
  the payload either.
- `npx next build` compiled successfully. `npx eslint .` leaves the one
  pre-existing `InvoiceForm.js` error (#187), unchanged from `main`.
- **No credentialed verification script was run.** None covers these
  routes, and the budget does not allow adding a run for it.

## Not in this issue

No new write paths. `resolveDeleteCopy`'s `paid` voice is now
unreachable for a non-privileged actor by construction, but nothing in
the browser exercises it: `scoped-fixture@` authored none of the seeded
deliveries, so it never sees the delete control. That branch is covered
by the offline check and by reading the code, not by a render.
