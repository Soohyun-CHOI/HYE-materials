# Deliveries

Route: `/deliveries`
Who reaches it: anyone signed in; the list holds only deliveries on jobs the
reader is assigned to, or everything for the office.

## What it answers

What has been delivered on my jobs, and has it been invoiced yet? A site staffer opens it
to confirm a delivery they recorded; the office opens it to see what is waiting on
a vendor.

## What it always carries

**identity.** The heading `Deliveries`, and under it the line
`Material delivered to site, newest first.` — a standing statement of what the
list is and how it is ordered, not a state.

**action.** A `Record a delivery` link beside the heading.

**action — a filter bar,** the same component all four document lists carry
(#324). Five controls: a search box reading `Search by Delivery ID, vendor or job`
(#325); a job picker and a vendor picker, each taking several at once and each
searchable; a `Recorded by me` checkbox; and an `Over-delivered` checkbox. There is
no date range, and the ordering is always newest first and cannot be changed.

**The box does not reach the order on the packing list, and that is a decision.**
`Deliveries."Packing List PO"` is a link, so what a delivery holds there is another
document's name rather than one of its own — and the way from an order to the
deliveries filling it is the order's own page, which lists them. A delivery has no
second name of its own: the base holds a packing list FILE and a link to an order,
and no packing list number anywhere. The matching rule is the other three lists':
every word must appear, anywhere among the row's names, in any order and any case.

**It carried the `Over-delivered` checkbox alone until #324.** The other three are
the subject axes every document list carries — this one had none of them, which
was not a decision: the bar was written for the screens that needed one and this
screen got the one filter its own feature needed.

**`Recorded by me` reads `Recorded By`, which is this document's own author.** The
request and order lists say `Requested by me` because they read a requester. The
invoice list says this same word, and since #382 for the same reason: that table
gained a `Recorded By` of its own, so four lists say two words for two fields rather
than four for four.

**The bar is drawn only when this reader has at least one row before filtering.**
A reader on no job gets the sentence alone; a filter that empties the list keeps
the bar.

**evidence — the table, six columns.** Delivery, Vendor, Received, Delivered,
Invoiced, Job.

**`Delivered` is a folded summary, not a quantity.** The cell carries the first
item's label with its quantity and unit, and — when the delivery had more than one
item — a small gray `+N` count in a chip of its own. The count is a chip rather
than text because `+2` read as plain text after an item label looks like a size or
a grade on the item itself.

**verdict — the Invoiced chip.** One of `Invoiced` / `Partly invoiced` /
`Awaiting invoice` / `—`. It compares, per ordered item this delivery filled, what
the invoices naming it charge against what it brought.

**evidence — the foot of the list, two facts, always.** How many deliveries the list
holds, and which page of them this is. Both are stated whether or not there is a
second page: a position that appears only once a list is long leaves the short
case saying nothing, and the short case is where a reader most needs to know they
are seeing all of it. **The total counts the rows the filters admit**, which is
what is actually being paged — so it differs from the `N of M` count in the bar
above while a filter is on, and agrees with it when none is. The page size is one
number for all four lists and is not named here; it is a design value and
`lib/listFilters.js` is the one place it lives.

## What it carries only sometimes

**When the list runs past one page:** a step to the next page, and a step back
when this is not the first one. The two are absent at the ends rather than drawn
and dead, so a list that fits on one page carries neither and the foot is two
sentences. **Any change to a filter returns the reader to the first page** — a
position is an offset into a set of rows, and narrowing replaces the set — and
the address drops the page along with it, which is the same rule the filters
follow: absence is the unapplied state.

**When the address asks for a page that is not there:** the last page, and the
address is rewritten to the page actually shown. A URL is typed, edited and
copied, so the number in it is a request rather than a promise; answering it with
an empty screen would show the reader nothing and tell them nothing, and leaving
the asked-for number in the bar would hand the next reader a link that means
something else.

**When a delivery brought more than its order asked for:** an amber
`Over-delivered` tag in the `Delivered` cell, beside the item label and the count.
It is kept here, unlike on the invoice list, because an over-delivery is a fact
about *this* delivery, so it sits on the delivery's own row without changing
frame.

**A deleted delivery lands here and this screen says nothing about it.** Deleting
is the one act with no document to return to, so it returns to the list — and
what it did was said before it happened, by the confirmation the delete control
opens, which names the delivery and what becomes inconsistent. This screen
carried a green `Delivery deleted.` line until #321; the invoice list, where the
same act lands from the invoice detail, never carried one. See `_shared.md`, "The
arrival is the confirmation".

**When any filter is active:** a `Clear all filters` control and a count beside
it, `N of M`. The count was here before #324 and beside the over-delivered
checkbox alone; it is on all four lists now.

**When there are no rows at all:** one of three sentences, the same three-way
distinction all four document lists draw. `No deliveries recorded yet. Record one
as material is delivered — the packing list photo is what makes it a record.`
when the base holds none. `No deliveries to show. You see a delivery when it is on
a job you are assigned to. An Admin can add you to a job in Airtable.` when some
exist but none is in this reader's scope — the app's only screen that tells a
reader how to get access, and it names Airtable because there is no
user-administration screen. `No deliveries match these filters.` when the reader
filtered them out.

The first sentence is doing teaching rather than reporting: it states the one rule
of the feature — that the photo is what makes a delivery a record — at the moment
a reader has nothing else to look at. An empty state that only said "no
deliveries" would lose that.

**Until #324 that first sentence was shown to the wrong reader.** A site staffer
whose jobs happened to hold no delivery was told none had been recorded, on a base
with plenty — `yet` claims the company has never had one, and it is the word the
scope-empty sentence must never carry. The two situations are one state now, and
the teaching moved to the sentence it is true of.

**When the reader is assigned to no jobs:** the bar and the table are both absent,
not empty. That is the general rule rather than this screen's: the bar is drawn
only when there is at least one row to narrow.

## What must agree elsewhere

**The folded `Delivered` cell is the delivery detail's headline block, folded.**
Both read the same summary function, and the awaiting-invoice strip on the invoice
list reads it too — so no screen can describe one delivery differently.

**The `Invoiced` chip's vocabulary is the purchase order detail's invoicing
chip.** One question at two scopes — has this delivery been invoiced, has this order
been invoiced — so a reader meets one vocabulary.

**`Over-delivered` is the same word on the delivery detail (twice) and on the
purchase order detail**, and it is a stored checkbox rather than a per-screen
judgment.

**The over-delivered filter survives for a stated reason, and #324 is what stated
it.** It was one of two until #216 moved the vendor-chasing one to a strip on the
invoice list, and it stayed on the ground that what was left is one narrow
question. The rule that keeps it now is general: a closed set on one of these
lists becomes a filter when the document or its own item rows hold the value, and
a strip's subject when the values lie along a wait whose end is the good one.
`Over Delivered` is a stored checkbox on this delivery's own item rows; it does not
end, and its absence is not "done". The wait it creates — an excess with no
request raised for it — is the strip on the request list, which is the same fact
in the other shape.

**The `Invoiced` chip is not a filter, by that same rule.** `Awaiting invoice` →
`Partly invoiced` → `Invoiced` is a wait with degrees, and it already has its
strip on the invoice list.

**Newest first is this list's order and is stated on the screen.** The
awaiting-invoice strip on the invoice list is ordered longest-wait-first instead,
and says so in its own line. Two lists of the same records, two orderings, both
declared.

**`Job` is one column on four lists** — this one, the request list, the purchase
order list and the invoice list. This screen is the one that already had it right:
#314 took `Job / Discipline` off the two request-side lists and gave the invoice list
the column it had never had, and it took this list's word and this list's 5.75rem as
the shape the other three follow. Nothing here changed. A redesign may move it or
restyle it; what it may not do is let one of the four say something different from
the others.
