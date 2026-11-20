# A material on a job

Route: `/materials/[jobCode]/[materialId]`
Who reaches it: an Admin, on every job, and a site manager, on the jobs they are
assigned to. Anyone else, and a material nothing on the job names, reads the
not-found text.

## What it answers

How much of this material is at each of the job's addresses, what is on its way to
or from them, what has happened to it, and — for the person standing at the address —
how do I record what we took, what we sent and what arrived?

## What it always carries

- The material's name, size and maker, and the job's code.
- **In stock, by address**: each address the material was delivered to, received
  at, issued or sent from, or is on its way to or from, with `Delivered`, `Issued`
  and `In stock` in its unit.
- **Issue materials**: the address it is issued from — asked only where more than one
  holds some — the quantity, and the date it was issued, which starts at the reader's
  today and may be set back.
- **Send materials**: the address it leaves — asked only where more than one holds
  some — where it goes, the quantity, and the date it was sent, which starts at the
  reader's today and may be set back but not forward. Where it goes is any address of
  any open job, this job's own others first and then each other job's, grouped by
  job; the address it leaves is not offered. A closed job may still send what it
  holds, and is offered as no place to send to.

## What it carries only sometimes

- **A material that was sent or received** carries `Received`, `Sent` and
  `In transit` in the stock table as well, as the job's list does.
- **In transit**, while any of the material is on its way from or to this job: one
  entry per send. Leaving: where it goes (the address and its job), the address it
  left, the day it was sent and who sent it, how much of what was sent is not yet
  received, and how many days it has been on the way. Coming: where it comes from,
  the address it goes to, the day it was sent and who sent it, and how much is not
  yet received. Under each, what the reader may do to it:
  - **Receive materials**, on the job it goes to: how many arrived and the day, which
    starts at the reader's today and may be set back to the day it was sent but no
    earlier, and not forward. Less than is left keeps the rest on its way, to be
    received later.
  - **Cancel send**, on the job it left: how many of what is left to take back to the
    address it left — all of it unless fewer are typed. The send it cancels is the
    one recorded; material that did leave is received or written off instead.
  - **Write off**, the office's alone: all that is left, after one question that names
    the quantity. Nothing more of that send can be received afterwards.
- **Nothing in stock anywhere** replaces the issue and send forms with one sentence
  saying none can be issued or sent.
- **A refusal** says which field is wrong, or — when the address no longer holds that
  much, or less is on its way than was typed, or the place it goes has closed — what
  is true now, and that nothing was recorded. The page's figures are redrawn with it,
  since they were out of date. Two people settling one send in the same moment are
  told so without a figure, over the figures drawn again.
- **A count below zero** is shown as it is, as on the list.
- **Activity**, once there is a row, newest first by the day it happened: each
  delivery of the material as `Delivered` and its quantity, naming the delivery and
  linking to it; each issue as `Issued`; each send as `Sent`, naming where it went;
  each receipt as `Received`, naming where it came from and the day it was sent; each
  cancel as `Send canceled` and each write-off as `Written off`, naming the day the
  send left and where it was going — with the address, who recorded it and when. The
  day it happened and the moment it was recorded are two columns, so a receipt shows
  the day it arrived, the day it was sent and when it was recorded apart.

## What must agree elsewhere

- An issue is a row of `Material Log` with the event `Issued` and a negative
  quantity, a send one with `Sent`, a receipt `Received`, a cancel `Send canceled`
  and a write-off `Written off`; the job's list counts them the same way this page
  does.
- What this page shows on its way to another job is what that job's page shows
  coming, and the other way round.
- Deleting a delivery whose quantity has since been issued or sent, so that the
  address would go below zero, is refused on the delivery's page; that refusal says
  to record the correct delivery first.
- The page costs 13 operations, the people who recorded each row and who sent what is
  on its way among them, and one more once the material was sent to or received from
  another job. Recording an issue costs 10: the stock read before the write and again
  after it, the id and the row; a refusal for the stock, 6 or 7. Recording a send
  costs 13 — the issue's reads, and the jobs and addresses where it goes — a receipt
  6, a cancel and a write-off 7; a refusal for what is left, 2 to 4.
