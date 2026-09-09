# Tools

Route: `/tools`
Who reaches it: anyone signed in, with no Role and no Job scoping (#337).

## What it answers

Almost nothing, and a designer should know that before reading further. #336
opened this route and the layout the tools screens share; #339 is the issue that
puts the list of tools on it. **So this brief describes a screen that is a
heading and one control**, and what is worth handing over is the layout under it
rather than the content on it.

**A `Tools` row is a `tool` — the kind of tool, the name somebody typed once —
and a `Tool Items` row is a `tool item`, one physical object carrying a printed
id.** #338 settled that pair. This brief said "tool kinds" before that issue,
which would have invited `Kind` as a word on the screen; the word is `tool`.

**These are the only screens in the app used at a phone width**, and what that
means for the whole design is the fifth constraint in the shared brief. A tool
is entered and its labels printed at a desk; a tool item is scanned on site, on
a phone, possibly by someone wearing gloves. Both widths are this axis's
problem, and neither is the other axis's.

**The width container for every tools screen lives in the layout, not on the
page.** Every screen above this axis declares its own; these share one. So a
width chosen for the tools axis is one edit rather than an edit per page — the
one structural fact #336 settled, and the reason it landed before #258.

**The container is empty today and the screen renders unstyled.** No width, no
padding, no type, no color was chosen for it, deliberately: #336 decided where a
width is decided and decided no value. There is nothing here to preserve and
nothing to depart from.

## What it always carries

**identity.** The heading `Tools`, which is the `Tools` table's name — the same
rule that makes the other list screens `Purchase Requests`, `Purchase Orders`,
`Invoices` and `Deliveries`.

**action.** The control that opens the registration form at `/tools/new`,
carrying that form's own heading as its word so the two cannot drift (#338).
Every other list screen in the app opens its create form the same way.

## What it carries only sometimes

Nothing, and there is no branch on the page at all. A reader with no session is
redirected to `/login` before anything renders; every reader who arrives sees
the same heading and the same control — **including a reader who cannot use the
form**, since being assigned to no job is refused on the form's own screen
rather than by hiding the way to it. **No empty state, because nothing is being
listed yet** — when #339 lists tools, the three-way empty wording in the shared
brief is what it inherits.

## What must agree elsewhere

**The heading and the link that leads here are the same word.** The root screen
carries `Tools` as its fifth link and this screen's heading is `Tools`. That
agreement is worth keeping — `Purchase orders` and `Purchase Orders` are the
pair on the same screen that does not have it, and the shared brief records the
disagreement.

**`/tools/[toolItemId]` is taken and is not free to move.** A tool item's own
screen sits one level under `/tools`, flat, because that address is what the QR
code on the sticker carries and its length decides the symbol's version — a
longer address means thinner modules on a label of the same size. #336 reserved
the segment and #340 occupies it. So the list of tools this screen will hold
either goes a level deeper or names its tool in a query parameter (#339). **A
tool's name therefore never appears as a path segment**, which is also what keeps
a tool somebody names `new` from colliding with the registration form.

**A tool item is never a bare `item` on any tools screen.** Four other tables on
this base have items of their own — a request's, an order's, an invoice's, a
delivery's — so the modifier stays.

**`In Stock`, `Out` and `Retired` are the three statuses this axis has, and
`Registered`, `Checked Out`, `Checked In` and `Retired` its four events.** Both
are closed sets held in one module, and neither belongs to the status tones in
the shared brief: those are one closed vocabulary for how far something has got
on an axis, and reusing one here would make a word mean a stage on one screen
and a location on another. Nothing renders either set yet.
