# Screen strings — the inventory

**Every string each screen can render, one file per screen (#288).** These sit
beside the briefs because the same document settles the naming decisions and
feeds the design work, and because a brief says what a screen *carries* while
this says what it *says*.

Five vocabulary sweeps each found their word the same way — somebody read a
screen that said two things for one fact — and each set a rule from the strings
it happened to be looking at. The next sweep then found a shape the rule did not
cover, because no list of what the screens actually say had ever existed. This is
that list. The sweep that acts on it is a later pass, and it can be one pass
rather than a sixth because the shapes are all on the page before a rule is
written.

## What counts as a string

**A run of words this app authors and a reader of this screen can read** — and,
second, **a closed-vocabulary value a person never reads but a vocabulary sweep
has to see.** Both are inventoried; the entry says which, as `read` or `switch`.

The second class is here because #274 measured what happens without it:
`billed-more`, `order-billed`, `billed-short` and `billed-over` were `key`
values, which `copyStrings` skips by structure and the identifier walk never
visits, so four uses of a barred word were invisible to every matcher at once.

**Counted:** JSXText; a string literal or template chunk inside a JSX expression
container, including both arms of a ternary; a string literal in an attribute a
person reads (`placeholder`, `title`, `aria-label`, `alt`, an `<option>`'s text,
a `label`); a string in a copy constant this screen imports; a message a
co-located Server Action returns for the screen to show; a `throw new Error`
message the screen renders; a closed-vocabulary value.

**Not counted:** a class name, a route, `type=` / `name=` / `href`, an Airtable
field name, a record id, a form field's `name` — anything only a developer
reads.

**One sentence is one entry, however it is spelled.** A sentence split across
three JSXText nodes by two expression containers is one string, written with the
containers in braces. Three fragments would erase the fact that a sentence
exists, which is the mistake that makes a census unreadable rather than merely
incomplete.

## How an entry reads

```
- **`Send sign-in link`** — read · auto
  - when: always, except while the request is in flight `[seen]`
  - from: `app/login/page.js:91`, the alternate of a ternary in a JSX
    expression container
  - names: no table
  - held: quoted by `login.md`
```

`read` / `switch` is the class above. `auto` / `hand` says whether
`scripts/screen-strings.mjs` can attribute the string to this screen, so the
`hand` entries are the extractor's blind spot, named rather than implied.

`from:` names the file and the line, and then the SHAPE — which is what a later
sweep needs, since a shape is what a rule covers or misses.

`names:` is the table whose row the words point at, or `no table`. It is the
input the naming rules take: `Deliveries` gives a delivery, `Invoices` an
invoice, `Lines` a job's line, and so a `PO Items` row is an ordered item.

`held:` says whether a brief quotes the string and whether
`offline/screen-briefs.mjs` pins it. A string that is quoted and not pinned can
be reworded in the code while a brief goes on showing the old wording to a
designer; a string that is neither is protected by nothing at all.

## How a condition is written

**The state a reader can put the screen into, never the code's own predicate.**
`after the sign-in link is sent — the form is replaced`, not `status === "sent"`.
A refactor that keeps the state keeps the sentence true, and one that removes the
state makes it plainly false. This is #296's rule in another shape: what goes in
a document is what to look for, not a value that will move.

Every condition carries one of three grades, and the grade is the whole defense
against the second way this file can be wrong — a string recorded correctly with
the wrong condition beside it, which sends the design work drawing a state that
cannot happen.

| Grade | Means |
|---|---|
| `[seen]` | the state was created in a browser and the string was read |
| `[reachable]` | the state can be created in a browser; this pass did not |
| `[unreachable]` | not reachable through this screen — with what it would take |

`[unreachable]` is the grade that earns the table. `/login` renders
`Email is required`, authored two files away, and no reader can ever see it: the
input is `required`, so an empty submit never leaves the page.

## Six shapes an inventory cannot count

**Every file names which of these reach its screen, and says so when none do.**
A silence has to read as a measurement rather than as an omission — the #254
census was a lower bound by its own admission, and that admission is the only
reason it was safe to build on.

1. **runtime-keyed** — a string chosen at runtime from a keyed constant
   (`COPY.blocked[key]`, a `.map()`, any computed member). The module is
   attributable and the member is not.
2. **another entry point's message** — a string this screen renders that a
   different entry point authored: a Route Handler's `error`, or something
   thrown deeper and serialized on the way out. Nothing that walks a route's own
   files can reach it.
3. **a value from the base** — a single select's option text, a `Unit`, an
   `Edit Log."Field"` label. Not in this repository at all, and `DRUM` is the
   precedent for what that costs.
4. **text this app does not author** — the browser's own validation bubble, a
   date picker's chrome, a framework error page. A reader reads it; no file here
   can quote it, because each browser words it differently.
5. **a figure inside a counted sentence** — the sentence is an entry; the
   number, date or amount interpolated into it is not.
6. **a state this pass could not create** — an `[unreachable]` entry. Its
   existence is counted; its condition is a claim.

**And one shape the extractor over-reaches on, which every file records under
"Attributed here and not rendered".** A thrown message it cannot tell from a
rendered one, a `??` fallback that cannot be reached, a copy member reached
through the union that keeps `poOptionLabel`'s own string attributable. Naming
each with its reason is what stops an over-reach reading as a string the screen
says — and it is the third of the three figures every measured file reports.

**The extractor sees a closed vocabulary's COMPARED members and its `key`
properties, not its declared ones.** A value that is only ever assigned — an
array of tab definitions, a `PAIRING` constant — is invisible to it and is hand
work. #274's four `billed-` values were `key` properties, so that half is covered
by structure; the other half is not, and `/invoices/new` measured it at ten
values.

## How this stays true

**`scripts/screen-strings.mjs` is this file's rule executable**, the shape
`scripts/wrap-72.mjs` already has. `--check` compares each screen's inventory
against the code without rewriting it, and it is run by hand until every screen
has a file.

**A file is remade when a file it names changes, when its route gains or loses
one, or when a constant it renders is reworded** — not on a schedule and not once
per issue. Each file says so in its own header, because a reader who has one file
open should not have to find this one.

**The check that makes this a CI obligation needs every screen present.** Its
first assertion is the one `offline/screen-briefs.mjs` already makes both ways —
every brief has an inventory and every inventory has a brief — which cannot hold
while sixteen screens have no file. So it lands with the last group of screens,
and what it will assert is already fixed: that every string the extractor finds
under a screen's files is in that screen's inventory, and that every entry's
quoted text is still in the file the entry names. The second covers the `hand`
entries with no exemption list, because it verifies a claim about a named file
rather than finding the string by traversal.

## The files

One per screen, named exactly as the brief is: the route with its leading slash
dropped, `/` replaced by `-`, brackets stripped. `/pos/[poId]` is `pos-poId.md`;
`/` is `root.md`. The name is derived rather than typed, which is what lets the
check's first assertion be an equality in both directions.

**A subdirectory rather than a suffix in `docs/briefs/`, and that is forced.**
`offline/screen-briefs.mjs` counts every `.md` in that directory as a screen
brief and requires a page for each, so a file named `invoices-new.strings.md`
beside the briefs fails it. `readdirSync` does not recurse, so this directory is
invisible to that check and the briefs' own guarantee is untouched.
