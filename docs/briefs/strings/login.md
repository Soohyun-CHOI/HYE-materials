# Sign in — every string this screen can render

Route: `/login`
Brief: `../login.md`
Screen files: `app/login/page.js`

**Remade when a file above changes, when the route gains or loses one, or when a
constant this screen renders is reworded.** `node scripts/screen-strings.mjs
/login --check` reports drift without rewriting.

**Counted by hand first, then by the extractor, and the two were compared.** This
screen is the smaller of the two the hand pass took (#288); the measurement is at
the foot of this file and is a record of that pass rather than a live figure.

## What is not counted here

Of the six shapes `README.md` names, three reach this screen.

1. **runtime-keyed** — none. Nothing here picks a string by key.
2. **another entry point's message** — two, both `hand` below.
   `app/api/auth/request/route.js` authors one and serializes the other, which
   `lib/auth.js` throws. Neither is in this route's files and no per-screen
   extractor will ever attribute them.
3. **a value from the base** — none. This screen reads no record.
4. **text this app does not author** — one, and a reader meets it before any
   refusal this app writes: the browser's own validation bubble, raised by
   `required` and again by `type="email"`. Chrome, Safari and Firefox each word
   it differently, so no file here can quote it.
5. **a figure inside a counted sentence** — one, the `15` in the sent-state
   sentence. It comes from `TOKEN_TTL_MINUTES` and is meant to move.
6. **a state this pass could not create** — one, marked `[unreachable]`.

## Strings

### The tab

- **`HYE USA Portal`** — read · auto
  - when: always, as the browser tab's text `[reachable]`
  - from: `app/layout.js:24` composes it as the `default` of the metadata title;
    the value is `lib/productName.js:30`. This screen exports no metadata of its
    own — it is a Client Component and cannot — so it is the one route that reads
    the default rather than the `%s · …` template
  - names: no table. The product's name, and not the company's
  - held: `_shared.md` locks it as tier 1; `offline/product-name.mjs` fails on
    its value appearing as a literal outside `lib/productName.js`

### The form

- **`Sign in to {HYE USA Portal}`** — read · auto
  - when: always, except in the sent state, where the form is replaced
    `[seen]`
  - from: `app/login/page.js:65`, `{SIGN_IN_TITLE}` — a bare identifier in a JSX
    expression container, resolved through the import to
    `lib/productName.js:39`, where it is a template over `PRODUCT_NAME`. **The
    braces mark the composition** rather than a container: a reader sees
    `Sign in to HYE USA Portal` and no file holds those words together
  - names: no table
  - held: quoted by `login.md` and by `login-confirm.md`, which uses the
    identical line; not in the `PINNED` list

- **`Use your company email address.`** — read · auto
  - when: always, except in the sent state `[seen]`
  - from: `app/login/page.js:67`, JSXText
  - names: no table
  - held: **no brief carries this line.** `login.md` lists the heading, the
    placeholder and the button and then says that is the whole screen — which is
    what this inventory corrected in the commit that added this file

- **`you@company.com`** — read · auto
  - when: always, until the reader types into the field `[seen]`
  - from: `app/login/page.js:77`, a `placeholder` attribute
  - names: no table
  - held: quoted by `login.md`, which also records why the placeholder is
    company-shaped — the domain restriction

- **`Send sign-in link`** — read · auto
  - when: always, except while the request is in flight `[seen]`
  - from: `app/login/page.js:91`, the alternate of a ternary inside a JSX
    expression container. **This is the shape the #254 census could not see**,
    and it is the label on the button a first-time reader presses
  - names: no table
  - held: quoted by `login.md`; not pinned

- **`Sending...`** — read · auto
  - when: while the sign-in request is in flight; the button is disabled with it
    `[reachable]` — the state lasts as long as one round trip
  - from: `app/login/page.js:91`, the consequent of the same ternary
  - names: no table
  - held: quoted by `login.md`; not pinned

### After the link is sent

- **`Check your email`** — read · auto
  - when: after the link has been sent. It does not join the form — it
    **replaces** it `[reachable]`
  - from: `app/login/page.js:48`, JSXText in the heading
  - names: no table
  - held: quoted by `login.md`; listed in `_shared.md` among the tier-3 screen
    headings; not pinned

- **`We sent a sign-in link to {email}. Open it and press Confirm sign-in. It
  expires in {15} minutes.`** — read · auto
  - when: after the link has been sent, beneath the heading above `[reachable]`
  - from: `app/login/page.js:50-51` — **one sentence across three JSXText nodes
    split by two expression containers**, `{email}` and `{TOKEN_TTL_MINUTES}`.
    Counted as one string
  - names: no table
  - held: quoted whole by `login.md`, which records why two parts of it are
    load-bearing: that a button has to be pressed, and that the expiry is stated
    as minutes so a reader returning to a dead link knows why

### When the request is refused

- **`Something went wrong`** — read · auto
  - when: the request fails and the response carries no message of its own
    `[reachable]` — a failed `fetch` reaches it
  - from: `app/login/page.js:35`, a string literal inside `throw new Error(...)`,
    rendered at `app/login/page.js:83`. **In no JSX node**, so a walker that
    reads only JSX never sees it; attributable at all only because it is
    co-located with the screen
  - names: no table
  - held: quoted by `login.md`; not pinned

- **`Email must be a company address`** — read · hand
  - when: the address submitted is outside the company's domain `[seen]`
  - from: `lib/auth.js:26`, thrown; serialized as `err.message` by
    `app/api/auth/request/route.js:18`; rendered at `app/login/page.js:83`.
    **Two hops, neither in this route's files** — shape 2 above
  - names: no table
  - held: `login.md` says a foreign domain is refused here and does not quote the
    sentence

- **`Email is required`** — read · hand
  - when: **`[unreachable]` through this screen, and this was checked rather than
    reasoned.** With the field emptied, the form reports `valid: false` and the
    submit handler never runs, so the standing message stays and this one never
    renders. Reaching it means calling the route some other way
  - from: `app/api/auth/request/route.js:10` — shape 2 again
  - names: no table
  - held: quoted by no brief, correctly — a design reserving room for it would be
    drawing a state no reader can reach

### Values the screen switches on

- **`idle` · `submitting` · `sent` · `error`** — switch · auto
  - when: never read by a person
  - from: `app/login/page.js:16`, the initial value and the three `setStatus`
    arguments
  - names: no table
  - held: nothing quotes them and nothing should. Inventoried because a closed
    vocabulary is invisible to a vocabulary check

## Attributed here and not rendered

None. The extractor puts nothing on this screen that a reader of it does not see,
which is worth stating because on `/invoices/new` it puts three.

## The measurement

The hand list was written first and whole, from the file. The extractor ran
afterwards and found **12 read strings and 3 switch values**; the hand list holds
11 read entries and one switch group of four.

| | count | what it is |
|---|---|---|
| hand-only, read | 2 | `Email must be a company address` and `Email is required` |
| hand-only, switch | 1 | `idle` |
| tool-only, real | 0 | |
| tool-only, unrendered | 0 | |

The twelve read findings account for exactly the nine entries that are not `hand`
— the tab takes two of them and the sent-state sentence takes three, since the
extractor reports fragments where the inventory joins a sentence.

**The two hand-only read strings are shape 2 and are not a miss.** No per-screen
extractor can attribute a string thrown in `lib/auth.js` and serialized by a
Route Handler; that is what the class is for.

**The hand-only switch value is a real limit worth naming.** `idle` is never
compared with `===` — it is only the initial value of `useState` — and the
extractor finds a closed vocabulary's COMPARED members and its `key` properties,
not its declared ones. #274's four `billed-` values were `key` properties, so
they would be caught; a value that is only ever assigned would not.

**Tool-only being zero here is the point of this screen.** It says the two passes
looked at the same 103 lines, which is what makes the same two figures on
`/invoices/new` readable rather than a number with nothing to compare it to. It
does not say the inventory is complete: shapes 3, 4 and 5 are outside both passes.
