# Invoices — every string this screen can render

Route: `/invoices`
Brief: `../invoices.md`
Screen files: `app/invoices/page.js`, `app/invoices/AwaitingInvoiceStrip.js`,
`app/invoices/AwaitingDeliveryStrip.js`, `app/components/DeliveryStatusMarks.js`

**Remade when a file above changes, when the route gains or loses one, or when a
constant this screen renders is reworded.** `node scripts/screen-strings.mjs
/invoices --check` reports drift without rewriting.

**Counted by the extractor, then read for its conditions.** The hand-counted
screens are `login.md` and `invoices-new.md`.

**This screen renders a whole vocabulary the extractor cannot attribute.** Its
`Delivery` column is a chip built by `describeInvoiceColumn`, which reads
`STATUS_COPY` inside `lib/deliveryStatus.js` — a constant this screen never names.
Four locked words reach a reader here and the extractor sees none of them, which
is the largest single `hand` class in this group and is shape 1 one level up: not
a computed member, but a whole constant reached only through a function.

## What is not counted here

1. **runtime-keyed** — two. `AWAITING_DELIVERY_COPY.kind[row.kind]` in the second
   strip, and the four `STATUS_COPY.column.invoice[summary.key]` chips above.
   The first is attributed anyway, since a computed access makes the extractor
   take the constant whole; the second is not, because the constant is not
   imported here at all.
2. **another entry point's message** — none. This screen has no form and no
   action.
3. **a value from the base** — four: a `Vendors."Vendor Name"`, both dates, and
   `Jobs."Job Code"` inside a strip row.
4. **text this app does not author** — none. There is no control on this screen
   but links.
5. **a figure inside a counted sentence** — every `Amount Due`, every strip
   heading's count, every `Nd` wait, and the date beside `Paid`.
6. **a state this pass could not create** — none. Every state here is a
   consequence of the data, and all of it is reachable with the two fixture
   accounts.

## Strings

### The tab and the heading

- **`{Invoices} · {HYE USA Portal}`** — read · auto
  - when: always, as the browser tab's text `[seen]`
  - from: `app/invoices/page.js:30` supplies `Invoices`; `app/layout.js:26`
    supplies the `%s · …` template and `lib/productName.js:30` the product name
  - names: `Invoices`
  - held: not quoted

- **`Invoices`** — read · auto
  - when: always, as the page heading `[seen]`
  - from: `app/invoices/page.js:182`, JSXText
  - names: `Invoices`
  - held: `_shared.md` lists it among the tier-3 screen headings

- **`New invoice`** — read · auto
  - when: **only for an Admin.** An employee who now reads this list is not
    offered a button that lands on a refusal `[seen]` both ways with the two
    fixture accounts
  - from: `app/invoices/page.js:193`, JSXText in a `Link`
  - names: `Invoices`
  - held: quoted by `invoices.md`. **Sentence case, where the screen it leads to
    is headed `New Invoice`**

### The two empty states

- **`No invoices yet.`** — read · auto
  - when: the base holds no invoice at all. **Tested first, and the order is
    load-bearing**: a viewer on a base with invoices they cannot see would
    otherwise be told none exist `[reachable]`
  - from: `app/invoices/page.js:220`, JSXText
  - names: `Invoices`
  - held: quoted by `invoices.md`; not pinned

- **`No invoices to show. You see an invoice when it charges a purchase order you
  raised or one on a job you are assigned to.`** — read · auto
  - when: invoices exist and this reader can see none `[reachable]` with
    `authz-fixture@`, which is assigned to no job
  - from: `app/invoices/page.js:222`, JSXText
  - names: `Invoices`, `Purchase Orders`, `Jobs`. **`charges` is the transitive
    verb** — never `invoices`, which reads as a plural noun
  - held: quoted by `invoices.md`; not pinned. `poListView.js`'s equivalent
    sentence IS pinned, and this one is not

### The table's headings

- **`Invoice ID`**, **`Vendor`**, **`Issue Date`**, **`Due Date`**, **`Amount
  Due`**, **`Delivery`** — read · auto
  - when: whenever a row exists. Six for every reader `[seen]`
  - from: `app/invoices/page.js:280-285`, JSXText in each `th`
  - names: `Invoices` for five, `Vendors` for one, `Deliveries` for the last
  - held: `invoices.md` names the columns; nothing pins them

- **`Status`** — read · auto
  - when: **President or Admin only.** For everyone else the table is one column
    narrower and no heading marks where it was `[seen]` both ways with the
    fixture pair
  - from: `app/invoices/page.js:296`, JSXText in a `th` behind a privilege test
  - names: no table — the column carries the payment word and the header variance
    badge stacked under it
  - held: `_shared.md` records this column as the app's example of a screen that
    renders differently for two readers, not merely with fewer rows

### The delivery chip

- **`Delivered`**, **`Mismatch`**, **`Awaiting delivery`** — read · **hand**
  - when: one per row, always, in the `Delivery` column. `Delivered` when the
    invoice names a delivery that covers it, `Mismatch` when it names one that
    delivered less than the invoice charges, `Awaiting delivery` when it names
    none `[seen]` — all three exist in the seeded data
  - from: `app/invoices/page.js:351` renders
    `StatusChip chip={describeInvoiceColumn(summary)}`, which resolves through
    `lib/deliveryStatus.js:1032` to `STATUS_COPY.column.invoice`, at `:726`,
    `:731` and `:734`. **The constant is never named on this screen**, so no
    import-following attributes it
  - names: `Invoices` against `Deliveries`
  - held: `_shared.md` locks all three as tier 1; the axis is quoted there and
    the three words are not in the `PINNED` list

- **`—`** — read · auto
  - when: the row has no summary at all — a different fact from
    `Awaiting delivery`, which is a measured state `[reachable]`
  - from: `app/invoices/page.js:349`, JSXText in a `span`
  - names: no table. **The em dash is the value**, and `_shared.md`'s `absent`
    rule is why it is text with no color rather than a fourth chip
  - held: `_shared.md` locks the em dash as a glyph inside a locked string

- **`absent`** — switch · auto
  - when: never read by a person
  - from: `app/components/DeliveryStatusMarks.js:47`, the tone this component
    renders without a chip
  - names: no table
  - held: `_shared.md` names it as the third tone group

### The payment cell

- **`Paid`**, with the payment date after it when there is one — read · auto
  - when: President or Admin, on a paid invoice `[seen]`
  - from: `app/invoices/page.js:399`, a template inside the consequent of a
    ternary in a JSX expression container
  - names: `Invoices`, the `Paid` checkbox and `Paid Date`
  - held: `naming.md` carries `Paid 2026-07-27` as one cell and records that both
    the header and the cell are privileged-only

- **`Unpaid`** — read · auto
  - when: President or Admin, on an unpaid invoice `[seen]`
  - from: `app/invoices/page.js:399`, the alternate of the same ternary. **Not
    `Not paid`**, which is what `lib/poDocuments.js` says for the same fact on
    the order's own page — one fact, two words, on two screens
  - names: `Invoices`
  - held: `_shared.md` locks `Not paid` for the other screen and does not record
    this one

- **`⚠ Check the total`** — read · auto
  - when: President or Admin, on an invoice whose stored header variance flag is
    set. **Stacked under the payment word rather than beside it**, which is
    measured: the pair needs 210px on one line and the column is 176px
    `[seen]`
  - from: `app/invoices/page.js:403` renders `VARIANCE_COPY.header`, at
    `lib/variance.js:175`
  - names: `Invoices`, the `Variance Flag` checkbox. **The instruction grammar is
    the distinction from `⚠ Order variance`**, which is a state
  - held: `_shared.md` locks it as tier 1; **pinned** by
    `offline/screen-briefs.mjs` and by `offline/variance-copy.mjs`

### The strip above the list: deliveries with no invoice

Renders nothing at all when there is nothing, which is the ordinary state.

- **`1 delivery is waiting for an invoice`** and **`{N} deliveries are waiting
  for an invoice`** — read · auto
  - when: as the strip's heading, whenever it renders. The singular is its own
    string `[seen]`
  - from: `app/invoices/AwaitingInvoiceStrip.js:66` calls
    `AWAITING_INVOICE_COPY.heading`, at `lib/deliveryStatus.js:1263-1264`
  - names: `Deliveries`, `Invoices`
  - held: quoted by `invoices.md`; the heading is not pinned

- **`Longest wait first. No invoice yet covers what these deliveries brought.`** —
  read · auto
  - when: under the heading above `[seen]`
  - from: `app/invoices/AwaitingInvoiceStrip.js:67` renders
    `AWAITING_INVOICE_COPY.explain`, at `lib/deliveryStatus.js:1265`
  - names: `Invoices`, `Deliveries`. **`brought` rather than `arrived`** — #166
    settled `delivered` for the act and the noun for what a delivery carried has
    no table
  - held: `_shared.md` locks it as tier 1; **pinned**

- **`no date`** — read · auto
  - when: on a strip row whose record carries no date. **Both strips render it**
    `[reachable]`
  - from: `app/invoices/AwaitingInvoiceStrip.js:82` and
    `app/invoices/AwaitingDeliveryStrip.js:90`, the alternate of a `||` inside a
    JSX expression container
  - names: `Deliveries`, `Invoices`
  - held: not quoted. **Lowercase, and not the em dash** the table below uses for
    a missing value — two spellings of nothing on one screen

### The strip above the list: invoices with no delivery

Second of the two, and the order is the documents' own: a delivery waiting for an
invoice comes before an invoice waiting for a delivery.

- **`1 invoice is waiting on a delivery`** and **`{N} invoices are waiting on a
  delivery`** — read · auto
  - when: as the second strip's heading, whenever it renders `[seen]`
  - from: `app/invoices/AwaitingDeliveryStrip.js:73` calls
    `AWAITING_DELIVERY_COPY.heading`, at `lib/deliveryStatus.js:1389-1390`
  - names: `Invoices`, `Deliveries`
  - held: quoted by `invoices.md`; not pinned

- **`Longest wait first. Nothing has confirmed the material these invoices charge
  for.`** — read · auto
  - when: under the heading above `[seen]`
  - from: `app/invoices/AwaitingDeliveryStrip.js:74` renders
    `AWAITING_DELIVERY_COPY.explain`, at `lib/deliveryStatus.js:1392`
  - names: `Invoices`, `Materials`. **`charge for` is the transitive verb again**
  - held: `_shared.md` locks it; **pinned**

- **`Only invoices that have waited {N} days or more are listed.`** — read · auto
  - when: with the explanation above `[seen]`
  - from: `lib/deliveryStatus.js:1393`, a template over `AWAITING_DELIVERY_DAYS`
  - names: `Invoices`
  - held: **pinned in two halves** — `Only invoices that have waited` and
    `days or more are listed.` — because the threshold is meant to be tuned and a
    pin carrying the number would fail the day it is

- **`nothing delivered yet`** and **`delivered, not matched`** — read · auto
  - when: one per strip row, saying which of the two kinds of wait it is
    `[seen]`
  - from: `app/invoices/AwaitingDeliveryStrip.js:96` reads
    `AWAITING_DELIVERY_COPY.kind[row.kind]`, at `lib/deliveryStatus.js:1395-1396`.
    **A computed member**, which is why the whole constant is attributed here
  - names: `Deliveries`, `Invoices`
  - held: both **pinned**

- **`{N}d`** — read · auto
  - when: on a strip row that has a wait to state, after the date and a middle
    dot `[seen]`
  - from: `app/invoices/AwaitingDeliveryStrip.js:91`, a template inside a JSX
    expression container. **The `d` is the whole word for days**
  - names: no table
  - held: not quoted

## Attributed here and not rendered

None. Every string the extractor puts on this screen is one a reader of it can
see — which is the opposite of this screen's problem, since four words a reader
does see are ones the extractor cannot find.
