# Confirm sign-in

Route: `/login/confirm`
Who reaches it: anyone holding a sign-in link. It is opened from an email client,
so it is the one screen in the app that is regularly reached from outside it.
It is also the second half of a scan that arrived signed out, so it is used at a
phone width as well as at a monitor — the only screen outside the assets track of
which that is true, along with the sign-in screen before it.


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
states**, three of which are failures with words of their own.

## What it always carries

**identity.** The product's name as the wordmark, the same as on the sign-in screen,
and a title that names the link's state. Centered, narrow, no navigation.

Everything else depends on the token's state, and every state has exactly one way
forward.

## What it carries only sometimes

**When the link is still valid — one state of five:**

- **identity** — the title `Sign in`, and `You're signing in as` leading into the
  address, drawn as a chip with no control in it. The reader is told whose session
  they are about to create, which matters on a shared or family device.
- **action** — a full-width filled button, `Sign in`.

**The button is a plain HTML form with no client-side code of any kind** — no
script, no action identifier. So it still works where scripts are blocked, and its
behavior is reproducible in a single request. A redesign that makes it a
script-driven control loses both properties.
**The form also carries where the reader was going**, as a second hidden field
beside the token, and pressing the button lands them there instead of on the root
screen. Nothing on this screen names that address: like the sign-in screen before
it, a reader who arrived with a destination and one who arrived without see the
same words.


**When the link can no longer be used — four states, three voices:**

| State | Title | Under it |
|---|---|---|
| expired | `This link has expired` | `Get a new link sent to` and the address |
| already used | `This link no longer works` | `Get a new link sent to` and the address |
| a token nobody issued | `This link isn't valid` | nothing |
| no token in the link | `This link isn't valid` | nothing |

The last two are **deliberately the same words**. A missing token and an unknown
one are one fact from the reader's side, and distinguishing them would tell whoever
is holding the link something about what the app knows.

**The way forward follows from whether the link names an address.** The two that do
offer `Send new email`, which sends a new email to that address from this browser —
the code in it works here — and then shows the sign-in screen's code step, its
`Resend email` already waiting out the minute from this press. The two that name
none offer `Go to sign in`, back to the sign-in screen. Both carry the destination
with them, so a reader whose link ended does not lose where they were going at the
last step. While the new email is being sent the button keeps its fill and shows a
spinner and `Sending…`; if it cannot be sent, `Something went wrong. Try again.`;
and if too many emails have been asked for, `Too many requests. Try again later.` in
the same place, with the button still live (#148). That sentence reads the same for
every address, as on the sign-in screen.

**Showing the address on a dead link withholds nothing either.** Whoever holds the
link holds the email it came in, which names the address.

**A token whose expiry cannot be read counts as expired.** The state machine has no
"unknown", so there is no sixth voice to design.

## What must agree elsewhere

**The wordmark is the sign-in screen's and the name step's**, all three under one
frame, so the steps of one flow read as one.

**Pressing the button does not always land the reader on their destination.**
Somebody whose `Users` row has no name yet — every first-time signer — is shown
`/login/name` first, and lands on the destination after answering it. Nothing on
this screen says so, for the same reason nothing names the destination: a
returning reader never meets that step.

**`Sign in` is the button the email names**, from this screen's own constant: the
email's button and this page's are one word, so a rename here reaches the email.

**This screen is one of two ways to finish a sign-in (#471).** The email also
carries a code, which signs in only the screen that asked for the email, and using
either one ends the other — so a link opened after its code was used lands on
`This link no longer works`. Nothing here mentions the code, and that is
deliberate: this screen is reached by opening the link, and it is the link's
device that this screen signs in.

**The five states are one closed set** in a single module, and the same module is
what the page reads to reach its verdict without consuming the token. A design
cannot add a sixth state, and should not merge the three voices — each leaves the
reader in a different position.

**Fifteen minutes is stated in the email**, from the one constant the validity rule
uses. This screen names the state, not the figure.

**The submission is refused across origins**, so this page's form must post to the
app's own host. Nothing about that is visible, but it rules out hosting the button
anywhere else.
