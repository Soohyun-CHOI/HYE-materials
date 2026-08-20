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

**evidence — the table, seven columns.** PO ID, Vendor, `Job / Line`, Total,
Status, Delivery, Invoice. The last two hold chips rather than text.

**verdict — two chips per row, one per axis.** Under `Delivery`, one of
`Delivered` / `Partly delivered` / `Awaiting delivery` / `—`. Under `Invoice`,
one of `Invoiced` / `Partly invoiced` / `Awaiting invoice` / `—`. They share one
palette on purpose: a reader crossing between the two columns on one row should
not have to learn a second vocabulary for the same three states plus a dash.

**Both column heads are nouns**, and that is why the pair reads as one row.
`Invoicing` was a gerund beside a noun and bought nothing for the mismatch. And
the head is `Invoice`, not `Invoiced`, because the detail screen uses `Invoiced`
over a quantity — two heads, two subjects, and the row supplies which.

## What it carries only sometimes

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

## What must agree elsewhere

**Both chips are the ones the order's own detail screen shows**, from the same
functions. And the `Delivery` head is the same word the invoice list carries over
the same chip set — one word, two subjects, and the row supplies which.

**The failed-generation sentence is shared with the request detail**, which shows
the same state for one request. Both voices travel together.

**The three empty states are a set** and the distinction between "none exists"
and "none for you" has to survive. The invoice list draws the same distinction
with its own two sentences.

**The strip is one of three in the app** and shares their shape: above the list,
counted heading, one explanatory line, an action on the row where the action
takes a row, silent when empty.

**This strip is on this screen because the office works here.** The
awaiting-correction strip is on the request list because site staff work there.
If a redesign introduces a real dashboard, that split is the thing to carry over —
a strip belongs where the people who can act on it already are.

**Dimming means ended**, as on the request list and the signing chain.
