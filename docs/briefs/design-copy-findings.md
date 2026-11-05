# Design copy findings

**Words a screen says that the code and the base no longer say, and what moves
when the design chooses.** One entry per finding. This is not a brief — no screen
is described here, and nothing in it is handed over on its own. It is the list a
design decision needs in order to be one sweep rather than a hunt, and it is in
this directory because this directory is what the design work reads.

Each entry states three things: the strings a reader sees, the identifiers that
mirror them by name, and what the base calls the thing underneath. **The base is
not reverted if the design picks a different word** — a schema name and a screen
word have different owners and different lifetimes, which is the whole reason
`docs/notes/naming.md` keeps a table of the divergences. What an entry buys is
that the sweep is already enumerated.

**SINCE #614 AN ENTRY HERE IS ONE THE FILES OF 2026-11-05 DRAW OTHERWISE, OR NOT
AT ALL, AND SOO DECIDES EACH.** Soo set the tools and sign-in screens' words and
states against Tools 52 and Sign in 28 and sent them to Design on 2026-11-05
(#612); the files Design sent back that day, Tools 53 and Sign in 29, draw most
of them as sent, and those went from this list in #614. What stays is the last
entry: what those files say in another place or in other words than the app,
or not at all. The app keeps its own until Soo decides a row. #520's name in two
places, which no sending had taken, the files draw too, and the app took their
drawing in #614. The first entry, the purchase request screen's (#333), waits
on no sending, since the files draw no such screen: the app decides it when the
materials screens open again. **What the files draw nothing of is no entry**:
the export file's columns — the serial number's (#601), and a loan's `On loan`
and `Owner job` (#598) — and the sign-in mail's plain-text part are the app's,
in `docs/notes/tools.md` and `docs/notes/authorization.md`.

---

## `correction`, for what a signer sends back (#333)

`Correction Requests` and `Edit Log` became `PR Edit Requests` and `PR Edit Log`.
The tables are named for their parent now, as every other child table on this
base already was, and one act stopped having two words: an edit request asks for
an edit, and what it produces is a row in the edit log.

**The screen was left alone, deliberately.** #333's scope was the code and the
schema, not the screen's word. So `/prs/[prId]` still says `correction` in six
places, and the identifiers named after those six strings were left with them —
an identifier that mirrors a button is a truthful name for as long as the button
says it.

### What a reader sees

All six are on `/prs/[prId]`, and nowhere else in the app.

| String | Where | What it is |
|---|---|---|
| `Return for correction` | `app/prs/[prId]/SigningPanel.js` | the button a signer presses |
| `What needs to be corrected?` | `app/prs/[prId]/ReturnForCorrectionForm.js` | the label over the reason box |
| `Explain what needs to be corrected.` | `app/prs/[prId]/actions.js` | the refusal when that box is empty |
| `paused (returned for correction)` | `app/prs/[prId]/SignerProgressBar.js` | inside each step's `title`, so it is a tooltip and an accessible name |
| `… returned it to … for correction: "…"` | `app/prs/[prId]/page.js` | a History line |
| `… resolved the correction` | `app/prs/[prId]/page.js` | the History line for the other end |

**The last two are invisible to `scripts/screen-strings.mjs`**, which is worth
knowing before trusting a census here: they are template literals in a `text:`
property, which is none of the shapes that tool collects. It finds the first four.
Whatever word is chosen, these two have to be swept by hand.

### What moves with them

Renaming the strings without these leaves an identifier claiming a word the app
has stopped saying, which is the same defect one layer down.

- `returnForCorrectionAction` — the Server Action. Its name is also its
  `withOpsLabel` label, which `offline/airtable-ops.mjs` DERIVES from the export
  name, and it is an `offline/authz-structure.mjs` exemption entry. Both follow
  the export automatically; the exemption's reason text does not.
- `ReturnForCorrectionForm` — the component and its file. Every form in that
  directory is named after its own button (`ApproveForm`, `EditAndContinueForm`,
  `WithdrawPRForm`, `GeneratePOForm`), so this one moves when the button does and
  not before.
- `ROLLBACK_ACT.returnForCorrection` and its two `ROLLBACK_COPY` sentences in
  `lib/rollbackReport.js` — the copy itself says `sending this back for
  correction`, twice.
- `RESTORE.correctionCreated` / `RESTORE.correctionResolved`, same file. These are
  the rarest shape in this list: **the key's own value is screen copy** (`the
  correction request this turn resolved`), so the key and the string move
  together or the key stops describing what it holds.
- `id="correction-arrowhead"` in `SignerProgressBar.js`, and the `markerEnd` that
  points at it. Not visible, but it names the arc the button draws.
- The comments in `lib/prSigning.js`, `app/prs/[prId]/actions.js` and
  `SignerProgressBar.js` that say `correction arcs`, `return-for-correction` or
  `delegated the correction` — all about the act rather than the row.

### What the base calls it

A row of `PR Edit Requests`: an **edit request**. `Initiated By`, `Sent To`,
`Requested At`, `Resolved At`, `Status` (Pending/Resolved). The reverse links are
`Purchase Requests."PR Edit Requests"` and, on `Users`, `PR Edit Requests
(Initiated)` and `PR Edit Requests (Sent To)`.

**One reason to prefer `edit`:** the same
screen already says `Edit and continue` for the other thing a signer can do to a
request, and `Edit payment`, `Edit` and both edit screens use the word elsewhere.
`correction` on this screen is the app's only use of the word for something a
person RAISES; everywhere else it means fixing a record that already exists
(`/deliveries/[deliveryId]/edit`, `/invoices/[invoiceId]/edit`, and the delete
confirmations), which `naming.md` records as a use the word keeps.

**And one reason the answer is not free:** #272 barred `correction` for the
overage request because a table owned the word. No table owns it now, so what
bars it there is this screen. If this screen stops saying `correction`, that bar
is worth re-deriving rather than assuming — `naming.md`'s bullet on it says so in
its own words.

**The app decides it when the materials screens open again (#612, Soo).** The
files draw no purchase request screen, so no sending takes this entry up. The
screen is closed (#542); the word is chosen, and swept with everything under
`What moves with them`, when `lib/openScreens.js` opens it.

---

## What the files of 2026-11-05 draw otherwise, or not at all (#614)

Tools 53 and Sign in 29 draw every other word and state #612 sent, and every
sign-in one. These they draw in another place, in other words, or not at all.
The app keeps its own until Soo decides each; a row decided goes from here in
the commit that makes the app say it.

**Where a press's refusal stands is the first difference.** The app says a
refusal in the dialog or question that sent it while that dialog still stands,
and under the status once the page drawn again has closed it — the item moved,
somebody got in front, the press no longer offered (`AssetTransition.js`). The
files draw them in the dialog at a desk whatever closed it, a press with no
dialog as 0k's toast, and on a phone always as 0a's Notice under the status with
the sheet or question closed — Tools 0a's Notice row says so: "A save from a
record's page that the server refused, or did only in part, shows the page as it
now stands with the Notice 16 under the status".

| String or state | The app | The files | Key |
|---|---|---|---|
| `This item is on 26-USA-07 now. Your check-out wasn't saved.` | under the status at a desk, the page drawn on the item's job having closed the check-out | in the check-out dialog over its actions (1f `Check out: moved job`) | `ASSET_TRANSITION_COPY.movedTo` (#597) |
| `Only 26-USA-07 can record this item. Your check-out wasn't saved.` | under the status at both widths | `Only 26-USA-07 can record this item. Nothing was saved.`, in the check-out dialog at a desk (1f `Check out: lent away`, 1k-d) | `.notYours` (#597) |
| `This item is retired.` for a check-out somebody's retirement got in front of | under the status at a desk | in the check-out dialog (1f `Check out: retired`) | `.noTransition` (#612) |
| `Jisoo Park already lent this to another job on …` and `… already returned this to its owner on …` | under the status at a desk | in the lending dialog and the return's question (1f `Lend: lent first`, `Return: returned first`) | `.someoneFirst` (#598) |
| `… already sent this for repair on …`, `… already returned this from repair on …` | under the status at a desk | a toast (1f `Repair: sent first`, `Repair return: returned first`) | `.someoneFirst` (#531) |
| `This wasn't fully recorded. Do it again to finish.` after a sending or a check-in | under the status at a desk | a toast (1f `Repair: half done`, 1g `Check in: half done`) | `.statusNotUpdated` (#612) |
| `Something has been recorded on this item, so its job can't be changed.`, `Changing an item's job is for Admins.` | under the status at a desk, the dialog closed | in the dialog (1f `Job: recorded`, `Job: not Admin`) | `ASSET_OFFICE_COPY.recordedSince`, `.noAccess` (#583) |
| `Something has been recorded on this item, so it can't be deleted.`, `Deleting an item is for Admins.` | under the status at a desk, the question closed | in the question (1f `Delete: recorded`, `Delete: not Admin`) | `.deleteRecordedSince`, `.deleteNoAccess` (#582) |
| a lending or a job change left half done on a phone | under the sheet's rows while it stands | the sheet closed, the Notice under the status (1k-f `Lend`, `Change job`) | `ASSET_TRANSITION_COPY.lendHalfDone`, `ASSET_OFFICE_COPY.halfDone` (#598, #583) |
| a return or a deletion left half done on a phone | over the question's actions while it stands | the question closed, the Notice under the status (1k-f `Return to owner`, `Delete`) | `ASSET_TRANSITION_COPY.returnHalfDone`, `ASSET_OFFICE_COPY.deleteHalfDone` (#598, #582) |
| `Couldn't save the item. Try again.` | 1l's dialog, an add or an edit that wrote nothing | `Couldn't save the changes. Try again.` for an edit, `Couldn't add it to the catalog. Try again.` for an add (1l `Save failed`, `Add failed`) | `ASSET_CATALOG_COPY.notSaved` (#612) |
| `Couldn't remove the item. Try again.` | 1l's removal that wrote nothing | `Couldn't remove it from the catalog. Try again.` (1l `Remove failed`) | `.notRemoved` (#612) |
| `Someone else recorded this first. Nothing was saved.` | a refused repair press with no entry read (#531) | draw none | `.someoneFirst` |
| `No item in these filters has the serial number` | 1a, a number the band leaves off | draw the ID's sentence alone (1a3 `ID hidden by filters`) | `ASSET_LIST_COPY.noSerialMatchFiltered` (#601) |
| `Adding…`, `Removing…` for the note and the serial number, and a phone sheet's `Done` and the job change's `Save` busy | heard while a press is on its way | draw the desk row's `Saving…` alone | `ASSET_NOTE_COPY.working`, `ASSET_SERIAL_COPY.working`, `ASSET_OFFICE_COPY.saving` (#533, #601, #583) |
| `Retiring…`, `Deleting…`, `Loading…`; 1l's `Saving…`, `Adding…`, `Creating…`, `Discontinuing…`, `Restoring…` | heard while a press is on its way | draw none; 1l's `Removing…` they draw | `ASSET_TRANSITION_COPY.retireWorking`, `ASSET_OFFICE_COPY.deleteWorking`, `ASSET_LABEL_PAGE_COPY.working`, `ASSET_CATALOG_COPY.working` (#612, #582) |
| `Choose a job.` | the job change, a job no list offers, which no screen sends | draw none | `ASSET_OFFICE_COPY.jobNoneChosen` (#583) |
| the item's kind's list on the job it was on, without the item | where a deletion lands | draw no landing; the file's script moves to 1d, which is behavior and not a drawing | `deletedLanding` (#582) |
| `The category was added, but the item wasn't. Try again.`, `Couldn't create the category. Try again.`, `This item isn't in the catalog any more.`, `Items use it now, so it stays in the catalog.`, `You don't have access to this page. Keeping the catalog is for Admins.` | 1l | draw none | `ASSET_CATALOG_COPY.categoryOnly`, `.categoryNotCreated`, `.gone`, `.hasItems`, `.noAccess` (#612) |

**The words of the rows the files draw are the app's own but for three**:
`Nothing was saved.` after `Only 26-USA-07 can record this item.`, where the
app ends a check-out's refusal on `Your check-out wasn't saved.` as 1k's
sentence does (#597), and 1l's two failures, which the files split by what the
press was where the app says one sentence for an add and an edit. The base's
fields are the ones each issue names: `Assets."Job"` and `."Owner Job"`, the
`Asset Log` rows' `Event`, and `Asset Categories`.
