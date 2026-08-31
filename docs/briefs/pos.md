# Purchase orders

Route: `/pos`
Who reaches it: anyone signed in, then row-scoped by `canViewPR` against the
request behind each order. There is no button to create one — an order is
generated when a request is fully approved, never by hand.

## What it answers

Which orders are outstanding, and on which of them is something still missing —
material not yet delivered, or an invoice not yet received? This is the office's
worklist and the closest thing the app has to a dashboard.

## What it always carries

**identity.** The heading. It reads `Purchase Orders` here, while the link to
this screen from the root screen says `Purchase orders`. One screen, two casings —
see the shared brief's note on where the app disagrees with itself.

**action — a filter bar:** a multi-job picker, a `Raised by me` checkbox, a
status dropdown. Mirrored into the URL like the request list's.

**evidence — the table, eight columns.** PO ID, Vendor, `Job`, Total,
Status, Delivery, Invoice, Payment. The last three hold chips rather than text.

**`Job` headed `Job / Discipline` until #314**, one cell from two fields, both
reached through the parent request. Every document list carries `Job` and only
`Job` now; an order's discipline is on the request behind it, which this row links
to one page along. The column narrowed from 12.75rem to 5.75rem with it — a job
code is a house format of about ten characters, so this column stopped being one of
the two whose content nobody controls and Vendor is now the only one.

**verdict — three chips per row, one per axis, and they read left to right as the
chain the document goes through.** Under `Delivery`, one of `Delivered` / `Partly
delivered` / `Awaiting delivery` / `—`. Under `Invoice`, one of `Invoiced` /
`Partly invoiced` / `Awaiting invoice` / `—`. Under `Payment`, one of `Paid` /
`Partly paid` / `Not paid` / `—`. They share one palette on purpose: a reader
crossing the three columns on one row should not have to learn a second vocabulary
for the same three states plus a dash.

**All three column heads are nouns**, and that is why they read as one row.
`Invoicing` was a gerund beside a noun and bought nothing for the mismatch. The
head is `Invoice`, not `Invoiced`, because the detail screen uses `Invoiced` over a
quantity; `Payment`, not `Paid`, for the same reason one step along — the head
names the axis and the cell carries the state.

**What the `Payment` chip is about, and it is not the order.** An order is charged
by several invoices and an invoice charges several orders, so `Paid` is not a fact
an order holds. The chip states something about the DOCUMENTS: every invoice
charging this order is paid, or some are, or none is. **It never carries a figure**
— no amount, no count — because a money figure beside the order's `Total` invites
an addition that is wrong twice over, and one invoice's amount is not this order's.

**The dash means nothing charges this order**, which is a different silence from
the other two columns'. "Every invoice is paid" and "none is paid" are both
vacuously true of no invoices, so the cell asserts no debt rather than picking one.

**`Partly invoiced` beside `Paid` is the combination to protect, and the pairing is
the only thing that stops it misleading.** An order 40% billed whose one invoice is
paid reads `Partly invoiced` `Paid`, and both are true: what has been billed is
settled, and not everything has been billed. Read alone the payment cell would say
the order is finished with. **A redesign that separates these two columns, or that
lets one be read without the other, removes the only device that makes the pair
honest.**

## What it carries only sometimes

**When an invoice charging the order is past its due date and still unpaid:** a red
`⚠ Overdue` badge **stacked underneath** the payment chip, in the same cell.

**It is a badge and not a fifth chip value**, and the case that settles that is an
order charged by one paid invoice and one late one: a closed set has to pick a
single value, and either pick throws away something the reader came for. As a badge
both survive — `Partly paid` with `⚠ Overdue` under it. It composes with `Partly
paid` and `Not paid` only: an order whose every invoice is paid has nothing
outstanding to be late.

**The badge carries no day count and no date.** A count belongs to one invoice
while the badge is about a set, so an order with two late invoices would need a
rule for whose number to print. The date is on the invoice's own page.

**The due date is a real date on a real document and the app now compares it**,
which it did not before — `Due Date` was printed on two invoice screens and read by
no judgment anywhere. **A blank one is not late**, and blanks are reachable: the
field is optional on both invoice write paths, so an invoice this column cannot
judge for lateness is an ordinary record rather than a hand edit. It still counts as
an unpaid invoice; it just never earns the badge. A designer should know that state
exists.

**When any filter is active:** a clear-filters control.

**When there are no rows:** one of three sentences, and the three are not
interchangeable. `No purchase orders yet. One is generated automatically when a
purchase request is fully approved.` when none exists on the base at all — which
also explains why there is no create button. `No purchase orders to show. You see
a purchase order when you can see the request behind it.` when orders exist but
none is in this reader's scope. `No purchase orders match these filters.` when
the reader filtered them out. Telling the first two apart requires a count taken
before the visibility gate, which the screen does deliberately; collapsing them
into one sentence would tell a site staffer the company has never ordered
anything.

**When an order has been withdrawn:** the whole row dims to gray and stays in the
list. Same language as a withdrawn request on its own list.

**When an approved request has no order:** a strip above the table, with a
counted heading — `N approved requests have no purchase order` — and one of two
explanations. The office reads `Generation failed when the request was approved.
Generate the order here.` and gets a retry control on each row; everyone else
reads `… Ask the office to generate it.` and gets none.

The sentence deliberately avoids `yet`. Generation runs inside the approving
action and is never retried on its own, so a request in this state has already
failed and `yet` would tell the reader to wait for something that will not
arrive.

**Like every strip, it renders nothing when there is nothing** — no all-clear.

**Why a strip and not a column:** an approved request with no order **has no row
in this table**. The thing being reported is the absence of the row, so it cannot
be reported in one.

**When a signed order has not been sent to the vendor:** a second strip, below
the first, with a counted heading — `N signed orders have not been sent to the
vendor` — and one line for everyone: `Longest wait first. The vendor has not
received these, and sending one to the vendor is what places the order.` Each row
is the order's ID as a link, the day it was signed with a day count beside it,
and Job · Vendor. **Both strips on this screen carried Job / Discipline until
#314** — a strip row is a row a reader scans, so they follow the column's rule
rather than keeping a word the table below them has dropped.

**One voice and no control, and both follow from the same thing.** Sending
happens on the order's own page, where the vendor's address sits above the button
— that address is why there is no confirmation dialog, so a button here, with no
address beside it, would owe one. With nothing offered there is nothing for a
second voice to be about, and the line names no control because who may send is
decided per order rather than by role.

**No threshold: an order signed an hour ago is on this list.** What is waited for
is one click by a colleague who was emailed at the signature, not a vendor's
shipment, so it reads as waiting from the first day. The invoice list's own strip
does carry a threshold and says so in its sentence; if this one ever grows one,
the sentence has to say so too.

**The two strips stack in the order the document chain runs** — a request that
never became an order, then an order that never reached its vendor — and each
disappears on its own count, so a reader meets one, both or neither.

## What must agree elsewhere

**All three chips are the ones the order's own detail screen shows**, from the same
functions. The payment one matters most: that screen lists the invoices charging the
order and marks each `✓ Paid` or `Not paid`, so the chip here is a fold of exactly
those marks. If the two ever computed it differently a reader could meet `Paid` on a
row, open it, and find an unpaid invoice underneath — two answers to one question,
each looking right on its own screen. And the `Delivery` head is the same word the
invoice list carries over the same chip set — one word, two subjects, and the row
supplies which.

**`Not paid` is the app's one word for an unpaid invoice.** The invoice list said
`Unpaid` and the order detail's badge said `Not paid` until this column arrived and
would have made a third; they converged instead. `Paid` is the participle the field
is named for, so the negation is built by negating it.

**The failed-generation sentence is shared with the request detail**, which shows
the same state for one request. Both voices travel together.

**The three empty states are a set** and the distinction between "none exists"
and "none for you" has to survive. The invoice list draws the same distinction
with its own two sentences.

**The strip's shape is shared with every other strip in the app**: above the list,
counted heading, one explanatory line, an action on the row where the action
takes a row, silent when empty.

**The unsent strip's row shape is the invoice list's**: an id, then the date it
has been waiting since with a day count, then the wide cell. The ordering is the
same rule as well — longest wait first, shared with both strips on the other two
lists.

**This strip is on this screen because the office works here.** The
over-delivery strip is on the request list because site staff work there.
If a redesign introduces a real dashboard, that split is the thing to carry over —
a strip belongs where the people who can act on it already are.

**Dimming means ended**, as on the request list and the signing chain.

**`Job` is one column on four lists** — this one, the request list, the invoice
list and the deliveries list — and it carries a job code and nothing else, at the
same 5.75rem on all three that declare a width. A redesign may move it or restyle
it; what it may not do is let one of the four say something different from the
others, which is the state #314 ended.

**An order's discipline is on the order's own detail screen**, which #314 added
there for this reason: before it, `/pos`'s column was the only place an order's
discipline appeared anywhere in the app, so taking the word off this list without
a home for it would have been a loss rather than a tidying-up.

## What the widths assume

**The table is wider than the page and has been since the seventh column.** The
declared columns sum to 58.25rem (932px) against the 832px a `max-w-4xl` page minus
its padding has, so the table scrolls inside its own container; nothing is truncated
and the page itself does not scroll sideways. The sixth column took its width out of
the other five; the seventh and eighth did not, deliberately — these hand-declared
rem widths are what the design pass will take out, and re-cutting them now would be
a pixel judgment made twice.

**It was 65.25rem until #314**, which narrowed `Job / Discipline` to `Job` and gave
the 7rem back to nobody. That is the same call the seventh and eighth columns made
in the other direction: a column that carries one value takes one value's width, and
handing the difference to a neighbor is the pixel judgment those two declined to
make twice.

**The three chip columns are one width, 6.625rem (106px), and the payment cell fits
inside it with the badge.** Measured at 1280px: the chip runs to 57px and the badge
to 68px, and the badge STACKS under the chip, so the cell needs the wider of the two
rather than their sum. The stacked pair is 38px tall against a row that is 30px
without it — on this base the one row carrying the badge was already 49px for another
reason, so it grew nothing, but a badge landing on a single-line row would.
