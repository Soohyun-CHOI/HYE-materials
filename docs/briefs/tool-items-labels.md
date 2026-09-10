# Print tool labels

Route: `/tool-items/labels`
Who reaches it: anyone signed in, with no Role and no Job scoping (#337). No tool
item is one reader's rather than another's.
Which width comes first: **desktop**. This screen is used at whatever machine the
printer is attached to, which `docs/notes/tools.md` settled for the whole label
step. Both widths must work; this one is drawn first.

## What it answers

We registered some tools and now they need stickers. Put their QR labels onto a
sheet of adhesive stock and print it.

**A tool item with no label is a row nothing can reach.** The QR symbol is the
only way a phone gets from a physical drill to its record, so this screen is the
last step of registration rather than a convenience — and it is why a
registration's own answer links straight here.

**The screen exists because paper is not a screen.** What it draws is a sheet at
its true printed size, and the whole point of every dimension on it is that the
ink lands inside a die-cut rectangle somebody peels off. That makes it the one
screen in this app whose correctness is physical.

## What it always carries

**identity.** The heading, `Print tool labels`.

**evidence.** Three facts about the run, all of them screen-only and never
printed:

- **The host each symbol will encode**, spelled out. A symbol carries the host it
  was printed from, so a sheet printed on a preview domain is thirty stickers
  pointing somewhere that will stop resolving. This is stated with a warning
  saying so. **The warning is not conditional** — nothing in the app knows which
  host is the permanent one, so the screen states the host and the risk and lets
  the person reading decide.
- **Which stock**, by name.
- **How many labels across how many sheets**, once a selection exists.

**action.** Three controls:

- **A per-label include**, one for every tool item the address named, all included
  to begin with, plus a select-all and a select-none. Excluding one takes it out
  of the sheet rather than leaving a blank in its place, so a run stays
  contiguous.
- **The first label position on the sheet**, 1 to 30. **This is for a part-used
  sheet and it is the ordinary case rather than an edge**: a registration is
  usually a handful of tools, so printing always from the top would throw away
  most of a sheet every time. A person counts across the sheet to the first label
  still attached and types that number.
- **Print.**

**the sheet.** One page-sized box per sheet, each label placed at its stock's own
corner. Each label carries three things and the reasons are not the same:

- **The QR symbol**, in a box that is its full size including the four modules of
  quiet zone the SVG carries. **Nothing may be drawn inside that box.** The margin
  is what lets a camera separate the symbol from everything printed beside it.
- **The `Tool Item ID` in characters a person can read.** This is the fallback for
  a symbol that has been scratched or painted over, so it is not decoration and it
  may not be truncated. Its size has a floor; see below.
- **The tool's name.**

## What it carries only sometimes

**When the address named no tool item:** the heading and one sentence saying so,
pointing at the two screens that open this one. No empty sheet and no controls.

**When none of the named ids is on the base:** the heading and one sentence
saying none exists. This is reachable by hand-typing an address.

**When some of them are not on the base:** those ids are named in a sentence of
their own and no label is offered for them. **They are not folded into the
sheet** — a label that cannot be printed is a different state from one that can,
and printing a short sheet in silence would leave somebody counting stickers to
find out.

**When more ids were named than one request prints:** a sentence saying how many
were named, that this prints 100 at a time, and that the first 100 are below. The
cap is the largest registration's cap and the two are one number, so nothing the
app itself produces can reach this.

**When nothing is selected:** a sentence saying there is nothing to print, and the
print control does not act.

**When the run does not fit one sheet:** more than one sheet is drawn, and each
one prints on its own page. Blanks held open by the start position appear only on
the first — a run that spills starts at the top of the next sheet.

## What must agree elsewhere

**The stock's dimensions are not chosen yet and live in one place.** No printer
has been confirmed at the site, so no adhesive stock has been bought;
`Avery 5160` is the default because it is what an office printer takes. When the
real stock arrives, one constant changes and this screen's layout is not
reopened. **A design must not assume 30 labels of that size** — it should assume
a grid whose dimensions come from somewhere else.

**The symbol is sized in modules, never in millimeters.** A QR symbol's side grows
four modules per version as the address it encodes gets longer, and this one is
already at the exact capacity of its version. So the printed size is a fixed
millimeters PER MODULE, chosen so that a symbol two versions larger still fits
the label — which makes a longer address a bigger symbol rather than a denser
one. **A design that pins the symbol to a box in millimeters would undo this**,
and the failure is invisible on screen: it only shows up as a symbol a phone
cannot read.

**The readable id has a floor and no ceiling.** Its minimum size is a functional
constraint — it is the fallback path when the symbol is unreadable, so it has to
be legible at arm's length — and it is set in code. **Everything above that floor
is the design's**, including whether it is larger, where it sits, and what it is
set in. It renders at the floor today because that is the constraint with no
design applied to it, not because the floor is the right size.

**Both the id and the tool's name render at that one size, and the sameness is
deliberate.** The id is the only thing on the label with a size requirement, so
it is the only figure there is; giving the id the floor and letting the name
inherit the app's body size made the NAME larger than the id, which is a
hierarchy nothing decided and the wrong way round. **A design setting them apart
is expected — this is the absence of that decision, not a version of it.**

**Above the floor, the label's width is the limit.** The id is 17 characters and
must not be cut off, so there is a size past which it no longer fits beside the
symbol. That is a fact about this stock rather than a rule, and it moves with the
stock; what code holds is that the id fits AT the floor.

**The screen words are `tool` and `tool item`.** A `Tools` row is a tool, a
`Tool Items` row is a tool item, and never a bare `item` — four other tables on
this base hold item rows. The same pair governs `/tools`, `/tools/new`, the tool's
own screen and the tool item's.

**Two screens open this one and their words come from here**, so the control on a
registration's answer and the control on a tool's own page cannot drift from the
screen they open. That is the arrangement `/tools`' control on `/tools/new`
already has.

**The tool's page prints the page it is showing.** That screen reads its tool items
ten at a time, so ten printed ids are what a render holds; a tool with more is
printed a page at a time. **This is the paging's consequence rather than a
choice**, and a design offering "print all of this tool" would be asking for a
read that screen divided on purpose.

**The sheet is drawn at its true printed size, so it cannot fit a phone.** At a
375px width the controls fit and the sheet is more than twice that, so the page
scrolls sideways — measured, and inherent rather than a defect: a US Letter sheet
is 215.9mm across and drawing it smaller would stop it being a preview of what
comes out. **How the narrow case reads is open** — scaled down, scrolled, or the
sheet withheld below some width — and it is the one place on this screen where
the phone behavior is a design question rather than a dimension.

**Nothing on the paper is a screen affordance.** The picker, the position control,
the print button and all three sentences about the run are hidden at print. What a
reader sees on screen and what comes out of the printer are deliberately not the
same thing, which is the one place in this app where that is true.
