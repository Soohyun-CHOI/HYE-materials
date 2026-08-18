# Record a delivery

Route: `/deliveries/new`
Who reaches it: anyone signed in and assigned to at least one job. This is site
work: recording an arrival is the job of whoever received it.

## What it answers

Nothing about existing data. But unlike the other two create forms, this one does
make a **judgment while the reader watches**: the app decides which order each item
belongs to, and shows that decision before it is saved. Half the screen is that
preview.

Two facts shape everything about it. The reader is transcribing a **paper packing
list at the point the material arrives**, which is site work and not desk work —
though which devices that means in practice is not something this repository
records. And **they cannot correct most of what they enter afterwards** — the item,
the quantity, the vendor and the order are fixed by the allocation at recording
time, and fixing one means deleting the delivery and entering it again. The form
says so twice.

## What it always carries

**identity.** The heading `Record a delivery`, and under it the line
`What was delivered, and on which job. The app works out which order it belongs
to.` — a statement of the form's whole contract, in one sentence, before any field.

**action — the job,** a required dropdown with the placeholder `Select a job…`,
showing code and name. It gates everything below it.

**action — a checkbox in a bordered box:** `The packing list shows a PO number`.
It is disabled until a job is chosen. Ticking it reveals a text field with the
placeholder `HYE-PO-YYYYMMDD-##`, which is the app's own ID format spelled out as
the hint.

**action — the vendor,** a dropdown **only when no order number was given**. An
order fixes its vendor, so the field disappears rather than being pre-filled and
locked.

**action — `Items on the packing list`,** a repeating row: the material chosen from
a dropdown, and a quantity. An add-row control sits beside the heading and is
disabled when there is no vendor, no candidate material, or every candidate has
already been claimed by a row.

**Each option in the material dropdown carries its own remaining quantity** —
`N undelivered`, or `fully delivered` when there is none left. So the choice is
made with the order's state visible rather than after it.

**evidence — two standing caveats under the item rows,** both always present
because both describe how the list itself was built:

- that the list holds only materials from purchase orders on this job for this
  vendor; that something ordered from a different vendor is its own delivery; and
  that an order placed before the app recorded deliveries will not appear at all —
  keep the packing list and tell the office.
- that the app decides which order each item belongs to, and that correcting an
  item or a quantity later means deleting the delivery and entering it again.

**action — `Received Date`.**

**action — `Packing list photo`,** a file input accepting PDF, JPEG or PNG.
Required — the deliveries list's own empty state tells readers that the photo is
what makes an arrival a record.

**action — `Notes (optional)`,** with `(optional)` inside the label in lighter
weight, and the placeholder `Damage, a partial pallet, who signed for it…` — three
examples that tell the reader what the field is for better than a label could.

**action — the submit button,** whose label is `Record delivery`, or `Recording…`
while saving.

## What it carries only sometimes

**When a chosen material has nothing left undelivered:** an amber paragraph under
that row saying everything ordered from this vendor for this item on this job is
already delivered, that recording it will be flagged as over-delivered, and to
check the packing list against the order. It does **not** block the entry — the
packing list is the fact and the app records it.

**When the app can plan the allocation:** a preview under the first row for each
material, separated by a rule, listing one line per order the quantity will be
split across — the order's ID, or `Not against any order` — with an amber
`over-delivered` beside any line that exceeds. This is the app showing its work
before the reader commits.

**When nothing on the job orders that item from that vendor:** the refusal
`Nothing on this job orders this item from this vendor, so there is no order to
record it against.`

**When the packing list named an order and the quantity exceeds it:** a sentence
saying that, because the packing list names that order, the extra is recorded
against it and flagged rather than allocated to another order.

**When the app can work out which invoice this delivery answers:** a box above the
date, before the fields, carrying one of several sentences — one invoice matched
and attached, several each attached, or an ambiguous case where none was. It is
gray when the app is simply reporting what it did and **amber when it is asking the
reader to check something** — a shared ordered item, or a tie nothing could break.
A tie-break adds a second sentence in the same box, and turns it amber, because a
tie is the one attachment here that asks rather than tells.

**Nothing appears at all when the ordered items place no bill.** An unpaired
invoice is the ordinary state, not an event to report — so the box is absent
whenever the app has nothing to claim, and that silence is what this preview
must not break.

**The preview comes before the control, not after.** That order is the order of the
facts: the app has decided, and the checkbox for saying otherwise is for the rarer
case where the document disagrees.

**When the photo is uploading, attached or failed:** `Uploading {filename}…` in
gray, `{filename} attached` in green, or `Upload failed: {error}` in red.

**When the save fails:** the error in red above the button.

## What must agree elsewhere

**`N undelivered` / `fully delivered` names a specific subtraction** — the ordered
quantity less what has been delivered — and the app's rule is that a subtraction is
named for what it subtracts. `fully delivered` is used for the zero case rather
than `none undelivered`, because the double negative is unreadable and the positive
says the same thing.

**`over-delivered` here is the same word as the stored flag** it will write, and as
the tag on the delivery detail, the deliveries list and the purchase order detail.
Four places, one word, one meaning.

**The pairing sentences are shared with the invoice detail's own banner**, which
reports the same judgment from the other direction. One predicate serves both, so
the two screens cannot disagree about why a delivery and an invoice were paired.

**The gray-versus-amber split in the pairing box is the app's general grammar:**
gray reports what was done, amber asks a person to check. The invoice detail uses
the identical split for the identical box.

**The allocation preview is the same rule that writes the rows**, and the delivery
detail's `Recorded against` table is the same allocation read back. A reader should
recognize the second from the first.

**The photo requirement matches the quotation on the request form and the file on
the invoice form.** In all three the document is what makes the record a record.

**`Not against any order` is the same phrase** the delivery detail's table uses for
the same state.
