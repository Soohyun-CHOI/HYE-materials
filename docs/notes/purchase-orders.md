# Purchase orders — the reasoning

Governs `app/pos/**`, `lib/po*.js`. **Read this before editing there** — CLAUDE.md carries only the rules that bind code outside this area; the derivation, the evidence and the alternatives weighed are here.

Moved verbatim out of CLAUDE.md — nothing in this file was rewritten. The migration was audited line by line and the result is in the pull request that created this file.

### Purchase order list (#168)

`/pos`. Before it, a PO was reachable only through the PR that generated it, and `/api/pos/search` is Admin-only. Delivery status is **not** here — that is #169, which needed this page first.

- **`getAllPOs()` MEANS "EVERY PO, NO STATUS FILTER", AND THE NAME WAS REBOUND TO SAY SO.** Until #168's first commit it meant "every PO except Awaiting Signature and Withdrawn"; that reader is now `getPOsExceptWithdrawn`, with a filter narrowed to one status. The rename measured the old name at **zero occurrences** across the repo before this one reused it, so the two meanings never coexisted in a single tree — that measurement lives only in the renaming commit's message, since this commit re-creates the name.
- **HAVING NO FILTER IS THE CONTRACT, and `offline/source-shape.mjs` asserts it** (`getAllPOs` builds no `filterByFormula`). The failure mode is the reason: a list shows what it shows, so a status condition added here would make rows stop appearing with nothing on screen to say any were withheld. Every status belongs — `Awaiting Signature` is the President's own worklist, and `Withdrawn` is kept on record (#138) exactly as the PR list keeps withdrawn PRs (#122).
- **Access is the PR list's, not the invoice list's.** Any active session reaches the page; each row is gated per record by `canViewPR` against the PO's parent PR — the same shared rule `/pos/[poId]` uses. A refused row is simply absent, and a PO with no parent PR is refused rather than shown. `/invoices` differs because invoicing is office work; a purchase order is not.
- **Columns: `PO ID · Vendor · Job / Line · Total · Status`.** No requester column: a PO carries no requester of its own (#138) and the PR list already answers that question, so adding it would spend a column and a query on a fact belonging one document upstream. Job and Line both come from the parent PR, since a PO has neither field — `Job` through the PR's lookup and `Line` through its link, rendered as one cell separated by a middot, which is /prs's own shape for the pair.
- **SORTED BY `PO ID` DESCENDING, SERVER-SIDE, AND THERE IS NO DATE COLUMN — the same shape as `/invoices`**, which sorts by `Invoice ID` and shows only dates that are other facts. A PO ID is `HYE-PO-YYYYMMDD-##`, fixed width and zero-padded, so a plain string sort gives chronological order and the within-day sequence; `InvoiceForm.js` already states that property of this exact format. A `Created` column was there first, on the argument that a list should show the field it sorts by — **`/prs` is the counter-example that retired it**: it sorts by `Created At` and has no date column at all, and `/deliveries` hides its `Created At` tie-break too. Showing the sort key is not this repo's rule. **Consequence on the demo base:** hand-made fixture IDs like `HYE-PO-TESTQA-01` have no date segment, so `T` sorts above any digit and they head the list. Unreachable in production — `mintDailyId` (#164) can only mint the dated format — and the ID prefix is the one thing nobody can backdate, which is why it is the safer key than `Created Date` (the demo seeds backdate that field after generation).
- **A withdrawn order dims the WHOLE ROW**, in #122's classes so the two lists read alike, and its PO ID link inherits the muted color and stays clickable. Terminal but on record (#138), so dimmed rather than hidden.
- **Status renders the field verbatim and carries NO DATE**, which makes the column a closed set of three a reader learns once — the property #166 identified as the difference between a list cell and a sentence. It showed `Signed 2026-07-27` and `Withdrawn 2026-07-27` first; both went, and neither fact is lost: when a PO was signed is on `/pos/[poId]`, and the list already carries `Created` for the date it is scanned by. **There is deliberately no separate Signed column** — it would be blank for every unsigned and withdrawn row (24 of this base's 40) and the declared widths already spend all 832px, so a seventh would take its width from Vendor, the one column with nothing to spare. **`Awaiting Signature` gets no warning and no emphasis** — an unsigned purchase order is an ordinary state of one. The combination worth flagging is "unsigned AND already invoiced", which belongs to the invoice screens and is its own Phase 3 issue. `offline/po-list-view.mjs` asserts the label carries no marker. #19's `statusTag` is deliberately NOT reused: that rule shows only exceptions and stays silent for Signed, which would leave most rows blank in a column headed Status.
- **Newest first** by `Created Date`, tie-broken by `PO ID` descending, undated last — the same chain and reasons as `sortHistoryRows` (#19) and `sortCandidates` (#162). A signature-first default was rejected on #166's precedent: the default list stays newest-first and a *filter* provides the worklist ordering.
- **Three empty states, because they are three different facts.** Nothing on the base ("No purchase orders yet…"), nothing visible to this viewer ("No purchase orders to show. You see a purchase order when you can see the request behind it."), and nothing matching the filters. **The word `yet` is what would make the first false for the second case**, so only one message carries it; the check asserts that. Order is load-bearing — `filtered` is tested last, or a viewer who can see nothing would be told to adjust filters that cannot help them.
- **THE JOB FILTER'S OPTIONS COME FROM THE VISIBLE ROWS, NOT THE VIEWER'S ASSIGNMENTS, which is a deliberate divergence from `/prs`.** There the options are assigned Jobs, so a PR visible only through `canViewPR` clause 5 or 6 — a signer, or a correction recipient, neither of which implies assignment — appears in the list and cannot be filtered to. CLAUDE.md already recorded that as a known inconsistency whose fix is a UI decision; this is that fix, made where the page is new rather than by changing `/prs`. It leaks nothing: every job named is already on a row the viewer can read.
- **SEVEN OPERATIONS, NONE PER ROW — but stepped, not constant.** `requireUser` (1 find) + `getAllPOs` + `getAllVendors` + `getAllJobs` + `getAllLines` + `getPRsByRecordIds` + `getApprovedPRs` (#176's, the seventh). Four of those are selects, which Airtable pages at 100 rows, and the batched PR read chunks at 50 ids — so the count rises one query per 50 or 100 records and never with the number of rows rendered. `getLinkedRecords` is used nowhere here: it re-finds the parent on every call, which is why `/prs/[prId]` reads one PR five times. `#190`'s counter measures selects per PAGE for exactly this reason.
- **Table widths are declared (#166's rule) but measured for these six columns.** The invoice table's 52rem came from its own seven and does not transfer. Measured at 14px/20px Arial plus the 8px `pr-2`: Job / Line 184, PO ID 149, Vendor 124, Status 117, Total 79 — 653px of the 832px available. Three columns are bounded by construction and take what they need; **the remaining 27.5rem is split between the two nobody controls**, Vendor and Job / Line, both human-entered — 192px and 248px, the larger share going to the cell that carries two values and a separator. **PO ID was first sized by counting characters against the invoice list's ID and 38 of 40 rows wrapped**, because a PO ID carries a four-digit year (the one exception to the 2-digit convention) and renders at 141px. Five columns are bounded by construction and take what they need; **Vendor takes all the slack**, being the only column whose content nobody here controls.

### Delivery status on purchase orders (#169)

How much of an ORDER has arrived, on `/pos` and `/pos/[poId]`. A third axis in `lib/deliveryStatus.js` rather than a caller of #166's: `summarizeInvoiceStatus` judges on `billedNotArrived === 0`, so its denominator is the bill, and `lineStatus` is built around invoiced quantity and the within/beyond split. Same question, different denominator, so `poLineDelivery` / `summarizePODeliveryStatus` are siblings.

- **IT READS THE `Delivered Qty` ROLLUP AND NEVER `Delivery Items` — the opposite of what #166 does one level up, and the difference is what each screen needs.** #166 reads rows because it reports within-order and beyond-order arrival as two facts and only a row carries `Over Delivered`; #169 asks one question, for which the sum is the whole answer. That costs one already-fetched field instead of a level of rows.
  - **The rollup is sufficient because of WHERE an over-delivery row attaches, which was verified in code rather than assumed.** `planDelivery` fills each candidate to capacity before moving on, so a surplus exists only once every candidate is full; both branches attach that row to an ordered item already at its `Qty` (the last ordered item filled, or the last ordered item in the order when nothing had room). #167's re-attachment preserves it on both sides — the original ordered item loses a row it did not need to be full, and the overage ordered item's `Qty` is the excess exactly (`lib/overagePR.js` creates it with `qty: row.qty`).
- **The three chip words are the invoice axis's, verbatim, and the rule applied is one name per fact.** The predicate is identical — how much of what this document asked for has arrived — and the denominator that differs is supplied by the row the reader is on. A fourth vocabulary would only make a reader ask what the difference is, which is #166's own argument for sweeping `arrived` to `delivered`. The two sets never share a screen. `STATUS_COPY.column.po` is a separate object all the same, because the dash is not the same fact on both axes.
- **THE DASH IS `nothing-ordered`, NAMED AFTER THE PREDICATE THAT PRODUCES IT.** `countsAsOrdered` empties the judged set for an order with no items AND for a withdrawn one, whose every ordered item has `Committed Qty` 0. Naming it `no-ordered-items` — the invoice axis's word — would have described the case that has never occurred here (measured: **0 of 40 purchase orders carry zero items**) while silently covering the one that has (**5 of 40 are withdrawn**). A withdrawn order has not lost its items; it was ordered and called off, and `Awaiting delivery` would have site staff waiting on material nobody will ship. The judgment is `countsAsOrdered`, never a status string.
- **It counts ordered items, not quantities**, under the same constraint that forces `summarizeInvoiceStatus` to: a PO's items carry different Units, so adding their quantities produces a number of nothing. `anyDelivered` is separate from the completed count for #166's measured reason — a one-item order of 13 with 10 delivered is `Partly delivered`, not `Awaiting delivery`.
- **`/pos` GOES FROM SIX OPERATIONS TO EIGHT, and none of them is per row.** `getAllPOs` already returns each PO's `PO Items` reverse-link array (#19 put it on the mapper because core link data costs nothing to expose), so one `getPOItemsByRecordIds` fetches every ordered item of every VISIBLE order — ids gathered from the gated rows, so a refused row's ordered items never reach the wire either. **This is the opposite shape from the one #193 exists to remove**: that is `getLinkedRecords`' 1 + N, this is zero per row and one query per 50 ids. Measured 6 before and 8 after on 40 orders carrying 53 ordered items; what grows it is the number of ORDERED ITEMS.
- **`recordToPOItem` carries `deliveredQty` and `committedQty` now**, and the comment saying they were absent "about this mapper's audience" was corrected in the same commit rather than left contradicting the code. Delivery-derived, so it is admissible on the employee-facing path for the same reason `material` and #167's `formerDeliveryItems` already are. **No invoice figure is added anywhere** — `/pos/[poId]` already shows a privileged viewer the whole invoice picture and there was no gap there.
- **The list re-cuts its 52rem rather than appending a sixth column**, which is the other half of #166's rule. `Delivery` sits last so it needs no `pr-2`, which is what makes 6.375rem (the 102px `Awaiting delivery` measures at 12px/500 plus the chip's own padding) exactly enough. **The width it took came from Vendor, Job / Line and Total — and the content figures those cuts were judged against are DUMMY DATA**, 40 seeded rows on a base with no real orders, so the two-or-three-character margin left on the human-entered columns is a fact about seed strings rather than about supplier names. Recorded in `POListClient.js` too; if real data wraps those cells, Vendor is where to give width back first.
- **The detail table gains `Delivered` and `Undelivered` for every viewer**, taking the privileged column count from 9 to 11 — which meant three constants, not one: the header cells, the invoice-breakdown row's `colSpan`, and `ItemsSummaryRows`' `trailingColSpan`. A wrong `trailingColSpan` misaligns the footer silently and no offline check can see it, so both privilege levels are checked in a browser. **A negative `Undelivered` gets exactly what `Uninvoiced` gets** — red, with `(over)` — because the two perform the same subtraction against the same `Qty` and a negative means the same thing in both; signaling differently would imply a distinction neither column makes.
- **Not in this issue:** no invoice figure anywhere, no write, and no filter on the new column.

### Naming the documents on an order (#233)

The detail page counted what arrived and what was billed without naming either. Two lists below the items table now do: the invoices charging this order and the deliveries filling it, **each document once**.

- **THE DEFECT WAS THE PLACEMENT, NOT THE DATA.** Every invoice item was rendered on a dotted row under the ordered item it charged, and that row mixed two kinds of fact. Quantity, unit price and `Invoice Items."Variance Flag"` belong to the (invoice, ordered item) PAIR; `Paid` and `Invoices."Variance Flag"` belong to the INVOICE. Per-row placement rendered the second kind once per row an invoice charged, so `HYE-INV-260716-03` — which bills two of `HYE-PO-20260716-03`'s ordered items — printed its own `Not paid` twice. Verified in a browser before and after: two rows each with a badge, then one entry with one badge and its two charges under it.
- **IT DOES NOT MAKE THE PAGE SHORTER, and expecting that would be the wrong reason.** Three ordered items billed by two invoices is six pair-facts either way. What drops is the repetition of the header facts, six to two. The pair facts moved rather than disappeared — they are inside the invoice's entry now instead of under the ordered item's row — which is also the answer to "where did the per-ordered-item figures go": nowhere, they changed parent.
  - **The alternative that was rejected was dropping them.** `⚠ Variance` on a charge is `Invoice Items."Variance Flag"`, which the backend sets against THIS ordered item's agreed price and quantity, so it is a fact about the order being billed wrongly and belongs on the order's page. Dropping it would have meant opening each invoice in turn to find which charge was flagged.
- **EACH ENTRY NAMES THE ORDERED ITEMS IT TOUCHED, AND #232's REASON FOR NOT DOING SO DOES NOT REACH HERE.** That issue keeps a delivery's orders off the INVOICE's page because the frame there is one invoice and a delivery can carry bills that invoice has nothing to do with. The frame here is one ORDER, and only this order's ordered items are ever named, which is inside the frame by construction. **What DOES carry over is the other half:** a document may also have charged or filled orders elsewhere, so no entry holds the document's own total. That is why an invoice entry has no `Amount Due` — a money figure beside a purchase order invites addition against the order's total, and #167's `invoiceCaveat` exists because exactly that comparison misleads.
- **A SETTLED OVER-DELIVERY LEAVES THE DELIVERY LIST, and the list and the column agree about it.** #167's apply step re-points the row onto the corrective order's ordered item, leaving the original order only `Former Delivery Items`; this walk reads the CURRENT `Delivery Items` link, so the arrival drops out. **Measured 2026-08-14, 53 of 53 ordered items: `PO Items."Delivered Qty"` equals the sum over the current link exactly, with no contribution from `Former`** — so the `Delivered` column drops by the same quantity in the same moment. A list that kept the arrival while the column forgot it would be two answers to one question. The page holds `formerDeliveryItems` and could have used it; where the excess went is #167's banner's story, and that banner is already on this page.
- **AN UNATTRIBUTABLE OVER-DELIVERY IS ON NO ORDER'S LIST AT ALL.** `Delivery Items."PO Item"` may be empty for an over-delivery allocation could not put on a single order, and this walk reaches rows through that link. Such a slice is also absent from every `Delivered Qty`, so the two agree again; the item axis still holds it through `Material`. Said out loud because the silence otherwise reads as a bug.
- **SORTED THE WAY EACH DOCUMENT'S OWN LIST SORTS IT** — invoices by `Invoice ID` descending (`getAllInvoices`' server-side order, and that ID is a date plus a zero-padded daily sequence so a string sort is chronological), deliveries by `Received Date` descending with `Delivery ID` as tie-break and an undated one LAST, which is `sortCandidates`' call. A reader crossing from `/invoices` or `/deliveries` should not meet the same documents in a new order.
  - **`lib/overage.js:sortInvoicesOldestFirst` COEXISTS WITH THIS AND IS NOT A DUPLICATION TO MERGE.** That one is `Issue Date` ascending and answers which bill CARRIES an excess — the order the bills were raised in, because the oldest has the first claim on a quantity. This one answers what a reader sees first. One is an attribution rule with a consequence in the data, the other a display order with none; merging them would give one of the two the wrong key.
- **BOTH SECTIONS RENDER EMPTY RATHER THAN VANISHING**, for a viewer entitled to them. This is the page someone comes to in order to reconcile, so an absent section cannot be told apart from one that looked and found nothing — #210's call on the delivery detail, where empty is a reading and the sentence says which. **The invoice section is the exception and is absent entirely for a non-privileged viewer**, because "nothing has billed this order" is itself invoice information.
- **THE GATE MOVED IN #235, AND THIS IS WHERE IT WAS RECORDED AS NOT HAVING.** Invoice-derived data on this page was `isPrivileged` while `lib/airtable/poItems.js` recorded that #211 had retired the President-or-Admin line on `getPOItemsForReconciliation` — what a vendor billed is readable by anyone who may read the order behind it — leaving `Paid` as the narrower replacement. The page withheld more than the rule required for four issues. #235 opened it: the `Invoiced` column, the invoices charging the order and the new invoicing chip are read by everyone who can see the order, one projection serves both audiences, and `Paid` is on its own flag. **The hazard #233 wrote into that page's header is what made the split cheap** — it named `Paid` as the one thing to separate before the gate ever widened, so widening it was a rename rather than an audit.
- **THE DELIVERY CHIP IS #169's OWN, AND CALLING IT MADE TWO COMMENTS TRUE.** `summarizePODeliveryStatus` said it was "shared by /pos and /pos/[poId] so the row a reader clicks and the page they land on cannot describe one order differently", and `/pos` said the same about the detail page beside its own call — but that page never imported the module, so both sentences were false from #169 to #233. Corrected by adding the call rather than narrowing the comments, since the property they state is the one worth having. Verified: `HYE-PO-20260730-02` reads `Partly delivered` on the list row and `Partly delivered` on the page.
  - **IT FOLDS THE TABLE ABOVE IT, NOT THE LIST BELOW IT**, which is the one thing the placement could be misread as. The summary counts ORDERED ITEMS whose delivered quantity reached what was ordered — the `Delivered` column — and knows nothing about how many documents brought them. It sits beside the `Deliveries` heading because the invoice detail puts its chip beside `Delivery`, so the two screens read with one grammar, and because "is it all here" is the question a reader arrives at just before the arrivals themselves.
  - **NO NEW READ, ON EITHER PATH.** `poLineDelivery` wants `orderedQty`, `deliveredQty` and `committedQty`, and `recordToPOItem` carries all three, so both the privileged and the employee projection already held everything the chip needs. The cost was not re-measured for it, and that is the reason.
  - **No gate**, delivery-derived like the `Delivered` column beside it — verified that `scoped-fixture@` sees the chip. **No invoicing chip was added**, and not for want of symmetry: the PO axis has no invoicing summarizer, so one would have to be written, which needs its own decisions about whether `countsAsOrdered` drops a withdrawn order and what to call an order billed beyond what it asked for. `/pos` also has no privileged branch at all, so putting an invoice-derived chip there settles the gate question above first. It is #235.
- **ONE OF THE TWO VARIANCE WORDS CHANGED, AND THE OTHER WAS PUT BACK AFTER BEING CHANGED.** `Invoice Items."Variance Flag"` — one charge against what the order agreed — read `⚠ Line Variance` and reads the bare `⚠ Variance` the invoice detail's items table already uses for that same field. That is not #179 arriving early: it is the word this repo reserves for a Job's `Lines` row being kept out of new screen text, and `offline/line-vocabulary.mjs` cannot see text written straight into JSX, which is how it got there. The copy is a `*_COPY` constant now, which is what brings it under that check.
  - **`Invoices."Variance Flag"` KEPT `⚠ Header Variance`, and briefly did not.** This issue renamed it `⚠ Total variance` and put it back on review. The invoice detail says `⚠ Header Variance`, so coining a better word here gave one flag two screen words — which is the drift #179 exists to remove, added by the change that was trying to be tidy. **Keeping the word is not an endorsement of it:** #179's body has already chosen the replacements, `Total mismatch` and `Over-billed`, and neither is what was coined. The two pages change together under that issue or not at all.
- **COST, MEASURED before and after on `HYE-PO-20260716-03` (2 ordered items, 1 invoice, 0 deliveries).** Admin **16 → 13** operations, and the log's own repeat signal **8 → 5**: the invoice level went from `Invoice Items find ×2` plus `Invoices find ×1` to one `list` each, and `PO Items` from `find ×4` to `find ×2` because `getItemsByPOItem` re-found its parent on every call. The employee path measured **11 → 11** on that order, which is the honest figure and not a null result: it never had the invoice loops, and this order has no deliveries, so both new reads got empty id lists and `findByRecordIds` returns early. **The delivery level costs 2 operations flat** — measured on `HYE-PO-20260804-04`, which carries two deliveries and two slices and still pays `Delivery Items` 1 + `Deliveries` 1. Nothing on this page grows with the number of ordered items or documents any more.
  - **This is one of the 1 + N shapes `airtable-access.md` measured and left for #193.** That file's `/pos/[poId]` row said 13 operations on a 1-item PO with "5 repeats [that] are `getLinkedRecords`' 1 + N"; two of the three sources of those repeats are gone.
- **THE TABLE CARRIES TWO FIGURES WHERE IT CARRIED FOUR.** `Undelivered` and `Uninvoiced` are gone: each was that row's own `Qty` minus the column beside it, so the reader subtracts and the table shows `Delivered` and `Invoiced`. **This entry said the opposite for one commit** — that no column was added or removed and the column set was outside this issue — which was true of the commit that first wrote it and false from the next one on.
  - **THE ONE PLACE INFORMATION COULD HAVE BEEN LOST IS THE OVER SIGNAL, and it moved rather than going with the columns.** The red `(over)` mark rode on those two cells going negative and is the only thing on a row that says more arrived, or more was billed, than was ordered; it is on `Delivered` and `Invoiced` now. **The predicate did not move with it:** the mark still reads `undeliveredQty(...) < 0` and `uninvoicedQty < 0`, because those two functions own those figures and a column being removed is no reason for the page to acquire a second answer to either. #169's rule that the pair is signaled identically came across with them.
  - **SO THIS ISSUE TOUCHED ALL THREE OF #169's HAND-COUNTED CONSTANTS**, which that section names as three rather than one: the invoice-breakdown row's `colSpan={11}` retired with the per-row placement, the header cells lost two, and `ItemsSummaryRows`' `trailingColSpan` went 5/3 to 3/2 for a table of 9 columns and 8. A wrong `trailingColSpan` misaligns the footer silently and no offline check can see it, so both privilege levels were counted in a browser again.
- **MONEY GOES THROUGH `formatUSD`, AND THIS PAGE WAS THE EXCEPTION.** The items table printed `unitPrice` and `amount` raw, disagreeing with the `Total Amount` block directly above it and with the invoice detail's own items table, both of which already formatted. The charge line in `PO_DOCUMENTS_COPY` had the same raw figure after its `@`. `lib/format.js` is pure — one `Intl.NumberFormat` and no imports — so `lib/poDocuments.js` importing it keeps that module offline-safe. **A charge with no unit price prints no money at all rather than `$0.00`**, which would be a figure the invoice item does not carry.
- **Not in this issue:** the gate, the invoice detail page and `getInvoiceReconciliation` (both #232's), an invoicing chip on the PO axis (#235), and any schema change (both reverse-links already existed and were already read elsewhere).

### Purchase Orders

- **No `Sent to Vendor` status (#144)** — the one place that name still appears, kept as the record of the decision. The option existed on the Status field, but no code path ever wrote it and no PO record ever held it: the PO reaches the vendor by email, outside the app, so the value could only be set by hand in Airtable. It was removed rather than implemented. This does **not** mean canceling an order that has already gone to the vendor is unreal — it just has no in-app path: the expected handling is a conversation with the vendor plus a manual Airtable correction, and what comes back is a credit memo or a corrected invoice, which makes it invoice-side work. Silence beats promising a process that doesn't exist. **Reopening condition:** if sending the PO to the vendor ever moves into the app, the status returns as a *byproduct* of that action rather than a step someone sets by hand — and withdrawal then has to be excluded from it again, deliberately. Note the asymmetry that would greet it, because the two sides guard in opposite directions. Withdrawal is an **allowlist**: `PO_WITHDRAWABLE_STATUSES = ["Awaiting Signature", "Signed"]`, so an unlisted status is refused. The invoice-side queries are a **denylist**: `{Status} != "${PO_WITHDRAWN_STATUS}"` — one shared fragment, `PO_NOT_WITHDRAWN`, read by `getPOsExceptWithdrawn` and `searchPOs` and inherited by `getOpenPOs` — so anything not named is admitted. A status option added to the field later is therefore refused by withdrawal *and* reaches the invoice picker with no code change and no notice. Recorded here, not fixed — whether that denylist should become an allowlist is its own decision.
  - **#168 narrowed that denylist from two statuses to one, and the reason was a false comment rather than a preference.** `getPOsExceptWithdrawn` — which carried a broader name before #168 renamed it — also excluded `Awaiting Signature`, justified in its own doc by "a PO that hasn't even been signed/sent to the vendor yet can't have a real vendor invoice against it". **The old name is deliberately not spelled here, because #168's second commit rebinds it to a different reader (every PO, no status filter) and a back-reference using it would read as a claim about that one.** **The base disproves it: `HYE-PO-20260805-02` is Awaiting Signature and carries an invoice**, and two ordinary paths produce that. Site staff order outside the app and the PR/PO follow as a record — the same fact #162 cites for not filtering delivery candidates on signature status, and why `Committed Qty` and `Signed Qty` are separate fields. And a corrective PO (#167) exists *because* material already arrived, so the excess invoice can precede it by construction. The exclusion was also never enforced anywhere but the picker query: `/api/invoices/detect-po` resolves by `getPOById` with no status filter, `InvoiceForm` deliberately appends a detected PO the picker's fetch missed, and `createInvoiceAction` checks only `Withdrawn`. So the same PO was unfindable by browsing and findable by uploading a PDF quoting its number. #133's Step 2, which asserted the exclusion, was a **rename guard** — it existed to catch a leftover `!= "Draft"` string — and #168 leaves no signature-status string for it to guard, so that step now asserts the new behavior instead.
  - **The gap #168 opened, deliberately and not fixed there:** an unsigned PO reached the invoice picker with **nothing marking it as unsigned**, so office staff could pick an order the President had not approved. #198 closed it with a signal rather than a filter — see its own section below.
- **Withdrawn (#138)** is the PO-side counterpart to PR Withdrawn: the requester decided not to order after all. Set by the **parent PR's Requester** (a PO carries no requester of its own, and needs none — nor an actor field on the withdrawal), confirmation modal, no reason capture, terminal (no revive). Eligibility is ONE shared predicate, `lib/poWithdraw.js:getPOWithdrawEligibility` — Status in {Awaiting Signature, Signed} AND no linked invoice (Invoice-PO Link join rows; the Invoice Items reverse-link is a safety net for a row stranded by a best-effort rollback). Status is tested first on purpose: a PO that fails the status test *and* has invoices must not be told to ask an Admin to unlink, since unlinking wouldn't make it withdrawable either. The two statuses are an allowlist, not an exclusion list — anything outside them is refused by default, including an option added to the field later without a matching code change. A linked invoice is evidence the order did go out, so the UI *explains* that an Admin has to unlink first rather than disabling the control. Modal copy (second person, to the actor) and page-banner copy (third person, to any viewer) sit as one pair in that same module and branch on the single condition `President Signed`. Terminal is enforced, not just labeled: `signPOAction` refuses a Withdrawn PO (without it, signing would write Status back to Signed and `syncPRStatusToPOSigned` would advance the PR), `regeneratePDFAction` refuses it — the PO PDF is the document sent to the vendor, so the line is "no new documents, existing document preserved": an already-generated PDF stays downloadable as audit trail — and `createInvoiceAction` refuses to link an invoice to one. A Withdrawn PO drops out of `getPOsExceptWithdrawn`/`searchPOs` (the invoice picker and /api/pos/search) and out of `/api/invoices/detect-po`'s candidates, where it is reported in its own `withdrawn` bucket instead: a vendor invoice quoting a withdrawn PO number means the vendor shipped anyway or the withdrawal was a mistake, which is the only place that contradiction surfaces, so it must never read as a failed detection. Partial closure of a partly invoiced PO is out of scope (there the order went out and was partly fulfilled — a different thing).

### PO Items

- **The item axis (#18).** `Material` (link -> Materials, single) is the **one** field written after creation, by `setPOItemMaterial` from `lib/materialsCache.js` — deliberately narrow, and outside PO generation's rollback, so the frozen snapshot stays frozen and a cache failure cannot undo a PO. There is no general-purpose `updatePOItem`, on purpose.
- **Computed here, and this is where the which-POs-count rule lives:** `PO Status` (lookup via PO), `Invoiced Qty` (rollup = SUM of `Invoice Items.Qty` through the **PO Item** link, not through PO), `Committed Qty` (formula = `IF({PO Status} & "" = "Withdrawn", 0, {Qty})`) and `Signed Qty` (formula = `IF({PO Status} & "" = "Signed", {Qty}, 0)`). The rule sits in these two named fields rather than inside each Materials rollup's condition: a rollup condition is invisible in a schema dump, unreadable from code, and would have to be repeated per rollup. `Committed` minus `Signed` is the awaiting-signature quantity, so no third field is needed. The `& ""` coerces the `PO Status` lookup — an array — to text; **verified with real values across all three statuses (#18)**, since a silent coercion to `""` would have folded withdrawn quantity into the order book.
- **Rollup chain:** `Invoice Items.Qty` -> `PO Items.Invoiced Qty` -> `Materials.Invoiced Qty`; and `PO Items.Committed/Signed Qty` -> `Materials.Committed/Signed Qty`. Two levels, both measured as already settled on the first read after the write that feeds them.
- **`Delivered Qty` (#162)** — rollup, SUM of `Delivery Items.Qty` through the **`PO Item`** link (not through PO). Rolled up to the ordered item rather than to any invoice item because material often arrives before an invoice exists. Read under the same condition as `Invoiced Qty` and measured the same way: allocation subtracts it from `Qty` to decide what an ordered item can still absorb, so a lagging value would over-allocate the NEXT arrival to an ordered item already full — measured already correct on the first read after `create()` returned (`reads === 1`), and re-measured on every run of `verify-deliveries-162.mjs`. That script is also the only place the rollup's AGGREGATION FUNCTION is proved, since Airtable's Metadata API does not expose it: 4 + 5 = 9 distinguishes SUM from a COUNT of 2, and nothing in a schema dump can. No status condition, matching `Invoiced Qty`: allocation only selects ordered items whose `Committed Qty` is above zero, so a withdrawn PO's ordered items are never targets. **Deliberately NOT chained onto `Materials`** — #20 is Job-scoped and Materials' quantity rollups ignore Job. **#20 still reads `Delivery Items` directly, but for a different reason since #165.** The old one is gone: every row now names an ordered item, so nothing is missing from the rollup. The new one is that this field now SUMS TWO DIFFERENT FACTS. An attached over-delivery row pushes it above the ordered item's `Qty` — deliberately (see "Over-delivery is flagged") — so `Delivered Qty` alone cannot say how much arrived *against* the order versus *beyond* it. Only `Delivery Items` carries `Over Delivered` per row, and separating those two is exactly what a discrepancy screen is for. **#166 is the first reader to act on that**, and it reads the rows for exactly this reason: it reports "arrived against the order" and "arrived beyond it" as separate facts, which the rollup cannot decompose. It still reads `Invoiced Qty` from the rollup, because there the ORDERED ITEM's total across every invoice is precisely what is wanted (see "Delivery status").
- **This table has NO `PO Record ID` lookup, and the reason it is worth saying is that it used to (#19, deleted since).** The field was misconfigured: despite the name it was a lookup, through the `PO` link, of `Purchase Orders."Invoice Items"`, so it returned the PO's *invoice-item link array* rather than its record id — measured, a filter on it matched 0 of 4 expected rows and the raw value on a real ordered item was two Invoice Item ids. It was the only one of the base's `* Record ID` lookups that was wrong; the rest resolve to a `_Record ID` RECORD_ID() formula and work. Nothing ever read it, so deleting it broke nothing, and **the standing instruction is unchanged: batch PO Items by `RECORD_ID()` via `findByRecordIds`.** The episode is kept because it is the cleanest example of the hazard the "Airtable side is outside CI" convention describes — a field that looked right from its name, was wrong in a way no file-only check could see, and sat there because nothing read it. That is also the argument against adding a lookup nobody reads: #162's two new tables need none, since every read reaches them through a reverse-link or the primary field.

### Approved requests with no purchase order (#176)

A strip above the table listing approved PRs whose generation failed, with the
Admin retry on each row. The first of three built to the same shape — #216 puts
deliveries with no invoice above `/invoices`, #217 puts over-deliveries with no
correction above `/prs`.

- **IT IS ON `/pos`, AND WHO CAN ACT IS WHY.** `generatePOAction` is
  `withAdminAction`, Admin is office staff, and the office works from that
  screen; a strip on the request list would offer an action most of its readers
  cannot take. The requester's path to knowing is unchanged and is that PR's own
  detail page, whose copy #176 also corrects. #217 putting a site-facing strip on
  `/prs` is the other half of the symmetry.
- **THAT A MISSING ORDER CANNOT APPEAR IN A LIST OF ORDERS IS WHY THIS IS A STRIP
  RATHER THAN A COLUMN.** A strip is what shows a list what the list structurally
  cannot: there is no row here to carry the fact, because the row is the thing
  that does not exist. The same sentence is why `/pos` needed something new at all
  rather than a seventh column, which the declared 52rem budget has no room for.
- **THE EMPTY STATE RENDERS NOTHING, AND THAT IS HOW THE SCREEN SAYS IT IS
  NORMAL.** A standing "all clear" line above every list is a thing people learn
  to skip, and then it is not a signal on the day it changes. #19's `statusTag` is
  the precedent already here — it reports exceptions and stays silent otherwise,
  which is the reason this file gives for not reusing it in a Status column. The
  counter-argument is real and was weighed: an invisible feature cannot be learned
  and "nothing to fix" looks like "the strip is broken". What answers it is the
  offline check plus having looked at both states in a browser, not a permanent
  banner. **This is meant to be the rule for all three strips.**
- **ROWS CARRY PR ID, Job / Line, Vendor — and nothing the table below repeats,**
  because the table below holds no row for any of them. Job / Line uses the same
  pair and separator as the list's own first column, so a reader locating work
  reads one shape in both places.
- **ASCENDING BY `PR ID`, WHICH IS AN APPROXIMATION AND SAYS SO.**
  `Purchase Requests` records no approval instant — `Created At` and `Withdrawn At`
  and nothing between — so "longest stuck first" is not answerable and the raise
  date stands in for it. A PR raised long ago and approved today therefore floats
  too high rather than sinking too low, which is the direction to be wrong in: a
  non-urgent row near the top costs one glance, an urgent row at the bottom of a
  growing list costs the whole point of the strip. Descending was the first choice
  and is exactly that inversion.
- **`PO Signed` IS IN THE STATUS SET AND SHOULD NEVER MATCH.** That status fires
  when the President signs the generated order, so such a PR necessarily has one.
  It is included because `generatePOHandler` accepts both statuses and the PR
  detail page renders its PO section for both — a narrower set here would disagree
  with the two places that already decided this — and because an anomaly is better
  surfaced than filtered away.
- **TWO VOICES, one heading.** The fact is the same for everyone; the next step is
  not, since only an Admin can run the retry. Same split `lib/poWithdraw.js` makes
  between `modal` and `banner`. A strip that offers an action to someone who cannot
  take it reads as their fault.
- **NEITHER VOICE SAYS "yet", which is the half of #176 that is copy.** The PR
  detail page said "PO generation hasn't completed yet". Generation is synchronous
  inside the approving action and never retries itself, so a request showing that
  line had already failed and `yet` told the reader to wait for something that
  would not arrive. Both screens now read the same sentence out of
  `lib/poListView.js`.
- **OUTSIDE THE TABLE'S WIDTH BUDGET, INSIDE THE PAGE'S.** The table is
  `table-fixed` with a `colgroup` summing to exactly 52rem and no slack; a strip is
  not a column, so it re-cuts nothing. It does share the 832px, and it is a list of
  one-line rows rather than a second table — two stacked tables read as one dataset
  split in half, and #216 and #217 show different facts on the same shape, which a
  line of text carries and a `colgroup` does not. **Measured, not counted:** 832px
  strip, rows at 26px (Admin, with the button) and 20px (without), `scrollWidth`
  equal to `clientWidth` on every row, no horizontal scrollbar.
- **ONE SELECT, NEVER PER ROW.** `getApprovedPRs` filters on `Status`, which is a
  plain select and so legal in a formula; whether `Purchase Orders` is empty is
  asked of the mapped record instead, since a formula sees a link field as its
  primary-field text. Job, Line and Vendor come from maps the table already built.
  Measured on this base: `/pos` went 8 to 9 operations, and the ninth is that
  select. **`scoped-fixture@` measured 8 rather than 9 on the same code**, which is
  not a second cost model: the only read that depends on the visible set is
  `getPOItemsByRecordIds`, chunked at 50 ids, and 34 visible orders carry few
  enough ordered items for one chunk where 40 need two.
- **THE STRIP IS GATED BY `canViewPR`, APPLIED TO THE REQUESTS.** There are no
  orders here to gate. A viewer who can see none of them gets no strip, which is
  the same answer the table gives and for the same reason: a refused row is absent
  rather than announced.
- **THE RETRY IS `generatePOAction` UNCHANGED**, not a second action for this
  screen — it is already `withAdminAction`-wrapped and is a no-op once an order
  exists. It redirects to the PR, so pressing it here leaves this page. That was
  left alone deliberately: the redirect is right for the caller that already
  existed, and changing a shared action's behavior on the evidence of one new
  screen is a decision worth having all three strips in hand for.

### Showing an unsigned order where an invoice can be attached (#198)

`#168` stopped hiding unsigned POs from the invoice-side queries and said so: an
invoice against one is exactly the thing that must not be lost. What it left is that
such a PO reaches the picker carrying nothing, so the office selects an order the
President never approved without learning that. This adds the signal and changes no
query — `lib/poUnsigned.js`.

- **A FLAG BESIDE `isOpen`, NOT A BUCKET LIKE `withdrawn`, AND THE DIFFERENCE IS
  SELECTABILITY.** `/api/invoices/detect-po` keeps a withdrawn PO out of `confirmed`
  entirely because nothing may be invoiced against it; an unsigned one must stay
  selectable, which is the whole point of #168's narrowing. So it rides on the
  candidate, in the same category as `isOpen`: a fact that changes what a reader knows
  and nothing about what the form does. Its tone is not raised either — `withdrawn`
  forces `level: "warning"` because that PO is unusable, while here invoicing is the
  normal path and a warning would make the office read ordinary work as a problem.
- **THE SEARCH ESCAPE HATCH WAS THE THIRD OFFERED SURFACE AND THE ISSUE'S TEXT DID NOT
  NAME IT AT FIRST.** `/api/pos/search` projected `{id, poId, vendorId, shippingFee}`
  and dropped `Status`, so the one surface that could not have shown this was the
  results list inside the same picker. #168 made both readers share one filter
  fragment and left their two response shapes alone, which is the same asymmetry it
  was diagnosing, one level out: a PO the dropdown marks and the search does not. The
  issue body was amended to name the hatch before this was implemented.
- **THE PROJECTION CARRIES `unsigned`, A BOOLEAN, RATHER THAN `Status`.** Widening it
  to the status string would have been shorter and would have put the judgment in the
  browser, giving `isPOUnsigned` a second implementation to drift from. The judgment
  runs on the server at each of the three surfaces — the form's page mapper, the search
  route, the detect route — and every PO shape the client holds carries the answer
  under one name, which is what lets one label helper serve all three.
  `offline/po-unsigned.mjs` asserts the form spells no status string and reads no PO's
  `status`; that assertion started as a blanket ban on `.status ===` and failed on the
  form's own upload and fetch state machines, so it is narrowed and says why.
- **IT READS `Status` AND NEVER `President Signed`, WHICH NO SCREEN COULD SHOW.** A PO
  withdrawn before it was ever signed has `presidentSigned: false` and is not awaiting
  a signature — that order ended. The checkbox is the plausible wrong field: it sits on
  the same record, reads as the same question, and agrees with the right answer on every
  PO an offered surface can hold, because a withdrawn PO reaches none of them. Pinned
  in the offline tier with that exact case and with a mutant keyed on the checkbox.
- **THE COPY SAYS WHAT IS OBSERVED AND STOPS.** The record cannot say which cause it is
  — the site ordering directly, or a corrective order that exists because material
  arrived — so the clause names the missing signature and the fact that the PO was
  still selected. It is the `withdrawn` note inverted in exactly one clause: that one
  says it was NOT selected. An earlier draft ended "an invoice against an unsigned
  order has to be recorded", which reads as an instruction about work the office is
  already doing right; it reads "an invoice can be recorded against an unsigned order"
  instead, and the offline check bars the modal verbs and the cause words from it.
- **THE BANNER SAYS IT ONLY WHERE THE APP SELECTED THE PO.** The two auto-fill branches
  carry the clause; the vendor-conflict branch and the "not auto-applied, a PO or items
  are already entered" branch do not, because "it was still selected" would be false
  there. Nothing is lost by the silence: both of those branches tell the reader to
  select manually, and the option they then open reads `— unsigned`. The alternative was
  a second voice for the unselected case, which is more copy for the rarer branch and
  two sentences to keep in step.
- **`statusTag` IS NOT REUSED, and `/pos` already refused it once for its own reason.**
  That rule (#19) is a three-status tag for the material screens, silent for `Signed`
  and worded `PO unsigned` because it renders beside a VENDOR name and has to name its
  subject. A picker option is the PO's own id, so naming the subject again repeats it.
  **The condition for merging is measurable:** the day this signal needs the withdrawn
  or unknown-status branches, one function covers both and this one goes.
- **NO NEW READ ANYWHERE.** `recordToPO` already returns `status`, so all three surfaces
  had the fact in hand; the flag is a pure computation on a record each of them already
  fetched. `/invoices/new` has carried a `withOpsLabel` since #231, so the before and
  after are measurable there; the two routes are unlabeled, as every Route Handler in
  this repo is, and #224 owns that sweep.
- **`createInvoiceAction` IS UNTOUCHED.** It still refuses only `Withdrawn`. A signal is
  not a gate, and an unsigned order's invoice is the one this whole line of issues
  exists to keep.

### Leaving the PO list where the search found it (#242)

A slot's dropdown drew from the same list #57's search hatch merges its results into,
and the toggle cleared the slot's query, results and status while leaving the list
itself widened. So a form on which somebody searched once offered every order the
search returned, closed ones among them, in a control whose default set is that
vendor's open orders. The rule is `lib/poPickerOptions.js`.

- **#198 MADE IT VISIBLE RATHER THAN CAUSING IT.** The unsigned marker on the results
  told the closed orders apart from the ones that belong there. Before it, the widened
  dropdown looked like a longer list of the same kind of thing.
- **A SEARCHED ORDER IS OFFERED WHILE A SLOT HOLDS IT, AND THE CLAIM IS THAT NARROW
  BECAUSE `handleSlotChange` MAKES IT SO.** Picking a result resets the slot to
  `EMPTY_SLOT` with the id set, which closes that slot's search and drops its results in
  the same write — so from the moment a searched order matters, a slot holds it. An
  earlier draft of the rule also kept whatever an OPEN search still listed; that would
  have re-created this defect one slot over, since a second slot's dropdown would widen
  because somebody searched in the first.
- **DERIVED AT RENDER, NOT PRUNED FROM THE STATE.** Pruning on the toggle would have to
  spare whatever another slot's open results still list, and would need the same hook
  again on slot removal and on a vendor change; each miss strands orders in the list for
  the rest of the session. Deriving is idempotent, so no sequence of toggles can leave
  the state disagreeing with the rule, and **nothing is ever removed** — which is what
  keeps a picked result renderable. The alternative fails exactly there: prune the
  record and a result picked a moment later selects a value with no matching option,
  the misleading screen `posList` exists to prevent.
- **`posList` MEANS "RECORDS THE BROWSER HOLDS" AND THE DROPDOWN DECIDES WHAT IT MAY
  SHOW.** That split is why four other consumers need no change: the per-item PO select
  and the three Shipping Fee facts (prefill, mismatch warning, reference line) all read
  `selectedPos`, which is what the slots hold, and a held order is never dropped. **The
  issue body gives one reason for that and there are four** — it names the `<option>`
  the slot renders; the other three would have gone silent while the slot still showed
  the order.
- **ORIGIN IS EXPLICIT BECAUSE THE TWO MERGES MUST BE TOLD APART.** #46's detection
  merges an order and, in its non-pristine branch, leaves it unselected while telling
  the reader to pick it manually — so a rule that kept only what a slot holds deletes
  the affordance #46 built and #198 marked. Distinguishing by shape was the alternative
  (only search results carry `shippingFee`) and that is an accident of two projections
  rather than a statement about provenance.
- **DETECTION ALSO CLAIMS AN ORDER THE SEARCH ALREADY PUT THERE, and the hole this
  closes was opened by the narrowing itself.** Search for a closed order, do not pick
  it, then upload a file quoting it: the entry is already in the list, so the merge
  skipped it, so it stayed tagged as merely searched — and the banner would have named
  an order the dropdown no longer offers. `claimDetected` re-tags it and hands back the
  same array when it changed nothing, so the merge keeps its state identity.
- **THE QUIET MUTANT IS THE ONE THE CHECK NAMES FIRST.** Remove the narrowing and the
  form returns to the behavior this issue is about, the screen looks ordinary, and no
  other check reads this list — the same standing as #237's `always agree`. Two more are
  pinned: dropping the self-allowance clause hides the order a slot is displaying, and
  narrowing by any origin drops what detection merged.
- **NO NEW READ, AND NONE LATER EITHER.** Deriving removes nothing, so an order picked
  after a search needs no second request, and `poItemsCache` is never evicted anyway.
  Measured on the labeled route: 85 ops on `/invoices/new` before and after.

### Asking the base which orders are still open (#244)

`getOpenPOs` is one query — not withdrawn, and at least one ordered item with
something left to invoice — where it used to fetch every non-withdrawn order and
then ask each one in turn. The picker's set is unchanged; who computes it is not.

- **THE COST HAD NO CEILING, AND THAT IS WHY THIS IS A DEPLOYABILITY ISSUE RATHER
  THAN A PERFORMANCE ONE.** `isPoOpen` re-read the order and walked its ordered
  items, so the screen cost 1 + 2N with N the orders the company has ever placed
  and not withdrawn. Measured on this base: **83 operations, of the 85
  `/invoices/new` cost**, the other two being the session and the vendor list.
  Every other screen is bounded by one document's items or by the office's
  headcount; this one was bounded by history. Airtable's five requests a second
  is a whole-base limit that no plan raises, so one person opening this form asked
  for a multiple of the entire base's budget — which makes it a limit on
  concurrent users rather than on latency.
- **THE OLD COMMENT'S DEFENSE WAS TRUE OF ONE ORDER AND FALSE OF A LIST OF THEM.**
  It argued that an order with an unfulfilled item early in its list is cheap to
  confirm, which is correct — and irrelevant to a caller that pays that
  confirmation once per order. The early return bounds the walk WITHIN one order
  and does nothing about the number of orders, and the comment did not draw the
  distinction. Its true half is now on `getOpenPOs`, where the reader is.
- **TWO FIELDS, BECAUSE A ROLLUP AGGREGATES ONE CHILD FIELD.** `Qty - Invoiced
  Qty` cannot be computed inside a rollup, and a rollup CONDITION cannot compare
  one field against another either. Even if it could, this base already decided
  against conditions: `Committed Qty`'s own description records that a condition
  is invisible in a schema dump, unreadable from code, and would have to be
  repeated per rollup. So the judgment sits in a named child field, `PO Items."Has
  Uninvoiced Qty"`, and `Purchase Orders."Uninvoiced Items"` sums it — the shape
  `Committed Qty` -> `Materials."Committed Qty"` already uses.
- **IT COUNTS ITEMS AND NOT QUANTITY, AND SUMMING THE QUANTITY WOULD BE WRONG
  RATHER THAN MERELY DIFFERENT.** An order with one item over-invoiced by 5 and
  another under-invoiced by 5 has zero uninvoiced quantity and is open. Openness
  is the OR of a per-item predicate, so the only faithful aggregate is a count of
  the items that pass it.
- **`Qty`, NOT `Committed Qty`, in the child formula.** Withdrawal is already the
  picker query's other half, through the shared `PO_NOT_WITHDRAWN` fragment.
  Reading it in the formula as well would put one rule in two places, and the two
  would answer differently the day the status list changes. `getOpenPOs` is the
  fragment's third reader for the same reason — its two halves belong in one
  formula rather than in a call to `getPOsExceptWithdrawn` plus a filter.
- **`isPoOpen` IS GONE, AND ITS OTHER CALLER GOT CHEAPER, NOT MORE EXPENSIVE.**
  `/api/invoices/detect-po` asks about one order rather than all of them, which is
  the case the walk suited — but it had already fetched that order through
  `getPOById`, so the walk was a second read of a record in hand. It reads
  `Uninvoiced Items` off that record now, in the same pass that sets `unsigned`,
  and pays nothing. Reading the same field the picker filters on is also what
  stops the banner naming an order the dropdown withholds, which is exactly the
  asymmetry #168 was diagnosing.
- **WHAT IS INHERITED IS A LAG, AND IT IS NAMED RATHER THAN ASSUMED AWAY.** The
  walk read the rollup off a `.find()`; the query reads it through Airtable's
  query index, which `client.js` records can briefly miss a just-written record.
  Measured in `verify-open-orders-244.mjs` Part E in both directions, with the
  figure written onto `PO Items."Invoiced Qty"` in the base beside #18's
  first-read measurement, which was about the other surface. Both directions were
  survivable before the measurement: a newly generated order is appended to the
  picker by detection (`InvoiceForm.js`'s `posList`), and one that has just closed
  still raises the over-invoicing warning.
- **THE SET WAS COMPARED, NOT ASSUMED.** Both answers were computed over the whole
  base before and after: 24 open orders of 45, identical, no order on one side
  only. `verify-open-orders-244.mjs` Part D re-runs that comparison every time.
- **The picker's own copy is untouched.** #198's unsigned mark and #242's search
  retention read what the picker is given, not how it was found, so neither has a
  seat in this change — both were re-checked in a browser rather than reasoned
  about.
- **Not in this issue:** #193's one-at-a-time reads elsewhere on this page, which
  is a different shape — batching a walk that runs once per order still grows with
  the orders. Nor the denylist-versus-allowlist question `PO_NOT_WITHDRAWN` still
  carries, recorded above and unchanged.

### An order's invoicing status (#235)

A purchase order said how much of what it ordered had been delivered and never
whether it had been billed. `summarizePOInvoicingStatus` is the delivery summary's
pair — `Invoiced` / `Partly invoiced` / `Awaiting invoice` / a dash — shown beside
the delivery chip on `/pos` and beside the `Invoices` heading on `/pos/[poId]`.

- **THE PAIR IS LINE FOR LINE, AND THAT IS THE POINT RATHER THAN A CONVENIENCE.**
  Same fold (ordered items, never quantities, since a PO's items carry different
  Units), same reserved middle (`anyInvoiced` separate from the completed count, so
  10 billed against 13 is partly billed rather than nothing), same dash from the same
  `countsAsOrdered`, same tones. It reads `Invoiced Qty` where its twin reads
  `Delivered Qty`, for the twin's own reason: the question at this scope is whether
  the ordered quantity was reached, and the rollup is the whole answer. The offline
  check compares the two result SHAPES rather than restating either.
- **#210's REMOVAL OF THE MIDDLE STATE DOES NOT REACH THIS SCOPE.** `partly-delivered`
  left `summarizeInvoiceStatus` because one bill is answered by one delivery, so a
  shortfall is an error rather than a stage. An order is billed by as many invoices as
  the vendor sends, so a half-billed order is an ordinary middle — which is why the
  delivery axis already keeps `partly-delivered` here. Asserted rather than assumed,
  since carrying that removal across is the plausible mistake.
- **BILLED BEYOND THE ORDER COUNTS AS BILLED**, mirroring an over-delivery counting as
  delivered. It is also `hasUninvoicedQty`'s own reading — #57 defines an open ordered
  item as one with a POSITIVE remainder — so reusing it keeps one answer to "is there
  anything left to bill". The excess is not lost: it is the `(over)` mark beside
  `Invoiced` and #179's `Order variance` on the charge, which is #241's division
  between a chip that states the state and an item that points at the exception.
- **A WITHDRAWN ORDER IS A DASH AND HIDES NOTHING.** `countsAsOrdered` empties the
  judged set, exactly as on the delivery axis. `getPOWithdrawEligibility` refuses to
  withdraw an order carrying `invoicePoLinks` or `invoiceItems`, so "withdrawn and
  billed" is unreachable through the app; where hand-entered data reaches it the two
  axes at least say the same thing rather than disagreeing.
- **THE GATE OPENED AND `Paid` DID NOT, WHICH IS THE FIX #233 ASKED FOR IN ADVANCE.**
  `isPrivileged` gated four unrelated things on `/pos/[poId]`: the projection choice,
  the `Invoiced` column, the invoices section, the internal `Delivery Address Used`
  field, and the sign/regenerate controls. The first three are invoice-derived and
  open — #211 settled that what a vendor billed is readable by anyone who may read the
  order behind it. The rest stay, under `isOffice`; the payment badge stays under
  `seesPayment`. **Two flags with the same value today and separate names**, which is
  what stops the next widening from carrying payment along silently. The projection
  branch went with it: one `getInvoicingStatusByPO` for both audiences, so the page
  cannot judge its chip from two field sets.
- **`Invoiced Qty` JOINED TWO MAPPERS, and that is a policy change rather than a cost
  one.** `recordToPOItem` and `getPOItemsByRecordIds` both excluded it under #132's
  line; both pass no `fields`, so the record was already in hand and the field is
  free. `offline/source-shape.mjs` asserted its ABSENCE as its anti-vacuity probe and
  now asserts its presence, with the probe moved to `invoiceItems` — a field that
  belongs to the reconciliation mapper and must not spread, since a chip needs the
  total rather than the rows.
- **A SEVENTH COLUMN ON `/pos`, AND THE BUDGET IS DELIBERATELY NOT RE-CUT.** The six
  existing columns declare exactly 52rem, the width the page has, so the new one takes
  the row past it and a narrow window wraps or scrolls. That is left standing: those
  hand-declared rem widths are what the design pass will remove, so re-cutting them
  now — or stacking two chips in one cell, which is what #179 chose on `/invoices` —
  would be a pixel judgment made twice, once here and again after the design. What
  belongs on the screen is this issue's decision; how wide it sits is that work's
  input. Nothing is truncated.
- **MEASURED ON BOTH PATHS, BEFORE AND AFTER.** `/pos` 9 → 9 for the office and 8 → 8
  for an employee: the chip's field rides on a record the list already fetched.
  `/pos/[poId]` 14 → 14 for the office and **12 → 14 for an employee**, which is the
  price of opening the gate rather than a regression — the two batched reads that walk
  `Invoice Items` and then `Invoices` were the office's alone and are everyone's now.
  An order nothing has billed still pays for neither level, since `findByRecordIds`
  returns early on an empty id list.
- **ONE STEM ACROSS THE SET, WHICH IS #166's OWN TEST APPLIED AGAIN.** The words
  shipped as `Billed` / `Partly billed` / `Awaiting invoice`, which split the stem
  inside one closed set while the delivery axis reads `Delivered` / `Partly
  delivered` / `Awaiting delivery` on one. #166 dropped `arrival` for `delivery`
  because the table is `Deliveries`; the table here is `Invoices` and the rollup is
  `Invoiced Qty`, so the set is `Invoiced` / `Partly invoiced` / `Awaiting invoice`
  and the keys follow the words. The first draft's argument for `Billed` — that a
  chip states what the VENDOR did while `Invoiced` is the figure this app computes —
  is a real distinction and not worth two stems in four words; `Uninvoiced Items` and
  `Invoiced Qty` already put this repository on the other side of it. **`partly`,
  never `partially`**, for the same reason: the delivery axis says `Partly
  delivered`. The three words are now the deliveries list's exact ones, which is one
  question — has this been billed — asked at two scopes.
- **TWO WORD COLLISIONS, BOTH OF THEM THE DELIVERY AXIS'S ALREADY.** `/pos/[poId]`
  now carries an `Invoiced` chip beside an `Invoiced` column head, exactly as it has
  carried a `Delivered` chip beside a `Delivered` column head since #233: a chip is
  one of a closed set of three and a column head sits over a quantity, so the shapes
  keep them apart and neither needs renaming. And the LIST's head is `Invoice` while
  the detail's is `Invoiced` — the first names the axis whose chip fills the cells,
  the second names a quantity, which is the same pair as `Delivery` on the list
  against `Delivered` on the detail. Recorded because both read as inconsistencies
  to anyone who meets them without the pairing.
- **ALL FOUR CHIP VALUES ARE ON THE BASE, so none had to be seeded**: across the 45
  orders an Admin sees, 16 read `Invoiced`, 23 `Awaiting invoice`, 1 `Partly invoiced`
  (`HYE-PO-20260720-01`) and 5 the dash. An employee's 39 visible rows carry the same
  four. The employee
  path was read as `scoped-fixture@`, whose `Invoices` section renders the chip and the
  charges and contains neither `Paid` nor `Not paid` — checked against the section's
  own DOM rather than the page's, since that is the only evidence `seesPayment` is
  doing anything.
