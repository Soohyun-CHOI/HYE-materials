# Deliveries and invoices — the reasoning

Governs `app/deliveries/**`, `app/invoices/**`, `lib/delivery*.js`, `lib/overage*.js`, `lib/invoice*.js`. **Read this before editing there** — CLAUDE.md carries only the rules that bind code outside this area; the derivation, the evidence and the alternatives weighed are here.

Moved verbatim out of CLAUDE.md — nothing in this file was rewritten. The migration was audited line by line and the result is in the pull request that created this file.

## The one-delivery premise

**The material one invoice bills arrives on the one delivery that invoice matches,
or it has not arrived. It is never split across several deliveries.** A delivery can
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
fact.** A vendor does not bill half a shipment. Nothing about it is provable from the
data, which is why #166 could only assert it in prose. What changed is where it is
held: the field's shape holds it, the pairing rule refuses to write anything that
breaks it, and a `Deliveries` row can still be linked by hand in Airtable to an
invoice it does not contain — so reading code must survive a violation even though
writing code cannot produce one.

**What follows from it, and every one of these is somewhere below:**

- **The invoice axis has no middle STAGE, and #232's third value is not one.** There
  is no `Partly delivered`, because partial can only mean the vendor shipped less than
  it billed, and nothing further is coming — so it is a discrepancy rather than
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
  is coming: what the invoice bills either arrived on the delivery it matches or was
  never shipped. The one place `yet` is honest on these screens is an invoice matched
  to nothing, where the material may still arrive or the arrival may still be
  recorded.
- **"Everything billed was delivered" is a fact about the INVOICE, not about each of
  its items.** The chip states it once. A per-item box repeating it states one fact
  as many times as the invoice has items, which is why a box that agrees says nothing
  at all (#232).
- **`fitRefusal` refuses a pair the premise would break**, so a computed pairing
  always contains everything the bill charges. `nothing-delivered` is therefore
  unreachable through the app's own writes and reachable through hand-entered data —
  `HYE-INV-260804-03` is that row on this base and is kept deliberately, being the
  only way to see the branch on a screen.
- **IF THE PREMISE BREAKS IN REALITY, THE INVOICE AXIS HAS NO EXIT.** A vendor billing
  one invoice and shipping the material in two arrivals is not a shape this app can
  record its way out of: both deliveries can be entered normally, and each will contain
  part of what the bill charges, but `Invoices."Delivery"` is a SINGLE link, so the
  invoice can name only one of them and its chip reads `Mismatch` forever. Nothing is
  wrong with the data and no correction path exists — the shortfall is real against the
  delivery named and imaginary against the shipment. **Deliberately not fixed**, there
  being no such case on this base and no report of one from the office; the note is here
  because the cost of fixing it is easy to underestimate. Making the link plural reopens
  what #210 settled (the shape that HOLDS the premise), what #231 built on it
  (`fitRefusal`'s `notContained`, which is containment against one arrival), and what
  #232 drew from it (one delivery named once per invoice, a per-item comparison with one
  second term). It is a premise change, not a field change.

### Recording deliveries (#162)

`/deliveries` (list), `/deliveries/new` (entry), `/deliveries/[deliveryId]` (one arrival, with in-place edit and delete). Site staff record what arrived; **the app decides which order it belongs to** and there is no allocation-editing UI, so the only correction is to delete and re-enter.

- **The entry form is ONE page: a header that narrows, then a repeating list of items**, the same shape as the invoice form — not a job list you navigate through first, and not one item per delivery. A packing list normally names several items from one vendor on one day, so the ITEM ROWS repeat while the header (job, vendor, optional PO number, date, photo) does not, because those are properties of the arrival rather than of a delivery item. Job → vendor → items, each narrowing the next. The single page is possible only because `getDeliveryCandidates` batches across jobs: the page hands the form every accessible job's ordered items in one read and the form filters client-side. Per-job fetching would have been ~6 queries each, over 200 for an Admin on 36 jobs, which is what forced the first version to navigate. Jobs offered are the viewer's `Assigned Jobs`, or all of them for President/Admin, narrowed through `accessibleJobs` so the dropdown cannot offer one `createDeliveryAction` would refuse. A single accessible job is preselected. Changing the job or the vendor resets the item rows, since each was narrowed by the old one.
- **An item already on one entry row is not offered on another** (`availableItemOptions`), the same rule as the invoice form's per-line PO Item dropdown (#91) and for the same reason: an item already on the delivery is not a second thing to add. The row's OWN selection is always kept, or the `<select>` would hold a value matching no option, render blank, and silently drop what was picked. `+ Add item` disables once every option is claimed rather than adding a row that cannot be filled. The rule is a pure function rather than inline JSX so the offline tier can pin it — what a control may offer is still a rule.
- **Two rows of ONE material would be summed, not planned twice**, and that path stays even though the dropdowns now prevent it. Allocation runs against a single snapshot of the candidate ordered items, so planning one material twice would let both plans claim the same undelivered quantity and double-allocate. The form is an affordance, not a guarantee — a Server Action is callable regardless of what the page rendered — so the action groups by material before planning. Different materials never compete for the same ordered item, so they are planned independently.
- **Reading a delivery back collapses its rows to items, and that rule is one function** (`groupRowsByItem`), because the rows are two things at once — several items, and several order-slices per item. Keyed on `materialRecordId` when present and on the frozen name/size/unit otherwise, so a row with no `PO Item` still groups with its own item — a state #165 stopped producing but that the reading side still has to survive. In first-appearance order, which is `Delivery Item ID` order, which is the order the recorder listed them. An item is flagged when ANY of its slices is: the question a reader asks is "did more of this arrive than we ordered", not "which slice carried the excess".
- **The list summarizes as first item + a count** (`summarizeDelivery`): `Rebar D13 200 EA` then `+2` as its own chip, never appended to the label — read as text after the name, `+2` looks like a size or a grade on the item itself. It is a count rather than more names because a list row has one line and the useful thing there is "there is more here than you can see"; the detail page is where the rest belongs. The `Over-delivered` tag appears on the list too, from the same summary, so a reader does not have to open a delivery to find out. The detail page's headline uses the same function, so the row clicked and the page landed on cannot describe one delivery differently.
- **`ALLOCATION_COPY` was SWEPT BY #166 for one word per fact, and another issue reaching into this module is the point rather than an accident.** That issue put the same facts on the invoice screens; leaving them would have meant one fact called `arrived` here and `delivered` there, on a base whose table is `Deliveries` and whose rollup is `Delivered Qty` — a second name makes a reader ask what the difference is, and there is none. So: `arrived` → `delivered` throughout the banner and preview voices, and the list tag `over-delivery` → `Over-delivered`. `offline/delivery-status.mjs` fails on `arriv`, `recorded as` or the word `line` appearing in any #166 message, which is what keeps the vocabulary from drifting back.
- **#166 stopped at the repo boundary and #181 crossed it, which retires the carve-out this entry used to record.** #166 left the Airtable field named `Over Delivery` on the grounds that renaming it "breaks a lookup rather than fixing a word", by analogy with the US-English rule's exemption for values belonging outside this repo. That analogy was wrong and #167 measured why: a field's NAME is a rendering and its id is the storage, so a rename carries every formula, rollup, lookup and view filter with it and the only thing that can break is a string literal here — which is enumerable. The field is `Over Delivered` now. The US-English carve-out itself still stands, because it is about a value whose spelling another system owns (a select option, a package name), not about a field name we chose.
- **#181 also retired `outstanding` from this module.** It was one of two words for the invoice subtraction on `Materials` and this module was using it for the delivery one, so the same fact-per-word argument applied a second time: `undelivered` here, `uninvoiced` there. The copy builder `overNothingOutstanding` became `overFullyDelivered` (key `over-fully-delivered`) in the same pass, since its own message says "already delivered" and that is the better name for the branch anyway.
- **The banner names the item only when a delivery holds more than one.** With a single item the name is already the headline and repeating it is noise; with several, "3 EA arrived beyond what was ordered" does not say beyond what. One message per over-delivered ITEM rather than per flagged row, and it claims an order only when every flagged slice of that item names the same one.

- **THE ALLOCATION RULE, in `lib/deliveryAllocation.js:planDelivery`.** Candidates are that Job's ordered items for that vendor and that material, `countsAsOrdered`, with undelivered quantity left, narrowed to a supplied PO if the packing list named one. Filled **oldest order first** — PO `Created Date` asc, tie-broken by `PO ID` then `PO Item ID`, the same chain and the same reason as `sortHistoryRows` (Created Date is calendar-only). An undated ordered item sorts LAST, since a data gap must not take priority in a FIFO queue.
- **Matched on #18's `Material` link, never on `Item Name` text.** The vendor wrote the packing list and we wrote the PO, so the strings do not agree — which is why the item comes from a dropdown rather than a text box, and why an ordered item with no `Material` link is invisible to this feature. Pre-#18 ordered items were never backfilled, so that is the honest cause of the form's "item is not in the dropdown" message.
- **Signature status does not filter candidates**; withdrawal does. Site sometimes orders first and the PR/PO follow as a record, so an Awaiting Signature ordered item must still receive its arrival. A withdrawn PO's ordered item is excluded by reading #18's `Committed Qty` — the which-POs-count rule stays in that one named field, never re-derived from a status string, exactly as #19 reads it.
- **The dropdown is deliberately WIDER than the candidate set**: it lists every material the vendor supplied to this Job, including ones already fully delivered, showing `fully delivered` (`none outstanding` before #181). Narrowing to undelivered-only would make such an item VANISH, and the recorder would then land on the "not in the dropdown" message — which says it may never have been ordered here. That would be false, so the screen shows the item and says the true thing instead, then flags the entry as over-delivery.
- **Over-delivery is flagged, never refused**, and becomes its own row. **That row always NAMES an ordered item (#165)**, and it attaches to the END OF THE FILL ORDER: the last ordered item the arrival filled, or — when it filled nothing, because every order for the material is already complete — the last ordered item in the same ordering, i.e. the most recent PO's.
  - **#162 left it unattached whenever the narrowed set held more than one ordered item**, reasoning that no single order had been over-delivered and that a guess written into `Delivered Qty` would have #20 report it as fact. The cost of not attaching turned out to be the larger error: an unlinked row is in no ordered item's `Delivered Qty`, so it is **invisible on the invoice axis**, and a delivery that arrived in full reads as less arrived than was billed — which points at withholding payment. Attaching is imprecise about *which* order absorbed the surplus; not attaching was wrong about *whether* the material arrived.
  - **The tail comes from `sortCandidates`, not a second comparator.** Both branches are positions in the one order allocation already fills in, so "most recent" is `sortCandidates(...).at(-1)` — one comparator, and the two branches read as one sentence. Consequence worth naming: that function sorts an **undated** ordered item last so a data gap cannot take FIFO priority, so the tail picks such an ordered item as "most recent". Coherent under the same reading — last to be filled, last to be blamed — and unreachable while every PO carries a `Created Date`, which docs/notes/backlog.md records with the date it was measured.
  - **No longer depends on a PO holding at most one ordered item per material.** `sortCandidates` is a total order, so both branches are defined whether a PO carries one ordered item of a material or five — which is why #162's `narrowed.length === 1` test is *gone* rather than widened, and why this does not wait on #170. The sub-case #162 could only record at PO level (PO unambiguous, ordered item ambiguous) now resolves to an ordered item by fill order, so `Deliveries.PO` no longer carries that fact alone — it stays as the packing list's own reference, which is all it ever claimed to be.
  - **A supplied PO ID still hard-restricts**, unchanged: both branches draw only from the narrowed set, which is already filtered to that PO, so excess never spills onto another order.
  - **The invariant: a plan is either BLOCKED or every row it produces names an ordered item.** There is exactly one way to have nothing to attach to — an empty narrowed set — and #162 wrote a row with no link and blank frozen name/size/unit for it. It is now refused with the reason (`lib/deliveryAllocation.js:BLOCKED`).
  - **Where `blocked` is reachable, because the first answer to this was wrong.** **Not from the entry form.** With a PO in use the form builds its item options from *that PO's own ordered items*, and both the PO checkbox and the PO input reset the item rows — so a recorder cannot hold a selection the typed PO does not carry, not even transiently. With no PO the options come from ordered items already filtered by vendor and `countsAsOrdered`, so every offered material has a candidate. The form refuses these combinations by never offering them, which is why it has **no blocked branch of its own**: an unreachable red message would imply a state the form can produce. It is reachable at **submit**, which is where the refusal lives: `createDeliveryAction` re-runs allocation from a fresh read, and a PO can be withdrawn while the form sits open, so `countsAsOrdered` drops its ordered items under a selection that was valid when it was made. A direct call on the Server Action is the other way in. The copy therefore belongs to the action, not to the preview, and `ALLOCATION_COPY.preview.blocked` says so.
- **A supplied PO ID is a hard restriction, not a preference.** Excess never spills onto another order, because the packing list names this one; the screen says so rather than leaving the recorder to wonder why a later order was not used.
- **Allocation is greedy at entry time and never re-runs.** So entering a backdated arrival after a newer one allocates it against whatever is still open — **order of entry decides, not order of arrival.** Accepted rather than solved: re-allocation would mean mutating existing rows, which the no-editing decision rules out. `withKeyLock` on `job::vendor::material` serializes in-process; the cross-invocation residual is the same class as #138's, and its failure mode is an over-delivery flag, which is a state the system already models. **#206 gave that sentence one exception, and the paragraph had not seen it:** it reasons about BACKDATED ENTRY, where the plan is imprecise about which order carries a surplus but no stored flag is false. DELETION is the other half of the same delete-and-re-enter it recommends, and there a flag does become false — so the delete path now mutates existing rows. The exception is narrow: it redraws the within/over boundary inside ONE ordered item and never revisits which ordered item an arrival attached to, so the FIFO attribution this paragraph is about is still computed once and never revised.
- **The photo has TWO writers, and that is the one deliberate departure from #142's one-writer rule** — the photo is editable in place, unlike a Quotation's file. `createDelivery` writes it at creation; `replaceDeliveryPhoto` is the narrow second writer, in `setPOItemMaterial`'s shape, and **refuses any url that is not a fresh Vercel Blob upload** (`isOurBlobUrl`). That precondition is what makes #142's failure mode — re-submitting an url Airtable issued, which succeeds and silently empties the field — unreachable by construction rather than by discipline. `updateDelivery` has no `file` parameter and must not grow one. Enforced by `offline/source-shape.mjs`: exactly two writes, one in each function, `isOurBlobUrl` called in the replacer, none in `updateDelivery`.
- **Deletion is a real delete with no tombstone, following invoices rather than PRs and POs.** A withdrawn PR or PO keeps history worth preserving; a wrong delivery is a mistake with no history in it. Author plus Admin. `PO Items."Delivered Qty"` simply recomputes; **nothing on any Invoice record is touched**, so what was billed and whether it was paid are unchanged. The photo goes with the record and there is no second copy — #140 deleted the Blob object after ingest — which is why all three voices of `DELETE_COPY` say so. The three voices branch on whether the affected ordered items are invoiced and whether their invoice is paid, escalating lazily so an ordinary delivery pays only for the cheap question.
- **Authorization is per-record on two axes.** Job membership (or the office) for viewing, entry and in-place edits, via `lib/deliveryAccess.js`; authorship-or-Admin for deletion, inside `lib/deliveryDelete.js`. President/Admin are admitted to entry deliberately, one step beyond the issue's "anyone assigned to the Job": every other row-level rule admits them, and Admin can already delete. No role wrapper fits either axis, so all four Server Actions are `requireUser()` exemptions in the endpoint inventory, with the two axes named separately.
- **No per-row identifier gate, unlike #19's screens**, because the page gate subsumes it: allocation only picks ordered items from POs on this delivery's Job, and `canViewPR` clause 4 admits anyone assigned to a PR's Job. A second gate would re-derive the same answer and could drift from it.
- **Not in this issue:** nothing is written to any Invoice record and there is no `Invoices.Delivery` link (**#210 added that link and one write to it** — see "The invoice-to-delivery pairing" below; the rest of this clause stands); the discrepancy screen is #20; material never ordered on the Job, and consumption, are out of scope. `Materials.Uninvoiced Qty` (`Outstanding Qty` when #162 was written) is deliberately unchanged AS ARITHMETIC — its own description says packing lists will be the real arrival signal and that it is the one place to change, but what an arrival-based figure should mean is a reporting decision belonging to #20 with the screen that shows it. #181 renamed the field to the subtraction it performs, which does not settle that: it frees the word `outstanding` for #20 rather than spending it.

### Delivery status (#166)

Whether what a vendor billed for was delivered, and what was delivered with no invoice behind it. **No new screen** — each fact goes where its own record lives, because a delivery with no invoice has no invoice row to sit on: the invoice list gains a column, the invoice detail a section, the deliveries list a column and two filters. `lib/deliveryStatus.js` judges; `lib/deliveryReconciliation.js` fetches.

- **ONE WORD PER FACT, and the sweep reached #162's module to keep it that way.** `delivered`, never `arrived` — the table is `Deliveries` and the rollup is `Delivered Qty`, so a second name for one fact only makes a reader ask what the difference is. `ordered item`, never `line` — a `Line` on this base is a child of a Job. And nothing is `recorded as` anything, since this app does not write `Recorded as paid` either. `ALLOCATION_COPY` was swept in the same pass (see "Recording deliveries" above); the Airtable field then still called `Over Delivery` was not, on the ground that it was outside this repo — **#181 crossed that boundary and it is `Over Delivered` now**, because #167 had measured that a field rename carries every formula, rollup, lookup and view filter with it and breaks nothing but a string literal here. `offline/delivery-status.mjs` fails on `arriv`, `recorded as` or the word `line` in any message here, so the vocabulary cannot drift back.
- **The join was computed, never stored — and #210 STORED IT.** #166's reasoning: there is no `Invoices.Delivery` link and deliberately none, whether to add one being left until this screen had been used. The one path that existed was `Invoice Items` → `PO Item` ← `Delivery Items`, so the ordered item was where the judgment was made, being the only thing both axes touch. The ordered item is still where QUANTITIES are compared, for the same reason; what changed is that which shipment answers which bill is read rather than estimated. Every clause below that rests on the estimate is annotated where it stands, and the derivation is in "The invoice-to-delivery pairing" at the foot.
- **Two independent comparisons, not a list of cases:** delivered against invoiced, then each side against ordered. Every combination falls out of those two, including ones nobody enumerated, which is why the module returns figures plus a key rather than a hand-written case per screen.
- **Comparison 1 uses TOTAL delivered**, within-order plus beyond. "Did the billed material arrive" asks about delivery, not about whether the order covered it: 12 delivered against an order of 10 answers a bill for 12 in full, and using the within-order figure alone would report 2 as undelivered while it stands in the warehouse.
- **Comparison 2 is realized as two NAMED facts**, not as `max(delivered, invoiced) > ordered`. That form is true of both cases and distinguishes neither, and #162's `Over Delivered` flag already gives the delivery side exactly.

- **A LIST CELL IS A CHIP, NOT A SENTENCE, and that is what the density axis actually means.** `column` is a closed set of values a reader learns once and then recognizes — the way an Airtable single select reads — while `detail` is sentences with figures. The first version had short sentences and fractions in the column, which breaks the metaphor twice: a fraction changes per row so the set stops being closed, and saying WHAT it counts costs words a one-line cell does not have (`1 of 2 lines arrived` had to name a unit it could not use). So the count decides which chip it is and stays behind; the figures live on the detail. `offline/delivery-status.mjs` asserts that **no chip contains a digit**.
  - Invoice axis: `Delivered` / `Partly delivered` / `Awaiting delivery`, and `—` when every invoice item is free text. **#210 left TWO of those four** — the chip comes from the stored pairing now, so `Partly delivered` went with the inference that produced it and the dash became unreachable.
  - Delivery axis: `Invoiced` / `Partly invoiced` / `Awaiting invoice`, and `—` likewise. Unchanged: a shipment really can be part-billed, because it may carry material nobody has billed yet.
  - `Partly`, not `Partially`, on both. The two sets share one tone vocabulary (complete / partial / none) in `app/components/DeliveryStatusMarks.js`, so a reader crossing between the lists recognizes the shape. **`—` is deliberately not a chip:** "we did not measure" is the absence of a value, not a fourth one.
- **THE INFERRED QUALIFIER IS A MARKER, NOT A CHIP** — a small `!` in a circle beside the chip. It is not another value of the closed set: it composes with any of the three and as a chip it would double them. **`title` alone would be the whole affordance on a mouse and nothing anywhere else**, since a tooltip opens on neither touch nor a keyboard, so the same sentence is also the `aria-label` and therefore the accessible name. The full explanation is an ordinary line of text on the invoice detail, which is the reading nobody has to discover. One sentence, two punctuations (`Inferred: …` for the marker, `Inferred — …` for the line), asserted equal offline so the two cannot come to give different reasons.
  - **THE SHAPE OUTLIVED THE QUALIFIER IT WAS BUILT FOR (#210).** The inferred marker is gone from these screens with the estimate; a MISMATCH marker took its place on the invoice axis, and the argument for it being a marker rather than a chip is #166's, inherited rather than re-derived. What did not carry over is the two punctuations: the detail already states the shortfall with its figures through the verdict, so there is one sentence and no twin to hold in step. #167's own `!` still means `inferred`, which is why the component is named for its shape now (`QualifierMarker`) rather than for one of its two meanings.
- **Facts, never verdicts.** At any one moment "the vendor over-billed" and "the rest has not been delivered yet" are the SAME measurement, so the copy says `more billed than delivered` and the reverse direction gets the same treatment. `offline/delivery-status.mjs` asserts that no message anywhere contains "over-billed", "short-shipped" or "missing". Deciding which it is belongs to a person; correcting it is #167.
- **THE ANSWER IS ATTRIBUTED TO ONE INVOICE, and the load-bearing rule WAS where computation ends and inference begins** (`allocateLineToInvoices`). Refusing to attribute leaves the invoice axis unable to answer "may this be paid", which is the question it exists for — the same call #165 made one level down when it stopped declining to attach an over-delivery row. **#210 KEPT THE ATTRIBUTION AND DELETED THE BOUNDARY**: the answer is still attributed to one invoice, and it is now read off `Invoices."Delivery"` instead of estimated, so the whole function and its `determinate` flag are gone. The four sub-clauses below are #166's record of a rule that no longer exists; they are kept because the pairing was justified by measuring exactly where they went wrong.
  - **Most of the time nothing is inferred.** Three shapes are order-independent and are computed outright: ONE bill on the ordered item (its delivered-against-billed *is* that invoice's answer — the common case), the delivery covering EVERY bill (all satisfied whatever the order), and NOTHING delivered (none satisfied).
  - **Inference is needed in exactly one shape:** two or more bills on the ordered item AND a delivered quantity covering some but not all of them. Then it is filled **oldest bill first** — `Issue Date` ascending, tie-broken by `Invoice ID` — because that is the order the bills were raised in. `Issue Date` is human-entered and backdatable, the property #164 learned the hard way; tolerable here because the consequence is a coin-flip landing the other way on a cell already marked, not a corrupted record. An undated bill sorts LAST, the same call `sortCandidates` makes.
  - **THE CONTAINMENT PREMISE WAS A STATEMENT ABOUT PRACTICE, NOT A MEASURED FACT (`CONTAINMENT_PREMISE`) — AND #210 MADE IT A FIELD.** #166: one invoice is contained entirely within one delivery, a vendor does not bill for half a shipment, and **nothing in the data enforces it** — no delivery-to-invoice link, no field recording the pairing, no write path checking it. What it bought was that 80 billed across two bills with 40 delivered satisfies ONE of them completely rather than half of each, which made "this one has not been delivered" a one-in-two chance of naming the right invoice rather than a middle value in the data nowhere. If it broke, the inference did not degrade into "roughly right": it became wrong in a different way, handing a whole invoice a coverage that belonged to part of two. **The premise is now the SHAPE of `Invoices."Delivery"`** — single on the invoice side, plural on the delivery's — so it is stated where the data can hold it, checked on write, and the constant is gone rather than kept as a comment in a string.
  - One uncertain invoice item makes the invoice's answer uncertain — it does not average out across invoice items. **The shape survived its cause:** one SHORT invoice item now makes the whole invoice carry the mismatch marker, for the same reason — the reader has to open the invoice either way.
- **THE INVOICE'S VERDICT HAS FOUR OUTCOMES, AND TWO WERE DELETED RATHER THAN DOCUMENTED.** A share's delivered quantity is CLAMPED at what its own bill billed, so `delivered > invoiced` cannot occur at invoice scope: `arrived-more` had no reader on the invoice path at all, and `nothing-invoiced` collapsed into "nothing delivered" for the same reason. This repo has been burned repeatedly by things with no caller — `upsertMaterial` carried three defects from Phase 0 to #18 — so an unreachable state is removed, not left standing with a comment. What `arrived-more` used to say is now said **on the order's own terms** (delivered > ordered) by the `Against the order:` line, which gives one fact one reader. The four: `All billed material delivered` / `N EA more billed than delivered` / `Nothing delivered yet` / `Not compared — no ordered item`.
- **An invoice summarizes by INVOICE ITEM COUNT, not by quantity**, and that is forced rather than chosen: its invoice items carry different Units, so adding their quantities produces a number of nothing. The count no longer reaches the screen — it decides the chip — but it is still what the chip is decided by. **#210: the count decides nothing at all now.** The chip comes from the link; the count is reported for the detail and the constraint that forced it still holds for anything that would add quantities across invoice items.
- **"No invoice item complete" and "nothing delivered" are different claims, and the chip kept them apart.** `awaiting-delivery` was reserved for no quantity having been delivered at all; an incomplete invoice item was `Partly delivered`. The first version keyed that on the completed-line count alone, so a one-line invoice billing 13 with 10 delivered read as nothing delivered. **Caught by reading seeded demo data rather than by a check**, which is why the seed exists and why `summarizeInvoiceStatus` carried `anyArrived`. **#210 dissolved the distinction rather than fixing it again:** both claims were about how much of a bill had arrived, and neither is what the chip answers now — `awaiting-delivery` means no shipment is NAMED, and every quantity question is the marker's or the detail's. `anyArrived` is gone with `Partly delivered`.
- **An invoice item with no `PO Item` is excluded from the judgment — and it is NOT a freight rule**, though that is the obvious misreading. A vendor's freight arrives on `Invoices."Shipping Fee"`, a header field; item rows are for material only. The app creates no `PO Item`-less item row at all, since the free-text "Other" option is hidden (`SHOW_OTHER_ITEM_OPTION = false`, #96), so a conforming invoice has none — the ones on this base are **hand-entered dummy data**, which CLAUDE.md already records for `HYE-INV-260727-04`. The rule is still needed because #96 hid the UI option and left the backend path intact, so flipping that flag is the whole of re-exposing it. Excluding is right regardless of provenance: such an invoice item names no ordered quantity, so counting it would make the invoice read as short through comparing something to nothing. **It is excluded from the JUDGMENT, not from the screen:** it gets its own box saying `Not compared — no ordered item`, where the invoice item is, rather than a parenthetical about an invoice item the reader cannot see.
- **`invoicedQty` comes from the `Invoiced Qty` rollup — the ordered item's total across every invoice — and never from summing the invoice in hand.** An ordered item can carry two invoices; summing only one would report material as unbilled when it is billed twice over. `verify-delivery-status-166.mjs` Part D creates exactly that case: 16 billed on the ordered item, 6 on the invoice being read, 10 delivered.
- **The delivered side reads `Delivery Items`, not the rollup**, because `Delivered Qty` sums within-order and beyond-order into one number and only the rows carry `Over Delivered`. This is the reader that made that distinction load-bearing rather than theoretical.
- **The query budget was 5 operations on the invoice axis and 3 on the delivery axis, measured, and never grew with row count.** Two of the five existed because the answer is attributed: deciding whether THIS bill was covered meant reading every OTHER bill on the same ordered item and its `Issue Date`, which the caller never asked about. Refusing to attribute cost 3 and could not answer the question — `verify-delivery-status-166.mjs` Part E counts them with the same `_selectRecords` / `_findRecordById` instrument `verify-material-price-19.mjs` Part E uses, comparing one row against several (measured 5 for one invoice against 4 for three). The invoice detail was 5 too, adding the Deliveries themselves for their dates. **These are CEILINGS rather than fixed numbers:** an empty level costs no query at all, since `findByRecordIds` returns early on an empty id list. So the property to assert is "never more", not "exactly equal", and the two measurements have to be shape-matched. Recorded because the first version of the check read both asymmetries as per-row growth.
  - **#210 TOOK IT TO 3 / 3 / 3, and the two levels it removed are exactly the two attribution needed.** Measured on the live base, read-only, with the same instrument: invoice axis 3 for one paired invoice and 3 for all 15; the detail 3; delivery axis 3 for one shipment a bill names and 3 for all 15. The ceiling property holds harder than before — an invoice naming no shipment measures **1**, and so does a shipment nothing names, because both levels below the link are then empty. **The list axis stopped reading `PO Items` altogether**: what a bill charges against what its shipment brought needs neither, and what was ORDERED is a third document's figure that only the detail shows. The two axes now cost the SAME, which they did not before — so an assertion that the invoice axis costs more would be asserting the defect.
- **The invoicing column and the `unbilled` filter were President-or-Admin, WITHHELD ON THE SERVER — and #211 RELEASED THEM.** #166's reasoning: the deliveries list is Job-scoped, so site staff reach it, and whether a vendor has billed for a delivery is office information; gating in JSX would leave the data in the page payload, so `getDeliveryInvoicing` was **not called at all** for a non-privileged viewer. The mechanism was right and is worth keeping in mind — withholding means not fetching, the same decision as `/pos/[poId]` filtering invoice-derived fields out on the server (#132). **What did not survive is the line it drew.** #211 opened the invoice routes to any viewer who can see the order behind an invoice item, and every row on this list is a delivery on a job the viewer is assigned to, which is exactly that condition — so the column was hiding a fact readable one screen away. A rule that hides a figure on one screen and shows it on another is not a rule. `getDeliveryInvoicing` is called for every viewer now, and both filters exist for every viewer.
  - **`resolveDeliveryFilters` is GONE with it**, and the deletion is the point rather than a tidy-up. It existed so `?unbilled=1` would be treated as ABSENT for a viewer whose rows carried no invoicing key — a filter over a column that was never fetched would silently empty the list — and once every viewer gets the column there is no such viewer. What was left was `{ unbilled: Boolean(a), over: Boolean(b) }`: a named rule with no rule in it, and two callers that could no longer disagree because nothing was left to agree about. Removed rather than left standing with a comment, the same call `lib/deliveryStatus.js` made on `arrived-more` and `nothing-invoiced`. `offline/delivery-status.mjs` asserts the export is gone, so a re-added gate fails CI.
  - **`/deliveries` went from two column budgets to one** for the same reason, and the surviving six-column row is the one every measurement in that comment was taken against.
  - **Payment never appeared on these screens and still does not** — see "Payment is President-or-Admin" above for the line that replaced this one.

- **THE INVOICE DETAIL IS ONE BOX PER INVOICE ITEM, in the items table's own order**, with at most six lines inside it: the item, `Ordered · Billed · Delivered`, `This bill:`, the verdict, `Against the order:`, the inferred sentence, and the deliveries. **#210 took the inferred sentence out**, so it is five, and gave the deliveries line one more thing to say — see below. **#232 TOOK IT TO ONE, AND USUALLY TO NONE** — a box that agrees is its item name and nothing else. The deliveries moved out, `This bill:` went, the figures line went, and the verdict and `Against the ordered item:` appear only on a box with something to report. Everything from that point in this section down is #166's and #210's record; what the box is NOW is under "Scoping the box to its invoice (#232)" below.
  - **The section heading carries the SAME CHIP the list showed, from the same function**, so the row a reader clicked and the page they land on cannot describe the invoice differently — #162's `summarizeDelivery` is shared between its list and its detail for exactly this reason.
  - **All three figures are the ORDERED ITEM's totals, including `Billed`**, which is every bill on it rather than this one. That is what makes them comparable with each other and with the deliveries listed under them. Usually this invoice IS the only bill, so `Billed` is also this invoice's figure.
  - **`This bill: 5 of 13` appeared on EXACTLY the condition the inferred marker did**, and that identity was the point rather than a coincidence: the share line explained why the answer had to be inferred, so one without the other would either raise a question it does not answer or answer one nobody asked. It was NARROWER than "the ordered item carries more than one bill" — two bills whose material all arrived needed no inference, so neither line appeared. Asserted as an equality in `offline/delivery-status.mjs` over every input shape. **#210 KEPT THE LINE AND CHANGED WHAT PUTS IT THERE** (`sharesOrderedItem`): with no guess to explain, what is left is the plain fact that the ordered item carries another bill, which is exactly the condition once thought too WIDE. It is needed for a different reason — `Billed` on the figures line is the ordered item's total, so without this a reader takes it for this invoice's own — and it is now arithmetic on two figures the box already holds rather than a flag threaded down from the allocator.
  - **COLOR ON THE VERDICT LINE ONLY.** `Against the order:` is a fact about the ORDER rather than about this bill, and the inferred sentence was a qualifier; with all three amber, as the first version had them, the color distinguished nothing. `describeInvoiceLine` returns **named slots** rather than a list, so which one is colored is beyond a call site's reach. **Two slots since #210** (`verdict` / `againstOrder`) — the property the shape exists for is unchanged by losing the third.
  - **`Against the order:` is ONE line even when both sides exceed the order** — `3 EA more billed, 2 EA more delivered` — because it is one comparison with two terms, not two problems. The billed side comes first, being the side this screen is about.
  - **The deliveries sit INSIDE the box, labeled just `Deliveries ·`.** A box is scoped to one ordered item, so listing them there is exactly the claim the data supports; the foot-of-page section they used to live in needed the heading "recorded against the same order lines" to avoid over-claiming, and inside the box that qualification is structural. What #166 could still not claim: WHICH delivery brought the quantity attributed to this bill — the quantity was attributed, the arrival was not. **#210 CLAIMS IT.** The shipment this invoice names is marked and sorted first; the others stay listed, because they are what explains a `Delivered` total larger than this bill's share. **THE WHOLE FRAME OF THIS BOX PREDATES #210 AND IS NOW AN OPEN QUESTION, raised as its own issue by #231**, which changed two words here and nothing else. What it found while editing this screen for the pairing banner: the three figures are ALL the ordered item's, `Billed` included, and the deliveries listed are every arrival that touched the ordered item — so on an invoice that names no shipment, the box still shows another bill's shipment under figures that are not this document's. `HYE-INV-260804-04` is that case on this base: `Billed 30 EA` while it bills 15, `HYE-DL-260804-06` listed although that is `HYE-INV-260804-05`'s shipment, and `Nothing delivered yet` as the verdict. That frame was the honest one when #166 built it, because nothing recorded which delivery answered which bill and the ordered item's context was all that could be claimed; #210 stored the pairing and hung the marker on the frame without revisiting it. Two consequences worth carrying into that issue: `This bill:` exists only because `Billed` is the ordered item's, and this box's delivery line was **the only place in the app that named which arrivals filled an ordered item** — the PO detail carried `Delivered` and `Undelivered` quantities but no delivery identity (#169), the delivery detail goes the other way, and the materials screens never mention deliveries. **That sentence was true when #231 wrote it and #233 made it false the next day**, in three of its clauses at once: `/pos/[poId]` now lists the deliveries filling an order and names each one, it dropped the `Undelivered` column (each cell was its row's own `Qty` less the column beside it), and naming those deliveries IS the delivery identity it says the page has none of. Corrected here per #181, in the branch that found it. The order of the two issues was chosen for exactly this: #233 built the place that answers the question before #232 stopped this box from answering it. **The mark reads `— attached to this invoice` since #231**, which found `— this invoice` sitting directly after a delivery id and reading as a name for it; that is true whatever the box becomes, and the two words go with the marker if the marker goes. Measured 2026-08-14: all 9 boxes on this base that list any delivery list exactly one, the two ordered items filled by two arrivals being billed by nobody, so the marker has never distinguished anything — which is part of why its wording read as a label. No offline check pinned the phrase and no copy constant held it: it is written straight into JSX, which is the reach #227's sweep does not have.
- **`/invoices` CARRIES THE STATUS CHIP AND NOTHING ELSE — both exception tags left that screen, for different reasons.** `beyond order` (billed > ordered) is already on the same page as the `⚠ Variance` badge in the items table, which `Invoice Items.Variance Flag` drives: one fact rendered twice on one screen. `over-delivery` (delivered > ordered) is not a fact about the invoice at all but about the ordered item, and inside a column headed `Delivery` it reads as "more arrived than this bill covers" — a different and wrong claim. Both facts are on the detail, under the ordered item they belong to. **`/deliveries` KEEPS its `Over-delivered` tag**, and the difference is whose fact it is: an over-delivery is a fact about that delivery, so it sits on the delivery's own row without changing frame.
- **The filter follows the PR list's pattern (#119)**: the server sends rows it has already computed, a Client Component narrows them instantly with no Apply button, and the active filter is mirrored into the URL with `router.replace` — no navigation, no history entry, no server round trip — so refresh, a shared link and the back button all restore the view. It is `Over-delivered` (`?over=1`); the name does not say "only", because a filter is a toggle and the word is implied. **There were two until #216**, which moved `Not fully invoiced · oldest first` (`?unbilled=1`) to a strip above `/invoices` — see that issue's section below.
- **`Not fully invoiced` TAKES BOTH INCOMPLETE STATES, not just the empty one** (`isNotFullyInvoiced`). A delivery carrying two materials where only one has been billed is exactly "it is here and there is no invoice for it" — the thing the month-end email to every vendor stands in for — and filtering on `awaiting-invoice` alone dropped it. Verified on the seed: widening added a row to the worklist, and the row it added is that two-material delivery.
- **"Oldest first" is a property of that filter, not a separate sort control.** That list is the vendor-chasing worklist replacing the month-end email, so the longest-waiting delivery belongs at the top while the default list stays newest-first. `Received Date` ASCENDING, because the wait starts when the material arrived rather than when someone typed it in; it is human-entered and backdatable, which #164 learned the hard way when an ID counter read such a field, and the consequence here is milder — a mistyped date sits at the top of a worklist — but it is the same property. `Created At` DESCENDING as the tie-break, matching the default list's direction exactly, so only the primary key flips between the two orderings and the tie-break carries no meaning of its own. An undated delivery sorts LAST, the same call `sortCandidates` makes.
- **BOTH LIST TABLES ARE `table-fixed` WITH A DECLARED `colgroup` SUMMING TO EXACTLY 52rem**, which is what a `max-w-4xl` page minus `p-8` has (832px). A column is never appended; the budget is re-cut. Measured against each base's widest real cells, with every row one line, no wrap and no horizontal scrollbar.
  - `/deliveries` (6 columns): `8.5 + 8 + 5.5 + 17.5 + 6.75 + 5.75`. The chip is far narrower than the sentence it replaced, so **Invoiced gave room back to Delivered** — the column that needed it and the only one that was wrapping, since it carries an item label, a `+N` count and an `Over-delivered` tag on one line (measured 270px for `165-DEMO Elbow 3" 3 PCS` beside the tag). **That measurement has since stopped covering the base's widest cell:** #167's seed added `167-DEMO Coupling 2"`, and #210 measured 1 of 15 rows wrapping to 63px on it. Neither the column set nor its widths changed in #210, so this is the #166 budget going stale as demo data grew rather than a regression — reported as a finding rather than fixed there, since re-cutting a 52rem budget is that comment's own work.
  - `/invoices` (7 columns) got a `colgroup` it never had: an auto-layout table sized the Delivery column from the longest phrase in it, so every other column moved when one invoice's status changed. **This table has almost no slack — seven columns need 832px against 832px.** Six of the seven are bounded by construction and cannot grow: an Invoice ID is a fixed format (128px), a date is ten characters (80px), the Delivery column is a closed set plus a marker (120px — **unchanged by #210**, which took the set from three chips to two: the one that left was not the widest, `Awaiting delivery` still is, and re-measured at 832px with rows at 28.5–29px and no horizontal scrollbar), `Amount Due` is bound by its own header (78px), and Status by `Paid 2026-07-27` beside a `⚠ Variance` badge (176px — which is why **the last column drops its right padding**, there being nothing to its right to separate it from). So **Vendor is where the slack isn't**: 8rem holds this base's longest name at 16 characters with nothing to spare, and it is also the column where wrapping would be least harmful if a longer supplier is ever added. The worst case was verified by injecting it into a rendered row, the way #19 injected a full-length PO ID. **#211 gave this table a SECOND budget rather than a seventh column**, the way `/pos/[poId]` carries two column counts: for a non-privileged viewer the last column holds the variance badge alone and needs 5rem instead of 11rem, and **the 6rem that frees goes to Vendor** — the column this paragraph records as having none, which then clears the longest name by 6rem instead of by nothing. Both rows still sum to exactly 52rem; measured at 832px with every row 29px and no horizontal scrollbar on both.
- **Not in this issue:** nothing is written anywhere, no `Invoices.Delivery` link, no new screen, and no correction of an overage — that is #167. The existing invoice visibility rules are unchanged: the invoice list and detail stay President-or-Admin, editing stays Admin, deliveries stay Job-scoped. **Two of those have since been done rather than reconsidered:** #210 added the link and the writes that fill it, and #211 made the invoice list and detail row-scoped instead of President-or-Admin.

### Overage corrections (#167)

More arrived than was ordered, the vendor billed for it, and the record has to be squared with the money: a corrective PR and PO for the difference, after which the excess lives on its own ordered item. `lib/overage.js` judges, `lib/overagePR.js` reads and writes, `lib/invoiceItemFold.js` puts the invoice's items table back together.

- **THE EXCESS NEEDS NO ARITHMETIC, and that is #162's decision paying off.** An over-delivery is its own `Delivery Items` row whose `Qty` IS the excess, so nothing here subtracts ordered from delivered. Every figure the correction carries comes from a record rather than a calculation: quantity from the row, unit price and vendor code from the invoice item, Job/Line/Vendor from the order the excess was attached to, the chain from that order's PR.
- **A REAL DRAFT RECORD, not a prefilled `/prs/new`.** The quotation is the vendor's invoice, which means fetching Airtable's copy of the file server-side and writing a FRESH Blob object for Airtable to ingest — handing the form an Airtable attachment url to re-submit is exactly the silent data loss #142 measured. Creating the record also gives `Delivery Items."Overage PR"` something to point at immediately, which is what makes the row read as pending from the moment the button is used. The redirect goes to `/prs/new?draft=<prId>`, the existing #72 resume path, and `loadPRDraft` hydrates the signer chain — which is what makes the inactive-signer decision below possible at all.
- **JOB-SCOPED, NOT OFFICE-GATED, AND THAT NARROWS #166 ON PURPOSE.** Raising the request is site work, per the issue. But the affordance reveals that the over-delivered ordered item is billed, by which invoice, and at what unit price — and #166, one issue earlier, withheld exactly "whether a vendor has billed" from site staff on the deliveries LIST. That column stayed withheld and unfetched for anyone else; this was a deliberate exception on the DETAIL, because none of those three facts can be hidden from someone raising a request quoted from the invoice (the vendor's invoice code lands on the Quotation they then edit). Recorded as a reversal rather than left as a contradiction between two comments. **#211 THEN RELEASED THE COLUMN TO EVERY VIEWER, so this is an exception to nothing now** — the reasoning stands as what the disclosure here rests on, but the contrast it was drawn against is gone, and `getPOItemsForReconciliation`'s own doc comment records the same retirement.
- **WHICH BILL CARRIES THE EXCESS IS #166'S AMBIGUITY, SO IT IS #166'S ORDERING** — `sortInvoicesOldestFirst`, imported rather than restated, and `offline/overage.mjs` asserts on the AST that `lib/overage.js` imports it and sorts nothing by `Issue Date` itself. The premise sentence is shared too (`INFERRED_PREMISE`, exported from `lib/deliveryStatus.js` for this), so the two `!` markers cannot come to explain themselves differently. **#210 LEFT ONE MARKER STANDING, WHICH IS THIS ONE.** The invoice axis's inference is gone with the stored pairing, so `sortInvoicesOldestFirst` and `INFERRED_PREMISE` are now exported for this module alone and read nowhere in the one that holds them — pinned offline, because a tidy-up looking for dead exports would find exactly them. The premise was NARROWED in the same pass: it said "and the deliveries cannot be told apart", which the link made false, and it now states only the condition `selectOverageBill` actually tests. Reading which bill carries an excess off the pairing is #210's stated non-goal, because `spansInvoices` needs rethinking alongside it. **#219 DID THAT RETHINK AND EVERY SENTENCE ABOVE IS NOW HISTORY** — the candidates come from the pairing, both exports moved into `lib/overage.js` (the ordering PRIVATE there, so #182 carries no exception), one premise became two, and the AST assertions are inverted. See "Reading which bill carries an excess" at the foot.
  - **What is NOT reused is `allocateLineToInvoices`'s `determinate` flag**, and the reason is that it answers a different question. There, determinacy means the outcome does not depend on the order the bills are taken in — so a delivery covering EVERY bill is determinate. Here the question is which bill's INVOICE ITEM the excess quantity sits in, and full coverage leaves that wide open. **Two bills on the ordered item is the whole condition** — **two bills on this DELIVERY since #219**. The visible consequence: two bills whose material all arrived show no marker on the invoice screens and still mark the overage attribution as inferred. Those are different claims, not an inconsistency.
- **AN EXCESS SPANNING TWO INVOICES IS OUT OF SCOPE, and the reason is the quotation rather than the arithmetic:** two invoices means two files and a PR takes one. Under oldest-first that condition is exactly "the oldest bill's invoice item is smaller than the excess", so it falls out of the ordering rather than needing a rule of its own — and a LATER bill large enough to absorb it does not rescue the case, because picking it would be a second answer to #166's ambiguity. The button is hidden and says why. **#219 SPLIT THE CONDITION IN TWO, because the one message was false for half the cases it covered:** with a single candidate bill nothing spans anything, so that case says the excess is larger than what this delivery's invoice bills instead. The refusal itself stands — one request still takes one quotation.
- **GENERATING THE PO SETTLES IT, and the apply step sits OUTSIDE PO generation's rollback**, in `lib/materialsCache.js`'s position and after it (it matches the overage row to an ordered item of the new PO on #18's `Material` link, which the cache is what writes). Outside for #165's reason: a derived artifact must not undo the approval that produced it, and this one touches an invoice that may already be paid.
  - **So a failure leaves an ASYMMETRY, and it has to be visible with no email available.** Two signals, covering different halves. Re-attach failed → nothing moved, and the ONLY signal is the banner reading `not-applied`, because the row still points at an ordered item that IS invoiced so #166's worklist cannot see it. Split failed → the row moved, so the overage ordered item has a delivery and no invoice, which puts the delivery in `Not fully invoiced` as well. **Re-attach therefore runs FIRST**: the reachable middle state is the one two things notice rather than one.
  - **Idempotent, because there is no retry UI.** A row whose flag is already clear is skipped. `applied` is judged from `Former PO Item` since #206, and was judged from the flag before it. Either reads the same `update()` — `reattachDeliveryItemToPOItem` writes attachment, provenance and flag together and Airtable applies one record write atomically — but only provenance is beyond a recomputation's reach, which is what #206 needed.
- **THE INVOICE HEADER DOES NOT MOVE.** The two sides of the split sum to what the invoice item summed to, so `Items Subtotal`, `Calculated Total`, `Amount Due` and `Paid` are all untouched and only the attribution shifts. **That is what makes splitting an ALREADY PAID invoice safe, which is the common case rather than an edge one** — the bill usually arrives and is settled before anyone corrects the record. `verify-overage-167.mjs` Part C runs the whole flow on a paid invoice for exactly that reason.
  - **A bill whose WHOLE invoice item is the excess is re-pointed rather than split**, or it would be left at qty 0. `updateInvoiceItem` gained a `poRecordId` parameter for it: both links have to move together, or the invoice item would name a `PO Item` belonging to a different PO.
  - **Variance is RECOMPUTED with `checkUnitPriceVariance` and `getInvoicedQtyForPOItem`**, the two functions `createInvoiceAction` uses, rather than assumed to have cleared. The split is exactly the event that resolves a qty variance on the original invoice item, and asserting that without measuring it would be a second implementation of the rule.
  - **An `Invoice-PO Link` row is created for the overage PO.** Without it the order looks invoice-free, which would let #138 withdraw it and take the excess with it.
- **THE ITEMS TABLE FOLDS THE SPLIT BACK INTO ONE ROW, keyed on `Material` + unit price** (`lib/invoiceItemFold.js`, the invoice counterpart of `groupRowsByItem`). `Material` is what makes two rows the same item without matching `Item Name` text; the unit price is what keeps a vendor's two genuinely different prices for one material apart, since a split cannot change the price. **A row with no `Material` is never folded** and is its own group keyed on its record id — not a fallback to name matching: a split can only produce rows carrying the link, so a row without one cannot be half of one.
- **THE PO COLUMN LEFT THE ITEMS TABLE IN THE SAME COMMIT that put the order into the delivery section's boxes, and the pairing is not optional.** A folded row spans two orders, so that cell has no single value — unrepresentable rather than merely inconvenient. But removing the column alone would take "which item belongs to which order" off the page entirely, so the order moved to where it is exactly one: a box is scoped to ONE ordered item, and a split shows as two boxes each naming its own. This edits the section #166 built.
- **THE BANNER IS DERIVED FROM LINKS, on all three documents, and it outlives signature.** An overage order read on its own looks like a duplicate with no quotation of its own; worse, the invoice attached to it also bills the original order, so a payment against that invoice matches neither order's total alone. Whoever reconciles it needs telling, exactly once, there.
  - Three sites — the corrective PR (its own reverse-link), the corrective PO (one hop through its `PR`), and the ORIGINAL PO (its own ordered items' provenance reverse-link). Three states — `pending`, `applied`, `not-applied` — appended as shared entries rather than multiplied, so three × three stays 3 + 3.
  - **The caveat belongs to `applied` only.** While pending the invoice bills one order, so claiming it spans two would be false.
  - **The original PO's banner names the DELIVERY rather than claiming that order was over-delivered.** One delivery can fill two orders of the same material and #165 attaches the excess to the last one filled, so the banner is reachable from an order that was not itself exceeded — but the provenance reverse-link means only the order the excess actually came from renders it, which is what made that walk unnecessary.
- **THE INACTIVE SIGNER IS LEFT OUT, and the preview says how many.** A chain that reaches a departed signer STOPS and nothing in the app can unstick it — the turn belongs to a user who cannot log in. Arriving one signer short and saying so is better; the Draft is editable, and `createPRAction` already refuses an empty chain in its own words.
- **KNOWN GAP, recorded rather than fixed: a withdrawn overage PO.** `PO Items."Committed Qty"` is `IF({PO Status} = "Withdrawn", 0, {Qty})` but `Delivered Qty` has no status condition, so withdrawing an overage PO would drop the excess out of the order book while leaving it in the delivered figure — the excess disappears quietly. **The reachable half is handled:** `overagePRState` reads the overage PO's status one hop further and returns `none` for a withdrawn one, so a `not-applied` row reopens rather than being locked out forever by a correction that no longer exists. **The unreachable half is the gap:** an APPLIED overage carries an invoice item, and #138 refuses to withdraw a PO that has one, so today it cannot happen. If that ever changes, the fix is a status condition on `Delivered Qty` or a check in `withdrawPOAction`.
- **Not in this issue:** an excess spanning two invoices (no single quotation), any change to the invoice header, and #20. Nothing about a correction is stored as state — `Former PO Item` is provenance, not state, and every "is one pending" answer is read from the linked PR's Status.

### Recomputing over-delivery flags (#206)

`Over Delivered` records a judgment made when its row was written, and deleting a delivery can make it false: the row claims material arrived beyond what an order asked for while the ordered item it sits on is no longer over-delivered. Order 10, one delivery brings 10 and fills the ordered item, a second brings 10 more recorded entirely as surplus against that same full ordered item, delete the first — the ordered item holds 10 against an order of 10 and the surviving row still claims 10 beyond it. **Deletion is the only way to correct an item or a quantity** (`lib/deliveryDelete.js` says so itself), so that is the ordinary correction path rather than an odd ordering.

- **THE FLAG COULD NOT SIMPLY BE RECOMPUTED, because it did two jobs.** It states an arithmetic fact about one row, and it was the signal `isOverageApplied` read to decide whether a correction's excess had moved. Recomputing would have forged `applied` on a correction that never applied — erasing the one signal that reports a real failure, since `not-applied` is the only place PO generation's asymmetry surfaces. **So `isOverageApplied` moved onto `Former PO Item` FIRST, in the same pass**, and the recomputation follows it rather than the other way round.
  - **The equivalence, and why it holds.** `Former PO Item` is written by exactly one thing, `reattachDeliveryItemToPOItem`, in the same `update()` that clears the flag; `createDeliveryItem` never writes it. So provenance set means the apply step ran, and provenance empty on a row carrying an `Overage PR` link means it did not. It rests on a row moving at most once, which is the premise already on that field's description.
  - **MEASURED, NOT ARGUED, because this base carries no overage order at all** (0, measured in #206's design pass). A temporary credentialed script created one throwaway row, ran the production re-attachment on it, and read it back: one `update()` produced BOTH halves. Old rule and new rule agreed on an unmoved row and on a moved one, and **disagreed on exactly the state #206 introduces** — a flag cleared with no move, which the old rule called `applied`. It was deleted after the run, so nothing standing re-measures this; #206's commit message is the record.
  - **That function's comment said "THE FLAG IS THE SIGNAL … That is the only signal there is", and it was already false** when #206 found it: the same write has set provenance since #167. Corrected in the same pass, along with `reattachDeliveryItemToPOItem`'s own docstring and a line in `lib/overagePR.js`'s header claiming a failed split shows `not-applied` — re-attachment runs first, so it shows `applied`, and that line was wrong under the old flag rule too.

- **IT REPRODUCES #162'S CONTRACT, NOT `planDelivery`'S ALLOCATION, and that distinction is the whole design.** The contract is two statements about QUANTITY: an ordered item's unflagged rows sum to what was ordered, and its flagged rows sum to the excess. Allocation is larger — it also decides WHICH ordered item an arrival attaches to, by FIFO across candidate ordered items. `recomputeOverDelivery` works inside one ordered item and moves only the boundary. **Holding it to "the rows a fresh allocation would produce" was tried and rejected**: that standard is already not applied to ordered item attribution, so applying it to row boundaries is inconsistent, and the rows differ for exactly that reason — an earlier delivery's freed room is not handed back to a later delivery's row, because that would BE re-allocating. Nothing in the codebase or the commit message may say the replay reproduces the allocation.
- **NOTHING IS EVER MERGED, and the reason is that merging adds no correctness.** Two adjacent unflagged rows are redundant, not false; the contract counts quantities and says nothing about how few rows carry them. `groupRowsByItem`'s `rowCount` is the only thing that can see the difference, and it is read by no screen — measured across `lib/` and `app/`.
- **THE STRADDLING ROW IS SPLIT, NOT ROUNDED**, and that is what keeps #162's contract true rather than trading one falsehood for another. A row beginning inside the order and ending beyond it cannot be stated by a flag: unflagged claims the whole quantity arrived within the order, flagged whole claims it was all excess. **At most one per ordered item**, because every stored row has a positive `Qty` — both of `planDelivery`'s push sites guarantee it — so the running total is strictly increasing and crosses once.
- **WHICH PIECE KEEPS THE RECORD IS LOAD-BEARING, and the first choice was wrong.** The existing row is resized to the WITHIN piece and the excess becomes the new row. A new row is minted by `generateChildId` and therefore sorts LAST, so putting the within piece there leaves an ordered item reading `within, over, within` — measured, and a second run then moves the flag onto a different record, which would silently take it off a row carrying an `Overage PR` link. With the excess as the new row the result is stable under a second run. **That ordering is also why the link never moves**: the resized record keeps whatever it held and simply stops being flagged.
- **THE `Overage PR` LINK IS NEVER CLEARED.** Delete-then-reenter is the correction path, so a link destroyed mid-edit could not be restored when the excess reappears seconds later. Withdrawal needs no trigger either: `overagePRState` already returns `none` for a withdrawn overage order.
- **What replaces the clearing is a QUALIFIER, not a fourth state** — #166's shape, where `inferred` is a marker beside a chip rather than a value inside it, so three states plus a qualifier stays 3 + 1. `isNoLongerOverDelivered` fires when a row holds the link, has no provenance, and is no longer flagged. **Two voices, not three:** a pending request has been approved by nobody and an unapplied overage order carries no invoice, so #138 admits withdrawing both; an applied one cannot be withdrawn, and naming an unavailable action would be worse than silence. **The applied voice is absent rather than written, because that combination cannot arise** — an applied row sits alone on the overage order's ordered item, whose `Qty` is the excess exactly, so a recomputation there always finds it within.
  - **The other shape of mismatch — a linked row still flagged but carrying a different quantity from the one its correction covers — is NOT a clause here, because a delete cannot produce it.** The only row a delete resizes is the one that stops being flagged; every other flagged row keeps its quantity. It is reachable by editing a draft correction's quantity, which is outside #206 and would cost a read of the overage order's own items on every banner render.
- **DELETING A DELIVERY NOW CREATES ROWS, and never removes them.** Two batched reads at 50 ids per query, then one `update()` per row whose quantity or flag changes and one `create()` per straddling ordered item. An ordinary one-line delete pays two reads and no writes. No row is deleted and no row is merged, so the only records touched are the ones resized and the ones added.
- **RESIZE BEFORE CREATE, and the order is the failure mode rather than style.** A create that fails after the resize loses the excess from the ordered item's recorded total — material that arrived reads as not arrived, and the next recomputation finds no straddle and changes nothing further. The other order fails the other way: a created excess with the straddler still at full size leaves the ordered item reading as MORE delivered than arrived, which #169 records as the worse direction, since nobody goes looking for material the record already claims. Both are bounded and neither compounds; this is the one that does not fabricate arrival. The whole step is best-effort in `lib/materialsCache.js`'s shape — the delivery is already gone, so a failure here is logged rather than reported as a failed delete.
- **A PRECONDITION CAME WITH IT.** `deleteDeliveryAsUser` discarded its `Promise.allSettled` results — the exact defect `offline/fixture-cleanup.mjs` bans in verification scripts, sitting in production. A row that failed to delete was silently absent and the parent went anyway. #206 makes that a correctness matter: a surviving row missing from the recomputation's input would have the boundary drawn against an ordered item that is not what is stored. The destroys are sequential now and a failed child throws before the parent goes.
- **The offline check asserts the CONTRACT and its own reachability.** Per ordered item: unflagged rows sum to the ordered quantity, flagged rows sum to the excess, the total is unchanged, and those two quantities match a fresh allocation of the surviving arrivals — quantities only, never rows. Its anti-vacuity is that the corpus must CONTAIN a straddle and the straddle must have produced a split; dropping the three straddling scenarios leaves all twelve contract assertions passing and fails exactly those two, which is the hole they exist to fill.
- **THE BANNER REACHES TWO DETAIL PAGES AND NO LIST, so a correction that has come adrift is only seen by someone who opens it.** `/prs/[prId]` and `/pos/[poId]` render it; `/prs`, `/pos` and `/deliveries` do not. That is survivable for `In Review` and `Awaiting Signature`, where a signer has to open the page to act and the banner sits above `SigningPanel` — but a `Draft` or an `Approved`/`PO Signed` correction is a page nobody has a reason to reopen, so the mismatch reaches no one. Same family as #198 (a state that exists only on a detail page and has no list to surface it), and raised there rather than as its own issue.
- **Not in this issue:** backdated entry, which misattributes which delivery carries a surplus without making any flag false.

### The invoice-to-delivery pairing (#210)

`Invoices."Delivery"` names the shipment a bill describes. It is the office rule #166 could only state in prose written down where the data can hold it, and it replaces an estimate rather than adding a figure beside one. `lib/deliveryInvoiceLink.js` is the rule and its copy; `lib/deliveryInvoiceCandidates.js` is the gated read and the guarded write.

- **THE ESTIMATE WAS WRONG IN THE CASE THE FEATURE EXISTS FOR, and that is why this is a correction rather than a refinement.** `allocateLineToInvoices` filled an ordered item's bills oldest-first with whatever had arrived on it. A delivery can carry material nobody has billed yet, so the fill ran past the bill it should have satisfied and spilled the remainder onto the next one — and an invoice whose own shipment had not arrived at all then read `Partly delivered`. Under the containment premise that state cannot mean a stage: a bill is either delivered or awaiting delivery, and anything between is a vendor shipping less than it billed. **The inference manufactured it out of the very condition the `Awaiting invoice` worklist exists to surface.** On the delivery side the same shape: `summarizeDeliveryInvoicing` asked whether each ordered item an arrival filled carried ANY `Invoice Items` at all, so a shipment with nothing billed dropped off the chasing worklist as soon as some earlier bill had touched the same order.
- **MEASURED ON THE SEEDED SCENARIO IT WAS BUILT FROM.** #166's scenario D is two bills of 15 on one ordered item of 30 with 15 delivered. Under the fill, `166-DEMO D older bill` read `Delivered` and `166-DEMO D newer bill` read `Awaiting delivery`, both marked inferred. The 15 that arrived is the newer bill's shipment: pairing it moves `Delivered` onto the newer bill and leaves the older `Awaiting delivery`, which is the answer the old code had exactly backwards on a coin-flip it announced as a coin-flip. Both readings were produced in a browser against the live base.
- **n:1, AND THE ASYMMETRY IS THE RULE.** Single on the invoice, plural on the delivery: a shipment can be billed in more than one document while a bill is not split across shipments. So a refusal is always about an invoice and never about a delivery, and `taken-by-another` is the only one that names another record.
- **SINGLE-RECORD IS APP-ENFORCED, WHICH IS A PRECEDENT RATHER THAN A COMPROMISE.** The Metadata API refuses `prefersSingleRecordLink` on field CREATE and field UPDATE alike (422, re-measured when this field was created — `prefersSingleRecordLink: false` came back on both halves). `Invoice Items."PO Item"` and `Delivery Items."Overage PR"` already live with it. So the read side flattens through one function (`linkedDelivery`) and no reader iterates: a second link could only arrive by hand, and treating it as meaningful would turn one hand edit into two contradictory answers on two screens.
- **SET FROM THE DELIVERY SIDE, WHICH IS THE ORDER THE DOCUMENTS ARRIVE IN.** The vendor emails the invoice at shipment, so the bill is normally on hand FIRST and the packing list that comes with the material carries its number. The office cannot pair them — it does not know which shipment a number belongs to — so the recorder does, at entry or later. **This is the correction the groundwork commit made**: the reason `Delivery Items` links `PO Item` is availability, not order of arrival, and as written it read as an argument against this link.
- **A DROPDOWN, NOT A TYPED NUMBER, AND #211 IS WHAT CHANGED THAT.** The design that reached this issue chose a number input for one reason: a picker has to show invoice numbers, and #166 withheld invoice existence from site staff, so typing was the only shape that disclosed nothing. #211 opened the invoice routes to any viewer who may see the order behind an invoice item — which every row of the delivery form already is — so the disclosure is gone and the picker is strictly better: it cannot be mistyped and it cannot name an invoice that does not exist. What it cannot do is invent one, which is why blank is a normal answer and the field says so where the blank is.
- **THE SCOPE GATE IS `canViewPR`, THROUGH `lib/invoiceVisibility.js`, AND THE SHORTCUT THAT WAS TEMPTING IS WORTH NAMING.** `getDeliveryCandidates` already holds every purchase order on the viewer's jobs, so "an invoice billing one of those orders" is free — and it is a SECOND answer to the visibility question that would disagree with the first, since `canViewPR` also admits a requester, a signer and the recipient of a correction request, none of whom need a Job assignment. `offline/invoice-visibility.mjs` asserts the new module imports the walk, calls it TWICE (once on the read, once in the guard) and does not import `deliveryCandidates` at all.
  - **AND THE ANSWER IS REQUIRED, BECAUSE THE FIRST VERSION FAILED OPEN.** `invoiceLinkRefusal` tested `visible === false`, so as not to confuse "refused" with "not asked" — which made a caller who forgot the argument pass the gate. The distinction was deliberate and the direction was still wrong: a permission check whose DEFAULT is admit is the hazard whatever its reason, and nothing asserted that the one caller passed it, so the safety of that shape rested on a fact no check could see. It **throws** now, and the choice of a throw over an AST check over call sites is `verification.md`'s own — "source shape is not execution", and an AST check can see neither an indirect call nor whether the value passed was right. It is also the call `lib/airtableFormula.js:orByField` already makes for a caller bug. A non-boolean throws too, since coercing `"yes"` to admit or `null` to refuse would both answer a question nobody asked. **What the throw costs is that a forgetful caller 500s instead of failing CI**, so the one call site is pinned in `offline/invoice-visibility.mjs` beside the other call-site claims — covering the cost rather than replacing the guard. **What neither proves** is that the value is CORRECT: a caller passing `true` unconditionally satisfies both, which is the browser's and the credentialed tier's to establish.
- **VENDOR IS THE WHOLE NARROWING, AND DELIBERATELY NOT THE JOB.** An invoice can bill orders on more than one job, so narrowing by job could hide the right bill; a delivery has exactly one vendor and a bill from another supplier is never the answer. The viewer's own scope is already applied by the gate, so the vendor filter is semantic rather than a second gate.
- **AN ALREADY-PAIRED BILL STAYS ON THE LIST, unselectable, naming where it went** — #162's rule applied one level up. Its item dropdown lists a fully delivered item rather than dropping it, because dropping it lands the recorder on "not in the dropdown", which says it may never have been ordered here and would be false. The same is true of a bill somebody paired: it exists, it is this vendor's, and a recorder holding a packing list that names it needs telling where it went rather than shown a gap. **The delivery is NAMED only when the reader may reach it** — a delivery is Job-scoped and an invoice can bill two jobs, so the holder is not always in view, and naming it then would confirm a record outside someone's scope.
  - **THE REFUSAL MAKES THE SAME SPLIT, AND #206'S RULE IS WHY.** `taken-by-another` ended `detach it there first if this is the right shipment`, which names an action the reader cannot take whenever the holder is outside their scope — it sends them to a page that will tell them the delivery does not exist. #206 gave its own qualifier two voices rather than three on exactly this ground: naming an unavailable action is worse than silence. So the FACT is shared and only the action is conditional, the arrangement `noLongerOverSentence` uses: both voices say the bill is taken and say the rule that makes it exclusive, and only the reachable one says what to do about it. **Nothing is invented for the other voice** — "ask the office" would name a process this app does not model, and the reader can see the invoice, so the fact is what they act on.
- **DETACH RATHER THAN SWAP.** Re-pointing a bill is a claim about two shipments at once, so it is two steps: the screen it left says so, and the refusal stays truthful instead of being something the app silently overrides. Detaching passes no vendor to the predicate, because a pairing that somehow crossed vendors has to stay detachable — otherwise the refusal locks in the state it objects to.
- **THE ENTRY PATH GUARDS BEFORE IT CREATES AND WRITES LAST, INSIDE THE ROLLBACK.** Refusing after a create would mean rolling an arrival back over a pairing; writing the link last means nothing follows it, so a failure cannot leave a pairing whose delivery was then destroyed. Destroying the delivery removes the link with it, so the rollback needs no undo of its own. `deliveryRecordId` is null at guard time and that is the correct reading rather than a special case: the delivery does not exist yet, so ANY existing pairing is a refusal.
- **EDITABLE IN PLACE, AND IT PASSES THE TEST THE OTHER FOUR FIELDS FAIL.** Item, quantity, vendor and packing-list PO are fixed on one ground: changing them changes what the arrival was allocated against, and there is deliberately no allocation-editing UI. A pairing changes no `Delivery Items` row, moves no quantity between orders and re-runs nothing — it is orthogonal to that reason, which is why it joins the received date, the note and the photo rather than the delete-and-re-enter list.
- **THE INVOICE AXIS IS TWO STATES AND A DISCREPANCY.** The chip is the link's own two values; a quantity shortfall is a marker beside it. **No marker without a link** — every invoice item of an unpaired invoice is trivially short, so marking them would put a discrepancy on nearly every bill on the base. The dash left the axis too, and as UNREACHABLE rather than unwanted: it meant "there was nothing to compare", which was true while the chip came from the invoice items, and the chip comes from a header field now. **#232 MADE THE DISCREPANCY THE THIRD VALUE** and retired the marker on both invoice screens; the "no marker without a link" clause survives as the clause order inside `summarizeInvoiceStatus`, which asks about the link before it asks about quantities. See the premise section at the top for why a third value does not reopen what this issue closed.
- **THE DELIVERY AXIS KEEPS THREE KEYS, AND THAT IS NOT A BARE LOOKUP.** The issue's own wording was "turns `summarizeDeliveryInvoicing` from a line-level existence test into a lookup", and a literal lookup would be wrong: a shipment can carry material nobody has billed yet, so "does this delivery have an invoice" would read `Invoiced` while half of it is still owed. So it compares, per ordered item, what the bills NAMING this delivery charge against what this delivery brought — and the middle key is the state the worklist exists for. `>=` rather than `===`, because a vendor billing more than it shipped is the invoice axis's discrepancy and leaves nothing to chase from this side.
- **THE SEED WAS NOT CHANGED, AND THE PAIRINGS ON THIS BASE WERE MADE THROUGH THE APP.** Every seed here is skip-if-exists, so teaching one to write this field would produce nothing on an already-seeded base — a claim about future coverage rather than a verification of the present one, which `verification.md` records measuring on #181. Two demo shipments were paired through the real attach path instead, which is both the data and the verification.
- **Not in this issue:** `selectOverageBill` (#167) still guesses which bill carries an excess and becomes a lookup once this pairing exists, but its `spansInvoices` refusal needs rethinking alongside it — **#219 is that issue, and the answer was not a lookup but a tiered narrowing**, because an invoice naming no delivery is this feature's own ordinary state rather than a gap; `/pos` and `/pos/[poId]` are untouched, since the PO axis compares delivered against ORDERED and no bill enters it; and #20 is still where "what should ordered mean" is decided.

### Deliveries

- **`Job` is a direct link, not a lookup through PO**, because a delivery may name no PO at all — site orders first and the PR/PO follow as a record — and the Job is what scopes both authorization and the item dropdown, so it must be present unconditionally.
- **`Created At` was added because the ID counter needed a field nobody can backdate, and #164 then took that reader away** — the counter now counts the ID prefix and reads no date field at all (see "The daily counter counts the ID prefix"). The field stays, on its other two readers: the deliveries list's tie-break, and being the only timestamp on the record nobody typed — a packing list often carries no date at all, unlike a vendor invoice, so `Received Date` can be an unbacked guess. What #162's reasoning got right is unchanged and is why the rule generalized: `Received Date` is routinely earlier than entry (material arrives late afternoon, gets recorded next morning), so counting on it would have made the ID's date and the counted population different sets, which is exactly what `generateNextInvoiceId` was doing.
- **`Packing List PO` is the packing list's own reference, recorded even when allocation could attribute nothing to it.** Deliberately on the header and not on the delivery items: a delivery item links a PO ITEM, because that is what carries quantity. The two are separate levels of attribution, and an over-delivery row claims only the level it can support. **Named `PO` until #181**, where a bare `PO` was found to read as the order the arrival was recorded against — the other level entirely.
- **`Recorded By` is load-bearing, not audit** — deletion is restricted to this user plus Admin, and deletion is the only way to correct an item or a quantity.
- Editable in place: `Received Date`, `Notes`, `Packing List File`. Nothing else. Item, quantity, vendor and the packing list PO are fixed, because changing them changes what the arrival was allocated against and there is no allocation-editing UI.

### Delivery Items

- **Links to `PO Item`, never to an Invoice Item**, and the reason is AVAILABILITY rather than order of arrival: the ordered item is always there to compare an arrival against, and an invoice usually is but not always. The order runs the other way from what this bullet claimed until the dedup commit — a vendor emails the invoice when it ships and the material turns up afterwards, so the bill is normally on hand FIRST. That does not change the conclusion, because a link a rollup travels cannot be one that is sometimes empty, and "usually present" is what disqualifies it. Never matched on `Item Name` text; allocation matches on #18's `Material` link.
  - **#210 ADDED AN INVOICE LINK AND THIS BULLET STILL HOLDS, which is worth stating because the two look like the same decision.** `Invoices."Delivery"` is on the HEADER and no rollup travels it — it is a fact about which shipment a document describes, optional by design, and `summarizeDeliveryInvoicing` reads it in JS where an absent value is a state rather than a gap. A `Delivery Items` link to an INVOICE ITEM would still be the wrong thing for the reason above: `Delivered Qty` sums through this field, and a rollup over a sometimes-empty link silently under-counts. **"Usually present" is exactly why the pairing is set from the delivery side**, too — the recorder has the number in hand while the office does not know which shipment a bill belongs to.
- **`Qty` is per row, and that is what makes the rollup correct.** A link field carries no quantity, so one row pointing at two ordered items would contribute its FULL Qty to both ordered items' `Delivered Qty` (a rollup counts the row once per linked parent) and double-count. Splitting 20 into 15 + 5 is structural, not cosmetic.
- **`PO Item` is never empty on a row this app writes (#165), and the field stays optional in the schema anyway.** Those are two different statements and both are deliberate. Allocation attaches every row, including the over-delivery one, and refuses to plan at all when it has no ordered item to attach to — so `createDeliveryItem` is never called with a null link. The Airtable field is left optional because tightening it would be a schema change that buys nothing the code does not already guarantee, and because the reading side must still cope with a row whose link was removed by hand (`ALLOCATION_COPY.banner.overUnattached` renders that state rather than swallowing it). Measured at #165: 0 of the base's stored rows lack the link, so there was nothing to backfill.
- **`Item Name` / `Size` / `Unit` are never blank**, unlike Invoice Items': they come from the linked PO Item, or from the `Material` when there is no PO Item, and a Material is always linked and carries all three as its natural key.
- **`Overage PR` (link -> Purchase Requests, single) and `Former PO Item` (link -> PO Items, single) are #167's two fields**, both app-enforced as single-record: the Metadata API refuses `prefersSingleRecordLink` on field CREATE (measured 422 `INVALID_FIELD_TYPE_OPTIONS_FOR_CREATE`, another limit alongside its refusal to write a select's option list), and on field UPDATE (422 `INVALID_REQUEST_UNKNOWN`, both shapes tried), so the field is multi in Airtable and single in this app, exactly as `Invoice Items."PO Item"` already is — and the invariant is therefore checked on the stored ROWS rather than on a schema property nothing can set. Their symmetric sides are `Purchase Requests."Overage Delivery Items"` (the rows this request corrects) and `PO Items."Former Delivery Items"` (the rows that left this ordered item), and nothing writes either. **The two symmetric sides are deliberately NOT the same name**, which they were until the rename: one name for two meanings across two parents is worse than the accidental collisions #164 had to census, because it would be on purpose. The PO-side name went through `Reattached Delivery Items` first and that named THE WRONG END — the row is re-attached to the OVERAGE order's item and from this one it DEPARTED, so anyone opening the record read it backwards. `Former` says what the field it mirrors says, and beside `Delivery Items` it makes clear at a glance which of the two is the past. **`Overage PR` is the whole of "is a correction pending" — read from that PR's Status, never stored, which is what makes a withdrawal reopen the row.** **`Former PO Item` is PROVENANCE, not state:** the apply step re-points `PO Item` at the overage order, which destroys the only link back, and deriving the original through the shared Delivery breaks whenever the whole arrival was excess (#165's fully-delivered branch leaves that delivery with no other row for the material). Every reader takes `Former PO Item ?? PO Item` (`lib/overage.js:resolveOriginalPOItem`). **NAMED FOR WHAT IT STORES, WHICH IS ALWAYS A PAST VALUE** — empty on a row that never moved, the previous ordered item on one that did, and never a current one. It was briefly `Original PO Item`, chosen on the strength of that `?? PO Item` fallback, but the fallback is a property of the EXPRESSION rather than of the field: the field holds the past and the function collects an answer across both states. Named for what it holds rather than for the overage for a second reason too — a later re-attachment for some other cause belongs in the same field, and the cause is already next to it on `Overage PR`.
  - **THE FIELD AND THE FUNCTION MEAN DIFFERENT THINGS, and the premise that keeps them interchangeable is on the field's own description.** `Former PO Item` is the IMMEDIATELY PREVIOUS value; `resolveOriginalPOItem` is the FIRST. A row moved twice (A -> B -> C) would part them. Unreachable today: an overage PO Item's `Qty` equals the excess exactly, so no further excess can arise on it, and a `Delivery Items` row's `Qty` is fixed at creation, so the same row cannot become an over-delivery row a second time. If either changes, the field is the one that stays correct.
- **`Over Delivered` is its own row rather than a swollen last row** (the field was `Over Delivery` until #181 — a noun where a checkbox takes a participle; see "A checkbox takes a participle" under the naming rules), so the flagged quantity IS the excess with no arithmetic, and every unflagged row stays a within-order fact — the property #20 filters on.

### Deliveries waiting for an invoice (#216)

A strip above `/invoices` listing arrivals nobody has billed for, longest wait
first. The second of three built to the shape #176 set — #217 is the third.

- **`?unbilled=1` IS GONE FROM `/deliveries`, AND THAT IS THE POINT RATHER THAN A
  SIDE EFFECT.** It was the vendor-chasing worklist wearing a checkbox on a page
  whose other job is a chronological log, and the two pull opposite ways: a log
  reads newest first and its empty state means nothing arrived, a chasing list
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
  #210 changed it from an existence test to `billed >= arrived`, so "waiting" now
  means *this* arrival is unbilled rather than *its order* is.
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
  Narrowing the item picker to what arrived would be worse still — an invoice can
  legitimately bill for what the delivery did not bring, which is exactly what
  #210's mismatch marker catches, so the restriction would make the real case
  unenterable.
- **THE STRIP'S ROWS ARE GATED BY THE DELIVERY RULE, NOT THE PAGE'S.** This is the
  finding #176 could not surface, because there the strip and the table were both
  `canViewPR`. Here the table is invoices under `getVisibleInvoiceIds` and the
  strip is arrivals under `canAccessJobDeliveries`, and the two admit different
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
  rather than at the hour material arrived. The date beside it is what a doubting
  reader checks against.
- **`getDeliveryInvoicing` RETURNS THE DELIVERY ITEM ROWS IT READ NOW**, and that
  removed a duplicate that had been standing on `/deliveries` unseen. That page
  fetched the same level itself to summarize what arrived and then called this
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
  (`getInvoiceDeliveryStatus` for the bills, `getDeliveryInvoicing` for the
  arrivals), which is not a re-read of the same records and is not what #193
  removes; merging the two walks would be its own change.
- **THE EMPTY STATE RENDERS NOTHING**, #176's rule and #216's issue body
  independently. It could not be produced by having nothing to chase — most of this
  base's deliveries are waiting and this repo does not delete records — so it
  was observed with `authz-fixture@`, which is assigned to no job and therefore
  reaches no delivery at all. That is a different route to the same render: the
  component's guard is `rows.length === 0` either way, but "nothing waiting" is
  covered by the offline check rather than by that browser run.

### Reading which bill carries an excess (#219)

`selectOverageBill` sorted every `Invoice Items` row on the over-delivered
ordered item and took the oldest, so an order filled by two deliveries could
attach the wrong vendor invoice to a correction — and since the quotation, its
code and its unit price all come off that bill, the document that goes out
would be wrong rather than merely uncertain. #210 stored the pairing, so the
candidates narrow to the bills describing the shipment the excess arrived on.

- **THE HYPOTHESIS THAT OPENED THIS WAS HALF RIGHT, AND MEASURING IT IS WHAT
  CHOSE THE RULE.** The observation was that every over-delivery on the base
  reads `Awaiting invoice` while only some can raise a correction, and the
  proposed cause was that the eligibility was being granted by ANOTHER
  delivery's invoice — the two judgments looking at different levels, one
  delivery-scoped and one PO-Item-scoped. **The level claim is right and the
  mechanism is not.** Measured over every over-delivery row on the base by
  calling `getDeliveryInvoicing` and `getOverageContext` as the screens call
  them: the eligible ones all quoted an invoice that names **no delivery at
  all**, and **none quoted another shipment's bill**. The wrong-shipment pick is
  reachable in code and unreachable on this base — no ordered item under an
  over-delivery row carries two bills, and the few invoices that do name a
  delivery touch none of those ordered items. So
  `spansInvoices` and the `inferred` marker had never fired here either.
- **WHICH IS WHY THE NARROWING IS TIERED RATHER THAN ABSOLUTE.** Taking the
  issue body literally — candidates are the bills naming this delivery, full
  stop — was measured first: **eligibility went to 0**, because pairing is
  optional and few of this base's invoices carry one. That is
  not a data artifact to wait out. #210's own reasoning is that an invoice
  naming no delivery is the ORDINARY state, since the vendor emails the bill at
  shipment, so a strict rule makes a site-work affordance wait on office work
  that has not happened. **An empty pairing is the absence of evidence, not
  evidence of a wrong shipment.** So: a bill naming another shipment is never a
  candidate, a bill naming this one always is, bills naming none are the
  fallback, and the tiers are never mixed — a recorded pairing must not lose to
  an unrecorded one under an ordering. Measured after: the same 2 rows stay
  eligible, 0 pick another shipment's bill, and both now carry the marker they
  did not before.
- **THE FALLBACK TIER CHOOSES BETWEEN NOTHING, WHICH IS WHERE THE TWO TIERS PART
  COMPANY.** The first version of this reused the oldest-first ordering in both,
  and that was wrong in a way worth writing down. In the PAIRED tier the ordering
  is a **tie-break over narrow ignorance**: both candidates are recorded as
  describing this arrival, so the only open question is which of the two the
  excess sits in, the marker says so, and the worst case is a coin landing the
  other way between two documents that both belong here. In the FALLBACK tier
  nothing records that either bill describes this arrival, so an ordering is not
  a tie-break but a **choice with nothing behind it** — decided in practice by a
  human-entered, backdatable `Issue Date` (#164's property) — and what comes out
  of the choice is the file, the vendor code and the unit price on a purchase
  order that goes to a vendor. So **two or more unpaired candidates are refused**
  (`several-unpaired-bills`). That is `spans-invoices`'s own posture: one refuses
  because a request takes one quotation, this one because nothing records which
  quotation it would be.
  - **Exactly one unpaired candidate still proceeds**, since there is nothing to
    choose between and no arbitrariness to hide, and the marker says nobody has
    placed that bill on this arrival. **No ordering is applied in that tier at
    all** — the count decides — and `offline/overage.mjs` asserts the ordering is
    called from exactly one tier, because the difference is invisible at one
    candidate and symmetry between the two is what a later tidy-up would restore.
  - Measured: **not reachable on this base.** Both eligible rows have exactly one
    unpaired candidate, so the refusal changes no verdict here and #217's strip
    keeps its shape. What stays open in that tier is the single unpaired bill
    turning out to belong to another shipment — narrowed to the same order,
    material and vendor, and ANNOUNCED, which is the marker's own job and #166's
    rule that a fact is stated and the verdict left to a person.
- **THE MARKER COMES OFF WHEN THE PAIRING ANSWERS, WHICH IS THE QUESTION THE
  ISSUE ASKED.** One bill naming this delivery is a lookup, not a guess, so
  there is nothing to qualify. The fallback tier stays inferred **at its one
  candidate**, because that bill is only the one nobody happened to pair — and
  at two it does not infer, it refuses, per the bullet above. So one premise
  became two (`OVERAGE_INFERRED`), and they are keys rather
  than a boolean for the reason `OVERAGE_BLOCKED` already gives — a reworded
  message fails nothing. Both sentences share one message key, since they are
  two readings of one qualifier rather than two qualifiers, the arrangement
  `noLongerOverDelivered` already uses.
- **THE `spans-invoices` REFUSAL SPLIT IN TWO BECAUSE IT WAS FALSE FOR HALF ITS
  CASES.** It said "so it spans more than one invoice" whenever the excess
  exceeded the oldest bill — including when the ordered item carried exactly one
  bill, where nothing spans anything. That was reachable before this issue and
  is a lie about the data, not a wording preference. Now: more than one
  candidate on this delivery keeps `spans-invoices` and its quotation argument
  (one request takes one quotation); a single candidate says the excess is
  larger than what this delivery's invoice bills. **Two more refusals join them**,
  and every one of the three new ones exists because a message that already
  existed would have been false in its place: `other-delivery-only`, where bills
  exist and every one names a different shipment, since `no-invoice` would have
  said nothing bills the ordered item; and `several-unpaired-bills` per the tier
  bullet above. Both name an action the reader can actually take, because
  attaching the pairing is this delivery's own Edit page (#210 opened that path to
  the same Job scope). Neither promises the correction then becomes available —
  the newly named bill still has to carry a file and cover the excess.
- **THE ORDERING MOVED AND DID NOT STAY EXPORTED, WHICH RETIRES #182'S
  EXCEPTION RATHER THAN RELOCATING IT.** `sortInvoicesOldestFirst` and
  `INFERRED_PREMISE` were #166's, kept in `lib/deliveryStatus.js` after #210
  deleted the only reader there, and pinned offline so a dead-export sweep could
  not take them. The ordering is needed still — one delivery can carry two bills
  for one ordered item — so it lives in `lib/overage.js` beside its one caller
  and is **private**, and its whole reasoning (the backdatable `Issue Date`, the
  `Invoice ID` tie-break, the undated bill sorting last) moved with it. The
  premise constant is simply gone: a constant exists to keep two things in step
  and #210 removed the second thing. `offline/delivery-status.mjs` now asserts
  the absence, with an anti-vacuity that its sort matcher still sees
  `sortLongestWaitingFirst`.
- **THE CALLER OBLIGATION IS THE HAZARD HERE, AND THE FIRST CHECK FOR IT HAD A
  HOLE.** A `selectOverageBill` call that forgets the shipment does not throw —
  it falls to the fallback tier, which is the honest answer for a row naming no
  delivery and the WRONG one for a forgetful caller. It cannot refuse on a null
  instead, because null is a legitimate value. So the pin is an AST assertion
  that every call site passes `deliveryRecordId` — and the first version asserted
  it only of `selectOverageBill` calls, which a mutation then passed: the apply
  path hands the shipment to `splitInvoiceLineForOverage` first, whose own
  shorthand property survives the outer call dropping it. Both names are
  asserted now, and the mutation fails as it should. **The apply step matters
  most of the three call sites** — it splits the invoice item, so picking a
  different bill from the one the preview quoted would move a quantity the
  request never mentioned.
- **THE NARROWING COSTS NO QUERY.** `billsByOrderedItem` already reads the
  invoices for their `Issue Date` and their file, so which shipment each names
  comes off records it holds; the row's own shipment is on the `Delivery Items`
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
  `awaitsCorrection` is `overDelivered` and `overagePRState === "none"` — the
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
  same arrival sits in the same position on `/deliveries`, on #216's strip and on
  this one. `Created At` — when the excess was RECORDED rather than when it landed —
  was the alternative and the two orderings differ on this base; the arrival date
  wins because the excess is a fact about the arrival.
  - **Two rows of one delivery would tie on both dates**, since a `Delivery Items`
    row carries no date of its own and one arrival can exceed two ordered items. The
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
  `canViewPR`; these rows are arrivals under `canAccessJobDeliveries`. On one load
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
ordered items, and one invoice sits inside one delivery, so a bill charging only
ordered items a shipment brought is a candidate for it — computed at both entry
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
  bill orders nothing has delivered yet.
  - **The pool is unpaired invoices against ALL deliveries**, not against unpaired
    deliveries. The link is n:1, so a shipment already carrying one bill can carry
    another; the issue body's "unpaired deliveries" would have dropped exactly the
    legitimate second bill.
  - **The shape that would produce a 2 exists here** — `HYE-PO-20260804-04-001`
    and `HYE-PO-20260730-02-002` were each filled by two deliveries — so the zero
    is a fact about today's bills rather than a property of the rule.
- **THE UNIT PRICE GATE CHANGES NOTHING ON THIS BASE, AND IS IN ANYWAY.** One
  invoice departs from an agreed price (`HYE-INV-260716-02`, 32.00 billed against
  33.89 ordered on `HYE-PO-20260716-02-001`) and containment already excludes it,
  so the gate removes **no candidate pair at all**. It is `checkUnitPriceVariance`
  from `lib/variance.js` — the repo's existing comparison, absolute 0.01 — rather
  than a second tolerance. `Invoice Items.Variance Flag` was NOT reused as the
  test: it is set for a unit-price variance OR an over-invoiced quantity, and
  quantity must not reach this rule. Being unreachable on live data, the gate is
  asserted offline or nowhere.
- **QUANTITY IS NOT PART OF THE TEST.** A vendor billing 13 and shipping 10 is the
  discrepancy #210's mismatch marker exists to show, and matching on quantity
  would drop such a bill from consideration so that no marker ever appeared.
  Measured: `HYE-INV-260804-07` bills 13 against a shipment of 10 and still pairs.
- **THE RIVAL CLAUSE, WHICH THE MEASUREMENT FOUND AND THE ISSUE BODY DID NOT
  HAVE.** Running the rule with this base's two hand-made pairings removed puts
  BOTH `HYE-INV-260804-05` and `HYE-INV-260804-04` on `HYE-DL-260804-06`: each
  sees exactly one candidate, so "several candidates, attach nothing" never fires
  — the ambiguity is on the other side of the relation. That is #166's scenario D,
  the case #210 exists to get right (one ordered item of 30, two bills of 15, one
  arrival of 15), so the rule as stated would have quietly undone it. A bill is
  therefore not a candidate when another bill charging the same ordered item
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
- **THEN THE CLAUSE SPLIT IN TWO, BECAUSE A BILL ALREADY ON THE SHIPMENT IS NOT AN
  AMBIGUITY — IT IS AN OCCUPANT.** The first version treated "another bill charges
  this ordered item" as one fact whether or not that bill was already attached
  here, and the two are different. If 15 arrived and an attached bill charges all
  15, a second bill charging that ordered item is not the one we cannot tell apart:
  it cannot fit. So capacity is computed — what the arrival brought of an ordered
  item, less what the bills already on it charge for that ordered item — and a
  candidate needing an ordered item with nothing left is refused as `no-room`.
  `shared-order` narrows to what it always meant: two bills NOBODY has placed.
  - **IT IS NOT THE QUANTITY MATCH THIS RULE REFUSES TO MAKE, and the test is which
    two figures meet.** Matching on quantity asks whether THIS bill's quantity
    equals what the shipment brought, which would drop the bills #210's mismatch
    marker exists for. Capacity asks whether the shipment's room for that ordered
    item has been spoken for by SOMEBODY ELSE. So the comparison is `> 0` and never
    `>= billed`: 13 billed against 10 delivered with nothing attached leaves 10 of
    room and pairs, and 13 billed with 4 already claimed leaves 6 and still pairs.
    Pinned offline, and a mutation to `>= billed` fails three checks.
  - **IT IS ARITHMETIC, SO IT IS SILENT.** `no-room` is a refusal key that never
    becomes an outcome — there is nothing for a reader to resolve, and the state it
    produces is the ordinary unpaired one. Only `shared-order` speaks.
  - **THE MESSAGE COULD NOT HAVE STAYED TRUE OTHERWISE.** `shared-order` says
    nothing records which bill this shipment answers; with one of the two already
    attached, something does. The split is what let that sentence keep meaning what
    it says, and the wording now names the condition — `nobody has attached`.
  - **MEASURED, AND IT MOVES NO PAIRING ON THIS BASE.** 6 attach under either
    rule. What changes is one message: `HYE-INV-260804-04` was being told the app
    could not choose and is now silent, because `HYE-DL-260804-06` brought 15 and
    `HYE-INV-260804-05` claims all 15 — room 0. The case #210 exists for is
    untouched: with both bills unplaced the room is 15 and `shared-order` fires for
    both, exactly as before. **A pairing WOULD be added where an attached bill
    claims only part of what arrived**, which is unreachable here — both pairings
    on this base claim 100% of what arrived.
  - **THE DATA WAS ALREADY IN HAND, in both directions.** `getArrivalsForBill`
    already reads the arrival's `Delivery Items` for their ordered items, so their
    `Qty` is free; the bill pool's `Invoice Items` were already read for the same
    reason, so their `Qty` is free too. The entry form takes the arrival's
    quantities from `planDelivery`'s own rows. **Zero additional operations**, and
    on the entry path capacity is always full — nothing can be attached to a
    delivery that does not exist yet.
- **AND THEN A THIRD TIME, FOR THE PAIR NOTHING TELLS APART.** What was left of
  `shared-order` still covered two bills charging the same ordered item in the SAME
  quantity at the SAME price, and there the refusal has nothing to hand a reader:
  attaching either one leaves the arrival with the same room and gives either bill
  the same #210 mismatch marker, so no figure this app computes comes out
  differently for the two choices. One is attached. **This is #166's own scenario D
  — an ordered item of 30, two bills of 15, one arrival of 15 — which #210 and the
  first two versions of this rule all refused**, so it is a decision reversed rather
  than a case nobody had considered.
  - **WHICH ONE IS ARBITRARY, AND THE ORDER SAYS SO.** `Invoice ID`, because it is
    on the option already and any total order would do. Deliberately NOT #166's
    oldest-bill-first: that ordering asserts the earlier bill has the better title,
    which is the assertion this case exists to say cannot be made.
  - **#219 IS NOT THE PRECEDENT IT LOOKS LIKE, and the citation was corrected on
    the way in.** Its tie-break sits in the tier where both candidates ALREADY name
    this delivery, so the pairing records what it is choosing between; in its own
    fallback tier — where neither is recorded, which is exactly this case — #219
    refuses too. What licenses attaching here is that the consequences are
    identical, not that somebody else broke a tie.
  - **A DIFFERENT QUANTITY IS OBSERVED, SO IT STILL REFUSES.** Bills of 10 and 5
    against an arrival of 15 leave 5 or 10 of room depending on which is attached,
    and the marker moves with them. Narrowing THAT with a quantity test would be
    the forbidden comparison wearing a tie-break's clothes: `room >= billed` is the
    same comparison that would drop 13 billed against 10 delivered, and it would
    have the app perform the very inference the marker exists to make visible. The
    two cases differ in what they are about — a tie is two documents for ONE
    shipment, `several` is two physically different shipments — and a wrong
    attachment of the second kind is not corrected by any later measurement.
  - **IT IS SAID OUT LOUD, BECAUSE THE TWO DOCUMENTS ARE NOT THE SAME DOCUMENT.**
    The rows match; the file and the vendor's own invoice code do not, and those
    are what a person reconciles against. So a tie-broken attachment carries a
    sentence naming what it was chosen over — a QUALIFIER (`PAIRING_COPY.tieBreak`)
    rather than an outcome, in the shape #166 gave its own marker: it composes with
    `matched` and `several-attached` instead of doubling them. The preview names
    both bills, because the recorder is holding the packing list; the banner names
    neither, because it arrives as a flag on a query string.
  - **THE FOLD CAME BACK WITH IT, WHICH IS THE COST.** Two tied bills are not
    disjoint, so a decision has to count against the room before the next bill is
    judged, or an arrival of 15 takes both bills of 15. `planPairings` folds each
    attachment into the pool as attached to this arrival again, and takes the pool
    in `Invoice ID` order rather than the caller's — among tied bills the pass
    really does choose, so the choice must not be the caller's array order. The
    disjointness assertion left behind when the fold was removed is what would have
    caught its absence, and a mutation confirms it does.
  - **ROOM DECIDES HOW MANY, EXACTLY AS FOR ANY OTHER BILL.** Two tied bills of 15
    against an arrival of 30 both attach and nothing is said, because nothing was
    passed over; against an arrival of 15 one attaches and the other is refused as
    `no-room`. So the tie-break is reported from what the pass LEFT unattached
    rather than from what it saw, which is the difference between a choice and a
    coincidence.
  - **Unreachable on this base**, for the same reason `shared-order` is: both pairs
    that share an ordered item have one bill attached already, so capacity answers
    before a tie can be found. Asserted offline, with mutations covering the rival
    clause, the fold, the fold-without-deducting, the pool order, and each figure in
    the signature.
- **`price-departs` SPLIT OFF `price-unknown` IN THE SAME PASS, AND THE REASON IS A
  SENTENCE THAT IS NOT YET WRITTEN.** One key covered both "the billed price is not
  the agreed one" and "no price could be compared at all", and the second is not a
  departure — it is a caller handing over an incomplete map, which is a defect in
  this repo rather than something a vendor did. Both fail closed and both are
  silent, so nothing on a screen moves today; what the split protects is the
  sentence `price-departs` will need when there is somewhere to say one. **The new
  key is unreachable and that is not evidence of anything**: both callers build
  `agreedPrices` from the very ordered items they then test against, containment is
  decided first, and `PO Items."Unit Price"` is a frozen snapshot that is never
  blank.
- **ONE PREDICATE, TWO DIRECTIONS.** `pairingRefusal` decides one (bill, arrival)
  pair and both entry points call it, so whether a pairing gets made cannot depend
  on which document was typed in first. **The ARITY differs and the judgment does
  not**: an arrival attaches every bill its ordered items place on it, while a
  bill attaches to at most one shipment, because the link is n:1 and says so.
  Every pair either direction makes passes the same predicate.
  - **THE ENTRY FORM'S INVOICE CONTROL IS GONE, AND THAT IS WHAT MADE THE ARITY A
    PROPERTY OF THE RULE RATHER THAN OF A WIDGET.** #210 put an invoice picker
    there on the premise that a packing list carries an invoice number; this app's
    plan never said so — only the PO number was ever described as printed on that
    document. While the computed answer preselected that one-value control, two
    candidate bills meant two values in one field and NOTHING was attached, which
    left a shape that never converged: two bills charging different ordered items
    from one shipment are each individually unambiguous, so no later invoice would
    ever fire direction 2 and the pair stayed for a person permanently. Removing
    the control removed the shape.
  - **The override went with it**, and its removal simplified the rule rather than
    narrowing it: `planPairings` lost `transcribed`, `createDeliveryAction` lost
    its `invoiceRecordId` field and its `checkInvoicePairing` guard, and every
    link the entry path writes is now computed. `LINK_COPY.field` lost `label` and
    `transcribed`, which that control was the only reader of.
  - **The manual path is untouched.** #210's edit page is the surface that is
    about the delivery RECORD rather than about the packing list, and it is
    already plural: it lists every attached bill and offers the rest one at a
    time, which is where a computed pairing that is wrong gets corrected.
  - **Unreachable on this base:** no delivery holds two unpaired contained bills,
    sharing an ordered item or not — 0 pairs either way, measured 2026-08-13. The
    precondition is here though, so it is one record away rather than
    hypothetical: several deliveries brought more than one ordered item, and
    `HYE-DL-260804-10` has one of its two billed by `HYE-INV-260804-08` and the
    other billed by nobody. One invoice for `HYE-PO-20260804-14-001` produces it.
- **THE RIVAL POOL NEEDS NO UNSCOPED READ, and the derivation is load-bearing.** A
  rival shares an ordered item with a candidate, a candidate's ordered items all
  lie inside the arrival, an arrival sits on one Job, and `canViewPR` clause 4
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
- **THE RULE NEVER JUDGES A PAIRING THAT EXISTS**, and the one on this base it
  disagrees with is already marked. `HYE-INV-260804-03` is hand-paired to
  `HYE-DL-260804-05` and the rule computes no candidate for it, because it bills 7
  of `166-DEMO Tee` that the shipment did not bring. Measured: that invoice
  carries #210's mismatch marker, which fires on the same fact. A second signal
  would be one fact rendered twice — #166's reason for taking `beyond order` off
  `/invoices` — and it would invert #210's thesis that the pairing is a fact
  somebody knows rather than one the app guesses.
- **WHAT THE RULE CANNOT REACH, stated because it is the boundary rather than a
  bug:** a bill charging for an item that did not arrive at all is never paired,
  so its mismatch never surfaces. The quantity axis survives (13 billed against 10
  delivered still pairs); the item axis does not.
- **COST, MEASURED.** `/deliveries/new` is **11 operations** for an Admin and 11
  for `scoped-fixture@`, the Invoice Items read this issue makes unconditional
  being one of them — it was fetched only for a non-privileged viewer before,
  because it existed to answer the row gate. The invoice side's pairing read is
  **1 operation when nothing has arrived on the billed orders**, which is the
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
    `HYE-DL-260804-09` brought one ordered item, nothing billed it and no other
    bill charges it, so `matched` is the only outcome the rule can reach there. The
    run: the redirect carried `paired=matched`, `Invoices."Delivery"` named the
    shipment, and the shipment's own `Invoices` named the bill.
  - **The residue check is about the DELIVERY, not about the fixture.** A stored
    link is the one thing this feature writes to a record it does not own, so
    "the invoice is deleted" and "the shipment is unchanged" are different claims.
    The run detaches through the production write first, then deletes, then re-reads
    the delivery: 0 bills before, 0 after, 4 records deleted, no residue in any
    bucket, and the Blob object removed. 14 operations in the script itself.
  - **One `Auth Tokens` row is spent and left**, rather than deleted as tidying-up.
    It is single-use and reads `Used: true`, so it is inert.
- **Not in this issue:** an invoice edited after creation does not recompute its
  pairing; `several`, `shared-order` and the tie-break are all unreachable on this
  base and are asserted offline only — every ordered item here carrying two bills
  has one of them attached, so capacity answers before ambiguity can; and the
  invoice side's three failure points are stated in
  `lib/deliveryInvoiceMatch.js`'s header rather than exercised — all three leave
  the same state, an invoice naming no shipment, which is the ordinary one.
  - **A REFUSAL IS NEVER SAID ON A SCREEN THAT DID NOT COMPUTE IT, and that leaves
    two facts unsaid.** A bill whose price departs from the agreed one, and a bill
    charging an ordered item no shipment brought, are both simply unpaired
    wherever a reader meets them afterwards. Saying either on the invoice detail
    means that page running `planPairings`, which it does not: it is a new read on
    a screen #210 got down to 3 operations, plus new copy and a decision about
    where it renders — and `not-contained` mixes "not yet" with "never", which the
    key alone cannot separate. **The tie-break is the same shape**: it is spoken at
    the moment of telling and nowhere afterwards, because whether a pairing was
    tie-broken is not stored and recomputing it on a later render means reading the
    vendor's other bills and their `Invoice Items`. All three are one piece of
    work, and it is bigger than this issue.

### Scoping the box to its invoice (#232)

The invoice detail's delivery section described the ORDERED ITEM while sitting on a
page about one invoice. `Billed` was the `Invoiced Qty` rollup across every bill,
`Delivered` every arrival on the order, and the list under each box held every
delivery that had touched that ordered item. Redrawn so that every figure a box
carries is this invoice's, the delivery it matches is stated once, and the one thing
that stays the order's says so by name.

- **THE FRAME WAS HONEST UNTIL #210 AND THE MARKER IS WHAT SHOWED IT WAS NOT.** With
  no pairing stored, which delivery answered a bill was unknowable, so the ordered
  item's context was the most that could truthfully be shown. #210 stored the pairing
  and hung `— attached to this invoice` on the existing frame without revisiting it —
  a marker that distinguishes one entry from the others in a list, on a screen where
  **all 9 boxes on this base that listed any delivery listed exactly one** (measured
  2026-08-14, #231). A marker with nothing to mark is the tell that the list it sat in
  was answering somebody else's question.
- **`HYE-INV-260804-04` IS THE CASE, AND IT IS FIXED RATHER THAN DESCRIBED.** Before:
  `Billed 30 EA` while the invoice bills 15, `HYE-DL-260804-06` listed although that
  is `HYE-INV-260804-05`'s delivery, and `Nothing delivered yet` under both. After:
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
- **THE DELIVERY IS NAMED WITHOUT ITS ORDERED ITEMS.** It can carry bills this invoice
  has nothing to do with, so listing what it brought would show orders this invoice
  never charged. #233 recorded the mirror of this from the other side and found that
  only half of it transfers: naming the ordered items of THIS order on the order's own
  page is inside its frame by construction, while a document's own total is not.
- **WHERE THE NARROWING STOPS IS "WHAT A BILL CAN BE THE SUBJECT OF".** `Billed` and
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
  `billedBeyondOrder` has no honest per-invoice form: two bills of 20 against an order
  of 30 leave every invoice reading clean while the order is over-billed by 10, so
  scoping it would delete the fact rather than rescope it — and it is the fact #167
  and #219 act on. `arrivedBeyondOrder` COULD be narrowed to the matched delivery for
  nothing, since the slices are already read, and must not be: the two terms share one
  line, and two scopes on one line is the defect this issue removes one level up.
- **`This bill:` WENT AND ITS PREDICATE WENT WITH IT.** The line existed only to
  caption a `Billed` that was the ordered item's; scoping that figure removes the
  premise, and `sharesOrderedItem` then had no caller. Deleted rather than left
  standing, with the absence pinned in `offline/delivery-status.mjs`. **What it said is
  not lost from the app**: "another bill charges this ordered item" is the order's fact
  and #233 put it on the order's page. Its removal frees the name for
  `lib/deliveryInvoiceMatch.js:chargesSameOrderedItem`, whose docstring explained the
  collision and is now a note about history rather than a distinction being drawn.
- **THE VERDICT IS WITHHELD WHERE NO DELIVERY IS MATCHED, WHICH IS A DISTINCTION #210
  CREATED.** "Nothing has been matched to this bill" and "the matched delivery brought
  none of this ordered item" are different facts since the pairing was stored, and
  `Nothing delivered yet` asserted the second while only the first was known. The first
  has ONE answer for the whole invoice, so the section states it once and
  `describeInvoiceLine` returns a null verdict for a judged box; `hasDelivery` comes
  from the caller because a share with `delivered: 0` cannot tell the two apart. A
  `not-compared` box keeps its verdict either way — that is a fact about the invoice
  item, not about any delivery, and #166's argument for putting it where the invoice
  item is still holds. On `HYE-INV-260804-02` both shapes are on one page: a judged box
  with no verdict beside a free-text box that has one.
- **AND A BOX THAT AGREES IS SILENT TOO, WHICH IS THE SAME ARGUMENT AT FULL STRENGTH.**
  The first pass left `Billed 15 · Delivered 15` and `All billed material delivered` on
  every box of a normal invoice — correct figures, correct verdict, and identical on
  every box, because under the one-delivery premise "everything billed was delivered"
  is a fact about the INVOICE. Stating it per item states one fact as many times as the
  invoice has items, which is the repetition #233 took off the order's page and #232
  took off this one, one level further down each time. So `all-delivered` has no copy
  branch at all — the judgment survives, `describeInvoiceLine` reads it to decide there
  is nothing to say — the figures line went entirely, and what remains on a normal box
  is the item name. **THE INVOICE LEVEL SAYS WHAT THE STATE IS, THE ITEM LEVEL POINTS
  AT AN EXCEPTION**, and that division is what the rest of this section follows from.
- **THE TWO SURVIVING VERDICTS ARE WORDED AS DISCREPANCIES, AND `yet` HAS ONE HOME.**
  Under the premise nothing further is coming: what an invoice bills either arrived on
  the delivery it matches or was never shipped, so a shortfall is an event to take up
  with the vendor rather than a stage on the way to complete. `Nothing delivered yet`
  therefore became `40 EA billed, none of it delivered by the matched delivery`, and
  `3 EA more billed than delivered` became `3 EA more billed than the matched delivery
  delivered`. Both take `MISMATCH_REASON` as their reference vocabulary, both name what
  they compare against, and both carry their figures — which reverses the old rule that
  a verdict states no quantity, since the figures line that rule pointed at is gone.
  The one honest `yet` on this screen is the section's own empty state, where the
  material may still arrive or the arrival may still be recorded.
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
  the fact it named was a vendor shipping less than it billed, which under the premise
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
  one each. **BELOW THE DELIVERY, NOT ABOVE IT** — the sentence says the invoice bills
  more than the delivery matched to it delivered, so the reader meets the subject
  first; and the section's first line stays the same line in all three states, which
  makes the box read as an addition rather than as a different layout. The check that
  used to assert there was NO detail-density twin now asserts the twin's contents,
  since the reason for its absence was that every box stated the shortfall itself.
- **NO BORDER ON AN ENTRY.** The border was drawn around `Ordered · Billed ·
  Delivered`, a share line, a verdict, an aside and a delivery list. With the inside
  emptied it framed a name, and a bordered box holding one word reads as a card that
  failed to load. A list is enough.
- **NO ITEM LIST AT ALL WITHOUT A MATCHED DELIVERY.** This section compares what an
  invoice bills against what one delivery brought; with nothing matched there is no
  second term, so an entry per invoice item was a list of names with no fact in any of
  them. The sentence above is the whole answer. `Not compared — no ordered item` goes
  with them, since it says why an invoice item was left out of a comparison that is not
  happening. **What this costs is one line, and it is a line the app still has.**
  `Against the ordered item: 3 EA more billed` used to render on an unmatched invoice
  — `HYE-INV-260804-07` is the case — and the second pass justified keeping it on the
  ground that the figure was visible on no other screen. **That was wrong**: #233 gave
  `/pos/[poId]` an `Invoiced` column with a red `(over)` mark, so
  `HYE-PO-20260804-11` reads `Qty 10` and `Invoiced 13 (over)` today. Verified on that
  page rather than assumed. The billing excess is one click away, beside the quantity
  it exceeds, which is a better place for it than a delivery section on a bill nothing
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
  place on two counts: which order an item was billed against is not a delivery fact,
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
  says the delivery below was matched from the ordered items the invoice bills, so the
  empty state uses it rather than coining a second word for one fact — the drift #179
  exists to remove. The chip above it still reads `Awaiting delivery`, which is the
  invoice-level word #210 chose and is unchanged here.
- **`nothing-delivered` SURVIVED THE NARROWING, AND WHETHER IT IS REACHABLE IS TWO
  QUESTIONS.** Through the app's own pairing it is NOT: `fitRefusal`'s `notContained`
  requires the arrival to bring every ordered item the bill charges, and
  `roomOnOrderedItem` refuses a pair with no room, so a computed pairing has
  `arrived > 0` on every judged ordered item. Through the data it plainly is —
  `HYE-INV-260804-03` bills `166-DEMO Elbow` 5 on `HYE-PO-20260804-07` and
  `166-DEMO Tee` 7 on `HYE-PO-20260804-08`, and the delivery matched to it,
  `HYE-DL-260804-05`, holds one `Delivery Items` row: the Elbow. So the Tee's box
  reports `7 EA billed, none of it delivered by the matched delivery` while the Elbow's
  says nothing. That pairing predates the computed rule and `notContained` would refuse
  it today, which is precisely why the row is KEPT rather than repaired: it is the only
  way to see this branch on a screen. A bill of 0 reaches it too, by the clamp. So the
  key stays, and the distinction between "unreachable in code" and "absent from this
  base" is written down rather than collapsed into one word.
- **THE READ THAT SHRANK AND THE READ THAT DID NOT, both measured.** Level 3 was every
  delivery that had touched the ordered items; it is the one the invoice matches, read
  off the invoice's own link. Level 2 still reads every slice on those ordered items,
  because `arrivedBeyondOrder` stays order-scoped and only the rows carry
  `Over Delivered`. Measured read-only on this base with the `_selectRecords` /
  `_findRecordById` instrument, before then after: `HYE-INV-260804-05` (matched)
  3 -> 3, `HYE-INV-260804-03` (matched, two ordered items) 3 -> 3, `HYE-INV-260804-04`
  (matched to nothing, ordered item touched by another bill's delivery) **3 -> 2**,
  `HYE-INV-260804-02` (matched to nothing, ordered item with no arrivals) 1 -> 1,
  `HYE-INV-260727-03` (every invoice item free text) 0 -> 0. The saving lands only
  where level 3 had something to read, and **that one operation is what keeping the
  order-scoped fact costs** — narrowing it too would take an unmatched invoice to 1.
- **THE PAGE IS LABELED NOW (`/invoices/[invoiceId]`).** It was one of the last read
  surfaces without one, which is why the figures above are the WALK's rather than the
  page's: an unlabeled screen has no before and after, and #216's duplicate read on
  `/deliveries` stood invisible for exactly as long as that page carried no label.

### Naming the order behind an item (#237)

The invoice detail listed the orders it bills and never said which of them any one item
was billed against. The items table cannot hold the answer (#167) and the delivery
section is no longer a place for it (#232), so it hangs under `Purchase Orders`, and
only where the folded items disagree about which orders they touch. The rule, the
per-order quantity and the copy are `lib/invoiceOrderBreakdown.js`.

- **THE QUESTION LOST ITS HOME TWICE, AND THE SECOND TIME WAS THIS ISSUE'S CAUSE.**
  #167 dropped the `PO` column because a row an overage split produced spans two orders
  once folded — unrepresentable in one cell rather than merely awkward — and put the
  order on the delivery section's per-item boxes, which had exactly one each. #232 then
  emptied those boxes: which order an item was billed against is not a delivery fact,
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
  make the sets differ and turn the list on for every invoice that has one. Untestable in
  a browser today, since `SHOW_OTHER_ITEM_OPTION` is false (#96) and only hand-entered
  rows have no ordered item.
- **AN ORDER REACHED ONLY THROUGH SUCH A ROW KEEPS ITS LINE WITH NOTHING UNDER IT.** The
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
  EXCEPTION TO IT.** #233 nests a charge under the invoice that made it; this nests an
  item under the order it was billed against — parent line for the document's identity
  and its own facts, child list at `pl-4` in smaller gray text for the pair facts. The
  line's syntax is `PO_DOCUMENTS_COPY.deliveries.brought`'s (`Item Size — qty UNIT`)
  rather than `invoices.charge`'s, so the price travels with whether the frame can see it
  elsewhere: on the order's page the billed price is the pair fact the order cares about
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
  `HYE-INV-260817-01` is that case: `HYE-PO-20260817-01` and `-02` both named, no item
  list under either. `HYE-INV-260817-02` is its pair on the listed side,
  `HYE-PO-20260817-03` and `-04` with a line each.
- **AN ORDER WITH NO CHILD LINE IS NOT SEEDED, AND THAT IS A DECISION RATHER THAN A
  GAP.** It needs an invoice item with no `PO Item`, which the form cannot make
  (`SHOW_OTHER_ITEM_OPTION` is false, #96) and which the plan no longer calls for at
  all — free-text charges were built and then dropped, so the code path stands while
  the state does not occur. A seed exists to put a reachable state in front of a
  person; seeding one the app cannot produce would assert the opposite. **The exclusion
  is still required defensively** and `offline/invoice-order-breakdown.mjs` is the only
  thing holding it, on both halves separately — such a row stays OUT OF THE JUDGMENT
  (read off an invoice that must stay silent) and lands UNDER NO ORDER (read off one
  that must stay listed) — each shown to fail under a mutant that keys the exclusion on
  `PO` rather than `PO Item`, which is the plausible mistake because a free-text row
  does carry an order link. One such row was seeded on `HYE-INV-260817-02` and then
  retired, its `Amount Due` corrected from 184 to 144 in the same pass; the order it
  charged, `HYE-PO-20260817-05`, is left standing, an order having existed either way.
- **THE CORRECTION SEED GOES THROUGH THE REAL FLOW BECAUSE THE FOLD KEY IS WHAT MAKES
  THE CASE.** Two halves at different prices do not fold, and then each touches one
  order and the list turns ON — the exact inverse of the shape being seeded. Writing
  the end state by hand would be asserting the key; `splitInvoiceLineForOverage`
  carries `bill.unitPrice` onto the half it creates and takes its name, size and unit
  from the corrective order's ordered item, whose `Material` #18's cache wrote in the
  same PO generation. Verified at the record level: both ordered items behind
  `HYE-INV-260817-01` link Material `237-DEMO Elbow_2"_EA`, and both invoice items are
  at 12 — which is why one row of 13 appears in the items table.
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
  Retiring one charge that was also the only one naming its order took
  `HYE-INV-260817-02` from 11 to 9, with `Invoice Items` finds 3 -> 2 and
  `Purchase Orders` finds 3 -> 2: one each, exactly. What misled the first reading was
  `HYE-INV-260804-03` also totalling 11 on 2 items and 2 orders — two fewer finds there
  are spent on the delivery it matches, so two different sums landed on one number.

### Reading one material as one entry (#241)

The delivery section listed one entry per `Invoice Items` row while the items table
above it folded, so an invoice whose charge an overage split divided showed one
material twice under the delivery and once in the table. Folded on the key
`lib/invoiceItemFold.js` already uses, with the shares added rather than re-derived,
and an entry that agrees no longer rendered at all. The rule is
`lib/invoiceDeliveryEntries.js`.

- **#237 REVEALED IT AND DID NOT MAKE IT.** When #232 redrew this section there was no
  split invoice on this base, so every screen it verified had unfolded items and this
  shape never appeared; #237's seed ran the correction flow for real and put
  `HYE-INV-260817-01` in front of a person, where the items table reads one row of
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
  clamps what a bill can be credited with at what that bill billed, per ordered item,
  because a delivery may legitimately bring more of an ordered item than this invoice
  charges. Clamping once at the folded scope instead — sum the billed, sum what
  arrived, `min` — is the tidier-looking rule and is wrong twice: **a surplus on one
  ordered item would cancel a shortfall on another**, which is what the per-pair clamp
  exists to prevent; and **it would disagree with the chip**, which is computed off the
  unfolded shares, leaving the amber sentence standing above a list with nothing in it
  that points anywhere. `SPLIT_CROSSED` in `offline/invoice-delivery-entries.mjs` is
  that case — 10 billed against 8 delivered on one ordered item, 3 against 5 on the
  other — and the mutant is built and run there rather than described. It also needs a
  field the row does not carry: the clamp destroys its own input, so re-deriving would
  mean handing the raw arrival down, which is itself part of the answer.
- **THE TWO BEYOND-ORDER TERMS ARE THE EXCEPTION AND ADD OVER DISTINCT ORDERED ITEMS.**
  `billedBeyondOrder` and `arrivedBeyondOrder` belong to a `PO Items` row rather than to
  a bill, so two charges reaching one ordered item carry the same figure and adding both
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
  everything billed arrived, so the per-material delivered quantity IS the per-material
  billed quantity, which the items table carries. `This invoice has no lines.` went with
  it — an invoice with no items has no exceptions either, and the table above already
  says it is empty.
- **THE NAME NOW COMES FROM THE INVOICE ITEM, WHICH REVERSES WHAT THE WALK DOES.** A row
  was labeled from the `PO Items` row it compares against; a folded entry can span two of
  those, so there is no single one to name — the fact that makes the items table's `PO`
  column impossible (#167). It takes the fold group's frozen copy instead, #237's source,
  so an entry and the row above it cannot disagree. On this base the two agree: both
  ordered items behind `HYE-INV-260817-01` and both invoice items read `237-DEMO Elbow`.
- **A CHARGE WITH NO ORDERED ITEM IS UNAFFECTED, BY CONSTRUCTION RATHER THAN BY A CASE.**
  `foldKey` gives a row with no `Material` its own record id as a key, so it is a group
  of one; it carries no share, `describeInvoiceLine` speaks for it, and it renders as it
  did. **One state is pinned only in the offline tier**: a COVERED invoice carrying such
  a row, where the chip reads `Delivered` and a single gray `Not compared — no ordered
  item` stands under it. No invoice on this base both matches a delivery and holds a
  free-text row — the three that match a delivery have an ordered item behind every
  charge — so it was not seen on a screen and nothing was created to see it.
- **A DIFFERENT KEY FROM #238's, ON PURPOSE.** That issue folds a delivery's own rows on
  `Material` + ORDER, because a folded row there must still name the order the correction
  acts on; this folds on `Material` + UNIT PRICE, because a bill split across two orders
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
  short items the two would alternate down the page. **The tone is the verdict's**, so
  `not-compared` is gray in both halves — an invoice item nothing was measured against is
  the absence of a problem, and an amber name over that sentence would contradict it.
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
- **THE GRAY ENTRY WAS NOT SEEN ON A SCREEN**, for the same reason the state it belongs
  to was not: no invoice on this base both matches a delivery and carries a charge with
  no ordered item. `offline/invoice-delivery-entries.mjs` pins it — an entry whose
  verdict is `not-compared` is `unjudged`, an entry that is short is `exception`, and the
  two differ, which is the assertion that would fail if one tone were hard-wired.

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
  because a charge split across two orders is one vendor charge and the order is what
  the folded row cannot name. This folds on `Material` + ORDER, because a folded row
  here must still name the order the correction acts on. Same question — when does a
  screen read one material as one line — and the frame decides the answer. Do not
  unify the keys.
- **IT IS A THIRD GROUPING BESIDE `groupRowsByItem`, NOT A REPLACEMENT.** That
  function answers "what arrived", for the headline and a list row that name no
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
  one, and coloring the total would say the 10 that arrived inside the order is a
  problem too. **AMBER HERE, RED ON `/pos/[poId]`, AND THAT IS NOT A DRIFT TO TIDY
  UP.** On the order's page the figure says an ordered item is over-delivered — the
  order asked for 10 and holds 13 — which is the discrepancy that page prints in red
  beside `⚠ Header Variance`. Here it is one arrival's contribution, on a page whose
  every over-delivery word is already amber: the headline tag, the banner, and the
  correction box under it. Unifying the two would make one color mean both "this
  order is over" and "this delivery brought some excess", which is the property
  `DeliveryStatusMarks` exists to hold still.
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
  comparison. This table is not a comparison: it is the record of what this arrival
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
`Invoice Items."Variance Flag"` compares a charge against what the order agreed. The
list said `⚠ Variance` for the first and the detail's items table said it for the
second. The words are `lib/variance.js:VARIANCE_COPY` now, beside the predicates that
set them.

- **`⚠ Order variance` AND `⚠ Check the total`, AND THE TWO GRAMMARS ARE THE
  DISTINCTION.** The charge one is a STATE — the vendor billed something other than
  what was settled, an external fact that stays true until somebody takes it up with
  them. The document one is an INSTRUCTION, because it is an internal arithmetic check
  and what it asks for is a second look; no other mark on these screens has that shape,
  which is what stops a reader taking it for a third state. **Neither names a
  direction, and that is measured rather than stylistic**: `checkHeaderVariance` and
  `checkUnitPriceVariance` both compare an absolute difference, so each fires when the
  figure is under as readily as over. `Over-billed` was the issue's first choice for
  the charge one and would have been false half the time it appeared.
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
  poItem.qty` — a price that differs from the order's, or a quantity billed beyond what
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
  something anyone can do — check the charge against the order, or take it up with the
  vendor — with payment as the deadline rather than the act, which is #232's grammar in
  the amber box further up the same page.
- **THE LIST'S BADGE AND ITS COLUMN ARE THE OFFICE'S NOW, AND #211's REASON FOR
  KEEPING THEM WAS A MISIDENTIFICATION.** That issue left the badge for every viewer on
  the ground that it was "billed-against-ordered … the reason an employee is on this
  page at all". It is not: the list badge reads `Invoices."Variance Flag"`, the header
  kind, which is an arithmetic check only an Admin can act on since only an Admin can
  edit an invoice. The kind an employee is here to catch has no mark in this list for
  anyone — it is on the invoice's own page, per charge, next to the order it disagrees
  with. So the column goes with the payment state it shares a cell with, and an
  employee reads six columns.
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

### Bills waiting on a delivery (#256)

The other end of #216: a second strip above `/invoices`, listing bills nobody has
matched to a delivery, longest wait first. The fourth built to the shape #176 set.

- **THE REFUSAL REASON CANNOT BE SHOWN, AND THAT IS A MEASURED CONSTRAINT RATHER
  THAN A CHOICE.** The issue body asks for the distinction between a bill whose
  orders have seen no arrival and one whose arrival exists but was refused a
  pairing. The second half is unavailable as asked: `fitRefusal` produces seven
  reasons, is pure, and **is never stored** — it runs at write time only, from
  `createInvoiceAction` and from `createDeliveryAction`. Re-deriving one per row
  means `getArrivalsForBill` per invoice, five reads each, which is the per-row
  shape #143 ruled out and #162 measured at over 200 calls.
- **SO THE SPLIT IS BY ARRIVAL, NOT BY REASON**, and it costs one batched read.
  `PO Items."Delivery Items"` answers "has anything been delivered against what
  this bill charges" for every ordered item on the page at once, and
  `getPOItemsForReconciliation` already carried the field. No `Delivery Items`
  level is read: a non-empty link array is the whole claim. Quantities would let
  the strip say more than it should — whether what arrived covers what is billed
  is the *matched* delivery's question, and these bills have no match.
- **THE TWO WORDS NAME THE OBSERVATION AND NEVER THE CAUSE**, which the base
  forces. `docs/notes/backlog.md` records, measured, that every seed writes
  invoices directly and none calls the matcher, so an empty `Invoices."Delivery"`
  here is usually a bill the app was never asked about. `nothing delivered yet`
  and `delivered, not matched` are true under a refusal, under nothing having
  arrived, and under the matcher never having run. A word claiming a refusal
  would be false about most of the rows it labeled.
- **`Issue Date`, NOT `Created At`**, and the delivery side set the precedent: it
  counts from `Received Date`, the date on the packing list, although
  `Deliveries` carries `Created At` too. Both strips therefore count from the
  document's own date and their `Nd` figures mean the same kind of thing.
  `Created At` reads better in one respect — nobody could act before the office
  entered the bill — and loses to comparability, with the row showing the date
  beside the count so a reader can check either.
- **A BILL CHARGING NO ORDERED ITEM IS EXCLUDED**, the one place the strip is
  narrower than the chip it selects on. It can never be paired (`noOrderedItem`)
  and the arrival question cannot be asked of it, so both row words would be
  false. `countsTowardStatus`'s own reasoning one level up. **The consequence is
  that the row count and the number of `Awaiting delivery` chips in the table can
  differ, and it is written down in three places** — the selector's docstring,
  `offline/awaiting-delivery.mjs`, and `docs/briefs/invoices.md` — because anyone
  comparing the two figures will find them apart and read it as a bug.
- **BELOW #216's STRIP, ON THE DOCUMENTS' OWN ORDER.** A delivery waiting for a
  bill precedes a bill waiting for a delivery in the flow the two describe, so
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
  are Job-scoped arrivals, these are invoices under #211's walk.
- **`waitingSince` REPLACED `receivedDate` ON THE SHARED SORT.** Three callers
  order by `sortLongestWaitingFirst` and the third passes an invoice's date, so a
  property named after the delivery field was false at one of them. An accessor
  parameter was the alternative and is worse for a reason outside the function:
  `offline/delivery-status.mjs` pins that no `.sort()` in `lib/deliveryStatus.js`
  mentions `issueDate`, because #219 moved the one ordering of bills by that field
  into `lib/overage.js` and made it private. Passing `(r) => r.issueDate` from a
  page passes only because the call site sits elsewhere; move row-building into
  that module later and it trips #219's guard. A neutral property never can.
- **THE TIE-BREAK WAS INERT HERE AND IS NOW THE `Invoice ID` (second pass).**
  `sortLongestWaitingFirst` broke a tie on `createdAt` descending and `Invoices` has
  no creation timestamp — no field on the table, none on the mapper — so this axis
  passed `undefined` and every same-day pair silently held whatever order the
  invoice read returned. Visible on the base: `HYE-INV-260716-03` and `-02` are both
  `2026-07-16`. The property is `createdKey` now, generalized the way `waitingSince`
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
- **Not in this issue:** re-running the pairing for bills already on the base,
  which is what would make an unmatched bill mean "refused" rather than "never
  asked". That is the seed defect `backlog.md` records, and it changes another
  issue's data.
