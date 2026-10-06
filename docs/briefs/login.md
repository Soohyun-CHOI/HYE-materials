# Sign in

Route: `/login`
Who reaches it: anyone. It is also where every gate sends a reader with no session,
and it is handed the address that reader was trying to reach.

## What it answers

How do I get in? There is no password, no account creation and no alternative
method: the reader types their company email address and receives an email with a
link and a code in it. **This is the app's entire authentication surface**, and it is
the first screen anyone ever sees, so it carries more of the product's first
impression than any other.

There is no sign-up. A user record appears as a side effect of a first successful
sign-in, so the same one field serves a new colleague and a returning one, and
nothing on the screen distinguishes the two cases. A new colleague is asked their
name later, on a third screen after the sign-in — never here, where nobody has yet
shown they own the address they typed.
**A reader often did not choose to come here.** Following any address in the app
while signed out lands them on this screen. The most demanding case is a QR label
on a tool, scanned on site: that person is holding a phone in front of the tool,
and this screen is a step in a scan rather than something they opened.

**The screen has two steps, and the second exists for that phone (#471).** The
email's link signs in whichever device opens it — which is the computer, for a
person who asked on the phone and read the email at a desk, or the mail app's own
browser, which does not share the phone browser's sign-in. The email's code signs in
only the screen that asked for it, so the person types it back into this screen and
the phone is signed in where they asked.

## What it always carries

**identity.** The product's name as the wordmark above the step, and the step's own
title under it — `Sign in` on the first step. The name is from the app's single
naming constant; the email's subject is `Sign in to HYE USA Portal`, from the same
constant, so the reader meets the name the email was sent under.

**evidence.** One line under the title, `Enter your work email.`

**action.** One field that takes only the part of the address before the company's
domain, with the domain shown fixed beside it, the placeholder `name`, and one
full-width filled button, `Continue`.

That is the whole first step. It is one centered column at a desk and the phone's
step page under the phone's edge, and it is one of only two screens in the app with
no navigation of any kind.

**The domain beside the field is the one the sign-in accepts.** It is not written
into the screen: the screen shows the value the server judges every request
against, so the two cannot disagree. An address pasted or filled in whole loses its
domain as it arrives when the domain is the company's, and stays whole when it is
not.

**It also carries one thing it never shows.** Where the reader was going travels
with them from here — into the email, onto the confirm screen, into the code step,
and into the address they land on once they are signed in. It is in the URL and in
what the screen sends, never in a sentence.

## What it carries only sometimes

**While the email is being sent:** the button keeps its fill and takes no press,
and if the wait passes a moment it shows a spinner before `Sending…` — on a phone,
the spinner alone. The field takes no typing meanwhile.

**When the field holds an address at another domain:** the fixed domain is not
shown, and `Continue` refuses it under the field with
`Use your @hanyangengusa.com address.` — the domain in it is the same value the
field shows. Nothing is sent.

**When the request fails:** `Something went wrong. Try again.`, the one sentence
this flow says for a request that did not happen.

**When too many emails have been asked for:** `Too many requests. Try again later.`,
in the same place (#148). The address stays in the field and `Continue` stays live.
It says no time and reads the same for every address — a limit counts every
company address alike, so the sentence tells nobody whether an address has an
account, and a redesign must not make it say more.

**When the email has been sent — the code step.** The first step is **replaced**,
not supplemented, by:

- **identity** — the title `Check your email`.
- **evidence** — `Enter the code we sent to`, leading into the address it was sent
  to, drawn as a chip with `Change` at its end, which goes back to the first step
  with the address still in the field so a typo is one character to fix.
- **action** — the code as six boxes over one field, and one full-width filled
  button, `Sign in`, which reads `Signing in…` while it checks.
- one line under them: `Didn't get it?` and `Resend email`, which sends another
  email to the same address.

Three things in that step are load-bearing:

1. **The field is built for a phone.** It raises the number pad, and it lets a
   phone offer the code it has just seen in the email; anything but a digit is
   dropped as it is typed, so a pasted `123 456` works. The six boxes are a drawing
   over one real field, which is what keeps both properties.
2. **The code sends itself at its sixth figure**, typed or pasted. `Sign in` stays
   for the rest.
3. **The code works only on the screen that asked**, so the step names no other way
   in; the email carries the link and says what it is for.

**The step survives a reload.** The browser remembers which email it is waiting
for, so a phone that drops the tab while its owner reads the email comes back to
the code step rather than to an empty address. `Change` is what ends that, and it
is the only way back to the first step short of waiting out the fifteen minutes.

**`Resend email` waits a minute after every email (#148)**, the one `Continue` sent
included, counted from the press. While a resend is asked for, the control keeps
its place and, after a moment, draws a spinner where its words were, saying
`Sending…` to assistive tech (#495). After a resend it reads `Email sent` for a few
seconds; then, and straight away when the step opens, it reads the time left —
`Resend in 0:57` — which takes no press and is not read aloud; then the control
comes back, which is. The step remembers when the email was asked for, so a
reload counts on rather than starting over. A minute is what keeps somebody who
presses the control each time it comes back from ever reaching the limit below. The
newest email's code is the only one this screen accepts — an earlier email's link
still works, but its code does not.

**When a code is refused — two kinds.** Two refusals leave the boxes where they
are, with the figures kept and one sentence under them, because another code can
still work:

| Refusal | Sentence |
|---|---|
| not six digits, when `Sign in` is pressed early | `Enter the 6-digit code from the email.` |
| a code that does not match | `Wrong code. 4 tries left.` (`1 try left.` at one) |

The next figure starts a new code. The others are about the email itself, so no code
can work any more: **the boxes and the button go**, the title names why, the line
leads into the address, and the one action is `Send new email`:

| Refusal | Title |
|---|---|
| five wrong codes | `Too many tries` |
| expired | `This code has expired` |
| the link or the code was already used | `This code no longer works` |
| this screen is waiting for no email | `This code no longer works` |

The line under each is `Get a new code sent to`. **No refused title says what to do
next**, because `Send new email` stands under every one of them and says it.

**None of these can tell a stranger anything about an address.** Each describes the
email this screen asked for, which exists whoever the address belongs to, and is
told only to the screen that asked.

**When checking a code or sending a new email fails** — not a wrong code, but a
request that did not happen: `Something went wrong. Try again.`, where the first
step says it. The figures stay, so `Sign in` tries again.

**When too many emails have been asked for**, `Too many requests. Try again later.`
by the control that asked. For `Resend email` it is the line under `Sign in`: at a
desk between `Sign in` and `Didn't get it?`, on a phone in the place of that line,
so the step still fits above the number pad. For `Send new email` on an ended code
it stands where that step's refusal does. The control starts no wait, the step
keeps everything it holds, the code of the email already sent still works, and the
sentence goes at the next request.

**A code that works says nothing.** The reader lands where they were going — or on
the name step first, if this is their first sign-in — exactly as after the link.

## What must agree elsewhere

**The wordmark is the same on the confirm screen and the name step**, all three
under one frame, so the steps of one flow read as one flow.

**There is a third screen for somebody signing in for the first time** —
`/login/name`, which asks what to call them, after the code works or after the
confirm screen's button. Nothing here mentions it, and that is right: a returning
reader never sees it, and promising it would be wrong for almost everyone who reads
this screen.

**`Sign in` is the confirm screen's button and the email's**, from the confirm
screen's own constant, so the email names the control the page it opens draws.

**The expiry is the real lifetime**, from the same constant the validity rule uses:
15 minutes for the link and the code alike, and each email is used once. The email
says it; this screen does not.

**Six digits and five tries are the rule's own numbers**, from the constants that
decide them.

**The product name lives in exactly one place** and appears on screen only through
it. The company's legal name is a different constant and belongs on the purchase
order PDF, which is what a vendor reads — never here.

**Restricted to the company email domain**, which is why the field shows the domain
and takes only what comes before it. There is no "sign in with Google", no
password, and no recovery flow, because there is nothing to recover.
**Nothing here announces where the reader was going, and that is a decision rather
than an omission.** Someone who arrived from a tool label, someone who typed
`/login` themselves, and someone whose destination was refused for pointing
outside the app all see exactly the same screen. A line like `Sign in to continue
to …` would be a sentence the app has no copy for, and on a screen anyone can
open it would show whoever follows a shared link where somebody else was going.

**This screen is used at a phone width as well as at a monitor**, because a scan
that arrives signed out comes through it. It is the only screen outside the tools
track of which that is true, along with the confirm screen after it. On a phone the
action sits at the foot of the screen and rides on the keyboard, so the field and
the action are both in sight while somebody types.
