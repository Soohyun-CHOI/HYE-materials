# Tool detail

Route: `/tools/[toolRecordId]`
Who reaches it: anyone signed in, with no Role and no Job scoping (#337).
Which width comes first: **desktop**. Both widths must work; this one is
drawn first and the phone is what it folds into.

## What it answers

Which units of this tool exist, and where is each of them?

**One row per physical object.** A `Tools` row is a `tool` — the kind, the
name somebody typed once — and each row here is a `tool item`, one drill
with one printed id stuck to it. Six of one drill is one tool and six tool
items.

**It is reached from the tool list and from nowhere else.** The tool item's
own screen is the one a machine opens; this one is opened by a person who
picked a name off a list. So the reader is at a desk as often as on a
site — printing labels, or checking what the company has of something.

**The address is a record id and cannot be read.** `Tools` mints no id, the
way `Vendors` and `Materials` mint none, because nothing prints a tool and
nobody quotes one; the name a person typed is the identity, and a name is
not a path. So the URL carries Airtable's own record id and says nothing a
reader recognizes, which is why the browser tab says only `Tool`.

**These are the only screens in the app used at a phone width** (#336), and
the width container lives in the layout and is empty — no width, no
padding, no type, no color. The screen renders unstyled.

## What it always carries

**identity.** The tool's name as the heading, and no heading word beside
it — the shape the tool item's screen takes with its printed id and the
four document detail screens take with theirs.

**action.** A way back to `/tools`, carrying the same words the tool item's
screen carries for the same trip.

**evidence.** How many tool items this tool has in total. #326 names this
as the fact every list in this app is missing: without it nothing on
screen says whether a reader is looking at everything or at the beginning
of it. **It is a fact about the list rather than about what the company
holds** — which is why a single figure is right here and deliberately
absent from the tool list, where a total would have to decide whether a
retired tool still counts.

**evidence.** One entry per tool item, **oldest first**, each carrying
three facts: its printed `Tool Item ID`, which is the way into that tool
item's own screen; its status, one of `In Stock`, `Out` or `Retired`; and
the job it is on.

**Oldest first is load-bearing rather than a default.** A link array is
creation order and the ids in one registration are contiguous, so oldest
first is also ascending id — the number a person reads off a label.
Newest first would push every row along at each registration, so a link to
a later page would name different tool items tomorrow.

**evidence.** Which page of the list this is, and how many there are —
stated whether or not there is a second page, because a position that
appears only once a list is long leaves the short case saying nothing.

## What it carries only sometimes

**A step to the previous page**, when this is not the first one, and **a
step to the next**, when this is not the last. Each is absent at its own
end rather than drawn and dead, so a tool with one page carries neither.
**A second page is the rare case and the controls should be drawn as
minor:** one purchase is at most fifty tools and usually a single digit,
so most tools have one page and the list is short.

**When the tool has no tool items at all:** one sentence in place of the
entries, `Nothing is recorded under this tool.` and then why that can
happen — a registration writes the tool before it writes the tool items,
so one that failed in between leaves the tool with none. **This is
reachable and is not an error state**, the same way the tool item screen's
missing history is: nothing rolls back, and the row that stands is sound.
The total and the page position are absent with it; there is nothing to
count and no page to be on.

**When no tool carries the record id in the address:** the screen is the
heading `Tool not found` and a way back to `/tools`. Nothing on this axis
is scoped by role or job, so unlike the request, order and invoice screens
this refusal answers one state — no such tool — rather than standing in
for two.

## What must agree elsewhere

**A page holds ten tool items, and how that number is expressed is open.**
This is the first paged list in the app. The screen currently states the
position as a page number out of a count and offers one step in each
direction; whether a reader on a phone is better served by that, by a
count of what is left, or by something else entirely is a decision this
screen has not made. **Ten itself is the part with no measurement behind
it** — everything else on this axis that looks like a number has one, and
nobody has yet held this list on a phone with a real warehouse in it. It
was chosen as a screenful of three short facts at 375px. It is stated here
rather than left in the code because a design cannot re-decide a number it
cannot see; anything up to fifty costs the app exactly the same to fetch.

**The status shown here is the same value the tool list counts.**
`Tool Items."Status"` is maintained by the app rather than computed on
either screen, so this page, the tool list and the tool item's own screen
cannot disagree about where a tool item is.

**Every entry will read `In Stock` until a later phase.** Nothing in the
app writes a `Checked Out`, `Checked In` or `Retired` log row yet —
registration is the only event that exists — so the column holds one
value today. All three are real and a design should draw for three; what
is missing is the screen that produces the other two.

**There is no count per status on this screen, and adding one is not
free.** That question belongs to the tool list one level up. Answering it
here would mean reading every tool item under the tool, which is the cost
the paging exists to avoid — this page reads only the entries it draws,
whatever the tool's size.

**`Tool item` keeps its modifier where `Status` and `Job` do not.** Four
other tables on this base hold item rows, so a bare `item` names four
things; `Status` and `Job` name one field each and are the words the tool
item's own screen already uses for them.

**Every id here links to `/tool-items/[toolItemId]`, and so does the
registration form's answer.** Both point at the same screen; the
difference is that this list survives a reload, which is what the
registration form's list of minted ids does not.

**A tool's name never appears as a path segment**, here or anywhere. The
segment is Airtable's record id: `Tools` mints none, a typed name can hold
any character, and a rename would move the address. This screen stood one
level deeper until #348, when the tool item's own address moved off the
axis and freed the slot.
