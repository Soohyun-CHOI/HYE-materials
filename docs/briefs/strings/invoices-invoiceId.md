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

**Counted by the extractor, then read in a browser for the grade.** The
hand-counted screens are `login.md` and `invoices-new.md`.

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
6. **a state this pass could not create** — six, graded `unreachable`.

## Strings

### The tab and the heading

- **`{HYE-INV-260727-01} · {HYE USA Portal}`** — read · auto · seen
  - from: this route exports no `metadata`, so `app/layout.js:26`'s `%s · …` template runs
    over Next's own segment title and `lib/productName.js:30` supplies the
    product name
  - names: `Invoices`
  - held: not quoted

- The page heading is **the invoice's own id** and no word of this app's.
  `_shared.md` records that the four document detail screens have no heading word
  at all, and this is one of them.

- **`Edit`** — read · auto · seen
  - from: `app/invoices/[invoiceId]/page.js:219`, JSXText in a `Link`
  - names: `Invoices`
  - held: quoted by `invoices-invoiceId.md`

- **`← All invoices`** — read · auto · seen
  - from: `app/invoices/[invoiceId]/page.js:223`, JSXText. **The glyph is part of
    the string.** The edit screen says `← Back to invoice`, so the two back links
    in this route are worded differently
  - names: `Invoices`
  - held: not quoted

### The three confirmation banners

- **`Invoice created.`**, **`Invoice updated.`**, **`Payment status updated.`** —
  read · **hand** · reachable
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
  one.`** — read · **hand** · reachable
  - from: `app/invoices/[invoiceId]/page.js:249` renders
    `describePairing(...).text`, which resolves to `PAIRING_COPY` at
    `lib/deliveryInvoiceMatch.js:805`. **The constant is never named here** — the
    screen imports the function
  - names: `Deliveries`, `PO Items`, `Invoices`
  - held: `_shared.md` records that `PAIRING_COPY` carries the seven pairing
    sentences; none is in the `PINNED` list

- **`More than one delivery brought everything this invoice charges, so none was
  attached. Attach the right one from the delivery's own page.`** — read
  · **hand** · reachable
  - from: `lib/deliveryInvoiceMatch.js:819`, through the same function
  - names: `Deliveries`, `Invoices`
  - held: not pinned

- **`A delivery brought everything this invoice charges, but another invoice
  nobody has attached charges the same ordered item, so none was attached. Attach
  the right one from the delivery's own page.`** — read · **hand** · reachable
  - from: `lib/deliveryInvoiceMatch.js:825`, through the same function
  - names: `Deliveries`, `Invoices`, `PO Items`
  - held: not pinned

- **`Another invoice charges the same ordered items in the same quantities at the
  same prices, so nothing told the two apart and this one was attached rather
  than that one. Swap them from the delivery's own page if this is the wrong
  one.`** — read · **hand** · reachable
  - from: `app/invoices/[invoiceId]/page.js:253` renders
    `describeTieBreak(...).text`, at `lib/deliveryInvoiceMatch.js:857`
  - names: `Invoices`, `PO Items`, `Deliveries`
  - held: not pinned

### The invoice's own facts

- **`Amount Due (vendor's stated total)`** — read · auto · seen
  - from: `app/invoices/[invoiceId]/page.js:257`, JSXText with an `&apos;`
    entity. **The same words as the edit form's label**, and not the create
    form's, which says `Vendor's Stated Total`
  - names: `Invoices`, the `Amount Due` field
  - held: `_shared.md` locks it; nothing pins it

- **`Vendor:`**, **`Vendor Invoice #:`**, **`Issue Date:`**, **`Due Date:`** —
  read · auto · seen
  - from: `app/invoices/[invoiceId]/page.js:264-267`, JSXText beside a container
    each. **Colons here, no colons on the edit form's labels**
  - names: `Vendors`, `Invoices`
  - held: quoted by `invoices-invoiceId.md`

- **`Invoice File`** — read · auto · unreachable
  - from: `app/invoices/[invoiceId]/page.js:271`, the alternate of a `||` inside
    a JSX expression container
  - names: `Invoices`, the `File` attachment
  - held: not quoted

### The orders this invoice charges

- **`Purchase Order`**, with **`s`** appended when there is more than
  one — read ·
  auto · seen
  - from: `app/invoices/[invoiceId]/page.js:304`, JSXText plus a ternary in a
    container. **The plural is a separate string**, which is why both appear
  - names: `Purchase Orders`
  - held: quoted by `invoices-invoiceId.md`

- **`{Item Name} {Size} — {qty} {unit}`** — read · auto · reachable
  - from: `app/invoices/[invoiceId]/page.js:331` renders
    `ORDER_BREAKDOWN_COPY.charged(b).text`, at `lib/invoiceOrderBreakdown.js:169`
  - names: `Invoice Items` against `Purchase Orders`. **No price and no amount** —
    the module's own note says why a nested entry carries only the quantity
  - held: quoted by `invoices-invoiceId.md`; not pinned

- **`That item`** — read · **hand** · unreachable
  - from: `lib/invoiceOrderBreakdown.js:179`, the fallback of a `||` inside
    `itemLabel`, **a helper function rather than the constant**, so the extractor
    does not reach it
  - names: `Invoice Items`
  - held: not quoted

### The charges table

- **`Items`** — read · auto · seen
  - from: `app/invoices/[invoiceId]/page.js:344`, JSXText in a heading
  - names: `Invoice Items`
  - held: quoted by `invoices-invoiceId.md`

- **`Item`**, **`Size`**, **`Unit`**, **`Qty`**, **`Unit Price`**, **`Amount`**,
  **`Remark`** — read · auto · seen
  - from: `app/invoices/[invoiceId]/page.js:357-363`, JSXText in each `th`
  - names: `Invoice Items`, with `Size` and `Unit` frozen from `PO Items`
  - held: quoted by `invoices-invoiceId.md`

- **`⚠ Order variance`** — read · auto · reachable
  - from: `app/invoices/[invoiceId]/page.js:379` renders `VARIANCE_COPY.item`, at
    `lib/variance.js:170`
  - names: `Invoice Items`, the `Variance Flag` checkbox
  - held: `_shared.md` locks it; **pinned** by `offline/screen-briefs.mjs` and
    `offline/variance-copy.mjs`

### The totals footer

- **`Items Subtotal`**, **`Shipping Fee`**, **`Tariff`**, **`Sales Tax`**,
  **`Calculated Total`** — read · **hand** · reachable
  - from: `app/invoices/[invoiceId]/page.js:197-210`, string values under a
    `label` key in the `summaryRows` array. **The extractor reads a `label` JSX
    attribute and not a `label` property**, so all five are invisible to it
  - names: `Invoices`. The order is the vendor's own, the formula's argument order
    and the create form's slot order, all three alike
  - held: `naming.md` carries `Calculated Total` as a screen word; nothing pins
    any of the five

- **`{⚠ Check the total} — the vendor's Amount Due ({$}) doesn't match our
  Calculated Total ({$}).`** — read · auto · reachable
  - from: `app/invoices/[invoiceId]/page.js:432` calls
    `VARIANCE_COPY.headerDetail`, at `lib/variance.js:181`. **The badge label
    leads the sentence**, so the mark in the list and the sentence here cannot
    come to say different things
  - names: `Invoices`. **`our Calculated Total`** names the field; `the vendor's
    Amount Due` names the other total
  - held: `_shared.md` locks `⚠ Check the total`, which is **pinned**; the rest of
    the sentence is not

### The delivery section

- **`Delivery`** — read · auto · seen
  - from: `app/invoices/[invoiceId]/page.js:509`, JSXText in a heading
  - names: `Deliveries`
  - held: quoted by `invoices-invoiceId.md`

- **`Delivered`**, **`Mismatch`**, **`Awaiting delivery`** — read · auto
  · seen
  - from: `app/invoices/[invoiceId]/page.js:510` renders
    `describeInvoiceColumn(reconciliation.summary)`, resolving to
    `STATUS_COPY.column.invoice` at `lib/deliveryStatus.js:726`, `:731`, `:734`
  - names: `Invoices` against `Deliveries`
  - held: `_shared.md` locks all three as tier 1; not in the `PINNED` list

- **`No delivery has been matched to this invoice yet.`** — read · auto
  · reachable
  - from: `app/invoices/[invoiceId]/page.js:539`, JSXText
  - names: `Deliveries`, `Invoices`
  - held: quoted by `invoices-invoiceId.md`; not pinned

- **`⚠ This invoice charges more than the delivery matched to it delivered — take
  it up with the vendor, or with whoever received the material, before confirming
  payment.`** — read · auto · seen
  - from: `lib/deliveryStatus.js:875-877`, through `STATUS_COPY`
  - names: `Invoices`, `Deliveries`, `Vendors`, `Materials`
  - held: `_shared.md` locks it; **pinned** on its first clause

- **`{N EA} more invoiced than the matched delivery delivered`** — read
  · auto · seen
  - from: `lib/deliveryStatus.js:935`, through `STATUS_COPY`
  - names: `Invoice Items`, `Deliveries`
  - held: `_shared.md` locks it; **pinned** without its figure

- **`{N EA} invoiced, none of it delivered by the matched delivery`** — read ·
  auto · reachable
  - from: `lib/deliveryStatus.js:963`, through `STATUS_COPY`
  - names: `Invoice Items`, `Deliveries`
  - held: `_shared.md` locks it; **pinned** without its figure

- **`Against the ordered item{s}: {N EA} more invoiced, {N EA} more
  delivered`** — read · auto · reachable
  - from: `lib/deliveryStatus.js:1015-1021`, through `STATUS_COPY`
  - names: `PO Items`. **`Against the ordered item`, not `Against the order`** —
    the comparison is against one row's quantity
  - held: `_shared.md` locks it; not pinned

- **`⚠ A charge on this invoice differs from what its order agreed — check it
  against the order, or take it up with the vendor, before this invoice is
  paid.`** — read · auto · reachable
  - from: `app/invoices/[invoiceId]/page.js:678` renders
    `VARIANCE_COPY.itemPrompt().text`, at `lib/variance.js:232-234`
  - names: `Invoice Items`, `Purchase Orders`, `Vendors`. **`A charge`, which is
    the noun for an `Invoice Items` row**
  - held: `_shared.md` locks the pair this belongs to; not pinned

### Payment

- **`Payment`** — read · auto · seen
  - from: `app/invoices/[invoiceId]/page.js:690`, JSXText in a heading
  - names: `Invoices`
  - held: quoted by `invoices-invoiceId.md`

- **`Paid on {date}`** and **`Not paid yet.`** — read · auto · reachable
  - from: `app/invoices/[invoiceId]/page.js:697`, the two arms of a ternary in a
    JSX expression container. **Neither is the list's wording**, which says `Paid`
    and `Unpaid` for the same two states
  - names: `Invoices`, the `Paid` checkbox and `Paid Date`
  - held: quoted by `invoices-invoiceId.md`

- **`Paid`**, **`Paid Date`** — read · auto · seen
  - from: `app/invoices/[invoiceId]/PaidForm.js:29` and `:34`, JSXText
  - names: `Invoices`
  - held: quoted by `invoices-invoiceId.md`

- **`Saving...`** and **`Save`** — read · auto · seen
  - from: `app/invoices/[invoiceId]/PaidForm.js:53`, the two arms of a ternary in
    a container. **`Save`, where the edit form says `Save changes`**
  - names: no table
  - held: not quoted

### Deleting

- **`Delete invoice`** — read · auto · seen
  - from: `app/invoices/[invoiceId]/DeleteInvoiceButton.js:44`, JSXText
  - names: `Invoices`
  - held: quoted by `invoices-invoiceId.md`

- **`Delete this invoice?`** — read · auto · reachable
  - from: `app/invoices/[invoiceId]/DeleteInvoiceButton.js:54`, JSXText
  - names: `Invoices`
  - held: quoted by `invoices-invoiceId.md`

- **`{HYE-INV-…} and its invoice items will be permanently deleted. The linked
  purchase order(s) are not affected. This can't be undone.`** — read ·
  auto · reachable
  - from: `app/invoices/[invoiceId]/DeleteInvoiceButton.js:56`, JSXText around a
    container. **`can't`, where `DELETE_COPY` on the delivery side says
    `cannot`** — `_shared.md` records that contraction split as one of the two
    places the app disagrees with itself
  - names: `Invoices`, `Invoice Items`, `Purchase Orders`
  - held: not quoted. **`This cannot be undone.` is a tier-2 phrase pinned by
    `offline/screen-briefs.mjs`; this screen's contracted form is not that
    string**

- **`Deleting...`**, **`Delete`**, **`Cancel`** — read · auto · reachable
  - from: `app/invoices/[invoiceId]/DeleteInvoiceButton.js:67` and `:74`
  - names: `Invoices`
  - held: quoted by `invoices-invoiceId.md`

### What the payment and delete actions refuse

- **`Only an Admin can update payment status.`** — read · auto · unreachable
  - from: `app/invoices/[invoiceId]/actions.js:41`
  - names: `Invoices`
  - held: not quoted

- **`Paid Date is required when marking as Paid.`** — read · auto · reachable
  - from: `app/invoices/[invoiceId]/actions.js:53`
  - names: `Invoices`
  - held: quoted by `invoices-invoiceId.md`

- **`Invoice not found`** — read · auto · unreachable
  - from: `app/invoices/[invoiceId]/actions.js:57`
  - names: `Invoices`
  - held: not quoted

- **`Something went wrong updating payment status. Please try again.`**
  — read ·
  auto · unreachable
  - from: `app/invoices/[invoiceId]/actions.js:66`
  - names: `Invoices`
  - held: not quoted

- **`Only an Admin can delete invoices.`** — read · auto · unreachable
  - from: `app/invoices/[invoiceId]/actions.js:204`. **A third spelling of one
    refusal** — the page says `Not authorized. …`, the update action says
    `Not authorized.`, and this names the role
  - names: `Invoices`
  - held: not quoted

- **`That invoice no longer exists.`** — read · auto · reachable
  - from: `app/invoices/[invoiceId]/actions.js:211`. **The same sentence
    `lib/deliveryInvoiceLink.js` uses for two different refusals**, deliberately,
    so that a record outside someone's scope is not confirmed to exist
  - names: `Invoices`
  - held: **pinned** by `offline/screen-briefs.mjs`

- **`Couldn't delete the invoice. Please try again.`** — read · auto ·
  unreachable
  - from: `app/invoices/[invoiceId]/actions.js:225`
  - names: `Invoices`
  - held: not quoted

### Values the screen switches on

- **`absent`** — switch · auto —
  `app/components/DeliveryStatusMarks.js:47`, the
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
- **`invoiced-more` · `nothing-delivered` · `against-order`** — switch ·
  auto —
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
