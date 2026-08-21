# Purchase requests

Route: `/prs`
Who reaches it: anyone signed in. The table is then row-scoped by `canViewPR`, so
two readers on one day see two different lists and neither is told what the other
sees.

## What it answers

Which requests are mine, or waiting on me, or still moving?

Worth knowing about how it is reached: **the home screen does not link here.** Its
four links go to the new-request form, the price list, the deliveries list and the
purchase order list, so this screen is currently arrived at by typing its URL or by
backing out of a request. That is a gap in the navigation rather than a decision
about this list.

## What it always carries

**identity.** The heading `Purchase Requests`.

**action.** A `New PR` button beside the heading — the only filled, high-contrast
button on the screen.

**action — a filter bar** above the table, in a bordered box: a job picker that
takes several jobs at once, a `Raised by me` checkbox, and a status dropdown whose
first option is `All`. The active filters are mirrored into the URL, so a refresh,
a shared link and the back button all restore the view.

**evidence — the table, six columns.** PR ID, Requester, Vendor, `Job / Line`,
Total, Status. The ID is a link; Total is right-aligned currency. `Job / Line`
is one cell from two fields, the job code and the line name joined by a middle
dot, and it reads as an em dash when there is no job.

**verdict — the Status column.** One of `Draft`, `In Review`, `Approved`,
`PO Signed`, `Withdrawn`. Plain text rather than a chip, and it is the only
per-row judgment the list makes.

## What it carries only sometimes

**When any filter is active:** a `Clear all filters` control in the filter bar,
and the empty state below changes wording — see the next entry.

**When there are no rows to show:** one of two sentences, and which one matters.
`No PRs match these filters.` when the reader has filtered something out, and
`No purchase requests to show.` when they have not. The second covers both an
empty base and a reader whose scope is empty, and it does not distinguish them.

**When the reader is assigned to no jobs at all:** the job picker is absent
entirely rather than empty.

**When a request has been withdrawn:** the whole row is dimmed to gray rather
than hidden. Withdrawal is a state transition and not a delete, so the row stays
on record; dimming is the app's standing language for "ended", used again on the
purchase order list and on this request's own signing chain. The ID link inherits
the muted color and stays clickable.

**When some over-delivery has no correction raised for it:** an amber strip
between the heading and the filter bar. It carries a heading with a count —
`N over-deliveries have no correction` — the line `Longest wait first. A row with
everything it needs raises the correction here; the rest say what has to come
first.`, and one line per case: the delivery ID as a link, a short label, and
either a control to raise the correction or a short chip saying what has to
happen first (`no invoice yet`, `spans two invoices`, `invoice has no file`, and
three more). The count was wrong here before this line was corrected — there were
seven chips, not six.

**One of those chips covers two opposite errors on purpose.** `invoice and
delivery disagree` is shown both where the vendor invoiced less than it sent and
where it invoiced more; the two are different facts and the delivery detail's
sentence says which. They share a chip because what a reader does about either is
the same — take it up with the vendor — and a closed set gains nothing from two
values with one action behind them.

**The strip renders nothing at all when there is nothing.** No all-clear, no
empty box, no heading. This is a deliberate rule shared by all three strips in
the app: a standing all-clear above every list is a thing people learn to skip,
and then it is not a signal on the day it changes. It is the single most
important conditional behavior in the app to preserve.

**Why it is a strip rather than a column:** the fact it reports is about a
request that **does not exist yet**, so the row that would carry it is the thing
that is missing. Every strip in the app exists for that reason, and none of them
is a column for that reason.

## What must agree elsewhere

**The strip's shape is one of three.** This one, the purchase-order list's
awaiting-order strip, and the invoice list's awaiting-invoice strip are one
pattern: sit above the list, carry a counted heading and one explanatory line,
list one row per case with an action on the row where there is one, and render
nothing when empty. They should stay one pattern — a reader who learns one has
learned all three.

**The action on a strip row is on the row because the row is what the action
takes.** One purchase order can carry several ordered items each with its own
excess, so the unit that can raise anything is the row, not the order and not the
delivery. The same reasoning put the retry on a row in the awaiting-order strip.

**A blocked row gets a chip, not its sentence.** The shortest refusal runs to 130
characters, which is not a row at this width. The full sentences are on the
delivery detail, where there is room, and the short reasons here are authored
alongside them so the two cannot say different things.

**The strip's action opens the same preview as the delivery detail's**, from the
same component, so both screens name the invoice, the unit price and the file the
quotation will come from. Neither offers a bare button.

**`Job / Line` is two fields and `Line` is reserved** — a `Lines` row under a
job, never a row of an items table.

**Dimming means ended, here and on the purchase order list and the signing
chain.** Three places, one meaning.
