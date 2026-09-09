# Tool item detail

Route: `/tools/[toolItemId]`
Who reaches it: anyone signed in, with no Role and no Job scoping (#337).

## What it answers

Which tool is this one, where is it, and what has happened to it?

**This is the only screen in the app a machine opens.** A QR code on a sticker
glued to the tool carries this address, and a phone camera is what will follow
it. Nothing else here is reached that way — every other detail screen is reached
from a list — and two things follow for a design.

**The reader is holding the object.** They are on a site, probably in gloves,
looking at a drill and at a phone. They already know which tool they scanned;
what they came for is where it is supposed to be and what has happened to it.

**The address is printed and cannot move.** The id in the URL is the id on the
label. A design may do anything with this page except make it live somewhere
else — that would mean reprinting every sticker already on a tool.

**The id is also printed in characters a person can read**, for a symbol that
has been scratched or painted over, so the second way here is somebody typing
it. Case does not matter when they do; the page then moves itself to the
canonical form of the address, so what a sticker carries stays the one address.

## What it always carries

**identity.** The `Tool Item ID` as the heading, and nothing else as a heading —
the shape the four document detail screens already take. Here it is also the
string printed on the label in the reader's hand, which is what lets them
confirm they scanned the right thing.

**verdict.** Where the tool item is: its status, one of `In Stock`, `Out` or
`Retired`. This is what the reader came for.

**evidence.** The tool it is one of, and the job it is on. Both are single
values, never lists — a tool item is one unit of one tool and sits on one job.

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
answers one state — no such tool item — rather than standing in for two.

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

**The status shown here is the same value the tool list shows.** It is
maintained by the app rather than computed on this screen, so this page and
#339's list cannot disagree about where a tool item is.

**`Tool` and `tool item` are the two nouns, and they are not interchangeable.**
A `Tools` row is a tool — the kind, the name somebody typed once. A `Tool Items`
row is a tool item — this object, with this printed id. Six of one drill is one
tool and six tool items. Never a bare `item`: four other tables on this base
hold item rows.

**Until #339 lists them, the registration form's answer is the only way in.**
Each id it names links here. A reader who has lost that page reaches this screen
only by typing the address.
