# New invoice

Route: `/invoices/new`
Who reaches it: Admin only. Recording a vendor's invoice is office work.

## What it answers

Nothing about existing data — it is a create form. Its job is to get a vendor's
paper invoice into the system **item by item against the orders it names**, which
is the reconciliation the whole app exists to make possible. This is the most
complex form in the app by a wide margin, and almost all of that complexity is one
thing: an invoice can charge more than one order, and each of its items has to be
matched to a specific ordered item.

The reader is holding the vendor's document. Everything on the form is a
transcription of something printed on it, plus the app's attempt to guess which
orders it refers to.

## What it always carries

**identity.** The heading `New Invoice`, and a link to the invoice list.

**The form is two tabs, `PDF Upload` and `Manual Entry`, and both are always
present.** The tab changes nothing but the order of four blocks — the file
section, the header fields, `Items`, and the totals — so every field exists under
either and switching never loses what is typed. `PDF Upload` leads with the file
and whatever it auto-fills below; `Manual Entry` leads with the fields to fill in
by hand and puts the still-required file last. **This is the outermost structure
on the screen**, and a design that draws one sequence of blocks has drawn one of
the two.

**action — the vendor,** a required dropdown, first because it narrows everything
below it.

**action — the vendor's own invoice number,** with the placeholder
`The vendor's own invoice number, as printed on their document`. The placeholder is
doing real work: this field is the vendor's numbering, not the app's, and the app
generates its own ID separately.

**action — issue date and due date.**

**action — `Invoice File`,** its own section. Required: the submit button cannot
be pressed without it, and says so — see below. A line under the heading says why:
`The vendor's original invoice document — required, every received invoice is kept
on file.` The section states what happened to the file — see the upload states
below — and, **below 1280px, holds the control that picks it.**

**action — the file's own column, from 1280px up.** A box down the left of the
screen, the height of the viewport, that stays in place as the form is scrolled,
with the file control under it. **The box is where the file is attached and where
it is then drawn**, at the same size in both states: empty it says
`Drop the invoice file here, or click to choose one.` and takes a file dropped on
it or opens the file dialog when clicked; with a file it holds the document
itself. So the reader is shown where the document will go rather than told, and
the page does not rearrange itself when they attach one. At that width the
`Invoice File` section keeps its heading, its line and its states, and does not
carry the control.

**The column is drawn before there is a file, and a design may not make it
conditional.** It is the file's control, not a preview of one — an empty state is
the normal state of a control. What is conditional is what the box holds.

**The form is still what the keyboard reaches first.** The document is to the left
and the form to the right, which is the reading order; the focus order is the
other way round, because the pane holds one control and a document while the form
is the work.

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

**action — `Items`.** One row per invoice item: the ordered item chosen from a dropdown
scoped to the slots' orders, then quantity, unit price, and a remark. The ordered
item dropdown is sorted so that items with something still uninvoiced come first,
and **each option carries that quantity** — the item's name, its size, and
`(Uninvoiced: N)`.

**The rows are a growable list.** A `+ Add item` control appends one, and every
row carries a `Remove` once there are two or more. Each row states its own
`Amount (preview):` and the section foot states `Items total (preview):`, both
computed from what is typed; `preview` is the word the edit screen uses for the
same thing.

**Size and Unit are not editable anywhere on this form.** They are frozen copies
taken from the ordered item, shown for reference. A mismatch there means the wrong
ordered item was picked, not that the value needs correcting.

**action — the money row:** `Shipping Fee` and `Amount Due` side by side.
`Amount Due` is the vendor's stated total and the app never overwrites it.

**evidence — a calculated total,** stated under the money row as
`Calculated total:` and nothing more. It is a **sanity check rather than
enforcement** — the form does not refuse a disagreement, it shows the reader both
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
`Calculated` against `Stated`, and the warning below that puts the two figures on
opposite sides of one comparison. A redesign that wants to say more here should
say it on the stated-total field, not by putting a term list back on this one.

**When the two totals disagree:** a warning under the calculated total, reading
`Vendor's Stated Total (N) doesn't match the calculated total (N) — double-check
before submitting.` **The threshold is half a cent, which is the same rule the
saved record's own red box uses** — so a reader warned here finds the mark on the
invoice afterwards, and silence here means the two figures agree as currency
rather than that the app decided the gap was small enough to ignore. The form
carried its own looser threshold until #254 and the two could disagree. It does
not block: the vendor's stated total is what gets stored either way.

**action — the submit button,** full width, and its label is the form's validation
state: `Attach the invoice file to continue` until a file is attached,
`Uploading file...` during upload, `Create Invoice` when ready, `Submitting...`
while saving. It is disabled in every state but the last.

## What it carries only sometimes

**When the reader is not an Admin:** the form does not exist. The page is one
centered line, `Not authorized. This page is Admin-only.`, and nothing on it
suggests what would otherwise be here.

**When the box holds a file, it is drawn the way the file viewer draws one** — an
image for a photograph, a frame for a PDF, and under a PDF the app's standing
sentence about a browser that cannot show one. **The box has no chrome of its
own:** no title, no download, nothing to close. That sentence is the only thing
that makes the two states differ in size, by the one line it takes.

**While a file is dragged over it**, the box says so — currently a darker border
and a tint, and nothing else changes.

**A file the app will not draw leaves the box as it was**, prompt and all: a type
outside PDF, JPEG and PNG, which the control does not offer but a reader can still
arrive with. The viewer says `This file cannot be shown here` in that case and the
box says nothing, because here the box is a control before it is a picture and the
section opposite already names the file that is attached.

**Once the box holds a document it stops taking drops**, and the control under it
is what replaces the file. A frame is another document, so a file dropped on it
goes to the browser rather than to this form and nothing in the app can intercept
it. The control is under the box in every state, which is also what keeps the box
one size.

**Below 1280px the column is not drawn at all** — one column, the control back in
the `Invoice File` section, and the form the same width as above the boundary.
Nothing else about the screen changes.

**All of it is under both tabs**, because the tab only reorders the four blocks.
So `Manual Entry`, which puts the `Invoice File` section last, still has the box
from the first paint — the section's position and the column's are two different
things.

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
- **orders found belonging to two different vendors** — a warning, because
  nothing can be auto-applied and the reader has to pick.
- **a PO-shaped string found that matches no order** — a warning naming what was
  read, and worded to be tellable apart from finding nothing at all.
- **an order found and deliberately not applied**, because a PO or an item was
  already entered. Detection never overwrites work in progress; it names what it
  found and says to pick manually.

**Before a vendor is chosen:** every order slot's dropdown is disabled and its
one option reads `Select a Vendor first`. Once a vendor is chosen the same option
reads `Select a PO...` and the dropdown fills. The order picker is unusable until
the field above it is answered, and it says which field.

**When an order in a dropdown is unsigned:** the option's own label carries the
word `unsigned`, lowercase, appended. So the state is visible at the moment of
choosing, not only after.

**When the file is uploading, uploaded or failed:** three different lines in the
file section — a gray `Uploading {filename}...`, a green confirmation, or a red
`Upload failed: {error}. Pick a different file to continue`. And `No file attached
yet.` before any of them.

**When a picked file is over the size limit:** the same red line, but immediately
and before anything is sent — `This file is larger than the upload limit`, then
the file's own size against the limit. It reuses the failed-upload line and needs
no room of its own. One limit covers every upload in the app, so the sentence is
word for word what the request form and both delivery forms show.

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

**When a row has an ordered item matched to it:** its unit price is **locked** to
the ordered item's own figure, with an `Edit` control beside the field that opens
it and a `Cancel` that reverts it and clears whatever remark was written for the
edit. A price is not freely typed on a matched row, and the two controls are a
per-row affordance a design has to place.

**When a row's quantity exceeds what its ordered item has left uninvoiced:** an
amber line under the row naming both figures and saying it is not blocked but
worth a note. A caution rather than a refusal.

**When an item differs from what its order agreed:** the remark field is where
the reader says why, and its placeholder says so — `Remark — why this differs from
the PO`. The field appears when the price lock is open or the quantity exceeds
what is uninvoiced; the placeholder is what names its purpose.

**A free-text item, with no ordered item behind it, does not exist (#278).** It
was hidden behind a flag in this file with its backend path left open, so a
design was told the option existed and was merely hidden; the flag, the path and
every branch that described the result are gone. Only a purchase request takes
typed items. **A second box survived that removal and went in #272**: the one a
row showed before its own order was picked, which the header reaches whenever it
holds two orders. **Nothing on this screen types an item name.** Every invoice
item takes its name from the ordered item it is matched to, and a row that cannot
be matched yet says which choice is missing instead of offering a box.

**When a row's purchase order has no ordered item left to pick:** the row says so
in amber, in two sentences — `This invoice already charges every ordered item on
this purchase order.` and then the two ways out, a different order or removing the
row. One ordered item belongs to one item of one invoice (#91), so a second row on
an exhausted order has nothing to choose, and this is where a reader is told
rather than refused on submit. **The two sentences are two on purpose (#303):**
each names one kind of item row, which is what lets the second say `this item`
without a reader having to work out which table it means.

**The refusal behind it is `Every invoice item needs an ordered item from its PO.`,
and it is the only one of this action's fourteen submit refusals a reader can
reach.** It carries both modifiers because it names a row of two tables in one
sentence, which no restructuring avoids — the fact it states IS the relation
between them (#303).
Every other is pre-empted by a `required` control or by the submit button being
disabled, so the words a reader meets on a bad submit are the browser's rather
than this app's. A design should not lay out room for that error list; the
exceptions are this one and the whole-number pair below.

**When a row has no purchase order of its own yet:** its item control is a
disabled dropdown reading `Pick this item's PO first`, and `Select a PO above`
while the whole section is still waiting for one. The words are short because
the long form of the same fact is the section's own message above the rows.

**When the vendor is changed, or an order already chosen is replaced:** a modal
asking `Changing the {Vendor|PO} will clear the items you've entered so far.
Continue?`, with `Continue` and `Cancel`. It appears **only once the rows have
diverged from what the app auto-inserted**, so an untouched form swaps silently
and a reader is interrupted only when there is something to lose. Confirming
clears every row.

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
when the modal opens, not when the page loads, so its select reads
`Loading jobs...` and then `Select a Job`. A third reading,
`Couldn't load the jobs — close this and try again`, exists in the code and
**cannot be reached through this screen** without forcing that request to fail.

**When an item's quantity is not a whole number, or its unit price not a whole
number of cents:** the form is refused on submit with
`Every item's quantity has to be a whole number.` or
`Every item's unit price has to be a whole number of cents.` These sit with the
form's other submit-time refusals, above the tabs, and they are the only place the
app states this rule to a reader — no control marks either figure as it is typed.

**When one of the money row's four figures is not a whole number of cents:** the
same treatment, in a sentence naming the figure —
`Shipping Fee has to be a whole number of cents.`,
`Tariff has to be a whole number of cents.`,
`Sales Tax has to be a whole number of cents.` or
`Amount Due has to be a whole number of cents.` One at a time, in the order
`Calculated Total` sums them and then the stated total they are compared against,
so a form with two bad figures names the first and the reader meets the second on
the next press. The stated total's sentence says `Amount Due` although this
screen's control is labelled `Vendor's Stated Total`, because the refusal directly
above it already says `Amount Due is required.` — a design that renames either has
to rename both.

**Nothing about these four controls stops it either**, although all four carry
`step="0.01"`. They are bound to React state and carry no `min`, and with no
`min` the browser takes the step base from the `value` attribute — which React
keeps equal to the current value, so any figure sits on its own base and
`checkValidity()` is true for all of them. Measured. So these sentences are the
only place this screen states the rule, and a design should not read `step` as
enforcing it. The edit screen's copies of these controls behave differently and
no better; its brief has the measurement.

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
before saving, **at the same threshold since #254**, and does not block on it. The
two sentences differ in tense on purpose and only in tense: this one addresses the
person still typing, and the stored one has no such reader.

**Every figure on both sides of that comparison is a whole number of cents** —
an item's quantity and unit price, the three terms of the money row, and the
stated total itself — which is what makes that shared threshold half a cent
rather than something looser. **Nothing about the controls enforces it** — the
browser marks neither a fractional quantity nor a sub-cent price invalid on this
form — so the app refuses them on submit, and the same rule holds on the edit
screen. A design
here has no decimal quantity to lay out, and a redesign that adds a decimal
affordance to either control is promising something the app will decline.

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

**The pane draws the file the same way the viewer does**, and that is one
component rather than two descriptions of one rule. What it does not share is the
viewer's chrome: the viewer names the file and offers to save it because it is an
overlay somebody opened, and the pane is beside the form for as long as the file
is attached. A redesign that gives the pane a header is adding a second thing that
names the file — the file section already does, just to its left.

**A file is required, as the packing list photo is on the delivery form.** In both
cases the document is what makes the record a record. **The direct purchase takes
the same file for the same reason** — it is the whole evidence that a purchase
happened — and it is the one thing the modal will not proceed without.

**The direct purchase leaves this screen and lands on the purchase request list.**
What is recorded here appears on a strip above `/prs`, on the job picked in the
modal, for someone at that site to raise the request from. The office's part ends
at the green line; nothing on this screen changes when the request is raised.
