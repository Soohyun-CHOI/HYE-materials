# Tools

Route: `/tools`
Who reaches it: anyone signed in, with no Role and no Job scoping (#337).
Which width comes first: **desktop**. Both widths must work; this one is
drawn first and the phone is what it folds into.

## What it answers

How many of each kind of tool does the company have, and how many of them
are out?

**A `Tools` row is a `tool` — the kind of tool, the name somebody typed
once — and a `Tool Items` row is a `tool item`, one physical object
carrying a printed id.** #338 settled that pair. Six of one drill is one
tool and six tool items, and this screen has one row per tool. This brief
said "tool kinds" before that issue, which would have invited `Kind` as a
word on the screen; the word is `tool`.

**The question is about the fleet rather than about any one tool**, which
is why a row carries three counts and no total. A reader looking for one
particular unit is looking for its printed id, and that is the tool item's
own screen, reached by scanning it or from the tool's page one level down.

**These are the only screens in the app used at a phone width**, and what
that means for the whole design is the fifth constraint in the shared
brief. A tool is entered and its labels printed at a desk; a tool item is
scanned on site, on a phone, possibly by someone wearing gloves. Both
widths are this axis's problem, and neither is the other axis's.

**The width container for every tools screen lives in the layout, not on
the page**, and it is empty: no width, no padding, no type, no color was
chosen for it, deliberately (#336). The screen renders unstyled. There is
nothing here to preserve and nothing to depart from.

## What it always carries

**identity.** The heading `Tools`, which is the `Tools` table's name — the
same rule that makes the other list screens `Purchase Requests`,
`Purchase Orders`, `Invoices` and `Deliveries`.

**action.** The control that opens the registration form at `/tools/new`,
carrying that form's own heading as its word so the two cannot drift
(#338). Every other list screen in the app opens its create form the same
way. It is above the list rather than inside it, because the reader with
no tools at all is the one who needs it most.

**evidence.** One row per tool, ordered by name. The name is the row's
identity and is the way into that tool's own screen.

**verdict.** Three counts on every row: how many of that tool are
`In Stock`, how many are `Out`, how many are `Retired`. This is what the
reader came for.

**All three are always there, a zero included, and a design may not drop
one.** A count of nothing is a measurement — "none out" — and an absent
row would read as "not known", which is the distinction between nothing
and no comparison the shared brief already draws. It also means the three
words appear on every row whatever the base holds.

**There is no total per tool, and that is a decision rather than an
omission.** A single figure would have to count a retired tool or not
count it, and both readings are wanted: what the company holds now, and
what it has ever bought. The three counts answer both without choosing.
A design that adds the three together is making that choice.

## What it carries only sometimes

**When there are no tools at all:** one sentence in place of the rows,
`No tools yet.` and then how one comes to exist — somebody registering
tool items of it. The control above it is still there and is the way to
do that.

**This is the only empty state this screen can reach**, which is worth
saying because the shared brief describes three. The other two are
"nothing you can see" and "nothing matching your filters"; nothing on this
axis is scoped by role or job, and this list has no filters, so neither
has a producer here.

**A tool with nothing under it** reads as a row whose three counts are all
zero. It is reachable and is not a display error: a registration writes
the `Tools` row before it writes the tool items, and #338 rolls back
neither, so a failure in between leaves the tool standing alone. The
tool's own screen is where that is explained in words.

## What must agree elsewhere

**The heading and the link that leads here are the same word.** The root
screen carries `Tools` as its fifth link and this screen's heading is
`Tools`. That agreement is worth keeping — `Purchase orders` and
`Purchase Orders` are the pair on the same screen that does not have it,
and the shared brief records the disagreement.

**The three counts read the same status the tool item's own screen
shows.** `Tool Items."Status"` is maintained by the app, not computed on
either screen, so this list and `/tool-items/[toolItemId]` cannot disagree
about where a tool item is.

**`In Stock`, `Out` and `Retired` are the three statuses this axis has,
and they are not status tones.** The tones in the shared brief are one
closed vocabulary for how far something has got on an axis; reusing one
here would make a word mean a stage on one screen and a location on
another. The words appear as themselves on this screen, so the count is
never carried by color alone.

**`Out` and `Retired` will read zero on every row until a later phase.**
Nothing in the app writes a `Checked Out`, `Checked In` or `Retired`
log row yet — registration is the only event that exists — so the only
count with a figure in it today is `In Stock`. That is a fact about how
far the app has got, not about the screen: all three are drawn.

**One tool's own screen is `/tools/[toolRecordId]`, one level under this
one.** It held the tool ITEM until #348, because a QR code encodes the
whole address and its length decides the symbol's version; a route of its
own carries that now, so the flat slot came free and one tool took it.
**A tool's name never appears as a path segment** — the segment is
Airtable's record id, since `Tools` mints none and a typed name is not a
path — which is also what keeps a tool somebody names `new` from
colliding with the registration form.

**A tool item's screen is `/tool-items/[toolItemId]`, off this axis's own
collection**, and the label prints a third address again. None of this
reaches a reader: what they see is a name on this list and a printed id on
the next screen.

**A tool item is never a bare `item` on any tools screen.** Four other
tables on this base have items of their own — a request's, an order's, an
invoice's, a delivery's — so the modifier stays.
