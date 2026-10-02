import Rail from "@/app/components/Rail";
import { brandFace } from "@/app/faces/brand";
import { idFace } from "@/app/faces/id";
import { uiFace } from "@/app/faces/ui";
import { takePageUser } from "@/lib/authz";
import { accountOf } from "@/lib/navigation";

/**
 * The layout every tools screen renders inside (#336).
 *
 * THE COLUMN BELOW IS THE ONLY WIDTH CONTAINER ON THIS AXIS, and that is the whole
 * reason this file exists. The screens above the tools track declare one inside their
 * own page instead — twenty of the twenty-four do, twenty-four declarations in all — so
 * a width settled for that axis lands in about as many places as it has pages. Here it
 * lands in one: the column `Rail` holds a screen in, beside the rail (#460).
 *
 * A TOOLS PAGE MUST NOT DECLARE A WIDTH OF ITS OWN. Nothing fails when one does:
 * the page simply renders at a width this layout did not choose, and the axis
 * quietly has two containers again. That is the state this file is here to
 * prevent, and the prevention is this sentence rather than a check — a file-only
 * check cannot tell a page's container from a `max-w-full` on an image.
 *
 * AND THE BOX UNDER `<body>` IS THIS LAYOUT'S RATHER THAN A PAGE'S, which is the
 * same rule seen from the other side. `<body>` is `min-h-full flex flex-col`, so
 * the flex item is the element below, and a tools page renders inside the rail's
 * column, its own root element an ordinary block. `flex-1` on a tools page's root
 * therefore does nothing, and anything about the axis's own box — filling the
 * height, for one — is decided here and in the rail. **Somebody will copy the two
 * that do it the other way:** `/` puts `flex-1` on its own root div to fill the
 * height, and so does the sign-in steps' layout on its (#473), and it works there
 * because on those the root IS the flex item. This paragraph is reasoned from the
 * rendered DOM rather than measured — `body > div > h1` was read in a browser, and
 * the rest follows from it in CSS.
 *
 * IT HOLDS THE RAIL, AND NO WIDTH, PADDING OR TYPE OF A SCREEN'S (#460). #336 settled
 * WHERE the width is decided and decided no value, so that a value chosen here would
 * not become the baseline a design has to justify departing from
 * (`docs/briefs/_shared.md`). The rail is the design's own frame and is drawn whole;
 * what a screen looks like inside the column is #463's, reading the names
 * `app/designValues.css` declares (#462), and this one element is still the whole of
 * what that issue has to reach for the axis's width.
 *
 * THE ACCOUNT AT THE RAIL'S FOOT IS DRAWN FROM THE PAGE'S READ, AND THIS FILE MAKES
 * NONE (#478). It waits on `takePageUser()` — the user the page's own gate read, or
 * null — and hands the rail `accountOf`'s words, and it never gates: a layout is
 * rendered once and kept across the navigations under it, so a gate here would stand in
 * front of the first page only, and a read here would land outside every page's ops
 * scope. **It waits rather than handing the rail a promise**, and the wait costs nothing:
 * the page waits on the same read, and with no `loading.js` nothing is sent before the
 * page is done. A promise streamed the account in a segment of its own after the page,
 * put in place by a script on a later frame — a late arrival at the rail's foot, measured
 * on every screen but the list (`tools.md`). The address a label prints sits outside this
 * group for the same economy: a redirect has no use for a rail.
 *
 * THE DESIGN'S FACES ARE APPLIED HERE, AND APPLYING ONE STYLES NOTHING (#456). Each
 * face's variable — `--font-ui` reads `--font-instrument-sans` — is defined on this one
 * element, so everything on the axis can take the face and nothing does until it asks
 * for it: the dialogs and the rail set `font-ui`, and the screens behind them keep the
 * face they have until #463 gives them the look. **The faces load in `app/faces/`, one
 * module a face, since #473** gave the sign-in screens a layout that draws two of them:
 * this layout imports all three — #459's Fragment Mono for the ids a landing's notice
 * lists, #460's Bricolage Grotesque for the wordmark — and `offline/design-values.mjs`
 * holds that a face read on this axis is loaded by a module only the design's axes
 * reach. #258 applies them on the root layout's element instead, where Geist's two calls
 * are today. What reaches past this element is only what is a DOM descendant of it — a
 * dialog or a list in the top layer is still one, which is why a face reaches them. The
 * label's Inconsolata stays with the labels' dialog, which loads it (#457): it is the
 * label's measured face and not the design's (`tools.md`).
 *
 * These screens are the only ones in the app used at a phone width as well as at
 * a monitor: a tool is entered and its labels printed at a desk, and a tool item
 * is scanned on site. `docs/notes/tools.md` carries that derivation.
 */

export default async function ToolsLayout({ children }) {
    const user = await takePageUser();
    return (
        <div className={`${uiFace.variable} ${idFace.variable} ${brandFace.variable}`}>
            <Rail account={user ? accountOf(user) : null}>{children}</Rail>
        </div>
    );
}
