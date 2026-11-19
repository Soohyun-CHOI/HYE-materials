# A job's inventory

Route: `/materials/[jobCode]`
Who reaches it: an Admin, on every job, and a site manager, on the jobs they are
assigned to. Anyone else, and an address naming no job, reads the not-found text.

## What it answers

What does this job have, and where did it go? For each material: how much was
ordered, how much was delivered, how much the site has issued, and how much is in
stock now.

## What it always carries

- The job's code and name.
- One row per material ordered, delivered or issued on the job, by the material's
  name, size and maker, with four figures in its unit: `Ordered`, `Delivered`,
  `Issued`, `In stock`. Each row opens the material's page on this job.
- **Ordered** counts every order raised on the job that was not withdrawn, signed or
  not — the rule delivery recording uses.
- **Delivered** is what the job's recorded deliveries hold, over-deliveries included.
- **In stock** is delivered less issued (and, from later issues, sent, received and
  corrected), counted where each delivery was recorded.

## What it carries only sometimes

- **A job holding material at two addresses or more** offers a choice between all
  addresses together and one group per address. Grouped by address, the figures are
  `Delivered`, `Issued` and `In stock`; `Ordered` stays the job's, because an order's
  address is where the vendor was told to send it and stock is counted where it was
  delivered.
- **A count below zero** is shown as it is, never as 0. It can follow only from two
  issues racing past each other in a way the app could not hold apart; a count
  correction is what fixes it.
- **A job with nothing ordered or delivered** reads one sentence saying so.

## What must agree elsewhere

- The four figures are the same figures the material's own page shows for the job,
  and its `In stock` by address is the address view's.
- A delivery's address is where its quantity is counted; the delivery list and the
  delivery's own page show the same address.
- Reading this screen costs 11 operations on a job of 35 materials and 15 deliveries,
  and the same whatever the number of jobs or materials: the jobs, the job's
  deliveries, their items and its log rows by id, the ordered items through delivery
  recording's walk, the materials by id and the addresses. What grows it is the job's own history, one operation per 50 rows.
