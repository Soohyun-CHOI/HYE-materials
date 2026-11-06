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
and `Owner job` (#598) — the sign-in mail's plain-text part, a job change's
`Choose a job.`, which no screen can send, and where a deletion lands, a list
the app already draws, are the app's, in `docs/notes/tools.md` and
`docs/notes/authorization.md`.

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
sign-in one, and #614 says each where they draw it: a refused press in the
dialog or question that sent it at a desk, a press with no dialog as 0k's toast,
and on a phone as 0a's Notice under the status with the sheet or question
closed. These they draw otherwise or not at all. Some are states #614 decided
where the files draw nothing, and on 2026-11-06 Soo reworded several, among
them two the files draw in the words they replaced, which Soo asks Design to
change. The app keeps its own until Soo decides each; a row
decided goes from here in the commit that makes the app say it.

| String or state | The app | The files | Key |
|---|---|---|---|
| `Someone else updated this item first. Nothing was saved.` | a refused repair, lending or return with no entry read (#531, #598); `recorded this` until Soo's words of 2026-11-06 | draw none | `.someoneFirst`, `.firstAct` |
| `No item in these filters has the serial number` | 1a, a number the band leaves off | draw the ID's sentence alone (1a3 `ID hidden by filters`) | `ASSET_LIST_COPY.noSerialMatchFiltered` (#601) |
| `Adding…`, `Removing…` for the note and the serial number, and a phone sheet's `Done` and the job change's `Save` busy | heard while a press is on its way | draw the desk row's `Saving…` alone | `ASSET_NOTE_COPY.working`, `ASSET_SERIAL_COPY.working`, `ASSET_OFFICE_COPY.saving` (#533, #601, #583) |
| `Retiring…`, `Deleting…`, `Loading…`; 1l's `Saving…`, `Adding…`, `Creating…`, `Discontinuing…`, `Restoring…` | heard while a press is on its way | draw none; 1l's `Removing…` they draw | `ASSET_TRANSITION_COPY.retireWorking`, `ASSET_OFFICE_COPY.deleteWorking`, `ASSET_LABEL_PAGE_COPY.working`, `ASSET_CATALOG_COPY.working` (#612, #582) |
| `This item is retired.` in the retirement's question, `Retire` turned away | a desk's retirement somebody got in front of (#614) | draw none | `ASSET_TRANSITION_COPY.noTransition` |
| `This item moved to 26-USA-07. Nothing was saved.`, the job it is on now | an item whose job is not the one the page was drawn on, whether the reader records there or not, whatever was pressed (Soo, 2026-11-06) | 1f `Check out: moved job` and 1k-d `Moved to another job` draw `This item is on 26-USA-07 now. Your check-out wasn't saved.`; 1f `Check out: lent away` and 1k-d `Lent to another job` draw `Only 26-USA-07 can record this item. Nothing was saved.` | `.movedTo` |
| `You no longer have permission to update this item. Nothing was saved.` | an item that did not move, whose reader no longer records on it — taken off its job, or no longer a site manager while the page was open — whatever was pressed, said where the press was (Soo, 2026-11-06) | draw none | `.noPermission`, `refuseNotASiteManager` |
| either of the two above under the field, `Save` turned away for the second | a desk's `Details` editor, which stands (#614) | draw a value changed first, too much typed and a number another item holds there, not these | `.movedTo`, `.noPermission` |
| `This wasn't fully saved. Try again to finish.` | a check-out, check-in, sending, return from repair or retirement left half done (Soo, 2026-11-06) | 1f `Check out: half done`, the toasts `Check in: half done` and `Repair: half done`, the question's `Retire: half done` and 1k-f `Check out` draw `This wasn't fully recorded. Do it again to finish.` | `.statusNotUpdated` |
| the same in the Notice, the question closed | a phone's retirement left half done (#614) | draw a half-done lending in the Notice (1k-f), not a retirement | `.statusNotUpdated` |
| `The category was added, but the item wasn't. Try again.`, `Couldn't create the category. Try again.`, `This item was already removed from the catalog.`, `It can't be removed because items use it.`, `Only admins can edit the catalog.` | 1l; the last three Soo's words of 2026-11-06 | draw none | `ASSET_CATALOG_COPY.categoryOnly`, `.categoryNotCreated`, `.gone`, `.hasItems`, `.noAccess` (#612) |

**`Soo, 2026-11-06` marks words set on planning grounds after the files
arrived**, in #614's third commit. The two refusals for a press
no longer the reader's were split by whether the reader still recorded —
`Only 26-USA-07 can record this item.` for one who did not, `This item is on
26-USA-07 now.` for one whose item moved to another of their jobs — and are
split by what changed since: the item's job first, then the reader.

**The busy words are heard and not seen**: a button busy on the item's page
or the catalog draws the spinner in its word's place and says the word to a
screen reader alone (`Controls.js`, `ButtonLabel`). The base's fields are the
ones each issue names: `Assets."Job"`, the `Asset Log` rows' `Event`, and
`Asset Categories`.
