# Deliveries

Route: `/deliveries`
Who reaches it: anyone signed in; the list holds only deliveries on jobs the
reader is assigned to, or everything for the office.

## What it answers

What has been delivered on my jobs, and has it been billed yet? A site staffer opens it
to confirm a delivery they recorded; the office opens it to see what is waiting on
a vendor.

## What it always carries

**identity.** The heading `Deliveries`, and under it the line
`Material delivered to site, newest first.` — a standing statement of what the
list is and how it is ordered, not a state.

**action.** A `Record a delivery` link beside the heading.

**action — one filter,** a single `Over-delivered` checkbox. There is no job
picker, no vendor filter and no date range; the ordering is always newest first
and cannot be changed.

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

## What it carries only sometimes

**When a delivery brought more than its order asked for:** an amber
`Over-delivered` tag in the `Delivered` cell, beside the item label and the count.
It is kept here, unlike on the invoice list, because an over-delivery is a fact
about *this* delivery, so it sits on the delivery's own row without changing
frame.

**When the reader has just deleted a delivery:** a green `Delivery deleted.` line
under the heading.

**When the filter is on and nothing matches:** `No delivery matches these
filters.`

**When there are no rows at all:** one of two sentences, and they answer two
different questions. `You are not assigned to any job yet, so there are no
deliveries to show. An Admin can add you to a job in Airtable.` — which is the
app's only screen that tells a reader how to get access, and it names Airtable
because there is no user-administration screen. Or `No deliveries recorded yet.
Record one as material is delivered — the packing list photo is what makes it a
record.` when the reader has jobs but nothing has been recorded.

The second sentence is doing teaching rather than reporting: it states the one
rule of the feature — that the photo is what makes a delivery a record — at the
moment a reader has nothing else to look at. An empty state that only said "no
deliveries" would lose that.

**When the reader is assigned to no jobs:** the filter and the table are both
absent, not empty.

## What must agree elsewhere

**The folded `Delivered` cell is the delivery detail's headline block, folded.**
Both read the same summary function, and the awaiting-invoice strip on the invoice
list reads it too — so no screen can describe one delivery differently.

**The `Invoiced` chip's vocabulary is the purchase order detail's invoicing
chip.** One question at two scopes — has this delivery been billed, has this order
been billed — so a reader meets one vocabulary.

**`Over-delivered` is the same word on the delivery detail (twice) and on the
purchase order detail**, and it is a stored checkbox rather than a per-screen
judgment.

**The over-delivered filter is the only filter on purpose.** It was a
vendor-chasing worklist wearing a checkbox until that worklist became the strip on
the invoice list; what is left is one narrow question. A redesign adding filters
here should know it is adding, not restoring.

**Newest first is this list's order and is stated on the screen.** The
awaiting-invoice strip on the invoice list is ordered longest-wait-first instead,
and says so in its own line. Two lists of the same records, two orderings, both
declared.
