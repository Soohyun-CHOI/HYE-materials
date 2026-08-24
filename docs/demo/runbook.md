# Demo runbook

Six acts. Each step names the URL, the account, what to point at, and — where
anything is typed — the exact values.

**Ids change on every rebuild.** The ones below were read off the base on
2026-08-19. Re-print them before presenting:

```bash
node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/demo/seed_full_demo.mjs --only=NONE
```

**Between rehearsals**, put the base back with one command — 4m 13s, and it checks
itself when it is done:

```bash
node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/demo/reset_demo.mjs --confirm
```

Then **sign in again** — the reset clears every session — and re-print the ids.

## Before the room arrives

**The three accounts.**

| Account | Role | Jobs | Used for |
|---|---|---|---|
| `soo@hanyangengusa.com` | President, Admin | 26-DEMO-01 | Acts I–V |
| `scoped-fixture@hanyangengusa.com` | Employee | 26-DEMO-01 | Act VI |
| `authz-fixture@hanyangengusa.com` | Employee | none | Act VI |

The two fixture accounts have no mailbox, so mint their links directly. **They
last 15 minutes and are single use** — mint them at the start of Act VI, not
now, and keep the command ready:

```bash
node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/demo/mint_session.mjs scoped-fixture@hanyangengusa.com
```

Open the printed URL in a **second browser profile** and press `Confirm sign-in`.
The session lands wherever the link is confirmed, which is what lets two accounts
sit side by side.

**Have open:** the app in the main profile signed in as `soo@`, a second profile
for Act VI, the President's inbox, and a terminal at the repo root.

**Have ready:** `scripts/demo/output/` — five PDFs the seed wrote.

**One attendee needs to be a signer.** Pick someone with a company account and
check their address in Airtable's `Users` first. They do **not** need a job
assignment: `canViewPR` admits a signer on the chain ahead of any job scope, so
the mail arrives and they can approve from their phone with no setup.

---

## Act I — The request

**Live.** Everything in this act is typed in front of the room.

### 1. `/` — as `soo@`

The only screen that states your own role back to you: `Signed in as
soo@hanyangengusa.com (President, Admin)`. Say there are three kinds of person
and this is the only place you see which one you are.

### 2. `/prs/new` — the context

| Field | Value |
|---|---|
| Job | `26-DEMO-01 — Round Rock Compressor Station` |
| Line | `Unit 2 Piping` |
| Vendor | `Lone Star Pipe & Supply` |

Point at Line being empty until a Job is chosen, and at it clearing when the Job
changes. A line from the previous job no longer applies.

### 3. `/prs/new` — quotations

Add **two** quotation entries, any file each. Two is deliberate: at two or more,
a `Quotation` column appears on every item row so each item can name which
quotation its price came from. At zero or one there is no choice to make and the
column is absent.

### 4. `/prs/new` — items, and the merge note

Type the same item **twice**:

| Item | Size | Unit | Qty | Unit Price |
|---|---|---|---|---|
| `Gate Valve` | `4"` | `EA` | `5` | `45.00` |
| `Gate Valve` | `4"` | `EA` | `5` | `45.00` |

A grey note appears above the buttons: *N items repeat an item above them — each
will be saved into that item, with the quantities added.* It is a **preview of
what saving will do**, not an error and not a blocker.

### 5. `/prs/new` — signers, then Submit

Signer 1: **the attendee**. Signer 2: yourself. Confirmation type per signer —
`Approval` and `Agreement` are two named kinds, not an on/off toggle.

Press `Submit PR`. **It does not go through.** A yellow box names
`HYE-PR-260819-01`, who raised it and when, and asks `Submit this one anyway?`

> **Why those numbers.** The duplicate rule keys on the same **Line** plus the
> multiset of *item name + qty + unit price* — size, unit and remark are
> deliberately not in the key, and every prior request on the line counts
> whatever its status. The merge runs **before** the check, so two rows of 5
> become one key of 10, which is what the seeded request carries. Two rows of 5
> is therefore the only way to show the merge note and the duplicate warning on
> one submission.

Dismiss it, explain, then `Submit anyway`.

### 6. The attendee's phone

The mail arrives. They open it, press `Confirm sign-in`, and land on the request.
Point out that opening the link signs nobody in — mail scanners open links before
people do, so the button is the feature.

They approve. Then it is your turn: **return it for correction** once, so the
chain shows a signer who was passed and pushed back, then approve through.

### 7. `/prs/HYE-PR-260819-02` — the chain, pre-made

Rather than wait for the live chain to reach every state, open this one. All four
step states at once:

| Step | State |
|---|---|
| Requester | `done` |
| 1 · Approval | `current turn` |
| 2 · Agreement | `paused (returned for correction)` |
| 3 · Approval | `not reached yet` |

Two of the four are told apart **without colour** — `paused` and `not reached
yet` share a fill and differ only by a dashed border. The History below quotes
the return reason verbatim.

### 8. `/prs/HYE-PR-260819-03` — withdrawn

A red caption above the chain, the chain frozen where it got to and dimmed. The
circles stay where they stopped, which is the honest record of how far it went.

### 9. `/pos/{new PO}` — the President signs

The order generated itself at full approval. Sign it. The PDF downloads — this is
the one document the system emits, and the office sends it to the vendor by hand.

---

## Act II — Invoicing, delivery, and the app doing the matching

**Live.** The centre of the demo. Both directions of the pairing, both ending
clean — the disagreements are Act IV's, on purpose.

### 1. Invoice finds delivery — the reverse direction

Generate the vendor's document for an order that has already been delivered. The
script pulls that order's real vendor and ordered items, so the PDF matches what
was ordered:

```bash
node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/demo/make-invoice-pdf.mjs HYE-PO-20260819-05
```

At `/invoices/new`, attach `scripts/demo/output/demo-invoice.pdf`. Detection
reads the order number off the file and fills the slot.

| Field | Value |
|---|---|
| Ordered item | `Pipe Support` `4"` |
| Qty | `30` |
| Unit Price | `22.00` |
| *(add a second item)* | |
| Ordered item | `Support Shim` `3mm` |
| Qty | `90` |
| Unit Price | `1.40` |
| Shipping Fee | `0` |
| Amount Due | `786.00` |

Save. **The pairing box appears**: the app matched this invoice to
`HYE-DL-260819-01` off the ordered items, and says nobody attached it by hand.
The delivery chip reads `Delivered` — invoiced and delivered agree.

> **Why it pairs.** The rule tests **set containment only** — does every ordered
> item this invoice charges appear on that delivery — plus the agreed unit price,
> plus whether the delivery has room left. Quantity is deliberately not part of
> it, which is what makes Act IV possible.
>
> Charging only the Pipe Support would pair too (a subset is still contained), and
> would leave the order `Partly invoiced`. Both items is the tidier story and the
> PDF prints both.

### 2. Delivery finds invoice — the forward direction

`/deliveries/new`:

| Field | Value |
|---|---|
| Job | `26-DEMO-01 — Round Rock Compressor Station` |
| The packing list shows a PO number | leave unticked |
| Vendor | `Lone Star Pipe & Supply` |
| Material | `Flange Gasket 8"` |
| Qty | `50` |
| Received Date | today |
| Packing list photo | any image |

Each option in the material dropdown carries its own remaining quantity, so the
choice is made with the order's state visible — this one says `50 undelivered`.
Under the row, the **allocation preview** shows which order the quantity will be
split across, before you commit.

Above the date, the **pairing box**: `HYE-INV-260819-03` is attached as you
watch. That invoice has been waiting with nothing delivered against it.

> **Why 50 and not less.** Fifty is exactly what that invoice charges and exactly
> what the order asked for, so the invoice reads `Delivered` and no over-delivery
> is raised. Any smaller number still pairs — quantity is not part of the test —
> but the invoice would read `Mismatch`, which is Act IV's moment, not this one.

### 3. The order that was just live — and both variance kinds

Now invoice the order Act I created. Generate its document, substituting the PO ID
from Act I:

```bash
node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/demo/make-invoice-pdf.mjs HYE-PO-XXXXXXXX-XX
```

At `/invoices/new`, attach it. Detection fills the slot with the live order.

| Field | Value | Why |
|---|---|---|
| Ordered item | `Gate Valve` `4"` | the only item on that order |
| Qty | `10` | what the merge produced in Act I |
| Unit Price | `48.00` | the order agreed **45.00** → `⚠ Order variance` |
| Remark | `Vendor invoiced list price` | the field exists to say why |
| Shipping Fee | `0` | |
| Amount Due | `520.00` | items add to **480.00** → `⚠ Check the total` |

> **The thresholds.** Unit price flags at more than **one cent** of difference:
> 48.00 against 45.00 is three dollars. The header flags at more than the greater
> of **$5 or 1%** of the computed total — here that is $5.00 against a gap of
> $40.00.
>
> Nothing pairs with this one, and nothing needs to: no delivery exists against
> an order raised minutes ago. Do not draw attention to the absent pairing box —
> an unpaired invoice is this feature's ordinary state.

Save. On the invoice: the badge inside the item's name cell, the amber prompt
near the foot, and the red box under the table. **Two different facts with two
different remedies**, which is why they keep two words.

### 4. The two warnings, without saving

Attach `scripts/demo/output/demo26-withdrawn.pdf`: detection finds the order and
warns it was withdrawn. Then `demo26-unsigned.pdf`: it warns the President has
not signed and **selects it anyway**, because an invoice can be recorded against an
unsigned order. Note the word `unsigned` appended to the option label itself.

Navigate away without saving.

### 5. `/pos/HYE-PO-20260819-05`

Land on the order from step 1. Ordered, Delivered and Invoiced on one row, with
the two document lists under it. This is the reconciliation the whole app exists
for.

---

## Act III — The three waiting lists

**Pre-made.** Nothing typed.

### 1. `/invoices` — two strips at once

- **8 deliveries are waiting for an invoice** — longest wait first, days counted
  from the packing list's own `Received Date`.
- **14 invoices are waiting on a delivery** — days from the vendor's `Issue
  Date`, and one of two words per row: `nothing delivered yet`, or `delivered,
  not matched`.

The row you fixed in Act II is **gone from the first strip**. Point at that.

> Neither word claims a reason. The refusal reasons the pairing rule produces are
> never stored, so an unmatched invoice is equally consistent with a refusal, with
> nothing having been delivered, and with the pairing never having been attempted.

### 2. `/pos` — approved requests with no order

**2 approved requests have no purchase order**, each with a `Generate PO` control
on its row. The sentence deliberately avoids the word *yet*: generation runs
inside the approving action and is never retried, so a request in this state has
already failed.

### 3. `/prs` — over-deliveries waiting for a request

Seven rows. Two carry a `Raise the request` button; five say what has to happen
first, in four different words — the first two share one, because what a reader
does about either direction is take it up with the vendor. **This table named
two reasons #265 replaced** and was corrected in #274, which was sweeping the
word one of them carried; #278 then took an eighth row off it, `HYE-DL-260819-12`
with `no ordered item`, because the strip cannot say why that row is stuck
without describing a state only its own author can create.

| Row | Reason |
|---|---|
| `HYE-DL-260819-11` | `invoice and delivery disagree` |
| `HYE-DL-260819-10` | `invoice and delivery disagree` |
| `HYE-DL-260819-08` | `invoice has no file` |
| `HYE-DL-260819-07` | `spans two invoices` |
| `HYE-DL-260819-06` | `no invoice yet` |

### 4. Say the rule out loud

**All three strips render nothing when there is nothing.** No all-clear, no empty
box, no heading. A standing all-clear above every list is a thing people learn to
skip, and then it is not a signal on the day it changes. Act VI shows all three
silent.

---

## Act IV — When they disagree

**Mixed.** Two live, the rest pre-made.

Act II showed two pairings that both came out clean. This is the same machinery
on data that does not agree, and the order is the argument: a reader who has seen
`Delivered` twice knows what `Mismatch` is a departure from.

### 1. `/deliveries/new` — live, and the invoice turns `Mismatch`

| Field | Value |
|---|---|
| Job | `26-DEMO-01 — Round Rock Compressor Station` |
| Vendor | `Lone Star Pipe & Supply` |
| Material | `Steel Pipe 2" SCH40` |
| Qty | **`3`** |

`HYE-INV-260819-05` charges 10 of that item. The set of ordered items matches and
the delivery has room, so the pairing is made — and the invoice now reads
`Mismatch`.

Open `/invoices/HYE-INV-260819-05`: the chip, and below the named delivery an
amber box saying the invoice charges more than the delivery brought. **It names no
quantity** — one invoice can be short on two ordered items with different units,
so a single figure there would be a sum of unlike things.

> Any quantity from 1 to 9 produces this. Quantity is not part of the pairing
> test, which is exactly what lets the marker exist: matching on quantity would
> drop such an invoice out of consideration and no marker would ever appear.
>
> This is the same rule that produced `Delivered` twice in Act II. Nothing about
> the pairing changed — only the figures did.

### 2. `/deliveries/HYE-DL-260819-03/edit` — live, by hand

Attach `HYE-INV-260819-06` from the dropdown.

That invoice charges `Reducing Tee 3x2"`, which this delivery never brought — the
computed rule refuses it outright. The **hand-attach path does not**: it checks
that the invoice exists, that you may see it, that the vendor matches, and that
no other delivery has it. No containment check.

This is the premise the whole pairing feature rests on: a pairing is a fact
somebody knows and the app was guessing at. Point at the invoice detail
afterwards, which now shows a disagreement a person created.

While here, note the section's standing sentence — *one invoice belongs to one
delivery, so one already attached elsewhere is listed but cannot be picked* —
and that the three forms on this page submit separately.

### 3. `/invoices/HYE-INV-260821-01` — the exception list, and only exceptions

The chip reads `Mismatch`. One entry under the delivery: `Hex Nut M20` — *50 EA
more invoiced than the matched delivery delivered*, in **amber**. This is the
only PRE-MADE shortfall on the base; step 1 of this act makes one live, which is
a different thing from having one to open.

**Two steps stood here and #278 removed both**, with the seeded rows they read.
Step 3 was `grey against amber` — this same entry beside a second one reading
*Not compared — no ordered item* in grey — and step 4 was
`/invoices/HYE-INV-260819-12`, an invoice every charge of which was free text and
whose order list therefore read `None linked.` Neither is a state this app can
produce. The shortfall was seeded on the same invoice as the grey entry and came
back on its own as `SHORTFALL`, which is why the id above is newer than its
neighbours.

### 4. `/invoices/HYE-INV-260819-10` — one invoice, two orders

A short indented list under each order's row, naming what that order was invoiced
for and in what quantity. Quantities only, never prices. There is deliberately no
order column in the items table: a folded row can span two orders, so that cell
would have no single value.

### 5. `/deliveries/HYE-DL-260819-05` — raise the request, live

The banner names the excess and the order. `(2 over)` sits on the quantity —
**only the excess is coloured, never the total**.

The overage block names the invoice, the unit price, and the file the
quotation will come from. Press `Raise the request`.

It writes a real **Draft** purchase request, using the vendor's own invoice as
its quotation. Then, live:

1. `/prs/new` — resume the draft, submit it
2. approve it through the chain
3. the order generates, and **the apply step re-points the delivery row onto the
   new order and splits the invoice item**
4. amber banners now sit at the top of both orders and both requests

> Those banners are derived, not stored — withdrawing the request reopens the
> situation by itself. They stay after signature because an overage request read
> on its own looks like a duplicate with no quotation.

### 6. `/deliveries/HYE-DL-260819-09` — the app labelling its guess

Eligible, with one extra sentence: *Inferred: no invoice names this delivery, so
an invoice that names no delivery at all is treated as carrying the excess.* A guess,
labelled as one.

### 7. `/deliveries/HYE-DL-260819-12` — an excess the app could not place

*2 EA delivered beyond what was ordered, and could not be attributed to one
order.* The banner is the point and it stays; the table's order cell is empty
rather than reading `not against any order`, because #278 stopped naming that
state on screen. The row still groups under its own item, which is the half of
#165's posture the app keeps.

---

## Act V — At a glance

**Pre-made.**

### 1. `/pos`

Two chips per row, one palette, sharing three words plus a dash. All four values
of each are on the list:

| Order | Delivery | Invoice |
|---|---|---|
| `HYE-PO-20260819-01` | | `Invoiced` |
| `HYE-PO-20260819-02` | | `Partly invoiced` |
| `HYE-PO-20260819-03` | | `Awaiting invoice` |
| `HYE-PO-20260819-04` | `—` | `—` (withdrawn, row dimmed) |
| `HYE-PO-20260819-16` | `Partly delivered` | |

### 2. `/pos/HYE-PO-20260819-17`

The same two chips at document scope. `12 (over)` in **both** the Delivered and
Invoiced columns — the two are treated identically, because both subtract against
the same `Qty` and a negative means the same thing in either.

Each chip folds the **table above it**, not the list below it: it counts ordered
items, and knows nothing about how many documents brought them.

### 3. `/materials` — search `copper`

Three vendors, one material. `Lowest` on the cheapest — and directly underneath,
the note that undercuts it: *these prices were quoted at different quantities, so
the unit prices are not directly comparable.* The caveat is what makes `Lowest`
honest, and it appears only when the quantities actually differ.

Two rows carry `PO withdrawn` and `PO unsigned`. The price is not hidden — it is
qualified.

This screen exists because the decision it serves happens **before a purchase
request exists**, so no form inside one could help with it.

### 4. `/materials/{Copper Tube}`

The same data one level deeper: every time this item was ordered, read from the
orders themselves rather than from the price cache the list reads. A signed order
gets no tag at all, so the tag's presence is the signal.

---

## Act VI — Who sees what

**Pre-made, second browser profile.** Mint the session now — it lasts 15 minutes.

```bash
node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/demo/mint_session.mjs scoped-fixture@hanyangengusa.com
```

### 1. `/invoices` — as `scoped-fixture@`

The `Status` column **is not there**. Not disabled, not blank — the table is one
column narrower and nothing marks where it was. No `New invoice` control either,
because invoicing is office work.

Put the two windows side by side. A table's column count is not a constant.

### 2. `/invoices/HYE-INV-260819-08`

No `Payment` section, heading included — a heading with nothing under it would
tell an employee that a payment fact exists here and refuse to say it. No `Edit`,
no delete.

**But the amber prompt is still there.** An employee who cannot see whether the
vendor was paid is exactly the reader who is here to catch a wrong charge.

### 3. `/pos` — the other voice

The strip says **Ask the office to generate it**, and there is no `Generate PO`
button. Same state, same sentence, different half — the voice travels with the
reader.

### 4. Now as `authz-fixture@` — assigned to nothing

| URL | What it says |
|---|---|
| `/prs` | `No purchase requests to show.` — and the **job picker is absent**, not empty |
| `/pos` | `No purchase orders to show. You see a purchase order when you can see the request behind it.` |
| `/invoices` | `No invoices to show. You see an invoice when it charges a purchase order you raised or one on a job you are assigned to.` |
| `/deliveries` | `You are not assigned to any job yet, so there are no deliveries to show. An Admin can add you to a job in Airtable.` |

**All three strips are silent.** This is where the rule from Act III pays off.

The last sentence is the app's only screen that tells a reader how to get access,
and it names Airtable because there is no user-administration screen — a `Users`
record appears as a side effect of a first sign-in and in no other way.

---

## Appendix A — The empty-base sentences

Three empty states say *nothing exists at all*, and the demo base is full, so they
are only visible between a wipe and a seed. Captured 2026-08-19; reproduce in
about four minutes if you want screenshots.

**Step 1 — straight after `wipe_base.mjs --confirm`**, signed in as `soo@`:

| URL | Sentence |
|---|---|
| `/pos` | `No purchase orders yet. One is generated automatically when a purchase request is fully approved.` |
| `/invoices` | `No invoices yet.` |

**Step 2 — run `seed_demo_fixtures.mjs` alone**, then:

| URL | Sentence |
|---|---|
| `/deliveries` | `No deliveries recorded yet. Record one as material is delivered — the packing list photo is what makes it a record.` |

> **Why the third needs its own step.** `/deliveries` picks its empty sentence
> from the jobs the reader can reach. With **zero** jobs on the base that list is
> empty for everyone including the President — the Admin short-circuit lives
> inside a per-job predicate, and there is no job for it to run on — so a fully
> empty base shows the *not assigned to any job* sentence instead. The teaching
> sentence needs one job to exist and no delivery to.

That third sentence is the only copy in the app doing teaching rather than
reporting: it states the one rule of the feature at the moment a reader has
nothing else to look at.

**Step 3** — run `seed_full_demo.mjs`.

---

## Appendix B — What is not shown, and why

Three kinds, all verified rather than assumed.

**Unreachable by construction (3).** No data produces these.

- `PO: {status}` on the material history screen. `Status` is a three-value select
  and `materialPriceView.js` handles the other two by name, so the fallback has
  no input.
- `PAIRING_REFUSED.priceUnknown`. Both callers build the price map from the very
  ordered items they then test against, so an ordered item always resolves.
- `No size or unit recorded` on `/materials`. It needs a material with **neither**
  size nor unit, and `materialsCache.js` skips a unit-less ordered item outright
  (#18) — *"a unit price without a unit cannot be compared to anything"* — so the
  item axis never gets one. A material with no **size** is reachable and is
  seeded (`Site Consumables`); the subtitle then renders the unit alone.

**Injected-failure copy (5).** `Upload failed: {error}` on all three upload forms,
`Search failed — try again.`, and the delivery form's save error. Reachable only
by cutting the network mid-request. Shows as a bug to an audience; skip unless
asked.

**Forged-submit refusals (2).** The two identical `That invoice no longer exists.`
sentences, for not-found and out-of-scope. The picker cannot offer either, so
reaching them needs a hand-built POST. That the two are indistinguishable is the
point — telling them apart would confirm a record exists outside someone's scope.

### Four states that needed the seed fixed

Recorded because each was a seed defect rather than a limit of the app, and the
distinction is the one worth keeping:

1. "Spans two invoices" came out **eligible**. The rule needs two candidates that
   both name the delivery **and** a first candidate smaller than the excess.
2. No order showed both variance kinds, which is the one thing `/pos/[poId]` can
   do that no other screen can.
3. The `+N` fold had no producer — every delivery brought one material.
4. The detection PDF for two orders yielded one. A hand-rolled PDF's content
   stream was a byte short; rebuilt on `pdf-lib`.

**Two more stood at the head of this list and #278 removed them**, because the
states they were about are not states this app has: `Not compared — no ordered
item` rendering nothing, and `None linked.` being unreachable from the same
invoice. Both were about a charge with no ordered item behind it, and the work of
getting the seed to show them is what made it worth asking whether it should.
