# Edit delivery

Route: `/deliveries/[deliveryId]/edit`
Who reaches it: anyone signed in who is assigned to the delivery's job, or the
office — the same set that may view it, because what this screen changes is the
record of the delivery rather than what the delivery was allocated against.

## What it answers

Nothing — it is a correction screen, and it is the narrowest one in the app. Its
whole job is to be clear that **only three things about a delivery can be changed**:
the received date, the notes and the packing list photo. Which invoices it was paired
with was a fourth until #640 removed the pairing. The items, the quantities, the
vendor and the orders are not here at all, and the delivery detail says why —
correcting one of those means deleting the delivery and recording it again.

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

**Two separate forms, two separate submits.** This is deliberate and is the one
structural fact a redesign must not tidy away: a single Save across both would
re-submit an unchanged photo URL, which silently empties the attachment. So each concern commits
on its own, and the buttons are secondary-weight rather than one primary.

## What it carries only sometimes

**When a picked photo is over the size limit:** a red line under the photo input,
immediately and before anything is sent — `This file is larger than the upload
limit`, then the photo's own size against the limit. It reuses the line a failed
upload already uses and needs no room of its own; the limit is one number for
every upload in the app.

**While either form is working:** that form's own button reflects it — `Saving…` or
`Replacing…` — and the other stays usable.

## What must agree elsewhere

**The photo is replaced, never re-submitted.** The write path refuses any URL that
is not a fresh upload, which is why this is its own form with its own button. A
design that made the photo part of a larger Save would break a guarantee the code
enforces.

**`Received Date` is a calendar date and the app's naming rule distinguishes it
from a timestamp.** `Created At` on the same record is a timestamp and is not
editable here.
