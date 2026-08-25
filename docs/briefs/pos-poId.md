# Purchase order detail

Route: `/pos/[poId]`
Who reaches it: row-scoped — anyone signed in, then only orders whose purchase
request they can see, through `canViewPR`. Two facts are narrower: one internal
address field is office-only, and payment badges are President-or-Admin.
**Each write control has its own reader**: signing is the President's, regenerating
the document and sending it to the vendor are the office's, and withdrawing is the
requester's. They were not always separated this way — the page used to offer
signing and regeneration to the whole office while only the President could do
either, so a redesign that groups the three into one "admin" block would rebuild
the defect.

## What it answers

Has everything on this order been delivered, and has everything on it been invoiced? This
is the reconciliation screen — the one place where what was ordered, what came
in and what was charged sit on one page — and it is the answer to the problem
the whole app exists for. A secondary question, asked by a different reader: has
the President signed it, and has the vendor been sent it — the office sends it
**from this page**, so both halves of that are answered and acted on here.

The order is a **frozen snapshot**. Its items were copied from the purchase
request when the order was generated and are never recomputed, so a price here
that differs from today's price is correct: it is what was agreed. Nothing on
this screen may suggest the figures are live.

## What it always carries

**identity.** The PO ID as the page heading. Then a block of small lines: the
status in bold, the purchase request's ID, the job as code and name, the vendor,
and the two internal contacts, `Our PIC` and `Our Manager`. Any of them may be
missing and renders as an em dash.

**evidence — `Total Amount`.** The order's total, in the largest type on the
page, in a bordered block of its own. This is the figure the purchase order PDF
prints as its TOTAL line, so it is what the vendor was told.

**evidence — the items table, nine columns.** Item, Size, Unit, Qty, Unit
Price, Amount, Delivered, Invoiced, Remark. The four money and quantity columns
are right-aligned. `Delivered` and `Invoiced` are the two axes this screen
exists to compare against `Qty`, and the reader does the subtraction: columns
named `Undelivered` and `Uninvoiced` used to sit beside them and were each their
own row's `Qty` minus the column next to it, which is two figures where one
would do. Under the table: Items Subtotal, Shipping Fee, Total Amount.

Every viewer who can see the order sees all nine columns, including both
quantity axes. Delivery figures were never gated; invoice figures stopped being
gated in #235, on the reasoning that what a vendor invoiced is readable by anyone
who may read the order behind it.

**evidence — a caveat under the table.** That the shipping fee is a frozen copy
from the request and has to be compared against each invoice's own shipping fee
at reconciliation time. It is a standing warning about a figure the table shows,
not a state, so it is always there.

**verdict — two chips, one per axis.** Beside the `Deliveries` heading, a chip
from `Delivered` / `Partly delivered` / `Awaiting delivery` / `—`. Beside the
`Invoices` heading, one from `Invoiced` / `Partly invoiced` / `Awaiting invoice`
/ `—`. They deliberately share one palette and one grammar, so a reader crossing
between them does not learn a second vocabulary for the same three states.

**Each chip folds the table above it, not the list below it.** It counts ordered
items whose delivered — or invoiced — quantity has reached what was ordered, and
knows nothing about how many documents brought them. A design that visually
attaches a chip to the list under it would make it say something it does not say.

**evidence — the two document lists, both always rendered.** `Deliveries` first,
matching the column order above, then `Invoices`. Each entry is a document ID as
a link, its date, and an indented child list in smaller gray text naming what
that document brought or charged, per ordered item.

**Each ordered item appears once in a child list, however many rows are behind
it.** One recorded delivery is one row per allocated slice, and an over-delivery
writes two against the same ordered item — the part inside the order and the
excess — so what a reader would otherwise meet is one material listed twice under
one delivery. It is one line, with the quantities added. The invoice side folds on
the same principle, with the unit price joined to it: two charges at two
different prices are two facts and stay two lines, so a folded row's price is
always exactly what was invoiced.

**Empty is a reading here, and the sentence says which.** Both sections render
even with nothing in them, because this is the page a reader comes to in order to
reconcile and an absent section cannot be told apart from a section that found
nothing. `No invoice charges this order yet.` and `Nothing has been delivered
against this order yet.` are the two sentences.

**verdict — the signature state.** Always stated, in one of several voices: the
signature's timestamp, or that the order was never signed, or that it has not
been signed yet.

**action.** The purchase order PDF, downloadable by anyone who can see the
order — site staff place the order from it.

**evidence — whether the vendor has been sent it.** Once the order has been
emailed to the vendor, a line beside the download says so, naming the address, the
time and the person who sent it. **Every viewer who can see the order sees this**,
not just the office: whether the vendor has the order is not office-only
information, and it is the question the whole screen is downstream of.

## What it carries only sometimes

Everything here is absent in the normal case unless the entry says otherwise.

**When the reader is office staff:** one more line in the identity block,
`Delivery Address Used`, which is Primary or Alternate. It is internal tracking
and no other reader sees it.

**When the reader is President or Admin:** a payment badge on each invoice in
the invoice list — `✓ Paid` or `Not paid`. Everyone else reads **neither** word.
The absence of the badge is deliberate rather than a gap: showing `Not paid` to
a reader who is not allowed to know about payment would answer a question they
are not being shown. This is the only thing left in that section that is gated.

**When a delivered or invoiced quantity exceeds what was ordered:** that cell
turns red and gains ` (over)` after the figure. The two columns are treated
identically, because both perform the same subtraction against the same `Qty`
and a negative means the same thing in either — more arrived, or more was
invoiced, than was ordered. Signaling one differently would imply a distinction
neither makes. This is the only red in the table.

**When a delivery brought more than the order asked for:** an `Over-delivered`
badge on that delivery's row in the list, and on the child row for the ordered
item that received the excess, a small `(N over)` after the quantity, in the
badge's color. **Only the excess is colored, never the total** — the folded row
holds the part delivered inside the order and the part beyond it together, so
coloring the whole figure would say the part that was ordered is a problem too.

**So this screen carries `(over)` at two scopes, in two colors, and unifying them
would destroy the distinction.** The red one in the table qualifies a whole cell
and says *this ordered item is over* — every delivery counted, which is the
discrepancy this page exists to surface. The other says *this one delivery
brought some excess*, which is a contribution rather than a verdict; it wears the
same color as the badge two lines above it, and as the same mark on the delivery's
own screen. Two facts, both true at once, and a reader needs to be able to tell
which one they are looking at.

**When an invoice's own total does not match its computed total:** a
`⚠ Check the total` badge on that invoice's row.

**When one charge on an invoice differs from what this order agreed:** an
`⚠ Order variance` badge on that child row, inside the indented list. This is
the one screen in the app that can show both variance kinds at once, which is
why they must keep two different words.

**When an invoice carries the vendor's own invoice number:** it appears in gray
between the invoice ID and the date.

**When the reader raised the request and the order has already been sent:** the
withdrawal control is replaced by a sentence saying it cannot be withdrawn here,
because calling off an order the vendor already has means agreeing it with them
first. This is the second of two refusals in that slot — the other is an invoice
already being linked — and both explain rather than vanish, unlike a status from
which withdrawal was never possible.

**When the order has been withdrawn:** a red box above the money and the items,
saying so in the third person and past tense — it is stated to whoever opens the
page rather than to whoever acted — with the withdrawal timestamp under it. It
sits above every figure on purpose: "this order was called off" changes how the
rest of the page should be read. Withdrawal also removes the signing control and
the regeneration control, and replaces the missing-PDF message with one saying
none will be generated now. An already-generated PDF stays downloadable, because
the order did exist and was signed and that document is audit trail.

**When an over-delivery on this order is covered by an overage request:**
one or more amber banners at the very top, above everything including the
confirmation line. Every word of them is derived rather than stored, so
withdrawing the request reopens the situation on its own. They stay visible
after signature on purpose: an overage order read on its own looks like a
duplicate with no quotation, and the invoice attached to it also charges the
original order — so a payment against that invoice matches neither order's total
alone, and whoever reconciles it needs telling exactly once, here.

**When the reader has just arrived from an action:** a green confirmation line.
It comes off the query string and is gone on reload.

**When the order is unsigned and the reader is office staff:** the signing
control. For any other reader, the sentence that it has not been signed yet.

**When the order is signed but its PDF has not been generated:** for the office, a
sentence plus a regeneration control; for everyone else, a sentence saying the
document is not available yet. A control that can only fail is never offered.

**When the order is signed, its document is on file, and it has not been sent
yet:** for the office, a `Send to vendor` control beside the download, with the
address it would use printed above it. **The address is on the screen and that is
why there is no confirmation dialog** — the reader has already seen where it goes,
so a dialog would ask the same question twice. If a redesign moves the address away
from the button, the dialog has to come back.

**When the office cannot send it, the reason is named where the control would be**,
and on this screen only two of the send's four refusals can appear: the order was
withdrawn, or the vendor has no `PIC Email` on record — that second one says to add
the address on the vendor's record first. **The other two cannot be reached from
here, because the page's own shape already answers them**: this whole block only
exists once the order is signed, and the send lives inside the branch where a
document is on file, so "not signed" and "no document" have their own sentences
higher up and never reach the send. They are still refused by the app, for a caller
that does not come through this page. Nobody outside the office sees any of the
four: for another reader there is simply nothing there, since the send is not
theirs to make.

**Once it has been sent the control is gone for good**, replaced by the record of
the send. A second send is refused rather than offered: two copies of one order read
as two orders, and material arrives twice. A send that FAILS records nothing, so the
control is still there and pressing it again is a first send rather than a second.

**When the reader raised the request behind this order:** a withdrawal control
at the foot, behind a top border — and this sits outside the office gate on
purpose, because site staff place the vendor order and are the ones who decide
not to. If an invoice is already linked, the control is replaced by a sentence
explaining what would have to happen first. If the status is one from which
withdrawal is impossible, **nothing renders at all**: there is nothing the
requester can do, and promising a path that does not exist is worse than
silence.

## What must agree elsewhere

**Both chips are the ones the purchase order list shows**, from the same
functions. The list and this page cannot describe one order two ways.

**The chip's placement is the invoice detail's grammar.** That screen puts its
chip beside the `Delivery` heading; this one does the same beside each document
heading, so the two read alike.

**The nesting grammar is shared with the invoice detail.** Parent row is a
document's identity and its own facts; indented child list in smaller gray text
is the facts about the pairing. Both screens do this, in both directions.

**`Invoiced` is both a column head here and a chip word on this same page, and
that is not a collision to fix.** A chip is one of a closed set of three; a
column head sits over a quantity. The delivery axis has had the identical pair
since #233 — a `Delivered` column under a `Delivered` chip — and the shapes keep
them apart. Renaming either to break a tie the shapes already break would cost a
word for nothing.

**This screen owns the ordered quantity.** The invoice detail deliberately does
not carry it, and points here instead. Whatever happens to this table, `Qty` per
ordered item stays legible on it.

**`Over-delivered` is this base's own word**, a checkbox on the delivery's rows,
and the delivery detail uses the same tag.

**The `(N over)` on a folded child row is the delivery detail's own mark**, from
the same constant, for the same fact one frame down: part of a quantity was
excess. That screen's table and this list read alike on purpose, and a redesign
that changes the shape of one changes both.

**The two withdrawal voices are paired with the modal's.** The banner is third
person and past tense; the confirmation dialog is second person. They are
written together so neither can drift into describing different behavior, and a
redesign that rewrites one has to rewrite both.
