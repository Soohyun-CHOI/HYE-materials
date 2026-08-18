# Material purchase history

Route: `/materials/[materialId]`
Who reaches it: anyone signed in, with the same per-row gate on document
identifiers as the price list.

## What it answers

Every time we have bought this item, and what we paid each time. Where the price
list answers "what is the going rate", this answers "is that rate moving, and who
have we been buying from".

## What it always carries

**identity.** The item name as the page heading — this is the one detail screen in
the app whose heading is a human name rather than a generated ID, because a
material has no ID a person would recognize. Under it, the size and unit joined by
a middle dot, in small gray text, when either exists.

**evidence — `Purchase history`,** a table of six columns: Date, Vendor, Qty, Unit
price, Amount, Order. One row per time this material was ordered.

Here Qty comes **before** Unit price, the reverse of the price list one level up,
because this table has an `Amount` column and quantity times price equals amount.
The two screens differ on purpose and each ordering follows its own arithmetic.

**The rows come from the orders themselves**, not from the price cache the list
screen reads. So this is the actual history and the list is a latest-value summary
of it.

## What it carries only sometimes

**When the material does not exist:** `Material not found.` — the same ordinary
not-found text every row-scoped screen uses for a refusal, so a reader is never
told that something exists but is not theirs.

**When there is no size or unit:** the subtitle is absent rather than showing a
placeholder.

**When a row's order is not in the ordinary signed state:** a short tag beside it —
`PO unsigned` for one awaiting signature, `PO withdrawn` for a withdrawn one, and
`PO: {status}` for anything else. A signed order gets **no tag at all**, so the tag
column is empty on almost every row and its presence is the signal.

**Per row, when the reader may see it:** the order identifier, and the job — this
screen's `Order` column is a composite cell carrying both, which is why it is the
widest column in the table.

## What must agree elsewhere

**The table's shape is deliberately close to the price list's** so the two read as
one family, and the column widths on both were set from their headers rather than
their figures — several of these headers are wider than the numbers under them.

**`PO unsigned` and `PO withdrawn` describe the same two states the purchase order
screens name** with `Awaiting Signature` and `Withdrawn`. The short forms here are
tags in a dense table rather than a second vocabulary, and they must keep pointing
at the same two states.

**The history is read from the orders and not from the price cache**, which is why
a withdrawn order can appear here with a tag while the list screen shows its price
as the vendor's latest with a caveat. The two screens disagree in appearance and
agree in fact, and that is the relationship to preserve.

**A material's identity is item name, size and unit** — never the vendor. Two
vendors' prices for one material are two rows here, not two materials.
