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

**evidence.** A bar at the top, `Equipment & Tools` with a chevron back to the
category list. The list lies across the column's whole width (#538): the bar,
the head and the band hold still, and only the rows scroll, between the column
head and the pager, so no name comes into the bar. A window narrower than the
table at its least scrolls the table sideways inside its region, the column
head moving with it, the name's column holding at the start with a line at its
end while the table stands scrolled, and the pager then under the region
(1l since 2026-10-21, #552).

**context.** The head: `Catalog`, and how many rows the catalog holds — the
figure alone, or `N of M` while the band narrows, `M` every row.

**action.** In the head, `New category` and `Add to catalog` (1l). Each opens
the catalog's dialog: `Add to catalog` asks a whole row, and `New category` a
type and a category alone, which it adds to the categories the office keeps and
to nothing else.

**action.** Under the head, the category list's band (1a, #520): a search,
`Search catalog`, over each row's whole name, its category and its type, the
name typed in full first; two chips, `Type` and `Category`, each taking
several values with how many rows each would leave — both types offered
whatever the rows hold, and every category the office keeps,
one with nothing filed under it yet at a count of none, each chip's list
scrolling within itself once it passes 340 (1l, #555); and `Discontinued only`,
a toggle that narrows to the discontinued rows, with a × that turns it off.
What the band holds rides the address, so a reload and a copied link keep it,
and it narrows rows already in the browser.

**action.** At the band's end, the order the rows stand in (1l, #540): `Name`,
where the page starts, or `Recently updated` — each row by when it was itself
last edited: added, given a new name, size, maker or part number, moved to
another category, discontinued or restored. An item registered under a row
leaves it where it is, and so does its category renamed in Airtable, which is
the group's edit and not the row's. A save that changes nothing is no edit. The
order rides the address with the band, and a search still puts the name typed in
full first, the order holding among the rest.

**evidence.** One row per catalog row, fifty to a page with the category
list's pager under them, in the order the band's control names — by name, then
size, maker and part number, a run of digits read as a number, where the page
starts. Each row says its name, size, maker, part
number, category and type, and how many items stand under it — every
status counted, since a retired item still stands under its row, but a deleted
one, which the app treats as never registered (#582) — with a zero in
a lighter ink. A level a row leaves empty is an empty cell. A value its column
cuts ends in an ellipsis, and under the pointer shows whole above its cell.

**action.** A row opens `Edit item` over it, the whole row its target. No row
is selected: a box on each row, one in the column head, and the bar with `Set
class` they were for went with the class (#552).

**The dialog (1l)** asks the type as a segmented row across the dialog,
opening on `Equipment` for a new row; the category, listing every category its
type holds and marking one it does not `New`; the name, listing every name
under that category and marking a new one the same way; and the size, the
maker and the part number, each `Optional`. **Each list opens
whole (#555)** — as the field takes focus, on a press in it and on Down — in
name order, with the value the field holds checked and scrolled to, so a row
being edited shows where it stands among the rest; typing narrows it to the
names holding what is typed, and emptying the field opens it whole again. It
stands six rows tall at most and scrolls within that. Under them, `Shows as` and the name the
row will have — the base's own rule — or `Item name` in a faint ink before a
name is typed. A press is refused field by field under each field: a type not
chosen, a category or a name empty or a placeholder, `N/A` and its
kind in a level that is left empty instead (`Leave it empty.`), and a path
another row holds already, said on the name with that row's category — a
discontinued one included. A category typed new is added with the row, first.

**What a press saves is spelled before it (#538).** A category or a name the
catalog does not hold is saved with each word's first letter in capitals and the
rest as typed, a hyphen's second half untouched; one it holds keeps its
spelling, and an edit keeps what its row spells while it is left so. The size,
the maker and the part number are saved as typed. The Category field takes that
spelling once focus leaves it, in both dialogs, and `Shows as` gives the
name's; `New category` draws no `Shows as`.

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

**When a press wrote nothing:** its reason over the dialog's actions. A category
written before the row that failed after it stands, and the dialog says so.

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
`Maker`, `Part #` — the same on the registration, the category list's band
and a category's caption. A row carried a class, `A` or `B`, from #507 until
#552; the office keeps none, and no screen says one.
