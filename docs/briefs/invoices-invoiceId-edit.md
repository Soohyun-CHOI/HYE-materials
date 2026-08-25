# Edit invoice

Route: `/invoices/[invoiceId]/edit`
Who reaches it: Admin only, like every invoice write path.

## What it answers

Nothing — it is a correction screen. What it has to make clear is **which parts of
an invoice can be corrected and which cannot**, because the boundary is not
obvious: an invoice's own numbers are editable, but the structural links that
connect it to an order are not.

## What it always carries

**identity.** The heading `Edit {invoice ID}`, using the app's own ID — so the
heading is the record's name with one word in front of it. A link back to the
invoice, labeled `← Back to invoice`.

**action — the header fields:** vendor, the vendor's own invoice number, issue
date, due date, `Amount Due`, `Shipping Fee`, and then `Tariff (optional)` and
`Sales Tax (optional)`, both with the placeholder `Leave blank if none`. Editing
`Amount Due` is allowed and recomputes the variance check — the app never
overwrites the vendor's stated total, but a person may fix a typo in it.

**Both optional money terms are always visible here, and hidden behind reveal
controls on the create form.** The difference is what each screen is for: a
correction screen shows every value that can be corrected, including the ones this
invoice does not currently have, because a term the vendor charged and nobody
typed is exactly what someone comes here to fix. A create form asks only for what
the document in front of the reader states. Neither convention should be moved
onto the other screen.

**action — `Items`,** with a standing sentence directly under the heading:
`Edit item values. Size/Unit and the linked PO are fixed here — to change an item's
PO or add/remove items, delete and recreate the invoice.` This is the sentence that
draws the boundary, and it is always visible rather than appearing on a failed
attempt.

**Each item is a card.** Item name, quantity, unit price and remark are editable.
Size and Unit are rendered as **disabled inputs**, not as text — they are frozen
reference copies from the ordered item, and the disabled control shows both what
they are and that they are not yours to change. The linked order is shown as a
read-only label.

**evidence — running previews.** Each card shows `Amount (preview):` computed from
the quantity and price as typed, and the section foot shows
`Items Subtotal (preview):`. Labeled `preview` because the stored values are
formulas that will be recomputed on save.

**action — a submit button.**

## What it carries only sometimes

**When an item carries the order-variance flag:** the `⚠ Order variance` badge on
that card, the same badge as on the invoice detail's items table.

**While saving:** the button reflects it.

## What must agree elsewhere

**`⚠ Order variance` is the same word here, on the invoice detail, and on the
purchase order detail's list of invoices.** One flag, one word, three places.

**Size and Unit are read-only here and on the new-invoice form, for one reason:** a
mismatch means the wrong ordered item was picked, so the fix is the link and never
the value. Both screens have to keep saying that, and the disabled-input treatment
is currently how this one says it.

**A charge's quantity has to be a whole number and its unit price a whole number
of cents**, and this screen edits both freely, so it is refused on submit with
`Every charge's quantity has to be a whole number.` or
`Every charge's unit price has to be a whole number of cents.` The same rule holds
on the new-invoice form; no control marks either figure as it is typed. What rests
on it is the half-cent threshold behind the box below.

**Editing `Amount Due` recomputes the variance flags** that the invoice detail and
the invoice list then render. So this screen is where the red `⚠ Check the total`
box on the detail gets resolved — a design that hides the relationship between the
two makes the flag look unfixable.

**The items are the folded rows' source, not the folded rows.** The invoice detail
shows one row per folded item; this screen edits the stored rows. A split invoice
item reads as one row there and as two cards here, and that is correct rather than
a bug — but a design should not imply the two counts must match.

**`preview` is this screen's word for a value the server will recompute**, and it
appears nowhere else in the app. If a redesign introduces live-calculated fields
elsewhere, this is the existing precedent to follow.
