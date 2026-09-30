# Print tool labels

Route: `/tool-items/labels`
Who reaches it: anyone signed in, with no Role and no Job scoping (#337). No tool
item is one reader's rather than another's.
Which width comes first: **desktop**. This screen is used at whatever machine the
printer is attached to, which `docs/notes/tools.md` settled for the whole label
step. Both widths must work; this one is drawn first.

## What it answers

We created some tools and now they need stickers. Put their QR labels onto a
sheet of adhesive stock and print it.

**A tool item with no label is a row nothing can reach.** The QR symbol is the
only way a phone gets from a physical drill to its record, so this screen is the
last step of registration rather than a convenience — and it is why a
registration lands on its tool's own screen with what it wrote selected, one
press of that screen's print control from here (#449). Until then the
registration's own answer linked straight here.

**The screen exists because paper is not a screen.** What it draws is a sheet at
its true printed size, and the whole point of every dimension on it is that the
ink lands inside a die-cut rectangle somebody peels off. That makes it the one
screen in this app whose correctness is physical.

## What it always carries

**identity.** The heading, `Print tool labels`.

**evidence.** Two facts about the run, both screen-only and never printed:

- **Which stock**, by its label size. **No product has these dimensions**, so the
  line states the geometry a supplier would be asked for rather than a name
  (#412); when a real stock is bought, its name is what belongs there.
- **How many labels across how many sheets**, once a selection exists.

**The host each symbol will encode is not stated (#454).** It was the first of
three facts here. A symbol carries the host it was printed from, so a sheet
printed on a preview domain is thirty stickers pointing somewhere that will stop
resolving, and the screen spelled the host out with a warning saying so. **The
warning was not conditional** — nothing in the app knows which host is the
permanent one — so on the host the app keeps it would be false above every
sheet, and #454 took it off with the host above it. What the two guarded is a
rule kept outside this screen.

**THE WARNING WAS THE ONLY DEFENSE LEFT AFTER #411, AND IT WAS WRITTEN TO BE READ
AT THE MOMENT OF PRESSING PRINT.** Until that issue a symbol built on a dev host
came out a version larger than a real one, so a wrong host was visible in the
picture itself; the shortened address put both at version 2, and nothing about
the sheet looks different when the host is wrong. Measured at 1440x900 with three
labels, the warning sat 240px above the print control and both were on screen at
once, but the picker grows one row per label between them, so a run of thirty put
the control below the fold and a run of a hundred put it 2,600px down. #412's
smaller label left those figures unchanged, since the picker's rows are text and
a smaller sticker needs fewer sheets rather than fewer rows. So this said a design
had to keep the host and the warning legible from wherever Print is pressed, and
never treat them as a preamble read once on the way in, until #454 took both off.
**#453 put a refusal back for the long hosts**: the label holds no room for a
symbol larger than today's, so a Vercel domain's symbols do not fit and no sheet
is drawn there at all. A host short enough to stay at today's size — a local
server's is one — still looks exactly like the real one, and nothing on the
screen says which host it is.

**action.** Three controls:

- **A per-label include**, one for every tool item the address named, all included
  to begin with. Excluding one takes it out of the sheet rather than leaving a
  blank in its place, so a run stays contiguous. **There is no select-all and no
  select-none, and their absence is a decision rather than an omission**: every
  label starts included, so select-all named the state the screen already opens
  in, and select-none reached only the state the screen refuses to print from. A
  run is a handful, so unchecking one or two is the whole interaction — **a design
  should not add a bulk control back without a reader who needs one.** From a
  tool's own page the address names only what was selected there (#443), and this
  is the one place that whole run is listed together before the paper is spent.
- **The first label position on the sheet**, 1 to however many a sheet holds —
  143 today, and a figure a design must read rather than assume. **This is for a
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
pointing at a tool's own page, which is where a run is selected — `Nothing was
named to print. Open this from a tool's own page.` It named a registration's
answer as well until #449, which stopped a registration opening this screen. No
empty sheet and no controls. It said `No tool item was named` until #455; the
design's noun is `tool`, and a first `tool` meaning one of a tool's tools would
stand for two things in a sentence that goes on to name the tool.

**When none of the named ids is on the base:** the heading and one sentence
saying none exists, `None of those tools exists.` This is reachable by
hand-typing an address.

**When some of them are not on the base:** those ids are named in a sentence of
their own and no label is offered for them. **They are not folded into the
sheet** — a label that cannot be printed is a different state from one that can,
and printing a short sheet in silence would leave somebody counting stickers to
find out.

**When more ids were named than one request prints:** a sentence saying how many
were named, that this prints 100 at a time, and that the first 100 are below. The
cap is the largest registration's cap and the two are one number, and a tool's own
page refuses to send a larger selection than this prints (#443), so nothing the
app itself produces can reach this.

**When nothing is selected:** a sentence saying there is nothing to print, and the
print control does not act.

**When the run does not fit one sheet:** more than one sheet is drawn, and each
one prints on its own page. Blanks held open by the start position appear only on
the first — a run that spills starts at the top of the next sheet. A sheet holds
more labels than one request prints, so this is reached from a start position
past 44 and not by the size of the run alone.

## What must agree elsewhere

**The stock's dimensions are not chosen yet and live in one place.** No printer
has been confirmed at the site, so no adhesive stock has been bought. When the
real stock arrives, one constant changes and this screen's layout is not
reopened. **A design must not assume a particular number of labels or a
particular label size** — it should assume a grid whose dimensions come from
somewhere else.

**The label is 15.2 mm wide by 17.32 mm tall and it is sized from the symbol,
not from a product (#412, #431, #453).** It was 66.7 by 25.4 mm, which was a
real adhesive sheet picked when nothing had been printed. A wrench or a
screwdriver has no flat run that wide, so the module and the readable code went
to their floors and the label is what came out of the arithmetic. **143 fit a
Letter sheet**, 11 across and 13 down, and that count is computed from the page,
the margin, the label and the gap rather than typed — a design must not assume
it. **The height is the symbol and one line of code at 6 pt, which is 2.1167
mm**: drawn with the code at 2.0 mm the label comes to 17.2 mm, and that label
does not carry the code at its floor.

**The narrow side is 15.2 mm and it is the dimension that decides whether the
sticker goes on.** A label wraps along a handle, so the narrow side has to clear
the handle's width and the long side runs down a tool that is far longer than
17 mm. **A wrench handle is roughly 15 to 20 mm**, so this label goes on nearly
all of that range and **not on the very narrow end of it: at 15 mm it does not
fit, and nothing available to this app makes it fit.** The three things that
could be smaller are all fixed from outside: the symbol's four-module quiet zone
is the QR specification's, the 1 mm safe inset is the allowance for a die-cut
that is not perfectly placed and a sheet that does not feed perfectly straight,
and the 0.4 mm module is a quoted camera limit this app cannot measure its way
past. **So a tool with a handle narrower than about 15.2 mm has no label yet,
and that is a stated limit rather than an oversight.** It was about 17 mm until
#453 took away the room the label kept for a larger symbol.

**The code sits under the symbol (#431), and the order is part of the
geometry.** The symbol is wider than the code at its floor, so the narrow side
is the symbol's alone either way. Beside the symbol, the long side was the
symbol and ten characters, 30.3 mm, and a sheet held 78; under it, the long side
is the symbol and one line of code, 17.32 mm, and a sheet holds 143. What kept
the code beside the symbol was the tool's name, which sat in height the symbol
had already paid for — and the label no longer carries the name. **So the code
above the symbol, or beside it again, is a different label rather than a
restyling of this one**, with different dimensions and a different count.

**Nothing separates the symbol from the code but the quiet zone the symbol
already carries (#453).** That margin is the one the QR specification asks for,
and the symbol's box includes it, so the code's ink sits 1.83 mm below the
nearest dark module where the specification asks for 1.6. The 1.5 mm gap the
label used to carry on top of it had no source, and this design drew none.
**A gap is the design's to add**, and it makes the label taller by its own
height: up to 0.78 mm keeps 13 rows on a sheet, and from there to 2.46 mm the
sheet holds 12 rows, 132 labels.

**The symbol is sized in modules, never in millimeters.** A QR symbol's side grows
four modules per version as the address it encodes gets longer. So the printed
size is a fixed millimeters PER MODULE, which makes a longer address a bigger
symbol rather than a denser one — and since #453 a bigger symbol is one the
label has no room for, so the screen says so instead of drawing it thinner.
**A design that pins the symbol to a box in millimeters would undo this**, and
the failure is invisible on screen: it only shows up as a symbol a phone cannot
read.

**The readable code has a floor and no ceiling.** Its minimum size is a functional
constraint — it is the fallback path when the symbol is unreadable — and it is
set in code, at 6 pt. **Everything above that floor is the design's**, and the
cost of going above it is now fixed: the code's line is the one thing the
label's height is built from besides the symbol, so a larger code makes the
label taller by the same amount, and wider as well past about 7.5 pt, where ten
characters outgrow the symbol. It renders at the floor, which is the size the
design kept when it chose the face.

**The code is set in Inconsolata, and the face is part of the label's
arithmetic (#431).** The design chose it. The label's width budget is that
face's measured advance — half its size per character — so a different face is
a different number. **Changing the face is the design's to do and it reopens
that figure**; what the label has room for without changing size is a face up
to about 0.62 of its size per character, ten characters under the widest symbol.
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
supports rather than as small as it goes. **A sheet printed from a local server
is that sheet (#453)**: its address is today's size at the same geometry, so a
phone decodes its symbols even though it cannot open the address, and the code
is read off the same paper. That a Vercel domain draws no sheet does not mean
the measurement has become impossible.

**Nothing is left over for the symbol, and next to nothing under the code (#412,
#431, #453).** The widest symbol the label takes is today's, 13.2 mm against
13.2 mm of printable width, and the code's line takes the height left under it
to within 0.003 mm. The one room on the label is beside the code: ten
characters at the floor take 10.58 mm of the 13.2 mm under the symbol. **A
design adding anything to the label has to take it from something already
there**, and the two things it may not take it from are the symbol's quiet zone
and the code's floor.

**The label absorbs no symbol version above today's (#453).** A QR symbol grows
four modules a side as the address it encodes gets longer; the module cannot
shrink to absorb that, because it is already at its floor, and the label no
longer keeps room for a bigger one. **So the host's length decides whether a
label prints**: a host of up to seventeen characters gives today's symbol — at
exactly seventeen, only while a day's tool items stay under a thousand — and a
longer one, which a Vercel domain is, gives a symbol the screen names instead of
drawing, in a sentence that points at the host. A design must keep that sentence
where Print is pressed. **It is also why the host a label carries is settled
before the first sheet is printed**: a permanent host past seventeen characters
puts that room back, and the label grows 1.6 mm each way with it.

**The screen words are the design's (#455).** A `Tools` row is a tool, and a
`Tool Items` row — which this brief calls a tool item — is a `tool` in any
sentence about one, as in `None of those tools exists.`, and never a `tool item`
on screen. The same words govern `/tools`, the registration dialog over it, the
tool's own screen, where the tools under one are counted as `items`, and the tool
item's. This said
the pair was `tool` and `tool item` and never a bare `item`, which the design
reversed.

**Two screens open this one and their words come from here**, so the controls on
a tool's own page and on a tool item's own page cannot drift from the screen they
open. That is the arrangement the registration dialog has with the controls that
open it, which was `/tools`' control on `/tools/new` until #456. This
said two until #443, which counted the tool item's, added in #352; it said three
until #449, which moved a registration's run onto the tool's own page — the
registration lands there with what it wrote selected, and that page's control is
how its labels are printed.

**A tool's page sends what its list has selected (#443)** — this screen's own
parameter with its own values, in the list's order — and its control says only
`Print labels`, because the boxes on that page show the range. It sent the page
it was showing until then. Its page box still selects a page at a time, so a page
fits inside the hundred this screen prints at once, and that screen refuses a
selection larger than that rather than sending one whose tail this would drop.
**A design offering "select all of this tool" there would be asking for a read
that screen divided on purpose.** Excluding a label here trims this sheet and
does not reach back into that selection.

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
