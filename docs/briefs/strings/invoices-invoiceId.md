# Invoice detail — every string this screen can render

Route: `/invoices/[invoiceId]`
Brief: `../invoices-invoiceId.md`
Screen files: `app/invoices/[invoiceId]/page.js`,
`app/invoices/[invoiceId]/PaidForm.js`,
`app/invoices/[invoiceId]/DeleteInvoiceButton.js`,
`app/invoices/[invoiceId]/actions.js`,
`app/components/DeliveryStatusMarks.js`

**Remade when a file above changes, when the route gains or loses one, or when a
constant this screen renders is reworded.** `node scripts/screen-strings.mjs
"/invoices/[invoiceId]" --check` reports drift without rewriting.

**Counted by the extractor, then read for its conditions.** The hand-counted
screens are `login.md` and `invoices-new.md`.

**Two extractor limits were found on this screen and are named where they bite.**
A rendered string held in a plain object under a `label` key, and one held in a
message map whose name is not `*_COPY` — the totals footer and the three
confirmation banners. Both are `hand` below, and both are the same
name-and-shape weakness `offline/mail-money.mjs` records about itself.

## What is not counted here

1. **runtime-keyed** — three. `DONE_MESSAGES[done]` for the confirmation banner,
   `STATUS_COPY.column.invoice[summary.key]` for the chip, and
   `STATUS_COPY.entry…[key]` for a delivery entry's verdict. The last two are
   attributed anyway, because this screen imports `STATUS_COPY` by name; the
   first is not, because its map is not a copy constant.
2. **another entry point's message** — none. Every action this screen calls is
   co-located.
3. **a value from the base** — the vendor's name, the vendor's own invoice
   number, both dates, every order's `PO ID` and `Status`, every charge's `Item
   Name`, `Size`, `Unit` and `Remark`, the delivery's id and received date, and
   the payment date. **`Purchase Orders."Status"` is the one that is a select's
   option text**, printed verbatim in bold beside each order.
4. **text this app does not author** — the browser's validation bubble on the
   Paid Date control when `Paid` is checked, and the date picker's own chrome.
5. **a figure inside a counted sentence** — every amount, every quantity in a
   delivery verdict, and the `{N} EA` in all three entry sentences.
6. **a state this pass could not create** — four, marked `[unreachable]`.

## Strings

### The tab and the heading

- **`{HYE-INV-260727-01} · {HYE USA Portal}`** — read · auto
  - when: always, as the browser tab's text `[seen]`
  - from: this route exports no `metadata`, so `app/layout.js:26`'s `%s · …` template runs
    over Next's own segment title and `lib/productName.js:30` supplies the
    product name
  - names: `Invoices`
  - held: not quoted

- The page heading is **the invoice's own id** and no word of this app's.
  `_shared.md` records that the four document detail screens have no heading word
  at all, and this is one of them.

- **`Edit`** — read · auto
  - when: **Admin only.** An employee who can read this page is not offered a
    link that lands on a refusal `[seen]` both ways with the fixture pair
  - from: `app/invoices/[invoiceId]/page.js:219`, JSXText in a `Link`
  - names: `Invoices`
  - held: quoted by `invoices-invoiceId.md`

- **`← All invoices`** — read · auto
  - when: always `[seen]`
  - from: `app/invoices/[invoiceId]/page.js:223`, JSXText. **The glyph is part of
    the string.** The edit screen says `← Back to invoice`, so the two back links
    in this route are worded differently
  - names: `Invoices`
  - held: not quoted

### The three confirmation banners

- **`Invoice created.`**, **`Invoice updated.`**, **`Payment status updated.`** —
  read · **hand**
  - when: one at a time, only on the way in from the act it names — creating an
    invoice, saving an edit, or toggling payment. A reader who returns to the page
    sees none of them `[reachable]` for all three
  - from: `app/invoices/[invoiceId]/page.js:31-35`, a plain object read at `:231`
    through a computed member. **The extractor finds neither half**: the map is
    not named `*_COPY`, and the member is a variable. This is the clearest case on
    any of these five screens of a rendered string no name-based rule reaches
  - names: `Invoices`
  - held: not quoted, and pinned by nothing

### What the app worked out about the delivery

Said once, on the way in from creation only, because it is not part of the record.

- **`The delivery below was matched from the ordered items this invoice charges —
  nobody attached it by hand. Detach it from that delivery if it is the wrong
  one.`** — read · **hand**
  - when: the invoice arrived here from creation and the app matched a delivery
    `[reachable]`
  - from: `app/invoices/[invoiceId]/page.js:249` renders
    `describePairing(...).text`, which resolves to `PAIRING_COPY` at
    `lib/deliveryInvoiceMatch.js:805`. **The constant is never named here** — the
    screen imports the function
  - names: `Deliveries`, `PO Items`, `Invoices`
  - held: `_shared.md` records that `PAIRING_COPY` carries the seven pairing
    sentences; none is in the `PINNED` list

- **`More than one delivery brought everything this invoice charges, so none was
  attached. Attach the right one from the delivery's own page.`** — read · **hand**
  - when: the same moment, when two or more deliveries could have answered it
    `[reachable]`
  - from: `lib/deliveryInvoiceMatch.js:819`, through the same function
  - names: `Deliveries`, `Invoices`
  - held: not pinned

- **`A delivery brought everything this invoice charges, but another invoice
  nobody has attached charges the same ordered item, so none was attached. Attach
  the right one from the delivery's own page.`** — read · **hand**
  - when: the same moment, when a rival invoice claims the same ordered item
    `[reachable]`
  - from: `lib/deliveryInvoiceMatch.js:825`, through the same function
  - names: `Deliveries`, `Invoices`, `PO Items`
  - held: not pinned

- **`Another invoice charges the same ordered items in the same quantities at the
  same prices, so nothing told the two apart and this one was attached rather
  than that one. Swap them from the delivery's own page if this is the wrong
  one.`** — read · **hand**
  - when: a second sentence in the same box, when a tie decided the match. **One
    box, two sentences** — the tie-break is how the match was made, not a second
    thing that happened `[reachable]`
  - from: `app/invoices/[invoiceId]/page.js:253` renders
    `describeTieBreak(...).text`, at `lib/deliveryInvoiceMatch.js:857`
  - names: `Invoices`, `PO Items`, `Deliveries`
  - held: not pinned

### The invoice's own facts

- **`Amount Due (vendor's stated total)`** — read · auto
  - when: always, above the figure it labels, in small caps `[seen]`
  - from: `app/invoices/[invoiceId]/page.js:257`, JSXText with an `&apos;`
    entity. **The same words as the edit form's label**, and not the create
    form's, which says `Vendor's Stated Total`
  - names: `Invoices`, the `Amount Due` field
  - held: `_shared.md` locks it; nothing pins it

- **`Vendor:`**, **`Vendor Invoice #:`**, **`Issue Date:`**, **`Due Date:`** —
  read · auto
  - when: always, each followed by its value or an em dash `[seen]`
  - from: `app/invoices/[invoiceId]/page.js:264-267`, JSXText beside a container
    each. **Colons here, no colons on the edit form's labels**
  - names: `Vendors`, `Invoices`
  - held: quoted by `invoices-invoiceId.md`

- **`Invoice File`** — read · auto
  - when: the invoice has a file and that attachment carries no filename — this
    is the link's fallback text, not a label `[unreachable]` in practice, since
    every upload path sends a filename
  - from: `app/invoices/[invoiceId]/page.js:271`, the alternate of a `||` inside
    a JSX expression container
  - names: `Invoices`, the `File` attachment
  - held: not quoted

### The orders this invoice charges

- **`Purchase Order`**, with **`s`** appended when there is more than one — read ·
  auto
  - when: always, as the section heading `[seen]`
  - from: `app/invoices/[invoiceId]/page.js:304`, JSXText plus a ternary in a
    container. **The plural is a separate string**, which is why both appear
  - names: `Purchase Orders`
  - held: quoted by `invoices-invoiceId.md`

- **`{Item Name} {Size} — {qty} {unit}`** — read · auto
  - when: one per charge, nested under the order it charges, **and only where the
    folded charges disagree about which orders they touch.** Absent in the
    ordinary case `[reachable]` with a split charge
  - from: `app/invoices/[invoiceId]/page.js:331` renders
    `ORDER_BREAKDOWN_COPY.charged(b).text`, at `lib/invoiceOrderBreakdown.js:169`
  - names: `Invoice Items` against `Purchase Orders`. **No price and no amount** —
    the module's own note says why a nested entry carries only the quantity
  - held: quoted by `invoices-invoiceId.md`; not pinned

- **`That item`** — read · **hand**
  - when: in place of the pair above, when a charge carries neither an item name
    nor a size `[unreachable]` — an item name is required on every write path
  - from: `lib/invoiceOrderBreakdown.js:179`, the fallback of a `||` inside
    `itemLabel`, **a helper function rather than the constant**, so the extractor
    does not reach it
  - names: `Invoice Items`
  - held: not quoted

### The charges table

- **`Items`** — read · auto
  - when: always `[seen]`
  - from: `app/invoices/[invoiceId]/page.js:344`, JSXText in a heading
  - names: `Invoice Items`
  - held: quoted by `invoices-invoiceId.md`

- **`Item`**, **`Size`**, **`Unit`**, **`Qty`**, **`Unit Price`**, **`Amount`**,
  **`Remark`** — read · auto
  - when: always, seven headings. **There is no `PO` column**, deliberately: a
    folded row can span two orders, so the cell would have no single value
    `[seen]`
  - from: `app/invoices/[invoiceId]/page.js:357-363`, JSXText in each `th`
  - names: `Invoice Items`, with `Size` and `Unit` frozen from `PO Items`
  - held: quoted by `invoices-invoiceId.md`

- **`⚠ Order variance`** — read · auto
  - when: beside an item name whose stored flag is set. **No sentence beside it**
    — the flag is one checkbox set by either a price difference or a quantity
    beyond the order `[reachable]`
  - from: `app/invoices/[invoiceId]/page.js:379` renders `VARIANCE_COPY.item`, at
    `lib/variance.js:170`
  - names: `Invoice Items`, the `Variance Flag` checkbox
  - held: `_shared.md` locks it; **pinned** by `offline/screen-briefs.mjs` and
    `offline/variance-copy.mjs`

### The totals footer

- **`Items Subtotal`**, **`Shipping Fee`**, **`Tariff`**, **`Sales Tax`**,
  **`Calculated Total`** — read · **hand**
  - when: the first, second and last always; `Tariff` and `Sales Tax` each only
    when the invoice stores one. **A stored zero gets a row**, since a document
    stating no tax is a different claim from a document with no tax line — and
    nothing in the app writes that zero today, so the row is reachable only from a
    hand edit in Airtable `[seen]` for three, `[unreachable]` for a zero row
  - from: `app/invoices/[invoiceId]/page.js:197-210`, string values under a
    `label` key in the `summaryRows` array. **The extractor reads a `label` JSX
    attribute and not a `label` property**, so all five are invisible to it
  - names: `Invoices`. The order is the vendor's own, the formula's argument order
    and the create form's slot order, all three alike
  - held: `naming.md` carries `Calculated Total` as a screen word; nothing pins
    any of the five

- **`{⚠ Check the total} — the vendor's Amount Due ({$}) doesn't match our
  Calculated Total ({$}).`** — read · auto
  - when: the invoice's stored header variance flag is set `[reachable]`
  - from: `app/invoices/[invoiceId]/page.js:432` calls
    `VARIANCE_COPY.headerDetail`, at `lib/variance.js:181`. **The badge label
    leads the sentence**, so the mark in the list and the sentence here cannot
    come to say different things
  - names: `Invoices`. **`our Calculated Total`** names the field; `the vendor's
    Amount Due` names the other total
  - held: `_shared.md` locks `⚠ Check the total`, which is **pinned**; the rest of
    the sentence is not

### The delivery section

- **`Delivery`** — read · auto
  - when: always, as the section heading, with the chip beside it `[seen]`
  - from: `app/invoices/[invoiceId]/page.js:509`, JSXText in a heading
  - names: `Deliveries`
  - held: quoted by `invoices-invoiceId.md`

- **`Delivered`**, **`Mismatch`**, **`Awaiting delivery`** — read · auto
  - when: one beside the heading, from the same function the list column uses, so
    the row a reader clicked and the page they land on cannot describe the invoice
    differently `[seen]` — all three exist in the seeded data
  - from: `app/invoices/[invoiceId]/page.js:510` renders
    `describeInvoiceColumn(reconciliation.summary)`, resolving to
    `STATUS_COPY.column.invoice` at `lib/deliveryStatus.js:726`, `:731`, `:734`
  - names: `Invoices` against `Deliveries`
  - held: `_shared.md` locks all three as tier 1; not in the `PINNED` list

- **`No delivery has been matched to this invoice yet.`** — read · auto
  - when: no delivery is attached. **`matched` and not `delivered`** — those
    became different facts when the pairing was stored, and the verdict inside
    each box used to conflate them `[reachable]`
  - from: `app/invoices/[invoiceId]/page.js:539`, JSXText
  - names: `Deliveries`, `Invoices`
  - held: quoted by `invoices-invoiceId.md`; not pinned

- **`⚠ This invoice charges more than the delivery matched to it delivered — take
  it up with the vendor, or with whoever received the material, before confirming
  payment.`** — read · auto
  - when: a delivery is attached and delivered less than this invoice charges.
    **After the delivery is named, not before it** `[seen]`
  - from: `lib/deliveryStatus.js:875-877`, through `STATUS_COPY`
  - names: `Invoices`, `Deliveries`, `Vendors`, `Materials`
  - held: `_shared.md` locks it; **pinned** on its first clause

- **`{N EA} more invoiced than the matched delivery delivered`** — read · auto
  - when: one entry per folded charge that disagrees, in the items table's order.
    **Only what disagrees is listed** `[seen]`
  - from: `lib/deliveryStatus.js:935`, through `STATUS_COPY`
  - names: `Invoice Items`, `Deliveries`
  - held: `_shared.md` locks it; **pinned** without its figure

- **`{N EA} invoiced, none of it delivered by the matched delivery`** — read ·
  auto
  - when: the same list, for a charge the attached delivery did not fill at all
    `[reachable]`
  - from: `lib/deliveryStatus.js:963`, through `STATUS_COPY`
  - names: `Invoice Items`, `Deliveries`
  - held: `_shared.md` locks it; **pinned** without its figure

- **`Against the ordered item{s}: {N EA} more invoiced, {N EA} more
  delivered`** — read · auto
  - when: an aside under an entry, when something exceeds the ordered item. **The
    aside stays uncolored** — it is the ordered item's fact rather than this
    invoice's `[reachable]`
  - from: `lib/deliveryStatus.js:1015-1021`, through `STATUS_COPY`
  - names: `PO Items`. **`Against the ordered item`, not `Against the order`** —
    the comparison is against one row's quantity
  - held: `_shared.md` locks it; not pinned

- **`⚠ A charge on this invoice differs from what its order agreed — check it
  against the order, or take it up with the vendor, before this invoice is
  paid.`** — read · auto
  - when: any charge on the invoice carries the item-level variance flag. **One
    prompt for the whole document**, under the per-charge marks `[reachable]`
  - from: `app/invoices/[invoiceId]/page.js:678` renders
    `VARIANCE_COPY.itemPrompt().text`, at `lib/variance.js:232-234`
  - names: `Invoice Items`, `Purchase Orders`, `Vendors`. **`A charge`, which is
    the noun for an `Invoice Items` row**
  - held: `_shared.md` locks the pair this belongs to; not pinned

### Payment

- **`Payment`** — read · auto
  - when: **President or Admin only.** For everyone else the section is absent
    rather than empty — the app does not raise a subject it will then refuse to
    speak on `[seen]` both ways
  - from: `app/invoices/[invoiceId]/page.js:690`, JSXText in a heading
  - names: `Invoices`
  - held: quoted by `invoices-invoiceId.md`

- **`Paid on {date}`** and **`Not paid yet.`** — read · auto
  - when: for a President who is **not** an Admin — the read-only voice of the
    section above. An Admin gets the form instead `[reachable]` only with a
    President who is not an Admin, which no fixture account is
  - from: `app/invoices/[invoiceId]/page.js:697`, the two arms of a ternary in a
    JSX expression container. **Neither is the list's wording**, which says `Paid`
    and `Unpaid` for the same two states
  - names: `Invoices`, the `Paid` checkbox and `Paid Date`
  - held: not quoted

- **`Paid`**, **`Paid Date`** — read · auto
  - when: Admin only, as the checkbox's label and the date field's `[seen]`
  - from: `app/invoices/[invoiceId]/PaidForm.js:29` and `:34`, JSXText
  - names: `Invoices`
  - held: quoted by `invoices-invoiceId.md`

- **`Saving...`** and **`Save`** — read · auto
  - when: the form's button, the first while the action runs `[seen]`
  - from: `app/invoices/[invoiceId]/PaidForm.js:53`, the two arms of a ternary in
    a container. **`Save`, where the edit form says `Save changes`**
  - names: no table
  - held: not quoted

### Deleting

- **`Delete invoice`** — read · auto
  - when: Admin only, below a rule at the foot of the page `[seen]`
  - from: `app/invoices/[invoiceId]/DeleteInvoiceButton.js:44`, JSXText
  - names: `Invoices`
  - held: quoted by `invoices-invoiceId.md`

- **`Delete this invoice?`** — read · auto
  - when: the confirmation is open `[reachable]`
  - from: `app/invoices/[invoiceId]/DeleteInvoiceButton.js:54`, JSXText
  - names: `Invoices`
  - held: not quoted

- **`{HYE-INV-…} and its invoice items will be permanently deleted. The linked
  purchase order(s) are not affected. This can't be undone.`** — read · auto
  - when: with the question above `[reachable]`
  - from: `app/invoices/[invoiceId]/DeleteInvoiceButton.js:56`, JSXText around a
    container. **`can't`, where `DELETE_COPY` on the delivery side says
    `cannot`** — `_shared.md` records that contraction split as one of the two
    places the app disagrees with itself
  - names: `Invoices`, `Invoice Items`, `Purchase Orders`
  - held: not quoted. **`This cannot be undone.` is a tier-2 phrase pinned by
    `offline/screen-briefs.mjs`; this screen's contracted form is not that
    string**

- **`Deleting...`**, **`Delete`**, **`Cancel`** — read · auto
  - when: the confirmation's two buttons; the first while the action runs
    `[reachable]`
  - from: `app/invoices/[invoiceId]/DeleteInvoiceButton.js:67` and `:74`
  - names: `Invoices`
  - held: not quoted

### What the payment and delete actions refuse

- **`Only an Admin can update payment status.`** — read · auto
  - when: `[unreachable]`. The form renders for an Admin only, and this is
    **thrown rather than returned**, so it reaches a reader as a framework error
    page rather than as the form's own message
  - from: `app/invoices/[invoiceId]/actions.js:41`
  - names: `Invoices`
  - held: not quoted

- **`Paid Date is required when marking as Paid.`** — read · auto
  - when: `Paid` is checked with no date. `[reachable]` — the date control is not
    `required`, so this is the one refusal on the payment form a reader can see
  - from: `app/invoices/[invoiceId]/actions.js:53`
  - names: `Invoices`
  - held: not quoted

- **`Invoice not found`** — read · auto
  - when: `[unreachable]`. Thrown, and **without a full stop**, where the same
    words end one on the edit screen's two refusals
  - from: `app/invoices/[invoiceId]/actions.js:57`
  - names: `Invoices`
  - held: not quoted

- **`Something went wrong updating payment status. Please try again.`** — read ·
  auto
  - when: `[unreachable]`. Needs Airtable to fail
  - from: `app/invoices/[invoiceId]/actions.js:66`
  - names: `Invoices`
  - held: not quoted

- **`Only an Admin can delete invoices.`** — read · auto
  - when: `[unreachable]`. The button renders for an Admin only
  - from: `app/invoices/[invoiceId]/actions.js:204`. **A third spelling of one
    refusal** — the page says `Not authorized. …`, the update action says
    `Not authorized.`, and this names the role
  - names: `Invoices`
  - held: not quoted

- **`That invoice no longer exists.`** — read · auto
  - when: the invoice was deleted between opening the confirmation and confirming
    it `[reachable]` with two browser tabs
  - from: `app/invoices/[invoiceId]/actions.js:211`. **The same sentence
    `lib/deliveryInvoiceLink.js` uses for two different refusals**, deliberately,
    so that a record outside someone's scope is not confirmed to exist
  - names: `Invoices`
  - held: **pinned** by `offline/screen-briefs.mjs`

- **`Couldn't delete the invoice. Please try again.`** — read · auto
  - when: `[unreachable]`. Needs the delete to fail
  - from: `app/invoices/[invoiceId]/actions.js:225`
  - names: `Invoices`
  - held: not quoted

### Values the screen switches on

- **`absent`** — switch · auto — `app/components/DeliveryStatusMarks.js:47`, the
  tone rendered as text with no color
- **`complete` · `partial` · `none` · `exception`** — switch · auto —
  `lib/deliveryStatus.js:726`, `:743`, `:735`, `:934`; the tones the chip and the
  entry verdicts carry
- **`delivered` · `mismatch` · `awaiting-delivery`** — switch · auto — the
  invoice axis's own keys, at `lib/deliveryStatus.js:726`, `page.js:557`, `:732`
- **`invoiced` · `partly-invoiced` · `awaiting-invoice` · `partly-delivered` ·
  `nothing-ordered`** — switch · auto — `lib/deliveryStatus.js:739`, `:740`,
  `:748`, `:777`, `:787`; **keys of the three axes this screen does not render**,
  reached because the constant is imported whole
- **`invoiced-more` · `nothing-delivered` · `against-order`** — switch · auto —
  `lib/deliveryStatus.js:932`, `:960`, `:1021`; the entry verdicts' own keys
- **`order-charged`** — switch · auto — `lib/invoiceOrderBreakdown.js:169`
- **`order-variance-prompt`** — switch · auto — `lib/variance.js:230`
- **`on`** — switch · auto — `app/invoices/[invoiceId]/actions.js:49`, the
  checkbox value a browser submits. Not this app's vocabulary at all — it is
  HTML's — and inventoried because the rule that finds one is structural

## Attributed here and not rendered

- `Invoiced`, `Partly invoiced`, `Awaiting invoice`, `Partly delivered` —
  `lib/deliveryStatus.js:739`, `:742`, `:750`, `:779`. This screen imports
  `STATUS_COPY` by name and renders one axis of the four. The other three axes
  are on `/deliveries`, `/pos/[poId]` and the delivery detail.
- `Every charge's quantity has to be a whole number.`, `Every charge's unit price
  has to be a whole number of cents.` — `lib/variance.js:115-116`. Imported by
  this route's `actions.js` for the UPDATE action, whose refusals appear on
  `/invoices/[invoiceId]/edit` and not here.
- `Not authorized.`, `Select a Vendor.`, `Issue Date is required.`, `Amount Due is
  required.`, `Every item needs a name, quantity, and unit price.`, `Invoice not
  found.`, `Something went wrong updating the invoice. Please try again.` — the
  update action's own refusals, in the same file, rendered by the edit form. **The
  extractor attributes a whole file rather than one export's reachable set**,
  which is the cost of following an import by name; the alternative hid eight
  refusals that really are on the edit screen.
