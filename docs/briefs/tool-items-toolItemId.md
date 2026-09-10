# Tool item detail

Route: `/tool-items/[toolItemId]`
Who reaches it: anyone signed in, with no Role and no Job scoping (#337).
Which width comes first: **phone**. Both widths must work; this one is
drawn first and the desktop is what it opens out into.

## What it answers

Which tool is this one, where is it, and what has happened to it?

**This is the only screen in the app a machine opens.** A QR code on a sticker
glued to the tool carries this address, and a phone camera is what will follow
it. Nothing else here is reached that way — every other detail screen is reached
from a list — and two things follow for a design.

**The reader is holding the object.** They are on a site, probably in gloves,
looking at a drill and at a phone. They already know which tool they scanned;
what they came for is where it is supposed to be and what has happened to it.

**The label does not carry this address, and that is what lets this one be
readable.** A QR encodes the whole URL, so the printed address is a short route
of its own, `/t/[toolItemId]`, which redirects here and has a brief of its own.
This page took the name its collection gives it once that separation existed
(#348). The printed address is what may not move; this one may.

**The id is also printed in characters a person can read**, for a symbol that
has been scratched or painted over, so the second way here is somebody typing
it. Case does not matter when they do; the page then moves itself to the
canonical form of the address, so one tool item keeps one address.

## What it always carries

**identity.** The `Tool Item ID` as the heading, and nothing else as a heading —
the shape the four document detail screens already take. Here it is also the
string printed on the label in the reader's hand, which is what lets them
confirm they scanned the right thing.

**verdict.** Where the tool item is: its status, one of `In Stock`, `Out` or
`Retired`. This is what the reader came for.

**evidence.** The tool it is one of, and the job it is on. Both are single
values, never lists — a tool item is one unit of one tool and sits on one job.

**evidence.** The QR symbol this tool item's label carries, **drawn at the size it
prints at**, with a line saying so.

**Why it is here decides how big it is.** It is here so a reader can SEE what a
replacement sticker will carry and match it against the one in their hand — not to
be scanned off the screen. Somebody who typed the id because the sticker had worn
through has already arrived, so a scan of the screen would do nothing they need;
the scan that does work is a later phase's. **So the symbol has no legibility
floor of its own** and no size was invented for it: it is drawn at the printed
size because that is a fact worth carrying, not a style.

**That equality is a distinction rather than a look.** Drawn larger it stops being
a preview of the physical object, which is the whole reason it is on this screen.
A design may change how it is presented and where it sits; if it changes the size,
the line saying it is printed size has to go with it.

**action.** A control that reprints this label. It leads to the label sheet
screen carrying this one tool item, rather than printing from here — that screen
owns the sheet layout and the position on the sheet to start at, and **a reprint
is the archetypal part-used sheet**, so printing from here would mean either
losing that control or building a second one.

**evidence.** A history section, one entry per `Tool Log` row, **oldest first**.
Each entry carries four facts that are always there — the event, when it
happened, the job it happened on, and who recorded it — and a fifth, notes, that
is usually absent.

**How the instant is rendered is open, and it is the one fact on the page with
no rendering chosen yet.** The screen currently prints the stored value, which
is a full UTC timestamp to the millisecond — the longest and only
machine-shaped string here. What the entry carries is a moment; how much of it a
reader on a site needs, and in whose timezone, is a decision this screen has not
made. The request detail's history, the only other one in the app, renders its
own moments as a local date and time to the minute.

## What it carries only sometimes

**A note on a history entry.** Absent in the ordinary case: a registration
carries none. It is omitted rather than drawn empty, so a design must not
reserve room for one on every entry.

**When the tool item has no history at all:** one sentence in place of the
entries, opening
`Nothing has been recorded against this tool item` and going on to say that
nothing holds when it came into existence. **This is reachable and is not an
error state.** Registration writes the tool item and then its first log row, and
a failure between the two leaves exactly this; the row is sound, with its id,
its status and its job. There is no repair, because a log row written later
would state a time that is not when the tool item was created.

**When no tool item carries the id in the address:** the screen is the heading
`Tool item not found` and a way back to `/tools`. Nothing on this axis is scoped
by role or job, so unlike the request, order and invoice screens this refusal
answers one state — no such tool item — rather than standing in for two. **The
symbol and the reprint control are absent here rather than empty**, and there is
no state in between: a symbol is a pure function of the id, so every tool item
that exists has one.

**There is no such thing as a tool item whose label is missing**, which is worth
saying because it looks like a state and is not. What can be missing is a printed
sticker on the object, and the app does not record whether one was ever printed or
stuck on — so the screen cannot say "no label yet" and must not imply it. Every
tool item's symbol is always available; whether it is on the drill is what the
person holding it can see.

## What must agree elsewhere

**The four facts on a history entry are invariants of the base, not choices.**
The event is one of a closed set of four; the job is on every row and is never
blank; who recorded it is written on every path that appends a row. A design
that hides one is hiding a defect upstream rather than simplifying a row.

**A repeated job down the history is the normal reading.** A tool item that has
never left its job carries the same job on every entry. That the column has no
blanks is what makes the previous entry's job readable as the previous job,
which is why nothing stores a former job — collapsing the repetition would take
that away.

**The status shown here is the same value the tool list counts.** It is
maintained by the app rather than computed on this screen, so this page and
the two list screens cannot disagree about where a tool item is.

**`Tool` and `tool item` are the two nouns, and they are not interchangeable.**
A `Tools` row is a tool — the kind, the name somebody typed once. A `Tool Items`
row is a tool item — this object, with this printed id. Six of one drill is one
tool and six tool items. Never a bare `item`: four other tables on this base
hold item rows.

**The symbol here and a symbol on the sheet are the same object at the same size,
and that is measured rather than intended.** Both screens read one module size
derived from the label stock and multiply it by the side count that symbol
actually came out at, so a longer address makes a bigger symbol on both rather
than a denser one on either. A design that pins this one to a box in pixels
breaks the equality, and nothing on screen would show it.

**This screen prints nothing itself.** Its reprint control is a link. That is what
keeps a replacement the same physical object as the original by construction —
there is no second layout to drift from the sheet's.

**There are three ways in and only one of them survives a reload.** A scan of the
label is the first, arriving through the short route that redirects here; the
registration form's answer is the second, and each id it names links here, but
that list is gone once the page is; the third is the tool list, where a tool
opens its own screen and that screen lists every tool item under it with a link
to this one (#339).
