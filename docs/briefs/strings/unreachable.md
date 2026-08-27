# Strings no reader can reach

**Text the app holds, renders in principle, and nobody sees — by screen (#288).**

A vocabulary sweep does not need to reword these, and a design must not draw room
for them. They are grouped by screen rather than by shape because both of those
questions arrive per screen: *what on this page does nobody read.* The other file is
grouped by shape because its reader is fixing a tool.

**Almost all of it is one pattern.** A Server Action returns a refusal for a state
its own form cannot produce, because a `required` control or a disabled submit
answers first — so the words a reader meets on a bad submit are the browser's, not
this app's. The rest is a role gate refusing after the page already refused, or a
failure path that needs Airtable to fail.

**How each was judged.** By reading the control that would produce the state: an
input's `required`, a submit's `disabled` expression, or the condition under which a
control renders at all. Two were checked in a browser instead, and say so. **Where a
screen's refusals were not all judged, the count says so** — a silence here would be
the same false completeness the inventory this replaces was written to avoid.

## `/login`

- **`Email is required`** — `app/api/auth/request/route.js:10`. The email input
  carries `required`, so an empty submit never leaves the page. **Checked in a
  browser**: with the field cleared the form reports invalid and the submit handler
  does not run, so the standing message stays and this one never appears.

## `/invoices/new`

Fourteen refusals; **ten unreachable, one reachable, three needing a failure.** The
reachable one is `Every item needs an ordered item from its PO.` — the ordered-item
select carries no `required`.

- **`Not authorized.`** — the page refuses a non-Admin before the form exists, so
  neither action can be reached from it.
- **`Select a Vendor.`** — the vendor select is `required`, and the submit needs a
  chosen order, which needs a vendor.
- **`Issue Date is required.`**, **`Amount Due is required.`** — both inputs are
  `required`.
- **`Attach the invoice file.`** — the submit is disabled until the upload reports
  done.
- **`Add at least one item.`** — the form opens with one row and the row `Remove`
  renders only from two rows up.
- **`Every item needs a name, quantity, and unit price.`** — Qty and Unit Price are
  `required` and the name is copied from the chosen ordered item.
- **`Every item needs a PO — pick one at the top or per item.`** — a row's own order
  select is `required` whenever it renders.
- **`One of the selected POs no longer exists. Reload the form and try again.`** — an
  order must be deleted from the base between the page load and the submit.
- **`Something went wrong creating the invoice. Please try again.`**,
  **`Couldn't record the direct purchase. Please try again.`** — a throw inside the
  rolled-back block, which needs Airtable to fail.
- **`Search failed — try again.`**, **`Couldn't load this PO's items — try
  re-selecting the PO.`**, **`Couldn't load the jobs — close this and try again`** —
  each needs its own fetch to fail.
- **`Upload failed: {error}. …`** — needs a rejected upload; the 20MB cap or a
  content type outside PDF/JPEG/PNG would do it, so this one is reachable with
  effort and is listed for the interpolated message rather than the sentence.

## `/invoices/[invoiceId]/edit`

Nine refusals, all in the parent route's `actions.js`; **seven unreachable, two
reachable** (the whole-number pair, which #254 measured as reachable because the
controls' `step` validation does not fire).

- **`Not authorized.`** — the page refuses a non-Admin first.
- **`Select a Vendor.`**, **`Issue Date is required.`**, **`Amount Due is
  required.`** — all three controls are `required`.
- **`Every item needs a name, quantity, and unit price.`** — all three are `required`
  on every row.
- **`Invoice not found.`** — the invoice must be deleted between the load and the
  submit.
- **`Something went wrong updating the invoice. Please try again.`** — needs Airtable
  to fail.

## `/invoices/[invoiceId]`

Seven refusals; **six unreachable, one reachable** — `Paid Date is required when
marking as Paid.`, because the date control carries no `required`.

- **`Only an Admin can update payment status.`**, **`Only an Admin can delete
  invoices.`** — both controls render for an Admin only, and the first is **thrown**
  rather than returned, so it would reach a reader as a framework error page.
- **`Invoice not found`** — thrown, and without the full stop its two namesakes on
  the edit screen carry.
- **`Something went wrong updating payment status. Please try again.`**,
  **`Couldn't delete the invoice. Please try again.`** — need Airtable to fail.
- **`Invoice File`** — not a refusal but the same class: the link's fallback text,
  used when an attachment carries no filename, and every upload path sends one.
- **`That item`** — `lib/invoiceOrderBreakdown.js`'s fallback for a charge with
  neither an item name nor a size; an item name is required on every write path.

## `/deliveries/new`

Twelve refusals; **nine unreachable, two reachable, one needing a failure.** The
submit is gated on one expression that covers most of them: photo uploaded, job set,
vendor set, at least one filled row, every started row complete, and a received date.

- **`Select a job.`**, **`Select the vendor who delivered.`**, **`Received Date is
  required.`**, **`Add at least one item.`**, **`Every item needs to be picked from
  the list.`**, **`Every item needs how much was delivered.`**, **`Attach a photo of
  the packing list.`** — seven clauses of that one gate.
- **`You can only record deliveries on a job you are assigned to.`** — the job
  dropdown offers only jobs the reader is assigned to.
- **`That job no longer exists.`** — the job must be deleted mid-form.
- **`Something went wrong recording this delivery. Please try again.`** — needs
  Airtable to fail.

Reachable, and not listed above: the packing-list order refusal (`… on this job for
this vendor. Check the number on the packing list.`) and `Nothing to record — check
the quantities.`

## `/pos/[poId]`

Eight refusals; **all eight unreachable.** This is the clearest case in the app of an
action stating refusals its own screen cannot produce, because every control here is
rendered only in the state its refusal excludes.

- **`PO not found`** — thrown.
- **`This PO was withdrawn and can no longer be signed.`**, **`This PO has already
  been signed.`** — the signing control is not offered in either state; the page's
  own comment says the action refuses it too and the control simply does not offer
  it.
- **`This PO was withdrawn — its PDF can't be regenerated.`**, **`This PO hasn't been
  signed yet.`** — the regenerate control renders only where the document is missing
  from a signed order.
- **`Something went wrong recording your signature. Please try again.`**,
  **`Something went wrong generating the PDF. Please try again.`** — need Airtable to
  fail.
- **`attachment fetch`** — thrown and caught internally. **Not a screen string at
  all**, and it is here because the extractor attributes a whole file: no reader can
  see it in any state.

## `/admin/jobs/new`, `/admin/vendors/new`, `/admin/lines/new`

- **`Not authorized`** — one string, all three screens. Each page refuses a non-Admin
  before its form exists, and the refusal is **thrown** rather than returned, so even
  a direct call surfaces as a framework error page rather than as the form's own
  message. The three actions keep the throw deliberately; `/admin/lines/new`'s own
  note records that its validation failures return `{ error }` for exactly the
  opposite reason.
- **`That Job doesn't exist. Pick one from the list.`** — `/admin/lines/new` only.
  The submit is disabled until a Job is chosen from the combobox, and the value is
  that Job's record id, so a nonexistent one needs a forged submit.

## `/prs/new`

Fifteen refusals; **eleven judged unreachable, four not judged.** The form carries
`required` on the job, the line, the vendor and every item field, and the submit is
disabled until a quotation file has uploaded — which answers the eleven. The four not
judged are the draft-management refusals, whose controls are per-draft and whose
gating was not traced.

## `/prs/[prId]`

Seventeen refusals; **none judged.** The signing chain's guards depend on whose turn
it is and on the request's status, and the controls that would produce each state are
spread across the signer bar, the correction form, the withdraw button and the
edit-and-continue form. Judging them means tracing four control sets against
`prSigning`'s turn rule, which this pass did not do.

**Two are worth stating even unjudged**, because they are the shape the rest of this
file is: `Only an Admin can generate a PO.` and `This PR isn't fully approved yet.`
are also rendered on `/pos` through the same imported action, and on that screen the
strip offers the control only for an approved request with no order — so on `/pos`
both are unreachable and on `/prs/[prId]` they may not be.

## `/prs`

Ten refusals; **none judged**, for the same reason: they belong to the two strips'
claim actions, whose offering rules are `lib/prWait.js`'s and were not traced.

## `/deliveries/[deliveryId]` and `/deliveries/[deliveryId]/edit`

Ten refusals, shared between the two screens; **six judged unreachable, four not
judged.**

- **`That delivery no longer exists.`**, **`That delivery item no longer exists.`** —
  the record must go between the load and the submit.
- **`Received Date is required.`** — the edit form's control is `required`.
- **`Something went wrong saving this delivery. Please try again.`**, **`Something
  went wrong replacing the photo. Please try again.`**, **`Couldn't open the request
  draft. Please try again.`** — need Airtable to fail.

Not judged: `Upload a photo first.`, `Nothing to correct.`, `This over-delivery
cannot be corrected.`, `Couldn't find the request behind that order.` The last three
are the overage claim's guards and the strip's own offering rule decides them.

## Screens with nothing here

`/`, `/login/confirm`, `/materials`, `/materials/[materialId]`, `/invoices` and
`/deliveries` hold no refusal at all. Every state on those six is a consequence of
the data, and all of it is reachable with the two fixture accounts.

## Coverage

**84 distinct refusal strings across the twenty-one screens.** Six screens hold none
at all; the rest are declared in eight `actions.js` files, and a file's refusals are
attributed to every screen that imports one export from it — which is why `/pos`
carries the signing chain's and both delivery detail screens carry the same ten.

**This file judges the refusals of sixteen screens and names what it did not judge
per screen.** Every unjudged refusal belongs to one of four files:
`app/prs/actions.js`, `app/prs/[prId]/actions.js`, `app/prs/new/actions.js` and
`app/deliveries/[deliveryId]/actions.js`. In all four the gate is a control set —
whose turn it is, which strip offers which row — rather than a `required` attribute
on one input, and tracing it means reading four control sets against
`lib/prSigning.js`'s turn rule and `lib/prWait.js`'s offering rule.

**Read the count, not the absence.** A screen with no entry under it either holds no
refusal — the six named above — or has its unjudged ones counted in its own section.
Nothing here is claimed reachable by omission, and nothing unjudged is claimed
either way.
