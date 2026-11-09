# Label address

Route: `/l/[labelCode]`
Who reaches it: anyone, signed in or not — it reads nothing and shows nothing.
Which width comes first: neither. Nothing here is drawn, and no design frame draws it.

## What it answers

Nothing. **There is no screen at this address**, and a designer should read that before
anything else: it renders no markup at all and redirects to the asset's own screen,
`/assets/[assetId]`.

**It exists for its length.** This is the address a QR code on a label encodes, and a
QR encodes the whole URL, host included. The longer that string, the higher the
symbol's version and the finer its grid, so a sticker of a fixed size carries thinner
modules — read through oil and wear, in a gloved hand. `docs/notes/tools.md` carries
the arithmetic.

**The segment is the printed code, not the `Asset ID`.** An asset is
`HYE-AST-260909-004` in the base and in its page's title; the label carries `260909-004`,
because the family token is on every asset and separates none of them. This route puts
it back.

**A redirect rather than the page itself, because one page has one address.** Serving
the asset's content here would make two addresses for one screen, which the asset
screen's own canonical redirect exists to prevent. A design that draws a loading state,
a splash or a scan confirmation here adds a screen the app does not have: the arrival
at the asset is the answer.

## What it always carries

Nothing. There is no heading, no text, no control and no markup.

**action.** One redirect, to `/assets/[assetId]`, carrying the id this route builds
from the printed code — capitals normalized and the family token put back
(`lib/assetRoutes.js`), so the destination is handed the spelling the base holds and
has nothing of its own to redirect. A person who scans a label sees their browser move
once and land on the asset.

**What it reads:** nothing, 0 operations.

## What it carries only sometimes

Nothing, and there is no branch. Every string is redirected alike — a code no asset
carries reaches the asset screen and is answered there, which is the one place that
answer belongs (`assets-assetId.md`).

**A whole `Asset ID` typed here reaches that same answer.** The token is put in front of
whatever arrives, so a string that already carries one resolves to no asset; no label
was ever printed with the long form, since every symbol is built as a page renders.

**It does not check for a session either**, so a scan with nobody signed in redirects
to the asset, which sends the reader to `/login` and back. One sign-in on the way, at the
screen rather than here.

## What must agree elsewhere

**This is the address that gets printed, and the asset's own is not.** A design or a
later change that prints the screen's address instead loses the symbol version this
route buys.

**The code printed on the sticker and the segment of this address are one string**
(`lib/assetRoutes.js`), and they may not drift apart: the readable code exists for a
symbol scratched or painted over, and what a person does with it is type it into the
address.

**The label prints the URL in capitals**, `HTTPS://APP.HYEUSA.COM/L/260909-004`,
because a QR code packs digits and capitals far tighter than mixed case, and the
uppercase path resolves to this same route (`next.config.mjs`). **Shortening the segment
did not make that optional**: what costs a version is the mixed character set, not the
length.

**Moving this route moves every label already stuck on an item**, which then has to be
printed again.
