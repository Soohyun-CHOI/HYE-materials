# Confirm sign-in

Route: `/login/confirm`
Who reaches it: anyone holding a sign-in link. It is opened from an email client,
so it is the one screen in the app that is regularly reached from outside it.

## What it answers

Is this link still good, and do I want to use it here? **Opening this page signs
nobody in** — it reads the link's state and offers a button, and only pressing that
button spends the token.

That is a security decision with a visible consequence, and it is the one thing a
redesign must not smooth away. Mail security scanners open links before the
recipient does, so a page that signed the reader in on load would let a scanner burn
the token first and leave the actual person with a dead link. The extra click is the
feature.

It is also the app's clearest example of **one screen with five mutually exclusive
states**, four of which are failures.

## What it always carries

**identity.** The heading `Sign in to HYE USA Portal`, the same line the sign-in
screen carries. Centered, narrow, no navigation.

Everything else depends on the token's state.

## What it carries only sometimes

**When the link is still valid — one state of five:**

- **identity** — `Signing in as {email}`, with the address in bold. The reader is
  told whose session they are about to create, which matters on a shared or family
  device.
- the line `Press the button to finish signing in on this device.` — `on this
  device` is doing the work: it explains why a second step exists at all.
- **action** — a full-width filled button, `Confirm sign-in`.

**The button is a plain HTML form with no client-side code of any kind** — no
script, no action identifier. So it still works where scripts are blocked, and its
behavior is reproducible in a single request. A redesign that makes it a
script-driven control loses both properties.

**When the link is not valid — four states, each one sentence and no button:**

| State | Sentence |
|---|---|
| no token in the link | `This sign-in link is not valid.` |
| a token nobody issued | `This sign-in link is not valid.` |
| already used | `This sign-in link has already been used.` |
| expired | `This sign-in link has expired. Sign-in links last 15 minutes.` |

The first two are **deliberately the same sentence**. A missing token and an unknown
one are one fact from the reader's side, and distinguishing them would tell whoever
is holding the link something about what the app knows.

Only the expired case explains itself, because only it has a cause the reader can
act on — request another and use it sooner.

**In all four:** a link reading `Request a new sign-in link`, going back to the
sign-in screen. There is always exactly one way forward.

**A token whose expiry cannot be read counts as expired.** The state machine has no
"unknown", so there is no sixth voice to design.

## What must agree elsewhere

**The heading is the sign-in screen's**, so the two halves of one flow read as one.

**`Confirm sign-in` is the exact phrase the sign-in screen promises**, in
`Open it and press Confirm sign-in`. The two are one instruction split across an
email round trip, and renaming the button breaks the sentence on the other screen.

**The five states and their sentences are one closed set** in a single module, and
the same module is what the page reads to reach its verdict without consuming the
token. A design cannot add a sixth state, and should not merge two — the four
failure voices are four because each leaves the reader in a different position.

**Fifteen minutes is stated in two places** — here and on the sign-in screen — from
one constant.

**The submission is refused across origins**, so this page's form must post to the
app's own host. Nothing about that is visible, but it rules out hosting the button
anywhere else.
