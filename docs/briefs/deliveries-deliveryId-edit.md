# Edit delivery

Route: `/deliveries/[deliveryId]/edit`
Who reaches it: anyone signed in who is assigned to the delivery's job, or the
office — the same set that may view it, because what this screen changes is the
record of the delivery rather than what the delivery was allocated against. The
address is corrected only while the job is open, as a delivery is recorded only
then.

## What it answers

Nothing — it is a correction screen, and it is the narrowest one in the app. Its
whole job is to be clear that **only four things about a delivery can be changed**:
the received date, the notes, the packing list photo and the delivery address.
Which invoices it was paired with was another until #640 removed the pairing, and
the address joined the list with #680. The items, the quantities, the vendor and the
orders are not here at all, and the delivery detail says why — correcting one of
those means deleting the delivery and recording it again.

## What it always carries

**identity.** The heading `Edit {delivery ID}`, and a link back to the delivery.

**action — the details form:** `Received Date` and `Notes`, with the same
placeholder as the create form — `Damage, a partial pallet, who signed for it…` —
and its own `Save` button.

**action — the photo form:** `Replace the packing list photo`, a file input, and
its own `Replace photo` button, disabled until an upload has completed. Above it,
the photo currently on the record, as a control that opens it over this page in the
shared viewer — the reader is about to replace it and this is where they check
which one they are replacing.

**identity — the delivery address it stands at**, as a line among the job, the
vendor and the current packing list: the fact the third form changes, stated once
above it.

**action — the address form:** `Delivery address`, a line saying to correct it
when the delivery was recorded at the wrong address and that what it delivered is
counted where it stands, a dropdown of the job's OTHER addresses with the
placeholder `Pick an address`, and its own `Correct address` button, disabled
until one is picked. **Only the job's addresses**, because a delivery's address is
where the job's stock is counted.

**Three separate forms, three separate submits.** This is deliberate and is the one
structural fact a redesign must not tidy away: a single Save across them would
re-submit an unchanged photo URL, which silently empties the attachment, and would
make the address — which moves stock and is refused when it cannot — one field
among the note and the date. So each concern commits on its own, and the buttons
are secondary-weight rather than one primary.

## What it carries only sometimes

**When a picked photo is over the size limit:** a red line under the photo input,
immediately and before anything is sent — `This file is larger than the upload
limit`, then the photo's own size against the limit. It reuses the line a failed
upload already uses and needs no room of its own; the limit is one number for
every upload in the app.

**While a form is working:** that form's own button reflects it — `Saving…`,
`Replacing…` or `Correcting…` — and the others stay usable.

**When the address cannot be corrected,** a red line under its dropdown, the pick
kept: the address it would leave holds less than has been issued from it, naming
the material and the address and saying nothing was changed; its address was
changed since the page was opened, in which case the page is drawn again as it
stands; or the shared refusals of the entry form. A correction that stands lands
on the delivery.

**When the job has no other address:** in place of the dropdown and its button, a
line saying so and a link to add an address to the job.

**When the delivery stands at an address that is not one of the job's** — one
recorded before the rule existed — an amber line under the lead saying so, and
the dropdown offers all the job's addresses.

**When the job is closed:** in place of the address form, the job's closed line.
The address stands above either way.

## What must agree elsewhere

**The photo is replaced, never re-submitted.** The write path refuses any URL that
is not a fresh upload, which is why this is its own form with its own button. A
design that made the photo part of a larger Save would break a guarantee the code
enforces.

**`Received Date` is a calendar date and the app's naming rule distinguishes it
from a timestamp.** `Created At` on the same record is a timestamp and is not
editable here.
