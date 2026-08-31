# Invoices

Route: `/invoices`
Who reaches it: anyone signed in, then row-scoped — an invoice is visible when it
charges a purchase order the reader can see. Creating one is Admin only. **Every
column is readable by every reader who reaches the row** — that was not true until
#309, which opened the payment column, and it is the only reader-dependent thing this
screen has ever had.

## What it answers

Which invoices have come in, and is anything wrong with one before it gets paid? For
the office this is a payment queue; for a site staffer it is the record of what a
vendor has charged against their jobs.

## What it always carries

**identity.** The heading `Invoices`.

**evidence — the table, eight columns, the same eight for every reader.**
Invoice ID, Vendor, `Job`, Issue Date, Due Date, Amount Due, Delivery, Status. Amount
Due is right-aligned currency and is the vendor's stated total, never a computed one.

**`Job` arrived in #314 and this list had carried nothing like it.** The other three
document lists all did — `/prs` and `/pos` headed `Job / Discipline` and
`/deliveries` headed `Job` — so the office, which #211 gave every invoice on the
base, read this one with no way to tell which site the material was for. It is the
job code alone, and an em dash where the app cannot name one.

**An invoice holds no job, which is why this is the only one of the four that needed
a judgment behind it.** A delivery holds a `Job` link and a request reaches one
through its discipline; an invoice reaches one only by walking to the order it
charges and the request behind that. **It is the same walk this screen's row gate
already makes**, so the column costs no query of its own — and it is resolved by one
function that takes no reader, which is the whole of what keeps two readers from
seeing two values on one row. Measured: the office and a site employee spend the
same 14 operations on this screen and the breakdown is identical table for table.

**One invoice charges orders on one job**, which follows from the app's
one-delivery premise rather than from a field: a delivery holds a single job, and an
invoice is answered by one delivery or none. Nothing on the write side enforces it,
so where the walk finds two the column names neither rather than picking — the em
dash again. A redesign should know the cell has that third state and that no reader
has ever seen it.

**verdict — the payment word, in the `Status` column.** `Paid` in green or `Not paid`
in gray, and **no date beside either**: a list marks that the vendor was paid, and
when is stated on the invoice's own page. It read `Paid 2026-08-14` until #309, which
also opened the column — it was President-or-Admin from #211 and gone entirely for
everyone else from #179.

**`Not paid` was `Unpaid` until the order list grew a payment column of its own.**
The app had two words for one fact — this cell and the order detail's badge — and a
third surface would have made three, so they converged on the negation of `Paid`,
which is the participle the field is named for. The same word now reads at three
places, about one invoice here and about a set of them on the order list.

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

**A row the app could compute no summary for at all carries an em dash instead of
a chip**, which is a different fact from `Awaiting delivery`: that one is a
measurement, and this one is the absence of one. It is text with no color rather
than a fourth chip value, for the reason `_shared.md` gives about `absent`.

## What it carries only sometimes

**When the reader is an Admin:** a control to record a new invoice. Everyone else
reaches this list but cannot add to it, because invoicing is office work.

**When the invoice fails its own arithmetic:** a red `⚠ Check the total` badge
**stacked underneath** the payment word rather than beside it, in the same cell.

This badge is **not** the kind of variance an employee is on this screen to
catch. It is the header flag — the vendor's stated total against what its items
add up to — which means the entry missed something, and it is the office's to
check and the office's to fix since only an Admin can edit an invoice. **It is
readable by every reader anyway**, and the reason is worth carrying into a redesign:
the same fact is stated on the invoice's own page, ungated, in a red box under the
totals with both figures in it. A mark on the row a reader clicks and no mark on the
page they land on is the state #309 ended.
The kind an employee cares about, an item differing from what its order agreed,
has **no mark in this list at all**: it is on the invoice's own page, per item,
where the order it disagrees with is one click away.

**What the column's width assumes, because a redesign will want to re-cut it.** The
`Status` column was declared at 176px and the stack is what that figure was chosen
against: the payment word measured 104px as `Paid 2026-08-14` and the badge measures
102px, so the pair needed 210px on one line and would not fit. **#309 took the date
off the word, so the widest thing in the cell is the badge at 102px** and the pair
would fit on one line — the stack is kept, because a width is the design work's to
decide rather than a visibility change's. The eight columns sum to exactly the 832px
the page has. **A column is never appended here; the budget is re-cut** — which #314
did, taking `Job`'s 92px out of `Status` (−70) and `Delivery` (−14), each of which
keeps 4px on top of what it needs, plus 4px each from the two date columns.

**Two figures this brief carried were stale and #314 re-measured them in a browser.**
Every column here needs `max(its content, its own header) + 8px` of cell padding, and
on that basis: Vendor at 8rem is **33px short** of this base's longest name,
`Lone Star Pipe & Supply`, so that column has been wrapping to two lines on every row
— the old claim that it held the longest name "at 16 characters with nothing to
spare" described a shorter vendor than the base now has. And `Amount Due` is bound by
its own header at 84px against 88px declared, 4px short. Neither is made worse and
neither is fixed: giving Vendor the 161px it wants is a re-cut this page cannot
afford and the design pass can. **Vendor is where to give width back first.**

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

**`Job` is one column on four lists** — this one, the request list, the purchase
order list and the deliveries list — and it carries a job code and nothing else, at
the same 5.75rem on all four. A redesign may move it or restyle it; what it may not
do is let one of the four say something different from the others, which is the state
#314 ended.

**The strip shares its shape with every other strip in the app.**
