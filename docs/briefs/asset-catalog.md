# Catalog

Route: `/asset-catalog`
Design: Tools 1l, on Invoices 0b and 0l.
Who reaches it: the office, `Is Admin`. Anyone else signed in reads one sentence in
the list's place, `ASSET_CATALOG_COPY.noAccess`, and nothing else of it. Its way in is
on the category list's head, drawn for the office alone.
Which width comes first: **desktop**, and it is the only one: the catalog is kept at a
desk.

## What it answers

What does the company buy as tools and equipment, and how does each kind stand in the
catalog a site picks from when it adds items?

**A row is a row of `Asset Categories`, every one of them** (`lib/assetCatalog.js`),
whether a registration may pick it or not: a row the office marked discontinued, and a
row typed by hand that a registration sets aside — a level missing, a placeholder where a
level should be empty, a second row on one path — are this screen's to find and put
right. On screen a row is an item.

**A row is named by its path, a level at a time**: the name is the path's third level,
and the size, the maker and the part number stand apart, so three batteries read as
one name with three sizes and makers.

## What it always carries

**Every row with its levels, its category and type, and how many items stand under it**
— every status counted, since a retired item still stands under its row, and a deleted
one not, since the app treats it as never registered (`itemCountOf`). A level a row
leaves empty is empty. A discontinued row is marked so.

**The category list's band** (`asset-categories.md`), one reading over rows of the same
shape (`filterAssetCategoryRows`): a search over each row's whole name, its category and
its type, the name typed in full first; a type and a category chosen several at a time,
offering **both types whatever the rows hold and every category the office keeps**, one
with nothing filed under it at a count of none; and a toggle narrowing to the
discontinued rows, which narrows first, so every count the chips give is a count of
those. What the band holds rides the address, and it narrows rows already in the
browser.

**The order**: by name — then size, maker and part number, a run of digits read as a
number — where the page starts, or by **when each row was itself last edited**,
`Asset Categories."Edited At"`, which Airtable keeps over the six fields this page
writes and nothing else: an item registered under a row, or its category renamed in
Airtable, leaves it where it is, and a save that changes nothing is no edit. The order
rides the address with the band; a search still puts the name typed in full first.

**A page holds `ASSET_PAGE_SIZE` rows**, the category list's pager.

**Two ways to add**: a whole row, and a category alone, which is added to the
categories the office keeps and to nothing else. **A row opens its edit**; nothing is
selected.

**The add and the edit ask one reading twice** (`readCatalogEntry`), in the dialog and
again in the action against the base as it then stands, so the two cannot refuse
differently. Each list in it opens whole on focus, in name order, the value held
checked and scrolled to; typing offers a few names holding what is typed, the closest
first (`lib/assetCatalog.js`). Before the press, **what will be saved is spelled
out**: a category the type already holds, or a name its category already holds, is
saved as it is already spelled; one it does not hold, with each word's first
letter in capitals and the rest as typed (`lib/itemNaming.js:capitalizeWords`); the
size, the maker and the part number as typed.

**What it reads:** 3 operations — the session, every `Asset Categories` row and every
`Asset Category Groups` row (`docs/notes/tools.md`).

## What it carries only sometimes

**When a press is refused, field by field under each field**
(`ASSET_CATALOG_COPY.refusal`): a type not chosen, a category or a name empty or a
placeholder, a placeholder in a level that should be left empty, and a path another row
already holds — a discontinued one included — said on the name with that row's
category. Adding a category alone refuses one the type already holds. A category
typed new in an item's dialog is added with the row, first.

**When an edit would give the items under a row a new name**
(`ASSET_CATALOG_COPY.renames`), said before the press.

**When a row is edited**, it can be discontinued or restored, each writing that alone.
A registration's search no longer offers a discontinued row, and the items already
under it stay on every other screen.

**When nothing stands under the edited row**, it can be removed from the catalog, after
a question (`ASSET_CATALOG_COPY.removeTitle`, `ASSET_CATALOG_COPY.removeSays`). A row
items came to stand under since stays (`ASSET_CATALOG_COPY.hasItems`), and one somebody
removed first says so (`ASSET_CATALOG_COPY.gone`); either turns the commitment away,
described by its sentence, since pressing again cannot change it. Discontinuing and
restoring keep theirs.

**When the reader stopped being the office while a dialog was open:** the press says
`ASSET_CATALOG_COPY.noAccess` in the dialog, which stands, its commitment turned away,
and the page behind is drawn again with that sentence in the list's place.

**When a press wrote nothing:** its reason over the dialog's actions, by what the press
was — `ASSET_CATALOG_COPY.notSaved`, `ASSET_CATALOG_COPY.categoryNotCreated`,
`ASSET_CATALOG_COPY.notRemoved`. **A category written before the row that failed after
it stands, and the dialog says so** (`ASSET_CATALOG_COPY.categoryOnly`).

**When the band leaves no row:** `ASSET_CATALOG_COPY.noneMatch` and one control that
empties the search, the chips and the toggle at once; no pager under it.

## What must agree elsewhere

**The registration's search offers what this screen lists, less the discontinued rows
and the ones it sets aside**, by the same reading (`lib/assetCategory.js:readCatalog`),
and a registration opened on such a row from its own page is refused at the press
(`tools-new.md`).

**The band is the category list's**: its chips, counts and address are one reading,
so a chip's word changed on one changes on both; the search's label and the emptied
list's sentence are each screen's own.

**The level words are the catalog's** (`ASSET_CATEGORY_COPY.levelLabel`), the same here,
on the registration and in the category list's band. **Nothing here
renames or removes a category**: that stays the office's to do in Airtable, where a
rename reaches every row linked to it.
