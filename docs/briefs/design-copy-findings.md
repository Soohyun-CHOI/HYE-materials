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

## `tool`, for an asset and for a category (#513)

`Tool Items`, `Tools` and `Tool Log` became `Assets`, `Asset Categories` and
`Asset Log`: the axis holds equipment as well as tools, and the office calls each
thing it labels and tracks an asset. The routes moved with them —
`/asset-categories`, `/asset-categories/[categoryRecordId]`, `/assets/[assetId]`
and the printed `/l/[labelCode]` — and so did the code.

**One word on the screen moved, and only one:** the axis's own name is
`Tools & Equipment`, on the rail, the category list's heading and tab, the
breadcrumb, the root screen's link and `Back to Tools & Equipment`. That is the
site's word for what the office calls assets, chosen for the people holding the
phone. Every other string kept its `tool`, deliberately — the words are Design's,
and #513 changed no behavior. The column below says what each `tool` stands for,
because it stands for three things and a sweep needs to know which.

### What a reader sees

| String | Where | Names |
|---|---|---|
| `Add tools`, `Add 1 tool`, `Add 5 tools` | registration dialog: title, opener, submit | assets |
| `Couldn't add the tools. Try again.` | registration dialog | assets |
| `1 tool couldn't be added`, `5 tools couldn't be added` | the shortfall's title | assets |
| `1 tool has no creation date`, `5 tools have no creation date` | the notice's title | assets |
| `That tool isn't available any more.` | registration dialog | a category |
| `Tool`, `Choose a tool`, `Choose a tool.` | registration dialog's first step | the second level |
| `No tools yet` | the category list, empty | assets |
| `Each tool shows here with how many are in stock, out and retired.` | the category list, empty | a category |
| `Tool` | the category list: the name column's head | a category |
| `tool`, `tools` after the head's figure | the category list, assistive tech only | categories |
| `Tool` | a category's page: the tab | a category |
| `Tool ID` | a category's page: the column of codes | assets |
| `No items under this tool` | a category's page, empty | a category |
| `Tool not found` | a category's page and an asset's: not found | either |
| `QR label for this tool` | an asset's page: the label's name, assistive tech only | an asset |
| `No tool has the code …`, `No tool has this code. …` | an asset's page: not found | an asset |
| `This tool was last scanned on …` | check-out and check-in | an asset |
| `…, and the tool lists will say so. Do it again.` | a scan whose status was not saved | the lists |
| `No tools have gone out on this job yet.` | the name sheet | assets |
| `Retire this tool`, `Retire tool` | an asset's page: the menu and the confirm | an asset |

The second level is the one `tool` that is not a row: the catalog's levels are
`Level 1`, `Level 2` and `Size`, a screen says `Category`, `Tool` and `Size`, and
#514 reshapes the levels — so that row is likely to be decided there rather than
here.

### What moves with them

Copy keys named after their string kept the string's word, which is #333's
shape: an identifier that mirrors what a screen says is truthful for as long as
the screen says it.

- `ASSET_LIST_COPY.noToolsHeading`, `.noTools`, `.toolNoun` and `.toolLabel` in
  `lib/assetListView.js`, and `.backToTools`, which already says the axis's name.
- `ASSET_COPY.toolLabel` and `.backToTools` in `lib/assetView.js`, the first of
  which the list's `toolLabel` reads.
- `ASSET_REGISTRATION_COPY.toolGone` in `lib/assetRegistration.js`.
- The second level, not a row: `ASSET_CATEGORY_COPY.toolLabel` and
  `.toolUnchosen` in `lib/assetCategory.js`, `ASSET_REGISTRATION_COPY`'s
  `.toolNoneChosen` and `.changeTool`, the dialog's first step `"tool"` in
  `RegistrationDialog.js`, and the refusal key `fields.tool`.
- The checks that pin these strings by value: `offline/asset-registration.mjs`,
  `asset-category.mjs`, `asset-list-view.mjs`, `asset-view.mjs`,
  `asset-transition.mjs`, `asset-screen-words.mjs` and `screen-briefs.mjs`.
  `scripts/screen-strings.mjs` finds the screens.

### What the base calls it

An `Assets` row is an **asset**: `Asset ID` (`HYE-AST-YYMMDD-###`), `Category`,
`Job`, `Status`. An `Asset Categories` row is a **category**: `Item Name`, a
formula over `Level 2` and `Size`, beside `Level 1` and `Class`. An `Asset Log`
row is an entry in an asset's history. `docs/notes/naming.md` has the rows for
`tool` / `item`, `Tools & Equipment` and `category`.
