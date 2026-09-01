# Invoice detail

Route: `/invoices/[invoiceId]`
Who reaches it: row-scoped — anyone signed in, then only invoices whose orders
they can see, reached through `canViewPR` (#211). **Every fact on the page is
readable by every reader who gets in** — payment was President-or-Admin until #309.
What is narrower is the WRITING: editing, deleting and recording payment are Admin.

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

**When the reader is an Admin:** an `Edit` link beside the heading, an `Edit payment`
control in the `Payment` section, and a delete button at the foot of the page behind a
top border. For everyone else none of the three exists, and no disabled control marks
where they were. **Three controls, three places, and only the middle one edits in
place** — the other two open another screen and a confirmation.

**When the delete button is pressed:** a confirmation, headed
`Delete this invoice?`, naming the invoice and saying that it and its invoice
items go, that the linked orders do not, and that it cannot be undone. Two
buttons, and the confirming one reads `Deleting...` while the action runs. **The
deletion is behind a confirmation and not immediate** — a fact about this
screen's structure rather than about its words.

**A `Payment` section, always, and it reads the same for every reader.** One
sentence, `Paid on {date}` or `Not paid yet.`, and nothing about it varies by who is
looking. **This was the one place on the screen where two readers got two different
things until #318**: an Admin got the control and everybody else got the sentence, so
the fact and the control for it were alternatives rather than a fact with a control
beside it.

**What an Admin has in addition is a control, and `beside` is the whole of the
change.** A small `Edit payment` control sits next to the sentence; for every other
reader it is simply absent, and no disabled affordance marks where it was. **A
redesign may move or restyle it and may not make it replace the sentence** — the
failure mode is drawing the fact and the control behind one condition, because the
read then follows whatever the control's condition becomes. That is what the section
did for two issues, and it is why #316 had to place its own sentence outside the
branch to reach both readers at all.

**Worth knowing about the shape it replaced**, because the reasoning still applies to
this section's heading: it was President-or-Admin until #309 and the heading was
inside the gate on purpose, since a heading with nothing under it tells a reader a
payment fact exists here and refuses to say it. And until #309 the read-only sentence
rendered for nobody at all — it was reached only by a President who is not an Admin,
and there is no such account. Since #318 it is what everybody reads, an Admin
included.

**When an unpaid invoice is past its due date:** a red sentence in that same
`Payment` section, **directly under the payment sentence it qualifies** —
`⚠ Overdue — this invoice is 10 days past its due date.` One day reads `1 day`.

**It sits with the state rather than at the foot, and #316's own rule on the invoice
list decides that.** There the lateness badge stacks under the payment word because it
qualifies the payment; here the same relation puts the sentence under the same fact.
#316 placed it after the section's Admin/reader branch instead, which was the only
place that reached both readers while the branch existed; the branch is gone, so what
the sentence is ABOUT decides where it goes. Only an unpaid invoice can be late, so it
never appears beside `Paid on {date}`.

**Both readers get it, and a redesign may not hide it BECAUSE the control is open.**
It is a payment fact of the same grade as the payment word, and #309's rule is that
every reader who reaches the row reads it — which does not stop applying because
somebody is editing. What it does follow is the state being shown: a draft that says
paid carries no lateness, since only an unpaid invoice can be late. Following the
sentence above it is not the same thing as being hidden by the control.

**It says the same thing the list's badge says, from the same judgment**, at the other
density: the list has a cell and prints `⚠ Overdue · 10d`, this has a section and says
what the count is counted against. Both open with `⚠ Overdue`. **An invoice due today
is not late, and one with no due date is not late** — the section then holds only its
payment line, and the due date in the identity block above is the date or an em dash.

**When an Admin presses `Edit payment`:** one date field, labelled `Paid Date`, opens
**where the sentence sits**, with a `Clear` beside it and `Save payment` and `Cancel`
under it; `Edit payment` goes while it is open. Not a dialog: this app's modals are for
the actions it cannot undo, and recording payment can be recorded again. It is the shape
`/invoices/new` already uses to unlock a locked unit price on a row — a small text
control that opens the field in place, and a `Cancel` beside it that puts the value back.

**`Save payment` and not `Save`**, for `Edit payment`'s own reason: the page carries a
second form and a lone `Save` names no subject, so the pair reads as one control's two
ends. **`Clear` is the app's own control and not the date picker's** — a `type="date"`
input hides a clear affordance inside the browser's calendar popup, which is a signal a
reader has to open something else to find. It renders only while there is a date in the
box.

**A DATE IS THE WHOLE OF THE FACT, and there is no checkbox.** An invoice with a
`Paid Date` was paid on that day; one without was not. There was a `Paid` checkbox
beside the date until the field merge, and the two could disagree — the form demanded a
date when the box was ticked and nothing refused the reverse, so a record could carry a
date for a payment it said never happened. **A redesign may not put a second control
back on this fact**, whatever it is called: the shape is the one `Withdrawn At` and
`Sent At` already have on the order axis.

**Clearing the date is how a payment is un-recorded**, and `Clear` is where a reader
looks for it. A sentence stood here instead while emptying the box by hand was the only
way back — `Clear the date to record that this invoice is not paid.` — and it went when
the control arrived: the button names the act and the sentence above previews what it
does, so the words said what the screen already shows.

**The field opens holding the record's date, or empty**, and empty is the whole
decision for an unpaid invoice. It used to prefill today the moment the box was ticked,
which was a convenience while the tick was the deliberate act; with the box gone a
prefilled field would make `Edit payment` → `Save` a payment recorded by two clicks and
no typing. The office pays on one weekday, so today is usually right — that is the cost
being paid, knowingly, to keep the date typed rather than accepted.

**The sentence stays while the field is open, and it PREVIEWS what `Save payment` will
record.** Type a date and it reads `Paid on {that date}` at once; press `Clear` and it
reads `Not paid yet.` Nothing is stored until the save, and `Cancel` puts the sentence
back to the record along with the field. **It stated the RECORD in both states for one
revision**, on the ground that one place should hold what is stored and another what is
about to be written; that read worse than it argued — the line above the field
contradicted the field, with nothing to say it was a step behind.

**The lateness sentence stands down while the draft says paid, and the preview is
one-way.** A reader typing a date would otherwise see `Paid on {date}` with `⚠ Overdue`
under it. Clearing a paid invoice's date does NOT bring a lateness sentence with it: the
server resolved that fact from the record, and producing the other half would mean
handing this section the due date and the server's day. It appears on the next load.

**This is still where the shape diverges from `/invoices/new`**, and knowingly — there
the field and its read display are one element, so nothing states the value in words at
all. That form is composing a new document; this section is amending a record whose
current value is what the page exists to state.

**`Cancel` puts the field and the sentence back to the record and closes**, re-derived
from the record rather than from a copy taken when the control opened — `/invoices/new`'s
own rule for the same act. **`Save payment` closes the section too**, and the sentence
then states the saved value rather than a draft of it; a save that changed nothing closes
it just the same.

**The control's label is `Edit payment` and not `Edit`, because this screen already
has an `Edit`** — the Admin-only link beside the heading that opens the invoice for
editing. Two `Edit`s visible at once to exactly the reader who can press either is one
word for two acts.

**It is a form with its own submit**, saved by a button rather than toggled in place —
so the page has a second submit on it, below the totals. **The field is not `required`
and nothing refuses an empty one**: a blank date is a value rather than a gap, since it
is what records that the invoice is not paid. `Paid Date is required when marking as
Paid.` was this section's one refusal a reader could produce and it went with the
checkbox — there is no longer a state for it to describe. **No refusal on this screen is
reachable**: the rest are behind an Admin-only control or need Airtable to fail. **A
redesign should still draw the box, and once.** It is where every refusal the section
can produce arrives, including the authorization one since #185, which reached an error
page before that.
The slot is real and empty by construction — which is a thing to know rather than a
reason to drop it, because what fills it is a direct call or an Admin demoted between
load and submit.

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
with the vendor, before the invoice is paid. It sits outside the `Payment` section
deliberately — the reader here to catch a wrong item is not the reader who records
payment, and naming payment as a deadline
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

**The overdue sentence is the invoice list's badge**, produced by the same judgment
from the same call, so the row a reader clicked and the page they land on cannot
disagree about whether this invoice is late. The list carries `⚠ Overdue · 10d` and
this carries the sentence; both open with `⚠ Overdue`, which is also the order list's
whole mark. Three screens, one word.

**The due date in the identity block is what that sentence reads**, and both stay.
Dropping the date would leave the reader a claim with nothing to check it against;
restating lateness beside the date would say one thing twice on one screen.

**The payment sentence and the invoice list's payment word are one axis.** The list
marks `Paid` or `Not paid` in a cell; this states it as a sentence with the date. A
redesign may not give them different vocabularies, and may not put the date back in
the list — #309 took it off the cell precisely so that WHEN is stated here and marked
there.

**Nothing on this screen is drawn twice for two readers.** The `Payment` section was
the app's only one and #318 ended it; `_shared.md` carries the standing form. A design
that reintroduces the shape here is reintroducing it for the whole app.

**The amber box and the red box are two grades and must stay two.** Both mean a
person has to look before money moves; red states a discrepancy between two
figures the app computed, amber asks for a judgment the app cannot make.
