# Tools

Route: `/tools`
Who reaches it: anyone signed in, with no Role and no Job scoping (#337).
Adding tools from it is a site manager's (#506); everyone else reads the same
list without that control.
Which width comes first: **desktop**, and it is the only one: this screen is
used at a desk and does not support a phone's width (`_shared.md`).

## What it answers

How many of each kind of tool does the company have, and how many of them
are out?

**A `Tools` row is a tool — the kind of tool, the name somebody typed
once — and a `Tool Items` row is one physical object carrying a printed
id.** #338 settled the pair and this brief calls the second a `tool item`,
which is the base's word for it. **The screens call it what the design
does (#455)**: a `tool` in any sentence about one — `Add tools`,
`Retire this tool` — and an `item` where a tool's own screen counts what is
under it. So six of one drill is one tool, six items on its screen, and a
tool in every sentence about any one of them; this screen has one row per
tool. This brief said "tool kinds" before #338, which would have invited
`Kind` as a word on the screen; the word is `tool`.

**The question is about the fleet rather than about any one tool**, which
is why a row carries three counts and no total. A reader looking for one
particular unit is looking for its printed id, and that is the tool item's
own screen, reached by scanning it or from the tool's page one level down.

**The tool item's screen is the only one on this axis used at a phone
width**, with the sign-in a scan can arrive through, and what that means
for the whole design is the fifth constraint in the shared brief. A tool is
entered and its labels printed at a desk, so this screen is a desk's; a
tool item is scanned on site, on a phone, possibly by someone wearing
gloves. The phone is this axis's problem and no other's.

**The width container for every tools screen lives in the layout, not on
the page**, and no width, no padding, no type, no color was chosen for it,
deliberately (#336). Since #460 it holds the design's rail and still nothing
of a screen's own; **since #463 this screen is drawn as 1a** — the list's head
over a table whose column head holds while the rows scroll, and a pager pinned
at the foot.

## What it always carries

**identity.** The heading `Tools`, which is the `Tools` table's name — the
same rule that makes the other list screens `Purchase Requests`,
`Purchase Orders`, `Invoices` and `Deliveries`. The rail's section for this
screen says the heading's own string, read from it (#460). Beside it on its
line, how many tools there are, the figure alone — `17`, with `tools` said to
assistive tech after it (1a, #505) — a count of the list, which says nothing
about what any tool holds.

**action.** The control that opens the registration dialog over this screen
(#456), carrying that dialog's own heading as its word so the two cannot drift
(#338) — `Add tools` (#485), where it was the design's `New tools` from #455,
because most registrations add to a tool the company already has, and the line
under a typed name says when one is new. Every other list screen in the
app opens its create form the same way, as a screen of its own. It is above
the list rather than inside it, because the reader with no tools at all is the
one who needs it most. It is a site manager's: for one assigned to no job it is
drawn disabled, with `Ask the office to assign you to a job` before it, and **a
reader who is not a site manager is drawn none (#506)** — being one is not
something the office assigns on request the way a job is, so a disabled control
with a reason would send them nowhere.

**evidence.** One row per tool, ordered by name, twenty-five to a page
(0b's page of rows, #463) with the pager under them: which rows the page
shows of how many, `1–17 of 17`, which page of how many, and a step each
way that a page at its end draws and does not act. The name is the row's
identity and the whole row is the way into that tool's own screen.

**verdict.** Three counts on every row: how many of that tool are
`In stock`, how many are `Out`, how many are `Retired`. This is what the
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

**When there are no tools at all:** in place of the rows, a heading and a
sentence, `No tools yet` and `Each tool shows here with how many are in
stock, out and retired.`, and under them a second, bordered `Add tools`
(1a, #463). The control in the head is still there, and both are the way to
make one. No pager stands under an empty list. **For a reader who is not a
site manager, the heading and the sentence alone (#506)**: the sentence says
what the list is for, which is true for whoever reads it, and both openers are
a site manager's.

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

**`In stock`, `Out` and `Retired` are the three statuses this axis has,
and they are not status tones.** The tones in the shared brief are one
closed vocabulary for how far something has got on an axis; reusing one
here would make a word mean a stage on one screen and a location on
another. The words appear as themselves on this screen, so the count is
never carried by color alone.

**All three counts carry figures.** A check-out, a check-in and a
retirement each write the status they show (#362, #363), so a row can read
any mix of the three and a design draws for all of them. This said `Out`
and `Retired` would read zero on every row until a later phase, which
stopped being true when those issues wrote the other two events; corrected
by #449.

**One tool's own screen is `/tools/[toolRecordId]`, one level under this
one.** It held the tool ITEM until #348, because a QR code encodes the
whole address and its length decides the symbol's version; a route of its
own carries that now, so the flat slot came free and one tool took it.
**A tool's name never appears as a path segment** — the segment is
Airtable's record id, since `Tools` mints none and a typed name is not a
path — which is also what kept a tool somebody names `new` from
colliding with the registration form's route, until #456 made the form a
dialog.

**A tool item's screen is `/tool-items/[toolItemId]`, off this axis's own
collection**, and the label prints a third address again. None of this
reaches a reader: what they see is a name on this list and a printed id on
the next screen.

**A physical tool is an `item` on its tool's own screen and a `tool` in a
sentence, and never a `tool item` on any screen (#455).** This brief said
it was never a bare `item`, because four other tables on this base have
items of their own — a request's, an order's, an invoice's, a delivery's.
That was stricter than the app's own rule for item rows: the modifier
drops where nothing on the screen offers a second kind of item row, and no
tools screen shows any of those four. The one sentence that still says
`tool item` is the tool item screen's not-found heading, which is the
design's to rewrite.
