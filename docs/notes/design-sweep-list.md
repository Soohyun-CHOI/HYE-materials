# What the design pass is finding — the sweep list

Governs no path and is read by nobody editing one. **It is a queue with a termination condition**, which is the whole of what separates it from `backlog.md`, and the argument is below rather than assumed.

## What it holds

Two kinds of item, and one sweep consumes both. What they share is the reason they are here rather than in the code: neither can be acted on while `docs/briefs/` is the design's only input.

**A word disagreement** — a place where two screens use different words for one thing, or one screen uses a word another has already settled. The strings exist in the code, in two files, and nothing in either says they are two names for one thing. Items 1 to 7 are these.

**A structural decision** — a decision the design has taken about how a screen is built that the current code does not implement. It arrives already decided, because deciding it is the design pass's job; what this list carries is where the current code disagrees, what has to move with it, and the shape the implementation has to take. Item 8 is the first.

The second kind is wider than the first in what it touches — item 8 reaches eleven files, five code comments and five briefs — and narrower in what it argues, since the decision itself is not up for re-derivation here. Both are still just a list one sweep reads.

## Why this file exists

`docs/briefs/` is the design work's only input, and the repository is deliberately not connected to the tool reading it — a design that could see the current styling would be pulled toward it, and there is nothing there worth preserving. The briefs are handed over one screen at a time.

**A reader holding several briefs at once sees what no single screen shows.** Every word item is of that shape: the code contains both strings, in two files, and says nowhere that they are one screen's name. A structural decision arrives the same way and for the same reason — a design that has drawn every list in the app sees one row shape where the code has eleven separate pieces of markup, and no check reads across screens like that. So both kinds arrive from the design pass rather than from the repository, and the finder's viewpoint cannot be reconstructed later from the code.

**And nothing can be acted on as it is found.** A brief is the design's only input, so changing a string or a screen's structure makes a brief that has already been handed over stale, and the design then draws what the app does not do. `offline/screen-briefs.mjs` is what normally catches a brief going stale; it cannot help here, because the stale brief would be sitting in another tool where no check reaches it. So nothing moves and the findings accumulate.

## When it goes away

**One sweep, after the design pass is finished, resolves every item here, and the file is DELETED in that commit** along with its row in CLAUDE.md's index table. If the sweep lands in more than one commit, each closes the items it resolved and the file goes with the last of them.

Nothing is left behind — no record of what was closed and by what. That is `backlog.md`'s convention (its `Closed since, and by what` section) and it is the wrong one here: the residue that convention exists to leave is exactly what a finished sweep should not have. This file records only the unresolved state.

Where a resolution is worth keeping it is kept somewhere that governs a path, which is the same routing CLAUDE.md already states. A naming decision goes to `naming.md`'s screen-word table. A structural decision goes to the brief for the screens it changed — that is what `docs/briefs/` is for — and its reasoning, where it has any beyond the design's own, to the `docs/notes/` file for the area. The brief moves in the same commit either way, under `docs/briefs/README.md`'s rule.

## Why not one entry in `backlog.md`

The honest case for a `backlog.md` bullet is short: this is open work with no issue, and #296's rule puts open work with no issue there. Four things decide against it.

**`backlog.md` opens by telling its reader not to trust an entry** — "An entry here is what was true when it was written. Check it against the code before you promote it." That is the wrong instruction for these items. Re-deriving one means reproducing a reading of several briefs side by side, which is the thing the design pass did and a later reader cannot. The list exists to make re-derivation unnecessary, so it cannot live under a contract that requires it.

**The two are read at different moments.** CLAUDE.md says `backlog.md` is read when picking work up, not when doing it. This is read while one sweep is being executed, and appended to on a cadence set outside the repository — whenever the next brief goes over.

**They are consumed differently.** A `backlog.md` entry is promoted to an issue one at a time and leaves a closing line behind. These are consumed as a set, once, and leave nothing.

**Their hazards are opposite.** `backlog.md`'s is staleness, and its own header says a figure in an entry is the first thing to go stale. This file's is incompleteness: an inconsistency seen and not written down the same day is lost, because the finder does not read this repository. That inverts the discipline — write it down immediately, verify at sweep time.

## How an item is added

Items are added by hand as the design pass catches them, one at a time. A word item:

```
### N. `A` against `B`

- **strings** — `A` at path:line; `B` at path:line
- **screens** — where each one renders
- **brief** — which brief quotes it, or `none`
- **pinned** — what under scripts/tests/offline/ holds the string, or `none`
- **moves with it** — every other place the string is written down
- **direction** — the resolution, or `undecided` and what would settle it
```

The heading is `A` against `B` where the item is two words for one thing, and says what the item is about where it is not — items 2 and 6 are the two that are not.

A structural item keeps the last three fields and replaces the first three, because there is no second string to compare and the decision is not in dispute:

```
### N. what the decision is, stated as the outcome

- **what it is now** — the current structure, per screen, with path:line
- **where it is refused** — every place the decision does not reach as stated
- **implementation shape** — what the build has to be, and what it may not be
- **brief** — which brief describes the current structure, or `none`
- **pinned** — what under scripts/tests/offline/ reads that structure, or `none`
- **moves with it** — code, comments and briefs
- **direction** — the decision, and what about it is still open
```

**`where it is refused` is the field that earns the item.** A design draws one row shape; the app has screens the shape does not fit, and finding them is the work a decision cannot do for itself. Item 8 has two, and both are the kind that would be discovered halfway through the sweep otherwise.

Five rules for filling either in.

**Every string location is confirmed with `node scripts/screen-strings.mjs <route>`, never read off a grep.** A grep for a screen cannot see a string its copy constant reaches through a builder, and a grep for a constant cannot see one written straight into JSX. Where the extractor cannot produce the string at all, say so — `docs/briefs/strings/unfindable.md` is the list of those, and five of item 5's eight strings are on it. The extractor reports a JSX text node's opening line; the line recorded here is the line the words are on, which is the line an editor changes. **A structural item's locations are markup, which the extractor does not produce at all** — those are read out of the JSX, and read at the branch's own revision rather than the working tree's, because another branch may be editing the same rows.

**`pinned` is asked of `offline/screen-briefs.mjs` two ways.** Its `PINNED` array holds sentences that must be in both a constant and a brief. Its `TIER_TWO` array holds literals that must appear somewhere under `app/` or `lib/`, and is the fallback for the two copy modules no offline check can load. A string in either cannot be reworded without editing that check in the same commit.

**`moves with it` includes code comments.** A comment quoting a screen string by name becomes false the moment the string changes, and CLAUDE.md's #181 rule says a false comment is corrected in whatever commit finds it.

**`direction` carries only a decision that was actually made.** An item nobody has settled says `undecided` and carries the measurement that would inform it, not a preference.

**A new item edits the earlier items it supersedes, in the same commit.** This list is written over weeks and read once, so an item that settles what an earlier one left open, or that promotes something an earlier one called adjacent, leaves that earlier entry false — and a sweeper reading top to bottom acts on the false one first. Items 6 and 7 did this to items 2 and 3. The rule that follows from it: **one fact, one place.** Where a later item carries the authoritative list, the earlier one points at it rather than repeating it, so the two cannot drift apart between now and the sweep.

---

## The findings

Eight so far — seven word disagreements and one structural decision — and more will arrive while the `/invoices` screens are being designed.

Among the word items, 1, 3, 4 and 7 resolve by the rule already settled: **a nav label or a button label is the name of the screen it opens, so where a link and its destination's heading differ, the heading wins** — a link that disagrees with the heading turns one screen into two. Item 2 is that rule applied to a case where it changes nothing, and item 6 settles what it left over. Item 5 is undecided.

### 1. `Purchase orders` against `Purchase Orders`

- **strings** — `Purchase orders` at `app/page.js:52`; `Purchase Orders` at `app/pos/page.js:332` (the `h1`) and `app/pos/page.js:29` (`metadata.title`).
- **screens** — the link on `/`, one of three outlined links under the primary button. The heading and the tab title on `/pos`.
- **brief** — quoted in three, and two of them already record the disagreement. `docs/briefs/root.md:37` lists the label; `:44-48` names it outright and says the label and the heading should be settled together. `docs/briefs/pos.md:16-18` names it from the other side. `docs/briefs/_shared.md:440-443` records it under `Two places the app disagrees with itself`. **And `docs/briefs/pos.md:1`'s own title is `# Purchase orders`**, taken from the root link, while `_shared.md:561-565` says a list screen's brief title is its own heading verbatim and cites this screen as the example — so the brief set breaks its own naming rule here, in the sentence that states it.
- **pinned** — none. Neither casing is in `PINNED` or `TIER_TWO`, and no check under `scripts/` reads either.
- **moves with it** — `app/page.js:52`; `docs/briefs/root.md:37` and the whole paragraph at `:44-48`, which exists only to record this and goes with it; `docs/briefs/pos.md:1` and `:16-18`; `docs/briefs/_shared.md:440-443` and the citation at `:563`. Two prose titles are NOT part of it: `docs/notes/purchase-orders.md:1` and `_shared.md:350`'s section heading both name an area of the reasoning rather than the screen, and neither is a screen string.
- **direction** — the heading wins. `Purchase orders` on `/` becomes `Purchase Orders`.

### 2. `Material prices` — the finding is real and is not the one it looked like

- **strings** — `Material prices` at `app/page.js:37` (the root link), `app/materials/page.js:55` (the `h1`), `app/materials/page.js:11` (`metadata.title`), and `app/materials/[materialId]/page.js:50` and `:204` (two `← Material prices` back links).
- **screens** — the link on `/`, the heading and tab title on `/materials`, the two back links on `/materials/[materialId]`.
- **THE ROOT LINK AND ITS DESTINATION'S HEADING ARE THE SAME STRING.** Confirmed by running the extractor on both routes: each reads `Material prices`, sentence case, and `docs/briefs/root.md:46` already says so — `Material prices` and `Deliveries` match theirs exactly. So the rule settled for items 1, 3 and 4 applies here and its answer is to change nothing.
- **What is inconsistent is one level up, and `docs/briefs/_shared.md:442` already records it:** `Material prices` is the only sentence-case heading among the list screens. `Purchase Requests`, `Purchase Orders`, `Invoices` and `Deliveries` are Title Case. The app has one heading convention with one exception, and every surface pointing at that screen copies the exception faithfully — which is why the mismatch reads like a link problem and is not one.
- **brief** — `docs/briefs/materials.md:1` (title) and `:21` (identity); `docs/briefs/root.md:37` and `:46`; `docs/briefs/_shared.md:442`.
- **pinned** — none.
- **moves with it** — nothing, under the heading rule. The residual question moves five code places and five doc places, listed once under item 6 rather than twice.
- **direction** — **the heading rule applies and yields no change, and the item stands as the record of that** — a sweeper who reads the finding as reported will otherwise change the link. The residual question, whether `/materials`' own heading joins the app's Title Case convention, was not among the four settled when this was written and **is now settled as item 6**. It is a different decision from item 1 — that one is a link disagreeing with a heading, this one is a heading disagreeing with every other heading — which is why it is its own item rather than folded in here.

### 3. `New PR` against `New Purchase Request`

- **strings** — `New PR` at `app/prs/page.js:144`; `New Purchase Request` at `app/prs/new/page.js:91` (the `h1`), `app/prs/new/page.js:12` (`metadata.title`), and `app/page.js:27` (the root screen's primary button, which already agrees).
- **screens** — the button beside the heading on `/prs`, the only filled button on that screen. The heading and tab title on `/prs/new`. The primary button on `/`.
- **brief** — `docs/briefs/prs.md:22` quotes `New PR`; `docs/briefs/prs-new.md:23` quotes the heading; `docs/briefs/root.md:36` quotes the root button and `:50-52` records the split in these terms — three surfaces, two words for one screen.
- **pinned** — none.
- **moves with it** — `app/prs/page.js:144`; `docs/briefs/prs.md:22`; `docs/briefs/root.md:50-52`. `docs/briefs/prs.md:1`'s title is `# Purchase requests`, sentence case against that screen's own `Purchase Requests` heading — the same shape as item 1's brief title and not this item's string. The other abbreviation on the same axis — `View all PRs` against `View all invoices`, recorded as adjacent to this item when it was written — **is now item 7**, because it is the same kind of decision rather than a consequence of this one.
- **direction** — the heading wins. `New PR` becomes `New Purchase Request`, which is what the root screen's button already says.

### 4. `New invoice` against `New Invoice`

- **strings** — `New invoice` at `app/invoices/page.js:199`; `New Invoice` at `app/invoices/new/page.js:76` (the `h1`) and `app/invoices/new/page.js:10` (`metadata.title`).
- **screens** — the button on `/invoices`, rendered only for an Admin, which is why `docs/briefs/strings/unreachable.md:240` names it as one of exactly two strings the two non-Admin fixture accounts cannot reach on that screen. The heading and tab title on `/invoices/new`.
- **brief** — **`docs/briefs/invoices.md` does not mention the button at all**; its identity section names only the heading `Invoices`. The string is quoted at `docs/briefs/invoices-new.md:1`, whose title is `# New invoice` — taken from the button rather than from the heading `New Invoice` that same brief quotes at `:21` — and at `docs/briefs/_shared.md:490` and `docs/briefs/strings/unreachable.md:237` and `:240`.
- **pinned** — not pinned, but **two offline checks name the string as a word their copy must NOT contain, and one of them is case-sensitive.** `offline/awaiting-delivery.mjs:433` tests `!words.includes(control)`, so rewording the button leaves that list watching a word the app no longer says — and the check goes on passing, which is worse than failing, because it reads as coverage. `offline/delivery-status.mjs:823` lowercases both sides and is unaffected.
- **moves with it** — `app/invoices/page.js:199`; `app/invoices/AwaitingInvoiceStrip.js:53`, a code comment quoting the button by name and false from the moment it is reworded; `offline/awaiting-delivery.mjs:433`; `docs/briefs/invoices-new.md:1`; `docs/briefs/_shared.md:490`; `docs/briefs/strings/unreachable.md:237` and `:240`; `docs/notes/deliveries-and-invoices.md:295`, `:297` and `:1856`; `docs/demo/runbook.md:492`. The widest of the five.
- **direction** — the heading wins. `New invoice` becomes `New Invoice`.

### 5. `can't` against `cannot` in the confirmation dialogs

- **strings, the confirmation dialogs first, because that is where the finding is.** Five places say `can't` and three say `cannot`, and the three are one modal's three voices:

  | Modal | Where | Form |
  |---|---|---|
  | `Withdraw this PR?` | `app/prs/[prId]/WithdrawPRForm.js:58` | `can't` |
  | `Withdraw this PO?` unsigned | `lib/poWithdraw.js:43` | `can't`, and `hasn't` in the same sentence |
  | `Withdraw this PO?` signed | `lib/poWithdraw.js:48` | `can't` |
  | `Delete this invoice?` | `app/invoices/[invoiceId]/DeleteInvoiceButton.js:57` | `can't` |
  | `Delete this saved draft?` | `app/prs/new/PRForm.js:413` | `can't` |
  | `Delete this delivery?` plain | `lib/deliveryDelete.js:77` | `cannot` |
  | `Delete this delivery?` invoiced | `lib/deliveryDelete.js:85` | `cannot` |
  | `Delete this delivery?` paid | `lib/deliveryDelete.js:93` | `cannot` |

  So every `cannot` in a confirmation dialog is `DELETE_COPY`'s and every other confirmation dialog in the app contracts. `docs/briefs/_shared.md:445-446` already records the split in those terms.

- **strings, app-wide, which is the count the decision needs: nine places each.** Four more `can't` outside the modals — `app/invoices/new/actions.js:154` and `:155`, `app/invoices/new/InvoiceForm.js:1362`, `app/pos/[poId]/actions.js:162`. Six more `cannot` — `app/deliveries/[deliveryId]/actions.js:273`, `app/deliveries/[deliveryId]/page.js:475`, `app/deliveries/new/DeliveryForm.js:400`, `lib/deliveryInvoiceLink.js:269` and `:288`, `lib/directPurchase.js:137`. **There is no majority to follow, so this is not settled by counting.** What the spread does say: eight of the nine `cannot` strings are on the delivery axis, so the word is one area's habit rather than a scatter across the app.
- **screens** — `/prs/[prId]`, `/pos/[poId]`, `/invoices/[invoiceId]`, `/prs/new`, `/deliveries/[deliveryId]` for the modals; `/invoices/new`, `/deliveries/new` and `/deliveries/[deliveryId]/edit` for the rest.
- **brief** — `docs/briefs/_shared.md:445-446` records the split, and `:406-407` quotes `This cannot be undone.` as the sentence all three deletion voices end on. `:403-404` quotes the withdrawal banner's `It can't be signed or invoiced.`, so the shared brief quotes both forms verbatim. `docs/briefs/invoices-invoiceId.md:74-75` paraphrases the invoice-delete modal with `cannot` where that modal's own string says `can't`.
- **pinned** — **yes, and this is the only one of the five with a machine-enforced coupling.** `offline/screen-briefs.mjs:517` holds `TIER_TWO = ["This cannot be undone.", "no further signing", "Withdraw this PO?"]` and asserts each literal still appears under `app/` or `lib/`. Resolving toward `can't` removes `This cannot be undone.` from the tree and fails that check, so the sweep edits line 517 in the same commit; resolving toward `cannot` does not, which is a fact about cost and not a reason.
- **the extractor cannot see five of the eight modal strings.** `DELETE_COPY` and `WITHDRAW_COPY` are reached through `resolveDeleteCopy` and `getWithdrawCopy`, so `screen-strings.mjs` produces neither — `docs/briefs/strings/unfindable.md:61` and `:63` list them at 22 and 5 pieces. Both modules also import `lib/airtable/`, which is why no offline check can load them and why `screen-briefs.mjs` falls back to the weaker `TIER_TWO` test. Those five were located by reading the two modules.
- **moves with it** — `docs/briefs/_shared.md:403-407` and `:445-446`; `docs/briefs/invoices-invoiceId.md:74-75` if the paraphrase is held to the string; `offline/screen-briefs.mjs:517` if the answer is `can't`.
- **direction** — **undecided.** Two measurements for whoever settles it. Thirty-five of the app's screen strings carry an `n't` contraction, so on volume the app's register is contracted and `cannot` is the local exception. Against that, a destructive confirmation might drop the contraction deliberately to slow the reader down — but `lib/deliveryDelete.js`'s own header argues the opposite about these three bodies, that what the copy owes a reader is "not a warning but an accurate account of what becomes inconsistent", which removes the one reason for them to read more formally than the rest of the app.

### 6. `Material prices` becomes `Material Prices`

The decision item 2 left over, taken. Item 2 stays as the record that the link never disagreed with its heading; this is what actually changes.

- **strings** — `Material prices` at `app/materials/page.js:55` (the `h1`) and `app/materials/page.js:11` (`metadata.title`); the root link at `app/page.js:37`; the two back links at `app/materials/[materialId]/page.js:50` and `:204`. Five places, one word, and every one of them is the heading verbatim or the heading with an arrow in front of it.
- **screens** — the heading and tab title on `/materials`, one of three outlined links on `/`, and both `← Material prices` links on `/materials/[materialId]`, one above the item name and one at the foot of the history table.
- **brief** — `docs/briefs/materials.md:1` (the brief's own title) and `:21` (identity); `docs/briefs/root.md:37` and `:46`; `docs/briefs/_shared.md:442`.
- **pinned** — none. Nothing under `scripts/` reads the string in either casing, so nothing fails when it moves and nothing would have caught it drifting either.
- **moves with it** — the five code places above; `docs/briefs/materials.md:1` and `:21`; `docs/briefs/root.md:37`. Two doc lines need reading rather than substituting. `docs/briefs/root.md:46` claims `Material prices` and `Deliveries` match their destinations exactly — still true afterward, so the quotation changes and the claim stands. `docs/briefs/_shared.md:442` is the tail of the paragraph item 1 also edits: `Every other list heading is Title Case except Material prices, which is sentence case` becomes false here and its opening sentence becomes false under item 1, so whichever lands second deletes the paragraph and the `Two places the app disagrees with itself` heading above it. `docs/notes/materials.md`'s title names an area of the reasoning rather than the screen and is not a screen string.
- **direction** — up to `Material Prices`, and the root link and both back links follow it. The screen shows rows of the `Material Prices` table, and CLAUDE.md's rule is that a concept with a table behind it takes that table's name and nothing else may borrow the word. It also removes the app's only sentence-case list heading, so four Title Case headings become five with no exception left to explain.

### 7. `View all PRs` against `View all invoices`

- **strings** — `View all PRs` at `app/prs/new/page.js:93`; `View all invoices` at `app/invoices/new/page.js:78`.
- **screens** — the same control in the same place on both create forms: a small underlined link on the heading row, opposite the `h1`, pointing at that document's list.
- **twelve links in the app name a list screen, and only the three pointing at `/prs` abbreviate.**

  | Destination | Labels |
  |---|---|
  | `/prs` | `View all PRs`, `← All PRs`, `Go to PR list` |
  | `/invoices` | `View all invoices`, `← All invoices` |
  | `/deliveries` | `← All deliveries` in three places, `All deliveries` in two |
  | `/materials` | `← Material prices` in two places |

  So this is not one label out of step with its sibling. It is the whole `/prs` family out of step with the other nine, which is what makes the direction cheap to state and the count worth having.

- **brief** — **neither string is quoted anywhere, and this is the one item of the seven no brief records in any form.** `docs/briefs/invoices-new.md:21` mentions the control without its words — `The heading New Invoice, and a link to the invoice list` — and `docs/briefs/prs-new.md:23` names only the heading and does not mention the link at all.
- **pinned** — none. Neither string appears anywhere under `scripts/`.
- **moves with it** — `app/prs/new/page.js:93`, and `← All PRs` at `app/prs/[prId]/page.js:232`, which is the same abbreviation for the same destination in the same kind of control and so is the same decision rather than a neighboring one. `Go to PR list` at `app/prs/new/PRForm.js:533` is a third link to that screen: its abbreviation resolves here too, but its phrasing does not — `{X} list` is not the shape any of the other eleven uses, and choosing between it and the screen's name is a question this item does not ask. No brief and no check moves.
- **direction** — the heading wins, so `View all PRs` becomes `View all purchase requests` and `← All PRs` becomes `← All purchase requests`. The rule settles the abbreviation outright: `PRs` is not a word the destination's heading uses and `Purchase Requests` is. It does not settle the casing inside the phrase, and the nine unabbreviated links already do — each carries the destination's word lowercased mid-phrase, the exception being `← Material prices`, which is capitalized because it is the heading verbatim rather than a phrase containing it. **One consequence for the design pass:** the label goes from 12 characters to 26, on a heading row that already carries an `h1`.
- **and this does not settle `PR` as a screen word.** Twenty-nine screen strings use a standalone `PR` or `PRs`; items 3 and 7 between them reach four — `New PR`, `View all PRs`, `← All PRs`, and `Go to PR list` on the abbreviation but not the phrasing. The rest sit inside sentences and on form controls — `Submit PR`, `Withdraw this PR?`, `No PRs match these filters.`, `It's not your turn to act on this PR.` — and ask a different question: whether the abbreviation is acceptable in prose a reader is already inside, as against as the name of a place they are being sent to. `PR ID` is outside it either way, being the field's own name.

### 8. Every list row is one click target, opening that row's document

The first structural item. The design draws every list screen's row as a single click target that opens the document detail for that row; today the only clickable thing in a row is the document ID in its first cell.

- **what it is now.** Five lists, five identical shapes: the first cell holds a `<Link className="underline">` around the document ID and nothing else in the row is clickable.

  | Screen | Row opens at | The one link | Goes to |
  |---|---|---|---|
  | `/invoices` | `app/invoices/page.js:318` | `:320` | `/invoices/{invoiceId}` |
  | `/pos` | `app/pos/POListClient.js:258` | `:266` | `/pos/{poId}` |
  | `/prs` | `app/prs/PRListClient.js:151` | `:166` | `/prs/{prId}` |
  | `/deliveries` | `app/deliveries/DeliveriesListClient.js:127` | `:132` | `/deliveries/{deliveryId}` |
  | `/materials` | `app/materials/page.js:177` | `:224` | `/pos/{poId}` — not a material |

  And six strips, two each above `/invoices`, `/pos` and `/prs`, each a `<ul>` of `<li>` with one anchor per item. The design drew these as tables with whole-row targets too, so the structure and the comment that argues for it both move.

  | Strip | On | `NOT A TABLE` | `ul` / `li` | Anchor goes to |
  |---|---|---|---|---|
  | `app/invoices/AwaitingInvoiceStrip.js` | `/invoices` | `:14` | `:69` / `:71` | `/deliveries/{id}` at `:72` |
  | `app/invoices/AwaitingDeliveryStrip.js` | `/invoices` | `:13` | `:76` / `:78` | `/invoices/{id}` at `:79` |
  | `app/pos/AwaitingPOStrip.js` | `/pos` | `:20` | `:42` / `:53` | `/prs/{id}` at `:54` |
  | `app/pos/AwaitingSendStrip.js` | `/pos` | `:23` | `:36` / `:38` | `/pos/{id}` at `:41` |
  | `app/prs/OverageStrip.js` | `/prs` | `:29` | `:62` / `:64` | `/deliveries/{id}` at `:65` |
  | `app/prs/DirectPurchaseStrip.js` | `/prs` | none | `:41` / `:43` | `row.fileUrl`, external, at `:52` |

  **The `NOT A TABLE` comments are five, not six** — `DirectPurchaseStrip.js` never carried one. `AwaitingDeliveryStrip.js:13` argues it one way, `A strip is not a column, so it re-cuts no column budget`; the other four open `NOT A TABLE, AND OUTSIDE THE TABLE'S WIDTH BUDGET` and go on to name the width the list below is bound by. **The argument survives becoming a table and the sentence does not:** a strip with its own widths is still outside the list's budget, so these are rewritten rather than deleted, and deleting them would lose the reason the strips were never columns in the first place.

- **where it is refused.** Two places, both of which would otherwise surface mid-sweep.

  **`/materials` has no document detail per row.** Its rows are vendor price rows and a row's only link, `:224`, goes to `/pos/{poId}` — the order the price came from, on another screen's axis. The material's own screen is reached from outside the table, at `:112` (the section heading) and `:121` (`Purchase history →`). And **a row can have no destination at all**: `:229-236` renders an em dash carrying `title="You do not have access to this order"` when #19's per-row identifier gate withholds the order, so which rows are clickable depends on who is reading. A whole-row target needs an answer for a row with nowhere to go, and needs to say whether the row's document is the order or the material. Worth noticing that the withheld cell's only explanation is a `title` attribute, which is the very signal this item's own reasoning rejects.

  **`DirectPurchaseStrip.js`'s rows have no in-app destination.** A `Direct Purchases` row has no detail screen — the data model gives it no items, no total and no status — so its only anchor is the vendor's invoice file, opened in a new tab. Either that strip's rows get a destination or it keeps a cell-level link while the other five do not.

- **implementation shape.** **A click handler on the row is not it, and this repository has refused the same failure once already.** `docs/briefs/_shared.md:527-529` records that `QualifierMarker`'s tooltip `opens on neither touch nor a keyboard`, which is why the sentence it carried had to become its accessible name, and #232 then retired the marker on that ground. A row clickable only through `onClick` is unreachable by keyboard in exactly that way. So **a real anchor stays in one cell and its hit area is stretched across the row** — the anchor keeps the focus ring, the keyboard route, the middle-click and the copy-link, and the rest of the row becomes clickable without becoming the control.

  **The document ID drops its link color.** It is `className="underline"` at all five sites today. Once the whole row is the target, an underline on one cell says that cell is the only thing you can click, which is now the wrong signal — so it goes to body color.

  **Three of the six strips carry a control inside the row, and an anchor may not contain one.** `AwaitingPOStrip.js:66` renders a `GeneratePOButton` for an Admin, `OverageStrip.js:91` an `OverageButton`, and `DirectPurchaseStrip.js` a `DirectPurchaseButton` or the `heldBy` chip in its place. A row-wide anchor would nest a button inside a link and swallow its click, so the stretched area has to stop short of that cell. None of the five table rows has this problem — every judgment they render was resolved on the server, so a row holds text and chips only.

- **brief** — **four of the five lists say nothing about what is clickable, so the sweep ADDS the statement rather than editing it.** `invoices.md:20`, `pos.md:23` and `deliveries.md:25` name their columns and no link; `materials.md:29` describes the section heading as a link, which is outside the table and stays true. `prs.md` is the only one that describes it, twice, and both become false: `:31` says `The ID is a link; Total is right-aligned currency.` and `:57` says `The ID link inherits the muted color and stays clickable.` **The phrase to build on is already there** — `pos.md:96` and `prs.md:53` both say the whole row dims when a document is withdrawn, so `the whole row` is already the briefs' unit for a row-wide state.
- **pinned** — no check reads a row's markup, an `underline` class or a strip's element structure. One check reads a strip file's call shape and survives a careful conversion: `offline/awaiting-delivery.mjs:469-483` parses `AwaitingDeliveryStrip.js` and asserts it calls neither `sort` nor `filter`, and `:492-502` asserts the heading counts `rows.length` while the list maps `rows` itself. Keeping `rows.map(...)` as the mapped call and adding no inline filtering keeps it green; reaching for either while restructuring fails it, which is the check working.
- **moves with it** — the five row sites and their anchors; the six strips' `li` structure; the five `NOT A TABLE` comments; `prs.md:31` and `:57`; and a new row-level statement in `invoices.md`, `pos.md`, `deliveries.md` and `materials.md`. **Nothing under `lib/`** — every judgment these rows render is already resolved server-side, so this is markup, comments and briefs.
- **direction** — **as drawn: the row is the click target and it opens that row's document, built as a real anchor with a stretched hit area, and the document ID drops its link color.** Two things about it are open, both from `where it is refused`: what a `/materials` price row points at and what becomes of a row the identifier gate has emptied, and whether a `Direct Purchases` row gets a destination or that one strip keeps a cell-level link.
