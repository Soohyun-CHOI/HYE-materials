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
| `Each item shows here with how many are in stock, out and retired.` | the category list, empty | a category |
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
formula over `Level 3`, `Size`, `Maker` and `Part Number`, beside `Level 1`,
`Level 2` and `Class` (#514; over `Level 2` and `Size` until then). An `Asset
Log` row is an entry in an asset's history. `Level 1`'s value `Tool` is the type
and not this word, and stays. `docs/notes/naming.md` has the rows for `tool` /
`item`, `Tools & Equipment`, `category` and the six level words.

---

## The catalog's six levels (#514)

The registration names a kind by its type, category and name on its first
step, and by the size, maker and part number its rows hold on its second; the
lists and the two pages that head a kind say the type beside the class and the
category. The level words are the issue's; the rest are the closest shape the
app already says until Design draws the dialog and the list.

### What a reader sees

| String | Where | Shape it takes |
|---|---|---|
| `Type`, `Category`, `Name`, `Size`, `Maker`, `Part #` | the dialog's fields, the list's `Type` column | the issue's words |
| `All types` | the dialog's type, nothing chosen | `All jobs`, `All categories` |
| `Choose a name`, `Choose a size`, `Choose a maker`, `Choose a part #` | a field still to choose | `Choose a job` (0l) |
| `Choose a name.`, `Choose a size.`, `Choose a maker.`, `Choose a part #.` | the refusal under each | `Choose a job.` (0l) |
| `No size`, `No maker`, `No part #` | a level left empty, as its option and its value | new: one per level |
| `Tool > DEMO Machining` | beside a name in the search, the line under the title | the caption's path |
| `Class A · Tool > … > GA4570` | a kind's caption, the type first | #507's caption |

**`No maker` is a value and not a placeholder**, which is why it is set in the
field's ink and `Choose a maker` in the placeholder's: chosen — by the reader,
or already, where it is the level's one choice — it says the row without a
maker is the one being added. Beside a maker it is one of the choices, and the
level starts on `Choose a maker` (#517). One word per level rather than one
for all: `None` is also what the catalog's check refuses as a value, and a
screen saying it would read as asking the office to type it.
