# Print labels

Opens from: `/tools/[toolRecordId]` and `/tool-items/[toolItemId]`, as a dialog
over the page that opens it — it was the page `/tool-items/labels` until #457.
Who reaches it: anyone signed in who is on either page, with no Role and no Job
scoping (#337). No tool item is one reader's rather than another's.
Which width comes first: **desktop**. This dialog is used at whatever machine the
printer is attached to, which `docs/notes/tools.md` settled for the whole label
step. Both widths must work; this one is drawn first.

## What it answers

We created some tools and now they need stickers. Print their QR labels on the
label printer's tape, one label to a page.

**A tool item with no label is a row nothing can reach.** The QR symbol is the
only way a phone gets from a physical drill to its record, so this dialog is the
last step of registration rather than a convenience — and it is why a
registration lands on its tool's own screen with what it wrote selected, one
press of that screen's print control from here (#449). Until then the
registration's own answer linked straight here.

**The dialog exists because paper is not a screen.** What it prints is each
label at its true size, a page each — it draws them at twice that (#457) — and
the whole point of every dimension on it is that the ink lands inside the length
of tape the printer cuts off. That makes it the one surface in this app whose
correctness is physical.

## What it always carries

**identity.** The title — `Print labels` from a tool's page and `Print label`
from a tool item's, the word each page's control says — and under it the tool's
name. It was the heading `Print tool labels` until #457.

**evidence.** Two facts about the run on one line, both screen-only and never
printed:

- **How many labels**, one to a page — `4 labels`, or `3 of 5 labels` when some
  of what was named does not print — which is the page count the print dialog
  has to agree with. It was `4 labels, one to a page.` until #457, and it counted
  the sheets they took until #467.
- **Which stock**, by the label's size: `11 × 12 mm`. The length of tape a label
  takes is the page's, so the tape is the one thing a person loading the printer
  has to get right (#467). It was `Stock: 12 mm tape` until #457, and it named a
  die-cut's two dimensions while the stock was a sheet no product matched (#412).

**The host each symbol will encode is not stated (#454).** It was the first of
three facts here. A symbol carries the host it was printed from, so a run
printed on a preview domain is every sticker in it pointing somewhere that will
stop resolving, and the screen spelled the host out with a warning saying so.
**The warning was not conditional** — nothing in the app knows which host is the
permanent one — so on the host the app keeps it would be false above every
sheet, and #454 took it off with the host above it. What the two guarded is a
rule kept outside this dialog.

**THE WARNING WAS THE ONLY DEFENSE LEFT AFTER #411, AND IT WAS WRITTEN TO BE READ
AT THE MOMENT OF PRESSING PRINT.** Until that issue a symbol built on a dev host
came out a version larger than a real one, so a wrong host was visible in the
picture itself; the shortened address put both at version 2, and nothing about
a label looks different when the host is wrong. Measured at 1440x900 with three
labels, the warning sat 240px above the print control and both were on screen at
once, but the picker grows one row per label between them, so a run of thirty put
the control below the fold and a run of a hundred put it 2,600px down. #412's
smaller label left those figures unchanged, since the picker's rows are text and
a smaller sticker needs fewer sheets rather than fewer rows. So this said a design
had to keep the host and the warning legible from wherever Print is pressed, and
never treat them as a preamble read once on the way in, until #454 took both off.
**#453 put a refusal back for the long hosts**: the label holds no room for a
symbol larger than today's, so a Vercel domain's symbols do not fit and no label
is drawn there at all. A host short enough to stay at today's size — a local
server's is one — still looks exactly like the real one, and nothing on the
screen says which host it is.

**action.** Two controls, `Cancel` and the commitment — `Print 4 labels`,
counting what prints, and the title's words drawn disabled when nothing does
(0f). Above them, while anything prints, the two steps the browser's own print
dialog needs: `Choose your label printer.` and `Keep scale at 100%.` The screen
had three controls until #467, and two until #457:

- **A per-label include went with the screen (#457).** It was one for every tool
  item the address named, all included to begin with, and excluding one took its
  page out of the run rather than printing it blank. There was no select-all and
  no select-none, since every label started included. The run is now what a
  tool's page has selected (#443), so that page's boxes are where a label is left
  out, and the one place the whole run is listed before the tape is spent is the
  dialog's pane.
- **The first label position on the sheet went with the sheet (#467).** It took
  1 to however many a sheet held, for a part-used sheet, which was the ordinary
  case rather than an edge: a registration is usually a handful of tools, so
  printing always from the top would have thrown away most of a sheet every time.
  A label printer cuts after every page, so no run is ever printed into one
  somebody has already peeled from.

**the labels.** One page per label, each the label's own size — one page-sized
box per sheet, with each label placed at its stock's own corner, until #467. Each
label carries two things, the symbol and the code under it, and the reasons are
not the same:

- **The QR symbol**, in a box that is its full size including the four modules of
  quiet zone the SVG carries. **Nothing may be drawn inside that box.** The margin
  is what lets a camera separate the symbol from everything printed beside it.
- **The printed code, in characters a person can read, under the symbol.** This
  is the fallback for a symbol that has been scratched or painted over, so it is
  not decoration and it may not be truncated. Its size has a floor and its face
  is part of the label's arithmetic; see below.

**The tool's name is not on the label (#431).** The design dropped it. The
picker above the labels named each tool item by its tool until #457, because that
was a screen naming a record and the person choosing labels chose by it; the
dialog names the opening page's tool under its title, and the sticker carries the
code alone.

**The printed code is not the whole `Tool Item ID`, and the difference is the
point (#411).** A tool item is `HYE-TL-260909-004` in the base and on every
screen; the sticker carries `260909-004`. The seven characters dropped are on
every tool item and separate none of them, so they cost the symbol its headroom
and the label its width while confirming nothing. **A design must not put them
back.** The picker named each tool item by the whole id until #457, a screen
naming a record above a sticker a person reads in order to type; the dialog has
no picker, and it names a code it did not find in the sticker's form,
`260909-098`, as 1i draws it.

## What it carries only sometimes

**When nothing is selected, the dialog does not open:** a tool's page draws its
control disabled with the reason beside it, `Nothing is selected, so there is
nothing to print.` Until #457 the screen said `Nothing was named to print. Open
this from a tool's own page.` to an address that named no tool item, pointing at
the page where a run is selected. It named a registration's answer as well until
#449, which stopped a registration opening this screen. It said `No tool item was
named` until #455; the design's noun is `tool`, and a first `tool` meaning one of
a tool's tools would stand for two things in a sentence that goes on to name the
tool.

**When none of the named ids is on the base:** `No labels to print.` in the pane,
`0 of 3 labels`, the codes under `3 codes not found`, no steps, and the commitment
drawn disabled. This is reachable by hand-typing a tool's address. It was the
heading and `None of those tools exists.` until #457.

**When some of them are not on the base:** those codes are listed under how many
— `2 codes not found` — and no label is drawn for them. **They are not folded
into the run** — a label that cannot be printed is a different state from one
that can, and printing a short run in silence would leave somebody counting
stickers to find out.

**When the host is too long for the symbols (#453):** the shape of a run with
nothing on record, with one sentence about the host where the codes not found
stand. 1i draws no such state.

**When more ids are selected than one print takes, the dialog does not open:** a
tool's page refuses the selection, `101 selected, and one print takes at most
100.` (#443), and the read behind the dialog throws on a longer run, which
nothing the app draws can send. The screen printed the first 100 of a longer
address and said so until #457. The cap is the largest registration's cap and the
two are one number.

**When the run did not fit one sheet**, until #467: more than one sheet was
drawn, each on its own page, and blanks held open by the start position appeared
only on the first. That state went with the sheet — every label is a page of its
own, so a run of any size is that many pages and nothing on the screen changes
with its length.

## What must agree elsewhere

**The stock's dimensions live in one place, and since #467 they are two.** The
labels print on a label printer that takes 12 mm tape and cuts after every page,
so the stock is the tape's width and the length of tape one label takes, and
every other dimension is derived from those and the floors. Until then no
printer had been confirmed at the site and the stock was a sheet nobody had
bought. **A design must not assume a particular label size** — it should take
the label's dimensions from where they live, as it took the grid's.

**The label is 11 mm wide by 12 mm tall: the length of tape a label takes
across, and the tape's width down (#467).** The symbol and the code are at their
floors, and what the tape leaves is margin — 0.6488 mm above and below, 0.715 mm
either side. **The label a print proved was 10.87 mm across with 0.65 mm on all
four sides**; 11 mm is a round length for the cut, and the extra went to the
side margins alone. Before it, the label was sized from the symbol to fit a
sheet — 15.2 by 17.32 mm and 143 to a Letter sheet by #453 — and before #412 it
was 66.7 by 25.4 mm, a real adhesive sheet picked when nothing had been printed.

**The narrow side is 11 mm and it is the dimension that decides whether the
sticker goes on.** A label wraps along a handle, so the narrow side has to clear
the handle's width and the long side runs down a tool that is far longer than
12 mm. **A wrench handle is roughly 15 to 20 mm**, so this label goes on all of
that range (#467). On a sheet it did not: the narrow side was 15.2 mm from #453
and about 17 mm before, so a handle narrower than that had no label, and the
three things that could have been smaller were fixed from outside — the symbol's
four-module quiet zone, the specification's; a 1 mm safe inset for a die-cut not
perfectly placed; and a 0.4 mm module quoted rather than measured. On tape the
inset went with the die-cut and the module is the 0.29 mm a print proved.

**The code sits under the symbol (#431), and the order is part of the
geometry.** On tape the two stack across the tape's width: the symbol, the
code's ink and the margins above and below them are its 12 mm (#467). On a sheet,
beside the symbol, the long side was the symbol and ten characters, 30.3 mm, and
a sheet held 78; under it, the symbol and one line of code, 17.32 mm, and a
sheet held 143. What kept the code beside the symbol was the tool's name, which
sat in height the symbol had already paid for — and the label no longer carries
the name. **So the code above the symbol, or beside it again, is a different
label rather than a restyling of this one**, with different dimensions.

**Nothing separates the symbol from the code but the quiet zone the symbol
already carries (#453).** That margin is the one the QR specification asks for,
and the symbol's box includes it, so the code's ink starts 1.16 mm below the
nearest dark module, which is what the specification asks for at 0.29 mm a
module (#467). The 1.5 mm gap the label used to carry on top of it had no
source, and this design drew none. **A gap is the design's to add**, and on tape
it takes its height out of the margins above and below, which no print has had
thinner than 0.65 mm. On a sheet it made the label taller by its own height.

**The symbol is sized in modules, never in millimeters.** A QR symbol's side grows
four modules per version as the address it encodes gets longer. So the printed
size is a fixed millimeters PER MODULE, which makes a longer address a bigger
symbol rather than a denser one — and since #453 a bigger symbol is one the
label has no room for, so the dialog says so instead of drawing it thinner.
**A design that pins the symbol to a box in millimeters would undo this**, and
the failure is invisible on screen: it only shows up as a symbol a phone cannot
read.

**The readable code has a floor and no ceiling.** Its minimum size is a functional
constraint — it is the fallback path when the symbol is unreadable — and it is
set in code, at 5 pt (#467). **Everything above that floor is the design's**,
and the cost of going above it is now fixed: on tape the label's height is the
tape's, so a larger code takes its height out of the margins above and below,
and past about 5.4 pt ten characters outgrow the symbol and take from the side
margins too. It renders at the floor, which is the size the print proved.

**The code is set in Inconsolata, and the face is part of the label's
arithmetic (#431).** The design chose it. The label's width budget is that
face's measured advance — half its size per character — so a different face is
a different number. **Changing the face is the design's to do and it reopens
that figure**; what the label has room for without changing size is a face up
to about 0.54 of its size per character, ten characters under the widest symbol.
The face reaches the printed code and nothing else in this dialog.

**Both floors are measured since #467, where they were quoted figures (#412).**
The module's 0.29 mm and the code's 5 pt are a label this printer printed and a
phone read, 10.87 mm across with 0.65 mm on every side; on the office printer a
0.273 mm module and a 5.1 pt code read as well, and are recorded rather than
used. The code's is a font size, stated in points. They were 0.4 mm — the
practical minimum published for a phone camera resolving a printed module — and
6 pt, the size print convention holds as the smallest legible, which was 2.0 mm
until #431; and 0.57 mm and 2.5 mm before #412, set for a label read at arm's
length where this one is read in the hand. **A label printed from a local server
is today's label at the same geometry**, so a phone decoding it is a reading of
both floors though it cannot open the address, and that a Vercel domain draws no
label does not mean the measurement has become impossible.

**What is left over is margin (#467).** The widest symbol the label takes is
today's, 9.57 mm, and with the code's ink, 1.13 mm, it takes all of the tape's
12 mm but 0.6488 mm above and below; 11 mm leaves 0.715 mm either side of the
symbol, and ten characters at the floor take 8.82 mm of the 9.57 mm under it.
On a sheet nothing was left over for the symbol and next to nothing under the
code (#412, #431, #453). **A design adding anything to the label has to take it
from something already there**, and the two things it may not take it from are
the symbol's quiet zone and the code's floor.

**The label absorbs no symbol version above today's (#453).** A QR symbol grows
four modules a side as the address it encodes gets longer; the module cannot
shrink to absorb that, because it is already at its floor, and the label no
longer keeps room for a bigger one. **So the host's length decides whether a
label prints**: a host of up to seventeen characters gives today's symbol — at
exactly seventeen, only while a day's tool items stay under a thousand — and a
longer one, which a Vercel domain is, gives a symbol the dialog draws no page for,
saying so in a sentence that points at the host. A design must keep that sentence
where Print is pressed. **It is also why the host a label carries is settled
before the first label is printed**: it is `app.hyeusa.com`, fourteen characters,
which leaves three, and a permanent host past seventeen would build a symbol the
tape has no room for.

**The screen words are the design's (#455).** A `Tools` row is a tool, and a
`Tool Items` row — which this brief calls a tool item — is a `tool` in any
sentence about one, and never a `tool item` on screen. The dialog's sentences
name labels and codes; `None of those tools exists.` was this screen's until
#457. The same words govern `/tools`, the registration dialog over it, the
tool's own screen, where the tools under one are counted as `items`, and the tool
item's. This said
the pair was `tool` and `tool item` and never a bare `item`, which the design
reversed.

**Two pages open this dialog and their words come from here** — `Print labels`
and `Print label` — so the controls on a tool's own page and on a tool item's own
page cannot drift from the dialog they open. That is the arrangement the registration dialog has with the controls that
open it, which was `/tools`' control on `/tools/new` until #456. This
said two until #443, which counted the tool item's, added in #352; it said three
until #449, which moved a registration's run onto the tool's own page — the
registration lands there with what it wrote selected, and that page's control is
how its labels are printed.

**A tool's page opens this on what its list has selected (#443)**, in the list's
order, and its control says only `Print labels`, because the boxes on that page
show the range. The selection went on this screen's address as its own parameter
until #457, and the page it was showing went there before #443. Its page box
still selects a page at a time, so a page fits inside the hundred one print
takes, and that page refuses a selection larger than that rather than opening a
run whose tail would not print. **A design offering "select all of this tool"
there would be asking for a read that page divided on purpose.**

**Each label is drawn at twice its printed size and printed at its own
(#457)** — 1i's 22 × 24 mm on screen, by a zoom the print takes back to 1, so
nothing inside a label moves between the two. At a 375px width the dialog stacks
— the head, the pane, then the rest — and two labels fit across the pane with
nothing scrolling sideways, measured. Until then each was drawn at its true size,
11 mm across, about 42 px, which fitted a phone as well. While a sheet was drawn
the page scrolled sideways, since a US Letter sheet is 215.9 mm across and
drawing it smaller would have stopped it being a preview of what comes out; how
that narrow case read was left open, and no dimension forces the question now.

**Nothing on the paper is a screen affordance.** The dialog's head, everything
beside the pane — the count, the codes, the steps and the controls — its backdrop
and the page behind it are hidden at print (#457), as the screen's heading,
picker, print button and every sentence about the run were. What a reader sees
on screen and what comes out of the printer are deliberately not the same thing,
which is the one place in this app where that is true.

**And what prints has to be the pages and nothing else, because a label is
exactly one page** — a sheet was, until #467. The page box has no margin, so any
ink above the first label takes a page of its own and pushes every label down by
one. **This is not a
hypothetical**: the heading was left out of the screen's print rule and the first
print put it alone on page one. Since #457 the rule keeps the pages and hides
everything else, so what can still reach the paper is something added inside the
pane beside a label. A design adding a caption, a page number or a count there
has to put it on the screen side of that line.
