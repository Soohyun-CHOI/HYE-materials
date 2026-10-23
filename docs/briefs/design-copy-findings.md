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

---

## `correction`, for what a signer sends back (#333)

`Correction Requests` and `Edit Log` became `PR Edit Requests` and `PR Edit Log`.
The tables are named for their parent now, as every other child table on this
base already was, and one act stopped having two words: an edit request asks for
an edit, and what it produces is a row in the edit log.

**The screen was left alone, deliberately.** #333's scope was the code and the
schema; the wording is Design's. So `/prs/[prId]` still says `correction` in six
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

**One reason to prefer `edit` if the design has no view of its own:** the same
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

---

## `item`, for an asset and for a category (#513, #519)

`Tool Items`, `Tools` and `Tool Log` became `Assets`, `Asset Categories` and
`Asset Log`: the axis holds equipment as well as tools, and the office calls each
thing it labels and tracks an asset. The routes moved with them —
`/asset-categories`, `/asset-categories/[categoryRecordId]`, `/assets/[assetId]`
and the printed `/l/[labelCode]` — and so did the code.

**The screens say `item` for both since #519, the design's word**: a row of the
category list is an item, and so is each labeled one. They said `tool` for both
from #455, with `item` only where a category's own screen counted what is under
it, and #513 moved one word alone, the axis's own name: `Tools & Equipment`, on
the rail, the category list's heading and tab, the breadcrumb, the root screen's
link and `Back to Tools & Equipment`, which stays — it is the site's word for what
the office calls assets. So the screen word and the base's word differ on both
tables, and the column below says which of the two each string names, since a
later sweep needs to know.

### What a reader sees

| String | Where | Names |
|---|---|---|
| `Add items`, `Add 1 item`, `Add 5 items` | registration dialog: title, opener, submit | assets |
| `Couldn't add the items. Try again.` | registration dialog | assets |
| `1 item couldn't be added`, `5 items couldn't be added` | the shortfall's title | assets |
| `1 item has no creation date`, `5 items have no creation date` | the notice's title | assets |
| `That item isn't available any more.` | registration dialog | a category |
| `No items yet` | the category list, empty | categories |
| `Each item shows here with how many are in stock, out, in repair and retired.` | the category list, empty | a category |
| `Name` | the category list: the name column's head | a category |
| `item`, `items` after the head's figure | both lists, assistive tech only | categories, assets |
| `Item` | a category's page: the tab | a category |
| `Item ID` | a category's page: the column of codes | assets |
| `Nothing added yet` | a category's page, empty | assets |
| `Item not found` | a category's page and an asset's: not found | either |
| `QR label for this item` | an asset's page: the label's name, assistive tech only | an asset |
| `No item has the code …`, `No item has this code. …` | an asset's page: not found | an asset |
| `This item was last scanned on …` | check-out and check-in | an asset |
| `No items have gone out on this job yet.` | the name sheet | assets |
| `Retire this item`, `Retire item` | an asset's page: the menu and the confirm | an asset |

`…, and the lists will say so. Do it again.`, a scan whose status was not saved,
said `the tool lists` until #519 and says the lists alone: the sentence is about
the two list screens, and `item lists` would read as a list of items.

### What moves with them

A copy key named after its string takes the string's word when the string moves,
#333's shape, and every one did in #519:

- `ASSET_LIST_COPY.noItemsHeading`, `.noItems` and `.nameLabel` in
  `lib/assetListView.js` — `noToolsHeading`, `noTools` and the borrowed
  `toolLabel` until #519 — and `.backToTools`, which says the axis's name.
  `toolNoun` went, since both lists count in `itemNoun` now.
- `ASSET_COPY.toolLabel` in `lib/assetView.js` went: the category list was its one
  reader.
- `ASSET_REGISTRATION_COPY.itemGone` in `lib/assetRegistration.js`, `toolGone`
  until #519.
- The checks that pin these strings by value: `offline/asset-registration.mjs`,
  `asset-list-view.mjs`, `asset-view.mjs`, `asset-transition.mjs`,
  `asset-screen-words.mjs` and `screen-briefs.mjs`.
  `scripts/screen-strings.mjs` finds the screens.

### What the base calls it

An `Assets` row is an **asset**: `Asset ID` (`HYE-AST-YYMMDD-###`), `Category`,
`Job`, `Status`. An `Asset Categories` row is a **category**: `Item Name`, a
formula over `Level 3`, `Size`, `Maker` and `Part Number`, beside `Level 1`
and `Level 2` (#514; over `Level 2` and `Size` until then; beside `Class` too
until #552 took the class off the catalog). An `Asset
Log` row is an entry in an asset's history. `Level 1`'s value `Tool` is the type
and not this word, and stays. `docs/notes/naming.md` has the rows for `tool` /
`item`, `Tools & Equipment`, `category` and the six level words.

---

## The catalog's six levels (#514)

The registration names a kind by its type, category and name on its first
step, and by its size and model on its second; the list says the category
beside each name, and the two pages that head a kind say the type and the
category under it (#519, the design's; the class after them until #552). The level words are the issue's,
and both steps took 1b's in #520 — the search and its chips, no line under the
title while it picks, the size and the model as chips, `None` and `Not
specified` for a choice left empty, and `Choose a size.` and `Choose a model.`
for one not made — so `All types`, `Choose a name` and its refusal, the path
beside a name in the search and on the line under the title, the second step's
placeholders and `No size`, `No maker` and `No part #` left this table then.

### What a reader sees

| String | Where | Shape it takes |
|---|---|---|
| `Type`, `Category`, `Name`, `Size`, `Maker`, `Part #` | the levels | the issue's words |
| `Tool · Power tools` | a kind's caption and an asset's | 1d, 1f, 1j (#519, #552) |

**`None` and `Not specified` are values and not placeholders**, which is why
they are chips of their own, set in Ink 3 as 1b sets them: chosen — by the
reader, or already, where one is the choice's only option — each says the row
without a size or a model is the one being added. `None` is also what the
catalog's check sets aside as a value (`isPlaceholder`), which is why #514 wrote
one word per level instead; the design's word was taken in #520, since a row
carrying it never reaches the dialog.

---

## Where a screen says other than the design's files (#520, #522)

What #520 found the design's files drawing or stating otherwise than the
screens, and where each stands in the files #522 read. **The latest files
decide what a screen draws (#522)**, and a decision taken with an earlier issue
does not outrank them: an entry here is a question for the next sending, never a
reason to keep a screen as it is.

| The files #520 read | The files #522 read | The screen |
|---|---|---|
| 0h: a date in a table column reads `MM/DD` | 0h: a date reads `MM/DD/YYYY` | `09/22/2026`, a category's list, `Updated` |
| 1b lists the names holding what is typed alphabetically | 0h: the exact name, then names starting with what was typed, then names holding it, each group alphabetical | the registration's search, in that order |
| 1b draws every name alone on its row and under the title | the same, over a catalog holding no name twice | a name in two places says where |

**In the first two rows the files now say what the screens say**, so neither
is a difference any more; they stay as the record of what #520 asked about.

**A name in two places says where it stands**, in Ink 3 after the name, because
#517's catalog held two `Band Saw`s — one a machining machine, one a power tool —
and two `Pipe Cutter`s, and 1b's rows would draw each pair as the same row twice.
The category tells the band saws apart; the pipe cutters shared theirs, `Cutter`,
so they say the type before it. #528's revised catalog keeps the two band saws,
one a cutting machine, and no pipe cutter, so no row on the base draws the type
before a shared category now. A name in one place says neither, as 1b draws
it. The line under the title says the same after a dot, since the second step
is where the reader confirms which of the two was picked. **The files #522 read
draw no case of it**: their catalog holds every name once, so they say nothing
about how two rows of one name are told apart, and the first file that draws
the case decides it.

---

## What #531's screens say that the files of 2026-10-15 do not (#531)

The files draw an item sent for repair and taken back (1a, 1d, 1f, 1j-a, 1j-e)
and none of the moments around either press. What a screen says in their place
follows a rule the design already states, and the next sending decides each.

| String | Where | The files |
|---|---|---|
| `Each item shows here with how many are in stock, out, in repair and retired.` | the category list, empty (1a) | `… in stock, out and retired.` over four columns |
| `Sending for repair…` | `More actions`, busy, heard and not seen | draw no wait for it |
| `Returning from repair…` | the return's press, busy, heard and not seen | draw no busy press |
| `… already sent this for repair on …`, `… already returned this from repair on …` | a refused press, under the status | draw no repair refusal |
| `Nothing was saved.` | a refused press on either repair control | the same |
| `Someone else recorded this first. Nothing was saved.` | a refused repair press, no entry read | the same |

**The empty sentence names all four statuses**, Soo's ruling over the drawing's
three: the list counts four. **The two working words are 0f's rule** — the
control's verb in its `-ing` form — and `More actions` carries the sending's,
since the menu that sent it has closed; while it is on its way the button is
busy, its spinner over its dots, which the files do not draw either. **A refused
repair follows 1k's sentence** with the event's own words, and ends on
`Nothing was saved.` because neither event has a noun that reads as one: `Your
send-for-repair wasn't saved.` is not English. **Where the latest entry cannot
be read, a refused repair says who got in front and not what they did**:
`Someone else recorded this first. Nothing was saved.` In this app a scan is a
check-out or a check-in, and whoever got in front of a sending may have checked
the item out, sent it or retired it. A refused scan keeps `Someone else scanned
this first.`

The keys are `ASSET_TRANSITION_COPY.working`, `.movedAct`, `.firstVerb`,
`.someoneFirst` and `.notSaved` in
`lib/assetTransition.js` and `ASSET_LIST_COPY.noItems` in
`lib/assetListView.js`, each held by value in `offline/asset-transition.mjs`
or `asset-list-view.mjs`. The base's words are its own: `In repair`,
`Sent for repair` and `Returned from repair`, which the controls say in the
imperative.

---

## What an item's note says that the files of 2026-10-16 do not (#533)

The files draw the note in 1d's column, 1f's line, dialog and its refusal, 1j's
line and 1j-b2's sheet, and none of the moments after a press. What a screen
says in their place follows a rule the design already states, and the next
sending decides each.

| String | Where | The files |
|---|---|---|
| `Saving…`, `Adding…`, `Removing…` | the dialog's commitment, `Remove note` and the sheet's `Done`, busy, heard and not seen | draw no wait for any |
| `Nothing was saved. Someone else changed this note first.` | the dialog over its actions, or the sheet under its field, when the note changed since the page was drawn | draw no refused note |
| `Edit note` | the name of a desk's `Edit` | name the phone's line so, and the desk's button by its word |

**The working words are 0f's rule**, each commitment's verb in its `-ing`
form, and a field cleared and saved says `Removing…`, since that is what it
does. **The refusal takes 1k's two halves**, what became of the press and then
why, and names nobody: nothing records who wrote a note. **The desk's `Edit` is
named `Edit note`**, the words the phone's line is named by, so the one act has
one name at both widths and the button's own word stays in it.

The keys are `ASSET_NOTE_COPY.working`, `.changedFirst` and `.editNote` in
`lib/assetNote.js`, held by value in `offline/asset-note.mjs`. The base's word is
the screen's: `Assets."Note"`.

---

## What the list's `Export` says that the files of 2026-10-22 do not (#553)

The files draw 1a's `Export`, its name `Export to Excel` and its wait, and no
press that comes back with no file. What the screen says there is Soo's ruling,
in the shape the app's other refusals of a press take, and the next sending
decides it.

| String | Where | The files |
|---|---|---|
| `Couldn't export the list. Try again.` | before `Export` on its line, after a press that made no file, until the next | draw no failure |

**The words are `Couldn't add the items. Try again.`'s**, the registration's
for a press that wrote nothing, with the export's verb and its object: what
failed is the list, which is what the button exports. It is set as a refusal
about the whole of an act is set, the info mark and the line in Ink 2, before
the control as 0f sets a reason.

The key is `ASSET_EXPORT_COPY.failed` in `lib/assetListExport.js`, held by
value in `offline/asset-export.mjs`. Nothing on the base is named for it.

---

## What the list's search for an item's id says that the files of 2026-10-22 do not (#541)

The files draw 1a's `No ID match` with `No item has the ID` and the id typed
after it. The app's list finds an item on the job it stands on and nowhere else, so on one
job the sentence names that job, by Soo's ruling; on all of a reader's jobs it
is the drawing's. The next sending decides it.

| String | Where | The files |
|---|---|---|
| `No item on 23-USA-09 has the ID` | where the rows stood, on a list standing on one job, before the id typed | draw `No item has the ID` |

**The job is named because the drawing's sentence would be false there**: an
item on another of the reader's jobs is not found on this one, and `No item has
the ID` would deny it. Nothing finds it on the other job for them — `All jobs`
does, for a reader on several. The job is said by its code, as the head's chip
says it.

The keys are `ASSET_LIST_COPY.noIdMatch` and `.noIdMatchOn` in
`lib/assetListView.js`, held by value in `offline/asset-id-search.mjs`. The
base's word for an item's id is `Assets."Asset ID"`.
