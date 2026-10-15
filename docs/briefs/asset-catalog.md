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

## What it carries only sometimes

**When a row is discontinued (#527):** `Discontinued` after its name, in a
lighter ink. A registration no longer offers such a row, and the items already
under it stay where they are on every other screen.

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
