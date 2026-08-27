# Purchase request detail

Route: `/prs/[prId]`
Who reaches it: row-scoped by `canViewPR` — a Draft only its requester, then
President or Admin, then the requester, then anyone assigned to the job, then a
signer on the chain, then the recipient of a correction request. Signing is
whoever's turn it is; withdrawing is the requester's; generating a missing order
is the office's.

## What it answers

Where is this request in its approval chain, and what is it asking for? Two
readers arrive with two questions. A signer wants to know whether it is their
turn and what they are being asked to approve. Everyone else wants to know
whether it has been approved yet and what happened to it along the way.

This is the only screen in the app with a **full audit trail**, and that is its
second job: every approval, every edit, every return for correction and its
reason, in one ordered list. A design that treats the history as decoration
loses the record of who agreed to what.

## What it always carries

**identity.** The PR ID as the page heading, then a block of small lines: the
status in bold, the job, the line, the vendor, and the requester. `Line` here
means a `Lines` row under a job and nothing else — it is not a row of the items
table, and the word is reserved. **A mark sits beside the heading when this is
not an ordinary request** — `Overage` or `Direct purchase`, the same two words
the request list uses.

**evidence — `Total Amount`.** The request's total, in the largest type on the
page, in a bordered block of its own.

**evidence — the items table, seven columns.** Item, Size, Unit, Qty, Unit
Price, Amount, Remark. Qty and the two money columns are right-aligned. Under it,
Items Subtotal, Shipping Fee and Total Amount. These figures are **live**, unlike
the purchase order's frozen copies of them — this table changes when a signer
edits and continues, and the order's does not.

**verdict — the signing chain.** A horizontal row of circles under a `Signers`
heading: `R` for the requester, then one numbered circle per signer in order,
then `PO` for the final signature. Each circle has the person's name truncated
underneath, and each has an accessible name giving the step, the person, the
confirmation type and the state in words. Connectors join them, and an arc is
drawn over the chain where a correction sent it backwards.

**Four step states, and two of them are told apart without color.** `done`,
`current`, `paused` — a signer who was passed and then pushed back by a
correction — and `not reached yet`. `paused` and `not reached yet` deliberately
share one fill and one text color, and differ **only** by a dashed border: a
signer who is not currently actionable reads the same as one not yet reached, and
the dashed border alone marks "already touched once". A redesign that drops the
border style has to replace that distinction with something other than color,
because the two states currently share theirs. The words for all four exist only
in the accessible name today.

**evidence — the history.** An ordered list under a `History` heading, each entry
a timestamp, an em dash and a sentence. It carries the request being created,
each signer's action — `approved`, `agreed`, or `edited and continued`, which
keeps its own word because editing is neither an approval nor an agreement — a
return for correction with the reason quoted verbatim, a correction being
resolved, every field change as `changed {field}: "old" → "new"`, and the
withdrawal if there was one. Sorted by time, not grouped by kind.

The field name in a change entry is printed **verbatim from the stored value**,
so it reads as the same word the items table above uses. It follows a field's
identity rather than the label in use when the row was written.

**action.** A link back to the full request list, deliberately unfiltered —
returning to a filtered list is the back button's job.

## What it carries only sometimes

Everything here is absent unless the entry says otherwise.

**When the request has two or more quotations:** an eighth column, `Quotation`,
on the items table, naming which quotation each item's price came from. With
zero or one, every item resolves to the same quotation and the column earns
nothing. The totals footer's trailing span changes with it.

**When the request has any quotation at all:** a `Quotations` section listing
each one as a link to its file, with the vendor's own quotation code in
parentheses when there is one. A request cannot be submitted without one, so this
is absent only on a Draft.

**When the status is `In Review` and it is the reader's turn:** the signing
panel — the controls to approve, to edit and continue, or to return it to someone
earlier for correction, with the list of people it may be returned to. For anyone
else at that status: one sentence, `Waiting on {name} to act.` The panel is the
largest thing on the page when it is there and absent entirely when it is not.

**When a turn failed and putting it back failed too:** a red line where the
ordinary failure message goes, one per control — `Do not save again`,
`Do not approve again`, `Do not send it back again` — and then what is still on
the request, by name: the items, the Shipping Fee, this turn's history entries,
the quotation it added, the reader's own signing status. It closes with
`Ask for these to be corrected in Airtable`, which is the only place this app
sends a reader off it.

**The distinction a redesign may not lose is between the two failures, not
between the three controls.** The ordinary one asks for a retry and is right to.
This one is the state where a retry commits the edit and destroys the record of
it, so the two must never read as one message with a different tail. Nobody
reaches either without an Airtable write failing.

**When the status is `In Review` and the reader is the requester:** a withdrawal
control at the foot, behind a top border. It sits outside the turn gate on
purpose — a requester may withdraw their own request whatever whose turn it is.

**When the status is `Approved` or `PO Signed`:** a `Purchase Order` section.
Either the order's ID as a link with its status in bold, or — when approval
happened but no order exists — a sentence saying generation failed, in one of two
voices: the office is told to generate it here and given the control, everyone
else is told to ask the office. The sentence deliberately does not say `yet`:
generation runs inside the approving action and is never retried on its own, so a
request showing this has already failed and `yet` would tell the reader to wait
for something that will not arrive.

**When the request has notes:** one more line in the identity block.

**When the request was withdrawn:** a red caption above the signing chain saying
the requester ended it and no further signing will happen, and the chain below it
dims. The circles stay frozen where they got to, which is the honest record of
how far it went. The caption is needed because the paused and not-reached colors
read the same as a chain that never started.

**When this request covers material a site bought directly:** one amber line at
the top, in the same slot the overage banner uses, saying that the material was
bought before any request existed, naming the vendor and their own invoice
number, and then what approving it means — that it accepts a purchase already
made rather than authorizing a new one. **That last clause is the point of the
whole mark**: a signer's decision here is not whether to buy.

**The overage kind has no such sentence, deliberately.** Its own banner is
already at the top of the page and says more than a kind sentence could — how
much arrived beyond which order, on which delivery. Two voices for one fact is
what the shared slot exists to avoid, so the two kinds differ only in what fills
it.

**When this request covers an over-delivery, or one covers its own:** one or more
amber banners at the very top, above the confirmation line and the money. Every
word is derived rather than stored, so withdrawing the request reopens the
situation by itself. They stay after signature, because an overage request read
on its own looks like a duplicate with no quotation of its own.

**When the reader has just arrived from an action:** a green confirmation line.

## What must agree elsewhere

**The status word is the request list's.** `Draft`, `In Review`, `Approved`,
`PO Signed`, `Withdrawn` — five values of one field, and the list column and
this block must not name them differently.

**The failed-generation sentence is shared with the purchase order list's
strip**, which reports the same state across every request at once. One state,
one sentence, two screens, and the two voices — office and everyone else — travel
together.

**The purchase order this generated is a link both ways.** That screen names this
request; this one names that order.

**`Line` is reserved.** It names a `Lines` row under a job here and on the
request list's `Job / Line` column, and a row of the items table is an **ordered
item** in prose and screen copy everywhere in the app. A redesign that labels a
table row a "line" collides with a real link field on this very screen.

**The items table is the same seven columns as the purchase order's first
seven**, because the order is generated from it. What differs is that these are
live and those are frozen, and a reader crossing between them should see the same
shape carrying that one difference.

**A disagreement to know about rather than to preserve:** this table renders Unit
Price and Amount as **raw numbers** while the purchase order detail and the
invoice detail render the same two columns as formatted currency. Three tables of
the same shape, two number formats. It is recorded here because a brief says what
is there; a redesign should settle it rather than reproduce it.
