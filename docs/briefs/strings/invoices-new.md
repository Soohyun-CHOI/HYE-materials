# New invoice — every string this screen can render

Route: `/invoices/new`
Brief: `../invoices-new.md`
Screen files: `app/invoices/new/page.js`, `app/invoices/new/InvoiceForm.js`,
`app/invoices/new/actions.js`, `components/ConfirmDialog.js`

**Remade when a file above changes, when the route gains or loses one, or when a
constant this screen renders is reworded.** `node scripts/screen-strings.mjs
/invoices/new --check` reports drift without rewriting.

**Counted by hand first, then by the extractor, and the two were compared.** This
is the larger of the two screens the hand pass took (#288) and was chosen for
that: the issue's own example, `Pick this charge's PO first`, is here, and this is
the most JSX-authored screen in the app, so the gap it measures is the widest the
app can produce rather than a sample of it. The measurement is at the foot of this
file and is a record of that pass rather than a live figure.

## What is not counted here

All six shapes `README.md` names reach this screen. This is the screen where that
is true, which is the other reason the hand pass took it.

1. **runtime-keyed** — one, and it is the pure case:
   `DIRECT_PURCHASE_COPY.blocked[blocked]` at `InvoiceForm.js:1306` and
   `actions.js:393`. The module is attributable and the member is a variable, so
   which of the three sentences renders is not readable from the source. All
   three are listed; that they are one control's three states is hand knowledge.
2. **another entry point's message** — the four fetches this screen makes
   (`/api/invoices/upload`, `/api/invoices/detect-po`, `/api/pos/[id]/items`,
   `/api/pos/search`, `/api/jobs`) can each fail with a message this app wrote,
   and none of those routes is in this screen's files. What the screen shows for
   every one of them is its OWN sentence — `Upload failed: {error}`,
   `Search failed — try again.`, `Couldn't load this PO's items`,
   `Couldn't load the jobs` — so only the upload's interpolated `{error}` reaches
   a reader unaltered. It is counted as a figure, shape 5, not as a sentence.
3. **a value from the base** — three: a `Vendors."Vendor Name"`, a `Jobs."Job
   Code"` with its name, and every ordered item's `Item Name`, `Size` and `Unit`.
   The `Unit` is the only one that is a select's option text rather than typed
   data, and it is the one no file here can enumerate.
4. **text this app does not author** — the browser's validation bubble on six
   `required` controls (Vendor, Issue Date, Vendor's Stated Total, each row's Qty
   and Unit Price, and the per-row PO select), and the native file picker's own
   chrome. Most of this screen's server-side refusals are unreachable precisely
   BECAUSE these fire first — see the grade on each.
5. **a figure inside a counted sentence** — many, and this screen is where they
   matter: every preview total, every uninvoiced quantity, every PO ID and every
   interpolated error message. The sentence is the entry; the number is not.
6. **a state this pass could not create** — thirteen, graded `unreachable`, and
   ten of them are refusals from `createInvoiceAction`. That is the finding this
   section exists to carry: a design that reserves room for this action's error
   list is drawing states a reader cannot reach through this screen.

## Strings

### The tab

- **`{New Invoice} · {HYE USA Portal}`** — read · auto · seen
  - from: `app/invoices/new/page.js:10` supplies `New Invoice`;
    `app/layout.js:26` supplies the `%s · …` template. **Composed across two
    files, one of which is not this route's**, and the braces mark that: a
    reader sees `New Invoice · HYE USA Portal` and no file holds those words
    together
  - names: no table
  - held: `_shared.md` locks `New Invoice` as a tier-3 screen heading, for the
    heading rather than the tab; the product name is tier 1

### Refused before the form exists

- **`Not authorized. This page is Admin-only.`** — read · auto · reachable
  - from: `page.js:31`, JSXText
  - names: no table
  - held: quoted by no brief. `_shared.md` records that this route is Admin-only
    and does not quote the sentence

### Page chrome

- **`New Invoice`** — read · auto · seen
  - from: `page.js:76`, JSXText in the heading
  - names: no table. `Invoices` is the table; this names the act of creating one
  - held: `_shared.md` lists it among the tier-3 screen headings; not pinned

- **`View all invoices`** — read · auto · seen
  - from: `page.js:78`, JSXText in a `Link`
  - names: `Invoices`
  - held: quoted by no brief

- **`{HYE-DP-…} is recorded and waiting on {job}'s list for someone there to
  raise the purchase request.`** — read · auto · reachable
  - from: `page.js:85` calls `DIRECT_PURCHASE_COPY.recorded`, at
    `lib/directPurchase.js:236`. A builder call on a literal member, so the text
    is resolvable
  - names: `Direct Purchases` for the id, `Jobs` for the code, `Purchase
    Requests` for what the site raises
  - held: quoted by `invoices-new.md`; not pinned

- **`that job`** — read · auto · reachable
  - from: `lib/directPurchase.js:240`, the fallback of a `??` inside the
    template. **Found by the extractor and missed by the hand pass**, which read
    the sentence and not its two fallbacks
  - names: `Jobs`
  - held: not quoted

### The two tabs

- **`PDF Upload`** / **`Manual Entry`** — read · auto · seen
  - from: `InvoiceForm.js:172-173`, `label` properties of the `TABS` array,
    rendered at `:1882` through an expression container
  - names: no table
  - held: quoted by `invoices-new.md`; not pinned

### The invoice file

- **`Invoice File`** — read · auto · seen
  - from: `InvoiceForm.js:1336`, JSXText
  - names: `Invoices`, the `File` attachment
  - held: quoted by `invoices-new.md`

- **`The vendor's original invoice document — required, every received invoice is
  kept on file.`** — read · auto · seen
  - from: `InvoiceForm.js:1338`, JSXText with an `&apos;` entity
  - names: `Invoices`
  - held: quoted by `invoices-new.md`

- **`Uploading {filename}...`** — read · auto · reachable
  - from: `InvoiceForm.js:1348`, JSXText either side of a container
  - names: no table
  - held: quoted by `invoices-new.md`

- **`Uploaded {filename}`** — read · auto · reachable
  - from: `InvoiceForm.js:1352`, JSXText followed by `{" "}` and a link whose
    whole text is the filename
  - names: no table
  - held: not quoted

- **`Upload failed: {error}. Pick a different file to continue — the invoice
  can't be created without one.`** — read · auto · unreachable
  - from: `InvoiceForm.js:1360-1361`, JSXText around one container
  - names: `Invoices`
  - held: not quoted

- **`No file attached yet.`** — read · auto · seen
  - from: `InvoiceForm.js:1365`, JSXText
  - names: no table
  - held: quoted by `invoices-new.md`

### What PO detection says

Seven whole messages and five fragments, all rendered in one paragraph at
`InvoiceForm.js:1375`. Every one is assembled by string concatenation in
`detectAndApplyPOs`, so the paragraph a reader sees is a message plus whichever
fragments applied.

- **`Found PO references from more than one Vendor ({ids}) — please verify and
  select manually below.`** — read · auto · reachable
  - from: `InvoiceForm.js:415-417`, a template literal
  - names: `Purchase Orders`, `Vendors`
  - held: not quoted

- **`No PO on this invoice can be invoiced against.`** — read · auto ·
  reachable
  - from: `InvoiceForm.js:429`, a template literal
  - names: `Purchase Orders`
  - held: not quoted

- **`Found what looks like a PO number ({refs}) but no matching PO exists —
  check it wasn't mistyped, or select manually below.`** — read · auto ·
  reachable
  - from: `InvoiceForm.js:436-438`
  - names: `Purchase Orders`
  - held: not quoted

- **`Auto-detection didn't find a PO number in this file — select the PO manually
  below.`** — read · auto · reachable
  - from: `InvoiceForm.js:450`, a string literal in a container
  - names: `Purchase Orders`
  - held: quoted by `invoices-new.md`

- **`Detected PO: {poId} (auto-filled below).`** — read · auto · reachable
  - from: `InvoiceForm.js:553`
  - names: `Purchase Orders`
  - held: not quoted

- **`Detected PO{s}: {ids} — not auto-applied since a PO or items are already
  entered. Select manually above if needed.`** — read · auto · reachable
  - from: `InvoiceForm.js:530-532`
  - names: `Purchase Orders`, `Invoice Items`
  - held: not quoted

- **`Detected {n} POs: {ids} — auto-filled below, verify each item's
  assignment.`** — read · auto · reachable
  - from: `InvoiceForm.js:566-568`
  - names: `Purchase Orders`, `Invoice Items`
  - held: not quoted

- **` {ids} {is|are} withdrawn, so no invoice can be entered against
  {it|them} and {it wasn't|they weren't} selected — confirm with the vendor
  before continuing.`** — read · auto · reachable
  - from: `InvoiceForm.js:386-392`
  - names: `Purchase Orders`, `Invoices`, `Vendors`
  - held: not quoted

- **` ({n} unrecognized reference{s} ignored)`** — read · auto · reachable
  - from: `InvoiceForm.js:400`
  - names: no table
  - held: not quoted

- **` — already fully invoiced: {ids} (double-check before submitting)`** and
  **` — already fully invoiced (double-check before submitting)`** —
  read · auto · reachable
  - from: `InvoiceForm.js:474-475`, the two arms of a nested ternary
  - names: `Purchase Orders`
  - held: not quoted

- **` {ids} {is|are} unsigned: the President has not signed {it|them}. {It
  was|They were} still selected — an invoice can be recorded against an unsigned
  order.`** — read · auto · reachable
  - from: `InvoiceForm.js:409` calls `UNSIGNED_COPY.detected`, at
    `lib/poUnsigned.js:151`
  - names: `Purchase Orders`, `Users` for the President
  - held: `_shared.md` locks `unsigned` as tier 1 for the dropdown suffix; this
    sentence is quoted by `invoices-new.md` and is not pinned

### The vendor and the order

- **`Vendor`** — read · auto · seen
  - from: `InvoiceForm.js:1125`, JSXText in a `label`
  - names: `Vendors`
  - held: quoted by `invoices-new.md`

- **`Select a Vendor`** — read · auto · seen
  - from: `InvoiceForm.js:1136`, JSXText in an `<option>`
  - names: `Vendors`
  - held: quoted by `invoices-new.md`. **Not the same string as the action's `Select a Vendor.`,
    which carries a full stop** — two spellings of one instruction, in two places

- **`PO`** — read · auto · seen
  - from: `InvoiceForm.js:1146`, JSXText in a `span`
  - names: `Purchase Orders`
  - held: quoted by `invoices-new.md`

- **`+ Add another PO`** — read · auto · seen
  - from: `InvoiceForm.js:1159`, JSXText
  - names: `Purchase Orders`
  - held: quoted by `invoices-new.md`

- **`No PO for this invoice?`** — read · auto · seen
  - from: `InvoiceForm.js:1173` renders `DIRECT_PURCHASE_COPY.affordance`, at
    `lib/directPurchase.js:72`
  - names: `Purchase Orders`, `Invoices`
  - held: quoted by `invoices-new.md`; **pinned** by `offline/screen-briefs.mjs`

- **`Vendor Invoice #`** — read · auto · seen
  - from: `InvoiceForm.js:1179`, JSXText in a `label`
  - names: `Invoices`, the `Vendor Invoice Code` field. **A screen word that is
    not the field name**
  - held: quoted by `invoices-new.md`

- **`The vendor's own invoice number, as printed on their document`** — read ·
  auto · seen
  - from: `InvoiceForm.js:1184`, a `placeholder` attribute
  - names: `Invoices`
  - held: quoted by `invoices-new.md`

- **`Issue Date`** / **`Due Date`** — read · auto · seen
  - from: `InvoiceForm.js:1194` and `:1208`, JSXText in labels
  - names: `Invoices`. Both are `X Date` by the calendar-only convention
  - held: quoted by `invoices-new.md`

### One order slot

Rendered once beside Vendor and again for every added slot, so every string here
can appear more than once on the screen at the same time.

- **`Search all POs by number...`** — read · auto · reachable
  - from: `InvoiceForm.js:1044`, a `placeholder` attribute
  - names: `Purchase Orders`
  - held: quoted by `invoices-new.md`

- **`Searching...`** — read · auto · reachable
  - from: `InvoiceForm.js:1051`, JSXText
  - names: no table
  - held: quoted by `invoices-new.md`

- **`Search failed — try again.`** — read · auto · unreachable
  - from: `InvoiceForm.js:1054`, JSXText
  - names: no table
  - held: quoted by `invoices-new.md`

- **`No matching POs.`** — read · auto · reachable
  - from: `InvoiceForm.js:1059`, JSXText
  - names: `Purchase Orders`
  - held: quoted by `invoices-new.md`

- **`{poId}`** and **`{poId} — unsigned`** — read · auto · seen
  - from: `InvoiceForm.js:1068` and `:1086` and `:1611` all render
    `poOptionLabel`, at `lib/poUnsigned.js:123`; the suffix is
    `UNSIGNED_COPY.option` at `:139`
  - names: `Purchase Orders`
  - held: `_shared.md` locks `unsigned`, lowercase, as a dropdown suffix;
    **pinned** by `offline/screen-briefs.mjs`

- **`Select a PO...`** and **`Select a Vendor first`** — read · auto · seen
  - from: `InvoiceForm.js:1083`, the two arms of a ternary in a JSX expression
    container
  - names: `Purchase Orders`, `Vendors`
  - held: quoted by `invoices-new.md`. The row's own disabled select cites this one by name for
    its shorter form — see `Pick this charge's PO first`

- **`Show all / search closed POs`** — read · auto · seen
  - from: `InvoiceForm.js:1097`, JSXText in a `label`
  - names: `Purchase Orders`. **`closed` is not a `Status` value** — an order
    with no uninvoiced quantity left, which is `getOpenPOs`'s inverse
  - held: quoted by `invoices-new.md`

- **`Remove`** — read · auto · seen
  - from: `InvoiceForm.js:1106`, JSXText. **The same word as the item row's own
    Remove**, at `:1641`, for a different object
  - names: no table
  - held: quoted by `invoices-new.md`

### The charges

- **`Items`** — read · auto · seen
  - from: `InvoiceForm.js:1394`, JSXText in a heading
  - names: `Invoice Items`. **`item` names a row on four tables and this is one
    of the four** — #288's own finding
  - held: quoted by `invoices-new.md`

- **`Select a PO above to add items.`** — read · auto · seen
  - from: `InvoiceForm.js:1398`, the first arm of a nested ternary in a container
  - names: `Purchase Orders`, `Invoice Items`
  - held: quoted by `invoices-new.md`

- **`Couldn't load this PO's items — try re-selecting the PO.`** — read
  · auto · unreachable
  - from: `InvoiceForm.js:1400`, the second arm of the same ternary
  - names: `Purchase Orders`, `PO Items`
  - held: not quoted

- **`Loading PO items...`** — read · auto · reachable
  - from: `InvoiceForm.js:1401`, the third arm of the same ternary
  - names: `PO Items`
  - held: not quoted

- **`{itemName}{ — size}{ (Uninvoiced: n)}`** — read · auto · seen
  - from: `InvoiceForm.js:1494-1498`, four containers and two conditional
    template fragments inside one `<option>`
  - names: `PO Items`. `Uninvoiced` is `Qty` less `Invoiced Qty`, and it is the
    same word as `Materials."Uninvoiced Qty"` on purpose
  - held: `naming.md` carries `(Uninvoiced: N)` as a screen word with the
    subtraction behind it; no brief quotes it and nothing pins it

- **`Size: {size|—} · Unit: {unit|—}`** — read · auto · reachable
  - from: `InvoiceForm.js:1512`, JSXText around two containers, each with an em
    dash fallback
  - names: `PO Items`, frozen reference copies. **The em dash is a value here,
    not a placeholder** — the same rule `_shared.md` states for `absent`
  - held: not quoted

- **`Every item on this purchase order is already on another charge of this
  invoice. Pick a different purchase order for this charge, or remove it.`** —
  read · auto · reachable
  - from: `InvoiceForm.js:1522-1524`, JSXText
  - names: `PO Items` for `item`, `Purchase Orders`, `Invoice Items` for
    `charge`. **Both words for a row are in one sentence** — the shape #288 was
    raised for
  - held: not quoted

- **`Select a PO above`** and **`Pick this charge's PO first`** — read ·
  auto · seen
  - from: `InvoiceForm.js:1553`, the two arms of a ternary inside a JSX
    expression container. **This is the string #288 names as the shape the #254
    census could not see**
  - names: `Invoice Items` for `charge`, `Purchase Orders`
  - held: quoted by `invoices-new.md`, and pinned by nothing

- **`Qty`** — read · auto · seen
  - from: `InvoiceForm.js:1559`, a `placeholder` attribute
  - names: `Invoice Items`. Plain `Qty` for a row's own quantity, per the
    symmetry every child table keeps
  - held: quoted by `invoices-new.md`

- **`Unit Price`** — read · auto · seen
  - from: `InvoiceForm.js:1570`, a `placeholder` attribute
  - names: `Invoice Items`
  - held: quoted by `invoices-new.md`

- **`Edit`** — read · auto · seen
  - from: `InvoiceForm.js:1584`, JSXText
  - names: no table
  - held: quoted by `invoices-new.md`

- **`Cancel`** — read · auto · seen
  - from: `InvoiceForm.js:1594`, JSXText. **One of four `Cancel`s on this
    screen** — the others are at `:1739`, `:1767` and in the modal
  - names: no table
  - held: quoted by `invoices-new.md`

- **`PO`** — read · auto · seen
  - from: `InvoiceForm.js:1607`, JSXText in an `<option>`. **The same word as
    the header's label** at `:1146`
  - names: `Purchase Orders`
  - held: not quoted

- **`Qty ({qty}) exceeds this PO Item's uninvoiced quantity ({n}) — not blocked,
  but worth a note below.`** — read · auto · reachable
  - from: `InvoiceForm.js:1619-1620`, JSXText around three containers
  - names: `PO Items`. **It says `PO Item` where the settled word is `ordered
    item`** — a divergence for the sweep, not fixed here
  - held: quoted by `invoices-new.md`

- **`Remark — why this differs from the PO`** — read · auto · reachable
  - from: `InvoiceForm.js:1625`, a `placeholder` attribute
  - names: `Invoice Items`, the `Remark` field — a discrepancy note here, free
    text on `PR Items`
  - held: quoted by `invoices-new.md`

- **`Amount (preview): {n}`** — read · auto · seen
  - from: `InvoiceForm.js:1633`, JSXText and one container
  - names: `Invoice Items`, the `Amount` formula. `(preview)` says this is not
    the stored figure
  - held: quoted by `invoices-new.md`

- **`Remove`** — read · auto · seen
  - from: `InvoiceForm.js:1641`, JSXText
  - names: `Invoice Items`
  - held: quoted by `invoices-new.md`

- **`+ Add item`** — read · auto · seen
  - from: `InvoiceForm.js:1655`, JSXText
  - names: `Invoice Items`
  - held: quoted by `invoices-new.md`

- **`Items total (preview): {n}`** — read · auto · seen
  - from: `InvoiceForm.js:1657`, JSXText and one container
  - names: `Invoices`, the `Items Subtotal` rollup. **A screen word that is not
    the field name**
  - held: quoted by `invoices-new.md`

### The totals

- **`Shipping Fee`** — read · auto · seen
  - from: `InvoiceForm.js:1681`, JSXText in a `label`
  - names: `Invoices`
  - held: quoted by `invoices-new.md`

- **`PO's Shipping Fee: {n}`** — read · auto · reachable
  - from: `InvoiceForm.js:1705`, JSXText with an `&apos;` entity and one
    container
  - names: `Purchase Orders`, the frozen copy taken at generation
  - held: quoted by `invoices-new.md`

- **`Shipping Fee ({n}) doesn't match the PO's Shipping Fee ({n}) — double-check
  before submitting.`** — read · auto · reachable
  - from: `InvoiceForm.js:1710-1712`, JSXText around two containers
  - names: `Invoices`, `Purchase Orders`
  - held: not quoted. **Its own threshold, and not `lib/variance.js`'s** — the
    header comparison beside it shares the module's predicate and this one does
    not

- **`Tariff`** / **`Sales Tax`** — read · auto · reachable
  - from: `InvoiceForm.js:1719` and `:1747`, JSXText in labels
  - names: `Invoices`. `Sales Tax` is on `Invoices` only — neither a request nor
    an order states a tax
  - held: quoted by `invoices-new.md`

- **`Cancel`** — read · auto · seen
  - from: `InvoiceForm.js:1739` and `:1767`, JSXText
  - names: no table
  - held: quoted by `invoices-new.md`

- **`Vendor's Stated Total`** — read · auto · seen
  - from: `InvoiceForm.js:1774`, JSXText with an `&apos;` entity
  - names: `Invoices`, the `Amount Due` field. **A deliberate divergence** — the
    base carries two totals and the field name only tells them apart by
    convention, which is why the gloss is on the screen
  - held: quoted by `invoices-new.md`; `naming.md` carries the pair

- **`+ Add Tariff`** / **`+ Add Sales Tax`** — read · auto · seen
  - from: `InvoiceForm.js:1801` and `:1810`, JSXText
  - names: `Invoices`
  - held: quoted by `invoices-new.md`

- **`Calculated total: {n}`** — read · auto · seen
  - from: `InvoiceForm.js:1842`, JSXText and one container. **The sum is this
    form's own** — there is no rollup in a browser
  - names: `Invoices`, the `Calculated Total` formula
  - held: quoted by `invoices-new.md`

- **`Vendor's Stated Total ({n}) doesn't match the calculated total ({n}) —
  double-check before submitting.`** — read · auto · reachable
  - from: `InvoiceForm.js:1851` calls `VARIANCE_COPY.headerBeforeSaving`, at
    `lib/variance.js:207`
  - names: `Invoices`
  - held: quoted by `invoices-new.md`; **pinned** by `offline/screen-briefs.mjs`
    on the fragment `doesn't match the calculated total`. `naming.md` records
    that its tense is the reason it is a third string rather than a reuse

### Submitting

- **`Submitting...`**, **`Uploading file...`**, **`Attach the invoice file to
  continue`**, **`Create Invoice`** — read · auto · seen
  - from: `InvoiceForm.js:1922-1928`, a three-deep nested ternary inside a JSX
    expression container
  - names: `Invoices`
  - held: `Create Invoice` is quoted by `invoices-new.md`; the other three are
    not

### The change-confirmation dialog

- **`Changing the {Vendor|PO} will clear the items you've entered so far.
  Continue?`** — read · auto · reachable
  - from: `InvoiceForm.js:181`, a template literal returned by
    `confirmChangeMessage`; the subject is the literal `"Vendor"` at `:708` or
    `"PO"` at `:782` and `:794`
  - names: `Vendors`, `Purchase Orders`, `Invoice Items`
  - held: quoted by `invoices-new.md`

- **`Continue`** / **`Cancel`** — read · auto · seen
  - from: `components/ConfirmDialog.js:11-12`, default parameter values.
    **Attributable only by following the import into a shared component**
  - names: no table
  - held: quoted by `invoices-new.md`

- The dialog's `title` is **never rendered on this screen**: it has no default
  and this screen passes none, so the heading is absent rather than empty.
  Recorded because a design that draws a titled dialog here is drawing something
  the code does not produce.

### The direct-purchase modal

- **`Record a direct purchase`** — read · auto · seen
  - from: `InvoiceForm.js:1239` renders `DIRECT_PURCHASE_COPY.modal.heading`, at
    `lib/directPurchase.js:75`
  - names: `Direct Purchases` — the table's own name, so the mark points at the
    record rather than borrowing a word
  - held: quoted by `invoices-new.md`; **pinned**

- **`This records {invoice label} as material the site bought directly, with no
  PO in this app to charge it to. The file you attached becomes the evidence, and
  the site raises the purchase request from it: what was bought, which part of
  the job it was for, and who signs are all theirs to fill in, because the
  invoice says none of them.`** — read · auto · seen
  - from: `InvoiceForm.js:1241` calls `DIRECT_PURCHASE_COPY.modal.summary`, at
    `lib/directPurchase.js:96`
  - names: `Direct Purchases`, `Purchase Orders`, `Purchase Requests`, `Lines`
    for the part of the job — **named around the barred word on purpose**
  - held: quoted by `invoices-new.md`

- **`this invoice`** — read · **hand** · seen
  - from: `lib/directPurchase.js:55`, the fallback of a `||` inside
    `invoiceLabel`, **a helper arrow function outside the copy constant**, so the
    extractor's walk over the constant's members does not reach it. **Found by
    neither counting pass** — the browser pass read it on the screen
  - names: `Invoices`
  - held: quoted by `invoices-new.md`

- **`This invoice cannot be entered until the request is approved and its
  purchase order signed, so nothing else you have typed on this form is kept.`**
  — read · auto · seen
  - from: `InvoiceForm.js:1242` renders
    `DIRECT_PURCHASE_COPY.modal.abandons.text`, at `lib/directPurchase.js:132`
  - names: `Invoices`, `Purchase Requests`, `Purchase Orders`
  - held: quoted by `invoices-new.md`

- **`Job`** — read · auto · seen
  - from: `InvoiceForm.js:1259`, JSXText in a `label`
  - names: `Jobs`
  - held: quoted by `invoices-new.md`

- **`Pick the job it was bought for — that is what puts the record in front of
  the right site. {The invoice does not say it; the site does.}`** —
  read · auto · seen
  - from: `InvoiceForm.js:1262` calls `DIRECT_PURCHASE_COPY.modal.job`, at
    `lib/directPurchase.js:109`
  - names: `Jobs`, `Invoices`
  - held: quoted by `invoices-new.md`

- **`Loading jobs...`** and **`Select a Job`** — read · auto · seen
  - from: `InvoiceForm.js:1273-1277`, two arms of a nested ternary in a container
  - names: `Jobs`
  - held: quoted by `invoices-new.md`

- **`Couldn't load the jobs — close this and try again`** — read · auto ·
  unreachable
  - from: `InvoiceForm.js:1276`, the middle arm of the same ternary. **Split from
    the pair above because it is the grade that differs** — reaching it means
    forcing `GET /api/jobs` to fail
  - names: `Jobs`
  - held: quoted by `invoices-new.md`

- **`Notes`** — read · auto · seen
  - from: `InvoiceForm.js:1289`, JSXText in a `label`
  - names: `Direct Purchases`, the `Notes` field
  - held: quoted by `invoices-new.md`

- **`Anything you learned on the telephone — who bought it, what it was for —
  goes in the note. It is the only thing the site's list can say about what this
  was, since no items are recorded here.`** — read · auto · seen
  - from: `InvoiceForm.js:1291` renders `DIRECT_PURCHASE_COPY.modal.notes.text`,
    at `lib/directPurchase.js:115`
  - names: `Direct Purchases`
  - held: quoted by `invoices-new.md`

- **`Pick the vendor at the top of the form first.`**, **`Attach the vendor's
  invoice first — the record is that document.`**, **`Pick the job it was bought
  for.`** — read · **hand** · seen
  - from: `InvoiceForm.js:1306` renders `DIRECT_PURCHASE_COPY.blocked[blocked]`,
    at `lib/directPurchase.js:143`. **A computed member** — shape 1. The middle
    sentence is also rendered by `actions.js:402`, there by a literal key
  - names: `Vendors`, `Invoices`, `Jobs`
  - held: not quoted, and nothing pins them

- **`Cancel`**, **`Recording...`**, **`Record it`** — read · auto · seen
  - from: `InvoiceForm.js:1317` and `:1324`;
    `DIRECT_PURCHASE_COPY.modal.cancel` and `.confirm` at
    `lib/directPurchase.js:138-139`, with `Recording...` a literal in the
    ternary beside them
  - names: `Direct Purchases`
  - held: quoted by `invoices-new.md`

### What the create action refuses

All rendered in one paragraph at `InvoiceForm.js:1866`. **Ten of the fourteen are
unreachable through this screen**, because a `required` control or a disabled
button fires first — which is what makes this the section a design must not draw
room for.

- **`Not authorized.`** — read · auto · unreachable
  - from: `actions.js:40` and `:373`, one literal each, in the two wrappers'
    refusal callbacks
  - names: no table
  - held: quoted by `invoices-new.md`

- **`Select a Vendor.`** — read · auto · unreachable
  - from: `actions.js:71`
  - names: `Vendors`
  - held: not quoted. **The screen's own option says the same thing without the
    full stop**

- **`Issue Date is required.`** / **`Amount Due is required.`** — read ·
  auto · unreachable
  - from: `actions.js:72-73`
  - names: `Invoices`. The second names the FIELD, while the label above it says
    `Vendor's Stated Total`
  - held: not quoted

- **`Attach the invoice file.`** — read · auto · unreachable
  - from: `actions.js:79`
  - names: `Invoices`
  - held: not quoted

- **`Add at least one item.`** — read · auto · unreachable
  - from: `actions.js:80`
  - names: `Invoice Items`
  - held: not quoted

- **`Every item needs a name, quantity, and unit price.`** — read · auto
  · unreachable
  - from: `actions.js:83`
  - names: `Invoice Items`
  - held: not quoted

- **`Every item needs a PO — pick one at the top or per item.`** — read
  · auto · unreachable
  - from: `actions.js:86`
  - names: `Invoice Items`, `Purchase Orders`
  - held: not quoted

- **`Every item needs an ordered item from its PO.`** — read · auto ·
  reachable
  - from: `actions.js:96`
  - names: `Invoice Items`, `PO Items`, `Purchase Orders`. **The one string on
    this screen that says `ordered item`**
  - held: quoted by `invoices-new.md`

- **`Every charge's quantity has to be a whole number.`** and **`Every charge's
  unit price has to be a whole number of cents.`** — read · auto · reachable
  - from: `actions.js:106` and `:109` render `CHARGE_PRECISION_COPY.qty` and
    `.unitPrice`, at `lib/variance.js:115-116`
  - names: `Invoice Items` — **the two strings on this screen that call a row a
    `charge`**
  - held: quoted by `invoices-new.md`; both **pinned**

- **`One of the selected POs no longer exists. Reload the form and try again.`**
  — read · auto · unreachable
  - from: `actions.js:138`
  - names: `Purchase Orders`
  - held: not quoted

- **`{ids} was withdrawn, so an invoice can't be linked to it.`** and **`{ids}
  were withdrawn, so an invoice can't be linked to them.`** — read ·
  auto · reachable
  - from: `actions.js:146-147`, the two arms of a ternary inside a template
    literal
  - names: `Purchase Orders`, `Invoices`
  - held: not quoted

- **`Something went wrong creating the invoice. Please try again.`** — read ·
  auto · unreachable
  - from: `actions.js:259`
  - names: `Invoices`
  - held: not quoted

- **`Couldn't record the direct purchase. Please try again.`** — read ·
  auto · unreachable
  - from: `actions.js:427`
  - names: `Direct Purchases`
  - held: not quoted

### Values the screen switches on

None is read by a person; all are inventoried because a closed vocabulary is
invisible to a vocabulary check.

- **`pdf` · `manual`** — switch · auto — `InvoiceForm.js:172-173`, the `TABS`
  ids
- **`info` · `warning`** — switch · auto — `InvoiceForm.js:413`, `:427`,
  `:434`,
  `:449`, `:476`; detection's `level`, which picks the paragraph's color
- **`idle` · `uploading` · `done` · `error`** — switch · auto — the file's
  status, at `:237`, `:348`, `:355`, `:358`
- **`idle` · `loading` · `done` · `error`** — switch · auto — a slot's search
  status, at `:61` and through `handleSlotSearchChange`
- **`loading` · `done` · `error`** — switch · auto — a PO's item cache, at
  `:658`, `:668`, `:672`
- **`idle` · `loading` · `done` · `error`** — switch · auto — the modal's job
  list, at `:299` and in `openDirectPurchase`
- **`dp-summary` · `dp-job` · `dp-notes` · `dp-abandons` · `dp-recorded`** —
  switch · auto — the `key` on every direct-purchase copy entry, in
  `lib/directPurchase.js`
- **`unsigned-detected`** — switch · auto — `lib/poUnsigned.js:155`
- **`no-vendor` · `no-file` · `no-job`** — switch · auto —
  `DIRECT_PURCHASE_BLOCKED`, the keys behind the runtime-keyed refusal above.
  **These are the values a `blocked[key]` lookup takes**, so they are what a
  sweep would have to read to find the sentences
- **`detected` · `search`** — switch · auto — `PO_ORIGIN`, which decides
  whether
  a slot still offers an order
- **`matched` · `none`** — switch · auto — `PAIRING`, read at `actions.js:306`
  and sent onward in the redirect's query string rather than rendered here
- **`poRecordId`** — switch · auto — `InvoiceForm.js:885`, the one field name
  `updateItem` branches on. A form field's name rather than a vocabulary, and
  inventoried anyway because the rule that finds a closed vocabulary is
  structural: it is a string compared with `===`, which is all `billed-more` was

## Attributed here and not rendered

**What the extractor puts on this screen that no reader of it sees.** Three, each
with the reason, because an over-reach left unnamed reads as a string the screen
says. This is the third of the three figures at the foot of this file.

- `Request failed` — `InvoiceForm.js:665`, thrown when the ordered-item fetch
  returns a bad status and caught two lines later by its own `catch`, which logs
  and sets an error state. The screen's own sentence is what a reader gets. The
  extractor cannot tell a thrown message that is rendered from one that is
  swallowed, and on this screen both exist.
- `The direct purchase` — `lib/directPurchase.js:239`, the other fallback in the
  confirmation's template. Unreachable here: the paragraph renders only when the
  id is present, so the value it stands in for cannot be absent.
- `⚠ Check the total` — `lib/variance.js:175`. Attributed because the member walk
  unions what this screen reaches with what the constant's own module reaches, so
  that `poOptionLabel`'s use of `UNSIGNED_COPY.option` is not lost. The cost is
  visible here and is one string: this screen renders `headerBeforeSaving` and
  no other member of that constant.

## The measurement

The hand list was written first and whole, from the four files, and the extractor
was not run until it was finished. It then found **127 read strings and 13 switch
values across 25 files**, against 106 entry bullets here.

| | count | what it is |
|---|---|---|
| hand-only, read | 4 | the three runtime-keyed refusals, and `this invoice` |
| hand-only, switch | 10 | `manual`, `info`, `warning`, `no-vendor`, `no-file`, `no-job`, `detected`, `search`, `matched`, `none` |
| tool-only, real | 1 | `that job` |
| tool-only, unrendered | 3 | named in the section above |
| found by neither | 1 | `this invoice`, read off the screen in a browser |

**One hand miss on 2,500 lines, and `/login`'s zero is what makes that figure
mean something.** On a 103-line screen the two passes agreed exactly; here the
extractor found one string a reader can see that the hand pass did not — a `??`
fallback inside a template, in a module two files away from the screen. It is
recorded as its own entry above. That is the honest size of the hand pass's error
bar, and it is small because the extractor was built to look where reading tires:
the hand pass read every sentence and skipped what stood behind two operators.

**Three of the four hand-only read strings are not a miss either.** They are shape
1, the runtime-keyed member, and no source-reading tool will attribute them: the
key is a variable. The entry names all three and says which control they belong
to.

**The fourth is the one figure that matters most here, because neither pass
produced it.** `this invoice` was read off the screen during the browser pass that
was checking conditions, not counting strings — a `||` fallback in a helper beside
a copy constant, which the extractor's member walk does not enter and which the
hand pass slid over for the same reason it slid over `that job`. Two of the three
passes over this screen missed it and the third was not looking for it. **That is
the honest state of this file: not complete, but with its own incompleteness
measured in three directions rather than one.**

**The ten hand-only switch values are the extractor's clearest limit.** Each is
declared in an array or an object — `TABS`, `PO_ORIGIN`, `PAIRING`,
`DIRECT_PURCHASE_BLOCKED` — and never compared with `===` inside these files, and
the extractor finds a closed vocabulary's compared members and its `key`
properties only. #274's four `billed-` values were `key` properties and would be
caught; these would not.

**What neither pass counted is above, under "What is not counted here".** All six
shapes reach this screen, and the largest of them by far is shape 4: most of this
action's refusals are unreachable because the browser's own validation fires
first, so the words a reader actually meets on a bad submit are Chrome's rather
than this app's.
