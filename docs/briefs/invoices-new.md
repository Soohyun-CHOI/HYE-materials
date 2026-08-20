# New invoice

Route: `/invoices/new`
Who reaches it: Admin only. Recording a vendor's invoice is office work.

## What it answers

Nothing about existing data — it is a create form. Its job is to get a vendor's
paper invoice into the system **line by line against the orders it bills**, which
is the reconciliation the whole app exists to make possible. This is the most
complex form in the app by a wide margin, and almost all of that complexity is one
thing: an invoice can bill more than one order, and each of its charges has to be
matched to a specific ordered item.

The reader is holding the vendor's document. Everything on the form is a
transcription of something printed on it, plus the app's attempt to guess which
orders it refers to.

## What it always carries

**identity.** The heading `New Invoice`, and a link to the invoice list.

**action — the vendor,** a required dropdown, first because it narrows everything
below it.

**action — the vendor's own invoice number,** with the placeholder
`The vendor's own invoice number, as printed on their document`. The placeholder is
doing real work: this field is the vendor's numbering, not the app's, and the app
generates its own ID separately.

**action — issue date and due date.**

**action — `Invoice File`,** its own section. Required: the submit button cannot
be pressed without it, and says so — see below.

**action — one or more order slots.** Each slot is labeled `PO` and holds one
order, chosen from a dropdown. A `+ Add another PO` control appends a slot; each
slot past the first can be removed. **One slot holds one order and no order can be
picked twice**, which is the rule the whole picker is built around.

**Each slot has its own independent search toggle,** labeled
`Show all / search closed POs`. Off, the dropdown offers orders with something
still uninvoiced. On, the slot gets a search box with the placeholder
`Search all POs by number...`, which can reach any order including fully invoiced
ones.

**action — `Items`.** One row per charge: the ordered item chosen from a dropdown
scoped to the slots' orders, then quantity, unit price, and a remark. The ordered
item dropdown is sorted so that items with something still uninvoiced come first.

**Size and Unit are not editable anywhere on this form.** They are frozen copies
taken from the ordered item, shown for reference. A mismatch there means the wrong
ordered item was picked, not that the value needs correcting.

**action — the money row:** `Shipping Fee` and `Amount Due` side by side.
`Amount Due` is the vendor's stated total and the app never overwrites it.

**evidence — a calculated total,** stated under the money row as
`Calculated total (Items + Shipping):`, with `+ Tariff` added to the label when a
tariff is present. It is a **sanity check rather than enforcement** — the form does
not refuse a mismatch, it shows the reader both numbers.

**action — the submit button,** full width, and its label is the form's validation
state: `Attach the invoice file to continue` until a file is attached,
`Uploading file...` during upload, `Create Invoice` when ready, `Submitting...`
while saving. It is disabled in every state but the last.

## What it carries only sometimes

**When a file is attached, the app tries to read the order numbers off it.**
Detection runs on any upload and is best-effort, so it always produces a message,
and the message has several distinct voices at two levels — informational, or a
warning. They must stay distinguishable from each other:

- nothing found: `Auto-detection didn't find a PO number in this file — select the
  PO manually below.`
- an order found and applied, named in the message.
- an order found that has been **withdrawn** — reported as a warning, and its
  wording has to be tellable apart from a failed detection.
- an order found that the President has **not signed** — a warning stating that it
  was still selected, because an invoice can be recorded against an unsigned
  order. The wording is the app's shared unsigned-order copy, not this form's.
- an order found with nothing left uninvoiced.
- several orders found: one item row is scaffolded per order.

**When an order in a dropdown is unsigned:** the option's own label carries the
word `unsigned`, lowercase, appended. So the state is visible at the moment of
choosing, not only after.

**When the file is uploading, uploaded or failed:** three different lines in the
file section — a gray `Uploading {filename}...`, a green confirmation, or a red
`Upload failed: {error}. Pick a different file to continue`. And `No file attached
yet.` before any of them.

**When a slot's search is running or fails:** `Searching...`, `Search failed — try
again.`, or `No matching POs.` inside the dropdown.

**When one order is selected and its shipping fee differs from what was typed:** a
warning naming both figures and saying to double-check before saving. When exactly
one order is selected and the fees agree, the order's own shipping fee is shown for
reference instead. **When more than one order is selected, neither appears** —
there is no single order shipping fee to compare against.

**When the reader adds a tariff:** a `+ Add Tariff` control reveals a `Tariff`
field between shipping fee and amount due, with a control to remove it again. The
money row goes from two columns to three. Absent by default, and revealed only by
that control.

**When a charge differs from what its order agreed:** the remark field is where the
reader says why, and its placeholder says so — `Remark — why this differs from the
PO`. The field is always present; the placeholder is what names its purpose.

**A free-text item, with no ordered item behind it, is currently switched off** by
a flag in this file. The backend path for it is untouched, so re-exposing it is
flipping that flag — which means a design should know the option exists and is
hidden, not absent.

## What must agree elsewhere

**`Amount Due` carries the gloss `(vendor's stated total)` on the invoice
detail**, and it is the same field. This form does not repeat the gloss, because
the reader is looking at the vendor's document while they type it.

**`Calculated Total` is the invoice detail's word** for the same computation, and
the two must not diverge — the detail's red `⚠ Check the total` box is what fires
when the two figures disagree after saving. This form shows the same comparison
before saving and does not block on it.

**The unsigned-order wording is shared with every other place an order is offered
for an invoice.** The judgment runs on the server and the client reads only a
boolean, so the form cannot invent its own phrasing for it.

**Size and Unit being read-only here is what makes them reference data on the
invoice detail too.** Neither screen offers an edit path, and the same reasoning
covers both: a mismatch means the wrong ordered item was picked.

**The uninvoiced-first sort uses the same rule the base uses** for its own
`Has Uninvoiced Qty` field, so the form's ordering and the order detail's `(over)`
marks cannot disagree about what counts as still open.

**One slot, one order is the picker's rule** and it is also what makes the invoice
detail's `Purchase Orders` list unambiguous. A design that allowed one order in two
slots would make that list meaningless.

**A file is required, as the packing list photo is on the delivery form.** In both
cases the document is what makes the record a record.
