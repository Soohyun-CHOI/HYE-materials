# New invoice

Route: `/invoices/new`
Who reaches it: Admin only. Recording a vendor's invoice is office work.

## What it answers

Nothing about existing data — it is a create form. Its job is to get a vendor's
paper invoice into the system **charge by charge against the orders it names**, which
is the reconciliation the whole app exists to make possible. This is the most
complex form in the app by a wide margin, and almost all of that complexity is one
thing: an invoice can charge more than one order, and each of its charges has to be
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

**action — `No PO for this invoice?`,** a small text control on the same row as
`+ Add another PO`, under the order slots. It opens the direct-purchase modal
below. **It is always present, and that is a decision rather than an oversight:**
one of the two dead ends it answers — an order was found, and its ordered items
are not what this invoice charges for — is a judgment only the reader can make,
so there is no state the app could reveal the control on. It sits with the order
picker because that is where a reader runs out of orders.

**The label names what this app is missing, not what the site failed to do.**
The site placed an order; that is what buying from a vendor is. What is absent
is the `Purchase Orders` row, which is also the only thing `order` may mean on
a screen, so the question asks about the gap in the app rather than about the
purchase.

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
`Calculated total:` and nothing more. It is a **sanity check rather than
enforcement** — the form does not refuse a mismatch, it shows the reader both
numbers.

**The label names the figure and not its terms, which is a decision and not an
omission.** It used to enumerate them — `Calculated total (Items + Shipping):`,
gaining `+ Tariff` when a tariff was present — and a term list with optional
members has only two states, both wrong: fixed, it omits a term that is in the
sum; complete, it grows a word per term, and two optional terms already make four
spellings of one label. So the terms are named where their figures are, which is
the money row's own labels plus the reveal controls for the terms that are absent.
What the list was really keeping out was `Vendor's Stated Total`, which sits in
that same row and is the one figure the sum must exclude; what carries that now is
`Calculated` against `Stated`, and the mismatch line that puts the two figures on
opposite sides of one comparison. A redesign that wants to say more here should
say it on the stated-total field, not by putting a term list back on this one.

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
field between shipping fee and amount due, with a control to remove it again.
Absent by default, and revealed only by that control.

**When the reader adds a sales tax:** the same thing again, `+ Add Sales Tax`
revealing a `Sales Tax` field. It sits after `Tariff` and before amount due —
the order the vendor's own document prints them in, a duty being a cost of the
goods and a tax being assessed on the sale, and the same order the invoice
detail's totals footer uses.

**The two are independent, so the money row has four arrangements** — neither
term, either one, or both — and the reveal controls are present exactly for the
terms that are absent, so the pair also states what this invoice is being
recorded without. This screen asks only for what the document in front of the
reader actually states, which is why both terms are hidden by default here and
both are always visible on the edit screen. The two conventions differ on
purpose; neither is drifting toward the other.

**When a charge differs from what its order agreed:** the remark field is where the
reader says why, and its placeholder says so — `Remark — why this differs from the
PO`. The field is always present; the placeholder is what names its purpose.

**A free-text item, with no ordered item behind it, does not exist (#278).** It
was hidden behind a flag in this file with its backend path left open, so a
design was told the option existed and was merely hidden; the flag, the path and
every branch that described the result are gone. Only a purchase request takes
typed items. **A second box survived that removal and went in #272**: the one a
row showed before its own order was picked, which the header reaches whenever it
holds two orders. **Nothing on this screen types an item name.** Every charge
takes its name from the ordered item it is matched to, and a row that cannot be
matched yet says which choice is missing instead of offering a box.

**When a charge's purchase order has no ordered item left to pick:** the row says
so in amber — every item on that order is already on another charge of this
invoice — and names the two ways out, a different order or removing the charge.
One ordered item belongs to one charge of one invoice (#91), so a second charge
on an exhausted order has nothing to choose, and this is where a reader is told
rather than refused on submit.

**When a row has no purchase order of its own yet:** its item control is a
disabled dropdown reading `Pick this charge's PO first`, and `Select a PO above`
while the whole section is still waiting for one. The words are short because
the long form of the same fact is the section's own message above the rows.

**When the direct-purchase control is used:** a modal headed
`Record a direct purchase`, over the form rather than replacing it. It states
what will be recorded and what will not — the file becomes the evidence, and
what was bought, which part of the job it was for and who signs are the site's
to fill in — and then that **nothing else typed on this form is kept**, because
the invoice cannot be entered until the request is approved and its purchase
order signed. It asks for two things the document cannot supply: the **Job**, required,
which is what puts the record in front of a site and which the office learns by
telephone; and a free-text **note**, which is the only thing the site's list can
say about what was bought, since no items are recorded. The job list is fetched
when the modal opens, not when the page loads.

**When something is still missing, the modal says which, and in the order a
reader would fix it:** the vendor at the top of the form, then the attached file,
then the Job inside the modal. The confirm button is disabled while any of them
is. The same rule answers the server, so the button never offers what the action
declines.

**When the reader has just recorded one:** a green line above the form, naming
the record and the job it is waiting on, over an empty form. There is nothing to
return to — the invoice that started it cannot be entered yet — and the office's
likely next act is the next invoice.

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
cases the document is what makes the record a record. **The direct purchase takes
the same file for the same reason** — it is the whole evidence that a purchase
happened — and it is the one thing the modal will not proceed without.

**The direct purchase leaves this screen and lands on the purchase request list.**
What is recorded here appears on a strip above `/prs`, on the job picked in the
modal, for someone at that site to raise the request from. The office's part ends
at the green line; nothing on this screen changes when the request is raised.
