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

**SINCE #612 AN ENTRY HERE IS ONE DESIGN TAKES IN ITS NEXT SENDING, AND THOSE
THAT ARE NOT SAY SO WHERE THEY STAND.** Soo set the words and states below against
Tools 52 and Sign in 28 and sent each to Design on 2026-11-05 to be drawn in the
next sending; the app holds them now. #520's name in two places was not in that
sending and waits for the one that takes it up, and one row was set after it:
the retired item's sentence, in #612's last entry. The first entry, the purchase
request screen's (#333), waits on no sending, since the files draw no such
screen: the app decides it when the materials screens open again. The serial
number's export column (#601) and the sign-in mail's plain-text part are no
entries, the files drawing neither: they are the app's, in `docs/notes/tools.md`
and `docs/notes/authorization.md`. What the files and the app draw alike was
taken off this list in #612: the axis's name (#591), 1a3's state for an item at
another job (#541), the category list's empty sentence (#531), the export's
failure (#553), #520's first two rows, #513's table of `item`, #514's level
words, and the desk's `Details` in repair (#601), which the app draws as 1g does
since #612.

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

## A name in two places (#520, #522)

**Not sent on 2026-11-05.** 1b draws every name alone on its row and under the
title, over a catalog holding no name twice; the screens say where a name in two
places stands, in Ink 3 after the name, because #517's catalog held two `Band
Saw`s — one a machining machine, one a power tool — and two `Pipe Cutter`s, and
1b's rows would draw each pair as the same row twice. The category tells the band
saws apart; the pipe cutters shared theirs, `Cutter`, so they say the type before
it. #528's revised catalog keeps the two band saws, one a cutting machine, and no
pipe cutter, so no row on the base draws the type before a shared category now. A
name in one place says neither, as 1b draws it. The line under the title says the
same after a dot, since the second step is where the reader confirms which of the
two was picked. The files draw no case of it, and the first file that draws the
case decides it.

---

## What #531's screens say that the files of 2026-10-15 do not (#531)

The files draw an item sent for repair and taken back (1a, 1d, 1f, 1j-a, 1j-e)
and none of the moments around either press. Design takes each in the next
sending.

| String | Where | The files |
|---|---|---|
| `Sending for repair…` | `More actions`, busy, heard and not seen | draw no wait for it |
| `Returning from repair…` | the return's press, busy, heard and not seen | draw no busy press |
| `… already sent this for repair on …`, `… already returned this from repair on …` | a refused press, under the status | draw no repair refusal |
| `Nothing was saved.` | a refused press on either repair control | the same |
| `Someone else recorded this first. Nothing was saved.` | a refused repair press, no entry read | the same |

**The two working words are 0f's rule** — the control's verb in its `-ing` form —
and `More actions` carries the sending's, since the menu that sent it has closed;
while it is on its way the button is busy, its spinner over its dots, which the
files do not draw either. **A refused repair follows 1k's sentence** with the
event's own words, and ends on `Nothing was saved.` because neither event has a
noun that reads as one: `Your send-for-repair wasn't saved.` is not English.
**Where the latest entry cannot be read, a refused repair says who got in front
and not what they did**: `Someone else recorded this first. Nothing was saved.`
In this app a scan is a check-out or a check-in, and whoever got in front of a
sending may have checked the item out, sent it or retired it. A refused scan
keeps `Someone else scanned this first.`

The keys are `ASSET_TRANSITION_COPY.working`, `.movedAct`, `.firstVerb`,
`.someoneFirst` and `.notSaved` in `lib/assetTransition.js`, held by value in
`offline/asset-transition.mjs`. The base's words are its own: `In repair`,
`Sent for repair` and `Returned from repair`, which the controls say in the
imperative.

---

## What an item's note says that the files of 2026-10-16 do not (#533, #612)

The files draw the note in 1d's column, 1f's line, dialog and its refusal, 1j's
line and 1j-b2's sheet, and none of the moments after a press. Design takes each
in the next sending.

| String | Where | The files |
|---|---|---|
| `Saving…`, `Adding…`, `Removing…` | the desk row's `Save` and the sheet's `Done`, busy, heard and not seen | draw no wait for any |
| `Someone else changed this note first. Nothing was saved.` | under the desk row's field or the sheet's, when the note changed since the page was drawn | draw no refused note |
| `Edit note` | the name of a desk's `Edit` | name the phone's line so, and the desk's button by its word |

**The working words are 0f's rule**, each commitment's verb in its `-ing` form,
and a field cleared and saved says `Removing…`, since that is what it does. **The
refusal is in 1k's order since #612**, Soo's: what happened first, then what
became of the press — `Nothing was saved. Someone else changed this note first.`
until then — and names nobody, since nothing records who wrote a note. **The
desk's `Edit` is named `Edit note`**, the words the phone's line is named by, so
the one act has one name at both widths and the button's own word stays in it.

The keys are `ASSET_NOTE_COPY.working`, `.changedFirst` and `.editNote` in
`lib/assetNote.js`, held by value in `offline/asset-note.mjs`. The base's word is
the screen's: `Assets."Note"`.

---

## What the registration's search says that the files of 2026-10-23 do not (#547, #566)

The files draw 1b's search as `Search items`, the words the list's band said
until #541 gave it `or item IDs`. The registration's search finds a kind by its
name, its maker, its part number and its size since #547, and says what it finds
one by. Design takes it in the next sending.

| String | Where | The files |
|---|---|---|
| `Name, maker or part #` | the registration's search, its placeholder and its name | draw `Search items` |

**The words name what a site knows an item by** (`tools.md`, `The search over
every level of a row`): `Search items` says what is found and not by what, so a
site manager who knows an item by its maker or its part number has no reason to
type either. The size is searched unnamed, and `Search by name, maker or part
#` was weighed and cut short at the dialog's width once its chips hold a value.

The key is `ASSET_REGISTRATION_COPY.searchLabel` in `lib/assetRegistration.js`,
held by value in `offline/asset-registration.mjs`. The base names the levels it
searches `Level 3`, `Size`, `Maker` and `Part Number` in `Asset Categories`.

---

## What the list's search says for an item at another job or off the band (#541, #599, #601, #612)

The files of 2026-11-02 draw 1a3's `ID at another job`: the line to the item with
its job, over the rows, and `No item at 26-USA-05 has the ID`. The app says `on`,
as it says a job everywhere else (`This item is on 26-USA-07 now.`), by Soo's
ruling of #612; and where an item carries the id but the band leaves it off — a
`Job` chip on `All jobs` taking its job off, or a type or a category leaving its
row off — it says the filters hold none, which the files do not draw. Design takes
both in the next sending.

| String | Where | The files |
|---|---|---|
| `No item on 23-USA-09 has the ID` | where the rows stood, on a list standing on one job, under the line to an item at another job, or until every job has answered | draw `No item at 26-USA-05 has the ID` |
| `No item on 23-USA-09 has the serial number` | the same, for a number found at another job | draw no number at another job |
| `No item in these filters has the ID`, `No item in these filters has the serial number` | where the rows stood, when an item carries the text and the band leaves it off — under the line to that item | draw no state for text the band hides |

**`these filters` is the band's word for what narrows the list**: the same two
words close `No items match these filters`, which the files draw for a band that
empties the list with no search. The line over the rows names the item and its
job — every line does since #612, the files' 1a3 `Item ID` — so the sentence need
not say which chip left it off.

The keys are `ASSET_LIST_COPY.noIdMatchOn`, `.noIdMatchFiltered`,
`.noSerialMatchOn` and `.noSerialMatchFiltered` in `lib/assetListView.js`, held by
value in `offline/asset-id-search.mjs`, `asset-id-elsewhere.mjs` and
`asset-serial.mjs`. The base's word for an item's id is `Assets."Asset ID"`.

---

## What an item's job change says that the files of 2026-10-30 do not (#583, #612)

The files draw `Change job` in 1f's `More actions` and its dialog, and in 1j-f's
menu and sheet, and none of the moments after a press. Design takes each in the
next sending.

| String | Where | The files |
|---|---|---|
| `Save` | the phone's sheet, at its head's end | draw the sheet's rows and no commitment |
| `Saving…` | the dialog's `Save` and the sheet's, busy, heard and not seen | draw no wait for either |
| `Something has been recorded on this item, so its job can't be changed.` | under the status, after a Save on an item something was recorded on since | draw no refused change |
| `The job wasn't fully changed. Save again to finish.` | over the dialog's actions or under the sheet's rows, and under the status once it is closed, when the item's own write failed | the same |
| `Changing an item's job is for Admins.` | under the status, after a Save by a reader no longer the office | the same |
| `Choose a job.` | under the field, for a job no list offers, which no screen sends | the same |

**The phone's `Save` is Soo's ruling**: a press on a row there moves the check
and saves nothing, as the desk's choice saves nothing until its `Save`, so the
sheet takes a commitment where the note's sheet takes `Done` — at its head's end,
which stays on screen over every job. **The working word is 0f's rule**, `Save` in
its `-ing` form. **Something recorded since is said**: the reader pressed `Save`
on a dialog that goes with its line, so the page drawn again says that nothing
moved and why. **A change left half done is said in Soo's words since #612**, the
words every act left half done shares — what is not whole, then the press that
finishes it — where it named the history's entry and both jobs until then. **The
two words for a reader the office no longer is, and a job no list offers**, are a
sentence the action owes a request no screen makes, the second the registration's
own.

The keys are `ASSET_OFFICE_COPY.save`, `.saving`, `.recordedSince`,
`.halfDone`, `.noAccess` and `.jobNoneChosen` in `lib/assetOfficeActs.js`, held
by value in `offline/asset-office-acts.mjs`. The base calls the history's entry
an `Asset Log` row whose `Event` is `Created`.

---

## What an item's deletion says that the files of 2026-10-30 do not (#582, #612)

The files draw `Delete this item` in 1f's and 1j's `More actions`, the desk's
question and the phone's sheet, and none of the moments after a press, and they
draw no screen a deletion lands on. Design takes each in the next sending.

| String | Where | The files |
|---|---|---|
| `Deleting…` | the question's `Delete item`, busy, at both widths | draw no wait |
| `Something has been recorded on this item, so it can't be deleted.` | under the status, after a press on an item something was recorded on since | draw no refused deletion |
| `The item wasn't fully deleted. Delete it again to finish.` | over the question's actions, and under the status once it is closed, when the item's own write failed | the same |
| `Deleting an item is for Admins.` | under the status, after a press by a reader no longer the office | the same |
| the item's kind's list on the job it was on, without the item | where a deletion lands | draw none |

**The working word is 0f's rule**, `Delete` in its `-ing` form, as the
retirement's `Retiring…` is. **Something recorded since is said**, as the job
change's is. **A deletion left half done is said in the job change's words since
#612**, where it named the history's `Deleted` entry until then. **Where a
deletion lands is the item's kind's list on the job it was on**, the breadcrumb's
level above the page that is gone, with nothing said: the list without the item
is what says it happened (#321).

The keys are `ASSET_OFFICE_COPY.deleteWorking`, `.deleteRecordedSince`,
`.deleteHalfDone` and `.deleteNoAccess` in `lib/assetOfficeActs.js`, held by
value in `offline/asset-office-acts.mjs`, and `deletedLanding` beside them is
the landing. The base calls the history's entry an `Asset Log` row whose
`Event` is `Deleted`, and the item's status the same word.

---

## What a refused press and a label run say that the files of 2026-11-02 do not (#597)

The files draw an item that sits on another job (1f `Another job`, 1j-d) and the
lists on another job and on all jobs, and none of the moments a press is refused
because the item is no longer the reader's to record. They draw no label run
naming a code on another job either. Design takes each in the next sending.

| String | Where | The files |
|---|---|---|
| `Only 26-USA-07 can record this item. Your check-out wasn't saved.` | under the status, after a press on an item no longer on the reader's job — the office moved it, or took them off it | draw no refused press for a job |
| `This item is on 26-USA-07 now. Your check-out wasn't saved.` | under the status, after a press on an item moved since the page was drawn to another of the reader's jobs | the same |
| `1 item not on your jobs` | the labels' dialog, over the codes of items off the reader's jobs, beside the codes not found | draw no such run |

**Each refusal names the job the item is on now**, which the job under its
title says too once the page is drawn again, in the voice the files give a job
that records (#598's `26-USA-01 can no longer record it.`), and **ends on what
the press saved**, 1k's ending: `Your check-out wasn't saved.` or `Your check-in
wasn't saved.`, and `Nothing was saved.` for a sending, a return, a loan, a
retirement or a detail, which have no noun that reads as one. **The label run's
codes stand in the codes not found's shape**, under how many: the read refuses
their labels, and a short run printed in silence leaves somebody counting
stickers.

The keys are `ASSET_TRANSITION_COPY.notYours` and `.movedTo` in
`lib/assetTransition.js` and `ASSET_LABEL_PAGE_COPY.notYours` in
`lib/assetLabelPage.js`, held by value in `offline/asset-own-job.mjs` and
`offline/asset-transition.mjs`. The base calls the job an item is on
`Assets."Job"`, and a code a label prints the end of `Asset ID`.

---

## What a loan says that the files of 2026-11-02 do not (#598, #612)

The files draw a lending's menu line, its dialog and sheet, the return's
question at both widths, `On loan from` under a borrowed item's title, `On loan`
on 1a and 1d, and the history's route under a loan's two entries. They draw no
wait on either commitment, no loan left half done, and no export. Design takes
each in the next sending.

| String | Where | The files |
|---|---|---|
| `Returned to owner` | the history entry a return leaves, at both widths | write `Returned` |
| `Lending…` / `Returning…` | to assistive tech while `Lend` or `Return item` is on its way | draw no wait |
| `The item wasn't fully lent to 26-USA-12. Lend it again to finish.` | over the lending's actions, or under the status once closed | draw no half-done loan |
| `The item wasn't fully returned. Return it again to finish.` | over the return's actions, or under the status | the same |
| `Jisoo Park already lent this to another job on …` | under the status, after a press somebody's lending got in front of | draw no refused loan |
| `… already returned this to its owner on …` | the same, after a return | the same |
| `On loan` | the export's first sheet, between `In repair` and `Retired`, on one job's file | draw no export |
| `Owner job` | the export's second sheet, after `Job` | the same |
| a kind's page row on loan with no label box | 1d on the owner job | draw a box on every row |

**The event is the base's, and the history prints it as stored**, so a bare
`Returned` would have stood beside `Returned from repair` in the base and on
the page naming either; Soo approved the longer word. **The half-done sentences
are the job change's shape since #612**: what is not whole, and the press that
finishes it — a lending naming the job it went to, since lending again finishes
it only there; until #612 they named the entry and the job the lists still say.
**The refusals are 1k's** with a loan's acts, and end on `Nothing was saved.`,
the sentence a press with no noun ends on. **The export's columns are the list's
words** — the first sheet's heads are 1a's, `On loan` among them on one job — and
the second sheet's is the field the base calls `Owner Job`, in the sheet's case.
**A row on loan carries no box** because its label is the job it stands on's to
print (`lib/assetJob.js:recordsOn`): a box that selected it would lead to `1 item
not on your jobs`.

The keys are `ASSET_TRANSITION_COPY.lendHalfDone`, `.returnHalfDone`,
`.working` and `.movedAct` in `lib/assetTransition.js`, `ASSET_EVENT` in
`lib/assetStatus.js`, and `ASSET_EXPORT_COPY.ownerJob` and
`ASSET_LIST_COPY.onLoanLabel` in `lib/assetListExport.js` and
`lib/assetListView.js`, held by value in `offline/asset-loan.mjs`. The base
calls the job an item belongs to `Assets."Owner Job"`, the job it stands on
`Assets."Job"`, and the two events `Lent` and `Returned to owner`.

---

## What an item's serial number says that the files of 2026-11-04 do not (#601, #612)

The files draw the serial number in 1a3's line and 1a's search, 1d's column,
1f's `Details` row edited where it stands and its refusal naming the item that
holds the number, 1j's line, 1j-b3's sheet and its refusal. They draw no limit
on what is typed, no stale press, no wait and no number on more than one kind.
Design takes each in the next sending.

| String | Where | The files |
|---|---|---|
| `Use 50 characters or fewer.` | under the serial number's field, after a press past 50 typed | draw no limit |
| `Someone else changed this serial number first. Nothing was saved.` | under the field, when the number changed since the page was drawn | draw no stale press |
| `Saving…`, `Adding…`, `Removing…` | the row's `Save` and the sheet's `Done`, busy, heard and not seen | draw no wait |
| one line per item, 8 apart | 1a3, a number standing on items of more than one kind | draw one line |

**The limit and its sentence are the note's**, a value one line holds, so a
number past it is refused in the note's words rather than cut — `Use 50
characters or fewer.` since #612, Soo's, where both said `Max 50 characters.`.
**The stale press and the working words are the note's too**, with the detail's
own noun. **A number may stand on items of more than one kind**, being one item's
within its kind, so a line stands for each. The two sentences for a number at
another job or off the band are the id's (#541's entry above).

The keys are `ASSET_SERIAL_COPY.tooLong`, `.changedFirst` and `.working` in
`lib/assetSerial.js`, held by value in `offline/asset-serial.mjs`. The base's
field is `Assets."Serial Number"`.

---

## What Soo set against Tools 52 and Sign in 28 that the files do not draw (#612)

Words and states the app holds since #612 that no entry above names. Design takes
each in the next sending.

| String or state | Where | The files |
|---|---|---|
| `No items on 25-USA-13` | 1d, a kind with items on other jobs and none on the job the page stands on | draw `Nothing added yet` (1d `No items`, `No items · another job`) |
| `Page not found`, `Back to Equipment & Tools` | an address no kind carries | draw none; 1h is an item's, which keeps `Item not found` |
| `Enter a name.` | a check-out pressed with no name, at both widths | draw it at a desk (1f) and `Enter a name to check out.` on a phone (1k-b) |
| `Incorrect code. 4 attempts left.`, `Incorrect code. 1 attempt left.` | the code step, a code that does not match | draw `Wrong code. 4 tries left.` (Sign in 1a-f, 1e) |
| `Use 50 characters or fewer.` | a note past 50, after a press, in the line under the field | draw `Max 50 characters.` (1f, 1j-b2) |
| `10 items will show the new name.`, `1 item will show the new name.` | 1l's edit, over the actions, when it would rename items | draw no such line |
| `This wasn't fully recorded. Do it again to finish.` | under the status, after a check-out, check-in, sending, return from repair or retirement whose status write failed | draw no such state |
| `This item is retired.` | a phone's foot bar on a retired item, and the refusal for a press on one retired first — **set after the sending of 2026-11-05** | draw `Nothing more can be recorded here.` (1j-c) |
| a serial number and a note written in every status a screen shows | 1f, 1g, 1j | draw both writable in 1g's `In repair` alone, and neither in 1g's `Retired`, 1j-e or 1j-c |
| `More actions` in a phone's top bar on an item out or in repair, and over its sheets | 1j-b, 1j-b2, 1j-b3, 1j-e | draw none there |
| the registration's second step starting on the list's job, its code and name (#565) | 1b | draws `Choose a job` |
| `Jisoo Park already checked this in on 10/05/2026 8:50 AM. Your check-in wasn't saved.` | under the status, after a check-in somebody got in front of | draw 1k-a's check-out alone |
| `All jobs` on the category list: the band's `Job` chip, and no `On loan` column | 1a | draw `All jobs` on 1d alone |
| an Admin who is also a site manager: `Catalog` and `Add items` together in the head, and `More actions` holding `Send for repair`, `Lend to another job`, `Change job`, `Retire this item` and `Delete this item` | 1a, 1f | draw each role apart |
| `Enter the 6-digit code from the email.` | the code step, a code pressed short | draw none |
| `This code no longer works` | the code step, a code used, no longer waited on, or not valid | draw it for a link alone (1f) |
| `Enter your first name.` | the name step, the first name empty | draw the last name's |
| `Couldn't save your jobs. Try again.` | the job step, a write that failed | draw none |
| `Enter a category.`, `Couldn't save the item. Try again.`, `The category was added, but the item wasn't. Try again.`, `Couldn't create the category. Try again.`, `Couldn't remove the item. Try again.`, `This item isn't in the catalog any more.`, `Items use it now, so it stays in the catalog.`, `You don't have access to this page. Keeping the catalog is for Admins.` | 1l | draw none |
| `Checking out…`, `Checking in…`, `Retiring…`; `Loading…` for the labels; 1l's `Saving…`, `Adding…`, `Creating…`, `Discontinuing…`, `Restoring…`, `Removing…` | heard while a press is on its way | draw none |

**The words are Soo's, where the files say otherwise.** A found line names its
item's job wherever it stands, as 1a3 draws it since 2026-11-02, and `Print labels`
past a print's labels is `aria-disabled` and still takes focus, as 1e draws it —
both taken in #612, so neither is listed. **The details in every status** follow
from neither being an event, and a retired item says on a phone what it is,
`This item is retired.`, where 1j-c's `Nothing more can be recorded here.` would
contradict the two lines that still write. **The states the files draw no
moment for** take the words the app's other refusals and working words take.

The keys are `ASSET_LIST_COPY.noItemsOn` and `.pageNotFound` in
`lib/assetListView.js` (`offline/kind-empty-state.mjs`);
`ASSET_TRANSITION_COPY.nameRequired`, `.statusNotUpdated` and `.noTransition` in
`lib/assetTransition.js` (`offline/asset-transition.mjs`); `CODE_COPY` in
`lib/authTokenState.js` (`offline/auth-token-state.mjs`); `ASSET_NOTE_COPY.tooLong`
(`offline/asset-note.mjs`); `ASSET_CATALOG_COPY.renames` and its refusals in
`lib/assetCatalog.js` (`offline/asset-catalog.mjs`); `USER_NAME_COPY` and
`USER_JOBS_COPY` in `lib/userName.js` and `lib/userJobs.js`; and
`lib/assetStatus.js:mayWriteDetailsIn`, the shown map's answer, for the details
(`offline/asset-status.mjs`). The base's fields are `Assets."Note"` and
`."Serial Number"`, whose descriptions say who writes them.
