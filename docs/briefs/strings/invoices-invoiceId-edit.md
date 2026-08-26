# Edit invoice — every string this screen can render

Route: `/invoices/[invoiceId]/edit`
Brief: `../invoices-invoiceId-edit.md`
Screen files: `app/invoices/[invoiceId]/edit/page.js`,
`app/invoices/[invoiceId]/edit/EditInvoiceForm.js`,
`app/invoices/[invoiceId]/actions.js`

**Remade when a file above changes, when the route gains or loses one, or when a
constant this screen renders is reworded.** `node scripts/screen-strings.mjs
"/invoices/[invoiceId]/edit" --check` reports drift without rewriting.

**Counted by the extractor, then read in a browser for the grade.** The two
hand-counted screens are `login.md` and `invoices-new.md`, and their measurements
are what say how much this one can be trusted: on 2,500 lines the extractor
missed nothing a reader sees and found one string the hand pass had missed.

**This screen is why the extractor follows an import across a route boundary.**
Its form imports `updateInvoiceAction` from `../actions`, which lives in the
PARENT route's directory, and eight of the refusals below are that file's. A
containment rule that stopped at the boundary reported none of them.

## What is not counted here

1. **runtime-keyed** — none.
2. **another entry point's message** — none beyond the parent action above, which
   the extractor now reaches by name.
3. **a value from the base** — three: the `Vendors."Vendor Name"` in the picker,
   and each item's frozen `Size` and `Unit`, shown disabled.
4. **text this app does not author** — the browser's validation bubble on five
   `required` controls (Vendor, Issue Date, Amount Due, and each item's Item Name,
   Qty and Unit Price), and the two date pickers' own chrome. As on
   `/invoices/new`, this is what makes most of the action's refusals unreachable.
5. **a figure inside a counted sentence** — the two previews and every item's
   amount.
6. **a state this pass could not create** — five, graded `unreachable`.

## Strings

### The tab and the heading

- **`{Edit Invoice} · {HYE USA Portal}`** — read · auto · reachable
  - from: `app/invoices/[invoiceId]/edit/page.js:10` supplies `Edit Invoice`;
    `app/layout.js:26` supplies the `%s · …` template and `lib/productName.js:30`
    the product name
  - names: `Invoices`
  - held: not quoted. **The tab says `Edit Invoice` and the heading says
    `Edit {invoice id}`** — two spellings of one screen's name, which is a
    difference a design should know about rather than discover

- **`Edit`** — read · auto · reachable
  - from: `app/invoices/[invoiceId]/edit/page.js:52`, JSXText beside a container.
    Followed by the invoice's own id, which makes the heading the record's name
    with one word in front of it
  - names: `Invoices`
  - held: `_shared.md` lists `Edit {document ID}` among the tier-3 screen headings

- **`← Back to invoice`** — read · auto · reachable
  - from: `app/invoices/[invoiceId]/edit/page.js:53`, JSXText in a `Link`. **The
    glyph is part of the string**, not a rendered icon
  - names: `Invoices`
  - held: quoted by `invoices-invoiceId-edit.md`

### Refused before the form exists

- **`Not authorized. Editing an invoice is Admin-only.`** — read · auto
  · reachable
  - from: `app/invoices/[invoiceId]/edit/page.js:29`, JSXText. **Not the same
    sentence as `/invoices/new`'s**, which says `This page is Admin-only.`
  - names: `Invoices`
  - held: quoted by `invoices-invoiceId-edit.md`

- **`Invoice not found.`** — read · auto · reachable
  - from: `app/invoices/[invoiceId]/edit/page.js:37`, JSXText. **The same words
    are also an action refusal**, at `app/invoices/[invoiceId]/actions.js:117`,
    where they answer a submit whose invoice has since gone
  - names: `Invoices`
  - held: quoted by `invoices-invoiceId-edit.md`

### The header fields

- **`Vendor`** and **`Select a Vendor`** — read · auto · reachable
  - from: `EditInvoiceForm.js:53` and `:63`, JSXText
  - names: `Vendors`
  - held: not quoted

- **`Vendor Invoice # (optional)`** — read · auto · reachable
  - from: `EditInvoiceForm.js:75`, JSXText. **`/invoices/new` labels the same
    field `Vendor Invoice #` with no parenthetical**, so one field has two labels
    across two screens
  - names: `Invoices`, the `Vendor Invoice Code` field
  - held: not quoted

- **`Issue Date`** and **`Due Date (optional)`** — read · auto · reachable
  - from: `EditInvoiceForm.js:88` and `:101`, JSXText. The same asymmetry:
    `/invoices/new` says `Due Date` with nothing after it
  - names: `Invoices`
  - held: not quoted

- **`Amount Due (vendor's stated total)`** — read · auto · reachable
  - from: `EditInvoiceForm.js:115`, JSXText with an `&apos;` entity. **The
    create form labels the same field `Vendor's Stated Total`** — the gloss and
    the name have swapped places between the two screens
  - names: `Invoices`, the `Amount Due` field. `naming.md` carries this pair
  - held: `_shared.md` quotes `Amount Due (vendor's stated total)` among the
    locked words; nothing pins it

- **`The figure printed on the vendor's invoice. Editing it re-checks it against
  our calculated total.`** — read · auto · reachable
  - from: `EditInvoiceForm.js:127`, JSXText
  - names: `Invoices`. **`our calculated total`, lowercase**, where the field is
    `Calculated Total`
  - held: quoted by `invoices-invoiceId-edit.md`

- **`Shipping Fee`**, **`Tariff (optional)`**, **`Sales Tax
  (optional)`** — read ·
  auto · reachable
  - from: `EditInvoiceForm.js:144`, `:157`, `:171`, JSXText
  - names: `Invoices`
  - held: quoted by `invoices-invoiceId-edit.md`

- **`Leave blank if none`** — read · auto · reachable
  - from: `EditInvoiceForm.js:166` and `:180`, a `placeholder` attribute at each
  - names: `Invoices`
  - held: quoted by `invoices-invoiceId-edit.md`

### The charges

- **`Items`** — read · auto · reachable
  - from: `EditInvoiceForm.js:188`, JSXText in a heading
  - names: `Invoice Items`
  - held: quoted by `invoices-invoiceId-edit.md`

- **`Edit item values. Size/Unit and the linked PO are fixed here — to change an
  item's PO or add/remove items, delete and recreate the invoice.`** — read ·
  auto · reachable
  - from: `EditInvoiceForm.js:189`, JSXText with an `&apos;` entity. **This is
    the sentence #227's sweep reached in JSX by reading the file** — it said
    `line values` and `add/remove lines`, and `_shared.md` cites it as the
    example of a tier-3 string protected against deletion and not against
    rewording
  - names: `Invoice Items`, `PO Items` for the frozen pair, `Purchase Orders`
  - held: `_shared.md` cites it; nothing pins it

- **`Item Name`**, **`Size`**, **`Unit`**, **`Qty`**, **`Unit Price`**,
  **`Remark`** — read · auto · reachable
  - from: `EditInvoiceForm.js:200`, `:209`, `:215`, `:220`, `:229`, `:236`, a
    `placeholder` attribute each. **Placeholders rather than labels**, so a
    filled row shows no field names at all
  - names: `Invoice Items`, with `Size` and `Unit` frozen from `PO Items`
  - held: quoted by `invoices-invoiceId-edit.md`

- **`PO:`** — read · auto · reachable
  - from: `EditInvoiceForm.js:243`, JSXText. The em dash is supplied at `:29` as
    the fallback of a `||`
  - names: `Purchase Orders`. **`PO` and not `ordered item`** — the label names
    the order, which is what the row shows
  - held: not quoted

- **`⚠ Order variance`** — read · auto · reachable
  - from: `EditInvoiceForm.js:246` renders `VARIANCE_COPY.item`, at
    `lib/variance.js:170`
  - names: `Invoice Items`, the `Variance Flag` checkbox
  - held: `_shared.md` locks it as tier 1; **pinned** by
    `offline/screen-briefs.mjs` and by `offline/variance-copy.mjs`

- **`Amount (preview):`** and **`Items Subtotal (preview):`** — read ·
  auto · reachable
  - from: `EditInvoiceForm.js:251` and `:257`, JSXText beside a container.
    **`Items Subtotal` is the field name here**, where `/invoices/new` says
    `Items total (preview)` for the same figure
  - names: `Invoice Items` and the `Items Subtotal` rollup
  - held: quoted by `invoices-invoiceId-edit.md`

### Submitting

- **`Saving...`** and **`Save changes`** — read · auto · reachable
  - from: `EditInvoiceForm.js:283`, the two arms of a ternary in a JSX expression
    container
  - names: `Invoices`
  - held: not quoted

- **`Cancel`** — read · auto · reachable
  - from: `EditInvoiceForm.js:285`, JSXText in a `Link`
  - names: no table
  - held: quoted by `invoices-invoiceId-edit.md`

### What the update action refuses

All rendered in one paragraph at `EditInvoiceForm.js:47`, and all authored in the
parent route's `actions.js`. **Seven of the nine are unreachable through this
screen**, for the reason `/invoices/new`'s are: a `required` control fires first.

- **`Not authorized.`** — read · auto · unreachable
  - from: `app/invoices/[invoiceId]/actions.js:81`
  - names: no table
  - held: quoted by `invoices-invoiceId-edit.md`

- **`Select a Vendor.`**, **`Issue Date is required.`**, **`Amount Due is
  required.`** — read · auto · unreachable
  - from: `app/invoices/[invoiceId]/actions.js:98-100`
  - names: `Vendors`, `Invoices`
  - held: not quoted

- **`Every item needs a name, quantity, and unit price.`** — read · auto
  · unreachable
  - from: `app/invoices/[invoiceId]/actions.js:103`
  - names: `Invoice Items`
  - held: not quoted

- **`Every charge's quantity has to be a whole number.`** and **`Every charge's
  unit price has to be a whole number of cents.`** — read · auto · reachable
  - from: `app/invoices/[invoiceId]/actions.js:109` and `:112` render
    `CHARGE_PRECISION_COPY.qty` and `.unitPrice`, at `lib/variance.js:115-116`
  - names: `Invoice Items` — the two strings here that call a row a `charge`
  - held: both **pinned** by `offline/screen-briefs.mjs`

- **`Invoice not found.`** — read · auto · unreachable
  - from: `app/invoices/[invoiceId]/actions.js:117`. **The same words as the
    page's own refusal**, in a different voice's place
  - names: `Invoices`
  - held: quoted by `invoices-invoiceId-edit.md`

- **`Something went wrong updating the invoice. Please try again.`** — read ·
  auto · unreachable
  - from: `app/invoices/[invoiceId]/actions.js:188`
  - names: `Invoices`
  - held: not quoted

### Values the screen switches on

This form holds no closed vocabulary of its own: its only branch is `pending`, a
boolean, and every field is a value rather than a state. One value is
nevertheless attributed to it.

- **`on`** — switch · auto — `app/invoices/[invoiceId]/actions.js:49`,
  the value a
  browser submits for a checked checkbox. **Not this app's vocabulary at all** —
  it is HTML's, and it belongs to the Paid form on the invoice's own page. It is
  here because the extractor attributes a whole file and this screen imports one
  export from that one

## Attributed here and not rendered

- `⚠ Check the total` — `lib/variance.js:175`. The form renders
  `VARIANCE_COPY.item` and no other member; this one is attributed by the union
  that keeps a constant's own module readable. It is on the invoice's page, not
  on this one.
- `Only an Admin can update payment status.`, `Paid Date is required when marking
  as Paid.`, `Something went wrong updating payment status. Please try again.`,
  `Only an Admin can delete invoices.`, `That invoice no longer exists.`,
  `Couldn't delete the invoice. Please try again.` —
  all in `app/invoices/[invoiceId]/actions.js`, which this screen imports one
  export from. They belong to the Paid form and the delete button on
  `/invoices/[invoiceId]`, and the extractor attributes a whole file rather than
  one export's reachable set. **This is the cost of the import rule this screen
  forced**, and it is stated here rather than paid for by hiding eight refusals
  that are really on this screen.
