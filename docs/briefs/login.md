# Sign in

Route: `/login`
Design: Sign in 1a, 1d, 1e, 1j and 1h, on Invoices 0o.
Who reaches it: anyone. It is also where a page's gate sends a reader with no
session, handed the address that reader was trying to reach when the request
carried one; a Route Handler answers such a request with a 401 instead.
Which width comes first: both. A label scanned while signed out lands here on a
phone, and a desk signs in here too.

## What it answers

How do I get in? The reader gives their company email address and receives one
email carrying a link and a code. **This is the app's entire authentication
surface**: no password, no account creation, no recovery and no other method.

**There is no sign-up.** A `Users` row appears as a side effect of a first
successful sign-in, so one field serves a new colleague and a returning one, and
nothing tells the two apart. A name is asked later (`login-name.md`), never here,
where nobody has yet shown they own the address they gave.

**The code exists for the phone.** The link signs in whichever device opens
it — the desk where the email was read, or a mail app's own browser. The code
signs in only the browser that asked for the email, so a person who asked on a
phone and reads the mail elsewhere types it back here.

## What it always carries

**The address field takes only the part before the company's domain.** The domain
it shows is the value the server judges every request against
(`ALLOWED_EMAIL_DOMAIN`, read by `lib/auth.js` alone), so the screen and the
server cannot disagree. A company address pasted or filled in whole loses its
domain as it arrives; one at another domain stays whole and is refused before
anything is sent (`COMPANY_EMAIL_COPY.otherDomain`).

**Where the reader was going travels and is never said.** It rides the request,
the email, the confirm screen and the code step, and the reader lands there once
signed in. Someone arriving from a label, someone who typed `/login` and someone
whose destination was refused for pointing outside the app see the same screen: a
sentence naming it would show whoever follows a shared link where somebody else
was going.

**What it reads:** nothing on the base until a press. Measured from the dev log
(`docs/notes/authorization.md`): `/login` 0 operations, an email asked for 2, a
refusal by the ceiling 1, a wrong code 3, a refusal about a used, expired or locked
row 2, a code that signs in 4, and 5 for a first sign-in, which creates the `Users`
row.

## What it carries only sometimes

**While an email is asked for, or a code checked:** the press is busy and nothing
else takes input; the words are `SIGN_IN_COPY.request.working` and
`SIGN_IN_COPY.code.working`.

**When the email has gone — the code step**, which replaces the first step. It
names the address it went to, and `SIGN_IN_COPY.code.change` goes back to the first
step with that address still in the field.

- **The code is one real field**, whatever is drawn over it: it raises the number
  pad, lets the phone offer the code it has just seen in the mail, and drops
  anything but a digit, so a pasted `123 456` works.
- **It sends itself at its sixth figure**, typed or pasted; the press stays for the
  rest.
- **It survives a reload.** The browser's binding to the email it asked for brings
  the code step back. Changing the address ends the binding, and so do the row's
  fifteen minutes and a code that signs this browser in. A sign-in by the link
  leaves it, and a code typed after that reads as used.
- **Only the newest email's code is accepted.** An earlier email's link still
  works; its code is answered as any wrong one.

**Resending waits a minute after every email, the first step's included,**
counted from the press and carried across a reload (`lib/signInLimit.js`). After a
resend the control reads `SIGN_IN_COPY.code.resent` for a moment, then the time
left, `SIGN_IN_COPY.code.resendIn`, which takes no press and is not announced, then
the control again, which is.

**When a code is refused**, by `CODE_COPY` keyed by the code's state:

| Case | Said | What stays |
|---|---|---|
| fewer than six digits when the press is made early | `CODE_COPY.malformed` | the figures; another code can still work |
| a code that does not match | `CODE_COPY.wrong`, with the tries left | the figures; the next figure starts a new code |
| five wrong codes | `CODE_COPY.locked` | nothing: the code is ended |
| expired | `CODE_COPY.expired` | nothing |
| the link or the code already used | `CODE_COPY.used` | nothing |
| this browser waits for no email any more | `CODE_COPY.missing` | nothing |
| the row it waits on is gone or holds no code | `CODE_COPY.invalid` | nothing |

The first two are refusals of the figures. The rest are about the email, so the
field and its press go, the step names why, and its press sends a new email to the
same address (`SIGN_IN_COPY.code.endedSentence`, `SIGN_IN_COPY.code.endedAction`),
the address still changeable. **None of them tells a stranger anything about an
address**: each describes the email this browser asked for, which exists whoever
the address belongs to.

**When a request did not happen** — an email not sent, a code the server could not
check — `SIGN_IN_COPY.failed`, wherever it was asked. The figures and the address
stay, so the same press tries again.

**When a ceiling holds an email back:** `SIGN_IN_COPY.limited`, by the control
that asked. It names no time and reads the same for every address — the ceilings
count every company address alike, so the sentence tells nobody whether an address
has an account, and it must not say more. The step keeps everything, the control
stays live and starts no wait, and the sentence goes at the next request; held back
on a resend, the code already sent still works.

**A code that works says nothing.** The reader lands where they were going, or
first on the name step and the job step when those apply, exactly as after the
link.

## What must agree elsewhere

**The confirm screen's button and the email's are one word**,
`CONFIRM_COPY.valid.action` and `SIGN_IN_COPY.mail.action`, so the email names the
control the page it opens draws.

**Fifteen minutes, six digits and five tries are the rule's own numbers**, from
the constants that decide them in `lib/authTokenState.js`; the email states the
fifteen minutes and this screen does not. Each email is used once, by its link or
its code, and using either ends the other.

**The email sets the code in two groups of three**, as Sign in 1h draws it, as
spacing in its HTML rather than a character, so a copy of it is the six figures;
the plain-text part says it with a space, which the field drops.

**The product's name is `lib/productName.js`'s**, the wordmark and the email's
subject alike; the company's legal name belongs to the purchase order PDF and never
appears here.

**The name step and the job step are asked of a signed-in reader with no name, or
with no job** (`login-name.md`, `login-jobs.md`), on any page they open — after a
first sign-in, in practice. Nothing here mentions either: most readers never meet
them.
