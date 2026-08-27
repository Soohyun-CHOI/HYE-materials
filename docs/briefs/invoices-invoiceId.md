# Invoice detail

Route: `/invoices/[invoiceId]`
Who reaches it: row-scoped — anyone signed in, then only invoices whose orders
they can see, reached through `canViewPR` (#211). Two facts on the page are
narrower still: payment is President-or-Admin, and editing and deleting are
Admin.

## What it answers

Should this invoice be paid? That decomposes into three questions the screen
answers in order — does the vendor's stated total match what the items add up
to, does any single item differ from what its order agreed, and was the material
it charges for actually delivered. A reader who can answer all three
without scrolling twice has what they came for.

This is the densest screen in the app and the one where a redesign can do the
most damage, because three of the four things it says are silent in the normal
case. An invoice with nothing wrong shows no variance badge, no variance box, no
mismatch box, and an empty delivery list. If those are drawn as always present,
every clean invoice looks like a problem and the screen stops working.

## What it always carries

**identity.** The Invoice ID, which is the page heading. Below it, in a plain
block of small lines: the vendor's name, the vendor's own invoice number, the
issue date, the due date. Any of the last three may be missing and renders as an
em dash. The uploaded invoice file is a link on the same block, by filename.

**evidence — `Amount Due (vendor's stated total)`.** The figure everything else
on the screen judges, and the one number a reader must be able to find without
reading anything else. It is the vendor's claim, never recomputed by the app.
The gloss in parentheses is part of the label and is on screen because this
document carries two totals that only convention tells apart. The app currently
gives it the largest type on the page and a bordered block of its own.

**verdict — the delivery chip.** One word beside the `Delivery` heading, from
the closed set `Delivered` / `Mismatch` / `Awaiting delivery`. It is the same
chip the invoice list shows for this row, from the same function, so the row a
reader clicked and the page they land on cannot describe the invoice
differently.

**evidence — the orders this invoice charges.** A heading that is `Purchase Order`
or `Purchase Orders` depending on the count, then one line per order: the order
ID as a link, an em dash, and the order's status in bold.

**evidence — the items table.** Seven columns: Item, Size, Unit, Qty, Unit
Price, Amount, Remark. The last three of the first six are right-aligned
figures. A row here is a *folded* item — an invoice item split across two orders
reads as one row again — so the row count is not the stored row count. There is
deliberately **no order column**: a folded row can span two orders, so that cell
has no single value. Under the table, a totals footer: Items Subtotal, Shipping
Fee, and `Calculated Total` in bold.

**evidence — the matched delivery.** Under the `Delivery` heading, either the
delivery ID as a link with its received date in parentheses, or the sentence
`No delivery has been matched to this invoice yet.` One line, in the same
position, in every state — that is what makes everything below it read as an
addition rather than as a different layout.

**action.** A link back to the invoice list.

## What it carries only sometimes

Everything in this section is absent in the normal case. Where the entry does
not say what stands in its place, nothing does — no empty box, no placeholder,
no reserved space.

**When the reader is an Admin:** an `Edit` link beside the heading, and a delete
button at the foot of the page behind a top border. For everyone else neither
exists, and no disabled control marks where they were.

**When the delete button is pressed:** a confirmation, headed
`Delete this invoice?`, naming the invoice and saying that it and its invoice
items go, that the linked orders do not, and that it cannot be undone. Two
buttons, and the confirming one reads `Deleting...` while the action runs. **The
deletion is behind a confirmation and not immediate** — a fact about this
screen's structure rather than about its words.

**When the reader is President or Admin:** a whole `Payment` section, heading
included. The heading is inside the gate on purpose — a heading with nothing
under it would tell an employee that a payment fact exists here and refuse to
say it, which is worse than not raising the subject. Admins get a control that
toggles paid state; the President gets the same fact as a sentence,
`Paid on {date}` or `Not paid yet.` For everyone else the section does not
exist. And when it does not, nothing on the page hints that it might.

**The Admin's control is a form with its own submit**, a checkbox and a date
beside it, saved by a button rather than toggled in place — so the page has a
second submit on it, below the totals. Checking the box without a date is refused
with `Paid Date is required when marking as Paid.`, and **that is the one refusal
on this screen a reader can reach**: the date control carries no `required`, and
every other refusal here is behind an Admin-only control or needs Airtable to
fail.

**When a tariff was entered:** one extra row in the totals footer, between
Shipping Fee and Calculated Total.

**When a sales tax was entered:** one extra row in the same place, and **after
the tariff row** when both are there. That order is the vendor's document's own —
a duty prints with the goods it is charged on, a tax prints last before the total
— and it is also the order the `Calculated Total` formula adds its terms in.

**So the footer is three, four or five rows**, and the absent rows are absent
rather than blank or zeroed: a missing tariff means "no duty line on this
invoice", not "$0.00 of duty", and the same for tax. A footer drawn at a fixed
five rows would make every ordinary invoice assert two amounts the vendor never
charged. A term stated as zero is different again and does get its row, because "this
document says no tax was charged" is a true claim worth printing.

**When the reader has just arrived from an action:** a green confirmation line
under the heading. It comes off the query string, so it appears once and is gone
on reload.

**When the reader has just arrived from creating this invoice:** a box stating
what the app worked out about which delivery this invoice belongs to. It is gray
when a single delivery matched cleanly and amber in every other case — several
candidates, a rival invoice charging the same ordered item, or a tie nothing
could break. When a tie-break decided it, a second sentence in the same box says
so, because the tie-break is *how* the match was decided rather than a second
thing that happened. This box never appears on a reload: the standing answer is
the delivery section further down, and this is a one-time account of a judgment
made at creation.

**When an individual charge differs from what its order agreed:** a small
`⚠ Order variance` badge inside that item's name cell, and **no sentence beside
it**. The stored flag fires on either a price difference or a quantity invoiced
beyond the order, so any explanation naming a cause would be false whenever the
other one fired. What it was compared against lives on the order's own page.

**When at least one item carries that flag:** an amber prompt near the foot of
the page asking someone to check the item against the order, or take it up
with the vendor, before the invoice is paid. It is deliberately outside the
payment gate — an employee who cannot see whether the vendor was paid is exactly
the reader who is here to catch a wrong item, and naming payment as a deadline
discloses nothing about this vendor.

**When the invoice's own total does not match its computed total** — past half a
cent, which is the same rule the new-invoice form warns by (#254), so the two say
the same thing about the same invoice: a red box under the items table, carrying
`⚠ Check the total` and both figures. This is a
different fact from the badge above and the two can be on one invoice at once.
Red states a discrepancy; amber asks a person to look. That split is the page's
own and both colors appear on it.

**When the verdict is `Mismatch`:** an amber box, below the named delivery
rather than above it, saying the invoice charges more than the matched delivery
delivered and who to take it up with. It sits after the delivery because the
sentence is about that document — putting the accusation above the document it
accuses makes the reader scroll back for the subject. It names no quantity: one
invoice can be short on two ordered items with different units, so a single
figure here would be either wrong or a sum of unlike things.

**When the folded items do not all touch the same set of orders:** a short
indented list under each order's row, naming what that order was invoiced for
and in what quantity. Only quantities, never prices. When every item touches
the same orders the question is not ambiguous and nothing appears.

**When a delivery is matched AND something disagrees:** a list under the
delivery, one entry per folded item, and **only** for the items that disagree.
An entry carries the item's name and size, colored by its verdict tone, and one
sentence with the figures. One tone reaches it, `exception`, for a shortfall
against the matched delivery. **A second, `unjudged`, reached it until #278** —
gray text for an invoice item with no ordered item behind it, saying `Not
compared — no ordered item`. That charge is not a state this app has, so the
list holds one grade of thing now.

When the delivery is matched and everything agrees, this list is **empty and
absent**: the delivery, named once, is the whole section. The item level points
at exceptions and the invoice level says what the state is, so an entry that
agrees would repeat the items table directly above it — same names, same order,
same count. And when no delivery is matched at all there is no list either,
because with nothing matched there is no second term to compare against.

**When something exceeds the ordered item:** one further uncolored line inside
that entry, beginning `Against the ordered item:`. It is an aside about the
ordered item rather than a fact about this invoice, which is why it stays
uncolored while the lines above it are toned — and why the frame it belongs to
is named in the words.

## What must agree elsewhere

**The delivery chip is the invoice list's chip**, produced by the same function
from the same summary. If a redesign gives the list a different vocabulary for
this axis, the two screens describe one invoice two ways.

**`⚠ Order variance` is one word for one flag at both places it is shown** —
here, and on the purchase order detail's list of invoices charging that order.
`⚠ Check the total` is the other kind, and the purchase order detail is the one
screen in the app that shows both at once. They change together or not at all.

**The nesting grammar is shared with `/pos/[poId]`.** A parent row is a
document's identity and its own facts; a child list under it, indented and in
smaller gray text, is the facts about the pairing. That screen puts an invoice's
charges under the invoice the same way, so a reader crossing between the two
meets one grammar rather than two.

**`Mismatch` belongs to the delivery axis and may not be borrowed for a
variance**, which is the mirror of the rule above.

**How much was ordered is not on this screen, on purpose.** The purchase order
detail answers it in its `Qty` column, one click away, and since #233 that page
names this invoice. A redesign that adds an ordered quantity here re-opens a
question two issues closed.

**The amber box and the red box are two grades and must stay two.** Both mean a
person has to look before money moves; red states a discrepancy between two
figures the app computed, amber asks for a judgment the app cannot make.
