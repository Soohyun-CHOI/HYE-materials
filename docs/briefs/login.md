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

**identity.** The heading `Sign in to HYE USA Portal`, which is the product name
inside a sentence, from the app's single naming constant. The same line is the
subject of the sign-in email, so the screen and the mail agree by construction.

**evidence.** One line under the heading, `Use your company email address.`,
which is the only place the domain restriction is stated before a reader hits it.

**action.** One email field with the placeholder `you@company.com`, and one
full-width filled button, `Send sign-in link`.

That is the whole first step. It is centered in the viewport rather than laid out
down the page, and it is one of only two screens in the app with no navigation of
any kind.

**It also carries one thing it never shows.** Where the reader was going travels
with them from here — into the email, onto the confirm screen, into the code step,
and into the address they land on once they are signed in. It is in the URL and in
a hidden field, never in a sentence.

## What it carries only sometimes

**While submitting:** the button reads `Sending...` and is disabled.

**When the request fails:** the error from the server, or `Something went wrong`
when there is none. A domain that is not the company's is refused here.

**When the email has been sent — the code step.** The first step is **replaced**,
not supplemented, by:

- **identity** — the heading `Check your email`.
- **evidence** — `We sent a sign-in link and a code to {email}.`, then `Enter the
  code here to sign in on this device, or open the link and press Confirm sign-in.
  Both expire in 15 minutes, and using one ends the other.`
- **action** — one field labelled `Code` and one full-width filled button,
  `Sign in`, which reads `Signing in...` while it checks.
- two smaller controls under them: `Send a new email`, which sends another email to
  the same address, and `Use a different email`, which goes back to the first step
  with the address still in the field so a typo is one character to fix.

Four things in that step are load-bearing:

1. **It names both ways in and says which device each one signs in.** The code
   signs in this screen; the link signs in whichever device opens it, and only once
   `Confirm sign-in` is pressed there. A reader who is told only about the link
   opens it on the wrong device, which is what the step exists to prevent.
2. **It states the expiry as a number of minutes**, so a reader who comes back to
   a dead code knows why.
3. **Using one ends the other.** The link and the code are two ways of finishing
   one request, so a reader who signed in on the computer will find the code
   refused on the phone, and the sentence has already told them why.
4. **The field is built for a phone.** It raises the number pad, and it lets a
   phone offer the code it has just seen in the email; anything but a digit is
   dropped as it is typed, so a pasted `123 456` works. A design that makes it six
   separate boxes has to keep both properties.

**The step survives a reload.** The browser remembers which email it is waiting
for, so a phone that drops the tab while its owner reads the email comes back to
the code step rather than to an empty address. `Use a different email` is what
ends that, and it is the only way back to the first step short of waiting out the
fifteen minutes.

**After `Send a new email`:** one line under the controls,

`We sent a new email. Use the code in the newest one.`

The newest email's code is the only one this screen accepts — an earlier email's
link still works, but its code does not — so the line says which.

**When a code is refused — one sentence, in one of two positions.** Two refusals
leave the field where it is, with the sentence under it, because another code can
still work:

| Refusal | Sentence |
|---|---|
| not six digits | `Enter the 6-digit code from the email.` |
| a code that does not match | `That code does not match. 4 tries left.` (`1 try left.` at one) |

The other four are about the email itself, so no code can work any more: the
sentence **takes the place of the field and the button**, and `Send a new email`
under it is the way on — the confirm screen's rule that a refused state has nothing
to press.

| Refusal | Sentence |
|---|---|
| five wrong codes | `This code was entered wrong 5 times, so it no longer works.` |
| the link or the code was already used | `The code or the link in this email has already been used.` |
| expired | `This code has expired. Codes last 15 minutes.` |
| this screen is waiting for no email | `No sign-in code is waiting on this screen.` |

**No refused sentence says what to do next**, because `Send a new email` stands
under every one of them and says it. The used sentence names both the code and the
link because either could have spent the email, and the case this step exists for
is exactly one where the link was opened on another device.

**None of these sentences can tell a stranger anything about an address.** Each
describes the email this screen asked for, which exists whoever the address
belongs to, and is told only to the screen that asked.

**A code that works says nothing.** The reader lands where they were going — or on
the name step first, if this is their first sign-in — exactly as after the link.

## What must agree elsewhere

**The heading is shared with the confirm screen and the name step**, all three
using the identical line, so the steps of one flow read as one flow.

**There is a third screen for somebody signing in for the first time** —
`/login/name`, which asks what to call them, after the code works or after the
confirm screen's button. Nothing here mentions it, and that is right: a returning
reader never sees it, and promising it would be wrong for almost everyone who reads
this screen.

**`Confirm sign-in` is named here and is the button's actual label on the confirm
screen.** The code step and the email both take the word from the confirm screen's
own constant, so a rename there reaches both; a redesign that rewords this step
must keep naming whatever that button says.

**The expiry stated here is the real lifetime**, from the same constant the
validity rule uses: 15 minutes for the link and the code alike, and each email is
used once.

**Six digits and five tries are the rule's own numbers**, from the constants that
decide them, in the sentences above and in the email.

**The product name lives in exactly one place** and appears on screen only through
it. The company's legal name is a different constant and belongs on the purchase
order PDF, which is what a vendor reads — never here.

**Restricted to the company email domain**, which is why the placeholder shows a
company-shaped address. There is no "sign in with Google", no password, and no
recovery flow, because there is nothing to recover.
**Nothing here announces where the reader was going, and that is a decision rather
than an omission.** Someone who arrived from a tool label, someone who typed
`/login` themselves, and someone whose destination was refused for pointing
outside the app all see exactly the same screen. A line like `Sign in to continue
to …` would be a sentence the app has no copy for, and on a screen anyone can
open it would show whoever follows a shared link where somebody else was going.

**`Send sign-in link` names the link and not the code** it also sends. It is still
true, and whether the button should say more is the design's to settle.

**This screen is used at a phone width as well as at a monitor**, because a scan
that arrives signed out comes through it. It is the only screen outside the tools
track of which that is true, along with the confirm screen after it.
