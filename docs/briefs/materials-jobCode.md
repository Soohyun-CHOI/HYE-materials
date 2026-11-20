# A job's inventory

Route: `/materials/[jobCode]`
Who reaches it: an Admin, on every job, and a site manager, on the jobs they are
assigned to. Anyone else, and an address naming no job, reads the not-found text.

## What it answers

What does this job have, and where did it go? For each material: how much was
ordered, how much was delivered, how much the site has issued, how much was sent to
or received from other addresses and is still on its way, and how much is in stock
now.

## What it always carries

- The job's code and name.
- One row per material ordered, delivered, issued, sent or received on the job, or on
  its way to it, by the material's name, size and maker, with four figures in its
  unit: `Ordered`, `Delivered`, `Issued`, `In stock`. Each row opens the material's
  page on this job.
- **Ordered** counts every order raised on the job that was not withdrawn, signed or
  not — the rule delivery recording uses.
- **Delivered** is what the job's recorded deliveries hold, over-deliveries included.
- **In stock** is delivered and received less issued and sent, plus what count edits
  changed, counted where each delivery and each receipt was recorded.
  Material on its way is in no address's stock, and what was written off as never
  received is in none either.

## What it carries only sometimes

- **A job that sent or received material** carries three figures more on every row:
  `Received` — what arrived at its addresses from other addresses; `Sent` — what left
  them, less what was taken back before it arrived; and `In transit`, which says on
  the row what is leaving the job and what is coming to it, a line each, in the
  material's unit. With them the row adds up. A send between two of the job's own
  addresses is both leaving and coming. A job that never sent or received anything
  carries the four figures alone.
- **A job whose count was edited** at any address carries `Count edited` on every row
  as well, before `In transit`: what the edits changed, with its sign (`+2 EA`,
  `-3 EA`), since an edit moves a count either way — so the row still adds up.
- **A job holding material at two addresses or more** — counting an address that
  only has material on its way to it or from it — offers a choice between all
  addresses together and one group per address. Grouped by address, the figures are
  `Delivered`, `Issued` and `In stock` (with `Received`, `Sent` and `In transit` as
  above); `Ordered` stays the job's, because an order's address is where the vendor
  was told to send it and stock is counted where it was delivered.
- **A count below zero** is shown as it is, never as 0. It can follow only from two
  writes racing past each other in a way the app could not hold apart; editing the
  count on the material's page is what fixes it.
- **A job with nothing ordered, delivered or on its way** reads one sentence saying
  so.

## What must agree elsewhere

- The figures are the same figures the material's own page shows for the job, and its
  `In stock` by address is the address view's.
- What is in transit to this job is what the sending job's material page shows as
  leaving, and the other way round.
- A delivery's address is where its quantity is counted; the delivery list and the
  delivery's own page show the same address.
- Reading this screen costs 12 operations on a job of 35 materials and 15 deliveries
  that sent nothing to another job, and one more once it sent to or received from
  one — 13 on that job since, its count edits costing nothing more: the jobs, the job's deliveries, their items and its log rows by id — the rows
  sending material to it read in the same query — the rows on other jobs that
  received or took back what it sent or was sent, the ordered items through delivery
  recording's walk, the materials by id and the addresses. It does not grow with the
  number of jobs or materials; what grows it is the job's own history, one operation
  per 50 rows.
