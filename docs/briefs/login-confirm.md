# Confirm sign-in

Route: `/login/confirm`
Design: Sign in 1b and 1f, on Invoices 0o.
Who reaches it: anyone holding a sign-in link. It is opened from an email client,
so it is the one screen in the app regularly reached from outside it.
Which width comes first: both, for the reason `login.md` gives: a scan that
arrived signed out finishes here on the phone.

## What it answers

Is this link still good, and do I want to use it here? **Opening this page signs
nobody in** — it reads the link's state and offers a button, and only pressing
that button spends the token.

That is a security decision with a visible consequence, and a redesign must not
smooth it away. Mail security scanners open links before the recipient does, so a
page that signed in on load would let a scanner spend the token and leave the
person with a dead link. The extra press is the feature.

## What it always carries

**One state of a closed set of five**, read without consuming the token, each with
exactly one way forward. `CONFIRM_COPY` holds the words of each, keyed by
`TOKEN_STATES`.

**What it reads:** the token's row, one operation; none when the link carries no
token. Pressing the button costs 3 for a reader whose `Users` row exists
(`docs/notes/authorization.md`); a first sign-in creates the row as well.

## What it carries only sometimes

**When the link is still valid** (`CONFIRM_COPY.valid`): whose session is about to
be created — the address, which matters on a shared or family device — and the
button. **The button is a plain HTML form that posts natively** — no action id and
no script behind the submission — so it works where scripts are blocked and its
behavior is one request. It carries the token and, as a second hidden field, where the reader was
going; pressing it lands them there. Nothing names that address, as on the sign-in
screen.

**When the link can no longer be used** — four states, three voices:

| State | Words | The way on |
|---|---|---|
| expired | `CONFIRM_COPY.expired` | a new email to the address the row names |
| already used, by its link or its code | `CONFIRM_COPY.used` | a new email to the address the row names |
| a token nobody issued | `CONFIRM_COPY.invalid` | back to the sign-in screen |
| no token in the link | `CONFIRM_COPY.missing` | back to the sign-in screen |

**The last two are deliberately the same words.** A missing token and an unknown
one are one fact from the reader's side, and telling them apart would tell whoever
holds the link something about what the app knows. **Showing the address on a dead
link withholds nothing**: whoever holds the link holds the email it came in.

**The new email is sent from this browser**, so the code in it works here, and the
page then shows the sign-in screen's code step with its resend wait counted from
this press. Both ways on carry the destination. While it is sent, the button is
busy; if it cannot be sent, `SIGN_IN_COPY.failed`; if a ceiling holds it back,
`SIGN_IN_COPY.limited`, the button still live — the same sentence for every
address, as on the sign-in screen.

**A token whose expiry cannot be read counts as expired.** There is no sixth
state to design.

## What must agree elsewhere

**Pressing the button does not always land on the destination.** A reader with no
name is shown `/login/name` first, and one with no job the job step, then the
destination — every first-time signer, in practice. Nothing here says so: most
readers never meet them.

**The button's word is the email's**, `CONFIRM_COPY.valid.action` and
`SIGN_IN_COPY.mail.action`, so a rename here reaches the email.

**This is one of two ways to finish a sign-in.** The email also carries a code,
which signs in only the browser that asked; using either ends the other, so a link
opened after its code was used reads as used. Nothing here mentions the code: this
screen signs in the device that opened the link.

**The fifteen minutes are stated in the email**, from the constant the validity
rule uses; this screen names the state and not the figure.

**The submission is refused across origins** (`lib/crossOrigin.js`), so the form
must post to the app's own host. Nothing about that is visible, but it rules out
hosting the button anywhere else.
