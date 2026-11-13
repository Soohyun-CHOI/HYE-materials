# Invoice detail

Route: `/invoices/[invoiceId]`
Who reaches it: row-scoped — anyone signed in, then only invoices whose orders
they can see, reached through `canViewPR` (#211). **Every fact on the page is
readable by every reader who gets in** — payment was President-or-Admin until #309.
What is narrower is the WRITING: editing, deleting and recording payment are Admin.

## What it answers

Should this invoice be paid? That decomposes into three questions the screen
answers in order — does the vendor's Invoice Total match what the items add up
to, does any single item differ from what its order agreed, and was the material
it charges for actually delivered. A reader who can answer all three
without scrolling twice has what they came for.

This is the densest screen in the app and the one where a redesign can do the
most damage, because two of the things it says are silent in the normal case and
the third is quiet. An invoice with nothing wrong shows no variance badge and no
variance box, and its delivery table's rows read `N of N EA delivered` in plain text.
If those are drawn as alarms, every clean invoice looks like a problem and the screen
stops working.

## What it always carries

**identity.** The Invoice ID, which is the page heading. Below it, in a plain
block of small lines: the vendor's name, the vendor's own invoice number, the
issue date, the due date, and who entered the invoice. Any of those but the first
may be missing and renders as an em dash. The uploaded invoice file is on the same
block, by filename, as a control that opens it over this page in the shared viewer
(`_shared.md`, "A file opens over the screen that named it"), titled
`Invoice file · {filename}`.

**`Recorded by` is the last line before the file, and it is the same word in the
same position the delivery detail gives it (#382).** It reads
`Recorded by {name} · {day}`, the design's words: the person who typed the invoice
in, by first name, and the day they did, in the reader's own zone. The name is
there so a reader looking at a figure that seems wrong has somebody to ask. It is audit only — nothing on this screen is gated on it, unlike a
delivery, where the recorder is also the one person besides an Admin who may delete.

**The day is `Invoices."Created At"`, the day alone, as the design draws it.** The
delivery's undesigned line keeps `Recorded by:` with `on {date and time}`; the
invoice's follows its design, where the colon and the time are not drawn. An
invoice standing before the field took its record's own creation time, so the day
stands on every invoice; a row made by hand in Airtable since has none and draws
the name alone.

**The line is always drawn, and the name is an em dash on every invoice entered
before the recorder was stored.** Nothing backfills them because the base holds no
fact that would say who. Hiding the line when empty would leave that reader
unaware the app records this at all, which is the opposite of what it is for.

**evidence — `Invoice total`.** The figure everything else on the screen judges,
and the one number a reader must be able to find without reading anything else.
It is the vendor's claim, never recomputed by the app. Its name is what tells it
from the `Calculated Total` under the items, since this document carries two
totals; `Amount due` is said on no screen, being the same figure. The app currently
gives it the largest type on the page and a bordered block of its own.

**verdict — the delivery chip.** One word beside the `Delivery` heading, from
the closed set `Matched` / `Awaiting delivery`, and beside `Awaiting delivery` in
gray the days since the `Issue Date` (`98d`). It is the same chip and the same
figure the invoice list shows for this row, from the same functions, so the row a
reader clicked and the page they land on cannot describe the invoice differently.
`Matched` says everything this invoice charges has been delivered, read through the
ordered items it names (#640): what has been delivered on an ordered item answers
its invoices oldest first, in the order they were entered.

**evidence — the orders this invoice charges.** A heading that is `Purchase Order`
or `Purchase Orders` depending on the count, then one line per order: the order
ID as a link, an em dash, and the order's status in bold. Absent entirely when
there are no orders to name — see the items table below for the one state that
does that.

**evidence — the items table.** Eight columns: Item, Size, Maker, Unit, Qty, Unit
Price, Amount, Remark. The last three of the first seven are right-aligned
figures. A row here is a *folded* item — an invoice item split across two orders
reads as one row again — so the row count is not the stored row count. There is
deliberately **no order column**: a folded row can span two orders, so that cell
has no single value. Under the table, a totals footer: Items Subtotal, Shipping
Fee, and `Calculated Total` in bold.

**Both this section and the one above it are conditional on the invoice having
items, which is new in #330 and is the one state where this screen changes
shape.** An invoice whose rows were removed in Airtable renders the sentence
`This invoice has no items. Every invoice is entered with at least one.` where
the table would be — no column heads, no totals footer, and no red header-variance
box, since that box is a reading of a total there is nothing to compute. The
orders section is not drawn at all: it derives from the items, so it would be a
heading over nothing. `Invoice total` at the top is untouched, and it is what makes
the state legible — a vendor's claim with nothing behind it.

**The app cannot produce that invoice and cannot repair one.** Creating refuses a
submission with no rows, editing refuses the record, and the only two paths that
delete an invoice item delete the invoice with it. So a redesign should treat this
as a record missing its own contents rather than as an empty state on a spectrum
with the others — and must not reserve space for a table that is not there.

**evidence — the deliveries.** Under the `Delivery` heading, either `Deliveries:` and
every delivery that brought one of the ordered items this invoice charges, each a
link, or the sentence `No delivery has been recorded for this invoice's items yet.`
They are the ordered items' deliveries, not this invoice's — a delivery belongs to no
one invoice — so the line names them and the table below says how much arrived.

**evidence — the delivery table.** One row per item, folded as the items table is,
under the heads `Item` · `Ordered` · `Delivered to date` · `Invoiced to date` ·
`This invoice`. The middle three are the ordered item's own totals, every delivery
and every invoice on it — which is why two heads say `to date` — and the last is this
invoice's: `150 of 200 EA delivered`.

**action.** A link back to the invoice list.

## What it carries only sometimes

Everything in this section is absent in the normal case. Where the entry does
not say what stands in its place, nothing does — no empty box, no placeholder,
no reserved space.

**When the reader is an Admin:** an `Edit` link beside the heading, an `Accept` control
beside each variance nobody has accepted, an `Edit payment` control in the `Payment`
section, and a delete button at the foot of the page behind a top border. For everyone
else none of them exists, and no disabled control marks where they were. **Four kinds of
control, and only the middle two edit in place** — the other two open another screen and
a confirmation.

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

**When an Admin saves a payment on an unpaid invoice that still has something left:**
the save asks once before it records. `Save payment` — or Enter in the date field —
shows `Still open on this invoice:` and a list where the two buttons were: each
variance nobody has accepted, in red as its badge is, with the item it is on, and, while
not everything the invoice charges has been delivered, the delivery chip's words and its
wait in gray — `Awaiting delivery · 12d — not everything it charges has been delivered
yet.` Then `Save payment anyway`, which records it, and `Go back`, which brings the two
buttons back with the date as typed; changing the date puts the question away too.
**It asks and never refuses**: the app records a payment made elsewhere, so nothing it
lists can stop one. **The delivery's sentence is information and must not be drawn as a
warning** — a wait the next delivery ends by itself, beside variances somebody has to
decide about. Moving the date of a payment already recorded asks nothing.

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

**Three actions land here and none of them says so.** Creating the invoice,
editing it and recording a payment all finish on this screen, and each one is
visible on it: the record itself, the edited figures, the payment sentence with
its control closed again. This carried a green line for each until #321 — see
`_shared.md`, "The arrival is the confirmation".

**When an individual charge differs from what its order agreed:** a small badge
inside that item's name cell for each way it differs — `⚠ Price variance` for a
unit price other than the order's, `⚠ Quantity variance` for an ordered item
invoiced past what it ordered, across every invoice — and **no sentence beside
them**. Each is its own stored flag, so the badge names the cause; what it was
compared against lives on the order's own page.

**When at least one item carries either flag and nobody has accepted it:** an amber
prompt near the foot of the page asking someone to check the item against the order,
or take it up with the vendor, before the invoice is paid. An accepted variance has
been looked at, so it raises no prompt. It sits outside the `Payment` section
deliberately — the reader here to catch a wrong item is not the reader who records
payment, and naming payment as a deadline
discloses nothing about this vendor.

**When the invoice's own total does not match its computed total** — past half a
cent, which is the same rule the new-invoice form warns by (#254), so the two say
the same thing about the same invoice: a red box under the items table, carrying
`⚠ Totals differ` and both figures. This is a
different fact from the badges above and the two can be on one invoice at once.
Red states a discrepancy; amber asks a person to look. That split is the page's
own and both colors appear on it.

**When an Admin presses `Accept` beside a variance:** a `Reason` box opens where the
mark is — under the item's badges, or inside the totals box — with `Accept` and
`Cancel` under it, and the control that opened it goes while it is open. Not a dialog,
for `Edit payment`'s reason. **A reason is required**, and a blank one is refused inside
that form in the app's own words (`Reason is required.`) rather than by the browser. Each
of the three is accepted on its own — a price variance, a quantity variance, the totals
— and an item folded from two rows accepts every row that carries it.

**When a variance has been accepted:** its badge reads as accepted and stops being red —
`Price variance · Accepted`, `Quantity variance · Accepted`, `Totals differ · Accepted`,
in green, the kind's word first as on the open badge and no `⚠` — and the totals box turns
green with the same comparison after those words. Under it, for every reader who reaches
the invoice, who accepted it, the day and why: `Accepted by {name} · {day} — {reason}`.
**What the office decided about an invoice is a fact of the invoice**, of the grade
payment is, so the line is not behind the control; only `Accept` is the Admin's.

**When an edit moves what an accepted variance was accepted on:** it is open again — red,
`Accept` beside it for an Admin — with `Reopened · {day} — the figures it was accepted
on changed.` under it. What it was accepted on is the two figures it compares: a price
variance's unit price and the order's, a quantity variance's item quantity and the
order's, the totals' Invoice Total and Calculated Total. An edit that moves neither —
a Due Date, the vendor's number — leaves it accepted, and one that leaves no variance at
all simply takes the mark away. Awaiting delivery is not a variance and is never
accepted: a delivery recorded makes the invoice `Matched` by itself.

**When the folded items are not all divided among the orders the same way:** a
short indented list under each order's row, naming what that order was invoiced
for and in what quantity. A line carries two figures — the quantity this invoice
charged against that order, over the quantity that order asked for — with the
unit written once after both: `Elbow 3" — 7 of 15 EA`. Only quantities, never
prices.

**What counts as the same way is the orders an item names AND the proportions it
divided itself among them.** Two items that both put two thirds on one order and
a third on the other say one thing, whatever the amounts; two that go 10 and 3
against 2 and 11 do not, and the list appears. An invoice charging one order is
always silent, because a single order takes the whole of every item — and there
the list would repeat the items table line for line, since with one order a
charge is the folded row's own quantity.

**The unit is written once because both figures are in it.** An invoice item's
`Unit` is a frozen copy of the ordered item's, so the two are one measure with a
part and a whole on it; writing it twice would assert two measurements that
happen to agree. A line whose ordered items carry no quantity states the charge
alone, which is what a hand-emptied link leaves.

**The whole is what that order asked for — not what is left to invoice.** A line
reading `7 of 15` says this invoice charged 7 against an ordered quantity of 15;
a second invoice may already have charged some of the rest, and nothing here
says so. The figure also adds up every ordered item behind the line, since one
folded row can cover two of them on one order, so it is the whole of what that
line stands for rather than one row's.

**When an item has not all arrived:** its row's name and its `This invoice` cell in
amber — the one tone the table carries, `waiting`. It is a wait, not an error: under
the three-way match the rest may still be on its way, which is what the chip says
too. A row answered in full carries no color.

## What must agree elsewhere

**The delivery chip is the invoice list's chip**, produced by the same function
from the same summary. If a redesign gives the list a different vocabulary for
this axis, the two screens describe one invoice two ways.

**`⚠ Price variance` and `⚠ Quantity variance` are one word for one flag each at
both places they are shown** — here, and on the purchase order detail's list of
invoices charging that order. `⚠ Totals differ` is the invoice's own, and the
purchase order detail is the one screen in the app that shows all three at once. They change together or not at all.

**The accepted badges are one set too**, on this page, the edit screen, the purchase
order detail and — for the totals — the invoice list, each the open badge's word followed
by `· Accepted`. Who accepted it and why is stated on this page alone; the others mark it.

**The nesting grammar is shared with `/pos/[poId]`.** A parent row is a
document's identity and its own facts; a child list under it, indented and in
smaller gray text, is the facts about the pairing. That screen puts an invoice's
charges under the invoice the same way, so a reader crossing between the two
meets one grammar rather than two.

**The variances are against the order and each qualifier is its own.** `Price` and
`Quantity` say what each compares, and the totals pair says `Totals`. `Delivery
variance` stood beside them until #640: it compared this invoice with the one delivery
it named, and with that link gone a shortfall is a wait, not a variance.

**An ordered quantity appears on this screen twice, and both are the order's.** The
`Purchase Orders` list carries one as a denominator, because that line's subject is
an order and a charge against it needs a whole to be read against; the delivery
table carries it as `Ordered`, the first of the three totals the three-way match
compares. `/pos/[poId]`'s `Qty` column is the same figure on the order's own page.

**What every invoice has charged against an ordered item is here once, labeled.**
The delivery table's `Invoiced to date` is that cross-document total, because the
comparison this section exists for is the ordered item's totals against each other
(#640); its head says `to date` so it is not read as this invoice's own, which is the
`This invoice` column. `/pos/[poId]` speaks for the order across every invoice on it,
and a redesign must keep the two scopes told apart in words, not by position alone.

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
