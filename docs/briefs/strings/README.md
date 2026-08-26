# Screen strings

**Two files and a tool, and no per-screen inventory (#288).**

- `scripts/screen-strings.mjs` — produces every string each screen renders, on
  demand, with the file, the line and the shape it sits in.
- `unfindable.md` — what the tool cannot produce, grouped by the shape that hides it,
  with the test for whether a shape can be closed.
- `unreachable.md` — text the app holds that no reader can reach, by screen. A sweep
  does not need to reword it and a design must not draw room for it.

## Why there is no file per screen

**#288 built that first, and then measured it.** One inventory per screen: every
string, the condition that renders it, the file and line, the table its noun points
at, and whether a brief quotes it or `offline/screen-briefs.mjs` pins it. Five
screens came to **218 entries in 1,861 lines**. Three measurements against those five
files are why the other sixteen were never written.

**Of 218 entries, 40 carried a word the vocabulary work is deciding.** The test was
whether the string contains `item`, `charge`, `line` or `ordered item`, or whether its
`names` field points at a table. Those turned out not to be two tests: every one of
the 40 also had a table, and 162 had a table without carrying a word. So the entries
that feed a naming decision were **18% of the file**, and across all twenty-one
screens the whole input to the `item`-against-`charge` question is **109 of 1,337
strings** — four of which say both words in one sentence.

**Of 194 conditions, 127 gave a reader nothing the brief already said.** 65%, and the
overlap rose with the brief's length: `/invoices` was 85% duplicated. Of the 67 that
were new, 28 were facts a design genuinely needs — including that `/invoices/new` is
two tabs, which no brief had said — and 26 were refusals no reader can reach, which a
brief must not list at all. The 28 went into the briefs. The rest went.

**Of the four fields per entry, three were derivable from the code.** The string
itself, the file and line, and what quotes or pins it are all things a script
computes — and one did, correcting 37 `held:` lines mechanically, some of which had
been wrong since they were written. Only `names`, which table a noun points at, was a
judgment. One field of four.

**And the shape was a snapshot in front of a sweep.** Twenty-one screens on that
format extrapolated to about 6,000 lines, which a vocabulary sweep would then make
stale in the same pass that used it: the strings change, the line numbers move, and
`--check` reports the drift without repairing it. Write 6,000 lines, sweep, write
6,000 lines again.

**One of five sweeps would have been helped.** #227's bulk was identifiers — `line`
alone was 134 `poLine` uses and about 400 bare ones, and of `shipment`'s 322 uses
exactly **two** were strings a reader sees. #269 changed no screen, no constant and no
identifier: what was missing was a rule. #274's trigger was a false premise in #227's
own reasoning, and the evidence against it was on the Airtable base. #280 is a table
rename whose whole screen surface is **11 strings**, all of which this tool finds.
Only #254's `item`-against-`charge` finding wanted a list of strings — and it wanted
109 of them, not 6,000 lines.

## How to make a naming decision

**Filter, judge, sweep, re-filter — one act, with no document in the middle to go
stale.**

Run the extractor over every screen and keep the strings carrying the word in
question. Today that is 109 strings for `item` / `charge` / `line`, of which 81 say
`item`, 21 say `charge` and 11 say `line`; the four that say both `item` and `charge`
in one sentence are on `/invoices/new` and `/prs`, and they are where the decision
actually bites.

```
node scripts/screen-strings.mjs > /tmp/all.txt          # the census, 21 screens
node scripts/screen-strings.mjs /invoices/new           # one screen, with shapes
```

Then, for each string the filter kept, decide which table's row its noun points at —
that is the one judgment no tool makes, and it is made against the strings in front
of you rather than read out of a file somebody wrote weeks earlier. Rewrite, and run
the same filter again: it comes back empty or it does not.

**Read `unfindable.md` before trusting the filter.** Three of the words
`docs/briefs/_shared.md` locks as tier 1 — `Delivered`, `Mismatch`,
`Awaiting delivery` — reach `/invoices` through a constant that screen never names,
so the extractor produces none of them. A sweep that skipped that file would stand on
a list with three locked words missing from it, on the screens where the delivery
axis and the invoicing axis meet.

## What a brief carries and what these files carry

A brief says what a screen **carries** — which facts, at what level, which
distinctions a redesign may not lose — and it is what a designer reads. These files
say what the tool **cannot** say, which is a fact about the tool.

Nothing here records what a screen says, because a re-run does that better: a
document with 1,337 strings in it is stale the first time one is reworded, and the
tool is never stale. What is written down is only what a re-run cannot produce.
