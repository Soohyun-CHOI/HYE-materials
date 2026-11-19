# A material on a job

Route: `/materials/[jobCode]/[materialId]`
Who reaches it: an Admin, on every job, and a site manager, on the jobs they are
assigned to. Anyone else, and a material nothing on the job names, reads the
not-found text.

## What it answers

How much of this material is at each of the job's addresses, what has happened to it,
and — for the person standing at the address — how do I record what we took?

## What it always carries

- The material's name, size and maker, and the job's code.
- **In stock, by address**: each address the material was delivered to or issued
  from, with `Delivered`, `Issued` and `In stock` in its unit.
- **Activity**, newest first by the day it happened: each delivery of the material as
  `Delivered` and its quantity, naming the delivery and linking to it, and each issue
  as `Issued` and its quantity; with the address, who recorded it and when.
- **Issue materials**: the address it is issued from — asked only where more than one
  holds some — the quantity, and the date it was issued, which starts at the reader's
  today and may be set back.

## What it carries only sometimes

- **Nothing in stock anywhere** replaces the form with one sentence saying none can
  be issued.
- **A refusal** says which field is wrong, or — when the address no longer holds that
  much — how much it does hold, naming it, and that nothing was issued. The page's
  counts are redrawn with it, since they were out of date.
- **A count below zero** is shown as it is, as on the list.

## What must agree elsewhere

- An issue is a row of `Material Log` with the event `Issued` and a negative
  quantity; the job's list counts it the same way this page does.
- Deleting a delivery whose quantity has since been issued, so that the address would
  go below zero, is refused on the delivery's page; that refusal says to record the
  correct delivery first.
- The page costs 13 operations, the people who recorded each row among them. Recording
  an issue costs 10: the stock read before the write and again after it, the id and the
  row; a refusal for the stock, 6 or 7.
