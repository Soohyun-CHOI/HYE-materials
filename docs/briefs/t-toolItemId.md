# Label address

Route: `/t/[toolItemId]`
Who reaches it: anyone, signed in or not — it reads nothing and shows nothing.
Which width comes first: neither. Nothing here is drawn.

## What it answers

Nothing. **There is no screen at this address**, and a designer should read that
before anything else: it renders no markup at all and redirects to the tool
item's own screen, `/tool-items/[toolItemId]`.

**It exists for its length.** This is the address a QR code on a tool's label
encodes, and a QR encodes the whole URL, host included. The longer that string,
the higher the symbol's version and the finer its grid, so a sticker of a fixed
size carries thinner modules — read through oil and wear, in a gloved hand, on a
site. `https://hyeusa.com/t/HYE-TL-260909-004` is nine characters shorter than
the screen it opens, which is a whole symbol version. `docs/notes/tools.md`
carries the arithmetic.

**A redirect rather than the page itself, because one page has one address.**
Serving the tool item's content here would make two addresses for one screen,
which is the thing that screen's own canonical redirect exists to prevent.

**It is included here because every page gets a brief, and because the fact that
nothing is drawn is itself worth stating** — a design that finds this route and
draws a loading state, a splash or a scan confirmation would be adding a screen
the app does not have. The arrival at the tool item is the answer.

## What it always carries

Nothing. There is no heading, no text, no control and no markup.

**action.** One redirect, to `/tool-items/[toolItemId]`, carrying the same id
with its capitals normalized. A person who scans a label sees their browser move
once and land on the tool item.

## What it carries only sometimes

Nothing, and there is no branch. Every string is redirected alike — an id no tool
item carries reaches the tool item screen and is answered there with
`Tool item not found`, which is the one place that sentence belongs.

**It does not check for a session either**, so a scan with nobody signed in
redirects to the tool item, which is what sends the reader to `/login`. One sign-in
prompt on the way, at the screen rather than here.

## What must agree elsewhere

**This is the address that gets printed, and the tool item's own is not.** They
were the same route until #348, and separating them is what lets the screen take
the name its collection gives it while the label keeps the short string. A design
or a later phase that prints the screen's address instead loses the symbol version
this route buys.

**The label prints the URL in capitals**, `HTTPS://HYEUSA.COM/T/HYE-TL-260909-004`,
because a QR code packs digits and capitals far more tightly than mixed case. The
uppercase spelling of the path resolves to this same route. What a label carries
beside the code — the id in readable characters, for a symbol that has been
scratched — is Phase 2's to lay out.

**Nothing is printed yet.** Every label this route is for is a later phase, so
moving it today costs code and no reprinting; after that it costs both.
