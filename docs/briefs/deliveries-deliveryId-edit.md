# Edit delivery

Route: `/deliveries/[deliveryId]/edit`
Who reaches it: anyone signed in who is assigned to the delivery's job, or the
office — the same set that may view it, because what this screen changes is the
record of the delivery rather than what the delivery was allocated against.

## What it answers

Nothing — it is a correction screen, and it is the narrowest one in the app. Its
whole job is to be clear that **only four things about a delivery can be changed**:
the received date, the notes, the packing list photo, and which invoices it is
paired with. The items, the quantities, the vendor and the orders are not here at
all, and the delivery detail says why — correcting one of those means deleting the
delivery and recording it again.

## What it always carries

**identity.** The heading `Edit {delivery ID}`, and a link back to the delivery.

**action — the details form:** `Received Date` and `Notes`, with the same
placeholder as the create form — `Damage, a partial pallet, who signed for it…` —
and its own `Save` button.

**action — the photo form:** `Replace the packing list photo`, a file input, and
its own `Replace photo` button, disabled until an upload has completed.

**action — the `Invoices` section,** with the standing sentence
`One invoice belongs to one delivery, so one already attached elsewhere is
listed but cannot be picked. A delivery can carry more than one invoice.` — the
pairing rule, stated where the pairing is made rather than on failure.

**Three separate forms, three separate submits.** This is deliberate and is the
one structural fact a redesign must not tidy away: a single Save across all of them
would move an invoice between deliveries in one submit nobody reviewed, and re-submitting
an unchanged photo URL would silently empty the attachment. So each concern commits
on its own, and the buttons are secondary-weight rather than one primary.

## What it carries only sometimes

**When the vendor has invoices that could be attached:** a dropdown with the
placeholder `Select an invoice…` and an `Attach invoice` button, disabled until one
is picked. Bills already attached to another delivery are **listed but not
selectable**, so the reader can see they exist and why they are unavailable.

**When the vendor has no invoice entered at all:** the dropdown is replaced by
`No invoice from this vendor has been entered yet, so there is nothing to attach.
Record the delivery now and attach the invoice once the office enters it.` — which
names the sequence rather than just reporting emptiness.

**When invoices are already attached:** each is listed with a detach control.

**While any of the three forms is working:** that form's own button reflects it —
`Saving…`, `Replacing…`, `Attaching…` — and the other two stay usable.

**When an attachment is refused:** one of four sentences, and two of them are
deliberately identical. `That invoice no longer exists.` answers both "not found"
and "outside your scope", because telling those apart would confirm that a record
exists outside someone's scope. The other two name a vendor mismatch and an invoice
already attached elsewhere.

## What must agree elsewhere

**The pairing rule's wording is shared with the delivery detail's `Invoices` line**
and with the invoice-side sentences on the invoice detail. One rule, stated from
whichever side the reader is on.

**A refusal that hides existence is a rule, not a wording choice** — the same
principle as a row-scoped detail screen rendering the ordinary not-found text.
Whatever a redesign does with error presentation, these two refusals must stay
indistinguishable from each other.

**The photo is replaced, never re-submitted.** The write path refuses any URL that
is not a fresh upload, which is why this is its own form with its own button. A
design that made the photo part of a larger Save would break a guarantee the code
enforces.

**`Received Date` is a calendar date and the app's naming rule distinguishes it
from a timestamp.** `Created At` on the same record is a timestamp and is not
editable here.
