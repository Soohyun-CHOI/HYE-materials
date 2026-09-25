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

**THIS WARNING IS THE ONLY DEFENSE LEFT AND IT HAS TO BE READABLE AT THE MOMENT
OF PRESSING PRINT (#411).** Until that issue a symbol built on a dev host came
out a version larger than a real one, so a wrong host was visible in the picture
itself; the shortened address put both at version 2, and nothing about the sheet
now looks different when the host is wrong. Measured on the current layout at
1440x900 with three labels: the warning sits 240px above the print control and
both are on screen at once. **It does not stay that way** — the picker grows one
row per label between them, so a run of thirty puts the control below the fold
and a run of a hundred puts it 2,600px down, and the person pressing Print has
scrolled the warning off the screen. **A design must keep the host and this
warning legible from wherever Print is pressed** — pinned beside the control, or
repeated there, or the control placed where the warning still reads. What it may
not do is treat this as a preamble somebody reads once on the way in.
**Re-measured after #412 shrank the label and every figure above is unchanged**:
the picker's rows are text and their height does not follow the sticker's. What
did change is that a run now needs fewer sheets, not that it needs fewer rows.
- **Which stock**, by its label size. **No product has these dimensions**, so the
  line states the geometry a supplier would be asked for rather than a name
  (#412); when a real stock is bought, its name is what belongs there.
- **How many labels across how many sheets**, once a selection exists.

**action.** Three controls:

- **A per-label include**, one for every tool item the address named, all included
  to begin with. Excluding one takes it out of the sheet rather than leaving a
  blank in its place, so a run stays contiguous. **There is no select-all and no
  select-none, and their absence is a decision rather than an omission**: every
  label starts included, so select-all named the state the screen already opens
  in, and select-none reached only the state the screen refuses to print from. A
  run is a handful, so unchecking one or two is the whole interaction — **a design
  should not add a bulk control back without a reader who needs one.**
- **The first label position on the sheet**, 1 to however many a sheet holds —
  110 today, and a figure a design must read rather than assume. **This is for a
  part-used
  sheet and it is the ordinary case rather than an edge**: a registration is
  usually a handful of tools, so printing always from the top would throw away
  most of a sheet every time. A person counts across the sheet to the first label
  still attached and types that number.
- **Print.**

**the sheet.** One page-sized box per sheet, each label placed at its stock's own
corner. Each label carries two things, the symbol and the code under it, and the
reasons are not the same:

- **The QR symbol**, in a box that is its full size including the four modules of
  quiet zone the SVG carries. **Nothing may be drawn inside that box.** The margin
  is what lets a camera separate the symbol from everything printed beside it.
- **The printed code, in characters a person can read, under the symbol.** This
  is the fallback for a symbol that has been scratched or painted over, so it is
  not decoration and it may not be truncated. Its size has a floor and its face
  is part of the label's arithmetic; see below.

**The tool's name is not on the label (#431).** The design dropped it. The
picker above the sheet still names each tool item by its tool, because that is
a screen naming a record and the person choosing labels chooses by it; the
sticker carries the code alone.

**The printed code is not the whole `Tool Item ID`, and the difference is the
point (#411).** A tool item is `HYE-TL-260909-004` in the base, on this screen's
own picker and on every other screen; the sticker carries `260909-004`. The
seven characters dropped are on every tool item and separate none of them, so
they cost the symbol its headroom and the label its width while confirming
nothing. **A design must not put them back**, and must not treat the picker
above the sheet and the sticker below it as needing the same string: one is a
screen naming a record, the other is a sticker a person reads in order to type.

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
the first — a run that spills starts at the top of the next sheet. A sheet holds
more labels than one request prints, so this is reached from a start position
past 11 and not by the size of the run alone.

## What must agree elsewhere

**The stock's dimensions are not chosen yet and live in one place.** No printer
has been confirmed at the site, so no adhesive stock has been bought. When the
real stock arrives, one constant changes and this screen's layout is not
reopened. **A design must not assume a particular number of labels or a
particular label size** — it should assume a grid whose dimensions come from
somewhere else.

**The label is 16.8 mm wide by 20.42 mm tall and it is sized from the symbol,
not from a product (#412, #431).** It was 66.7 by 25.4 mm, which was a real
adhesive sheet picked when nothing had been printed. A wrench or a screwdriver
has no flat run that wide, so the module and the readable code went to their
floors and the label is what came out of the arithmetic. **110 fit a Letter
sheet**, and that count is computed from the page, the margin, the label and the
gap rather than typed — a design must not assume it.

**The narrow side is 16.8 mm and it is the dimension that decides whether the
sticker goes on.** A label wraps along a handle, so the narrow side has to clear
the handle's width and the long side runs down a tool that is far longer than
20 mm. **A wrench handle is roughly 15 to 20 mm**, so this label goes on most of
that range and **not on the narrow end of it: at 15 mm it does not fit, and
nothing available to this app makes it fit.** The three things that could be
smaller are all fixed from outside: the symbol's four-module quiet zone is the
QR specification's, the 1 mm safe inset is the allowance for a die-cut that is
not perfectly placed and a sheet that does not feed perfectly straight, and the
0.4 mm module is a quoted camera limit this app cannot measure its way past.
**So a tool with a handle narrower than about 17 mm has no label yet, and that
is a stated limit rather than an oversight.**

**The code sits under the symbol (#431), and the order is part of the
geometry.** The symbol is wider than the code at its floor, so the narrow side
is the symbol's alone either way. Beside the symbol, the long side was the
symbol and ten characters, 30.3 mm, and a sheet held 78; under it, the long side
is the symbol, a gap and one line of code, 20.42 mm, and a sheet holds 110. What
kept the code beside the symbol was the tool's name, which sat in height the
symbol had already paid for — and the label no longer carries the name. **So
the code above the symbol, or beside it again, is a different label rather than
a restyling of this one**, with different dimensions and a different count.

**The symbol is sized in modules, never in millimeters.** A QR symbol's side grows
four modules per version as the address it encodes gets longer. So the printed
size is a fixed millimeters PER MODULE, chosen so that a symbol one version
larger still fits the label — which makes a longer address a bigger symbol
rather than a denser one. **A design that pins the symbol to a box in
millimeters would undo this**, and the failure is invisible on screen: it only
shows up as a symbol a phone cannot read.

**The readable code has a floor and no ceiling.** Its minimum size is a functional
constraint — it is the fallback path when the symbol is unreadable — and it is
set in code, at 6 pt. **Everything above that floor is the design's**, and the
cost of going above it is now fixed: the code's line is the one thing the
label's height is built from besides the symbol, so a larger code makes the
label taller by the same amount, and wider as well past about 8.4 pt, where ten
characters outgrow the symbol. It renders at the floor, which is the size the
design kept when it chose the face.

**The code is set in Inconsolata, and the face is part of the label's
arithmetic (#431).** The design chose it. The label's width budget is that
face's measured advance — half its size per character — so a different face is
a different number. **Changing the face is the design's to do and it reopens
that figure**; what the label has room for without changing size is a face up
to about 0.69 of its size per character, ten characters under the widest symbol.
The face reaches the printed code and nothing else on this screen.

**Both floors are quoted figures and neither was measured here (#412).** The
module's 0.4 mm is the practical minimum published for a phone camera resolving
a printed module; the code's 6 pt is the size print convention holds as the
smallest legible in printed matter. That is a font size, and it is stated in
points because the convention is — it was 2.0 mm, which is 5.67 pt, until
#431. The two were 0.57 mm and 2.5 mm before #412, set for a label read at arm's
length; this one is read in the hand, off a tool somebody is holding. **What
would settle either is a sheet printed on paper and read by a phone, which
nobody has done** — and until that happens the label is as small as arithmetic
supports rather than as small as it goes.

**Nothing is left over for the symbol, and next to nothing under the code (#412,
#431).** The widest symbol the module absorbs is 14.8 mm against 14.8 mm of
printable width, and the code's line takes the height left under it to within
0.003 mm. The one room on the label is beside the code: ten characters at the
floor take 10.58 mm of the 14.8 mm under the symbol. **A design adding anything
to the label has to take it from something already there**, and the two things
it may not take it from are the symbol's quiet zone and the code's floor.

**The label absorbs one symbol version rather than two.** A QR symbol grows four
modules a side as the address it encodes gets longer; the module cannot shrink
to absorb that any more, because it is already at its floor, so the label has to.
One step is what it carries. **Past that the screen says the symbol no longer
fits and draws no label for it** — that sentence is reachable now in a way it was
not, and a design must keep it.

**The screen words are `tool` and `tool item`.** A `Tools` row is a tool, a
`Tool Items` row is a tool item, and never a bare `item` — four other tables on
this base hold item rows. The same pair governs `/tools`, `/tools/new`, the tool's
own screen and the tool item's.

**Two screens open this one and their words come from here**, so the control on a
registration's answer and the control on a tool's own page cannot drift from the
screen they open. That is the arrangement `/tools`' control on `/tools/new`
already has.

**The tool's page prints the page it is showing.** That screen reads its tool items
twenty-five at a time, so a page of printed ids is what a render holds, and a page
fits inside the hundred this screen prints at once; a tool with more is printed a
page at a time. **This is the paging's consequence rather than a choice**, and a
design offering "print all of this tool" would be asking for a read that screen
divided on purpose.

**The sheet is drawn at its true printed size, so it cannot fit a phone.** At a
375px width the controls fit and the sheet is more than twice that, so the page
scrolls sideways — measured, and inherent rather than a defect: a US Letter sheet
is 215.9mm across and drawing it smaller would stop it being a preview of what
comes out. **How the narrow case reads is open** — scaled down, scrolled, or the
sheet withheld below some width — and it is the one place on this screen where
the phone behavior is a design question rather than a dimension.

**Nothing on the paper is a screen affordance.** The heading, the picker, the
position control, the print button and every sentence about the run are hidden at
print. What a reader sees on screen and what comes out of the printer are
deliberately not the same thing, which is the one place in this app where that is
true.

**And that list has to be exhaustive rather than nearly so, because a sheet is
exactly one page.** The page box has no margin, so any ink above the first sheet
takes a page of its own and pushes every sheet down by one. **This is not a
hypothetical**: the heading was left out of the print rule and the first print
put it alone on page one. A design adding anything to this screen — a caption, a
back link, a count — has to put it on the screen side of that line.
