# Sign in

Route: `/login`
Who reaches it: anyone. It is also where every gate sends a reader with no session.

## What it answers

How do I get in? There is no password, no account creation and no alternative
method: the reader types their company email address and receives a link. **This is
the app's entire authentication surface**, and it is the first screen anyone ever
sees, so it carries more of the product's first impression than any other.

There is no sign-up. A user record appears as a side effect of a first successful
sign-in, so the same one field serves a new colleague and a returning one, and
nothing on the screen distinguishes the two cases.

## What it always carries

**identity.** The heading `Sign in to HYE USA Portal`, which is the product name
inside a sentence, from the app's single naming constant. The same line is the
subject of the magic-link email, so the screen and the mail agree by construction.

**evidence.** One line under the heading, `Use your company email address.`,
which is the only place the domain restriction is stated before a reader hits it.

**action.** One email field with the placeholder `you@company.com`, and one
full-width filled button, `Send sign-in link`.

That is the whole screen. It is centered in the viewport rather than laid out down
the page, and it is one of only two screens in the app with no navigation of any
kind.

## What it carries only sometimes

**While submitting:** the button reads `Sending...` and is disabled.

**When the link has been sent:** the form is **replaced** — not supplemented — by a
centered confirmation: the heading `Check your email`, then `We sent a sign-in link
to {email}. Open it and press Confirm sign-in. It expires in 15 minutes.`

Two things in that sentence are load-bearing. It tells the reader they will have to
**press a button** rather than just open the link, which prepares them for the
confirm screen — the link deliberately does not sign anyone in by itself. And it
states the expiry as a number of minutes, so a reader who comes back to a dead link
knows why.

**When the request fails:** the error from the server, or `Something went wrong`
when there is none. A domain that is not the company's is refused here.

## What must agree elsewhere

**The heading is shared with the confirm screen**, which uses the identical line, so
the two steps of one flow read as one flow.

**`Confirm sign-in` is named here and is the button's actual label on the confirm
screen.** If a redesign renames that button, this sentence is telling the reader to
look for a word that no longer exists.

**The expiry stated here is the real token lifetime**, from the same constant the
validity rule uses. It is 15 minutes and it is single-use.

**The product name lives in exactly one place** and appears on screen only through
it. The company's legal name is a different constant and belongs on the purchase
order PDF, which is what a vendor reads — never here.

**Restricted to the company email domain**, which is why the placeholder shows a
company-shaped address. There is no "sign in with Google", no password, and no
recovery flow, because there is nothing to recover.
