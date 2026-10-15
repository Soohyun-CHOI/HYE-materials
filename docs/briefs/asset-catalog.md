# Catalog

Route: `/asset-catalog`
Who reaches it: the office, `Is Admin` (#527). Anyone else signed in reads one
sentence in its place, `You don't have access to this page. Keeping the catalog
is for Admins.` — the shape the Invoices file's 1g draws for an Admin's screen.
Its way in is `Catalog` in the head of `/asset-categories`, drawn for the office
alone.
Which width comes first: **desktop**, and it is the only one: the catalog is
kept at a desk (`_shared.md`).

## What it answers

What does the company buy as tools and equipment, and what does each kind look
like in the catalog a site picks from when it adds items?

**A row is a row of `Asset Categories`, the catalog the office keeps (#507), and
on screen it is an item, the design's word since #519** — the same word as the
category list's rows and as each labeled object, so `Items` here counts the
labeled objects standing under a row. Every row is listed, whether a site may
pick it or not: a row the office has marked discontinued, and a row typed by
hand that a registration sets aside — a level missing, `N/A` where a level
should be empty, or a second row naming one path — are this screen's to find
and put right.

**A row is named by its path, and the columns say it a level at a time.** The
name is the row's third level, `Battery`, and the size, the maker and the part
number stand in columns of their own, so three batteries read as one name with
three sizes and makers, where the category list joins them into one name each.

## What it always carries

**evidence.** A bar at the top, `Tools & Equipment` with a chevron back to the
category list, held as the screen scrolls; once the head has scrolled under it,
`Catalog` comes into it, and while the band narrows, the head's `N of M` after
a dot.

**context.** The head: `Catalog`, and how many rows the catalog holds — the
figure alone, or `N of M` while the band narrows, `M` every row.

**action.** In the head, `New category` and `Add to catalog` (1l). Each opens
the catalog's dialog: `Add to catalog` asks a whole row, and `New category` a
type and a category alone, which it adds to the categories the office keeps and
to nothing else.

**action.** Under the head, the category list's band (1a, #520): a search,
`Search catalog`, over each row's whole name, its category and its type, the
name typed in full first; three chips, `Type`, `Category` and `Class`, each
taking several values with how many rows each would leave — both types and both
classes offered whatever the rows hold, and every category the office keeps,
one with nothing filed under it yet at a count of none; and `Discontinued only`,
a toggle that narrows to the discontinued rows, with a × that turns it off.
What the band holds rides the address, so a reload and a copied link keep it,
and it narrows rows already in the browser.

**evidence.** One row per catalog row, twenty-five to a page with the category
list's pager under them, in order of name, then size, maker and part number, a
run of digits read as a number. Each row says its name, size, maker, part
number, category, type and class, and how many items stand under it — every
status counted, since a retired item still stands under its row — with a zero in
a lighter ink. A level a row leaves empty is an empty cell.

**action.** A row's name opens `Edit item` over it, the whole row its target;
a box before it selects it, and one in the column head selects the page. The
selection outlives a page and a narrowing.

**The dialog (1l)** asks the type and the class as two segmented rows, opening
on `Equipment` and `A` for a new row; the category, suggesting the categories
its type holds and marking one it does not `New`; the name, suggesting the names
under that category and marking a new one the same way; and the size, the maker
and the part number, each `Optional`. Under them, `Shows as` and the name the
row will have — the base's own rule — or `Item name` in a faint ink before a
name is typed. A press is refused field by field under each field: a type or a
class not chosen, a category or a name empty or a placeholder, `N/A` and its
kind in a level that is left empty instead (`Leave it empty.`), and a path
another row holds already, said on the name with that row's category — a
discontinued one included. A category typed new is added with the row, first.

## What it carries only sometimes

**When a row is discontinued (#527):** `Discontinued` after its name, in a
lighter ink. A registration no longer offers such a row, and the items already
under it stay where they are on every other screen.

**When a row is edited:** under the title, how many items stand under it,
after `Discontinued` and a dot for a discontinued row. On the left of the
actions `Discontinue`, or `Restore` for a discontinued row, each writing that
alone and closing. While an edit would give the items under the row a new
name, a line over the actions says so — `Its 10 items take the new name.`

**When nothing stands under the edited row:** `More actions` beside the close,
whose one item, `Remove from catalog`, asks `Remove … from catalog?` — `It
comes out of the catalog. No items use it.` — before the row goes. A row items
came to stand under since stays, and the question says why.

**When rows are selected:** a bar over the pager with how many, how many are on
other pages, a way to clear them, and `Set class`, whose menu gives every row
selected `Class A` or `Class B` and clears the selection.

**When a press wrote nothing:** its reason over the dialog's actions, or in the
bar's own column for `Set class`. A category written before the row that failed
after it stands, and the dialog says so.

**When the band leaves no row:** under the column head, `Nothing in the catalog
matches` and a `Clear all` that empties the search, the chips and the toggle at
once; no pager stands under it.

## What must agree elsewhere

**The registration (`tools-new.md`) offers what this screen lists, less the
discontinued rows and the ones it sets aside**, by the same reading
(`lib/assetCategory.js:readCatalog`), so a row this screen shows as discontinued
is one the registration does not offer, and a row it lists with a level missing
is one the registration does not offer either.

**The band is the category list's** (`asset-categories.md`): its words, its
chips, its counts and its address are one reading over rows of the same shape,
so a word changed on one changes on both.

**The level words are the catalog's** — `Type`, `Category`, `Name`, `Size`,
`Maker`, `Part #`, `Class` — the same on the registration, the category list's
band and a category's caption.
