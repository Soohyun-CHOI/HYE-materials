# Delivery detail

Route: `/deliveries/[deliveryId]`
Who reaches it: anyone signed in who is assigned to the delivery's job, or the
office. Editing is open to the same set, because what it changes — the received
date, the note, the photo, the attached invoice — is a correction to the record
rather than to what the delivery was allocated against. Deleting is the recorder's
or the office's.

## What it answers

What was delivered, and which orders did it fill? Two readers, both real: the person who
recorded it, checking that the app allocated the delivery the way they expected, and
someone reconciling later who needs to know what a packing list actually brought.

The screen has one structural peculiarity worth stating first: **the reader
cannot correct most of what is on it.** The item, the quantity, the vendor and
the order are decided by the allocation at recording time and are not editable —
correcting one means deleting the delivery and entering it again. The screen says
so in as many words, and a design that makes these look like fields invites an
edit that is not available.

## What it always carries

**identity.** The Delivery ID as the page heading.

**verdict — the headline received block.** A bordered block, the first thing
under the heading, labeled `Received` with the item count appended when there is
one. Inside it, one line per material: the quantity, the unit, then the item name
and size in lighter weight. This is the answer to "what was delivered" and it is the
reason a reader opened the page. The app currently sets it in the largest text on
the screen after the heading.

**identity — a block of facts copied off the delivery.** The job as code and
name, the vendor, the received date, `PO on packing list` as a link or the word
`none`, the invoices paired with this delivery, who recorded it and when, and the
packing list photo as a link. `PO on packing list` is named at that length on
purpose: a bare `PO` would read as the order the delivery was recorded against,
which is a different thing living on the rows below and reached another way.

**Invoices is plural and empty is a reading.** One invoice belongs to one
delivery, so a delivery accumulates them as the office enters each. With none,
the line says `none attached — attach one from Edit once the office has entered
it` rather than disappearing.

**evidence — the `Recorded against` table, three columns.** Item, Order, Qty.
One row per material and order: a stored row is one allocated slice, so an
delivery that filled an order and then exceeded it is two slices, and this table
folds them back into one row because what is real there is the split rather than
two deliveries. An order cell with nothing behind it reads `not against any order`.

**evidence — the allocation caveat under the table.** That the app allocated the
rows oldest order first, skipping ones already fully delivered, and that the
item, quantity, vendor and order cannot be edited. Always present, because it
describes how every row above it came to be.

**action.** An `Edit` link beside the heading, and a link back to the list.

## What it carries only sometimes

Everything here is absent unless the entry says otherwise.

**When a material was delivered beyond what was ordered:** an `Over-delivered` tag on
that material's line in the headline block. It sits on the headline item and
**not** on the folded table row, because that row holds the within-order piece
and the excess together and a tag on it would claim the whole quantity was
excess.

**When any material exceeded its order:** one amber banner per case, under the
headline block, naming the excess and — where the app can attribute it — which
order it went beyond. Where it cannot be attributed to one order, a different
sentence says so. Several can appear at once, because several materials can each
exceed.

**On the same row of the table, when part of a slice was the excess:** a small
amber `(N over)` after the quantity. **Only the excess is colored, never the
total** — coloring the whole figure would say the part delivered inside the
order is a problem too. The purchase order detail prints this same mark, in this
same color, on its own folded row; the red `(over)` on that screen is a different
scope and says *the ordered item is over*, counting every delivery. The
distinction is by scope, not by screen.

**When an over-delivery can be corrected by raising a request for it:** a
bordered block per case, directly under the banner that reported the excess,
headed `Correction —` and the material's label. Inside, one or more sentences
about what the correction would do, and a control to raise it.

**The block answers one of three questions, and they are not degrees of the same
thing.** What earns a correction is the delivery and the invoice agreeing above
the order — the vendor sent more than was ordered and charged for it, so the only
thing out of step is the order. Where they do not agree the discrepancy is the
vendor's rather than the order's, and the reader's next step is the vendor, not a
request. Where nothing has been invoiced yet there is nothing to compare and the
answer is to wait. A design that collapses these into "can" and "cannot" loses
the distinction the screen exists to make.

**Every one of the three names what was compared.** One further sentence giving
the ordered quantity, the delivered total and the billed total, and the order they
belong to. This is not decoration: the reader is looking at ONE delivery while the
verdict comes from every delivery and every invoice that touched the ordered item,
so without it the figures on the page do not add up to the sentence beside them —
a delivery of 13 sitting next to a refusal derived from 19. It is absent only on
the two answers that never reach the totals: no ordered item behind the row, and
nothing delivered beyond the order at all.

**When it cannot be corrected, the block still appears and says why.** This is
the important half. `No invoice bills this ordered item yet`, `the excess spans
more than one invoice`, `more is billed than was delivered` and five more are all
*answers*, and a missing button is not. So the block is present in both states and
only the control is conditional.

**When more than one invoice could have supplied the quotation:** one further
sentence saying which was quoted and what it was chosen over. **The `!` marker
beside the button means this and no longer means a guess** — the app used to pick
a document without being able to say the excess had been billed at all, and the
agreement rule removed that guess. The candidates here all cover the excess at the
same price, so the choice changes no figure; what differs is the file and the
vendor's own invoice code, which is why it is said rather than left silent.

**When a message names a purchase request:** that ID is a link inside the
sentence. The copy arrives in parts so the link can be rendered, and the same
sentence flattened is what the server returns as a refusal — so the two cannot
diverge.

**When the delivery has notes:** one more line in the facts block.

**When the packing list photo is not attached:** an amber sentence in its place
saying to reload in a moment if it was just uploaded. This is the one place the
app admits an upload is still in flight.

**When the reader has just arrived from an action:** a green confirmation line.

**When the reader may delete this delivery:** a delete control at the foot,
behind a top border. Its confirmation has **three voices**, chosen by the
strongest true statement — whether the delivery's ordered items are uninvoiced,
invoiced, or on an invoice that has already been paid. The third is
President-or-Admin, so a site recorder deleting their own delivery is never told
in a modal that the vendor was paid. The voices are not warnings but accounts of
what becomes inconsistent in the meantime, because deletion here is the only
correction mechanism there is and a recorder fixing a typo is doing the expected
thing.

## What must agree elsewhere

**The headline block and the deliveries list summarize the same way.** Both read
`summarizeDelivery`, and the strip on the invoice list reads it too, so no screen
can describe this delivery differently because this table regrouped.

**`Over-delivered` is one word in three places on this page** — the headline
tag, the banner sentence, and the delivery's row on the purchase order detail —
and it is a stored checkbox on the row, not a judgment made per screen.

**The order this delivery filled is a link both ways.** The purchase order detail
lists the deliveries filling it and names each one; this screen names the orders
from the other side. Neither is the only place that answers it, and they must not
disagree about which orders a delivery touched.

**`PO on packing list` and the invoice row are paired deliberately** — both are
facts copied off the same physical document, and they sit together for that
reason.

**The correction's sentences are shared with the strip on the purchase request
list**, which lists uncorrected excesses in short form. The long sentence here
and the short reason there describe one situation and are authored together.

**The `(N over)` mark is shared with the purchase order detail**, which prints it
on the same fact — part of a quantity was excess — in the same color, from the
same constant. That screen also has a `(over)` in a different color, qualifying a
whole cell, and that one says something else: the ordered item is over across
every delivery. A redesign may unify the two shapes only knowingly, because the
color is what tells a reader which of the two they are looking at.
