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

**When some over-delivery is waiting for a request:** an amber strip between the
heading and the filter bar. It carries a heading with a count —
`N over-deliveries are waiting for a request` — the line `Longest wait first. A
row with everything it needs raises the request here; the rest say what has to
come first.`, and one row per case: the delivery ID as a link, a short label, and
either a control to raise the request or a short chip saying what has to happen
first. The chips are `no invoice yet`, `invoice and delivery disagree`,
`spans two invoices`, `invoices differ on price` and `invoice has no file` —
named rather than counted, because this paragraph has twice carried a count that
went stale under it.

**When someone has a draft for one of those rows and has not submitted it:** the
row stays, and its control is replaced by a chip naming them —
`draft with chkim`. It is the same chip on both strips. The row leaves only when
the request is submitted, because until then it is visible to its requester and
nobody else; before this the row vanished the moment anyone pressed the button,
so an abandoned draft took the excess off the only list that showed it.

**One of those chips covers two opposite errors on purpose.** `invoice and
delivery disagree` is shown both where the vendor invoiced less than it sent and
where it invoiced more; the two are different facts and the delivery detail's
sentence says which. They share a chip because what a reader does about either is
the same — take it up with the vendor — and a closed set gains nothing from two
values with one action behind them.

**When the office has recorded a direct purchase on one of the reader's jobs:** a
second amber strip, under the first. Heading
`N direct purchases are waiting for a request`, the line `Longest wait first. The
office recorded these from a vendor's invoice; whoever bought the material raises
the request here.`, and one row per case: the vendor, the job code, the vendor's
own invoice number or `no invoice number`, the note the office left, a
`View invoice` link that opens the document they attached, and either a
`Raise the request` control or the same `draft with …` chip.

**This is the only strip whose rows were put there by a person.** Every other
list in the app is derived from records; these were entered by the office
because `/invoices/new` had no order to charge the invoice against, and the
reader is being asked to take responsibility for material somebody else
recorded. That is why the document is one click away and why the note is on the
row rather than behind anything.

**Its control opens a preview, not a request.** The modal says what the draft
will arrive with — the vendor and their invoice as its quotation — and what it
will not: what was bought, which part of the job it was for, and who signs. It
also says the row stays on this list, marked as theirs, until they submit.

**Two strips is the shape, not a stage.** They are not merged because their rows
come from different tables under different gates, their actions take different
records, and their refusals are different sets. The direct-purchase one is
second for no strong reason — neither outranks the other — so the strip readers
already know keeps its position.

**The strip renders nothing at all when there is nothing.** No all-clear, no
empty box, no heading. This is a deliberate rule shared by every strip in
the app: a standing all-clear above every list is a thing people learn to skip,
and then it is not a signal on the day it changes. It is the single most
important conditional behavior in the app to preserve.

**Why it is a strip rather than a column:** the fact it reports is about a
request that **does not exist yet**, so the row that would carry it is the thing
that is missing. Every strip in the app exists for that reason, and none of them
is a column for that reason.

## What must agree elsewhere

**The strip's shape is shared.** This one, the purchase-order list's
awaiting-order strip and the invoice list's awaiting-invoice strip are one
pattern: sit above the list, carry a counted heading and one explanatory line,
list one row per case with an action on the row where there is one, and render
nothing when empty. They should stay one pattern — a reader who learns one has
learned them all.

**The action on a strip row is on the row because the row is what the action
takes.** One purchase order can carry several ordered items each with its own
excess, so the unit that can raise anything is the row, not the order and not the
delivery. The same reasoning put the retry on a row in the awaiting-order strip.

**Both strips let a row go at the same moment, and it is not when somebody takes
it.** A record waiting for a request stays listed until that request has been
submitted; a draft is not a submission, and a draft is invisible to everyone but
its author. One rule, one implementation, two strips.

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
