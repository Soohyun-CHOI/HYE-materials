# Deliveries and invoices — the reasoning

Governs `app/deliveries/**`, `app/invoices/**`, `lib/delivery*.js`, `lib/overage*.js`, `lib/invoice*.js`. **Read this before editing there** — CLAUDE.md carries only the rules that bind code outside this area; the derivation, the evidence and the alternatives weighed are here.

Moved verbatim out of CLAUDE.md — nothing in this file was rewritten. The migration was audited line by line and the result is in the pull request that created this file.

## The one-delivery premise

**The material one invoice charges arrives on the one delivery that invoice matches,
or it has not delivered. It is never split across several deliveries.** A delivery can
carry several invoices; an invoice is answered by one delivery or by none.

**This is the oldest live assumption in this area and it is stated here because it
was not stated anywhere a screen could find it.** #166 wrote it as
`CONTAINMENT_PREMISE`, a string constant beside the inference it justified; #210
deleted the constant and put the premise into the DATA, as the shape of
`Invoices."Delivery"` — single on the invoice side, plural on the delivery's; #231
made it enforceable on write, as `fitRefusal`'s `notContained`. Each of those is
recorded in its own issue's section below, beside the one conclusion it was drawn
for. **None of them is a place a person writing screen copy would look**, which is
exactly what went wrong: #210 reasoned from this premise to two chip values and
wrote the reasoning into `STATUS_COPY.column.invoice`'s own comment, and the verdict
sentences three screens down went on saying `Nothing delivered yet` until #232 —
four issues later — because nothing connected the two. This repository has had that
failure twice before, with `line` and with `arrived`: a rule settled in one module's
header, unreferenced everywhere else, and then diverging. So the premise lives here,
above the issues, and `lib/deliveryStatus.js`'s header points at it by name.

**It is a statement about how this office and its vendors work, not a measured
fact.** A vendor does not charge half a delivery. Nothing about it is provable from the
data, which is why #166 could only assert it in prose. What changed is where it is
held: the field's shape holds it, the pairing rule refuses to write anything that
breaks it, and a `Deliveries` row can still be linked by hand in Airtable to an
invoice it does not contain — so reading code must survive a violation even though
writing code cannot produce one.

**What follows from it, and every one of these is somewhere below:**

- **The invoice axis has no middle STAGE, and #232's third value is not one.** There
  is no `Partly delivered`, because partial can only mean the vendor shipped less than
  it invoiced, and nothing further is coming — so it is a discrepancy rather than
  progress. #210 removed the stage; the PO axis keeps it, an order really being filled
  item by item over time. What that argument bars is a stage WORD. `Mismatch` is an
  error word and is barred by nothing, so the set is `Delivered` / `Mismatch` /
  `Awaiting delivery` — the link's two states and the one way the link can be set and
  still be wrong. **The distinction to hold on to is stage against error**, not two
  values against three.
- **A shortfall was a MARKER for two issues and is a chip value now (#232).** #166's
  shape put it beside the chip, on the ground that a discrepancy composes with any
  value and would double a closed set. Neither half held: it composed with exactly one
  value, since a mismatch needs a delivery matched, and its sentence lived in a
  tooltip that reaches neither touch nor a keyboard — so the word a reader most needed
  was behind a hover while `Delivered` was in plain sight. The marker is retired on
  both invoice screens; #167's overage affordance still uses `QualifierMarker`, for a
  guess, which is what a qualifier is for.
- **A shortfall does not resolve itself, so its copy says no `yet`.** Nothing further
  is coming: what the invoice charges either delivered against the delivery it matches or was
  never shipped. The one place `yet` is honest on these screens is an invoice matched
  to nothing, where the material may still arrive or the delivery may still be
  recorded.
- **"Everything invoiced was delivered" is a fact about the INVOICE, not about each of
  its items.** The chip states it once. A per-item box repeating it states one fact
  as many times as the invoice has items, which is why a box that agrees says nothing
  at all (#232).
- **`fitRefusal` refuses a pair the premise would break**, so a computed pairing
  always contains everything the invoice charges. `nothing-delivered` is therefore
  unreachable through the app's own writes and reachable through hand-entered data —
  `HYE-INV-260804-03` was that row when this was written, kept deliberately as the
  only way to see the branch on a screen.
- **ONE INVOICE CHARGES ORDERS ON ONE JOB, AND THAT IS THIS PREMISE RATHER THAN A
  SECOND ONE (#314).** A `Deliveries` row holds a single `Job`, and an invoice is
  answered by one delivery or by none — so an invoice spanning two jobs is an invoice
  split across two deliveries, which is the case above. That corollary is what lets
  `/invoices` head a column `Job` and assert one.
  - **NOTHING ON THE WRITE SIDE ENFORCES IT, AND THAT WAS CHECKED RATHER THAN
    ASSUMED.** `createInvoiceAction` gathers the distinct orders an invoice charges and
    tests one thing about them, that none is withdrawn; `lib/poPickerOptions.js`
    narrows the dropdown by VENDOR and carries no job clause; `/api/pos/search` and
    detect-po the same. One vendor supplying two sites is ordinary, so the state is
    reachable — by the form, not merely by a hand edit, which is the one place this
    corollary is weaker than the premise it comes from. **Making the app refuse it is
    out of #314's scope** and is not filed as work; what that issue owed was a column
    that cannot lie while it stands.
  - **SO THE JUDGMENT NAMES NO JOB WHERE IT FINDS TWO.** `lib/invoiceJob.js` counts the
    distinct jobs its walk resolves and returns one or nothing; the cell renders the em
    dash it already renders for a row with no job, which `invoices.md` distinguishes
    from a measurement as "the absence of one". Two ORDERS on one job is not that case
    and is the ordinary reason an invoice carries two — a correction that split every
    item across an order and its overage order — which is why the test is the job count
    and never the order count. The direction is `getVisibleInvoiceIds`': refuse rather
    than guess.
  - **AND IT IS THE ARGUMENT FOR REFUSING THE STATE, WHENEVER SOMEBODY WANTS ONE.** The
    column is honest either way, so the reason to enforce it is not the column: it is
    that a multi-job invoice is also an invoice the pairing rule can answer for at most
    half of, which is the entry below.

- **IF THE PREMISE BREAKS IN REALITY, THE INVOICE AXIS HAS NO EXIT.** A vendor invoicing
  one invoice and shipping the material in two deliveries is not a shape this app can
  record its way out of: both deliveries can be entered normally, and each will contain
  part of what the invoice charges, but `Invoices."Delivery"` is a SINGLE link, so the
  invoice can name only one of them and its chip reads `Mismatch` forever. Nothing is
  wrong with the data and no correction path exists — the shortfall is real against the
  delivery named and imaginary against the delivery. **Deliberately not fixed**, there
  being no such case on this base and no report of one from the office; the note is here
  because the cost of fixing it is easy to underestimate. Making the link plural reopens
  what #210 settled (the shape that HOLDS the premise), what #231 built on it
  (`fitRefusal`'s `notContained`, which is containment against one delivery), and what
  #232 drew from it (one delivery named once per invoice, a per-item comparison with one
  second term). It is a premise change, not a field change.

### Recording deliveries (#162)

`/deliveries` (list), `/deliveries/new` (entry), `/deliveries/[deliveryId]` (one delivery, with in-place edit and delete). Site staff record what was delivered; **the app decides which order it belongs to** and there is no allocation-editing UI, so the only correction is to delete and re-enter.

- **The entry form is ONE page: a header that narrows, then a repeating list of items**, the same shape as the invoice form — not a job list you navigate through first, and not one item per delivery. A packing list normally names several items from one vendor on one day, so the ITEM ROWS repeat while the header (job, vendor, optional PO number, date, photo) does not, because those are properties of the delivery rather than of a delivery item. Job → vendor → items, each narrowing the next. The single page is possible only because `getDeliveryCandidates` batches across jobs: the page hands the form every accessible job's ordered items in one read and the form filters client-side. Per-job fetching would have been ~6 queries each, over 200 for an Admin on 36 jobs, which is what forced the first version to navigate. Jobs offered are the viewer's `Assigned Jobs`, or all of them for President/Admin, narrowed through `accessibleJobs` so the dropdown cannot offer one `createDeliveryAction` would refuse. A single accessible job is preselected. Changing the job or the vendor resets the item rows, since each was narrowed by the old one.
- **An item already on one entry row is not offered on another** (`availableItemOptions`), the same rule as the invoice form's per-item PO Item dropdown (#91) and for the same reason: an item already on the delivery is not a second thing to add. The row's OWN selection is always kept, or the `<select>` would hold a value matching no option, render blank, and silently drop what was picked. `+ Add item` disables once every option is claimed rather than adding a row that cannot be filled. The rule is a pure function rather than inline JSX so the offline tier can pin it — what a control may offer is still a rule.
- **Two rows of ONE material would be summed, not planned twice**, and that path stays even though the dropdowns now prevent it. Allocation runs against a single snapshot of the candidate ordered items, so planning one material twice would let both plans claim the same undelivered quantity and double-allocate. The form is an affordance, not a guarantee — a Server Action is callable regardless of what the page rendered — so the action groups by material before planning. Different materials never compete for the same ordered item, so they are planned independently.
- **Reading a delivery back collapses its rows to items, and that rule is one function** (`groupRowsByItem`), because the rows are two things at once — several items, and several order-slices per item. Keyed on `materialRecordId` when present and on the frozen name/size/unit otherwise, so a row with no `PO Item` still groups with its own item — a state #165 stopped producing but that the reading side still has to survive. In first-appearance order, which is `Delivery Item ID` order, which is the order the recorder listed them. An item is flagged when ANY of its slices is: the question a reader asks is "was more of this delivered than we ordered", not "which slice carried the excess".
- **The list summarizes as first item + a count** (`summarizeDelivery`): `Rebar D13 200 EA` then `+2` as its own chip, never appended to the label — read as text after the name, `+2` looks like a size or a grade on the item itself. It is a count rather than more names because a list row has one line and the useful thing there is "there is more here than you can see"; the detail page is where the rest belongs. The `Over-delivered` tag appears on the list too, from the same summary, so a reader does not have to open a delivery to find out. The detail page's headline uses the same function, so the row clicked and the page landed on cannot describe one delivery differently.
- **`ALLOCATION_COPY` was SWEPT BY #166 for one word per fact, and another issue reaching into this module is the point rather than an accident.** That issue put the same facts on the invoice screens; leaving them would have meant one fact called `arrived` here and `delivered` there, on a base whose table is `Deliveries` and whose rollup is `Delivered Qty` — a second name makes a reader ask what the difference is, and there is none. So: `arrived` → `delivered` throughout the banner and preview voices, and the list tag `over-delivery` → `Over-delivered`. `offline/delivery-status.mjs` fails on `arriv`, `recorded as` or the word `line` appearing in any #166 message, which is what keeps the vocabulary from drifting back.
- **#166 stopped at the repo boundary and #181 crossed it, which retires the carve-out this entry used to record.** #166 left the Airtable field named `Over Delivery` on the grounds that renaming it "breaks a lookup rather than fixing a word", by analogy with the US-English rule's exemption for values belonging outside this repo. That analogy was wrong and #167 measured why: a field's NAME is a rendering and its id is the storage, so a rename carries every formula, rollup, lookup and view filter with it and the only thing that can break is a string literal here — which is enumerable. The field is `Over Delivered` now. The US-English carve-out itself still stands, because it is about a value whose spelling another system owns (a select option, a package name), not about a field name we chose.
- **#181 also retired `outstanding` from this module.** It was one of two words for the invoice subtraction on `Materials` and this module was using it for the delivery one, so the same fact-per-word argument applied a second time: `undelivered` here, `uninvoiced` there. The copy builder `overNothingOutstanding` became `overFullyDelivered` (key `over-fully-delivered`) in the same pass, since its own message says "already delivered" and that is the better name for the branch anyway.
- **The banner names the item only when a delivery holds more than one.** With a single item the name is already the headline and repeating it is noise; with several, "3 EA delivered beyond what was ordered" does not say beyond what. One message per over-delivered ITEM rather than per flagged row, and it claims an order only when every flagged slice of that item names the same one.

- **THE ALLOCATION RULE, in `lib/deliveryAllocation.js:planDelivery`.** Candidates are that Job's ordered items for that vendor and that material, `countsAsOrdered`, with undelivered quantity left, narrowed to a supplied PO if the packing list named one. Filled **oldest order first** — PO `Created Date` asc, tie-broken by `PO ID` then `PO Item ID`, the same chain and the same reason as `sortHistoryRows` (Created Date is calendar-only). An undated ordered item sorts LAST, since a data gap must not take priority in a FIFO queue.
- **Matched on #18's `Material` link, never on `Item Name` text.** The vendor wrote the packing list and we wrote the PO, so the strings do not agree — which is why the item comes from a dropdown rather than a text box, and why an ordered item with no `Material` link is invisible to this feature. Pre-#18 ordered items were never backfilled, so that is the honest cause of the form's "item is not in the dropdown" message.
- **Signature status does not filter candidates**; withdrawal does. Site sometimes orders first and the PR/PO follow as a record, so an Awaiting Signature ordered item must still receive its delivery. A withdrawn PO's ordered item is excluded by reading #18's `Committed Qty` — the which-POs-count rule stays in that one named field, never re-derived from a status string, exactly as #19 reads it.
- **The dropdown is deliberately WIDER than the candidate set**: it lists every material the vendor supplied to this Job, including ones already fully delivered, showing `fully delivered` (`none outstanding` before #181). Narrowing to undelivered-only would make such an item VANISH, and the recorder would then land on the "not in the dropdown" message — which says it may never have been ordered here. That would be false, so the screen shows the item and says the true thing instead, then flags the entry as over-delivery.
- **Over-delivery is flagged, never refused**, and becomes its own row. **That row always NAMES an ordered item (#165)**, and it attaches to the END OF THE FILL ORDER: the last ordered item the delivery filled, or — when it filled nothing, because every order for the material is already complete — the last ordered item in the same ordering, i.e. the most recent PO's.
  - **#162 left it unattached whenever the narrowed set held more than one ordered item**, reasoning that no single order had been over-delivered and that a guess written into `Delivered Qty` would have #20 report it as fact. The cost of not attaching turned out to be the larger error: an unlinked row is in no ordered item's `Delivered Qty`, so it is **invisible on the invoice axis**, and a delivery delivered in full reads as less delivered than was invoiced — which points at withholding payment. Attaching is imprecise about *which* order absorbed the surplus; not attaching was wrong about *whether* the material was delivered.
  - **The tail comes from `sortCandidates`, not a second comparator.** Both branches are positions in the one order allocation already fills in, so "most recent" is `sortCandidates(...).at(-1)` — one comparator, and the two branches read as one sentence. Consequence worth naming: that function sorts an **undated** ordered item last so a data gap cannot take FIFO priority, so the tail picks such an ordered item as "most recent". Coherent under the same reading — last to be filled, last to be blamed — and unreachable while every PO carries a `Created Date`, which docs/notes/backlog.md records with the date it was measured.
  - **No longer depends on a PO holding at most one ordered item per material.** `sortCandidates` is a total order, so both branches are defined whether a PO carries one ordered item of a material or five — which is why #162's `narrowed.length === 1` test is *gone* rather than widened, and why this does not wait on #170. The sub-case #162 could only record at PO level (PO unambiguous, ordered item ambiguous) now resolves to an ordered item by fill order, so `Deliveries.PO` no longer carries that fact alone — it stays as the packing list's own reference, which is all it ever claimed to be.
  - **A supplied PO ID still hard-restricts**, unchanged: both branches draw only from the narrowed set, which is already filtered to that PO, so excess never spills onto another order.
  - **The invariant: a plan is either BLOCKED or every row it produces names an ordered item.** There is exactly one way to have nothing to attach to — an empty narrowed set — and #162 wrote a row with no link and blank frozen name/size/unit for it. It is now refused with the reason (`lib/deliveryAllocation.js:BLOCKED`).
  - **Where `blocked` is reachable, because the first answer to this was wrong.** **Not from the entry form.** With a PO in use the form builds its item options from *that PO's own ordered items*, and both the PO checkbox and the PO input reset the item rows — so a recorder cannot hold a selection the typed PO does not carry, not even transiently. With no PO the options come from ordered items already filtered by vendor and `countsAsOrdered`, so every offered material has a candidate. The form refuses these combinations by never offering them, which is why it has **no blocked branch of its own**: an unreachable red message would imply a state the form can produce. It is reachable at **submit**, which is where the refusal lives: `createDeliveryAction` re-runs allocation from a fresh read, and a PO can be withdrawn while the form sits open, so `countsAsOrdered` drops its ordered items under a selection that was valid when it was made. A direct call on the Server Action is the other way in. The copy therefore belongs to the action, not to the preview, and `ALLOCATION_COPY.preview.blocked` says so.
- **A supplied PO ID is a hard restriction, not a preference.** Excess never spills onto another order, because the packing list names this one; the screen says so rather than leaving the recorder to wonder why a later order was not used.
- **Allocation is greedy at entry time and never re-runs.** So entering a backdated delivery after a newer one allocates it against whatever is still open — **order of entry decides, not order of delivery.** Accepted rather than solved: re-allocation would mean mutating existing rows, which the no-editing decision rules out. `withKeyLock` on `job::vendor::material` serializes in-process; the cross-invocation residual is the same class as #138's, and its failure mode is an over-delivery flag, which is a state the system already models. **#206 gave that sentence one exception, and the paragraph had not seen it:** it reasons about BACKDATED ENTRY, where the plan is imprecise about which order carries a surplus but no stored flag is false. DELETION is the other half of the same delete-and-re-enter it recommends, and there a flag does become false — so the delete path now mutates existing rows. The exception is narrow: it redraws the within/over boundary inside ONE ordered item and never revisits which ordered item a delivery attached to, so the FIFO attribution this paragraph is about is still computed once and never revised.
- **The photo has TWO writers, and that is the one deliberate departure from #142's one-writer rule** — the photo is editable in place, unlike a Quotation's file. `createDelivery` writes it at creation; `replaceDeliveryPhoto` is the narrow second writer, in `setPOItemMaterial`'s shape, and **refuses any url that is not a fresh Vercel Blob upload** (`isOurBlobUrl`). That precondition is what makes #142's failure mode — re-submitting an url Airtable issued, which succeeds and silently empties the field — unreachable by construction rather than by discipline. `updateDelivery` has no `file` parameter and must not grow one. Enforced by `offline/source-shape.mjs`: exactly two writes, one in each function, `isOurBlobUrl` called in the replacer, none in `updateDelivery`.
- **Deletion is a real delete with no tombstone, following invoices rather than PRs and POs.** A withdrawn PR or PO keeps history worth preserving; a wrong delivery is a mistake with no history in it. Author plus Admin. `PO Items."Delivered Qty"` simply recomputes; **nothing on any Invoice record is touched**, so what was invoiced and whether it was paid are unchanged. The photo goes with the record and there is no second copy — #140 deleted the Blob object after ingest — which is why all three voices of `DELETE_COPY` say so. The three voices branch on whether the affected ordered items are invoiced and whether their invoice is paid, escalating lazily so an ordinary delivery pays only for the cheap question.
- **Authorization is per-record on two axes.** Job membership (or the office) for viewing, entry and in-place edits, via `lib/deliveryAccess.js`; authorship-or-Admin for deletion, inside `lib/deliveryDelete.js`. President/Admin are admitted to entry deliberately, one step beyond the issue's "anyone assigned to the Job": every other row-level rule admits them, and Admin can already delete. No role wrapper fits either axis, so all four Server Actions are `requireUser()` exemptions in the endpoint inventory, with the two axes named separately.
- **No per-row identifier gate, unlike #19's screens**, because the page gate subsumes it: allocation only picks ordered items from POs on this delivery's Job, and `canViewPR` clause 4 admits anyone assigned to a PR's Job. A second gate would re-derive the same answer and could drift from it.
- **Not in this issue:** nothing is written to any Invoice record and there is no `Invoices.Delivery` link (**#210 added that link and one write to it** — see "The invoice-to-delivery pairing" below; the rest of this clause stands); the discrepancy screen is #20; material never ordered on the Job, and consumption, are out of scope. `Materials.Uninvoiced Qty` (`Outstanding Qty` when #162 was written) is deliberately unchanged AS ARITHMETIC — its own description says packing lists will be the real delivery signal and that it is the one place to change, but what a delivery-based figure should mean is a reporting decision belonging to #20 with the screen that shows it. #181 renamed the field to the subtraction it performs, which does not settle that: it frees the word `outstanding` for #20 rather than spending it.

### Delivery status (#166)

Whether what a vendor invoiced for was delivered, and what was delivered with no invoice behind it. **No new screen** — each fact goes where its own record lives, because a delivery with no invoice has no invoice row to sit on: the invoice list gains a column, the invoice detail a section, the deliveries list a column and two filters. `lib/deliveryStatus.js` judges; `lib/deliveryReconciliation.js` fetches.

- **ONE WORD PER FACT, and the sweep reached #162's module to keep it that way.** `delivered`, never `arrived` — the table is `Deliveries` and the rollup is `Delivered Qty`, so a second name for one fact only makes a reader ask what the difference is. `ordered item`, never `line` — a `Line` on this base is a child of a Job. And nothing is `recorded as` anything, since this app does not write `Recorded as paid` either. `ALLOCATION_COPY` was swept in the same pass (see "Recording deliveries" above); the Airtable field then still called `Over Delivery` was not, on the ground that it was outside this repo — **#181 crossed that boundary and it is `Over Delivered` now**, because #167 had measured that a field rename carries every formula, rollup, lookup and view filter with it and breaks nothing but a string literal here. `offline/delivery-status.mjs` fails on `arriv`, `recorded as` or the word `line` in any message here, so the vocabulary cannot drift back.
- **The join was computed, never stored — and #210 STORED IT.** #166's reasoning: there is no `Invoices.Delivery` link and deliberately none, whether to add one being left until this screen had been used. The one path that existed was `Invoice Items` → `PO Item` ← `Delivery Items`, so the ordered item was where the judgment was made, being the only thing both axes touch. The ordered item is still where QUANTITIES are compared, for the same reason; what changed is that which delivery answers which invoice is read rather than estimated. Every clause below that rests on the estimate is annotated where it stands, and the derivation is in "The invoice-to-delivery pairing" at the foot.
- **Two independent comparisons, not a list of cases:** delivered against invoiced, then each side against ordered. Every combination falls out of those two, including ones nobody enumerated, which is why the module returns figures plus a key rather than a hand-written case per screen.
- **Comparison 1 uses TOTAL delivered**, within-order plus beyond. "Did the invoiced material arrive" asks about delivery, not about whether the order covered it: 12 delivered against an order of 10 answers an invoice for 12 in full, and using the within-order figure alone would report 2 as undelivered while it stands in the warehouse.
- **Comparison 2 is realized as two NAMED facts**, not as `max(delivered, invoiced) > ordered`. That form is true of both cases and distinguishes neither, and #162's `Over Delivered` flag already gives the delivery side exactly.

- **A LIST CELL IS A CHIP, NOT A SENTENCE, and that is what the density axis actually means.** `column` is a closed set of values a reader learns once and then recognizes — the way an Airtable single select reads — while `detail` is sentences with figures. The first version had short sentences and fractions in the column, which breaks the metaphor twice: a fraction changes per row so the set stops being closed, and saying WHAT it counts costs words a one-line cell does not have (`1 of 2 lines arrived` had to name a unit it could not use). So the count decides which chip it is and stays behind; the figures live on the detail. `offline/delivery-status.mjs` asserts that **no chip contains a digit**.
  - Invoice axis: `Delivered` / `Partly delivered` / `Awaiting delivery`, and `—` when every invoice item is free text. **#210 left TWO of those four** — the chip comes from the stored pairing now, so `Partly delivered` went with the inference that produced it and the dash became unreachable.
  - Delivery axis: `Invoiced` / `Partly invoiced` / `Awaiting invoice`, and `—` likewise. Unchanged: a delivery really can be part-invoiced, because it may carry material nobody has invoiced yet.
  - `Partly`, not `Partially`, on both. The two sets share one tone vocabulary (complete / partial / none) in `app/components/DeliveryStatusMarks.js`, so a reader crossing between the lists recognizes the shape. **`—` is deliberately not a chip:** "we did not measure" is the absence of a value, not a fourth one.
- **THE INFERRED QUALIFIER IS A MARKER, NOT A CHIP** — a small `!` in a circle beside the chip. It is not another value of the closed set: it composes with any of the three and as a chip it would double them. **`title` alone would be the whole affordance on a mouse and nothing anywhere else**, since a tooltip opens on neither touch nor a keyboard, so the same sentence is also the `aria-label` and therefore the accessible name. The full explanation is an ordinary line of text on the invoice detail, which is the reading nobody has to discover. One sentence, two punctuations (`Inferred: …` for the marker, `Inferred — …` for the line), asserted equal offline so the two cannot come to give different reasons.
  - **THE SHAPE OUTLIVED THE QUALIFIER IT WAS BUILT FOR (#210).** The inferred marker is gone from these screens with the estimate; a MISMATCH marker took its place on the invoice axis, and the argument for it being a marker rather than a chip is #166's, inherited rather than re-derived. What did not carry over is the two punctuations: the detail already states the shortfall with its figures through the verdict, so there is one sentence and no twin to hold in step. #167's own `!` still means `inferred`, which is why the component is named for its shape now (`QualifierMarker`) rather than for one of its two meanings.
- **Facts, never verdicts.** At any one moment "the vendor over-billed" and "the rest has not been delivered yet" are the SAME measurement, so the copy says `more invoiced than delivered` and the reverse direction gets the same treatment. `offline/delivery-status.mjs` asserts that no message anywhere contains "over-billed", "short-shipped" or "missing". Deciding which it is belongs to a person; correcting it is #167.
- **THE ANSWER IS ATTRIBUTED TO ONE INVOICE, and the load-bearing rule WAS where computation ends and inference begins** (`allocateLineToInvoices`). Refusing to attribute leaves the invoice axis unable to answer "may this be paid", which is the question it exists for — the same call #165 made one level down when it stopped declining to attach an over-delivery row. **#210 KEPT THE ATTRIBUTION AND DELETED THE BOUNDARY**: the answer is still attributed to one invoice, and it is now read off `Invoices."Delivery"` instead of estimated, so the whole function and its `determinate` flag are gone. The four sub-clauses below are #166's record of a rule that no longer exists; they are kept because the pairing was justified by measuring exactly where they went wrong.
  - **Most of the time nothing is inferred.** Three shapes are order-independent and are computed outright: ONE invoice on the ordered item (its delivered-against-invoiced *is* that invoice's answer — the common case), the delivery covering EVERY invoice (all satisfied whatever the order), and NOTHING delivered (none satisfied).
  - **Inference is needed in exactly one shape:** two or more invoices on the ordered item AND a delivered quantity covering some but not all of them. Then it is filled **oldest invoice first** — `Issue Date` ascending, tie-broken by `Invoice ID` — because that is the order the invoices were raised in. `Issue Date` is human-entered and backdatable, the property #164 learned the hard way; tolerable here because the consequence is a coin-flip landing the other way on a cell already marked, not a corrupted record. An undated invoice sorts LAST, the same call `sortCandidates` makes.
  - **THE CONTAINMENT PREMISE WAS A STATEMENT ABOUT PRACTICE, NOT A MEASURED FACT (`CONTAINMENT_PREMISE`) — AND #210 MADE IT A FIELD.** #166: one invoice is contained entirely within one delivery, a vendor does not charge for half a delivery, and **nothing in the data enforces it** — no delivery-to-invoice link, no field recording the pairing, no write path checking it. What it bought was that 80 invoiced across two invoices with 40 delivered satisfies ONE of them completely rather than half of each, which made "this one has not been delivered" a one-in-two chance of naming the right invoice rather than a middle value in the data nowhere. If it broke, the inference did not degrade into "roughly right": it became wrong in a different way, handing a whole invoice a coverage that belonged to part of two. **The premise is now the SHAPE of `Invoices."Delivery"`** — single on the invoice side, plural on the delivery's — so it is stated where the data can hold it, checked on write, and the constant is gone rather than kept as a comment in a string.
  - One uncertain invoice item makes the invoice's answer uncertain — it does not average out across invoice items. **The shape survived its cause:** one SHORT invoice item now makes the whole invoice carry the mismatch marker, for the same reason — the reader has to open the invoice either way.
- **THE INVOICE'S VERDICT HAS FOUR OUTCOMES, AND TWO WERE DELETED RATHER THAN DOCUMENTED.** A share's delivered quantity is CLAMPED at what its own invoice invoiced, so `delivered > invoiced` cannot occur at invoice scope: `arrived-more` had no reader on the invoice path at all, and `nothing-invoiced` collapsed into "nothing delivered" for the same reason. This repo has been burned repeatedly by things with no caller — `upsertMaterial` carried three defects from Phase 0 to #18 — so an unreachable state is removed, not left standing with a comment. What `arrived-more` used to say is now said **on the order's own terms** (delivered > ordered) by the `Against the order:` line, which gives one fact one reader. The four were `All invoiced material delivered` / `N EA more invoiced than delivered` / `Nothing delivered yet` / `Not compared — no ordered item`; **#278 applied this bullet's own test to the fourth** and removed it with the invoice item it described, so the judgment has three.
- **An invoice summarizes by INVOICE ITEM COUNT, not by quantity**, and that is forced rather than chosen: its invoice items carry different Units, so adding their quantities produces a number of nothing. The count no longer reaches the screen — it decides the chip — but it is still what the chip is decided by. **#210: the count decides nothing at all now.** The chip comes from the link; the count is reported for the detail and the constraint that forced it still holds for anything that would add quantities across invoice items.
- **"No invoice item complete" and "nothing delivered" are different claims, and the chip kept them apart.** `awaiting-delivery` was reserved for no quantity having been delivered at all; an incomplete invoice item was `Partly delivered`. The first version keyed that on the completed-line count alone, so a one-line invoice invoicing 13 with 10 delivered read as nothing delivered. **Caught by reading seeded demo data rather than by a check**, which is why the seed exists and why `summarizeInvoiceStatus` carried `anyArrived`. **#210 dissolved the distinction rather than fixing it again:** both claims were about how much of an invoice had been delivered, and neither is what the chip answers now — `awaiting-delivery` means no delivery is NAMED, and every quantity question is the marker's or the detail's. `anyArrived` is gone with `Partly delivered`.
- **WHAT #278 TOOK WITH IT, counted here rather than in CLAUDE.md's Data model.** #96's hidden free-text option is gone, and so are the twenty-six branches that described what it would produce. The rule that replaced it stays on the `Invoice Items` entry there, because `PO Item` being required by this app rather than by the schema is a fact anyone writing such a row needs and its two enforcers are named with it; the count of what was deleted is this file's. Moved in the routing pass after #263.
- **An invoice item with no `PO Item` was excluded from the judgment, and #278 removed the state instead.** The rule was right and its premise expired. A vendor's freight arrives on `Invoices."Shipping Fee"`, a header field, and item rows are for material only — so the app created no such row, the option being hidden behind `SHOW_OTHER_ITEM_OPTION` (#96); what kept the rule alive was that #96 left the backend path open, making the flag the whole of re-exposing it. #278 decided the option is not a feature and closed the path: the action refuses an item with no ordered item, `createInvoiceItem` throws on one, and `countsTowardStatus`, `excludedCount`, the `not-compared` verdict and the `unjudged` tone are gone with it. **The flag was not the only door**, which is the finding that made the issue bigger than it looked — see the sub-bullet below.
  - **A SECOND PATH REACHED THE SAME STATE WITH THE FLAG UNTOUCHED.** #91 keeps one ordered item to one row of one invoice, so a second row pointed at a PO whose every ordered item a sibling row had already claimed had nothing left to pick: `defaultedItem` returned it with an empty `poItemRecordId`, the select rendered zero options, and the free-text Item Name box beside it — the same box #99's comment says it removed, for a different cause it did fix — accepted a typed name that the action then saved with a null link. Removing the flag would have left that open. It is closed by a refusal in `createInvoiceAction` and by the row saying why it has nothing to offer, in that order: this repo names what a reader cannot do where they would try it (#232) rather than accepting input and rejecting it on submit.
  - **What a hand-emptied `Invoice Items."PO Item"` does now.** The reconciliation walk drops the row instead of giving it a row of its own, so the delivery section is silent about an invoice item the items table above still shows — the same silence `lib/poDocuments.js` keeps on the other axis, and the same split #165's bullet above now carries: survive it, do not describe it.
- **`invoicedQty` comes from the `Invoiced Qty` rollup — the ordered item's total across every invoice — and never from summing the invoice in hand.** An ordered item can carry two invoices; summing only one would report material as uninvoiced when it is invoiced twice over. `verify-delivery-status-166.mjs` Part D creates exactly that case: 16 invoiced on the ordered item, 6 on the invoice being read, 10 delivered.
- **The delivered side reads `Delivery Items`, not the rollup**, because `Delivered Qty` sums within-order and beyond-order into one number and only the rows carry `Over Delivered`. This is the reader that made that distinction load-bearing rather than theoretical.
- **The query budget was 5 operations on the invoice axis and 3 on the delivery axis, measured, and never grew with row count.** Two of the five existed because the answer is attributed: deciding whether THIS invoice was covered meant reading every OTHER invoice on the same ordered item and its `Issue Date`, which the caller never asked about. Refusing to attribute cost 3 and could not answer the question — `verify-delivery-status-166.mjs` Part E counts them with the same `_selectRecords` / `_findRecordById` instrument `verify-material-price-19.mjs` Part E uses, comparing one row against several (measured 5 for one invoice against 4 for three). The invoice detail was 5 too, adding the Deliveries themselves for their dates. **These are CEILINGS rather than fixed numbers:** an empty level costs no query at all, since `findByRecordIds` returns early on an empty id list. So the property to assert is "never more", not "exactly equal", and the two measurements have to be shape-matched. Recorded because the first version of the check read both asymmetries as per-row growth.
  - **#210 TOOK IT TO 3 / 3 / 3, and the two levels it removed are exactly the two attribution needed.** Measured on the live base, read-only, with the same instrument: invoice axis 3 for one paired invoice and 3 for all 15; the detail 3; delivery axis 3 for one delivery an invoice names and 3 for all 15. The ceiling property holds harder than before — an invoice naming no delivery measures **1**, and so does a delivery nothing names, because both levels below the link are then empty. **The list axis stopped reading `PO Items` altogether**: what an invoice charges against what its delivery brought needs neither, and what was ORDERED is a third document's figure that only the detail shows. The two axes now cost the SAME, which they did not before — so an assertion that the invoice axis costs more would be asserting the defect.
- **The invoicing column and the `uninvoiced` filter were President-or-Admin, WITHHELD ON THE SERVER — and #211 RELEASED THEM.** #166's reasoning: the deliveries list is Job-scoped, so site staff reach it, and whether a vendor has invoiced for a delivery is office information; gating in JSX would leave the data in the page payload, so `getDeliveryInvoicing` was **not called at all** for a non-privileged viewer. The mechanism was right and is worth keeping in mind — withholding means not fetching, the same decision as `/pos/[poId]` filtering invoice-derived fields out on the server (#132). **What did not survive is the line it drew.** #211 opened the invoice routes to any viewer who can see the order behind an invoice item, and every row on this list is a delivery on a job the viewer is assigned to, which is exactly that condition — so the column was hiding a fact readable one screen away. A rule that hides a figure on one screen and shows it on another is not a rule. `getDeliveryInvoicing` is called for every viewer now, and both filters exist for every viewer.
  - **`resolveDeliveryFilters` is GONE with it**, and the deletion is the point rather than a tidy-up. It existed so `?unbilled=1` would be treated as ABSENT for a viewer whose rows carried no invoicing key — a filter over a column that was never fetched would silently empty the list — and once every viewer gets the column there is no such viewer. What was left was `{ uninvoiced: Boolean(a), over: Boolean(b) }`: a named rule with no rule in it, and two callers that could no longer disagree because nothing was left to agree about. Removed rather than left standing with a comment, the same call `lib/deliveryStatus.js` made on `arrived-more` and `nothing-invoiced`. `offline/delivery-status.mjs` asserts the export is gone, so a re-added gate fails CI.
  - **`/deliveries` went from two column budgets to one** for the same reason, and the surviving six-column row is the one every measurement in that comment was taken against.
  - **Payment never appeared on these screens and still does not** — see "Payment is President-or-Admin" above for the line that replaced this one.

- **THE INVOICE DETAIL IS ONE BOX PER INVOICE ITEM, in the items table's own order**, with at most six lines inside it: the item, `Ordered · Invoiced · Delivered`, `This bill:`, the verdict, `Against the order:`, the inferred sentence, and the deliveries. **#210 took the inferred sentence out**, so it is five, and gave the deliveries line one more thing to say — see below. **#232 TOOK IT TO ONE, AND USUALLY TO NONE** — a box that agrees is its item name and nothing else. The deliveries moved out, `This invoice:` went, the figures line went, and the verdict and `Against the ordered item:` appear only on a box with something to report. Everything from that point in this section down is #166's and #210's record; what the box is NOW is under "Scoping the box to its invoice (#232)" below.
  - **The section heading carries the SAME CHIP the list showed, from the same function**, so the row a reader clicked and the page they land on cannot describe the invoice differently — #162's `summarizeDelivery` is shared between its list and its detail for exactly this reason.
  - **All three figures are the ORDERED ITEM's totals, including `Billed`**, which is every invoice on it rather than this one. That is what makes them comparable with each other and with the deliveries listed under them. Usually this invoice IS the only invoice on it, so `Billed` is also this invoice's figure.
  - **`This bill: 5 of 13` appeared on EXACTLY the condition the inferred marker did**, and that identity was the point rather than a coincidence: the share line explained why the answer had to be inferred, so one without the other would either raise a question it does not answer or answer one nobody asked. It was NARROWER than "the ordered item carries more than one invoice" — two invoices whose material all arrived needed no inference, so neither line appeared. Asserted as an equality in `offline/delivery-status.mjs` over every input shape. **#210 KEPT THE LINE AND CHANGED WHAT PUTS IT THERE** (`sharesOrderedItem`): with no guess to explain, what is left is the plain fact that the ordered item carries another invoice, which is exactly the condition once thought too WIDE. It is needed for a different reason — `Billed` on the figures line is the ordered item's total, so without this a reader takes it for this invoice's own — and it is now arithmetic on two figures the box already holds rather than a flag threaded down from the allocator.
  - **COLOR ON THE VERDICT LINE ONLY.** `Against the order:` is a fact about the ORDER rather than about this invoice, and the inferred sentence was a qualifier; with all three amber, as the first version had them, the color distinguished nothing. `describeInvoiceLine` returns **named slots** rather than a list, so which one is colored is beyond a call site's reach. **Two slots since #210** (`verdict` / `againstOrder`) — the property the shape exists for is unchanged by losing the third.
  - **`Against the order:` is ONE line even when both sides exceed the order** — `3 EA more invoiced, 2 EA more delivered` — because it is one comparison with two terms, not two problems. The invoiced side comes first, being the side this screen is about.
  - **The deliveries sit INSIDE the box, labeled just `Deliveries ·`.** A box is scoped to one ordered item, so listing them there is exactly the claim the data supports; the foot-of-page section they used to live in needed the heading "recorded against the same order lines" to avoid over-claiming, and inside the box that qualification is structural. What #166 could still not claim: WHICH delivery brought the quantity attributed to this invoice — the quantity was attributed, the delivery was not. **#210 CLAIMS IT.** The delivery this invoice names is marked and sorted first; the others stay listed, because they are what explains a `Delivered` total larger than this invoice's share. **THE WHOLE FRAME OF THIS BOX PREDATES #210 AND IS NOW AN OPEN QUESTION, raised as its own issue by #231**, which changed two words here and nothing else. What it found while editing this screen for the pairing banner: the three figures are ALL the ordered item's, `Billed` included, and the deliveries listed are every delivery that touched the ordered item — so on an invoice that names no delivery, the box still shows another invoice's delivery under figures that are not this document's. `HYE-INV-260804-04` was that case: `Billed 30 EA` while it invoiced 15, `HYE-DL-260804-06` listed although that was `HYE-INV-260804-05`'s delivery, and `Nothing delivered yet` as the verdict. That frame was the honest one when #166 built it, because nothing recorded which delivery answered which invoice and the ordered item's context was all that could be claimed; #210 stored the pairing and hung the marker on the frame without revisiting it. Two consequences worth carrying into that issue: `This invoice:` exists only because `Billed` is the ordered item's, and this box's delivery line was **the only place in the app that named which deliveries filled an ordered item** — the PO detail carried `Delivered` and `Undelivered` quantities but no delivery identity (#169), the delivery detail goes the other way, and the materials screens never mention deliveries. **That sentence was true when #231 wrote it and #233 made it false the next day**, in three of its clauses at once: `/pos/[poId]` now lists the deliveries filling an order and names each one, it dropped the `Undelivered` column (each cell was its row's own `Qty` less the column beside it), and naming those deliveries IS the delivery identity it says the page has none of. Corrected here per #181, in the branch that found it. The order of the two issues was chosen for exactly this: #233 built the place that answers the question before #232 stopped this box from answering it. **The mark reads `— attached to this invoice` since #231**, which found `— this invoice` sitting directly after a delivery id and reading as a name for it; that is true whatever the box becomes, and the two words go with the marker if the marker goes. Measured 2026-08-14: all 9 boxes then on the base that listed any delivery listed exactly one, the two ordered items filled by two deliveries being invoiced by nobody, so the marker has never distinguished anything — which is part of why its wording read as a label. No offline check pinned the phrase and no copy constant held it: it is written straight into JSX, which is the reach #227's sweep does not have.
- **`/invoices` CARRIES THE STATUS CHIP AND NOTHING ELSE — both exception tags left that screen, for different reasons.** `beyond order` (invoiced > ordered) is already on the same page as the `⚠ Variance` badge in the items table, which `Invoice Items.Variance Flag` drives: one fact rendered twice on one screen. `over-delivery` (delivered > ordered) is not a fact about the invoice at all but about the ordered item, and inside a column headed `Delivery` it reads as "more delivered than this invoice covers" — a different and wrong claim. Both facts are on the detail, under the ordered item they belong to. **`/deliveries` KEEPS its `Over-delivered` tag**, and the difference is whose fact it is: an over-delivery is a fact about that delivery, so it sits on the delivery's own row without changing frame.
- **The filter follows the PR list's pattern (#119)**: the server sends rows it has already computed, a Client Component narrows them instantly with no Apply button, and the active filter is mirrored into the URL with `router.replace` — no navigation, no history entry, no server round trip — so refresh, a shared link and the back button all restore the view. It is `Over-delivered` (`?over=1`); the name does not say "only", because a filter is a toggle and the word is implied. **There were two until #216**, which moved `Not fully invoiced · oldest first` (`?unbilled=1`) to a strip above `/invoices` — see that issue's section below.
- **`Not fully invoiced` TAKES BOTH INCOMPLETE STATES, not just the empty one** (`isNotFullyInvoiced`). A delivery carrying two materials where only one has been invoiced is exactly "it is here and there is no invoice for it" — the thing the month-end email to every vendor stands in for — and filtering on `awaiting-invoice` alone dropped it. Verified on the seed: widening added a row to the worklist, and the row it added is that two-material delivery.
- **"Oldest first" is a property of that filter, not a separate sort control.** That list is the vendor-chasing worklist replacing the month-end email, so the longest-waiting delivery belongs at the top while the default list stays newest-first. `Received Date` ASCENDING, because the wait starts when the material was delivered rather than when someone typed it in; it is human-entered and backdatable, which #164 learned the hard way when an ID counter read such a field, and the consequence here is milder — a mistyped date sits at the top of a worklist — but it is the same property. `Created At` DESCENDING as the tie-break, matching the default list's direction exactly, so only the primary key flips between the two orderings and the tie-break carries no meaning of its own. An undated delivery sorts LAST, the same call `sortCandidates` makes.
- **BOTH LIST TABLES ARE `table-fixed` WITH A DECLARED `colgroup` SUMMING TO EXACTLY 52rem**, which is what a `max-w-4xl` page minus `p-8` has (832px). A column is never appended; the budget is re-cut. Measured against each base's widest real cells, with every row one line, no wrap and no horizontal scrollbar.
  - `/deliveries` (6 columns): `8.5 + 8 + 5.5 + 17.5 + 6.75 + 5.75`. The chip is far narrower than the sentence it replaced, so **Invoiced gave room back to Delivered** — the column that needed it and the only one that was wrapping, since it carries an item label, a `+N` count and an `Over-delivered` tag on one line (measured 270px for `165-DEMO Elbow 3" 3 PCS` beside the tag). **That measurement has since stopped covering the base's widest cell:** #167's seed added `167-DEMO Coupling 2"`, and #210 measured 1 of 15 rows wrapping to 63px on it. Neither the column set nor its widths changed in #210, so this is the #166 budget going stale as demo data grew rather than a regression — reported as a finding rather than fixed there, since re-cutting a 52rem budget is that comment's own work.
  - `/invoices` (7 columns) got a `colgroup` it never had: an auto-layout table sized the Delivery column from the longest phrase in it, so every other column moved when one invoice's status changed. **This table has almost no slack — seven columns need 832px against 832px.** Six of the seven are bounded by construction and cannot grow: an Invoice ID is a fixed format (128px), a date is ten characters (80px), the Delivery column is a closed set plus a marker (120px — **unchanged by #210**, which took the set from three chips to two: the one that left was not the widest, `Awaiting delivery` still is, and re-measured at 832px with rows at 28.5–29px and no horizontal scrollbar), `Amount Due` is bound by its own header (78px), and Status by `Paid 2026-07-27` beside a `⚠ Variance` badge (176px — which is why **the last column drops its right padding**, there being nothing to its right to separate it from). So **Vendor is where the slack isn't**: 8rem holds this base's longest name at 16 characters with nothing to spare, and it is also the column where wrapping would be least harmful if a longer supplier is ever added. The worst case was verified by injecting it into a rendered row, the way #19 injected a full-length PO ID. **#211 gave this table a SECOND budget rather than a seventh column**, the way `/pos/[poId]` carries two column counts: for a non-privileged viewer the last column holds the variance badge alone and needs 5rem instead of 11rem, and **the 6rem that frees goes to Vendor** — the column this paragraph records as having none, which then clears the longest name by 6rem instead of by nothing. Both rows still sum to exactly 52rem; measured at 832px with every row 29px and no horizontal scrollbar on both.
  - **BACK TO ONE BUDGET IN #309**, and Vendor back to 8rem — the width every measurement in that paragraph was taken against. Payment is readable by anyone who reaches the row, so the last column exists for every reader, and #179's badge came back inside it, so there is no second column count left to cut a second budget for. **Neither redistribution survived its own reason:** #211 gave Vendor 6rem because the column held the badge alone, #179 gave it 11rem because the column left entirely, and both were spending room a reader-dependent column freed. `/pos/[poId]`, the precedent both cited, stopped carrying two column counts in #235 — so **no table in this app now drops a column by reader**, which is worth knowing before the next one is drawn that way. What #309 also did is take the DATE off the payment word, so the widest thing in that 176px column is `⚠ Check the total` at 102px rather than `Paid 2026-07-27` at 104px: the column has slack it did not have, the stack under the word is kept, and re-cutting is the design work's rather than a visibility change's.
- **Not in this issue:** nothing is written anywhere, no `Invoices.Delivery` link, no new screen, and no correction of an overage — that is #167. The existing invoice visibility rules are unchanged: the invoice list and detail stay President-or-Admin, editing stays Admin, deliveries stay Job-scoped. **Two of those have since been done rather than reconsidered:** #210 added the link and the writes that fill it, and #211 made the invoice list and detail row-scoped instead of President-or-Admin.

### Overage corrections (#167)

More arrived than was ordered, the vendor invoiced for it, and the record has to be squared with the money: a corrective PR and PO for the difference, after which the excess lives on its own ordered item. `lib/overage.js` judges, `lib/overagePR.js` reads and writes, `lib/invoiceItemFold.js` puts the invoice's items table back together.

- **THE EXCESS NEEDS NO ARITHMETIC, and that is #162's decision paying off.** An over-delivery is its own `Delivery Items` row whose `Qty` IS the excess, so nothing here subtracts ordered from delivered. Every figure the correction carries comes from a record rather than a calculation: quantity from the row, unit price and vendor code from the invoice item, Job/Line/Vendor from the order the excess was attached to, the chain from that order's PR.
- **A REAL DRAFT RECORD, not a prefilled `/prs/new`.** The quotation is the vendor's invoice, which means fetching Airtable's copy of the file server-side and writing a FRESH Blob object for Airtable to ingest — handing the form an Airtable attachment url to re-submit is exactly the silent data loss #142 measured. Creating the record also gives `Delivery Items."Overage PR"` something to point at immediately, which is what makes the row read as pending from the moment the button is used. The redirect goes to `/prs/new?draft=<prId>`, the existing #72 resume path, and `loadPRDraft` hydrates the signer chain — which is what makes the inactive-signer decision below possible at all.
- **JOB-SCOPED, NOT OFFICE-GATED, AND THAT NARROWS #166 ON PURPOSE.** Raising the request is site work, per the issue. But the affordance reveals that the over-delivered ordered item is invoiced, by which invoice, and at what unit price — and #166, one issue earlier, withheld exactly "whether a vendor has invoiced" from site staff on the deliveries LIST. That column stayed withheld and unfetched for anyone else; this was a deliberate exception on the DETAIL, because none of those three facts can be hidden from someone raising a request quoted from the invoice (the vendor's invoice code lands on the Quotation they then edit). Recorded as a reversal rather than left as a contradiction between two comments. **#211 THEN RELEASED THE COLUMN TO EVERY VIEWER, so this is an exception to nothing now** — the reasoning stands as what the disclosure here rests on, but the contrast it was drawn against is gone, and `getPOItemsForReconciliation`'s own doc comment records the same retirement.
- **WHICH INVOICE CARRIES THE EXCESS IS #166'S AMBIGUITY, SO IT IS #166'S ORDERING** — `sortInvoicesOldestFirst`, imported rather than restated, and `offline/overage.mjs` asserts on the AST that `lib/overage.js` imports it and sorts nothing by `Issue Date` itself. The premise sentence is shared too (`INFERRED_PREMISE`, exported from `lib/deliveryStatus.js` for this), so the two `!` markers cannot come to explain themselves differently. **#210 LEFT ONE MARKER STANDING, WHICH IS THIS ONE.** The invoice axis's inference is gone with the stored pairing, so `sortInvoicesOldestFirst` and `INFERRED_PREMISE` are now exported for this module alone and read nowhere in the one that holds them — pinned offline, because a tidy-up looking for dead exports would find exactly them. The premise was NARROWED in the same pass: it said "and the deliveries cannot be told apart", which the link made false, and it now states only the condition `selectOverageInvoice` actually tests. Reading which invoice carries an excess off the pairing is #210's stated non-goal, because `spansInvoices` needs rethinking alongside it. **#219 DID THAT RETHINK AND EVERY SENTENCE ABOVE IS NOW HISTORY** — the candidates come from the pairing, both exports moved into `lib/overage.js` (the ordering PRIVATE there, so #182 carries no exception), one premise became two, and the AST assertions are inverted. See "Reading which invoice carries an excess" at the foot.
  - **What is NOT reused is `allocateLineToInvoices`'s `determinate` flag**, and the reason is that it answers a different question. There, determinacy means the outcome does not depend on the order the invoices are taken in — so a delivery covering EVERY invoice is determinate. Here the question is which invoice's INVOICE ITEM the excess quantity sits in, and full coverage leaves that wide open. **Two invoices on the ordered item is the whole condition** — **two invoices on this DELIVERY since #219**. The visible consequence: two invoices whose material all arrived show no marker on the invoice screens and still mark the overage attribution as inferred. Those are different claims, not an inconsistency.
- **AN EXCESS SPANNING TWO INVOICES IS OUT OF SCOPE, and the reason is the quotation rather than the arithmetic:** two invoices means two files and a PR takes one. Under oldest-first that condition is exactly "the oldest invoice's invoice item is smaller than the excess", so it falls out of the ordering rather than needing a rule of its own — and a LATER invoice large enough to absorb it does not rescue the case, because picking it would be a second answer to #166's ambiguity. The button is hidden and says why. **#219 SPLIT THE CONDITION IN TWO, because the one message was false for half the cases it covered:** with a single candidate invoice nothing spans anything, so that case says the excess is larger than what this delivery's invoice charges instead. The refusal itself stands — one request still takes one quotation.
- **GENERATING THE PO SETTLES IT, and the apply step sits OUTSIDE PO generation's rollback**, in `lib/materialsCache.js`'s position and after it (it matches the overage row to an ordered item of the new PO on #18's `Material` link, which the cache is what writes). Outside for #165's reason: a derived artifact must not undo the approval that produced it, and this one touches an invoice that may already be paid.
  - **So a failure leaves an ASYMMETRY, and it has to be visible with no email available.** Two signals, covering different halves. Re-attach failed → nothing moved, and the ONLY signal is the banner reading `not-applied`, because the row still points at an ordered item that IS invoiced so #166's worklist cannot see it. Split failed → the row moved, so the overage ordered item has a delivery and no invoice, which puts the delivery in `Not fully invoiced` as well. **Re-attach therefore runs FIRST**: the reachable middle state is the one two things notice rather than one.
  - **Idempotent, because there is no retry UI.** A row whose flag is already clear is skipped. `applied` is judged from `Former PO Item` since #206, and was judged from the flag before it. Either reads the same `update()` — `reattachDeliveryItemToPOItem` writes attachment, provenance and flag together and Airtable applies one record write atomically — but only provenance is beyond a recomputation's reach, which is what #206 needed.
- **THE INVOICE HEADER DOES NOT MOVE.** The two sides of the split sum to what the invoice item summed to, so `Items Subtotal`, `Calculated Total`, `Amount Due` and `Paid` are all untouched and only the attribution shifts. **That is what makes splitting an ALREADY PAID invoice safe, which is the common case rather than an edge one** — the invoice usually arrives and is settled before anyone corrects the record. `verify-overage-167.mjs` Part C runs the whole flow on a paid invoice for exactly that reason.
  - **An invoice whose WHOLE invoice item is the excess is re-pointed rather than split**, or it would be left at qty 0. `updateInvoiceItem` gained a `poRecordId` parameter for it: both links have to move together, or the invoice item would name a `PO Item` belonging to a different PO.
  - **Variance is RECOMPUTED with `checkUnitPriceVariance` and `getInvoicedQtyForPOItem`**, the two functions `createInvoiceAction` uses, rather than assumed to have cleared. The split is exactly the event that resolves a qty variance on the original invoice item, and asserting that without measuring it would be a second implementation of the rule.
  - **An `Invoice-PO Link` row is created for the overage PO.** Without it the order looks invoice-free, which would let #138 withdraw it and take the excess with it.
- **THE ITEMS TABLE FOLDS THE SPLIT BACK INTO ONE ROW, keyed on `Material` + unit price** (`lib/invoiceItemFold.js`, the invoice counterpart of `groupRowsByItem`). `Material` is what makes two rows the same item without matching `Item Name` text; the unit price is what keeps a vendor's two genuinely different prices for one material apart, since a split cannot change the price. **A row with no `Material` is never folded** and is its own group keyed on its record id — not a fallback to name matching: a split can only produce rows carrying the link, so a row without one cannot be half of one.
- **THE PO COLUMN LEFT THE ITEMS TABLE IN THE SAME COMMIT that put the order into the delivery section's boxes, and the pairing is not optional.** A folded row spans two orders, so that cell has no single value — unrepresentable rather than merely inconvenient. But removing the column alone would take "which item belongs to which order" off the page entirely, so the order moved to where it is exactly one: a box is scoped to ONE ordered item, and a split shows as two boxes each naming its own. This edits the section #166 built.
- **THE BANNER IS DERIVED FROM LINKS, on all three documents, and it outlives signature.** An overage order read on its own looks like a duplicate with no quotation of its own; worse, the invoice attached to it also charges the original order, so a payment against that invoice matches neither order's total alone. Whoever reconciles it needs telling, exactly once, there.
  - Three sites — the corrective PR (its own reverse-link), the corrective PO (one hop through its `PR`), and the ORIGINAL PO (its own ordered items' provenance reverse-link). Three states — `pending`, `applied`, `not-applied` — appended as shared entries rather than multiplied, so three × three stays 3 + 3.
  - **The caveat belongs to `applied` only.** While pending the invoice charges one order, so claiming it spans two would be false.
  - **The original PO's banner names the DELIVERY rather than claiming that order was over-delivered.** One delivery can fill two orders of the same material and #165 attaches the excess to the last one filled, so the banner is reachable from an order that was not itself exceeded — but the provenance reverse-link means only the order the excess actually came from renders it, which is what made that walk unnecessary.
- **THE INACTIVE SIGNER IS LEFT OUT, and the preview says how many.** A chain that reaches a departed signer STOPS and nothing in the app can unstick it — the turn belongs to a user who cannot log in. Arriving one signer short and saying so is better; the Draft is editable, and `createPRAction` already refuses an empty chain in its own words.
- **KNOWN GAP, recorded rather than fixed: a withdrawn overage PO.** `PO Items."Committed Qty"` is `IF({PO Status} = "Withdrawn", 0, {Qty})` but `Delivered Qty` has no status condition, so withdrawing an overage PO would drop the excess out of the order book while leaving it in the delivered figure — the excess disappears quietly. **The reachable half is handled:** `overagePRState` reads the overage PO's status one hop further and returns `none` for a withdrawn one, so a `not-applied` row reopens rather than being locked out forever by a correction that no longer exists. **The unreachable half is the gap:** an APPLIED overage carries an invoice item, and #138 refuses to withdraw a PO that has one, so today it cannot happen. If that ever changes, the fix is a status condition on `Delivered Qty` or a check in `withdrawPOAction`.
- **Not in this issue:** an excess spanning two invoices (no single quotation), any change to the invoice header, and #20. Nothing about a correction is stored as state — `Former PO Item` is provenance, not state, and every "is one pending" answer is read from the linked PR's Status.

### Recomputing over-delivery flags (#206)

`Over Delivered` records a judgment made when its row was written, and deleting a delivery can make it false: the row claims material was delivered beyond what an order asked for while the ordered item it sits on is no longer over-delivered. Order 10, one delivery brings 10 and fills the ordered item, a second brings 10 more recorded entirely as surplus against that same full ordered item, delete the first — the ordered item holds 10 against an order of 10 and the surviving row still claims 10 beyond it. **Deletion is the only way to correct an item or a quantity** (`lib/deliveryDelete.js` says so itself), so that is the ordinary correction path rather than an odd ordering.

- **THE FLAG COULD NOT SIMPLY BE RECOMPUTED, because it did two jobs.** It states an arithmetic fact about one row, and it was the signal `isOverageApplied` read to decide whether a correction's excess had moved. Recomputing would have forged `applied` on a correction that never applied — erasing the one signal that reports a real failure, since `not-applied` is the only place PO generation's asymmetry surfaces. **So `isOverageApplied` moved onto `Former PO Item` FIRST, in the same pass**, and the recomputation follows it rather than the other way round.
  - **The equivalence, and why it holds.** `Former PO Item` is written by exactly one thing, `reattachDeliveryItemToPOItem`, in the same `update()` that clears the flag; `createDeliveryItem` never writes it. So provenance set means the apply step ran, and provenance empty on a row carrying an `Overage PR` link means it did not. It rests on a row moving at most once, which is the premise already on that field's description.
  - **MEASURED, NOT ARGUED, because this base carries no overage order at all** (0, measured in #206's design pass). A temporary credentialed script created one throwaway row, ran the production re-attachment on it, and read it back: one `update()` produced BOTH halves. Old rule and new rule agreed on an unmoved row and on a moved one, and **disagreed on exactly the state #206 introduces** — a flag cleared with no move, which the old rule called `applied`. It was deleted after the run, so nothing standing re-measures this; #206's commit message is the record.
  - **That function's comment said "THE FLAG IS THE SIGNAL … That is the only signal there is", and it was already false** when #206 found it: the same write has set provenance since #167. Corrected in the same pass, along with `reattachDeliveryItemToPOItem`'s own docstring and a line in `lib/overagePR.js`'s header claiming a failed split shows `not-applied` — re-attachment runs first, so it shows `applied`, and that line was wrong under the old flag rule too.

- **IT REPRODUCES #162'S CONTRACT, NOT `planDelivery`'S ALLOCATION, and that distinction is the whole design.** The contract is two statements about QUANTITY: an ordered item's unflagged rows sum to what was ordered, and its flagged rows sum to the excess. Allocation is larger — it also decides WHICH ordered item a delivery attaches to, by FIFO across candidate ordered items. `recomputeOverDelivery` works inside one ordered item and moves only the boundary. **Holding it to "the rows a fresh allocation would produce" was tried and rejected**: that standard is already not applied to ordered item attribution, so applying it to row boundaries is inconsistent, and the rows differ for exactly that reason — an earlier delivery's freed room is not handed back to a later delivery's row, because that would BE re-allocating. Nothing in the codebase or the commit message may say the replay reproduces the allocation.
- **NOTHING IS EVER MERGED, and the reason is that merging adds no correctness.** Two adjacent unflagged rows are redundant, not false; the contract counts quantities and says nothing about how few rows carry them. `groupRowsByItem`'s `rowCount` is the only thing that can see the difference, and it is read by no screen — measured across `lib/` and `app/`.
- **THE STRADDLING ROW IS SPLIT, NOT ROUNDED**, and that is what keeps #162's contract true rather than trading one falsehood for another. A row beginning inside the order and ending beyond it cannot be stated by a flag: unflagged claims the whole quantity delivered within the order, flagged whole claims it was all excess. **At most one per ordered item**, because every stored row has a positive `Qty` — both of `planDelivery`'s push sites guarantee it — so the running total is strictly increasing and crosses once.
- **WHICH PIECE KEEPS THE RECORD IS LOAD-BEARING, and the first choice was wrong.** The existing row is resized to the WITHIN piece and the excess becomes the new row. A new row is minted by `generateChildId` and therefore sorts LAST, so putting the within piece there leaves an ordered item reading `within, over, within` — measured, and a second run then moves the flag onto a different record, which would silently take it off a row carrying an `Overage PR` link. With the excess as the new row the result is stable under a second run. **That ordering is also why the link never moves**: the resized record keeps whatever it held and simply stops being flagged.
- **THE `Overage PR` LINK IS NEVER CLEARED.** Delete-then-reenter is the correction path, so a link destroyed mid-edit could not be restored when the excess reappears seconds later. Withdrawal needs no trigger either: `overagePRState` already returns `none` for a withdrawn overage order.
- **What replaces the clearing is a QUALIFIER, not a fourth state** — #166's shape, where `inferred` is a marker beside a chip rather than a value inside it, so three states plus a qualifier stays 3 + 1. `isNoLongerOverDelivered` fires when a row holds the link, has no provenance, and is no longer flagged. **Two voices, not three:** a pending request has been approved by nobody and an unapplied overage order carries no invoice, so #138 admits withdrawing both; an applied one cannot be withdrawn, and naming an unavailable action would be worse than silence. **The applied voice is absent rather than written, because that combination cannot arise** — an applied row sits alone on the overage order's ordered item, whose `Qty` is the excess exactly, so a recomputation there always finds it within.
  - **The other shape of mismatch — a linked row still flagged but carrying a different quantity from the one its correction covers — is NOT a clause here, because a delete cannot produce it.** The only row a delete resizes is the one that stops being flagged; every other flagged row keeps its quantity. It is reachable by editing a draft correction's quantity, which is outside #206 and would cost a read of the overage order's own items on every banner render.
- **DELETING A DELIVERY NOW CREATES ROWS, and never removes them.** Two batched reads at 50 ids per query, then one `update()` per row whose quantity or flag changes and one `create()` per straddling ordered item. An ordinary one-line delete pays two reads and no writes. No row is deleted and no row is merged, so the only records touched are the ones resized and the ones added.
- **RESIZE BEFORE CREATE, and the order is the failure mode rather than style.** A create that fails after the resize loses the excess from the ordered item's recorded total — material that was delivered reads as undelivered, and the next recomputation finds no straddle and changes nothing further. The other order fails the other way: a created excess with the straddler still at full size leaves the ordered item reading as MORE delivered than delivered, which #169 records as the worse direction, since nobody goes looking for material the record already claims. Both are bounded and neither compounds; this is the one that does not fabricate delivery. The whole step is best-effort in `lib/materialsCache.js`'s shape — the delivery is already gone, so a failure here is logged rather than reported as a failed delete.
- **A PRECONDITION CAME WITH IT.** `deleteDeliveryAsUser` discarded its `Promise.allSettled` results — the exact defect `offline/fixture-cleanup.mjs` bans in verification scripts, sitting in production. A row that failed to delete was silently absent and the parent went anyway. #206 makes that a correctness matter: a surviving row missing from the recomputation's input would have the boundary drawn against an ordered item that is not what is stored. The destroys are sequential now and a failed child throws before the parent goes.
- **The offline check asserts the CONTRACT and its own reachability.** Per ordered item: unflagged rows sum to the ordered quantity, flagged rows sum to the excess, the total is unchanged, and those two quantities match a fresh allocation of the surviving deliveries — quantities only, never rows. Its anti-vacuity is that the corpus must CONTAIN a straddle and the straddle must have produced a split; dropping the three straddling scenarios leaves all twelve contract assertions passing and fails exactly those two, which is the hole they exist to fill.
- **THE BANNER REACHES TWO DETAIL PAGES AND NO LIST, so a correction that has come adrift is only seen by someone who opens it.** `/prs/[prId]` and `/pos/[poId]` render it; `/prs`, `/pos` and `/deliveries` do not. That is survivable for `In Review` and `Awaiting Signature`, where a signer has to open the page to act and the banner sits above `SigningPanel` — but a `Draft` or an `Approved`/`PO Signed` correction is a page nobody has a reason to reopen, so the mismatch reaches no one. Same family as #198 (a state that exists only on a detail page and has no list to surface it), and raised there rather than as its own issue.
- **Not in this issue:** backdated entry, which misattributes which delivery carries a surplus without making any flag false.

### The invoice-to-delivery pairing (#210)

`Invoices."Delivery"` names the delivery an invoice describes. It is the office rule #166 could only state in prose written down where the data can hold it, and it replaces an estimate rather than adding a figure beside one. `lib/deliveryInvoiceLink.js` is the rule and its copy; `lib/deliveryInvoiceCandidates.js` is the gated read and the guarded write.

- **THE ESTIMATE WAS WRONG IN THE CASE THE FEATURE EXISTS FOR, and that is why this is a correction rather than a refinement.** `allocateLineToInvoices` filled an ordered item's invoices oldest-first with whatever had been delivered on it. A delivery can carry material nobody has invoiced yet, so the fill ran past the invoice it should have satisfied and spilled the remainder onto the next one — and an invoice whose own delivery had not delivered at all then read `Partly delivered`. Under the containment premise that state cannot mean a stage: an invoice is either delivered or awaiting delivery, and anything between is a vendor shipping less than it invoiced. **The inference manufactured it out of the very condition the `Awaiting invoice` worklist exists to surface.** On the delivery side the same shape: `summarizeDeliveryInvoicing` asked whether each ordered item a delivery filled carried ANY `Invoice Items` at all, so a delivery with nothing invoiced dropped off the chasing worklist as soon as some earlier invoice had touched the same order.
- **MEASURED ON THE SEEDED SCENARIO IT WAS BUILT FROM.** #166's scenario D is two invoices of 15 on one ordered item of 30 with 15 delivered. Under the fill, `166-DEMO D older invoice` read `Delivered` and `166-DEMO D newer invoice` read `Awaiting delivery`, both marked inferred. The 15 that arrived is the newer invoice's delivery: pairing it moves `Delivered` onto the newer invoice and leaves the older `Awaiting delivery`, which is the answer the old code had exactly backwards on a coin-flip it announced as a coin-flip. Both readings were produced in a browser against the live base.
- **n:1, AND THE ASYMMETRY IS THE RULE.** Single on the invoice, plural on the delivery: a delivery can be invoiced in more than one document while an invoice is not split across deliveries. So a refusal is always about an invoice and never about a delivery, and `taken-by-another` is the only one that names another record.
- **SINGLE-RECORD IS APP-ENFORCED, WHICH IS A PRECEDENT RATHER THAN A COMPROMISE.** The Metadata API refuses `prefersSingleRecordLink` on field CREATE and field UPDATE alike (422, re-measured when this field was created — `prefersSingleRecordLink: false` came back on both halves). `Invoice Items."PO Item"` and `Delivery Items."Overage PR"` already live with it. So the read side flattens through one function (`linkedDelivery`) and no reader iterates: a second link could only arrive by hand, and treating it as meaningful would turn one hand edit into two contradictory answers on two screens.
- **SET FROM THE DELIVERY SIDE, WHICH IS THE ORDER THE DOCUMENTS ARRIVE IN.** The vendor emails the invoice at shipment, so the invoice is normally on hand FIRST and the packing list that comes with the material carries its number. The office cannot pair them — it does not know which delivery a number belongs to — so the recorder does, at entry or later. **This is the correction the groundwork commit made**: the reason `Delivery Items` links `PO Item` is availability, not order of delivery, and as written it read as an argument against this link.
- **A DROPDOWN, NOT A TYPED NUMBER, AND #211 IS WHAT CHANGED THAT.** The design that reached this issue chose a number input for one reason: a picker has to show invoice numbers, and #166 withheld invoice existence from site staff, so typing was the only shape that disclosed nothing. #211 opened the invoice routes to any viewer who may see the order behind an invoice item — which every row of the delivery form already is — so the disclosure is gone and the picker is strictly better: it cannot be mistyped and it cannot name an invoice that does not exist. What it cannot do is invent one, which is why blank is a normal answer and the field says so where the blank is.
- **THE SCOPE GATE IS `canViewPR`, THROUGH `lib/invoiceVisibility.js`, AND THE SHORTCUT THAT WAS TEMPTING IS WORTH NAMING.** `getDeliveryCandidates` already holds every purchase order on the viewer's jobs, so "an invoice invoicing one of those orders" is free — and it is a SECOND answer to the visibility question that would disagree with the first, since `canViewPR` also admits a requester, a signer and the recipient of a correction request, none of whom need a Job assignment. `offline/invoice-visibility.mjs` asserts the new module imports the walk, calls it TWICE (once on the read, once in the guard) and does not import `deliveryCandidates` at all.
  - **AND THE ANSWER IS REQUIRED, BECAUSE THE FIRST VERSION FAILED OPEN.** `invoiceLinkRefusal` tested `visible === false`, so as not to confuse "refused" with "not asked" — which made a caller who forgot the argument pass the gate. The distinction was deliberate and the direction was still wrong: a permission check whose DEFAULT is admit is the hazard whatever its reason, and nothing asserted that the one caller passed it, so the safety of that shape rested on a fact no check could see. It **throws** now, and the choice of a throw over an AST check over call sites is `verification.md`'s own — "source shape is not execution", and an AST check can see neither an indirect call nor whether the value passed was right. It is also the call `lib/airtableFormula.js:orByField` already makes for a caller bug. A non-boolean throws too, since coercing `"yes"` to admit or `null` to refuse would both answer a question nobody asked. **What the throw costs is that a forgetful caller 500s instead of failing CI**, so the one call site is pinned in `offline/invoice-visibility.mjs` beside the other call-site claims — covering the cost rather than replacing the guard. **What neither proves** is that the value is CORRECT: a caller passing `true` unconditionally satisfies both, which is the browser's and the credentialed tier's to establish.
- **VENDOR IS THE WHOLE NARROWING, AND DELIBERATELY NOT THE JOB.** An invoice can charge orders on more than one job, so narrowing by job could hide the right invoice; a delivery has exactly one vendor and an invoice from another supplier is never the answer. The viewer's own scope is already applied by the gate, so the vendor filter is semantic rather than a second gate.
- **AN ALREADY-PAIRED INVOICE STAYS ON THE LIST, unselectable, naming where it went** — #162's rule applied one level up. Its item dropdown lists a fully delivered item rather than dropping it, because dropping it lands the recorder on "not in the dropdown", which says it may never have been ordered here and would be false. The same is true of an invoice somebody paired: it exists, it is this vendor's, and a recorder holding a packing list that names it needs telling where it went rather than shown a gap. **The delivery is NAMED only when the reader may reach it** — a delivery is Job-scoped and an invoice can charge two jobs, so the holder is not always in view, and naming it then would confirm a record outside someone's scope.
  - **THE REFUSAL MAKES THE SAME SPLIT, AND #206'S RULE IS WHY.** `taken-by-another` ended `detach it there first if this is the right delivery`, which names an action the reader cannot take whenever the holder is outside their scope — it sends them to a page that will tell them the delivery does not exist. #206 gave its own qualifier two voices rather than three on exactly this ground: naming an unavailable action is worse than silence. So the FACT is shared and only the action is conditional, the arrangement `noLongerOverSentence` uses: both voices say the invoice is taken and say the rule that makes it exclusive, and only the reachable one says what to do about it. **Nothing is invented for the other voice** — "ask the office" would name a process this app does not model, and the reader can see the invoice, so the fact is what they act on.
- **DETACH RATHER THAN SWAP.** Re-pointing an invoice is a claim about two deliveries at once, so it is two steps: the screen it left says so, and the refusal stays truthful instead of being something the app silently overrides. Detaching passes no vendor to the predicate, because a pairing that somehow crossed vendors has to stay detachable — otherwise the refusal locks in the state it objects to.
- **THE ENTRY PATH GUARDS BEFORE IT CREATES AND WRITES LAST, INSIDE THE ROLLBACK.** Refusing after a create would mean rolling a delivery back over a pairing; writing the link last means nothing follows it, so a failure cannot leave a pairing whose delivery was then destroyed. Destroying the delivery removes the link with it, so the rollback needs no undo of its own. `deliveryRecordId` is null at guard time and that is the correct reading rather than a special case: the delivery does not exist yet, so ANY existing pairing is a refusal.
- **EDITABLE IN PLACE, AND IT PASSES THE TEST THE OTHER FOUR FIELDS FAIL.** Item, quantity, vendor and packing-list PO are fixed on one ground: changing them changes what the delivery was allocated against, and there is deliberately no allocation-editing UI. A pairing changes no `Delivery Items` row, moves no quantity between orders and re-runs nothing — it is orthogonal to that reason, which is why it joins the received date, the note and the photo rather than the delete-and-re-enter list.
- **THE INVOICE AXIS IS TWO STATES AND A DISCREPANCY.** The chip is the link's own two values; a quantity shortfall is a marker beside it. **No marker without a link** — every invoice item of an unpaired invoice is trivially short, so marking them would put a discrepancy on nearly every invoice on the base. The dash left the axis too, and as UNREACHABLE rather than unwanted: it meant "there was nothing to compare", which was true while the chip came from the invoice items, and the chip comes from a header field now. **#232 MADE THE DISCREPANCY THE THIRD VALUE** and retired the marker on both invoice screens; the "no marker without a link" clause survives as the clause order inside `summarizeInvoiceStatus`, which asks about the link before it asks about quantities. See the premise section at the top for why a third value does not reopen what this issue closed.
- **THE DELIVERY AXIS KEEPS THREE KEYS, AND THAT IS NOT A BARE LOOKUP.** The issue's own wording was "turns `summarizeDeliveryInvoicing` from a line-level existence test into a lookup", and a literal lookup would be wrong: a delivery can carry material nobody has invoiced yet, so "does this delivery have an invoice" would read `Invoiced` while half of it is still owed. So it compares, per ordered item, what the invoices NAMING this delivery charge against what this delivery brought — and the middle key is the state the worklist exists for. `>=` rather than `===`, because a vendor invoicing more than it shipped is the invoice axis's discrepancy and leaves nothing to chase from this side.
- **THE SEED WAS NOT CHANGED, AND THE PAIRINGS ON THIS BASE WERE MADE THROUGH THE APP.** Every seed here is skip-if-exists, so teaching one to write this field would produce nothing on an already-seeded base — a claim about future coverage rather than a verification of the present one, which `verification.md` records measuring on #181. Two demo deliveries were paired through the real attach path instead, which is both the data and the verification.
- **Not in this issue:** `selectOverageInvoice` (#167) still guesses which invoice carries an excess and becomes a lookup once this pairing exists, but its `spansInvoices` refusal needs rethinking alongside it — **#219 is that issue, and the answer was not a lookup but a tiered narrowing**, because an invoice naming no delivery is this feature's own ordinary state rather than a gap; `/pos` and `/pos/[poId]` are untouched, since the PO axis compares delivered against ORDERED and no invoice enters it; and #20 is still where "what should ordered mean" is decided.

### Deliveries

- **`Job` is a direct link, not a lookup through PO**, because a delivery may name no PO at all — site orders first and the PR/PO follow as a record — and the Job is what scopes both authorization and the item dropdown, so it must be present unconditionally.
- **`Created At` was added because the ID counter needed a field nobody can backdate, and #164 then took that reader away** — the counter now counts the ID prefix and reads no date field at all (see "The daily counter counts the ID prefix"). The field stays, on its other two readers: the deliveries list's tie-break, and being the only timestamp on the record nobody typed — a packing list often carries no date at all, unlike a vendor invoice, so `Received Date` can be an unbacked guess. What #162's reasoning got right is unchanged and is why the rule generalized: `Received Date` is routinely earlier than entry (material arrives late afternoon, gets recorded next morning), so counting on it would have made the ID's date and the counted population different sets, which is exactly what `generateNextInvoiceId` was doing.
- **`Packing List PO` is the packing list's own reference, recorded even when allocation could attribute nothing to it.** Deliberately on the header and not on the delivery items: a delivery item links a PO ITEM, because that is what carries quantity. The two are separate levels of attribution, and an over-delivery row claims only the level it can support. **Named `PO` until #181**, where a bare `PO` was found to read as the order the delivery was recorded against — the other level entirely.
- **`Recorded By` is load-bearing, not audit** — deletion is restricted to this user plus Admin, and deletion is the only way to correct an item or a quantity.
- Editable in place: `Received Date`, `Notes`, `Packing List File`. Nothing else. Item, quantity, vendor and the packing list PO are fixed, because changing them changes what the delivery was allocated against and there is no allocation-editing UI.

### Delivery Items

- **Links to `PO Item`, never to an Invoice Item**, and the reason is AVAILABILITY rather than order of delivery: the ordered item is always there to compare a delivery against, and an invoice usually is but not always. The order runs the other way from what this bullet claimed until the dedup commit — a vendor emails the invoice when it ships and the material turns up afterwards, so the invoice is normally on hand FIRST. That does not change the conclusion, because a link a rollup travels cannot be one that is sometimes empty, and "usually present" is what disqualifies it. Never matched on `Item Name` text; allocation matches on #18's `Material` link.
  - **#210 ADDED AN INVOICE LINK AND THIS BULLET STILL HOLDS, which is worth stating because the two look like the same decision.** `Invoices."Delivery"` is on the HEADER and no rollup travels it — it is a fact about which delivery a document describes, optional by design, and `summarizeDeliveryInvoicing` reads it in JS where an absent value is a state rather than a gap. A `Delivery Items` link to an INVOICE ITEM would still be the wrong thing for the reason above: `Delivered Qty` sums through this field, and a rollup over a sometimes-empty link silently under-counts. **"Usually present" is exactly why the pairing is set from the delivery side**, too — the recorder has the number in hand while the office does not know which delivery an invoice belongs to.
- **`Qty` is per row, and that is what makes the rollup correct.** A link field carries no quantity, so one row pointing at two ordered items would contribute its FULL Qty to both ordered items' `Delivered Qty` (a rollup counts the row once per linked parent) and double-count. Splitting 20 into 15 + 5 is structural, not cosmetic.
- **`PO Item` is never empty on a row this app writes (#165), and the field stays optional in the schema anyway.** Those are two different statements and both are deliberate. Allocation attaches every row, including the over-delivery one, and refuses to plan at all when it has no ordered item to attach to — so `createDeliveryItem` is never called with a null link. The Airtable field is left optional because tightening it would be a schema change that buys nothing the code does not already guarantee — and because it cannot be done: **Airtable exposes no way to make a link field required**, on the Metadata API or in the UI, which is the same limit `prefersSingleRecordLink` runs into. Measured at #165: 0 of the base's stored rows lack the link, so there was nothing to backfill.
  - **THE READING SIDE SURVIVES A HAND-EMPTIED LINK AND NO LONGER DESCRIBES ONE (#278), and the split is by what each half is for.** This bullet said readers must "cope with" such a row and cited `ALLOCATION_COPY.banner.overUnattached` as rendering the state rather than swallowing it. Half of that is still true and half is not, so it is split rather than kept. **What survives is every guard against a crash**: the four slice guards in `lib/deliveryReconciliation.js`, the `continue` in `lib/poDocuments.js`, `groupRowsByItem`'s fall back to the frozen name when there is no `Material`, and the null-tolerant writes in `lib/airtable/deliveryItems.js`. A page that does not load shows nobody anything, so that half is about the reader whether or not the state is reachable. **What went is every place that named the state on a screen**: `not against any order` in the delivery detail's order cell, the delivery axis's `no-ordered-items` chip and its em dash, and `OVERAGE_BLOCKED.noOrderedItem` with its sentence and its strip chip. Two reasons, and the second is the one that decides it. #165 measured the state at **0 rows**, so three pieces of copy existed for something that has never happened. And the only person who can empty a `PO Item` link is somebody with the Airtable base open — who is, on this project, the one person who would be reading the explanation. A screen explaining a state to whoever created it is copy with no audience, which is a different thing from a defensive guard.
  - **What that costs, stated rather than hidden.** A delivery whose every link was emptied now reads `Awaiting invoice` instead of an em dash, which is false in a specific direction: nothing has invoiced it *as far as this walk can see*, and the row stays on the vendor-chasing worklist where somebody will open it. The alternative false answer was `Invoiced`, which would have called it settled and dropped it. Neither is right; the one that takes a reader to the row is the one to prefer. `overageEligibility` refuses such a row under **no key at all**, so the delivery detail offers no request and says nothing about why, and `awaitsOverageRequest` excludes it so the strip of excesses awaiting one does not list a row it cannot explain.
  - **`ALLOCATION_COPY.banner.overUnattached` STAYS, and #278 found that it is not about this state at all.** It fires when the flagged slices of one item do not all name ONE order (`poIds.size !== 1`), which includes slices spanning two orders with every link intact — a shape the app can write through the delete-replay split. So it describes something reachable, which is exactly the test the rest of this bullet applies. The seed comment calling `UNATTRIB` its only producer was wrong on that point and is corrected.
- **`Item Name` / `Size` / `Unit` are never blank**, unlike Invoice Items': they come from the linked PO Item, or from the `Material` when there is no PO Item, and a Material is always linked and carries all three as its natural key.
- **`Overage PR` (link -> Purchase Requests, single) and `Former PO Item` (link -> PO Items, single) are #167's two fields**, both app-enforced as single-record: the Metadata API refuses `prefersSingleRecordLink` on field CREATE (measured 422 `INVALID_FIELD_TYPE_OPTIONS_FOR_CREATE`, another limit alongside its refusal to write a select's option list), and on field UPDATE (422 `INVALID_REQUEST_UNKNOWN`, both shapes tried), so the field is multi in Airtable and single in this app, exactly as `Invoice Items."PO Item"` already is — and the invariant is therefore checked on the stored ROWS rather than on a schema property nothing can set. Their symmetric sides are `Purchase Requests."Overage Delivery Items"` (the rows this request corrects) and `PO Items."Former Delivery Items"` (the rows that left this ordered item), and nothing writes either. **The two symmetric sides are deliberately NOT the same name**, which they were until the rename: one name for two meanings across two parents is worse than the accidental collisions #164 had to census, because it would be on purpose. The PO-side name went through `Reattached Delivery Items` first and that named THE WRONG END — the row is re-attached to the OVERAGE order's item and from this one it DEPARTED, so anyone opening the record read it backwards. `Former` says what the field it mirrors says, and beside `Delivery Items` it makes clear at a glance which of the two is the past. **`Overage PR` is the whole of "is a correction pending" — read from that PR's Status, never stored, which is what makes a withdrawal reopen the row.** **`Former PO Item` is PROVENANCE, not state:** the apply step re-points `PO Item` at the overage order, which destroys the only link back, and deriving the original through the shared Delivery breaks whenever the whole delivery was excess (#165's fully-delivered branch leaves that delivery with no other row for the material). Every reader takes `Former PO Item ?? PO Item` (`lib/overage.js:resolveOriginalPOItem`). **NAMED FOR WHAT IT STORES, WHICH IS ALWAYS A PAST VALUE** — empty on a row that never moved, the previous ordered item on one that did, and never a current one. It was briefly `Original PO Item`, chosen on the strength of that `?? PO Item` fallback, but the fallback is a property of the EXPRESSION rather than of the field: the field holds the past and the function collects an answer across both states. Named for what it holds rather than for the overage for a second reason too — a later re-attachment for some other cause belongs in the same field, and the cause is already next to it on `Overage PR`.
  - **THE FIELD AND THE FUNCTION MEAN DIFFERENT THINGS, and the premise that keeps them interchangeable is on the field's own description.** `Former PO Item` is the IMMEDIATELY PREVIOUS value; `resolveOriginalPOItem` is the FIRST. A row moved twice (A -> B -> C) would part them. Unreachable today: an overage PO Item's `Qty` equals the excess exactly, so no further excess can arise on it, and a `Delivery Items` row's `Qty` is fixed at creation, so the same row cannot become an over-delivery row a second time. If either changes, the field is the one that stays correct.
- **`Over Delivered` is its own row rather than a swollen last row** (the field was `Over Delivery` until #181 — a noun where a checkbox takes a participle; see "A checkbox takes a participle" under the naming rules), so the flagged quantity IS the excess with no arithmetic, and every unflagged row stays a within-order fact — the property #20 filters on.

### Deliveries waiting for an invoice (#216)

A strip above `/invoices` listing deliveries nobody has invoiced for, longest wait
first. The second of three built to the shape #176 set — #217 is the third.

- **`?unbilled=1` IS GONE FROM `/deliveries`, AND THAT IS THE POINT RATHER THAN A
  SIDE EFFECT.** It was the vendor-chasing worklist wearing a checkbox on a page
  whose other job is a chronological log, and the two pull opposite ways: a log
  reads newest first and its empty state means nothing delivered, a chasing list
  reads oldest first and its empty state means there is nothing left to do.
  Nobody visits a query parameter on a schedule. What died with it: the checkbox,
  its URL sync, and `invoicingKey` on the row — the column renders from
  `invoicingChip` and the key had no other reader. What did NOT die is the rule:
  `isNotFullyInvoiced` and `sortLongestWaitingFirst` stay in
  `lib/deliveryStatus.js` and the strip calls them, so the predicate has one
  implementation and simply changed caller.
- **THE RULE WAS ALREADY WRITTEN, WHICH IS THE FIRST THING #176's PATTERN DID NOT
  TRANSFER.** That issue wrote `selectPRsAwaitingPO` fresh into the host screen's
  view module. Doing the same here would have been a second implementation of a
  predicate that already existed and was already pinned offline. **And the
  predicate's SHAPE differs too**: #176's is a status set intersected with an
  empty reverse-link, where this one is a per-ordered-item quantity comparison —
  #210 changed it from an existence test to `invoiced >= arrived`, so "waiting" now
  means *this* delivery is uninvoiced rather than *its order* is.
- **ONE VOICE, NOT TWO, AND THAT IS THE SECOND THING THAT DID NOT TRANSFER.**
  #176 needed two because it offered an action only an Admin could take. This
  strip offers no action at all, so there is nothing for a voice to split over.
  **The copy names no control either**, which is a live constraint rather than a
  style choice: `/invoices` has a `New invoice` button that only an Admin sees,
  and the strip renders for every viewer who can reach a delivery — measured,
  `scoped-fixture@` sees the strip and zero `New invoice` links. The offline check
  asserts the copy contains no such word, because the day it does is the day two
  voices are needed again.
- **NO ACTION LINK, AND NO PREFILL.** A `Record invoice` control per row would be
  a second thing going where the button already at the top of the page goes — one
  fact rendered twice on one screen, which is the reason #166 took the
  `beyond order` tag off this very list. Prefilling `/invoices/new` from the
  delivery was weighed and rejected on three measurements, all recorded in
  `app/invoices/AwaitingInvoiceStrip.js`'s header: #92's detect-po reads vendor
  and order off the invoice PDF and nothing says which source wins when they
  disagree; the form's PO list is the OPEN ones (#57), so a closed order would be
  filtered out of its own prefill; and **9 of the 13 waiting deliveries span one
  purchase order while 4 span two**, because `planDelivery` matches per material.
  Narrowing the item picker to what was delivered would be worse still — an invoice can
  legitimately charge for what the delivery did not bring, which is exactly what
  #210's mismatch marker catches, so the restriction would make the real case
  unenterable.
- **THE STRIP'S ROWS ARE GATED BY THE DELIVERY RULE, NOT THE PAGE'S.** This is the
  finding #176 could not surface, because there the strip and the table were both
  `canViewPR`. Here the table is invoices under `getVisibleInvoiceIds` and the
  strip is deliveries under `canAccessJobDeliveries`, and the two admit different
  people: an employee can reach an invoice through an order they raised without
  being assigned to that job. Measured on one load: `scoped-fixture@` sees 13
  strip rows and 13 table rows where `soo@` sees the same 13 strip rows and 15
  table rows. **A strip uses its own rows' rule.**
- **ORDERED BY `Received Date` ASCENDING**, which `sortLongestWaitingFirst`
  already did for the filter this replaces. The row shows the date AND a day
  count, because the question a chasing list answers is how long, and making a
  reader subtract defeats scanning. `daysWaiting` takes `today` as a parameter so
  the offline tier pins every boundary without a clock, and its header records the
  two properties that are worth knowing rather than fixing: the count is the
  SERVER's day, and `Received Date` is calendar-only so it moves at midnight
  rather than at the hour material was delivered. The date beside it is what a doubting
  reader checks against.
- **`getDeliveryInvoicing` RETURNS THE DELIVERY ITEM ROWS IT READ NOW**, and that
  removed a duplicate that had been standing on `/deliveries` unseen. That page
  fetched the same level itself to summarize what was delivered and then called this
  function, which fetched it again — invisible because the page carried no
  `withOpsLabel`. **Measured: `/deliveries` 8 operations with a
  `Delivery Items ×2` repeat before, 7 with none after.** A function that reads
  something and does not hand it back forces its caller to read it again.
- **BOTH SCREENS ARE LABELED NOW**, which is what made the line above a
  measurement rather than a claim. #224 is the sweep across every other unlabeled
  screen; labeling the two this issue changes is what lets it show a before and an
  after at all. `/invoices` measured 6 operations before and 11 after — the strip
  costs five, none of them per row. **Four of the repeats in that 11 are two
  reconciliation walks touching the same tables with different id sets**
  (`getInvoiceDeliveryStatus` for the invoices, `getDeliveryInvoicing` for the
  deliveries), which is not a re-read of the same records and is not what #193
  removes; merging the two walks would be its own change.
- **THE EMPTY STATE RENDERS NOTHING**, #176's rule and #216's issue body
  independently. It could not be produced by having nothing to chase — most of this
  base's deliveries are waiting and this repo does not delete records — so it
  was observed with `authz-fixture@`, which is assigned to no job and therefore
  reaches no delivery at all. That is a different route to the same render: the
  component's guard is `rows.length === 0` either way, but "nothing waiting" is
  covered by the offline check rather than by that browser run.

### Reading which invoice carries an excess (#219)

`selectOverageInvoice` sorted every `Invoice Items` row on the over-delivered
ordered item and took the oldest, so an order filled by two deliveries could
attach the wrong vendor invoice to a correction — and since the quotation, its
code and its unit price all come off that invoice, the document that goes out
would be wrong rather than merely uncertain. #210 stored the pairing, so the
candidates narrow to the invoices describing the delivery the excess delivered against.

- **THE HYPOTHESIS THAT OPENED THIS WAS HALF RIGHT, AND MEASURING IT IS WHAT
  CHOSE THE RULE.** The observation was that every over-delivery on the base
  reads `Awaiting invoice` while only some can raise a correction, and the
  proposed cause was that the eligibility was being granted by ANOTHER
  delivery's invoice — the two judgments looking at different levels, one
  delivery-scoped and one PO-Item-scoped. **The level claim is right and the
  mechanism is not.** Measured over every over-delivery row on the base by
  calling `getDeliveryInvoicing` and `getOverageContext` as the screens call
  them: the eligible ones all quoted an invoice that names **no delivery at
  all**, and **none quoted another delivery's invoice**. The wrong-delivery pick is
  reachable in code and unreachable on this base — no ordered item under an
  over-delivery row carries two invoices, and the few invoices that do name a
  delivery touch none of those ordered items. So
  `spansInvoices` and the `inferred` marker had never fired here either.
- **WHICH IS WHY THE NARROWING IS TIERED RATHER THAN ABSOLUTE.** Taking the
  issue body literally — candidates are the invoices naming this delivery, full
  stop — was measured first: **eligibility went to 0**, because pairing is
  optional and few of this base's invoices carry one. That is
  not a data artifact to wait out. #210's own reasoning is that an invoice
  naming no delivery is the ORDINARY state, since the vendor emails the invoice at
  delivery, so a strict rule makes a site-work affordance wait on office work
  that has not happened. **An empty pairing is the absence of evidence, not
  evidence of a wrong delivery.** So: an invoice naming another delivery is never a
  candidate, an invoice naming this one always is, invoices naming none are the
  fallback, and the tiers are never mixed — a recorded pairing must not lose to
  an unrecorded one under an ordering. Measured after: the same 2 rows stay
  eligible, 0 pick another delivery's invoice, and both now carry the marker they
  did not before.
- **THE FALLBACK TIER CHOOSES BETWEEN NOTHING, WHICH IS WHERE THE TWO TIERS PART
  COMPANY.** The first version of this reused the oldest-first ordering in both,
  and that was wrong in a way worth writing down. In the PAIRED tier the ordering
  is a **tie-break over narrow ignorance**: both candidates are recorded as
  describing this delivery, so the only open question is which of the two the
  excess sits in, the marker says so, and the worst case is a coin landing the
  other way between two documents that both belong here. In the FALLBACK tier
  nothing records that either invoice describes this delivery, so an ordering is not
  a tie-break but a **choice with nothing behind it** — decided in practice by a
  human-entered, backdatable `Issue Date` (#164's property) — and what comes out
  of the choice is the file, the vendor code and the unit price on a purchase
  order that goes to a vendor. So **two or more unpaired candidates are refused**
  (`several-unpaired-bills`). That is `spans-invoices`'s own posture: one refuses
  because a request takes one quotation, this one because nothing records which
  quotation it would be.
  - **Exactly one unpaired candidate still proceeds**, since there is nothing to
    choose between and no arbitrariness to hide, and the marker says nobody has
    placed that invoice on this delivery. **No ordering is applied in that tier at
    all** — the count decides — and `offline/overage.mjs` asserts the ordering is
    called from exactly one tier, because the difference is invisible at one
    candidate and symmetry between the two is what a later tidy-up would restore.
  - Measured: **not reachable on this base.** Both eligible rows have exactly one
    unpaired candidate, so the refusal changes no verdict here and #217's strip
    keeps its shape. What stays open in that tier is the single unpaired invoice
    turning out to belong to another delivery — narrowed to the same order,
    material and vendor, and ANNOUNCED, which is the marker's own job and #166's
    rule that a fact is stated and the verdict left to a person.
- **THE MARKER COMES OFF WHEN THE PAIRING ANSWERS, WHICH IS THE QUESTION THE
  ISSUE ASKED.** One invoice naming this delivery is a lookup, not a guess, so
  there is nothing to qualify. The fallback tier stays inferred **at its one
  candidate**, because that invoice is only the one nobody happened to pair — and
  at two it does not infer, it refuses, per the bullet above. So one premise
  became two (`OVERAGE_INFERRED`), and they are keys rather
  than a boolean for the reason `OVERAGE_BLOCKED` already gives — a reworded
  message fails nothing. Both sentences share one message key, since they are
  two readings of one qualifier rather than two qualifiers, the arrangement
  `noLongerOverDelivered` already uses.
- **THE `spans-invoices` REFUSAL SPLIT IN TWO BECAUSE IT WAS FALSE FOR HALF ITS
  CASES.** It said "so it spans more than one invoice" whenever the excess
  exceeded the oldest invoice — including when the ordered item carried exactly one
  invoice, where nothing spans anything. That was reachable before this issue and
  is a lie about the data, not a wording preference. Now: more than one
  candidate on this delivery keeps `spans-invoices` and its quotation argument
  (one request takes one quotation); a single candidate says the excess is
  larger than what this delivery's invoice charges. **Two more refusals join them**,
  and every one of the three new ones exists because a message that already
  existed would have been false in its place: `other-delivery-only`, where invoices
  exist and every one names a different delivery, since `no-invoice` would have
  said nothing charges the ordered item; and `several-unpaired-bills` per the tier
  bullet above. Both name an action the reader can actually take, because
  attaching the pairing is this delivery's own Edit page (#210 opened that path to
  the same Job scope). Neither promises the correction then becomes available —
  the newly named invoice still has to carry a file and cover the excess.
- **THE ORDERING MOVED AND DID NOT STAY EXPORTED, WHICH RETIRES #182'S
  EXCEPTION RATHER THAN RELOCATING IT.** `sortInvoicesOldestFirst` and
  `INFERRED_PREMISE` were #166's, kept in `lib/deliveryStatus.js` after #210
  deleted the only reader there, and pinned offline so a dead-export sweep could
  not take them. The ordering is needed still — one delivery can carry two invoices
  for one ordered item — so it lives in `lib/overage.js` beside its one caller
  and is **private**, and its whole reasoning (the backdatable `Issue Date`, the
  `Invoice ID` tie-break, the undated invoice sorting last) moved with it. The
  premise constant is simply gone: a constant exists to keep two things in step
  and #210 removed the second thing. `offline/delivery-status.mjs` now asserts
  the absence, with an anti-vacuity that its sort matcher still sees
  `sortLongestWaitingFirst`.
- **THE CALLER OBLIGATION IS THE HAZARD HERE, AND THE FIRST CHECK FOR IT HAD A
  HOLE.** A `selectOverageInvoice` call that forgets the delivery does not throw —
  it falls to the fallback tier, which is the honest answer for a row naming no
  delivery and the WRONG one for a forgetful caller. It cannot refuse on a null
  instead, because null is a legitimate value. So the pin is an AST assertion
  that every call site passes `deliveryRecordId` — and the first version asserted
  it only of `selectOverageInvoice` calls, which a mutation then passed: the apply
  path hands the delivery to `splitInvoiceItemForOverage` first, whose own
  shorthand property survives the outer call dropping it. Both names are
  asserted now, and the mutation fails as it should. **The apply step matters
  most of the three call sites** — it splits the invoice item, so picking a
  different invoice from the one the preview quoted would move a quantity the
  request never mentioned.
- **THE NARROWING COSTS NO QUERY.** `invoicesByOrderedItem` already reads the
  invoices for their `Issue Date` and their file, so which delivery each names
  comes off records it holds; the row's own delivery is on the `Delivery Items`
  row every caller already has. Flattened through
  `lib/deliveryInvoiceLink.js:linkedDelivery` rather than indexed a second time,
  so #210's single-record rule keeps one home — asserted offline.
- **Not in this issue:** the pairing itself is still set by hand from the
  delivery side, and nothing here writes it; a correction whose draft quantity is
  edited after the fact is still #206's unreachable second shape; and what a
  fully unpaired base should do about the fallback tier's residual is a question
  for whoever measures pairing coverage once the app is in use.

### Over-deliveries with no correction (#217)

A strip above `/prs` listing every over-delivered `Delivery Items` row that no
live correction covers, longest wait first, each row raising the correction
itself. The third of three strips built to the shape #176 set, and the one that
settles what those three actually share.

- **IT IS ON `/prs`, AND WHO CAN ACT IS WHY — the mirror of #176's argument.**
  That issue put its strip on `/pos` because `generatePOAction` is
  `withAdminAction` and the office works from that screen. This action is
  `requireUser` plus the delivery's own job scope, and a correction IS a purchase
  request raised by the site staff who record deliveries, so it belongs where they
  work. The two strips together are the symmetry #176's commit message predicted.
- **THE ACTION IS ON THE ROW BECAUSE THAT IS WHAT THE ACTION TAKES.**
  `createOverageDraftAction` takes one `Delivery Items` record id, and one purchase
  order can carry several ordered items each with its own excess, so neither the
  order nor the delivery is a unit that can raise anything. Same test as #176 (its
  retry takes one PR, so its row is a PR) and as #216 (nothing there takes a
  delivery, so it has no action at all). **Where the action attaches is decided by
  the action's own argument, not by the strip's layout.**
- **AND IT IS `OverageButton`, THE DELIVERY DETAIL'S OWN COMPONENT, UNCHANGED.**
  One action, one preview: the modal names the invoice, the unit price and the file
  the quotation is taken from, and a bare button on a list would create a request
  without the reader ever seeing them. A second implementation would also be a
  second place for the inferred marker to explain itself differently, which is what
  #166 needed an assertion to prevent — so `inferredLabel` moved into
  `lib/overage.js` and both screens call it.
- **ONE VOICE, AND THE CONDITION IS NARROWER THAN #216 LEFT IT.** That issue's rule
  was "two voices when the strip carries an action". This strip carries one and
  still needs a single voice, because everyone who can see a row can press its
  button: the rows are gated by `canAccessJobDeliveries` and the action
  re-authorizes on exactly that. So the real condition is **"can some readers not
  take it"** — #176's action was Admin-only, which is what forced its second voice.
  The copy may therefore name the control, which #216's was barred from doing.
- **THE SELECTION RULE WAS HALF-WRITTEN ALREADY, WHICH IS #216's LESSON APPLIED.**
  `awaitsOverageRequest` is `overDelivered` and `overagePRState === "none"` — the
  complement of two refusals `overageEligibility` already returns
  (`notOverDelivered`, `alreadyRaised`). So it is a composition in
  `lib/overage.js` beside them rather than a fresh predicate in the screen's view
  module, which is what #176 did and what #216 said not to repeat. It inherits both
  reopening clauses for free: a withdrawn correction and a withdrawn overage order
  both put the row back on the list with no write anywhere.
- **A BLOCKED ROW IS LISTED WITH A CHIP, NOT ITS SENTENCE, AND NOT IN A SECOND
  LIST.** The issue asks for ineligible excesses to appear with their reason, and
  the shortest refusal runs to 130 characters — not a row at 832px. So
  `OVERAGE_COPY.strip.reason` is a chip per refusal, which is
  `STATUS_COPY.column`'s density argument applied a second time; the sentences stay
  on the delivery detail, where there is room. One list rather than two, because
  the reader's question is "what still needs correcting" and splitting would make
  them scan twice for one answer. The offline check asserts a chip for every
  refusal the strip can show **and none for the two the selection excludes**, over
  the whole key set rather than a list written twice.
- **ORDERED BY `Received Date` ASCENDING, AND UNLIKE #176 A REAL DATE EXISTS.**
  That issue had no approval instant and approximated with `PR ID`; this row's
  parent delivery carries both `Received Date` and `Created At`, measured present on
  all six of this base's rows. `sortLongestWaitingFirst` is reused unchanged, so the
  same delivery sits in the same position on `/deliveries`, on #216's strip and on
  this one. `Created At` — when the excess was RECORDED rather than when it landed —
  was the alternative and the two orderings differ on this base; the delivery date
  wins because the excess is a fact about the delivery.
  - **Two rows of one delivery would tie on both dates**, since a `Delivery Items`
    row carries no date of its own and one delivery can exceed two ordered items. The
    rows are therefore fed in `Delivery Item ID` order and `Array#sort` is stable,
    which makes the ordering total without inventing a third key on a function
    #216 also calls. Not reachable on this base — six rows, six deliveries.
- **THE REDIRECT DID NOT NEED CHANGING, WHICH RETIRES #176's DEFERRAL.** That issue
  left `generatePOAction`'s redirect alone and said the decision was worth having
  all three strips in hand for. Now it is, and the rule that falls out is: **an
  action that CREATES redirects to what it created; an action that REPAIRS
  redirects to the record it repaired.** `createOverageDraftAction` goes to
  `/prs/new?draft=…`, the draft it just made, which is the next step for a reader
  who pressed it on the delivery detail and for one who pressed it here — and it
  stays on `/prs`'s own screen family. Neither action needs per-caller behavior, so
  neither gets any.
- **THE STRIP'S ROWS ARE GATED BY THE DELIVERY RULE, NOT THE PAGE'S — measured
  with the numbers #216 could only claim.** The table is purchase requests under
  `canViewPR`; these rows are deliveries under `canAccessJobDeliveries`. On one load
  each: `soo@` sees 6 strip rows and **53** table rows, `scoped-fixture@` sees the
  same 6 strip rows and **40**. The rules can diverge on the strip side too —
  `canViewPR` admits a requester, a signer and a correction recipient with no job
  assignment — but on this base they agree on all six rows, because every excess
  here is on the one job the non-Admin fixture is assigned to. The decisive reason
  to use the delivery rule is not the divergence: it is that the ACTION
  re-authorizes on it, so any other gate would render a button the action refuses.
- **THE WALK IS ONE READ FOR THE WHOLE PAGE, AND FINDING THAT COST 14 OPERATIONS
  MEASURED.** `getOverageContext` took one delivery's rows, so a strip calling it
  per delivery measured **38 operations** for this base's six rows against **19**
  called once — the per-row shape #193 exists to remove. Rows may span deliveries
  now (`deliveryIds` is a Map the caller supplies, since every caller already holds
  the deliveries and the human id is needed only for copy). Of the 19, **14 were the
  signer chain and none of the 14 was the data**: `getSignersByPR` re-`find()`s a
  request the function already holds to reach a reverse-link `recordToPR` already
  carries, and `getActiveUsers()` read the whole Users table once per request — six
  reads of one table in one render. Both collapse to one batched read each.
  - **So the rule that picks the signers is pure now** (`selectCopyableSigners` in
    `lib/overage.js`), shared by the batched read and the write path, which fetch
    differently and judge identically. It sorts by `Sequence Order` because the
    batched reader cannot: a read by record id returns the ids' order. A comment
    claimed `getSignersByPR` promises no order, which was false — it sorts and says
    so.
  - **`/prs` measured 8 operations before and 17 after**, with the label it already
    carried; the strip is 9 of those and none of the 9 scales with rows. A viewer
    with no assigned jobs pays **nothing at all** — the walk returns before its
    first query — measured as a 5-operation render for `authz-fixture@`. Two of the
    five repeats are `Purchase Requests` and `Users` read twice with different id
    sets, which is the same honest kind #216 recorded for `/invoices` rather than a
    re-read of the same records.
- **THE DELIVERY DETAIL'S ALREADY-COVERED MESSAGE NAMES A STAGE AND LINKS THE
  REQUEST.** It said "X already covers this excess." and stopped, which answers the
  wrong question: a reader who finds an excess covered is deciding whether to WAIT,
  and a draft nobody submitted, a request with its signers, and an order already
  generated are three different answers. `overageStageKey` picks the voice as a
  **copy-only refinement** of `overagePRState` — that function collapses `Draft` and
  `In Review` deliberately and keeps its deny-by-default posture, so an unrecognized
  status still reads as pending and takes the in-review voice, which tells the
  reader to wait rather than to go nudge a draft nobody submitted. A fourth
  stageless voice keeps #167's sentence for a caller that supplies none.
  - **The message arrives in parts (`prefix`, `prId`, `suffix`) so the id can be a
    link** without copy learning JSX: the delivery detail composes them, the Server
    Action keeps returning the flattened `text` as its refusal string, and the
    offline check asserts the two cannot drift. Only that one message carries a
    `prId`, asserted over every refusal, so a later message cannot become a link
    without someone deciding it should.
  - **Not observable on this base**, which carries no live correction at all: the
    stage voices and the link are covered offline only. Producing one would mean
    pressing the button and leaving a permanent request behind, which was weighed
    and declined.
- **`signersDropped: 0` WAS FORCED ON THE DELIVERY DETAIL AND IS NOT ANY MORE.**
  The override made the one message that reports a dropped signer unreachable on the
  only screen that shows the preview, while the walk paid to compute the count.
  Nothing visible changed on this base — the count is 0 on all six rows and
  `signersEmpty` is true only on rows whose refusal is the single message they show
  — so this is asserted offline rather than observed.
- **Not in this issue:** no shared strip component, deliberately; what the three
  strips share and what differed every time is in this issue's commit message, as
  the input to that decision. The pre-existing per-requester `getUserByRecordId`
  loop on `/prs` (4 of the page's 8 original operations, and 3 of its repeats) is
  untouched — it is #193's shape and predates this strip.

### Computing the pairing (#231)

`Invoices."Delivery"` was only ever filled by hand. Both documents already name
ordered items, and one invoice sits inside one delivery, so an invoice charging only
ordered items a delivery brought is a candidate for it — computed at both entry
points, because either document can arrive first. `lib/deliveryInvoiceMatch.js`
is the rule and its copy; `lib/deliveryInvoiceCandidates.js` grew the second
gated read.

- **THE SEARCH FOR A PRIOR DECISION CAME BACK EMPTY, AND THAT IS RECORDED
  BECAUSE THE NEAREST THING LOOKS LIKE ONE.** Nothing in this repository has
  weighed or rejected set containment as a way of FINDING the pairing —
  CLAUDE.md, every file under `docs/notes/`, every commit body, every issue body
  and comment, and the comments under `lib/` and `app/` were searched. #166's
  `CONTAINMENT_PREMISE` is the near miss: it says one invoice lies inside one
  delivery, and it was used to justify an oldest-first QUANTITY fill. It is a
  premise about scope, never a proposal to match on the sets. #219's "the pairing
  itself is still set by hand" is an acknowledgment rather than a rejection, and
  #216's three measurements rejected PREFILLING `/invoices/new` from a delivery,
  which is a different question again.
- **MEASURED BEFORE IT WAS BUILT, ON ONE READ OF THE BASE.** For each unpaired
  invoice, how many deliveries contain its ordered items: **0 for 6, exactly 1 for
  7, and 2 or more for none** (13 unpaired invoices, 2026-08-13). From the other
  end, over all 15 deliveries: 8, 7, 0. So the rule answers, and on this base it
  never has to refuse for ambiguity. The 6 zeroes are data rather than strictness
  — 2 are the hand-entered invoices whose rows name no ordered item at all, and 4
  charge orders nothing has delivered yet.
  - **The pool is unpaired invoices against ALL deliveries**, not against unpaired
    deliveries. The link is n:1, so a delivery already carrying one invoice can carry
    another; the issue body's "unpaired deliveries" would have dropped exactly the
    legitimate second invoice.
  - **The shape that would produce a 2 existed here** — `HYE-PO-20260804-04-001`
    and `HYE-PO-20260730-02-002` were each filled by two deliveries — so the zero
    was a fact about the invoices of the day rather than a property of the rule.
- **THE UNIT PRICE GATE CHANGES NOTHING ON THIS BASE, AND IS IN ANYWAY.** One
  invoice departs from an agreed price (`HYE-INV-260716-02`, 32.00 invoiced against
  33.89 ordered on `HYE-PO-20260716-02-001`) and containment already excludes it,
  so the gate removes **no candidate pair at all**. It is `checkUnitPriceVariance`
  from `lib/variance.js` — the repo's existing comparison, absolute 0.01 — rather
  than a second tolerance. `Invoice Items.Variance Flag` was NOT reused as the
  test: it is set for a unit-price variance OR an over-invoiced quantity, and
  quantity must not reach this rule. Being unreachable on live data, the gate is
  asserted offline or nowhere.
- **QUANTITY IS NOT PART OF THE TEST.** A vendor invoicing 13 and shipping 10 is the
  discrepancy #210's mismatch marker exists to show, and matching on quantity
  would drop such an invoice from consideration so that no marker ever appeared.
  Measured: `HYE-INV-260804-07` invoiced 13 against a delivery of 10 and paired.
- **THE RIVAL CLAUSE, WHICH THE MEASUREMENT FOUND AND THE ISSUE BODY DID NOT
  HAVE.** Running the rule with this base's two hand-made pairings removed puts
  BOTH `HYE-INV-260804-05` and `HYE-INV-260804-04` on `HYE-DL-260804-06`: each
  sees exactly one candidate, so "several candidates, attach nothing" never fires
  — the ambiguity is on the other side of the relation. That is #166's scenario D,
  the case #210 exists to get right (one ordered item of 30, two invoices of 15, one
  delivery of 15), so the rule as stated would have quietly undone it. An invoice is
  therefore not a candidate when another invoice charging the same ordered item
  stands in its way. With it: 6 attach, 2 blocked, 7 have no candidate.
  - **A rival is not itself tested for containment**, and the wider rule is
    deliberate: testing it needs the rival's ordered items priced, and a price the
    module cannot answer for would then fail closed the wrong way — an unknown
    rival would stop blocking and the pairing would be made. Measured, both widths
    attach the same 6 and block the same pair, so the width costs nothing
    observable here.
  - **A `held &&` null guard was removed rather than kept.** It was left over from
    an earlier, narrower rival rule and could not change an answer under this one;
    the offline check that claimed to pin it was vacuous, and a mutation is what
    showed both.
- **THEN THE CLAUSE SPLIT IN TWO, BECAUSE AN INVOICE ALREADY ON THE DELIVERY IS NOT AN
  AMBIGUITY — IT IS AN OCCUPANT.** The first version treated "another invoice charges
  this ordered item" as one fact whether or not that invoice was already attached
  here, and the two are different. If 15 arrived and an attached invoice charges all
  15, a second invoice charging that ordered item is not the one we cannot tell apart:
  it cannot fit. So capacity is computed — what the delivery brought of an ordered
  item, less what the invoices already on it charge for that ordered item — and a
  candidate needing an ordered item with nothing left is refused as `no-room`.
  `shared-order` narrows to what it always meant: two invoices NOBODY has placed.
  - **IT IS NOT THE QUANTITY MATCH THIS RULE REFUSES TO MAKE, and the test is which
    two figures meet.** Matching on quantity asks whether THIS invoice's quantity
    equals what the delivery brought, which would drop the invoices #210's mismatch
    marker exists for. Capacity asks whether the delivery's room for that ordered
    item has been spoken for by SOMEBODY ELSE. So the comparison is `> 0` and never
    `>= invoiced`: 13 invoiced against 10 delivered with nothing attached leaves 10 of
    room and pairs, and 13 invoiced with 4 already claimed leaves 6 and still pairs.
    Pinned offline, and a mutation to `>= invoiced` fails three checks.
  - **IT IS ARITHMETIC, SO IT IS SILENT.** `no-room` is a refusal key that never
    becomes an outcome — there is nothing for a reader to resolve, and the state it
    produces is the ordinary unpaired one. Only `shared-order` speaks.
  - **THE MESSAGE COULD NOT HAVE STAYED TRUE OTHERWISE.** `shared-order` says
    nothing records which invoice this delivery answers; with one of the two already
    attached, something does. The split is what let that sentence keep meaning what
    it says, and the wording now names the condition — `nobody has attached`.
  - **MEASURED, AND IT MOVES NO PAIRING ON THIS BASE.** 6 attach under either
    rule. What changes is one message: `HYE-INV-260804-04` was being told the app
    could not choose and is now silent, because `HYE-DL-260804-06` brought 15 and
    `HYE-INV-260804-05` claims all 15 — room 0. The case #210 exists for is
    untouched: with both invoices unplaced the room is 15 and `shared-order` fires for
    both, exactly as before. **A pairing WOULD be added where an attached invoice
    claims only part of what was delivered**, which is unreachable here — both pairings
    on this base claim 100% of what was delivered.
  - **THE DATA WAS ALREADY IN HAND, in both directions.** `getDeliveriesForInvoice`
    already reads the delivery's `Delivery Items` for their ordered items, so their
    `Qty` is free; the invoice pool's `Invoice Items` were already read for the same
    reason, so their `Qty` is free too. The entry form takes the delivery's
    quantities from `planDelivery`'s own rows. **Zero additional operations**, and
    on the entry path capacity is always full — nothing can be attached to a
    delivery that does not exist yet.
- **AND THEN A THIRD TIME, FOR THE PAIR NOTHING TELLS APART.** What was left of
  `shared-order` still covered two invoices charging the same ordered item in the SAME
  quantity at the SAME price, and there the refusal has nothing to hand a reader:
  attaching either one leaves the delivery with the same room and gives either invoice
  the same #210 mismatch marker, so no figure this app computes comes out
  differently for the two choices. One is attached. **This is #166's own scenario D
  — an ordered item of 30, two invoices of 15, one delivery of 15 — which #210 and the
  first two versions of this rule all refused**, so it is a decision reversed rather
  than a case nobody had considered.
  - **WHICH ONE IS ARBITRARY, AND THE ORDER SAYS SO.** `Invoice ID`, because it is
    on the option already and any total order would do. Deliberately NOT #166's
    oldest-invoice-first: that ordering asserts the earlier invoice has the better title,
    which is the assertion this case exists to say cannot be made.
  - **#219 IS NOT THE PRECEDENT IT LOOKS LIKE, and the citation was corrected on
    the way in.** Its tie-break sits in the tier where both candidates ALREADY name
    this delivery, so the pairing records what it is choosing between; in its own
    fallback tier — where neither is recorded, which is exactly this case — #219
    refuses too. What licenses attaching here is that the consequences are
    identical, not that somebody else broke a tie.
  - **A DIFFERENT QUANTITY IS OBSERVED, SO IT STILL REFUSES.** Invoices of 10 and 5
    against a delivery of 15 leave 5 or 10 of room depending on which is attached,
    and the marker moves with them. Narrowing THAT with a quantity test would be
    the forbidden comparison wearing a tie-break's clothes: `room >= invoiced` is the
    same comparison that would drop 13 invoiced against 10 delivered, and it would
    have the app perform the very inference the marker exists to make visible. The
    two cases differ in what they are about — a tie is two documents for ONE
    delivery, `several` is two physically different deliveries — and a wrong
    attachment of the second kind is not corrected by any later measurement.
  - **IT IS SAID OUT LOUD, BECAUSE THE TWO DOCUMENTS ARE NOT THE SAME DOCUMENT.**
    The rows match; the file and the vendor's own invoice code do not, and those
    are what a person reconciles against. So a tie-broken attachment carries a
    sentence naming what it was chosen over — a QUALIFIER (`PAIRING_COPY.tieBreak`)
    rather than an outcome, in the shape #166 gave its own marker: it composes with
    `matched` and `several-attached` instead of doubling them. The preview names
    both invoices, because the recorder is holding the packing list; the banner names
    neither, because it arrives as a flag on a query string.
  - **THE FOLD CAME BACK WITH IT, WHICH IS THE COST.** Two tied invoices are not
    disjoint, so a decision has to count against the room before the next invoice is
    judged, or a delivery of 15 takes both invoices of 15. `planPairings` folds each
    attachment into the pool as attached to this delivery again, and takes the pool
    in `Invoice ID` order rather than the caller's — among tied invoices the pass
    really does choose, so the choice must not be the caller's array order. The
    disjointness assertion left behind when the fold was removed is what would have
    caught its absence, and a mutation confirms it does.
  - **ROOM DECIDES HOW MANY, EXACTLY AS FOR ANY OTHER INVOICE.** Two tied invoices of 15
    against a delivery of 30 both attach and nothing is said, because nothing was
    passed over; against a delivery of 15 one attaches and the other is refused as
    `no-room`. So the tie-break is reported from what the pass LEFT unattached
    rather than from what it saw, which is the difference between a choice and a
    coincidence.
  - **Unreachable on this base**, for the same reason `shared-order` is: both pairs
    that share an ordered item have one invoice attached already, so capacity answers
    before a tie can be found. Asserted offline, with mutations covering the rival
    clause, the fold, the fold-without-deducting, the pool order, and each figure in
    the signature.
- **`price-departs` SPLIT OFF `price-unknown` IN THE SAME PASS, AND THE REASON IS A
  SENTENCE THAT IS NOT YET WRITTEN.** One key covered both "the invoiced price is not
  the agreed one" and "no price could be compared at all", and the second is not a
  departure — it is a caller handing over an incomplete map, which is a defect in
  this repo rather than something a vendor did. Both fail closed and both are
  silent, so nothing on a screen moves today; what the split protects is the
  sentence `price-departs` will need when there is somewhere to say one. **The new
  key is unreachable and that is not evidence of anything**: both callers build
  `agreedPrices` from the very ordered items they then test against, containment is
  decided first, and `PO Items."Unit Price"` is a frozen snapshot that is never
  blank.
- **ONE PREDICATE, TWO DIRECTIONS.** `pairingRefusal` decides one (invoice, delivery)
  pair and both entry points call it, so whether a pairing gets made cannot depend
  on which document was typed in first. **The ARITY differs and the judgment does
  not**: a delivery attaches every invoice its ordered items place on it, while a
  invoice attaches to at most one delivery, because the link is n:1 and says so.
  Every pair either direction makes passes the same predicate.
  - **THE ENTRY FORM'S INVOICE CONTROL IS GONE, AND THAT IS WHAT MADE THE ARITY A
    PROPERTY OF THE RULE RATHER THAN OF A WIDGET.** #210 put an invoice picker
    there on the premise that a packing list carries an invoice number; this app's
    plan never said so — only the PO number was ever described as printed on that
    document. While the computed answer preselected that one-value control, two
    candidate invoices meant two values in one field and NOTHING was attached, which
    left a shape that never converged: two invoices charging different ordered items
    from one delivery are each individually unambiguous, so no later invoice would
    ever fire direction 2 and the pair stayed for a person permanently. Removing
    the control removed the shape.
  - **The override went with it**, and its removal simplified the rule rather than
    narrowing it: `planPairings` lost `transcribed`, `createDeliveryAction` lost
    its `invoiceRecordId` field and its `checkInvoicePairing` guard, and every
    link the entry path writes is now computed. `LINK_COPY.field` lost `label` and
    `transcribed`, which that control was the only reader of.
  - **The manual path is untouched.** #210's edit page is the surface that is
    about the delivery RECORD rather than about the packing list, and it is
    already plural: it lists every attached invoice and offers the rest one at a
    time, which is where a computed pairing that is wrong gets corrected.
  - **Unreachable on this base:** no delivery holds two unpaired contained invoices,
    sharing an ordered item or not — 0 pairs either way, measured 2026-08-13. The
    precondition is here though, so it is one record away rather than
    hypothetical: several deliveries brought more than one ordered item, and
    `HYE-DL-260804-10` has one of its two invoiced by `HYE-INV-260804-08` and the
    other invoiced by nobody. One invoice for `HYE-PO-20260804-14-001` produces it.
- **THE RIVAL POOL NEEDS NO UNSCOPED READ, and the derivation is load-bearing.** A
  rival shares an ordered item with a candidate, a candidate's ordered items all
  lie inside the delivery, a delivery sits on one Job, and `canViewPR` clause 4
  admits anyone assigned to it — so the scoped list `getInvoiceLinkCandidates`
  already returns IS the rival pool, and a refusal may name what it blocks on. The
  PR behind it cannot be a `Draft` either, since ordered items exist only after PO
  generation.
- **THE DELIVERY SIDE PREVIEWS; THE INVOICE SIDE REPORTS AFTERWARDS.** Both
  attach — only the moment of telling differs, and it differs because the delivery
  form already holds both halves of the comparison while the invoice form holds
  neither. Buying a preview there would mean reading the whole delivery axis on a
  screen where the answer is usually nothing: an invoice normally arrives before
  its material, and most unpaired invoices here have no candidate at all. So
  the delivery form states what the action is about to do, in `describePlan`'s
  posture, and the invoice's own page says it once on the way in from creation,
  from a KEY on the query string rather than a sentence.
  - **THE MESSAGE NAMES A CONTROL THE READER CAN REACH, and all three preview
    sentences stopped doing so when the invoice control was removed and they were
    not.** They sent a recorder to a checkbox that is no longer on the screen —
    #206's rule broken by a deletion rather than by a decision. They name the
    delivery's own page now, which is where the plural picker lives and the only
    place a computed pairing can be changed.
  - **The tie-break's second parameter is not the count this voice refuses to
    carry.** `paired` stays a key; `tied=1` is a bare flag beside it. The objection
    to sending a count was that a reader cannot act on two differently from three;
    this is a fact they act on by opening the delivery, and folding it into the
    outcome key would make one key report both what happened and how it was
    decided.
- **`none` SAYS NOTHING, ON EITHER SCREEN.** An unpaired invoice is this feature's
  ordinary state — what #216's strip lists and what `Awaiting delivery` says — so
  announcing it would report the normal case as an event. Unlike an allocation,
  where an unattached row belongs to no ordered item at all, nothing is lost by
  staying quiet. It is also why no parameter is sent for it.
- **THE INVOICE SIDE'S WRITE IS OUTSIDE THE ROLLBACK**, unlike #210's. There a
  recorder typed a number off the packing list and dropping it would discard what
  they said; nothing was said here, so a failure to work the answer out must not
  undo an invoice the office entered — `lib/materialsCache.js`'s posture, and
  #167's about not undoing the approval that produced it. What a failure leaves is
  an unpaired invoice.
- **THE RULE NEVER JUDGES A PAIRING THAT EXISTS**, and the one on the base it
  disagreed with was already marked. `HYE-INV-260804-03` was hand-paired to
  `HYE-DL-260804-05` and the rule computed no candidate for it, because it invoiced 7
  of `166-DEMO Tee` that the delivery did not bring. Measured: that invoice
  carries #210's mismatch marker, which fires on the same fact. A second signal
  would be one fact rendered twice — #166's reason for taking `beyond order` off
  `/invoices` — and it would invert #210's thesis that the pairing is a fact
  somebody knows rather than one the app guesses.
- **WHAT THE RULE CANNOT REACH, stated because it is the boundary rather than a
  bug:** an invoice charging for an item that did not arrive at all is never paired,
  so its mismatch never surfaces. The quantity axis survives (13 invoiced against 10
  delivered still pairs); the item axis does not.
- **COST, MEASURED.** `/deliveries/new` is **11 operations** for an Admin and 11
  for `scoped-fixture@`, the Invoice Items read this issue makes unconditional
  being one of them — it was fetched only for a non-privileged viewer before,
  because it existed to answer the row gate. The invoice side's pairing read is
  **1 operation when nothing has been delivered on the invoiced orders**, which is the
  ordinary case, and **7** when something has. Neither grows with row count.
  `/invoices/new` and `createInvoiceAction` are labeled here, which #193's own
  comment asked for by name; #224 remains the sweep.
  - **`createDeliveryAction` IS LABELED TOO, BECAUSE THIS ISSUE MADE IT READ
    SOMETHING IT DID NOT READ BEFORE.** It was a write path that read only what it
    was about to record; the computed pairing added `getInvoiceLinkCandidates` to
    it, and an unlabeled action has no before and after — which is the lesson #217
    took from labeling the signing chain and finding that 14 of its operations were
    not data. **The read it gained measures 3 operations for an Admin and 5 for a
    Job-scoped viewer**, all batched `list` calls that do not grow with row count;
    the two extra are `canViewPR`'s walk through `Purchase Orders` and `Purchase
    Requests`, which the office short-circuits. The ACTION'S TOTAL is not measured:
    the form requires a packing list photo and the browser tooling cannot fill a
    file input, so reaching it means posting to the Server Action the way
    `verify-invoice-pairing-231.mjs` does, which is a second credentialed script
    and this issue did not write one.
- **THE INVOICE SIDE IS EXERCISED END TO END, THROUGH THE REAL ACTION.** The
  browser tooling cannot fill a file input, so the half of this feature that
  WRITES had no execution at all — and it is the half with a partial-failure mode,
  which is the worse one to leave to a pure check.
  `scripts/tests/verify-invoice-pairing-231.mjs` posts to `createInvoiceAction`
  the way a browser with no JavaScript does: React's `useActionState` renders
  `$ACTION_REF_n`, `$ACTION_n:0`, `$ACTION_n:1` and `$ACTION_KEY` into the form,
  and a multipart POST carrying those four plus the ordinary fields reaches
  `createInvoiceAction(null, formData)` through the whole pipeline — the guard, the
  creates, the variance pass, the pairing, the redirect. **Rebuilding the handler's
  steps in a script was rejected**: the ordering and the write's position outside
  the rollback are what needed executing, so a script that re-implemented them
  would have tested itself.
  - **The action id is read from the live page, not from a manifest.** Measured:
    `.next/server/server-reference-manifest.json` and the running dev server give
    different ids for the same export (`7f66b7ec…` against `7fe526d5…`), so the
    built one would have addressed nothing.
  - **Measured, on the target chosen to make the outcome unambiguous.**
    `HYE-DL-260804-09` brought one ordered item, nothing invoiced it and no other
    invoice charges it, so `matched` is the only outcome the rule can reach there. The
    run: the redirect carried `paired=matched`, `Invoices."Delivery"` named the
    delivery, and the delivery's own `Invoices` named the invoice.
  - **The residue check is about the DELIVERY, not about the fixture.** A stored
    link is the one thing this feature writes to a record it does not own, so
    "the invoice is deleted" and "the delivery is unchanged" are different claims.
    The run detaches through the production write first, then deletes, then re-reads
    the delivery: 0 invoices before, 0 after, 4 records deleted, no residue in any
    bucket, and the Blob object removed. 14 operations in the script itself.
  - **One `Auth Tokens` row is spent and left**, rather than deleted as tidying-up.
    It is single-use and reads `Used: true`, so it is inert.
- **Not in this issue:** an invoice edited after creation does not recompute its
  pairing; `several`, `shared-order` and the tie-break are all unreachable on this
  base and are asserted offline only — every ordered item here carrying two invoices
  has one of them attached, so capacity answers before ambiguity can; and the
  invoice side's three failure points are stated in
  `lib/deliveryInvoiceMatch.js`'s header rather than exercised — all three leave
  the same state, an invoice naming no delivery, which is the ordinary one.
  - **A REFUSAL IS NEVER SAID ON A SCREEN THAT DID NOT COMPUTE IT, and that leaves
    two facts unsaid.** An invoice whose price departs from the agreed one, and an invoice
    charging an ordered item no delivery brought, are both simply unpaired
    wherever a reader meets them afterwards. Saying either on the invoice detail
    means that page running `planPairings`, which it does not: it is a new read on
    a screen #210 got down to 3 operations, plus new copy and a decision about
    where it renders — and `not-contained` mixes "not yet" with "never", which the
    key alone cannot separate. **The tie-break is the same shape**: it is spoken at
    the moment of telling and nowhere afterwards, because whether a pairing was
    tie-broken is not stored and recomputing it on a later render means reading the
    vendor's other invoices and their `Invoice Items`. All three are one piece of
    work, and it is bigger than this issue.

### Scoping the box to its invoice (#232)

The invoice detail's delivery section described the ORDERED ITEM while sitting on a
page about one invoice. `Billed` was the `Invoiced Qty` rollup across every invoice,
`Delivered` every delivery on the order, and the list under each box held every
delivery that had touched that ordered item. Redrawn so that every figure a box
carries is this invoice's, the delivery it matches is stated once, and the one thing
that stays the order's says so by name.

- **THE FRAME WAS HONEST UNTIL #210 AND THE MARKER IS WHAT SHOWED IT WAS NOT.** With
  no pairing stored, which delivery answered an invoice was unknowable, so the ordered
  item's context was the most that could truthfully be shown. #210 stored the pairing
  and hung `— attached to this invoice` on the existing frame without revisiting it —
  a marker that distinguishes one entry from the others in a list, on a screen where
  **all 9 boxes on this base that listed any delivery listed exactly one** (measured
  2026-08-14, #231). A marker with nothing to mark is the tell that the list it sat in
  was answering somebody else's question.
- **`HYE-INV-260804-04` WAS THE CASE, AND IT WAS FIXED RATHER THAN DESCRIBED.** Before:
  `Billed 30 EA` while the invoice charged 15, `HYE-DL-260804-06` listed although that
  was `HYE-INV-260804-05`'s delivery, and `Nothing delivered yet` under both. After:
  no figures, no delivery listed, no verdict, and `No delivery has been matched to
  this invoice yet.` once at the top. The box is its item name alone, that ordered
  item having nothing to report. Rendered as `soo@` and as `scoped-fixture@`.
- **THE DELIVERY MOVED OUT OF THE BOX BECAUSE THE LINK IS SINGLE.**
  `Invoices."Delivery"` holds one record, so naming it per box printed one document
  once per invoice item — the repetition #233 had just removed from the order's page,
  where an invoice header fact was rendered once per row it charged. What genuinely
  differs box to box is how much of that delivery answered THAT ordered item, and that
  is the `Delivered` figure. The marker retired with the move rather than moving: a
  document named directly under this invoice's own heading is this invoice's
  structurally, which is #166's own argument for putting the deliveries inside the
  boxes, applied one level up.
- **THE DELIVERY IS NAMED WITHOUT ITS ORDERED ITEMS.** It can carry charges this invoice
  has nothing to do with, so listing what it brought would show orders this invoice
  never charged. #233 recorded the mirror of this from the other side and found that
  only half of it transfers: naming the ordered items of THIS order on the order's own
  page is inside its frame by construction, while a document's own total is not.
- **WHERE THE NARROWING STOPS IS "WHAT AN INVOICE CAN BE THE SUBJECT OF".** `Billed` and
  `Delivered` have invoice-scoped answers and took them; `ordered` does not, there
  being no such thing as what one invoice ordered. The first pass kept it, moved onto
  `Against the order:` and rendered unconditionally, on the ground that it was then
  the box's only order-scoped statement and its label was load-bearing. **THE SECOND
  PASS TOOK IT OUT, AND BOTH HALVES OF THAT ARGUMENT FELL AT ONCE.** Once a box that
  agrees is silent there are no figures to anchor and no scope confusion to prevent —
  the line appears only when something exceeds, and when it appears it is the only
  thing there. And the `N ordered` term answered "how much of this ordered item was
  ordered", which `/pos/[poId]` answers in its `Qty` column, one click away and since
  #233 on a page that names this invoice. **The label was also false**: the figure it
  compares against is one `PO Items` row's `Qty`, never the order's total, so it reads
  `Against the ordered item:` per #227's rule.
- **NEITHER BEYOND-ORDER FACT WAS NARROWED, AND THE TWO REASONS DIFFER.**
  `invoicedBeyondOrder` has no honest per-invoice form: two invoices of 20 against an order
  of 30 leave every invoice reading clean while the order is over-billed by 10, so
  scoping it would delete the fact rather than rescope it — and it is the fact #167
  and #219 act on. `deliveredBeyondOrder` COULD be narrowed to the matched delivery for
  nothing, since the slices are already read, and must not be: the two terms share one
  line, and two scopes on one line is the defect this issue removes one level up.
- **`This bill:` WENT AND ITS PREDICATE WENT WITH IT.** The line existed only to
  caption a `Billed` that was the ordered item's; scoping that figure removes the
  premise, and `sharesOrderedItem` then had no caller. Deleted rather than left
  standing, with the absence pinned in `offline/delivery-status.mjs`. **What it said is
  not lost from the app**: "another invoice charges this ordered item" is the order's fact
  and #233 put it on the order's page. Its removal frees the name for
  `lib/deliveryInvoiceMatch.js:chargesSameOrderedItem`, whose docstring explained the
  collision and is now a note about history rather than a distinction being drawn.
- **THE VERDICT IS WITHHELD WHERE NO DELIVERY IS MATCHED, WHICH IS A DISTINCTION #210
  CREATED.** "Nothing has been matched to this invoice" and "the matched delivery brought
  none of this ordered item" are different facts since the pairing was stored, and
  `Nothing delivered yet` asserted the second while only the first was known. The first
  has ONE answer for the whole invoice, so the section states it once and
  `describeInvoiceLine` returns a null verdict for a judged box; `hasDelivery` comes
  from the caller because a share with `delivered: 0` cannot tell the two apart. A
  `not-compared` box kept its verdict either way, being a fact about the invoice item
  rather than about any delivery — **#278 removed that box** with the invoice item behind
  it, so nothing speaks without a matched delivery now and the exception is gone. On
  `HYE-INV-260804-02` both shapes were once on one page: a judged box with no verdict
  beside a free-text box that had one.
- **AND A BOX THAT AGREES IS SILENT TOO, WHICH IS THE SAME ARGUMENT AT FULL STRENGTH.**
  The first pass left `Billed 15 · Delivered 15` and `All billed material delivered` on
  every box of a normal invoice — correct figures, correct verdict, and identical on
  every box, because under the one-delivery premise "everything invoiced was delivered"
  is a fact about the INVOICE. Stating it per item states one fact as many times as the
  invoice has items, which is the repetition #233 took off the order's page and #232
  took off this one, one level further down each time. So `all-delivered` has no copy
  branch at all — the judgment survives, `describeInvoiceLine` reads it to decide there
  is nothing to say — the figures line went entirely, and what remains on a normal box
  is the item name. **THE INVOICE LEVEL SAYS WHAT THE STATE IS, THE ITEM LEVEL POINTS
  AT AN EXCEPTION**, and that division is what the rest of this section follows from.
- **THE TWO SURVIVING VERDICTS ARE WORDED AS DISCREPANCIES, AND `yet` HAS ONE HOME.**
  Under the premise nothing further is coming: what an invoice charges either delivered against
  the delivery it matches or was never shipped, so a shortfall is an event to take up
  with the vendor rather than a stage on the way to complete. `Nothing delivered yet`
  therefore became `40 EA invoiced, none of it delivered by the matched delivery`, and
  `3 EA more invoiced than delivered` became `3 EA more invoiced than the matched delivery
  delivered`. Both take `MISMATCH_REASON` as their reference vocabulary, both name what
  they compare against, and both carry their figures — which reverses the old rule that
  a verdict states no quantity, since the figures line that rule pointed at is gone.
  The one honest `yet` on this screen is the section's own empty state, where the
  material may still arrive or the delivery may still be recorded.
- **THE DISCREPANCY IS THE CHIP'S THIRD VALUE, AND THE MARKER IS RETIRED ON BOTH
  INVOICE SCREENS.** The second pass put #166's marker beside the detail's chip, to
  close a real gap — the chip is shared so a row and the page it leads to cannot
  describe one invoice differently, and the marker beside it was not, so
  `HYE-INV-260804-03` was marked on `/invoices` and unqualified on its own page.
  Opening it showed the fix was too quiet: the cell read `Delivered` with a small `!`
  after it, so the normal word came first and the one that mattered was behind a
  hover. **This is money — a reader has to stop paying and call somebody — and the
  tone has to say so before the word `Delivered` does.** `Mismatch` is a chip value
  now, `summarizeInvoiceStatus` returns it as the key, and the `mismatch` BOOLEAN is
  gone with it: the key carries the distinction, so keeping both would be two
  representations of one fact — the same call that function already made on
  `anyArrived`. Every screen asks `summary.key === "mismatch"`.
- **IT DOES NOT REOPEN WHAT #210 CLOSED, and the test is stage against error.** That
  issue removed `partly-delivered` because it read as progress toward a whole while
  the fact it named was a vendor shipping less than it invoiced, which under the premise
  cannot be a middle. The argument bars a STAGE word. `Mismatch` is not on the way to
  anything, so the rule stands and goes on barring exactly what it was written to bar
  — asserted both ways in `offline/delivery-status.mjs`, which now requires the stage
  word to be absent from this axis and present on the PO axis.
- **AND THE MARKER'S OWN ARGUMENT TURNED OUT NOT TO HOLD HERE.** #166 made a
  discrepancy a marker because it composes with any chip value and would double a
  closed set. It composed with exactly ONE value: a mismatch needs a delivery matched,
  so it could only ever qualify `Delivered`. Two values became three, not four. The
  other half — that the marker's sentence is its tooltip and its accessible name at
  once — is what made the shape wrong rather than merely unnecessary, since a tooltip
  reaches neither touch nor a keyboard. `QualifierMarker` keeps one caller, #167's
  inferred attribution, which is a guess; that is what a qualifier is for, and the
  component is named for its shape rather than either meaning, so it needs no rename.
- **ITS OWN TONE, NOT `partial`'s.** They would be the same amber, and on the delivery
  axis `partial` is `Partly invoiced` — a stage — so one color would mean a stage on
  one list and an error on the other, which is the property `DeliveryStatusMarks`
  exists to hold still. Red is what this page already gives a discrepancy between two
  figures (`⚠ Header Variance`), while amber there is the PROMPT that asks a person to
  look. So the chip states the discrepancy in red and the box below asks in amber —
  the split those two already had.
- **THE DETAIL SAYS IT IN A SENTENCE WITH SOMETHING TO DO, IN AN AMBER BOX SHAPED LIKE
  THE VARIANCE PROMPT.** `⚠ This invoice has variance flags — review before confirming
  payment.` sits further down the same page and is the same grade of fact: a person
  must look before money moves. So `STATUS_COPY.detail.mismatch` gets the same shape
  rather than a new kind of alarm, and a reader who has learned one has learned both.
  **It carries no figure**, which is the division of labor this issue settled: one
  invoice can be short on two ordered items carrying different Units, so a figure at
  invoice scope would be a sum of nothing or one of several. The entries below carry
  one each. **BELOW THE DELIVERY, NOT ABOVE IT** — the sentence says the invoice charges
  more than the delivery matched to it delivered, so the reader meets the subject
  first; and the section's first line stays the same line in all three states, which
  makes the box read as an addition rather than as a different layout. The check that
  used to assert there was NO detail-density twin now asserts the twin's contents,
  since the reason for its absence was that every box stated the shortfall itself.
- **NO BORDER ON AN ENTRY.** The border was drawn around `Ordered · Invoiced ·
  Delivered`, a share line, a verdict, an aside and a delivery list. With the inside
  emptied it framed a name, and a bordered box holding one word reads as a card that
  failed to load. A list is enough.
- **NO ITEM LIST AT ALL WITHOUT A MATCHED DELIVERY.** This section compares what an
  invoice charges against what one delivery brought; with nothing matched there is no
  second term, so an entry per invoice item was a list of names with no fact in any of
  them. The sentence above is the whole answer. It named `Not compared — no ordered
  item` as going with them, since it said why an invoice item was left out of a
  comparison that is not happening; that sentence is gone at every pairing (#278).
  **What this costs is one line, and it is a line the app still has.**
  `Against the ordered item: 3 EA more invoiced` used to render on an unmatched invoice
  — `HYE-INV-260804-07` was the case — and the second pass justified keeping it on the
  ground that the figure was visible on no other screen. **That was wrong**: #233 gave
  `/pos/[poId]` an `Invoiced` column with a red `(over)` mark, so
  `HYE-PO-20260804-11` read `Qty 10` and `Invoiced 13 (over)`. Verified on that
  page rather than assumed. The invoicing excess is one click away, beside the quantity
  it exceeds, which is a better place for it than a delivery section on an invoice nothing
  has been matched to.
- **SO THE SECTION'S DENSITY FOLLOWS ITS STATE.** Matched to nothing: one sentence.
  Matched and covered: the delivery, then item names. Matched and short: the chip in
  red, the delivery, the amber box, then item names with the short ones carrying their
  figures. Three shapes for three states, and no state renders a row whose every cell
  would be the same as its neighbor's.
- **THE ENTRY'S PO LINK IS GONE ENTIRELY, WHICH MOVES #167's ARGUMENT TO #237.** The
  second pass kept it where the invoice spans more than one order; that is reversed.
  #167 put the link here because the items table dropped its `PO` column — a row an
  overage split produced spans two orders once folded, so the cell had no single value
  — and this section was the nearest place with one order per entry. It is the wrong
  place on two counts: which order an item was invoiced against is not a delivery fact,
  and it is not one a reader of THIS screen acts on, since nothing about whether to pay
  turns on it. **#237 TOOK THE QUESTION**, under `Purchase Orders` on the same page,
  answered only where the folded items do not all touch the same set of orders — which
  is where the ambiguity #167 was solving actually lives, and where the order's own
  page answers it from the other side since #233. **Recorded because the next reader's
  first instinct will be to restore the items table's `PO` column**: that column is
  still impossible for the reason #167 gave, and the answer is #237's list, not a cell.
  `poRecordId` left the reconciliation row with the link — #237 inherits nothing from
  that walk, reading `Invoice Items."PO"` off the items the page already holds.
- **`matched` IS #231's WORD AND IS NOT A NEW ONE.** `PAIRING_COPY`'s banner already
  says the delivery below was matched from the ordered items the invoice charges, so the
  empty state uses it rather than coining a second word for one fact — the drift #179
  exists to remove. The chip above it still reads `Awaiting delivery`, which is the
  invoice-level word #210 chose and is unchanged here.
- **`nothing-delivered` SURVIVED THE NARROWING, AND WHETHER IT IS REACHABLE IS TWO
  QUESTIONS.** Through the app's own pairing it is NOT: `fitRefusal`'s `notContained`
  requires the delivery to bring every ordered item the invoice charges, and
  `roomOnOrderedItem` refuses a pair with no room, so a computed pairing has
  `arrived > 0` on every judged ordered item. Through the data it plainly was —
  `HYE-INV-260804-03` invoiced `166-DEMO Elbow` 5 on `HYE-PO-20260804-07` and
  `166-DEMO Tee` 7 on `HYE-PO-20260804-08`, and the delivery matched to it,
  `HYE-DL-260804-05`, held one `Delivery Items` row: the Elbow. So the Tee's box
  reported `7 EA invoiced, none of it delivered by the matched delivery` while the
  Elbow's said nothing. That pairing predates the computed rule and `notContained` would refuse
  it today, which is precisely why the row is KEPT rather than repaired: it is the only
  way to see this branch on a screen. An invoice of 0 reaches it too, by the clamp. So the
  key stays, and the distinction between "unreachable in code" and "absent from this
  base" is written down rather than collapsed into one word.
- **THE READ THAT SHRANK AND THE READ THAT DID NOT, both measured.** Level 3 was every
  delivery that had touched the ordered items; it is the one the invoice matches, read
  off the invoice's own link. Level 2 still reads every slice on those ordered items,
  because `deliveredBeyondOrder` stays order-scoped and only the rows carry
  `Over Delivered`. Measured read-only on this base with the `_selectRecords` /
  `_findRecordById` instrument, before then after: `HYE-INV-260804-05` (matched)
  3 -> 3, `HYE-INV-260804-03` (matched, two ordered items) 3 -> 3, `HYE-INV-260804-04`
  (matched to nothing, ordered item touched by another invoice's delivery) **3 -> 2**,
  `HYE-INV-260804-02` (matched to nothing, ordered item with no deliveries) 1 -> 1,
  `HYE-INV-260727-03` (every invoice item free text) 0 -> 0. The saving lands only
  where level 3 had something to read, and **that one operation is what keeping the
  order-scoped fact costs** — narrowing it too would take an unmatched invoice to 1.
- **THE PAGE IS LABELED NOW (`/invoices/[invoiceId]`).** It was one of the last read
  surfaces without one, which is why the figures above are the WALK's rather than the
  page's: an unlabeled screen has no before and after, and #216's duplicate read on
  `/deliveries` stood invisible for exactly as long as that page carried no label.

### Naming the order behind an item (#237)

The invoice detail listed the orders it charges and never said which of them any one item
was invoiced against. The items table cannot hold the answer (#167) and the delivery
section is no longer a place for it (#232), so it hangs under `Purchase Orders`, and
only where the folded items disagree about which orders they touch. The rule, the
per-order quantity and the copy are `lib/invoiceOrderBreakdown.js`.

- **THE QUESTION LOST ITS HOME TWICE, AND THE SECOND TIME WAS THIS ISSUE'S CAUSE.**
  #167 dropped the `PO` column because a row an overage split produced spans two orders
  once folded — unrepresentable in one cell rather than merely awkward — and put the
  order on the delivery section's per-item boxes, which had exactly one each. #232 then
  emptied those boxes: which order an item was invoiced against is not a delivery fact,
  and it is not one a reader deciding whether to pay acts on. **The column is still
  impossible for #167's own reason**, which is the first instinct to head off here: the
  answer is a LIST under an order, not a cell beside an item.
- **THE UNIT OF JUDGMENT IS THE FOLDED ITEM, because that is the unit the reader sees.**
  The items table renders folded rows, so a rule stated over raw rows would turn the
  list on for an invoice whose table shows one item per order. `foldInvoiceItems` needed
  no change to supply it: its `rowIds` already state which raw rows are one item, and
  the new module joins them back to the invoice items the page holds. What the fold
  cannot supply is the order — its key is `Material` + unit price and excludes the
  order on purpose, which is the same fact that makes the column impossible.
- **THE SAME-SET TEST NEEDS NO CASE FOR A CORRECTIVE ORDER, WHICH IS THE POINT OF
  STATING IT AS A SET.** One order gives every item `{A}`; a correction that split every
  item gives every item `{A, B}`; both agree, so both are silent. An invoice carrying two
  orders because of a correction is the ordinary reason to carry two, and a list there
  would repeat one answer once per item — the repetition #233 took off the order's page
  and #232 took off this one. The list appears for `{A}` beside `{B}`, and for `{A, B}`
  beside `{A}`, which are the shapes where the reader genuinely cannot tell.
- **THE EXCLUSION KEYS ON `PO Item` AND NOT ON `PO`, AND KEYING IT ON THE ORDER LINK
  WOULD EXCLUDE NOTHING.** A free-text invoice item is not a row without an order —
  `createInvoiceAction` refuses an item with no `PO` (`app/invoices/new/actions.js`) and
  only `PO Item` is optional — so what it lacks is the ordered item. It names no order,
  is in no order's list, and **is out of the decision too**: one such row would otherwise
  make the sets differ and turn the list on for every invoice that has one. It was
  untestable in a browser because only hand-entered rows had no ordered item, and
  since #278 it is untestable because no row can: the read is a crash guard on a
  hand-emptied link now, not a rule about a kind of charge.
- **AN ORDER REACHED ONLY THROUGH SUCH A ROW KEEPS ITS ROW WITH NOTHING UNDER IT.** The
  section's own list is every item's `PO`, free-text ones included, and is untouched by
  this issue — so the order is listed, correctly, and the empty space under it is the
  answer rather than a gap. A `No order` bucket was the alternative and was rejected: it
  asserts a heading for something that is not an order.
- **A LINE CARRIES THE QUANTITY AND NO MONEY, WHICH IS #232's JUDGMENT ABOUT
  `Amount Due` ONE LEVEL DOWN.** Unit price is part of the fold key, so both products of
  a split share it by construction — a price per order would print one number twice in
  exactly the shape this list exists for — and the items table above already carries it
  once per folded row. A per-order amount would be a partial sum of this invoice's total
  sitting beside a purchase order, inviting the addition `poDocuments.js` refuses from
  the other side and #167's `invoiceCaveat` exists because of. **The quantity is the one
  fact the table above cannot hold**: its `Qty` is the folded total, and the split is
  what the reader came for.
- **ONE GRAMMAR WITH `/pos/[poId]`, AND THE PRICE'S ABSENCE IS PART OF IT RATHER THAN AN
  EXCEPTION TO IT.** #233 nests an invoice item under the invoice that made it; this nests an
  item under the order it was invoiced against — parent row for the document's identity
  and its own facts, child list at `pl-4` in smaller gray text for the pair facts. The
  line's syntax is `PO_DOCUMENTS_COPY.deliveries.brought`'s (`Item Size — qty UNIT`)
  rather than `invoices.charge`'s, so the price travels with whether the frame can see it
  elsewhere: on the order's page the invoiced price is the pair fact the order cares about
  and no items table is present, and here it is directly above.
- **THE ITEM NAME COMES FROM THE INVOICE ITEM, NOT FROM THE ORDERED ITEM, WHICH IS THE
  OPPOSITE SOURCE FROM `lib/poDocuments.js`.** Deliberate, and stated in the new module's
  header so nobody unifies them: the frame here is one invoice and the items table is
  directly above, so a name disagreeing with the row above it would be the defect; on the
  order's page the subject IS the `PO Items` row. It also costs nothing — the frozen
  copies are on records the page already holds.
- **THE SECTION STAYS ABOVE THE ITEMS TABLE.** These names therefore precede the table
  they mirror, which is the one thing to say for moving it; not moved, because the list
  appears only in the ambiguous case, its subject is the order rather than the items, and
  redrawing the page's section order is not what was asked for. Written down so the
  position reads as a decision rather than an accident.
- **NO NEW READ, and the reason is structural rather than measured.** Every fact the list
  needs is already on the page: an Invoice Item carries its own `PO`, `PO Item`, `Qty`,
  `Unit` and frozen names, the fold is already computed for the table, and the order
  records are the ones this section already renders. No credentialed function gained a
  call site, so the count cannot move.
- **`poById` WENT WITH THE SECTION IT SERVED.** #232 removed the per-entry PO link from
  the delivery section and left the lookup it fed standing, unread — eslint does not flag
  it under this config, and it sat in the middle of the block this issue rewrites. Deleted
  here rather than filed.
- **THE SILENT SIDE IS ON THE BASE NOW, MADE BY A SEED RATHER THAN BY HAND**
  (`scripts/demo/seed_order_breakdown_237.mjs`). Before it, the only two-order invoice
  here was `HYE-INV-260804-03`, where each item touches one order — so the LISTED half
  had been seen on a screen and the silent half had not, which is backwards: a
  correction is the overwhelmingly common reason a real invoice carries two orders.
  `HYE-INV-260817-01` was that case: `HYE-PO-20260817-01` and `-02` both named, no
  item list under either. `HYE-INV-260817-02` was its pair on the listed side,
  `HYE-PO-20260817-03` and `-04` with a line each.
- **AN ORDER WITH NO CHILD ROW IS NOT SEEDED, AND THAT IS A DECISION RATHER THAN A
  GAP.** It needs an invoice item with no `PO Item`, which the form could not make and
  which #278 made unwritable outright — free-text charges were built, dropped, and
  finally removed, so neither the state nor the path stands. A seed exists to put a reachable state in front of a
  person; seeding one the app cannot produce would assert the opposite. **The exclusion
  is still required defensively** and `offline/invoice-order-breakdown.mjs` is the only
  thing holding it, on both halves separately — such a row stays OUT OF THE JUDGMENT
  (read off an invoice that must stay silent) and lands UNDER NO ORDER (read off one
  that must stay listed) — each shown to fail under a mutant that keys the exclusion on
  `PO` rather than `PO Item`, which is the plausible mistake because a free-text row
  does carry an order link. One such row was seeded on `HYE-INV-260817-02` and then
  retired, its `Amount Due` corrected from 184 to 144 in the same pass; the order it
  charged, `HYE-PO-20260817-05`, was left standing, an order having existed either way.
- **THE CORRECTION SEED GOES THROUGH THE REAL FLOW BECAUSE THE FOLD KEY IS WHAT MAKES
  THE CASE.** Two halves at different prices do not fold, and then each touches one
  order and the list turns ON — the exact inverse of the shape being seeded. Writing
  the end state by hand would be asserting the key; `splitInvoiceItemForOverage`
  carries `invoice.unitPrice` onto the half it creates and takes its name, size and unit
  from the corrective order's ordered item, whose `Material` #18's cache wrote in the
  same PO generation. Verified at the record level: both ordered items behind
  `HYE-INV-260817-01` linked Material `237-DEMO Elbow_2"_EA`, and both invoice items
  were at 12 — which is why one row of 13 appeared in the items table.
- **ONE CORRECTION IS ONE ORDERED ITEM, so the browsable case has ONE folded item
  touching both orders rather than several.** `createOverageDraft` takes a single
  delivery row and raises a single-item request, so two split items would mean two
  corrections and two corrective orders — `{A1,A2}` beside `{A1,A3}`, which DIFFER and
  would turn the list on. The all-items-split-across-the-same-two variant is a shape
  the app cannot reach and is asserted only in `offline/invoice-order-breakdown.mjs`.
- **AN INVOICE ITEM COSTS ONE READ AND SO DOES A DISTINCT ORDER, AND NEITHER IS
  #237's.** What this issue adds is nothing: measured on the labeled route with the
  pre-#237 page restored from git and then re-applied, same session and same invoice,
  `HYE-INV-260817-02` read 11 ops both times with the same per-table breakdown both
  times, and `HYE-INV-260817-01` read 10 both times. **The per-item cost was stated the
  wrong way round when those numbers were first written down**, on the reasoning that
  the items arrive in one list read: they do not. `getLinkedRecords` is 1 + N — one
  `.find()` per child, said out loud in its own header — so `getItemsByInvoice` pays a
  find per invoice item, and the section pays one `getPOByRecordId` per distinct order.
  Retiring one invoice item that was also the only one naming its order took
  `HYE-INV-260817-02` from 11 to 9, with `Invoice Items` finds 3 -> 2 and
  `Purchase Orders` finds 3 -> 2: one each, exactly. What misled the first reading was
  `HYE-INV-260804-03` also totalling 11 on 2 items and 2 orders — two fewer finds there
  are spent on the delivery it matches, so two different sums landed on one number.

### Reading one material as one entry (#241)

The delivery section listed one entry per `Invoice Items` row while the items table
above it folded, so an invoice whose item an overage split divided showed one
material twice under the delivery and once in the table. Folded on the key
`lib/invoiceItemFold.js` already uses, with the shares added rather than re-derived,
and an entry that agrees no longer rendered at all. The rule is
`lib/invoiceDeliveryEntries.js`.

- **#237 REVEALED IT AND DID NOT MAKE IT.** When #232 redrew this section there was no
  split invoice on this base, so every screen it verified had unfolded items and this
  shape never appeared; #237's seed ran the correction flow for real and put
  `HYE-INV-260817-01` in front of a person, where the items table read one row of
  `237-DEMO Elbow 2"` at 13 EA and the section below listed that name twice. Recorded
  because the defect was two issues old by the time anything could see it, which is an
  argument for seeding the shape a rule is about rather than the shape that is handy.
- **THE FOLD IS FOR THE READER AND NEVER FOR THE JUDGMENT, WHICH IS WHY IT IS NOT IN
  THE WALK.** `getInvoiceReconciliation`'s per-row shares are also
  `summarizeInvoiceStatus`'s input, and that summary is the CHIP — shared with
  `/invoices`, where `getInvoiceDeliveryStatus` reads neither `Material` nor a unit
  price and so cannot fold without new queries. Folding inside the walk would either
  move the chip on one screen and not the other, or pay for the fold on a list that
  does not render one. So the walk is untouched but for the join key, the fold stays
  where the page already computes it, and the entries are a view rule with their own
  module — the shape #237 established, joining on the same `rowIds`.
- **A FOLDED ENTRY ADDS ITS MEMBERS' SHARES; IT DOES NOT RE-CLAMP.** `invoiceShareStatus`
  clamps what an invoice can be credited with at what that invoice invoiced, per ordered item,
  because a delivery may legitimately bring more of an ordered item than this invoice
  charges. Clamping once at the folded scope instead — sum the invoiced, sum what
  arrived, `min` — is the tidier-looking rule and is wrong twice: **a surplus on one
  ordered item would cancel a shortfall on another**, which is what the per-pair clamp
  exists to prevent; and **it would disagree with the chip**, which is computed off the
  unfolded shares, leaving the amber sentence standing above a list with nothing in it
  that points anywhere. `SPLIT_CROSSED` in `offline/invoice-delivery-entries.mjs` is
  that case — 10 invoiced against 8 delivered on one ordered item, 3 against 5 on the
  other — and the mutant is built and run there rather than described. It also needs a
  field the row does not carry: the clamp destroys its own input, so re-deriving would
  mean handing the raw delivery down, which is itself part of the answer.
- **THE TWO BEYOND-ORDER TERMS ARE THE EXCEPTION AND ADD OVER DISTINCT ORDERED ITEMS.**
  `invoicedBeyondOrder` and `deliveredBeyondOrder` belong to a `PO Items` row rather than to
  an invoice, so two invoice items reaching one ordered item carry the same figure and adding both
  would print one excess twice. The invoice form cannot make that shape — #91 excludes
  an ordered item a sibling invoice item already claimed — so the dedupe is defensive
  against hand-entered data and is pinned offline, the way #237's exclusion is.
- **THE SUBJECT AGREES IN NUMBER, WHICH IS #227's RULE AND NOT GRAMMAR TIDYING.** An
  entry folded across a correction covers two ordered items and its figures are sums
  over them, so `Against the ordered item:` would name one thing the sentence is not
  about — the same falsity #232 corrected when it retired `Against the order:`. The
  count is the caller's and defaults to one, so every unfolded entry, which is every
  entry on an invoice no correction touched, reads exactly as it did.
- **A SILENT ENTRY LOST ITS PLACE, AND THE FOLD IS WHAT DECIDED IT.** #232 kept a silent
  entry when the list was one per invoice item; folded, the list is the name column of
  the items table directly above — same count, same names, same order — which is the
  repetition #233 took off the order's page and #232 took off this one. This is the last
  cell of that division: **the invoice level says what the state is, the item level
  points at an exception**, and an entry with no exception has nothing to point at. What
  it costs is the per-material delivered quantity on a normal invoice, and that is
  recoverable rather than lost: under the one-delivery premise a `Delivered` chip means
  everything invoiced arrived, so the per-material delivered quantity IS the per-material
  invoiced quantity, which the items table carries. `This invoice has no lines.` went with
  it — an invoice with no items has no exceptions either, and the table above already
  says it is empty.
- **THE NAME NOW COMES FROM THE INVOICE ITEM, WHICH REVERSES WHAT THE WALK DOES.** A row
  was labeled from the `PO Items` row it compares against; a folded entry can span two of
  those, so there is no single one to name — the fact that makes the items table's `PO`
  column impossible (#167). It takes the fold group's frozen copy instead, #237's source,
  so an entry and the row above it cannot disagree. On this base the two agree: both
  ordered items behind `HYE-INV-260817-01` and both invoice items read `237-DEMO Elbow`.
- **A CHARGE WITH NO ORDERED ITEM WAS UNAFFECTED, BY CONSTRUCTION RATHER THAN BY A CASE.**
  `foldKey` gives a row with no `Material` its own record id as a key, so it was a group
  of one; it carried no share and `describeInvoiceLine` spoke for it. One state was
  pinned only in the offline tier — a COVERED invoice carrying such a row, the chip
  reading `Delivered` and a single gray `Not compared — no ordered item` under it — and
  no invoice on this base ever both matched a delivery and held a free-text row, so it
  was never seen on a screen. **#278 removed that item, the entry, the gray tone and
  that fixture**, and applied the test this file states two bullets up: an unreachable
  state is removed rather than documented. `foldKey`'s fallback stays as a crash guard
  on a hand-emptied link.
- **A DIFFERENT KEY FROM #238's, ON PURPOSE.** That issue folds a delivery's own rows on
  `Material` + ORDER, because a folded row there must still name the order the correction
  acts on; this folds on `Material` + UNIT PRICE, because an invoice split across two orders
  is one vendor charge and the order is what the entry cannot name. Same question, two
  frames — do not unify the keys.
- **NO NEW READ, AND IT IS MEASURED RATHER THAN ASSERTED.** Both inputs are already
  computed for the items table, and no credentialed function gained a call site. On the
  labeled route, `HYE-INV-260817-01` read **10 ops before and 10 after**. #237's 10/11/13
  are not the comparison — they predate #249, which made `getLinkedRecords` batched — so
  the before figure was taken on this branch rather than read out of that note.
- **THE ENTRY WEARS ONE COLOR, NAME INCLUDED, AND #232's RULE HERE WAS THE OPPOSITE.**
  That issue colored the verdict alone and left the name black, on the ground that its
  first version colored everything and the color then distinguished nothing. **That
  ground was the list holding every invoice item**: coloring names there would have
  colored the silent ones too, so the color would have marked nothing. Dropping the
  silent entry emptied the premise in the same issue that noticed the symptom — with
  only exceptions listed, a colored name cannot reach a normal item and the color says
  exactly which one is the problem. Read on `HYE-INV-260804-03`, where a black name over
  an amber sentence left the color attached to nothing a reader could name; with several
  short items the two would alternate down the page. **The tone is the verdict's**, and
  it said `not-compared` is gray in both halves, an invoice item nothing was measured
  against being the absence of a problem rather than one. That entry and its gray are
  gone (#278), so the list carries one grade of thing.
  **An entry admitted by the order-scoped aside alone is `exception`**: it has no verdict
  to read a tone off, and something exceeding an ordered item is the whole reason it is
  in a list that holds nothing else. The aside stays uncolored, which is #232's
  distinction between a verdict and a fact about the ordered item and is untouched.
- **THE TONE COMES FROM `lib/deliveryStatus.js`, THE COLOR FROM THE PAGE**, which is the
  split `DeliveryStatusMarks` already states for the chips: "this is a discrepancy" is
  semantic and is decided where the sentence is authored, "which amber" is rendering.
  `ENTRY_TONE_CLASS` is in the page rather than in that component because these are text
  colors on a detail list and the chip map is a closed set of STATES with a background
  each — one map for both would tie a discrepancy in a sentence to the background of a
  chip meaning something else. **Half of #232's argument survives intact and is kept**:
  `describeInvoiceLine` returns named slots rather than a list precisely so a caller
  iterating one collection cannot color the aside, and that is still true — what moved
  is which tone, not whether the page can reach the aside with it.
- **THE GRAY ENTRY WAS NEVER SEEN ON A SCREEN AND IS NOW GONE (#278)**, for the same
  reason the state it belonged to was not: no invoice on this base both matched a
  delivery and carried an invoice item with no ordered item. `offline/invoice-delivery-entries.mjs`
  pinned it with an assertion that the two tones differ; what stands there now is that
  every entry on every fixture is an `exception`, which is the same claim with one
  value instead of two.

### Reading one material as one row (#238)

A delivery that brought more of one material than an order asked for is two
`Delivery Items` rows, and its own page showed them as two — the same name, the same
order, differing only in a tag and a quantity. Folded on the material and the order
together, with the excess stated as a figure rather than a tag. The rule is
`lib/deliveryAllocation.js:groupRowsByItemAndOrder`.

- **THE KEY IS THE MATERIAL AND THE ORDER, AND THE `Order` COLUMN IS WHY.** One
  delivery can fill two orders of one material, so a group folded on the material
  alone has no single value for that cell — the situation #167 met on the invoice's
  items table, where the `PO` column had to go instead. Here the column is what the
  table is for, so the order joins the key. Both halves are visible on one screen:
  `HYE-DL-260804-02` brought `165-DEMO Pipe 2"` 10 against `HYE-PO-20260804-01` and
  10 + 5 against `-02`, so the last two fold and the first does not.
- **A DIFFERENT KEY FROM #241's, AND THE REASONS ARE OPPOSITE.** That issue folds an
  invoice's items on `Material` + UNIT PRICE and excludes the order deliberately,
  because an invoice item split across two orders is one vendor charge and the order is what
  the folded row cannot name. This folds on `Material` + ORDER, because a folded row
  here must still name the order the correction acts on. Same question — when does a
  screen read one material as one line — and the frame decides the answer. Do not
  unify the keys.
- **IT IS A THIRD GROUPING BESIDE `groupRowsByItem`, NOT A REPLACEMENT.** That
  function answers "what was delivered", for the headline and a list row that name no
  order, so an item spanning three orders is one line there and stays one. The two
  live side by side under the same header for the reason that header gives — the
  collapse is one place rather than one per screen — and the difference between them
  is the column the caller has to fill.
- **THE `Over-delivered` TAG WENT AND A FIGURE TOOK ITS PLACE.** Before the fold the
  flagged row WAS the excess, so a tag on it was exact; a folded row holds the within
  piece and the excess together, so the same tag would say the whole quantity was
  beyond the order. `15 EA (5 over)` says which part. `(over)` is this base's own word
  — `/pos/[poId]`'s `Delivered` column prints `13 (over)` for the same fact one frame
  up — and the quantity is what the fold adds to it. **The word does not leave the
  page**: the headline item keeps its tag and the banner still reads `Over-delivered —
  5 EA delivered beyond what HYE-PO-20260804-02 ordered.`
- **THE COLOR IS ON THE EXCESS ALONE, WHICH IS #241's RULE AT ITS OTHER HALF.** There
  an entry was wholly an exception, so its name took the tone; here the row is partly
  one, and coloring the total would say the 10 delivered inside the order is a
  problem too. **AMBER FOR ONE DELIVERY'S CONTRIBUTION, RED FOR AN ORDERED ITEM BEING
  OVER, AND THAT IS NOT A DRIFT TO TIDY UP.** On the order's page the red figure says
  an ordered item is over-delivered — the order asked for 10 and holds 13 — which is
  the discrepancy that page prints beside `⚠ Header Variance`. Amber is one delivery's
  contribution, which on this page is every over-delivery word: the headline tag, the
  banner, and the correction box under it. Unifying them would make one color mean
  both "this order is over" and "this delivery brought some excess", which is the
  property `DeliveryStatusMarks` exists to hold still.
  - **THIS SAID "AMBER HERE, RED ON `/pos/[poId]`" UNTIL #266, AND THAT PHRASING WAS
    THE WEAKER READING OF ITS OWN ARGUMENT.** It located the distinction on the PAGE
    when the argument it makes is about SCOPE, and #266 put the amber mark on
    `/pos/[poId]` too — that page now carries both colors, on the two facts named
    above. Corrected rather than left, since the sentence would otherwise read as a
    claim about which color that page gives this mark.
- **THE JUDGMENT IS UNTOUCHED, AND `summarizeDelivery` IS THIS SCREEN'S CHIP.** #241
  kept the fold off the invoice chip because a list row and the page it leads to
  cannot describe one invoice differently; the same shape is here and is wider —
  `summarizeDelivery` and `groupRowsByItem` are read by `/deliveries`, by the awaiting
  strip on `/invoices` and by this page's own headline. The fold reaches none of them,
  and it reaches neither `Over Delivered` nor `describeDelivery`. It regroups rows for
  one table.
- **THE SILENT ROW KEEPS ITS PLACE, WHICH IS WHERE #241 DOES NOT TRANSFER.** That
  issue dropped an entry with nothing to say because its section compares an invoice
  against one delivery, and an item that agrees has nothing to contribute to a
  comparison. This table is not a comparison: it is the record of what this delivery
  brought and what it was allocated against, so a row with no excess is the subject
  rather than an absence of news. Dropping the quiet rows would empty the table on
  every ordinary delivery.
- **`overRowIds` HAS NO READER YET AND IS STILL A LIST.** The correction affordance
  #167 offers is not in this table — it is built from the raw rows and rendered per
  flagged row under the banner — so the fold owes it nothing today. The field exists
  for the move that puts the button on the row it corrects, and it is plural because a
  singular would be wrong: `recomputeOverDelivery` flags every row past the ordered
  quantity, so 6, 6, 6 against an order of 10 leaves a split remainder and a wholly
  flagged row, two flagged rows against one ordered item in one delivery. The offline
  check produces that state with the real function rather than asserting it. Today's
  base has at most one per pair; the code does not, and #182 should read this before
  treating an unread field as dead.
- **`HYE-DL-260817-01` IS THE REGRESSION CASE, NOT THE FIXTURE.** Its `-002` row looks
  like an excess and is not one any more: #237's seed ran the correction to the end,
  and `reattachDeliveryItemToPOItem` moves the row to the corrective order's ordered
  item and clears the flag in the same write. So the delivery holds two rows of one
  material against two orders, and they must NOT fold. Read after this change: two
  rows, `10 EA` and `3 EA`, no excess figure anywhere.
- **NO NEW READ.** The fold is a pure regrouping of rows the page already built, and
  no credentialed function gained a call site. Measured on the labeled route,
  `HYE-DL-260804-02` read **14 ops before and 14 after**.

### Naming the two variance kinds (#179)

An invoice carries two flags that both read `Variance` on screen and are not the
same kind of fact. `Invoices."Variance Flag"` compares the total the vendor wrote
against the sum of the items somebody typed in from the same page;
`Invoice Items."Variance Flag"` compares an item against what the order agreed. The
list said `⚠ Variance` for the first and the detail's items table said it for the
second. The words are `lib/variance.js:VARIANCE_COPY` now, beside the predicates that
set them.

- **`⚠ Order variance` AND `⚠ Check the total`, AND THE TWO GRAMMARS ARE THE
  DISTINCTION.** The charge one is a STATE — the vendor invoiced something other than
  what was settled, an external fact that stays true until somebody takes it up with
  them. The document one is an INSTRUCTION, because it is an internal arithmetic check
  and what it asks for is a second look; no other mark on these screens has that shape,
  which is what stops a reader taking it for a third state. **Neither names a
  direction, and that is measured rather than stylistic**: `checkHeaderVariance` and
  `checkUnitPriceVariance` both compare an absolute difference, so each fires when the
  figure is under as readily as over. `Over-billed` was the issue's first choice for
  the item one and would have been false half the time it appeared.
- **`Mismatch` WAS THE ISSUE'S FIRST CHOICE FOR THE OTHER ONE AND IS NOT AVAILABLE.**
  #232 made it a chip value on the delivery axis of these same two screens, so taking
  it here would put one word on two axes of one page — this issue's own defect, pointed
  the other way.
- **THE FORM'S SENTENCE IS UNTOUCHED, AND THE TENSE IS WHY.** `/invoices/new` already
  says `Vendor's Stated Total (…) doesn't match the calculated total (…) — double-check
  before submitting` (#57). Same verb family on purpose, different moment: the form
  addresses the person still typing the number, and `before submitting` has nothing to
  point at once the record is stored — where the reader may not be the person who
  entered it.
- **NO SENTENCE BESIDE THE CHARGE BADGE, and the stored data is the reason.**
  `createInvoiceAction` sets that flag on `unitPriceVariance || invoicedQty >
  poItem.qty` — a price that differs from the order's, or a quantity invoiced beyond what
  it asked — and the checkbox does not record which fired. Any explanation naming one
  cause would be false whenever the other did. The name carries what can be carried
  (what it was compared against), and the comparison itself is on the order's own page,
  which #233 gave an `Invoiced` column beside the ordered quantity and price.
- **THE AMBER PROMPT IS THE CHARGE KIND'S VOICE ALONE NOW, WHICH CLOSES A BACKLOG
  ITEM.** It fired on either flag and said `variance flags`, so a header variance
  printed the same fact twice on one page — the red box under the totals states it with
  both figures and sits outside the Payment gate, so nothing is lost by narrowing.
  Whether the amber should name the kind or drop what the red box already said was
  recorded as an open copy decision in `backlog.md`; that line is deleted and this is
  where it was settled. **The action changed for the same reason #211 created**: it
  said `review before confirming payment` to readers who cannot pay, and now asks for
  something anyone can do — check the item against the order, or take it up with the
  vendor — with payment as the deadline rather than the act, which is #232's grammar in
  the amber box further up the same page.
- **THE LIST'S BADGE AND ITS COLUMN ARE THE OFFICE'S NOW, AND #211's REASON FOR
  KEEPING THEM WAS A MISIDENTIFICATION.** That issue left the badge for every viewer on
  the ground that it was "invoiced-against-ordered … the reason an employee is on this
  page at all". It is not: the list badge reads `Invoices."Variance Flag"`, the header
  kind, which is an arithmetic check only an Admin can act on since only an Admin can
  edit an invoice. The kind an employee is here to catch has no mark in this list for
  anyone — it is on the invoice's own page, per item, next to the order it disagrees
  with. So the column goes with the payment state it shares a cell with, and an
  employee reads six columns.
  - **BOTH HALVES OF THAT CELL ARE OPEN AGAIN (#309), AND THE BADGE'S OWN REASON DID
    NOT SURVIVE THIS FILE.** Payment opening forced the decision rather than inviting
    it: the badge shares the cell, so the column cannot render for an employee with
    the badge still hidden unless a new privilege flag is introduced for it. Two
    things settled it against keeping one. **First, the same fact is already ungated
    one click away** — the red box under the invoice's totals, stating both figures,
    which the bullet above this one relies on when it narrows the amber prompt
    ("nothing is lost by narrowing"). #179 wanted one kind, one word, on the row a
    reader clicks and the page they land on, and its own gate is what broke that: a
    mark on the row and none on the page is #211's "hides a figure on one screen and
    shows it on another". **Second, "only an Admin can act on it" is not this app's
    test for who may READ a variance** — the item kind is open to every reader under
    the identical constraint, and #179 reworded the amber prompt precisely so that it
    asks for something anybody can do. The alternative cost a fourth inline copy of
    `President || isAdmin` in `app/`, or an extraction of that predicate, neither of
    which #309 authorizes.
- **THE BADGE STACKS UNDER THE PAYMENT WORD, WHICH IS WHAT A RE-CUT WOULD HAVE COST.**
  Measured at 832px before the change: the column is 176px, `Paid 2026-07-27` is 104px
  and `⚠ Variance` was 68px — the pair fitting exactly, which is what the dropped right
  padding bought. `⚠ Check the total` is 102px, so the pair needs 210px. Every other
  column is declared from its own widest content and has 8px or less to give, and
  `Invoice ID` has none, so finding 34px means re-cutting against today's data rather
  than the worst case #166 sized for — the first 17-character vendor name would wrap.
  Stacking costs a second line on an invoice that is both paid and flagged (47px
  against 30px) and nothing else. **The employee row's freed 11rem goes to Vendor**,
  which is #211's own move for the 6rem it freed; both rows still sum to exactly 52rem.
  Re-measured after: 832px, no horizontal scrollbar, every unflagged row one line.
  **#309 EMPTIED THE ARITHMETIC THAT FORCED THE STACK** by taking the date off the
  payment word — `Paid` beside `⚠ Check the total` fits on one line at 176px — and the
  stack is kept anyway, because the reason to unstack it would be to spend width, and
  the width is the design work's to decide. The measurement stands as the record of why
  the pair was ever stacked.
- **THE COPY LIVES WITH THE PREDICATES, AND `PO_DOCUMENTS_COPY` GAVE UP ITS TWO.**
  `lib/variance.js` owns the judgment, so it owns the words — the shape
  `deliveryStatus.js` and `deliveryAllocation.js` already have — and that gets them out
  of JSX, where `offline/line-vocabulary.mjs` cannot see them. The order page's two
  badge strings were a second home for words that are invoice facts, and a word with
  two homes is what this issue removes; `/pos/[poId]` reads the constant directly.
  **No client-bundle hazard**: `lib/variance.js` imports nothing at all, so the one
  Client Component that needs it (`EditInvoiceForm`) reaches no credentialed root —
  the #198 case, where `lib/airtableOps.js` could not be imported from
  `app/login/page.js`, does not arise. Asserted by `offline/client-import-safety.mjs`
  on every run.
- **THE CHECK PINS THE WORDS AND THE ABSENCE OF THE OLD ONES.** Two constants that
  differ, neither a prefix of the other, neither carrying `Mismatch` or a direction,
  the detail sentence leading with the badge's own label — and a scan of every file
  under `app/` for the retired strings, comments excluded, since a call site going back
  to a literal is how the two would drift apart again. `offline/po-documents.mjs` now
  asserts the two keys are GONE from that module rather than asserting their values.
- **NOT MEASURED, DELIBERATELY.** Nothing about this changes what is read: the copy is
  static, the one condition that narrowed (`hasItemVariance`) reads invoice items the
  page already holds, and no credentialed function gained or lost a call site.
- **Not in this issue:** the tolerance the form applies against the one the backend
  applies, which #254 owns — `lib/variance.js`'s three numbers are untouched here.

### One tolerance for the header comparison (#254)

`/invoices/new` warned when the vendor's stated total differed from the sum of what was
typed in, past a cent. The flag stored on the saved record needed five dollars or one
percent, whichever was larger. So an invoice could be warned about on the way in and
then carry no mark at all, which reads as the discrepancy having been resolved rather
than as the app having decided it was small enough to ignore. One rule decides it now,
`lib/variance.js:checkHeaderVariance`, and the figure is **half a cent**.

- **NEITHER NUMBER IN THE CODE HAD BEEN CHOSEN FOR THIS COMPARISON, which is what
  reframed the issue from picking a survivor to making a first choice.** #57's body says
  it outright — `No variance-tolerance decision (#17) needed here — these are
  data-entry-time sanity checks on what's being typed in` — and it took a cent as a
  floating-point epsilon. #17 did choose two shapes, but they were the header against the
  UNIT PRICE, two comparisons on different data; the form's check is nowhere in its
  comment. So a single comparison had acquired two thresholds because two issues each
  answered a question the other believed it was not being asked. Neither was inherited.
- **THE DERIVATION, WHICH IS WHERE THE FIVE DOLLARS DIED.** `Amount Due` is a total
  someone copied off the vendor's paper; `Calculated Total` is
  `SUM(Items Subtotal, Shipping Fee, Tariff, Sales Tax)` over figures copied off the same
  paper. Two transcriptions of one document are not measurements, so the noise #17's
  comment names — `normal rounding accumulation and minor line-item aggregation noise` —
  can only come from the vendor rounding its own printed amounts while we recompute
  `{Qty} * {Unit Price}`. That is at most half a cent per item, so the accumulation is
  `N × $0.005`: five cents at ten charges, ten at twenty, and **five dollars at a
  thousand charges all rounding the same direction**. Measured on this base the largest
  invoice carries three charges and the median carries one, and the count is structurally
  bounded by the ordered items of the orders an invoice charges, since #91 gives one
  ordered item to one invoice item. The floor was three orders of magnitude away from its own
  mechanism.
- **AND THERE IS NO PER-CHARGE ROUNDING ON OUR SIDE AT ALL**, which takes the bound
  further down than the table above. A whole quantity at a whole-cent price is exact to
  the cent, so both sides of the comparison are whole numbers of cents and any real
  difference is at least one. What remains is the binary representation error of summing
  them — about 1e-11 dollars on a hundred-thousand-dollar invoice. **Half a cent is the
  interval's own name**: five hundred thousand times above the slop, one unit below the
  smallest difference the currency can express. A cent would go silent on a genuine cent,
  which is what #57's figure would have done had it been adopted rather than derived to.
- **THE REPOSITORY HAD ALREADY WRITTEN THE ANSWER DOWN, in the one place that actually
  ran the comparison.** `scripts/tests/verify-variance-15.mjs` reads `Amount Due` against
  `Calculated Total` on the live base and compares them with `const CENT = 0.005`, whose
  comment gives the same reason in the same words. The shipped rule was `max($5, 1%)` and
  its own credentialed verification used half a cent, and that disagreement was green for
  as long as #254 was open.
- **THE PERCENTAGE TERM WAS PROPORTIONAL TO THE WRONG QUANTITY.** One percent of a
  fifty-thousand-dollar invoice is five hundred dollars, so a missing four-hundred-dollar
  charge was silent — the larger the invoice, the larger the error that hid, which is the
  wrong direction for a mark whose whole purpose is to be acted on. And the mechanism it
  claimed to absorb scales with how many items there are, not with what they come to: a
  fifty-thousand-dollar invoice can be one item.
- **#283 IS THE COUNTEREXAMPLE TO ANY DOLLAR FLOOR, and it is sharper than a floor
  hiding small errors.** A term the app has no column for makes `Calculated Total` short
  by exactly that term's value, which is unbounded downward — a small freight surcharge,
  a pallet charge, sales tax on a small invoice. The smallest invoices on this base are
  $120–$180 and a state sales tax there is $5–$15, so a five-dollar floor swallows the
  small end of precisely the class #283 was raised to expose, and it swallows a larger
  FRACTION of a smaller invoice: $5 is 4.2% of $120. A cent-scale threshold is not
  reachable by that argument, since no missing column is worth a cent.
- **WHAT THE FORM PASSES, AND WHY THE SHARED THING IS THE TOLERANCE AND NEVER THE
  INPUTS.** The form computes `calculatedTotal` from what was typed and always will:
  there is no rollup in a browser, and `offline/invoice-money-terms.mjs` asserts on that
  declaration by name because a term missing from it reads low. The backend re-reads
  Airtable's `Calculated Total` after the items are linked. The two cannot always see
  the same number — a coercion maps a typed `0` to null, and a rollup is not a
  client-side reduce — so the form asserts only that **the two figures on the screen
  right now disagree by more than the rule allows**, and never that the saved record will
  carry the mark. `calculatedTotal` is the same binding the `Calculated total:` label
  renders, so the warning and the figure a reader is comparing against cannot come apart.
- **THE PREMISE WAS RESTING ON NOTHING, AND ESTABLISHING IT IS PART OF THE ISSUE.**
  Half a cent needs both sides to be whole numbers of cents, and three separate things
  were assumed to hold that. None does, and all three were measured. **Airtable's
  `precision` is a DISPLAY option** — writing 2.5 into the precision-0 `Qty` field and
  1.005 into the 2-decimal `Unit Price` stored both verbatim, and `Amount` came back as
  `2.5124999999999997`. **The value the actions read is a hidden `itemsJson`**, not the
  controls, so nothing declared on a control could gate it. **And the controls' own
  validation does not fire**: the quantity input declares no `step` and the price input
  declares `step="0.01"`, yet on this form `2.5` and `1.005` both report
  `checkValidity() === true` and the form submits — while a detached
  `<input type="number">` DOES report `stepMismatch` for 2.5, so the absent attribute is
  not the cause and the shape of the form is. The judgment is
  `lib/variance.js:isWholeQty` / `isWholeCentPrice`, beside the tolerance it is the
  premise for. The price test carries 1e-9 of slack rather than comparing exactly,
  because a whole-cent value need not be exactly representable in binary: 8.11 is not,
  and an exact test rejects prices the rule is meant to admit.
- **SO IT IS REFUSED AT TWO LEVELS, AND THE SECOND ONE WAS ADDED BECAUSE THE FIRST
  DRAFT GOT THIS WRONG.** That draft paired the guard with no message, on the ground
  that no form could produce the state — the reasoning #278 uses to decide when a
  service-layer throw stands alone. The measurement above refutes it: a person can type
  `2.5` into the quantity box and press the button. Without a refusal the throw reached
  them as `Something went wrong creating the invoice. Please try again.`, on an input
  they could have corrected and would have retried unchanged — which is the shape #232
  and #278 both argue against, a reader refused where they cannot see why. So both
  invoice actions ask the predicate and return `ITEM_PRECISION_COPY`, and
  `lib/airtable/invoiceItems.js` keeps the throw as the last line for a request that
  never went through a control. **The lesson is not about `step`**: it is that a claim
  about what a form cannot produce is a measurement, and this one was written as an
  inference.
- **`PO Items` AND `PR Items` ARE NOT GUARDED, AND THE CHAIN IS WORTH NAMING BECAUSE
  ONE HALF OF IT REALLY DOES FLOW IN.** `PO Items."Unit Price"` is copied into an invoice item
  in three places on the form — `defaultedItem`, `updatePoItemSelection` and
  `handleCancelUnitPriceEdit` — and the PR form's own `step="0.01"` is behind the same
  hidden-JSON submit, so `PR Items` → `PO Items` → `Invoice Items` is open for a price
  the whole way. `Qty` is not copied at all; an item's quantity is typed. The guard is
  still a funnel because it sits DOWNSTREAM of the copy: a price that arrives from an
  ordered item still passes through it. What changes is only the failure mode, from a
  silent wrong mark on a stored record to a refusal at creation — which is the trade
  worth having. Guarding upstream would mean `lib/poGeneration.js` and
  `persistPRFromForm`, in two areas with their own notes files, and the PR is where a
  price is typed, so a refusal there needs copy and a brief. Measured: all 37 `PO Items`
  and all 43 `PR Items` rows are whole-cent today.
- **THE OVERAGE SPLIT COMPUTES A QUANTITY AND STILL CANNOT INVENT A FRACTION.**
  `lib/overagePR.js` writes `(invoice.qty || 0) - excess` and `qty: excess`, where
  `excess` is always a `Delivery Items."Qty"` passed straight through, and there is no
  division anywhere in that path. Integer minus integer is exact at these magnitudes, so
  the split can only PROPAGATE a fraction already stored — and if it ever does, the
  guard's throw is caught per row by the apply step's own `catch` and reported in
  `failed` with the guard's message, so the correction fails to settle loudly rather than
  reaching `Calculated Total` quietly.
- **THE THREE CENT-SCALE CONSTANTS STAY THREE.** `UNIT_PRICE_TOLERANCE_ABS` compares a
  charge's price against the order's — two figures that should be identical — and the
  form's `shippingFeeMismatch` compares a typed shipping fee against the order's frozen
  one, which is the same question again. The header compares one statement against a sum
  of terms. Same order of magnitude, three different questions. The same derivation does
  land on half a cent for the unit-price one, which is written in that constant's own
  docstring and is the only place it is said: changing it moves what
  `Invoice Items."Variance Flag"` is set on, which is stored data on records that already
  exist, and #254 owns the header comparison alone. **The header being the tighter of the
  two is not a principled ordering** — it is one constant tightened and one not.
- **WHAT NO CHECK IN THIS REPOSITORY CATCHES:** a fractional quantity typed by hand in
  the Airtable UI, where a precision-0 field stores 2.5 and shows 3. No credentialed
  script reads live rows for it — `verify-variance-15.mjs` builds its own whole-number
  fixtures and compares its own invoice — so the state would surface only as the screen's
  own false positive, `⚠ Check the total` on an invoice whose vendor did nothing but
  round its printed amounts. Closing it needs a credentialed check reading live values,
  the shape `verification.md` prescribes for every Airtable-side rule, and #254 does not
  add one. `offline/invoice-header-tolerance.mjs` says so in its header, where the
  threshold's own premise is asserted.
- **NOT MEASURED AS A COST, BECAUSE THERE IS NONE:** the form judges with two figures it
  already holds in state, and the backend uses the `getInvoiceByRecordId` it already
  calls after linking the items. No screen gained or lost an Airtable operation.
- **THE COUNT THAT IS SAFETY RATHER THAN JUSTIFICATION.** Of the 23 invoices on this
  base, exactly one has a non-zero difference (90.00) and the other 22 are exactly zero,
  because `seed_full_demo.mjs` writes `amountDue: amountDue ?? computed` — the same
  arithmetic — so there is no rounding-noise population to count and the base could not
  have decided this either way. What it does establish is that no stored mark changes:
  the one flagged invoice stays flagged under half a cent, and the 22 stay silent.

### Invoices waiting on a delivery (#256)

The other end of #216: a second strip above `/invoices`, listing invoices nobody has
matched to a delivery, longest wait first. The fourth built to the shape #176 set.

- **THE REFUSAL REASON CANNOT BE SHOWN, AND THAT IS A MEASURED CONSTRAINT RATHER
  THAN A CHOICE.** The issue body asks for the distinction between an invoice whose
  orders have seen no delivery and one whose delivery exists but was refused a
  pairing. The second half is unavailable as asked: `fitRefusal` produces seven
  reasons, is pure, and **is never stored** — it runs at write time only, from
  `createInvoiceAction` and from `createDeliveryAction`. Re-deriving one per row
  means `getDeliveriesForInvoice` per invoice, five reads each, which is the per-row
  shape #143 ruled out and #162 measured at over 200 calls.
- **SO THE SPLIT IS BY DELIVERY, NOT BY REASON**, and it costs one batched read.
  `PO Items."Delivery Items"` answers "has anything been delivered against what
  this invoice charges" for every ordered item on the page at once, and
  `getPOItemsForReconciliation` already carried the field. No `Delivery Items`
  level is read: a non-empty link array is the whole claim. Quantities would let
  the strip say more than it should — whether what was delivered covers what is invoiced
  is the *matched* delivery's question, and these invoices have no match.
- **THE TWO WORDS NAME THE OBSERVATION AND NEVER THE CAUSE**, which the base
  forces. `docs/notes/backlog.md` records, measured, that every seed writes
  invoices directly and none calls the matcher, so an empty `Invoices."Delivery"`
  here is usually an invoice the app was never asked about. `nothing delivered yet`
  and `delivered, not matched` are true under a refusal, under nothing having
  arrived, and under the matcher never having run. A word claiming a refusal
  would be false about most of the rows it labeled.
- **`Issue Date`, NOT `Created At`**, and the delivery side set the precedent: it
  counts from `Received Date`, the date on the packing list, although
  `Deliveries` carries `Created At` too. Both strips therefore count from the
  document's own date and their `Nd` figures mean the same kind of thing.
  `Created At` reads better in one respect — nobody could act before the office
  entered the invoice — and loses to comparability, with the row showing the date
  beside the count so a reader can check either.
- **AN INVOICE CHARGING NO ORDERED ITEM IS EXCLUDED**, the one place the strip is
  narrower than the chip it selects on. It can never be paired (`noOrderedItem`)
  and the delivery question cannot be asked of it, so both row words would be
  false. `countsTowardStatus`'s own reasoning one level up. **The consequence is
  that the row count and the number of `Awaiting delivery` chips in the table can
  differ, and it is written down in three places** — the selector's docstring,
  `offline/awaiting-delivery.mjs`, and `docs/briefs/invoices.md` — because anyone
  comparing the two figures will find them apart and read it as a bug.
- **BELOW #216's STRIP, ON THE DOCUMENTS' OWN ORDER.** A delivery waiting for a
  invoice precedes an invoice waiting for a delivery in the flow the two describe, so
  reading down the page puts the two ends of one situation in the order they
  occur. The adjacency argument was weighed first and is weaker: this strip's rows
  also appear in the table below, which argues for putting it there and equally
  well against it, since a row rendered twice is a duplication rather than a
  relationship. It is the first strip whose rows are a subset of its own list —
  #176's and #217's report rows that have no place in their tables at all — and
  the duplication is the point: the table carries no wait and no ordering.
- **NEITHER STRIP'S CONTENTS DEPEND ON THE OTHER'S.** One situation seen from both
  ends produces a row in each. Suppressing either would make one strip's rule a
  function of the other's, and they admit different readers anyway — #216's rows
  are Job-scoped deliveries, these are invoices under #211's walk.
- **`waitingSince` REPLACED `receivedDate` ON THE SHARED SORT.** Three callers
  order by `sortLongestWaitingFirst` and the third passes an invoice's date, so a
  property named after the delivery field was false at one of them. An accessor
  parameter was the alternative and is worse for a reason outside the function:
  `offline/delivery-status.mjs` pins that no `.sort()` in `lib/deliveryStatus.js`
  mentions `issueDate`, because #219 moved the one ordering of invoices by that field
  into `lib/overage.js` and made it private. Passing `(r) => r.issueDate` from a
  page passes only because the call site sits elsewhere; move row-building into
  that module later and it trips #219's guard. A neutral property never can.
- **THE TIE-BREAK WAS INERT HERE AND IS NOW THE `Invoice ID` (second pass).**
  `sortLongestWaitingFirst` broke a tie on `createdAt` descending and `Invoices` has
  no creation timestamp — no field on the table, none on the mapper — so this axis
  passed `undefined` and every same-day pair silently held whatever order the
  invoice read returned. Visible on the base at the time: `HYE-INV-260716-03` and
  `-02` were both `2026-07-16`. The property is `createdKey` now, generalized the way `waitingSince`
  was and for the same reason — the two callers pass different KINDS of value, so a
  name borrowed from one of them was a claim the other could not honor.
- **THE SUBSTITUTION IS EXACT, AND #164 IS WHY.** A generated id's date half comes
  from `new Date()` at mint time (`lib/ids.js`), never from a date field — that
  issue found Invoice ID counting `{Issue Date}`, the vendor's own human-entered
  date, and measured the filter matching 0 of 5 invoices. So descending by
  `Invoice ID` says what descending by `createdAt` says on the delivery side: most
  recently entered first, with the within-day sequence settling a same-day tie. It
  is not an approximation of a timestamp; it is the same fact in another encoding.
- **THE PROOF MOVED WITH IT, BOTH TIMES.** `offline/delivery-status.mjs` names the
  sort's fields in an anti-vacuity assertion, so each rename would otherwise have
  left it reporting "the matcher works" by finding a field no sort here reads —
  the same silent death `waitingSince` risked. Both renames updated that line in
  their own commit, and a check now also fails on any sort in this module still
  reading a pre-#256 name, so a half-converted call site cannot hide behind the
  assertion passing on the other one.
- **THE COPY NAMES NO CONTROL, AND THE REASON IS SHARPER THAN #216's.** There the
  barred control was `New invoice`, Admin-only on a strip that is not. What a
  reader would act on here is recording a delivery, which is Job-scoped site work,
  so the office staff most likely to be reading this page cannot take it at all.
  It also gives no instruction about paying, which is President-or-Admin (#211)
  while the strip is not — the fact is stated and the fact is the argument.
- **Not in this issue:** re-running the pairing for invoices already on the base,
  which is what would make an unmatched invoice mean "refused" rather than "never
  asked". That is the seed defect `backlog.md` records, and it changes another
  issue's data.

### Holding an invoice out until it has waited (#263)

#256's strip listed every invoice naming no delivery, so one entered a minute ago sat
beside one from six weeks back. That is the ordinary case rather than an exception —
the vendor emails the invoice at shipment, so an unmatched invoice is what a normal
Tuesday looks like, and a worklist holding all of them is the table below with a
different heading. **The threshold goes on this axis only**, which is the whole
content of the issue: material standing uninvoiced reads as waiting from the first
day, so #216's strip is right as it is and `AWAITING_INVOICE_COPY` must not grow a
threshold.

- **CALENDAR DAYS, AND 7 IS WHAT MAKES THAT HONEST.** `daysWaiting` subtracts two
  dates and sees neither weekends nor holidays; the office's intuition is five working
  days. **Any seven consecutive days contain exactly five weekdays**, so a 7-day
  calendar threshold delivers the working-day intuition without claiming to be a
  working-day count. Three reasons that is the right trade: what is waited for is not
  on this office's calendar, since material in transit does not stop on Saturday and
  only recording it is office work; a working-day count with no holiday table is not
  one, and calling weekend-skipping arithmetic `business days` on a screen would be a
  name its contents contradict, which is `naming.md`'s own test; and a row already
  renders `· 20d` from `daysWaiting`, so a threshold on a second clock would filter on
  one number while showing another. **What 7 fixes over 5 is the wobble** — at 5 the
  working days inside the window ranged from three to five depending on the issue
  weekday. Holidays still shorten it, which is accepted rather than solved.
- **`daysWaiting` IS UNTOUCHED AND THE JUDGMENT SITS BESIDE IT.** Three strips read
  that function — #216's, #217's and #256's — and only one has a threshold, so folding
  the rule in would move the figure the other two display.
- **THE NUMBER IS A MODULE CONSTANT, AND THE ISSUE SETTLED THAT RATHER THAN THE
  NUMBER.** `TOKEN_TTL_MINUTES` is the precedent, including the reason it lives where
  it does: every reader that states the figure has to be able to read it, the offline
  tier included, and `lib/deliveryStatus.js` is offline-safe. Not an environment
  variable — all twelve `process.env` uses under `lib/` are secrets or infrastructure
  toggles and no business rule is tuned that way here, and the ability to change it
  without a deploy is worth nothing while there is no deploy and no non-developer who
  would change it. Not a row on the base — that puts the rule in the tier no file-only
  check can see and adds a read to a page whose budget this issue must not grow. Not a
  settings screen — a surface with its own authorization, audit and brief, for a number
  that changes approximately never. **The test the issue names is who edits it**, and
  today that is whoever edits this repository; the day it is somebody else is the day
  to move it, and it moves from one place.
- **THE SENTENCE INTERPOLATES THE CONSTANT, so the two homes are unreachable rather
  than merely discouraged** — `CONFIRM_COPY`'s shape. It is the THIRD sentence and the
  first two are byte-identical to #256's, because the two strips share a grammar on
  purpose and `screen-briefs.mjs` pins those two as one substring; the asymmetry this
  issue is about is additive. The new pin carries the wording and **not** the figure,
  which is the convention that list already documents — the figure is the one thing
  meant to change.
- **A NULL WAIT IS REFUSED, AND THAT IS `sortLongestWaitingFirst`'s CALL EXTENDED.**
  That comparator already refuses to let an undated row claim the longest wait, on the
  ground that a data gap must not take the top of a worklist; this says a data gap does
  not earn a place in the worklist either. Admitting it while sorting it last would be
  two judgments about one row. The cost is that such an invoice appears in no
  worklist — real, and small: it is in the table below with its chip and an em dash
  where its date would be, and a row with no date is a DATA problem fixed by filling
  the date in. Reachable only by a hand edit, since both write actions refuse a blank
  `Issue Date`, which is the category `getOrderedItemsWithDelivery`'s neighbors already
  decided to survive rather than describe.
- **ONE THRESHOLD FOR BOTH ROW KINDS, AND THE SIGNAL DECIDES THAT RATHER THAN
  SYMMETRY.** `deliveredNotMatched` reads as though it should skip the wait: something
  arrived, so the office rather than the vendor is what is being waited on. That is
  right about the concept and cannot be built on this flag, which means "some slice was
  allocated against SOME ordered item this invoice charges, in any quantity, by any
  delivery, possibly answering another invoice". The measured pair is recorded on
  `getOrderedItemsWithDelivery` rather than here, because that is where the imprecision
  is created and already described. **The counter-argument is NOT the kinds' "observation
  never cause" rule** — that is about why the flag cannot NAME a cause and licenses no
  second rule; the reason is the imprecision, which is measurable. **Tightening the flag
  was considered and refused:** the kinds are a binary ternary with two words, so a row
  failing a stricter test falls to `noDeliveryRecorded`, whose word is `nothing
  delivered yet`, and the measured pair did take delivery — one false word for another,
  needing a third state. The condition for revisiting is storage of the refusal.
- **THE STRIP IS A SUBSET OF THE CHIP NOW, not a second reading of it.** Every row
  carries `Awaiting delivery` and not every chip earns a row, and the threshold is the
  ordinary reason the two figures disagree — measured the day it went in, 17 chips
  against 16 rows on this base.
- **NO AIRTABLE OPERATION IS ADDED, verified in the code rather than assumed.**
  `selectInvoicesAwaitingDelivery` is a pure loop over rows the page already holds, and
  the one read behind it — `getOrderedItemsWithDelivery` — is awaited in the argument
  list over every invoice's ordered items regardless of what the filter later keeps. So
  the filter can neither add an operation nor remove one; making it remove one would
  mean narrowing before that read, which changes what the set covers.
- **Not in this issue:** `daysWaiting`, `sortLongestWaitingFirst`, #216's strip and its
  copy, #217's strip, a holiday calendar, and any change to #256's two row kinds.

### Reading one ordered item as one line on an order (#266)

An order's page listed one line per stored child row, so an over-delivery — two
`Delivery Items` rows against one ordered item — read as one material twice under
one delivery, and React warned on the ordered item's record id appearing twice as a
key. Folded on the ordered item, with the excess stated as a figure. The invoice
side folded with it, on the ordered item AND the unit price. The rule is
`lib/poDocuments.js`.

- **#238 CONFIRMED THE DELIVERY DETAIL AND DID NOT LOOK ONE HOP OUT.** That issue
  folded the same data on the screen it was reading and left the order's page drawing
  it the other way, which is how a rule about "when does a screen read one material
  as one line" came to have two answers in the same repository for four issues. So
  the first move here was a sweep of every surface that renders several
  `Delivery Items` or `Invoice Items` under one ordered item, written out below,
  rather than a fix to the screen the report named.
- **THE KEY IS THE ORDERED ITEM, AND THAT IS #238's KEY WITH BOTH COMPONENTS FUSED.**
  That issue folds on `Material` + ORDER; a `PO Items` row links exactly one purchase
  order and exactly one material, so in this frame one record carries both. Not a
  third answer to the question — the same one, where the frame hands it a shorter
  spelling. **It also lands strictly finer than folding on the material would, which
  this list needs**: one order can carry two ordered items of one material, an ordered
  item is what these lines are named and sorted by, and folding them together would
  put a sum under a single name that the table above shows as two rows.
- **NEITHER `groupRowsByItem` NOR `groupRowsByItemAndOrder` COULD BE CALLED.** Both
  take the delivery detail's own row objects, and both group across a WHOLE delivery,
  while this fold happens inside one (delivery, order) entry that
  `foldDeliveriesOnOrder` has already built. What is shared is the rule, stated in one
  paragraph in each module and pointing at the other; sharing the code would need a
  parameterized identity and would make three call sites harder to read than two
  functions that each name their own key.
- **OVER-DELIVERY IS NOT THE ONLY PRODUCER, AND THIS IS WHAT THE FOLD IS REALLY
  ABOUT.** `recomputeOverDelivery` splits a straddling row on the delete path and
  `lib/deliveryDelete.js` creates the new piece with `deliveryRecordId` taken from the
  row it split — the SAME delivery, the SAME ordered item. So one delivery can hold
  two FLAGGED rows against one ordered item, which is the `6, 6, 6` case #238 records
  for `overRowIds`, and — once a deletion frees room and a flag clears beside a row
  already inside the order — two UNFLAGGED rows against one. `overQty` therefore SUMS
  the flagged members rather than reading one, and a folded row with nothing flagged
  says nothing about excess at all. Both are inputs to `offline/po-documents.mjs`: an
  implementation that read a single flagged row passes the first and fails the second,
  and one that treated a second row as evidence of an excess fails the third.
- **THE FIGURE EXISTS BECAUSE THE FOLD CREATED THE NEED FOR IT.** Before it, this line
  carried no over signal and needed none — the excess was a line of its own, and the
  document-level `Over-delivered` badge said which delivery. Folded, the quantity
  became the within piece plus the excess, so with no figure the fold would have
  absorbed an excess into a total and left only a badge that names neither the item
  nor the amount. That is the loss #233 names when it says the over signal is the one
  place information could have gone.
- **THE WORD IS `ALLOCATION_COPY.table.overPortion`, CALLED RATHER THAN COPIED.**
  `(N over)` already existed there for the identical fact one frame down, and a second
  copy in `PO_DOCUMENTS_COPY` would be the second home #179 exists to remove. The page
  appends it in its own element because only the excess is colored, which is the
  arrangement the delivery detail already uses; `lib/poDocuments.js` gained no import.
- **THE COLOR IS THE BADGE'S, NOT THE TABLE'S, AND IT PUTS BOTH ON ONE PAGE.** The red
  `(over)` in the `Delivered` column says an ordered item is over across every
  delivery; this says one delivery brought some excess against one ordered item, which
  is what the amber badge two lines above it already says. So the distinction #238
  drew is by SCOPE rather than by page, and #266 is what proves it — that issue's own
  phrasing has been corrected above, and both briefs now state the pair, because a
  designer who did not know would unify them. **Measured in the browser** on
  `HYE-PO-20260819-17`: the folded row's mark computes to the badge's color and not
  to the two table cells', which is the assertion no file-only check can make.
- **THE INVOICE SIDE FOLDS ON THE ORDERED ITEM AND THE UNIT PRICE**, which is
  `lib/invoiceItemFold.js`'s key at this scope with the ordered item where that module
  has `Material` — for the reason above, and because an invoice item here is listed
  under an ordered item. The price stays in the key, so two of them at two prices are
  two facts and a folded one's `@ price` is exact by construction. **That is the
  whole of what a folded item says about a price that differs: nothing, because a
  differing price is never folded.** A missing price is not a price of zero, the
  normalization that module already states.
- **THE ISSUE NAMED #167's SPLIT AS THE PRODUCER AND IT IS NOT ONE.**
  `splitInvoiceItemForOverage` creates the new invoice item with
  `poItemRecordId: target.id` — the OVERAGE order's ordered item — and
  `foldInvoicesOnOrder` admits only rows whose `PO Item` is one of THIS order's, so
  each order's page sees exactly one half and never both. The form cannot make the
  shape either: #91 excludes an ordered item a sibling invoice item already claimed.
  **Measured on this base: 25 invoice items, no (invoice, ordered item) pair twice.**
  So the invoice fold is defensive against a record edited by hand, the same ground
  #241 gives for the same shape one screen away, and the duplicate key was reachable
  on the delivery axis only. Done in this issue rather than deferred, because leaving
  a known shape unhandled gives the next reader no reason to look at that line again.
- **THE FOUR SURFACES THAT WERE ALREADY RIGHT, AND WHY TWO OF THEM MUST STAY
  UNFOLDED.** The sweep found no third screen to fix, but it found two that a later
  issue could break by tidying. **The invoice EDIT form renders raw `Invoice Items`
  and has to**: folding would leave a split's two halves un-editable, and editing is
  the one thing that needs the stored row rather than the reading of it. **The
  over-delivery banners, the correction blocks and #217's strip are per flagged ROW on
  purpose** — a correction acts on one row, so a folded group is not the unit they
  address, which is the same reason #238 gives for keeping them out of its own fold.
  The other two, the delivery detail and the invoice detail, fold already (#238, #167,
  #237, #241).
- **NO NEW READ, MEASURED RATHER THAN ASSERTED.** The fold is a pure regrouping of
  rows the page already holds and no credentialed function gained a call site. On the
  labeled route, `HYE-PO-20260819-17` read **14 operations before and 14 after**, with
  the same ten tables and the same four repeats.
- **Not in this issue:** the red `(over)` in the items table and its predicates, which
  are #169's and #233's and unchanged; the delivery detail's own fold; and the demo
  runbook, which turned out to carry no claim this change makes false — its Act IV
  sentence about coloring only the excess is now true of two screens instead of one.

### Raising a correction only where the invoice agrees (#265)

`Over Delivered` sat on a `Delivery Items` row the moment a delivery filled past
what an ordered item asked, and a correction was offered from there without asking
what was invoiced — the invoice entering only as somewhere to quote a price from,
picked by rules that guessed when nothing named the delivery. So a vendor's own
mistake, twelve shipped and ten charged, read as an order to correct, and the
purchase order that went out asked the vendor for material the vendor never charged
for.

- **THE RULE COMES FROM THE TWO SHAPES A CORRECTION ACTUALLY HAS, and both have the
  same signature.** A site orders more without saying so; or a vendor ships in packs
  and sends twenty against an order for fifteen. In both the vendor delivered what it
  delivered and invoiced for it, so the two documents agree and the only thing out of
  step is the ORDER. That is what earns a correction, and it is why the test is
  agreement rather than excess.
- **`Over Delivered` KEEPS ITS MEANING AND STOPS BEING SUFFICIENT.** More arriving
  than was ordered is a fact about the delivery, true whatever any invoice says, and
  the office should meet it the moment the packing list is entered — making it wait
  for an invoice would hand over the information late. What changes is only that the
  flag opens a QUESTION rather than an affordance. The flag is still stored and the
  eligibility is still computed, and the line between them is not arbitrary: the flag
  is an ATTRIBUTION — which row carries the excess, and which ordered item it attached
  to under #165's fill order — and that is not re-derivable from later state. The
  agreement is arithmetic over two live rollups. Storing what is re-derivable is what
  `overagePRState` already refuses to do.
- **THE COMPARISON IS THE ORDERED ITEM'S TOTALS, and three things force that scope.**
  `Invoiced Qty` is a rollup over the ordered item and #166 already measured what
  summing one invoice does — it reports material as uninvoiced when it is invoiced twice
  over. An excess exists only relative to the ORDERED quantity, which is the ordered
  item's, so one delivery's figure has nothing to compare against. And `Over
  Delivered` is itself an ordered-item judgment: `recomputeOverDelivery` flags a row
  only once the cumulative fill has passed what was ordered. **The consequence is
  real rather than theoretical** — two invoices of 8 and 4 against 12 delivered
  AGREE, because the vendor charged for everything it sent across two documents, and
  a rule reading one invoice at a time would refuse a correction that is owed.
  - **SO THE SCREEN HAS TO SAY WHAT IT COMPARED.** A reader is looking at ONE
    delivery while the verdict comes from every delivery and every invoice on the
    ordered item, and without that line the figures on the page do not add up to the
    sentence beside them: `HYE-DL-260819-11` shows 19 EA received and its refusal is
    derived from 19 delivered against 4 invoiced on an order of 10 — where the 4 came
    from is nowhere else on the screen. One sentence, on all three states, naming the
    order and the three totals. It is absent on the one answer that never reaches the
    totals (`notOverDelivered`) and on `alreadyRaised`, whose reader is deciding whether
    to wait rather than what was measured. `noOrderedItem` was the second and #278
    removed it — a refusal with no key renders no line at all.
  - It says `on this order` rather than `on this ordered item`: the figures are one
    ordered item's, but the box already names the order in its summary and the reader
    has a packing list rather than the schema. `ordered item` stays the word
    everywhere it is the subject.
- **THREE STATES, AND THE THIRD IS NOT PERMANENT.** The totals meet above the order
  (a correction is owed), they do not (the vendor's own discrepancy), or nothing charges
  the ordered item yet. #231 pairs in both directions, but the third state does not
  even need the pairing: `Invoiced Qty` moves the moment an invoice item is created,
  so the answer arrives whichever document is entered second. The sentence says that
  instead of naming an action nobody has to take.
  - **THE DISAGREEMENT RUNS BOTH WAYS, and the issue's own rule covered half of it.**
    "The invoice charges only inside the order" is one shape; 12 delivered against 11
    invoiced is another, and invoiced-MORE-than-delivered is a third that is live on this
    base (`HYE-DL-260819-10`, 13 delivered against 26 invoiced). So the test is that the
    totals differ, not that the invoice stayed inside the order. ONE KEY, TWO VOICES:
    both are the vendor's discrepancy rather than the order's and both refuse for the
    same reason, so the direction belongs to the copy. The strip takes one chip,
    because what a reader does about either is take it up with the vendor — #217's
    density rule, where a closed set gains nothing from two values with one action.
  - **IT NAMES FIGURES AND NEVER A VERDICT**, which is #166's standing rule on this
    axis: "the vendor under-invoiced" and "a second invoice has not arrived" are the
    same measurement at any one moment.
- **`hasInvoice` IS NOT `invoicedQty > 0`, AND `delivered > 0` IS WHAT FAILS CLOSED.**
  An invoice invoicing zero is a document saying nothing was charged, which is a
  disagreement; NO document is a question nobody has answered. And the agreement
  requires something delivered — **found by the check rather than reasoned in**: the
  first version compared the two totals alone, so a caller that omitted the figures
  read 0 against 0, called it agreement, and opened the correction. Fail-OPEN, on the
  one path this issue exists to close. A flagged row always has something delivered on
  its ordered item, so 0 is not a state the data reaches.
- **#219's TIERS AND BOTH ITS INFERENCES ARE GONE.** They existed to pick a document
  when the app could not tell whether the excess had been invoiced at all: the pairing
  tiered the candidates and `OVERAGE_INFERRED` said which guess had been made. Under
  the agreement rule a correction is owed only where the excess IS invoiced, so the
  document exists by construction and there is nothing to infer. `OVERAGE_INFERRED`
  and `inferredLabel` are deleted rather than left standing, the call `lib/deliveryStatus.js`
  made on `arrived-more`.
  - **WHAT REPLACED THEM IS NARROWER AND IS NOT A TIER.** The candidates are the
    invoices charging AT LEAST the excess, because a request takes one quotation
    (#167). If they disagree on the unit price the choice is REFUSED, since it would
    change a figure on the order that goes to the vendor —
    `severalUnpairedInvoices`'s posture on the axis where the choice is now
    observable. Otherwise the pairing is a PREFERENCE among equals, then oldest first.
  - **THE PAIRING SURVIVES BECAUSE #219's DEFECT DOES.** An ordered item filled by two
    deliveries and invoiced by two invoices, each large enough to cover the excess and
    both at the agreed price: the excess belongs to the delivery whose row carries the
    flag, and `Invoices."Delivery"` is the only thing that says which invoice
    describes it. Ignoring it would quote the other delivery's document at the right
    price. It is a preference rather than a tier — an invoice naming ANOTHER delivery
    is still a candidate, which is exactly what #219 refused, and it has to be,
    because it counts toward `Invoiced Qty` and therefore toward the agreement that
    got this far.
  - **THE ORDERING DECIDES LESS THAN IT DID.** `sortInvoicesOldestFirst` now runs over
    candidates that already agree on price, so what it picks changes no figure this app
    computes — which retires the argument #219 had to make about a backdatable
    `Issue Date`. What still differs is the file and the vendor's own code, so the
    choice is said out loud: #231's argument for its own tie-break, inherited.
  - **THE MARKER'S MEANING CHANGED AND ITS SHAPE DID NOT.** `QualifierMarker`'s `!`
    stood for an inference; it carries the tie-break now, and the brief says so,
    because a designer reading "the app guessed" would preserve the wrong idea.
- **NINE REFUSALS BECAME EIGHT, AND THREE OF #219's WENT.** `other-delivery-only` said
  every invoice on the ordered item names a different delivery, which is no longer a
  refusal at all — those invoices are in `Invoiced Qty` and so are part of the
  agreement. `several-unpaired-bills`'s choice is now either unobservable or refused
  under `several-prices-differ`. And `excess-exceeds-bill` became UNREACHABLE: with one
  invoice on an agreeing ordered item it charges the whole delivered quantity, which is
  at least the excess, so nothing is left for it to say. `spans-invoices` absorbed the
  many-invoice case it was split from, and its sentence got truer in the process — it
  said "larger than the oldest invoice", which asked one document, and every invoice is
  asked now.
- **THERE IS NO FOURTH STATE, AND THE PREMISE IS PINNED RATHER THAN ASSUMED.** A flag
  standing while the ordered item is no longer over would need one, and
  `recomputeOverDelivery` flags a row only where `room === 0` — deletion being the
  only thing that mutates rows after creation. So `overageAgreement` takes `orderedQty`
  and never compares it. `offline/overage.mjs` asserts the implication as a property
  of that function, which is what makes the absent key a decision rather than an
  oversight; #206's own rule is that an unreachable message is removed rather than
  written.
- **THE CANDIDATES ARE FOLDED PER INVOICE, and #265 is where that stopped being
  cosmetic.** `invoicesByOrderedItem` builds one entry per `Invoice Items` row, which
  is the right projection of the level and the wrong unit for this question. #219 only
  COUNTED entries, so an invoice split across two rows on one ordered item could not
  change a figure; here a candidate has to cover the excess on its own, and two
  half-entries would each look too small. `foldByInvoice` sums them. Noted as a
  backlog item while the previous design was being weighed and resolved here instead,
  because the rule now depends on it.
- **COST, MEASURED, BEFORE AND AFTER: ZERO.** `/prs` 15 both ways, with the same one
  `PO Items` list; `/deliveries/[deliveryId]` 20 both ways on `HYE-DL-260819-05`, with
  the same `PO Items` breakdown. Every figure the judgment needs is a `PO Items` field
  — `Qty`, plus the `Delivered Qty` and `Invoiced Qty` rollups — and
  `getPOItemsForReconciliation` gained the two it was missing for nothing, because
  `findByRecordIds` passes no `fields`. `Unit Price` came with them, for the price the
  candidates are compared on. The comparison the previous design needed — an invoice's
  whole invoiced set against a delivery's — is not asked at all, so the read it would
  have cost is not spent.
- **THE EIGHT OVER-DELIVERIES ON THIS BASE REDISTRIBUTE 4 / 2 / 1 / 1**, measured
  through the real strip walk. AGREED: `HYE-DL-260819-05` and `-09` raise;
  `-07` refuses as `spans-invoices` (excess 20 against invoices of 15 and 15) and
  `-08` as `no-invoice-file`. DISAGREE: `-11` invoiced short (19 against 4) and `-10`
  invoiced over (13 against 26). AWAITING: `-06`. And `-12` still names no ordered item.
  So all three states are on the base and the demo keeps two raisable rows — the seed
  was not touched. `-09` is the one row whose reading changed without its verdict
  changing: it raised with the `!` marker under #219's fallback tier and raises with
  no marker now, because its single invoice is the only candidate and nothing is
  passed over.
- **Not in this issue:** an invoice's pairing is still not recomputed when the invoice
  is edited (#231's boundary); the correction still covers the ROW's quantity rather
  than the ordered item's total beyond the order, which part company when two
  deliveries each exceeded one ordered item; and nothing here reports the
  disagreement anywhere but on the correction box — the invoice's own mismatch marker
  (#210) is what says it on that axis.

### The way out of an invoice with no order (#272)

`/invoices/new` could reach a state it had no exit from: the vendor's invoice
names no order this app holds, or names one whose ordered items are not what it
charges for. The office records the invoice as a `Direct Purchases` row instead,
and the site raises the purchase request from it — the table, and why it is a
table, are in `purchase-requests.md`; what belongs here is the half that lives on
this screen.

- **THREE DEAD ENDS, AND ONLY TWO OF THEM ARE STATES.** The vendor has no open
  order at all (the picker is empty and the items section stays locked behind
  `Select a PO above to add items.`); detection found nothing, or a number
  matching nothing, or a withdrawn order (three messages, all ending "select the
  PO manually below", which is advice with nothing behind it here); or an order
  IS picked and its ordered items are not what the invoice charges for. **The
  third is a judgment only the reader can make** — nothing in the data says that
  `Elbow 90` is not what this document is about — so no conditional can reveal a
  control for it, and the way out has to be a control that is always there. That
  is the whole argument for an always-visible affordance on a screen whose other
  messages are all conditional.
- **IT DOES NOT OVERLAP #278's AMBER LINE, and the two were checked against each
  other.** That one fires when every ordered item on a row's order is already
  claimed by another item of the same invoice (#91), and its remedy is a
  different order or one fewer charge — a real fix, on a row whose order exists.
  This is the case where no order holds the material at all, and there is nothing
  to pick. Different cause, different remedy, separate words.
- **THE FILE GOES STRAIGHT TO AIRTABLE, WHICH THE OVERAGE REQUEST CANNOT DO.**
  #167 fetches Airtable's own copy of an invoice and uploads a fresh Blob object
  because re-submitting an expired attachment url silently empties the field
  (#142). Here the office uploaded the document minutes earlier and nobody has
  ingested it, so the url the form is already carrying is handed over as it is.
  The action schedules `confirmIngestThenDelete` at its end, as every path does.
- **THE JOB IS FETCHED WHEN THE MODAL OPENS.** `/invoices/new` is a heavily read
  screen and this modal is for the rare invoice; `getAllJobs()` on the page would
  have spent a read on every load that never reaches it. `GET /api/jobs` is #57's
  own shape — the escape hatch on the same form fetches its orders the same way —
  and its own ops label is what keeps that cost visible instead of folded into
  the page's.
- **WHAT THE OFFICE LOSES BY LEAVING IS SAID BEFORE THEY LEAVE.** The invoice
  cannot be entered until the request is approved and its order signed, so the
  form's contents are not kept and the modal says so in its second sentence. The
  landing is a fresh `/invoices/new` with a green line naming the record and the
  job it waits on, because there is nothing to come back to and the next invoice
  is the likely next act.
- **Not in this issue:** the items typed on the invoice form are not carried onto
  anything, and could not be — at the dead end the items section is locked, so
  there are none. Nothing reminds the office when the request they are waiting on
  is approved; `/pos` shows the new order like any other, and the awaiting-invoice
  strip is keyed on deliveries rather than orders, so it will not list it.

### Naming the job an invoice charges for (#314)

- **THE FINDING CAME FROM THE DESIGN PASS, NOT FROM A CHECK, AND THAT IS WHY IT STOOD SO LONG.** `docs/briefs/` goes to a tool that does not read this repository, one screen at a time, and a reader holding several briefs at once sees what no single screen shows: `/prs` and `/pos` headed `Job / Discipline`, `/deliveries` headed `Job`, and `/invoices` headed neither — one fact, three ways, across four lists of the four document kinds. Nothing in the code says those four columns are about the same thing, so no check could have asked. The removal half is in `purchase-orders.md`; this section is the column this list did not have.
- **AN INVOICE HOLDS NO JOB, WHICH IS WHY IT IS THE ONLY ONE OF THE FOUR THAT NEEDED A JUDGMENT.** A delivery has a `Job` link; a request has `Job` as a lookup through its discipline; an order borrows its parent request's. An invoice reaches one only by walking `Invoice Items` → `Purchase Orders` → `Purchase Requests`, which is **exactly the walk `getVisibleInvoiceIds` already makes** to reach `canViewPR`. So the column added no level: `lib/invoiceVisibility.js:resolveInvoiceScope` hands back the orders and requests that walk resolved and used to drop, which is #216's rule on this file's neighbor — a function that reads something and does not hand it back forces the next caller to read it again.
- **THE ALTERNATIVES WERE MEASURED AND BOTH LOST FOR THE SAME REASON.** `Invoices` → `Delivery` → `Deliveries."Job"` is free for a paired invoice and silent for every other, and an unpaired invoice is the ORDINARY state on this axis (the vendor emails at shipment) — but the disqualifying half is that it is a SECOND path, so a paired invoice and an unpaired one would answer from different sources. An Airtable lookup chain (`PR.Job` → `PO` → `Invoice Items` → a rollup on `Invoices`) is free for every reader and loses on the ground #311 already recorded when it refused the same shape for the payment column: a screen judging from a rollup while another screen walks is two answers to one question, and rollups are outside CI entirely.
- **THE JUDGMENT TAKES NO READER, AND THAT IS THE POINT RATHER THAN AN ECONOMY.** #211 split this screen into a reader who walks and a reader who skips the walk, so a job resolved on each side of that split is a rendered fact that can differ by reader on one row, with both halves looking right and nothing failing. `lib/invoiceJob.js` is pure and has no `user` parameter and no privilege term, which is the shape #309 left `resolveDeleteCopy` in and the property `offline/job-column.mjs` reads off the signature — stronger than any assertion about call sites, because a function with no reader cannot differ by reader. `_shared.md` carries the standing form: no table in this app drops a column by reader, and the fact is not what varies.
- **SO THE COLUMN IS NOT NARROWED TO THE ORDERS THAT ADMITTED THE INVOICE**, and under the premise that costs nothing: an invoice charges orders on one job, so a reader who may see the invoice may see an order on that job. Narrowing it would buy protection in a state the app has decided does not happen, and buy it by making a reader-dependent cell permanent. The residual — a multi-job invoice naming a job outside the reader's scope — cannot arise, because the judgment names no job there at all.
- **AND THE SCREEN STOPPED ASKING A PRIVILEGE QUESTION ALTOGETHER.** The last one was `seesEveryInvoice` deciding whether to fetch the invoice items the gate walks from — a pure cost decision while the walk was only ever the gate's. The column needs those records whoever is reading, so the branch is gone. `authorization.md` records what that leaves the helper doing; `offline/invoice-visibility.mjs`'s assertion is INVERTED rather than deleted, and now holds that neither invoice route asks who the reader is.
- **THE BUDGET, MEASURED IN A BROWSER WITH BOTH FIXTURE ACCOUNTS: 14 FOR EVERYONE, FROM 12 AND 15.** The office pays two more (the walk it used to skip); a site employee pays one FEWER, and that is a duplicate this issue had to close rather than inherit. `/invoices` fetched every invoice's items for the gate and `getInvoiceDeliveryStatus` fetched the gated subset's again, so a site reader's page load read `Invoice Items` three times — the third being `getDeliveryInvoicing` on the other axis. Making the office walk too would have made it three for every reader, so the level moved to the caller and that function maps rather than fetches. **The breakdown is identical table for table between the two readers**, which is a stronger statement than the equal total: one path, not two paths that happen to cost the same.
- **THE ITEMS ARE FILTERED TO THE GATED ROWS BEFORE THEY ARE HANDED OVER.** Not an optimization — `orderedItemsByInvoice` feeds a `PO Items` read, so passing every invoice's items would put a refused row's ordered items on the wire. Same line #169 draws on `/pos` and `offline/po-payment-column.mjs` holds there.
- **THE TABLE RE-CUT ITS 52rem RATHER THAN APPENDING**, which is this table's own rule since #166 and the point on which it diverges from `/pos`: that list lets its extra columns push it past the page and scroll. `Job` is 5.75rem, the width `/deliveries` already declares for a job code, and it came out of `Status` (−70px, which #309 had measured as slack and left) and `Delivery` (−14), each still clear of its content by 4px, plus 4px from each date column.
  - **TWO FIGURES IN THAT COMMENT WERE STALE AND WERE RE-MEASURED (#181).** A column needs `max(content, its own header) + 8px` of `pr-2`, and the first cut of this column got it wrong by ignoring the padding: an Invoice ID needs 128px against a 136px declaration, so it had ZERO spare rather than 8, and taking 4px wrapped 23 rows. Measured at 14px/20px Arial: **Vendor at 8rem is 33px short of `Lone Star Pipe & Supply`** and has been wrapping to two lines on every row — the comment claimed it held the longest name "at 16 characters with nothing to spare", which described a shorter vendor than this base now has — and **`Amount Due` is bound by its own header at 84px against 88px declared**, 4px short. Neither is made worse and neither is fixed here: giving Vendor its 161px is a re-cut this page cannot afford and the design pass can.
- **`/pos/[poId]` GAINED `Discipline` AND IT COSTS ONE OPERATION, NOT NONE.** The discipline is a record id on the parent request this page already loads for the gate, and so is the job — but neither is a NAME until its row is read, so the page goes 12 to 13 and the log itemizes the difference as `Disciplines: find 1`. Measured on one order both ways. The one shape that would make it free is a `Discipline Label` lookup on `Purchase Requests`, exactly as `Job` is; it was refused because it would give the app a second source for a discipline's name while `/prs/[prId]` reads the table, which is the divergence this issue exists to close rather than open.
- **Not in this issue:** no list gained a job FILTER. The issue names one as the obvious next thing these lists want and as the argument for the column — a filter taking effect on `/invoices` had nothing on screen to show it — but wanting one is not the same as adding four. Nor does anything refuse a multi-job invoice; see the one-delivery premise for why the column is honest without it.

### Marking an unpaid invoice past its due date (#316)

- **THE JUDGMENT ALREADY EXISTED AND THE TWO SCREENS THAT OWN THE FACT DID NOT CALL IT.** #311 built `invoicePayment` for the order axis: `/pos` folds it across every invoice charging an order and renders `⚠ Overdue` under the payment chip. Neither `/invoices` nor `/invoices/[invoiceId]` read the function at all — the list headed a `Due Date` column and said `Not paid`, leaving the reader to compare the two against today on every row, and the detail printed the due date in its identity block and `Not paid yet.` below. So the screen the office calls a payment queue could not say what in it was late, and a mark shown on the ORDER list was missing from the two screens the invoice owns. That is the shape #309 removed when it opened the payment column, one issue later and one scope down.
- **THE VERDICT IS DERIVED FROM THE DAY COUNT RATHER THAN COMPUTED BESIDE IT, AND THAT IS THE WHOLE OF THE FUNCTION CHANGE.** The list cell carries how many days late, so the figure had to come from somewhere, and the cheap shape was to leave `invoicePayment` alone and call `daysWaiting(dueDate, today)` at the call site. Then `dueDate < today` and `days >= 1` are two ways of saying one thing — agreeing on every row until they do not, and what that looks like on a screen is a cell reading `⚠ Overdue · 0d`. So the count is taken first and the verdict is `days > 0`: one expression, two fields, no boundary for them to disagree at. `daysOverdue` is null rather than 0 wherever the badge does not stand, so no copy branch can render a zero and no caller has to test the number as well as the verdict.
  - **`daysWaiting` IS THE ARITHMETIC BECAUSE IT ALREADY IS.** It is this module's one whole-calendar-day subtraction between two dates, generalized off the delivery axis in #256 when an invoice's `Issue Date` became its third caller; a second implementation inside `invoicePayment` would be the duplication CLAUDE.md's one-rule-one-implementation section exists against. Its two properties travel unchanged: the server's day rather than the reader's, and an answer that moves at midnight rather than at an hour.
  - **THE CONTRACT MOVED, AND IT REACHES `/pos` AND `/pos/[poId]` — WHICH IS WHY IT IS WRITTEN DOWN RATHER THAN LEFT AS A SIDE EFFECT.** `dueDate < today` was a STRING comparison, so an unparseable `Due Date` was judged by lexical order; `daysWaiting` returns null for one and a null count is not late. `summarizePOPaymentStatus` folds this function, so the two order screens took the new judgment too. **Unobserved on this base, counted rather than assumed:** all 23 invoices carry a parseable due date (22 on `2026-09-30`, one on `2026-08-21`), and both order screens were re-read after the change and still say `⚠ Overdue` with no figure. The offline table pins the divergence directly — `2026-00-15` sorts before today and parses to nothing — and pins the near miss beside it, since `Date.parse` accepts `2026-02-30` as March 2, so only a month or day outside its range reaches the new answer.
- **THE DETAIL'S SENTENCE STANDS AFTER THE `isAdmin` BRANCH, AND THE READING THAT FORCED IT IS NOT IN THE ISSUE.** The obvious home was beside `Paid on {date}` / `Not paid yet.`, and that line is the ALTERNATE of the section's `user.isAdmin` test — an Admin gets `PaidForm` INSTEAD of it and would never see a word put there. The consequent is no better, one reader the other way. So the fact sits after the branch, where both halves reach it: #309 opened reading payment to everyone who reaches the row, and lateness is a payment fact of exactly that grade. It carries the figure for the same reason the list cell does — one screen, one invoice — at the density this constant's `detail` half is for. **#318 REMOVED THAT BRANCH AND THE PLACEMENT MOVED WITH IT**, which is worth reading here rather than only in that issue's own section: the reason given above is a reason of last resort — the sentence went after the branch because both halves of the branch hid it from somebody — and once the section reads the same for every reader, what the sentence is ABOUT decides where it stands instead. It sits under the payment sentence it qualifies now.
  - **`offline/invoice-visibility.mjs` CANNOT HOLD THAT PLACEMENT, WHICH IS WHY #316 HAS A CHECK OF ITS OWN.** That file's rule is the right one — a payment READ may not sit on one side of a privilege test — and it finds a read by the five shapes `.paid` arrives in. This line hands the whole record to `invoicePayment` and names no payment field, so moving it inside the ternary fails nothing there. Measured by planting exactly that mutant: `offline/invoice-visibility.mjs` stays green and `offline/invoice-overdue.mjs` reports one gated read.
- **THE MARK NEVER STANDS WITHOUT THE DATE IT READS, AND THAT WAS THE THIRD THING TO DECIDE RATHER THAN A TIDY-UP.** The list now says a row is late while its `Due Date` column still shows only a date — one place a judgment, one place the raw material — which reads like a divergence waiting to happen. It is not: both come from one field of one record in one render, so what could diverge is the RULE, and the rule has one implementation. What the pairing is for is already written down on `daysWaiting` — the row shows the date beside the count because the date is the fact and the count is the reading of it that makes a worklist scannable, so a reader who doubts the number can check it. The column stays, the badge states no date, and `offline/invoice-overdue.mjs` asserts both screens still render the due date. **That assertion also makes an implicit dependency explicit**: `offline/po-payment-column.mjs` proves its "names no due date" walk is not vacuous by finding one on `app/invoices/page.js`, so dropping this column would have made that check silently weaker rather than failing. Measured — with the column removed, both files fail, one for its own claim and one for its control.
- **NO AIRTABLE OPERATION IS ADDED, MEASURED IN A BROWSER ON BOTH SCREENS.** `Paid` and `Due Date` are already on every invoice record the mapper returns, so today is the only new input and it comes from `new Date()`. `/invoices` was 14 before and 14 after, table for table — the figure #314 established for both readers; `/invoices/[invoiceId]` was 7 before and 7 after on `HYE-INV-260821-02`, from one settled reload each way. `/invoices` already took the server's day for its two strips and the detail page gained the one line that takes it.
- **THE BADGE FITS THE COLUMN WITH NOTHING RE-CUT, WHICH IS THE FIRST TIME THAT HAS BEEN TRUE OF THIS TABLE.** Measured at 832px: `Status` is 106px with no right padding, `⚠ Overdue · 10d` is 98px and `· 1d` is 92px, against `⚠ Check the total` at 102px — so the new mark is narrower than the widest thing the cell already held. #166's rule that the budget is re-cut rather than appended to did not have to fire, because nothing was appended. The bound is the digit count at about 7px each: three digits lands at ~105px and four would not fit, which is an invoice 2.7 years past its due date. **And it costs no row height today only because of a defect** — Vendor at 8rem is 33px short of this base's longest name, so every row is already two lines and a row carrying the badge measured the same 48.5px as a plain one. Give Vendor its width back and this cell becomes the tallest thing in the row.
- **THE BADGE OPENS WITH THE ORDER LIST'S WHOLE WORD, WHICH IS #311's CONVERGENCE HELD AS A PREFIX.** `⚠ Overdue · 10d` starts with `⚠ Overdue`, so a reader crossing `/pos` and `/invoices` meets the same two words first and the figure is an addition rather than a second wording. Asserted as a `startsWith` against `STATUS_COPY.column.poPaymentOverdue.text` rather than as two literals that happen to agree, and pinned in `offline/screen-briefs.mjs` without the figure, as the four threshold and strip sentences already are.
- **WHAT THE EXTRACTOR CAN AND CANNOT SEE SPLIT ACROSS THE TWO SCREENS, and `docs/briefs/strings/unfindable.md` records it as this issue's own case of its own test.** `/invoices` imports describers and never names `STATUS_COPY`, so the badge is invisible to `scripts/screen-strings.mjs`; `/invoices/[invoiceId]` already imports the constant by name for `detail.mismatch`, so its sentence IS found. One issue, one constant, two screens, one of them blind. The row's piece count moved 22 to 28, measured as the delta the extractor reports on the screen that names the constant (20 to 26) rather than counted by hand.
- **Not in this issue:** no figure on either order screen (a day count belongs to one invoice and that badge is about a set — #311's call, carried); no strip above `/invoices` (the rows are in the table below with a due date column beside them, and a third card would put a stage color on the page's only fact about money already being late); no sort or filter by lateness; no change to `Invoices."Due Date"`, which stays optional on both write paths; and nothing that emails or notifies. `summarizePOPaymentStatus`'s result shape is unchanged and does not carry `daysOverdue` — it folds the verdict and drops the figure, which is the one direction that stays honest.

### Putting the payment form behind a control (#318)

- **THE SECTION SPLIT ON WHETHER THE READER MAY WRITE, AND #309 HAD ALREADY DECIDED IT SHOULD NOT.** That issue opened reading payment to every reader who reaches the row and left recording it behind `withAdminAction`; the screen did not follow. The body branched on `user.isAdmin` — an Admin got the form, everybody else got `Paid on {date}` / `Not paid yet.`, and neither saw what the other did — so the fact and the control for it were ALTERNATIVES rather than a fact with a control beside it. **The cost was measurable one issue later:** #316 added a lateness sentence to the same section and had to place it outside the branch, because either half hid it from one reader, and that placement then needed an offline check of its own to hold. The section reads the same for everybody now and an Admin gets `Edit payment` beside it.
- **THE CONTROL OPENS THE FIELDS WHERE THEY SIT, WHICH IS `/invoices/new`'s SHAPE AND NOT A DIALOG.** This app's modals stop the reader and take an answer for something it cannot undo — a withdrawal, a deletion, an overage claim — and recording payment can be recorded again. `app/invoices/new/InvoiceForm.js` already had the affordance for a locked unit price: a small text control that unlocks the field in place, and a `Cancel` beside it that puts the value back. Three things carried over exactly — the opener disappears while the fields are open, `Cancel` appears only then, and **`Cancel` re-derives from the SOURCE rather than from a copy taken when the control opened** (`handleCancelUnitPriceEdit` reads `poItemsCache`; this reads the props, which are the record).
- **AND ONE THING DELIBERATELY DID NOT CARRY, WHICH IS WHERE THE READ VALUE GOES WHILE THE FIELDS ARE OPEN.** At `/invoices/new` the display and the field are ONE element, so the stored value is not visible while it is being edited — the input holds what was typed and only `Cancel` brings the other back. Here the read state is a SENTENCE and the control is a checkbox and a date, which cannot be one element, so the same property has to be bought differently: the sentence stays and goes on stating what is RECORDED while the fields hold what is about to be written. That is not redundancy and it is what gives `Cancel` a visible referent. The two screens differ because their subjects do: that form is composing a new document, where the PO Item's price is a reference on another one; this section is amending an existing record whose current value is what the page exists to state. **AND THE SENTENCE PREVIEWS RATHER THAN LAGS, WHICH REVERSED THE SECOND HALF OF THIS BULLET.** It stated the RECORD in both states for one revision, on exactly the reasoning above; read on a screen it was worse than it argued — the reader picks a date and the line above the field goes on saying `Not paid yet.`, so the page contradicts the box they are looking at and nothing marks the sentence as a step behind. It shows the DRAFT while the control is open now: `Save payment` keeps what is shown, `Cancel` puts it back, and the fact is never absent, which is the property the check holds. What survives of the reasoning is the part that was always right — the value is never hidden by opening the control, which is what `/invoices/new` buys with one element and this buys with two.
- **THE QUIET MUTANT MOVED RATHER THAN WENT, AND THAT IS THE WHOLE REASON THIS ISSUE ADDS A CHECK.** Removing the `isAdmin` ternary removes the branch `offline/invoice-visibility.mjs`'s assertion 3 was written for; it does not remove the shape. Hiding the read sentence while the control is open puts the fact and the control back behind one condition, with `editing` where `user.isAdmin` used to be — and `asksPrivilege` is false of `editing`, so that file collects the branch nowhere and stays green through it. **Measured by planting exactly that:** the sentence behind `!editing` leaves every assertion in that file passing and fails only 3b, which is the assertion this issue added. It is the same rule with a second predicate, and the locals come off `useState` rather than off a name list so that renaming `editing` does not retire it.
  - **TWO NARROWINGS 3b MAKES THAT ASSERTION 3 DOES NOT, both load-bearing.** It counts a payment read only inside JSX, because the question is what a reader SEES — `cancel()` re-derives from `paid` and `paidDate` inside a function and hiding that hides nothing. And it counts only the VALUE shapes, a member read or a bare identifier, because a form field's own wire name is the literal `"paidDate"`: without that, `name=`, `id=` and `htmlFor=` on the date input would read as the fact being stated inside the `checked` branch that renders them, and the rule would fail on the correct code.
- **`canEdit` IS A PROP BECAUSE THE OBVIOUS SHAPE TRIPS #309's OWN RULE.** `{user.isAdmin && <PaymentSection paid={invoice.paid} …/>}` is a privilege branch carrying the payment fact in its consequent and nothing in its alternate, which is exactly what assertion 3 reports — the fact disappearing with the control. It would be a false positive, the sentence being stated unconditionally inside the component, and it is structurally indistinguishable from the real defect: the only way to admit it is to teach that rule "unless the file states the fact somewhere else too", which weakens it for every other registered file. Passing the answer as a prop removes the branch instead. **It is still #185's pair rule** — the screen condition is `user.isAdmin` and the action is `withAdminAction` — held now in two halves: the page hands `canEdit` the privilege question itself and nothing else, and every `<button>` and `<form>` in the section sits behind it. Either half alone is satisfied by the other going wrong, which is why both are asserted.
- **THE FILE IS RENAMED AND THE INVENTORY MOVED WITH IT.** `PaidForm.js` names a form and the file holds the whole section — the payment sentence, #316's lateness sentence, and the control — which is `naming.md`'s own test for a file name. `PaymentSection.js` is registered in `PAID_READERS` with the reason, and a stale entry there fails, so the rename could not be half-done.
- **NOTHING CLOSES THE CONTROL AFTER A SAVE AND NOTHING HAS TO, WHICH IS A MEASUREMENT THAT REVERSED THE FIRST ANSWER.** The page carried a `key` built from the record's `paid` and `paidDate` on the section for one revision, on the reasoning that a save changes the record, so the key changes and the component remounts closed. It does come back closed — **and it comes back closed with the key removed**, because `updatePaidAction` ends in a `redirect` and a redirect from a Server Action replaces the segment rather than re-rendering it in place. Read in a browser both ways, including a save that changed nothing, which was the case the key was expected to be needed for. The key went rather than stand with a comment explaining a property it did not have, which is the call this area's modules already make about an unreachable branch.
- **`Edit payment` RATHER THAN `Edit`, AND THE COLLISION IS THIS SCREEN'S OWN.** `/invoices/new` labels the same act `Edit` because nothing there competes with it. This page already carries an Admin-only `Edit` link beside its heading, which opens `/invoices/[invoiceId]/edit`, so a bare `Edit` here would be one word for two acts, visible at once to exactly the reader who can press either. `Save` and `Cancel` are unchanged words for unchanged acts. The three are tier-3 strings written into JSX: `offline/screen-briefs.mjs`'s `PINNED` cannot hold them, since it requires a loadable copy constant, and `TIER_TWO` exists for the two credentialed constants rather than for JSX. They are pinned instead by the check that reads the component, and `invoices-invoiceId.md` quotes them.
- **NO AIRTABLE OPERATION MOVES, MEASURED ON THE SCREEN THAT CHANGED.** `/invoices/[invoiceId]` was 7 operations across 6 tables before and 7 across 6 after, on `HYE-INV-260821-02` with an Admin session, itemized identically. The section reads what the page already held; what changed is which of it is drawn when.
- **WHAT THE BROWSER SHOWED, since none of it is reachable from source shape.** As `soo@` (Admin): the sentence, `Edit payment` beside it, #316's sentence under both. Opening leaves both sentences standing and replaces `Edit payment` with `Save` and `Cancel`; ticking `Paid` reveals the date prefilled with today; `Cancel` closes the section and the box comes back unticked, which is the revert. `Save` closes it, the sentence reads `Paid on 2026-09-01`, and the lateness sentence is gone — a paid invoice cannot be late. Unmarking it through the same control put the record and the sentence back. As `scoped-fixture@` (Employee): the same two sentences, no control of any kind in the section, and the paid invoice `HYE-INV-260819-08` reading `Paid on 2026-08-14`.
- **Not in this issue:** the fields inside the control, which are still a checkbox and a date and are a separate issue's to merge into one; the write path, unchanged in every part — `updatePaidAction`, its `withAdminAction` gate, its refusals and its redirect; the heading's own `Edit` link, whose label is the design's question rather than this one's; and the invoice list, which states the same axis in a cell and did not move.

#### The second half: one date carries the payment (#318)

- **THE CONTROL WROTE TWO FIELDS THAT COULD DISAGREE, AND ONLY ONE DIRECTION WAS REFUSED.** `Invoices."Paid"` was a checkbox beside `Paid Date`, so the pair made four combinations of which two had a meaning. The form demanded a date when the box was ticked and **nothing refused the reverse** — a record could carry a date for a payment it said never happened, while every screen that judged payment read the box. A `Paid Date` is the whole of the fact now: an invoice with one was paid on that day and an invoice without one was not, which is the shape #138 gave withdrawal and #281 gave the send.
- **THE FLAG'S READERS WERE COUNTED BEFORE ANYTHING MOVED, AND ONE OF THE THREE THE ISSUE NAMED WAS NOT ONE.** The body said #292, #309 and #311 all ask it; #292 is `fix: format every money figure the app emails` and asks nothing about payment. The actual set is **#309** (the invoice list's word, the detail's sentence, the order detail's badge), **#311** (`invoicePayment` and the order list's column), **#233** (`lib/poDocuments.js`'s fold and `✓ Paid`), and **#162/#309**'s third delete-confirmation voice. Eleven sites in `app/` + `lib/`, one in the credentialed tier, and **nothing at all on the Airtable side** — the whole schema was read and no formula, rollup, lookup or other field anywhere in the base references `Paid`, and neither field carries a description.
- **THE DERIVATION IS NOT AT THE MAPPER, WHICH IS #281's SHAPE RATHER THAN AN ECONOMY.** The cheap change was one line — keep exposing `paid` and derive it from the date where the record becomes an object — and it was refused. `lib/airtable/purchaseOrders.js` carries `sentAt` and no `sent` boolean; `lib/poListView.js`, `lib/poSend.js` and `/pos/[poId]` each test the timestamp's presence at their own site. **A presence test has no boundary to disagree at**, which is exactly what separates it from `dueDate < today` — that one is a rule and lives in one place, and `offline/invoice-overdue.mjs` already holds the line. So the mapper carries the date and five sites ask whether it is there.
- **`invoicePayment` TAKES THE DATE, AND THAT MOVES `/pos` AND `/pos/[poId]` A SECOND TIME.** #316's section above records the first: `summarizePOPaymentStatus` folds this function, so the order screens inherit whatever it reads. Counted rather than assumed — **observable only on a record where the two fields disagreed, and there is none**: 23 invoices, one paid with both fields set and 22 with neither, read off the base before the change. Both order screens were re-read after it and still say `Paid`, `✓ Paid` and a figureless `⚠ Overdue`.
- **`Invoices."Paid"` IS DELETED FROM THE BASE, BY HAND, AFTER THIS MERGES — AND THE API CANNOT DO IT.** Measured three ways against a field id that does not exist, so nothing on the base was touched: `PATCH .../fields/{ghost}` answers **403 `INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND`**, which is a route that exists answering about the model; `DELETE .../fields/{ghost}` answers **404 `{"error":"NOT_FOUND"}`**, byte-identical to `DELETE .../nosuchcollection/{ghost}`. There is no endpoint, exactly as #280 measured for a table. So the field goes in the Airtable UI, and the UI's own warning is the one check nobody here can run — the Metadata API does not expose a view's filters, so whether a view filtered on the flag is unknowable from this side.
  - **THE ORDER HAS A SAFE DIRECTION AND #280's DID NOT.** A table rename breaks in both directions, which is why that issue's procedure is one commit and a window on one machine. Here the code stops reading `Paid` first and the field sits unread until it goes; the reverse — deleting first — makes `record.get("Paid")` return `undefined`, `|| false` reads every invoice as unpaid, and nothing says so. So: merge, then delete.
  - **AND IF THE DELETION NEVER HAPPENS THE APP IS STILL RIGHT.** `offline/table-field-names.mjs` holds that no reference in `app/` or `lib/` addresses the name, so a flag ticked by hand in Airtable changes nothing on any screen. That is the safe failure, and it is why the deletion is tidying rather than a second half of the change. What is lost by deleting is one stored `true` on `HYE-INV-260819-08`, whose `Paid Date` already says the same thing.
- **THE PROOF THAT NO SITE SURVIVES IS #280's CHECK, NOT A NEW ONE.** `offline/table-field-names.mjs` already asks the one question this tier can answer — does any reference address a name the base does not have — over the five positions where a string reaches Airtable, scoped to `app/` and `lib/`. `Paid` is its first entry that is a deletion rather than a rename, and its first field entry whose successor is named in the same table: the check asserts `Paid Date` is addressed in the tree, which is the only evidence this tier can offer that the flag was replaced rather than dropped. Mutation, run: restoring `paid: record.get("Paid") || false` to the mapper reports `lib/airtable/invoices.js:98 [record.get()] "Paid"` and fails.
- **CLEARING THE DATE IS HOW A PAYMENT IS UN-RECORDED, AND `Clear` IS THE CONTROL FOR IT.** One field, one act — and the act needed somewhere to be pressed. This argued the opposite first: no control, on the ground that a second one would be a second way to say one thing and that `Cancel` beside it already means abandon, with a sentence buying the discoverability instead (`Clear the date to record that this invoice is not paid.`). **What that missed is where the clear affordance already was.** A `type="date"` input carries one INSIDE the browser's own calendar popup — a signal a reader has to open something else to find, which is the shape #232 retired `QualifierMarker` over and CLAUDE.md records as a standing rule on anything that opens over the page. So the button is ours, in our own markup, beside the field and reachable by keyboard, and it renders only while there is a date in the box. The sentence went with it: the control names the act where a reader would try it and the sentence above previews what it does, so the words said what the screen already shows. **One string is not replaced by another here — it is replaced by a control**, which is the trade #232 made in the other direction.
- **`Save payment` RATHER THAN `Save`, AND THE LATENESS SENTENCE STANDS DOWN WHILE THE DRAFT SAYS PAID.** The label takes `Edit payment`'s own modifier one control along: this page carries a second form, so a lone `Save` names no subject and the pair reads as one control's two ends. The stand-down is what the preview forced — `overdue` is resolved on the SERVER from the record, so a reader who types a date would otherwise see `Paid on 2026-08-27` with `⚠ Overdue` under it, the screen contradicting the state it is showing. `!statedDate` is not a second answer to whether the invoice is late: it applies the premise the badge is already built on, that only an unpaid invoice can be late, to the state being previewed. **THE PREVIEW IS ONE-WAY AND THAT IS RECORDED RATHER THAN HIDDEN:** clearing a paid invoice's date previews `Not paid yet.` and brings no lateness sentence with it, because the server resolved that fact for a record that was paid. Producing the other half means handing the section `dueDate` and the server's day and letting it call the judgment itself — a bigger change than the one that made the preview necessary, and the sentence appears on the next load as it did before.
- **THE FIELD OPENS EMPTY ON AN UNPAID INVOICE, AND THAT IS THE ONE PLACE THIS COSTS SOMETHING.** It prefilled today the moment the box was ticked, which was a convenience while the tick was the deliberate act. With the box gone the date IS the payment, and a prefilled field turns `Edit payment` → `Save` into a payment recorded by two clicks and no typing. The office pays on one weekday, so today is usually the right answer — that is the cost being paid to keep the date typed rather than accepted. An invoice that already carries a date opens holding it, or opening the control and saving would move it.
- **`Paid Date is required when marking as Paid.` IS GONE WITH THE STATE IT DESCRIBED**, and so is the `required` attribute that made it unreachable. A blank date is a value rather than a gap, so there is nothing left to refuse. It was `unreachable.md`'s most argued entry — listed as reachable, then corrected by #185 after somebody read the control — and it leaves that file by the one route that needs no decision: the string is no longer in the tree.
- **Not in this issue:** the field's label, still `Paid Date`; `updatePaidAction`'s name, its gate, its remaining refusal and its redirect; the `done=paid-updated` key; and the deletion itself, which is a UI step for whoever owns the base.
