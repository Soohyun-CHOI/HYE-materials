# Material prices

Route: `/materials`
Who reaches it: anyone signed in. The prices themselves are open to everyone;
document identifiers inside each row are gated per row, so two readers can see the
same price with only one of them seeing which order it came from.

## What it answers

What did we last pay for this item, and to whom? It is a reference screen, not a
workflow one — nobody has a task here. A site staffer opens it before phoning a
vendor, to know whether the price they are about to be quoted is reasonable.

It exists because that decision happens **before a purchase request exists**, so
no form inside a request could help with it. That is the whole reason this screen
is separate from the document chain, and a redesign that folds it into the request
form undoes it.

## What it always carries

**identity.** The heading `Material prices`, and under it the line
`What we last paid for an item, by vendor.`

**action — a search box** with the placeholder `e.g. ball valve 2"`, and the
hidden label `Search by category, size or unit` for screen readers. Search is
token-based: the terms may be typed in any order and still find the same item, and
the screen says so in a note beside the box, using two examples in code style —
`ball valve 2"` and `2" ball valve`.

**What the words reach is the catalog's vocabulary, not anybody's typing.** The
item name is a lookup of the category's composed path, so the terms that find a
row are HQ's tree's terms plus the size and the unit. A word the tree does not use
finds nothing however many purchase orders carry the material. The examples are
chosen to be reachable and a check holds them to it.

**evidence — one section per material.** A heading that is the item name as a link
to its own screen, and under it in small gray text the size and unit joined by a
middle dot — or `No size or unit recorded` when there are neither.

**That heading is the whole category path**, joined with ` > ` and up to 146
characters, repeated once per material down the page. The per-material screen
carries the same string as its own heading. Every material on the base today
shares its first segment, so the paths align down the left and diverge late —
which is a fact about what is bought rather than about the tree, and a redesign
that leans on it should know it can stop being true.

**evidence — a table per material, five columns.** Vendor, Unit price, Qty, Date,
Order. Unit price comes **before** Qty here, which is the reverse of every items
table in the app — those run Qty then Unit Price because quantity times price
equals an amount. Here there is no amount, and price is what the reader came for,
so it goes first. This is a deliberate divergence rather than an inconsistency.

Each row is one vendor's most recent price for that material. Not a history — the
per-material screen is where history lives.

## What it carries only sometimes

**When more than one vendor has a price and one is lowest:** a `Lowest` mark on
that row. It is comparison rather than recommendation, and the caveat below can
undercut it.

**When the prices in a table were quoted at different quantities:** the note
`These prices were quoted at different quantities, so the unit prices are not
directly comparable.` **Only when they actually differ** — otherwise it would
become a permanent caveat that readers learn to skip, and then it says nothing on
the day it matters. This note is what makes `Lowest` honest, so the two belong
together.

**When a price came from an order that was withdrawn or is not yet signed:** the
note that it is still the most recent price recorded for that vendor. The price is
not hidden — it is qualified.

**When nothing was typed:** no prompt at all, because an empty search is a browse
and the whole list is below. Instead, one of two counts:
`All N items bought so far.` or, when the list was truncated,
`Showing N items. Search to find a specific one.`

**When a search matched more than the page shows:**
`Add another word to narrow the search.` after the count. **This line is
load-bearing rather than a nicety.** Matching is by substring, so a short word can
reach far more rows than the reader meant — `tee` reaches every row whose branch is
`Stainless Steel`, through the letters inside `Steel`. That was weighed against a
stricter rule and kept, on the grounds that another word always narrows and this
sentence is where the reader is told so. A redesign may move it; it may not drop
it.

**When something was typed and nothing matched:** `No item matches “{query}”.`
and then **one of two sentences, which must not read alike** — this is the screen's
sharpest distinction and the reason the miss costs a second query:

- `The catalog has a category for those words;`
  `no purchase order has put an item under it yet.`
  The words were right and the price does not exist yet.
- `No category in the catalog carries all of those words.`
  `Try fewer words — a size is never part of a category.`
  The reader is asking for something the tree does not name that way. **A size
  always lands here**, since the tree names no dimension at all — and so does a
  query carrying no size, which is why the second half states a fact rather than
  telling the reader to drop a word that may not be there.

Neither may read like the empty-index case below — nothing matched what was typed
and nothing indexed at all are different facts, and the box is suppressed under a
miss so they are never both on screen.

**What Design still decides is the wording, not the split.** The two states are
settled and a redesign may not collapse them; whether the first should name the
reader's next action — asking the office to add a path to the catalog, which is how
a path arrives — is open, and the app says nothing about it today.

**Per row, when the reader may see it:** the order identifier in the `Order`
column. A reader who cannot see the order behind a price still sees the price.

## What must agree elsewhere

**The per-material screen is the same data one level deeper**, and the two tables
are deliberately kept in one shape so a reader crossing between them is not
re-learning a layout.

**`Qty` is the row's own quantity**, as everywhere in the app — a modifier is added
only for an aggregate or a derived figure.

**Vendor is deliberately not part of a material's identity.** An item is the same
item whoever sells it: that is what makes this screen a price comparison rather
than a vendor catalog, and it is a decision in the data model rather than a
rendering choice.

**Prices are USD only.** No currency selection exists anywhere in the app.

**The per-row identifier gate is the same rule the purchase order detail uses.**
This screen adds no visibility rule of its own.
