# Invoices

Route: `/invoices`
Who reaches it: anyone signed in, then row-scoped — an invoice is visible when it
charges a purchase order the reader can see. Creating one is Admin only. One whole
column is President-or-Admin.

## What it answers

Which invoices have come in, and is anything wrong with one before it gets paid? For
the office this is a payment queue; for a site staffer it is the record of what a
vendor has charged against their jobs.

## What it always carries

**identity.** The heading `Invoices`.

**evidence — the table, six columns, and a seventh for a President or an Admin.**
Invoice ID, Vendor, Issue Date, Due Date, Amount Due, Delivery. Amount Due is
right-aligned currency and is the vendor's stated total, never a computed one.

**verdict — the Delivery chip.** One of `Delivered` / `Mismatch` /
`Awaiting delivery`. This is the same chip the invoice detail shows beside its own
`Delivery` heading, from the same function, so the row a reader clicks and the
page they land on cannot describe the invoice differently.

`Mismatch` is red and is the only red chip in the app. It is deliberately not
`partial`'s amber: amber on this axis would put a stage color on an error, and
under the app's one-delivery premise a shortfall here is not a stage — nothing
further is coming.

**The column head is `Delivery`**, the same word the purchase order list carries
over the same chip set. One word, two subjects, and the row supplies which.

## What it carries only sometimes

**When the reader is an Admin:** a control to record a new invoice. Everyone else
reaches this list but cannot add to it, because invoicing is office work.

**When the reader is President or Admin:** a seventh column, headed `Status`. For
everyone else **the column does not exist** — the table is one column narrower and
nothing marks where it was. Inside it, the payment word: `Paid` with its date in
green, or `Unpaid` in gray.

**When that reader's invoice also fails its own arithmetic:** a red
`⚠ Check the total` badge **stacked underneath** the payment word rather than
beside it. The stacking is measured rather than chosen: the column is 176px, the
payment word runs to 104px and the badge to 102px, so the pair needs 210px on one
line, and every other column in the table is declared from its own widest content
with 8px or less to give. Stacking costs a second line on an invoice that is both
paid and flagged, and nothing else.

This badge is **not** the kind of variance an employee is on this screen to
catch. It is the header flag — the vendor's stated total against what its items
add up to — which means the entry missed something, and it is the office's to
check and the office's to fix since only an Admin can edit an invoice.
The kind an employee cares about, a charge differing from what its order agreed,
has **no mark in this list at all**: it is on the invoice's own page, per charge,
where the order it disagrees with is one click away.

**When there are no rows:** one of two sentences. `No invoices yet.` when the base
has none, and `No invoices to show. You see an invoice when it charges a purchase
order you raised or one on a job you are assigned to.` when the reader's scope is
empty. Same distinction the purchase order list draws.

**When some delivery is still waiting for an invoice:** a strip above the table, with
a counted heading — `N deliveries are waiting for an invoice` — the line
`Longest wait first. No invoice yet covers what these deliveries brought.`, and one
row per delivery: its ID as a link, its details, and how many days it has been
waiting. This is the vendor-chasing worklist, and it is the reason the whole
delivery feature exists — the month-end email asking every vendor for missing
invoices is what currently stands in for it.

**Like every strip, it is silent when empty.**

**The strip and the table admit different readers, and that is deliberate.** The
table is invoices, gated by the walk that reaches `canViewPR`; the strip is
deliveries, gated by job assignment. Two different rules on one page, because
the two report on two different kinds of record.

**When some invoice is still waiting on a delivery:** a **second** strip, below the
first and above the table, with a counted heading —
`N invoices are waiting on a delivery` — then this line:

`Longest wait first. Nothing has confirmed the material these invoices charge for.`
`Only invoices that have waited N days or more are listed.`

and one row per invoice: its ID as a link, its issue date with the days it has
waited, the vendor, and one of two words saying which state it is in.

**The third sentence is the threshold, and the strip states it because the list is
a claim.** An invoice with no delivery matched to it is the ordinary state, not an
exception — the vendor emails the invoice at shipment, so a worklist holding every
one of them is the table below with a different heading. So an invoice reaches this
strip only once it has waited long enough that nobody expects the delivery to still
be in flight, and the strip says which number it applied so a reader knows what the
list is asserting. `N` is a whole number of **calendar** days, counted the same way
the row's own `Nd` is counted, so a reader can check one against the other.

**The wait applies to both row words equally.** `delivered, not matched` looks like
it should skip it — something arrived, so the office rather than the vendor is what
is being waited on — but the signal behind that word is much weaker than it reads:
it fires when any quantity was delivered against any one of the orders the invoice
charges, by any delivery, possibly answering a different invoice entirely. A
redesign must not present the two words as two urgencies.

The two words are `nothing delivered yet`, when nothing has been delivered against
any order the invoice charges, and `delivered, not matched`, when something has and no
delivery is paired with it. **Neither claims a reason.** The refusal reasons the
pairing rule produces are never stored and it only runs when a document is written,
so an unmatched invoice is equally consistent with a refusal, with nothing having
arrived at the time, and with the pairing never having been attempted — the last
being the common case on today's seeded base. The words say what is observable and
send the reader to look.

**This strip is silent when empty too**, and it counts the days from `Issue Date` —
the vendor's own date on the document, the same choice the delivery strip makes in
using the packing list's `Received Date` rather than when either was entered here.

**Both strips can appear at once, and often on one situation seen from both ends.**
A delivery nobody has invoiced and an invoice nobody has matched each get a row, in
different strips. Neither strip's contents depend on the other's. They are told
apart without color: each heading names and counts its own subject, and the row IDs
carry different prefixes.

**Its row count and the number of `Awaiting delivery` chips in the table can
differ, and that is not a defect.** A chip says an invoice has no delivery
matched; a row says the app could compute no pairing for it yet **and enough time
has passed to ask about it**. The threshold is now the ordinary reason the two
figures disagree: an invoice entered this week wears the chip and earns no row.
An invoice whose ordered items nothing has delivered wears the chip and has a row;
one the pairing refused for another reason wears the chip and has none. **This paragraph
named a third case until #278** — an invoice charging no ordered item at all,
which two hand-entered rows on the base were in and which no invoice can be in
now.

## What must agree elsewhere

**The Delivery chip is the invoice detail's chip.** If the two vocabularies drift,
the list and the page describe one invoice two ways.

**`Mismatch` belongs to this axis and nowhere else.** It must never be borrowed
for a variance, which is the mirror of #179's rule that the two variance kinds
keep two words.

**`⚠ Check the total` is one of a pair.** The other is `⚠ Order variance`, which
appears on the invoice detail and on the purchase order detail. The purchase order
detail is the one screen showing both at once. They change together or not at all.

**An over-delivery tag is deliberately absent from this list**, though the
deliveries list carries one. The difference is whose fact it is: an over-delivery
is a fact about a delivery, and on an invoice row it would read as a fact about
the invoice.

**The two empty states are a set** with the purchase order list's three — the
distinction between "none exists" and "none for you" is the one that has to
survive.

**The strip shares its shape with every other strip in the app.**
