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

**action — a search box** with the placeholder `e.g. pipe 2"`, and a hidden label
for screen readers. Search is token-based: the terms may be typed in any order and
still find the same item, and the screen says so in a note beside the box, using
two examples in code style.

**evidence — one section per material.** A heading that is the item name as a link
to its own screen, and under it in small gray text the size and unit joined by a
middle dot — or `No size or unit recorded` when there are neither.

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

**When something was typed and nothing matched:** `No items match "{query}".` This
must not read like the empty-index case — nothing matched what was typed and
nothing indexed at all are two different facts.

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
