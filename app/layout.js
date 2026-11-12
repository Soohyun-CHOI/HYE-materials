import Rail from "@/app/components/Rail";
import { brandFace } from "@/app/faces/brand";
import { idFace } from "@/app/faces/id";
import { uiFace } from "@/app/faces/ui";
import { takePageUser } from "@/lib/authz";
import { accountOf } from "@/lib/navigation";
import { PRODUCT_NAME } from "@/lib/productName";
import "./globals.css";

// Both values were still create-next-app's defaults (#201). `template` is what
// lets every other page state only its own name — a page exports the bare
// "Invoices" and the tab reads that followed by the product name, which is
// appended in one place here rather than repeated per route. `default` covers
// the routes exporting no metadata of their own: `/login`, its name step and its
// job step, whose tab is the product, and the address a label prints, which only
// redirects. (This said the home page and a Client Component `/login`; `/` has led
// elsewhere since #542 and `/login` is a Server Component, corrected per #181.)
export const metadata = {
  title: {
    default: PRODUCT_NAME,
    template: `%s · ${PRODUCT_NAME}`,
  },
  description:
    "Purchase requests, purchase orders, invoices and deliveries for Hanyang ENG.",
};

/**
 * The one layout every screen renders inside (#258): the document, the design's ground, ink
 * and faces, and the rail with the column a screen stands in.
 *
 * THE GROUND, THE INK AND THE FACES ARE APPLIED HERE ONCE. Each face's variable is set on
 * `<html>` by its module in `app/faces/` — `--font-ui` reads `--font-instrument-sans` — and
 * `<body>` takes White, Ink and the UI face, which every word on every screen inherits. The
 * assets layout and the sign-in layout applied them to their own elements until #258, and the
 * screens above the assets axis drew in the Arial `app/globals.css` set on `<body>`, while
 * this file loaded Geist Sans and Geist Mono for every page and no element drew either. So
 * those two went, and with them the stylesheet's own face. **The faces load in `app/faces/`,
 * one module a face**, and this file is the one that imports them, so every route preloads
 * all three — the sign-in steps Fragment Mono among them, which they do not draw and which
 * replaced the two unread faces they preloaded before. `offline/design-values.mjs` holds that
 * this is the one file applying a face and that every face loaded is read. A dialog or a list
 * in the top layer is still a DOM descendant of `<body>`, which is why the face reaches them.
 * The label's Inconsolata stays with the labels' dialog, which loads it (#457): it is the
 * label's measured face and not the design's.
 *
 * THE RAIL STANDS BESIDE EVERY SCREEN BUT THE SIGN-IN STEPS, and decides that itself. This
 * layout cannot know which page is below it, so `Rail` reads the address: on a sign-in step it
 * hands back the step, which `app/login/layout.js` draws whole, directly under `<body>`; on
 * every other address it draws 0m's rail and the column the screen stands in (`Rail.js`).
 *
 * THIS LAYOUT HOLDS NO WIDTH, PADDING OR TYPE OF A SCREEN'S, and neither does the rail. The
 * column is the one container, the window less the rail, and a screen's measure is its own:
 * one the design draws takes it from the design's names (`app/components/ListTable.js`'s
 * `LIST_MEASURE`, the record page's `max-w-content`), and one it has not drawn yet stands in
 * `app/components/UndrawnPage.js`, which holds the measures those pages each declared until
 * #258. **A page must not declare a width of its own**, and `offline/design-values.mjs`
 * fails a centered measure written anywhere but that file. The box under `<body>` is the
 * rail's frame, so `flex-1` on a page's root does nothing from the phone's edge up — the
 * column is a block there — and a page that fills the height says `min-h-full`, as
 * `UndrawnPage`'s `notice` does; the sign-in steps' layout is the flex item itself and its
 * `flex-1` works, since nothing stands between it and `<body>`.
 *
 * THE ACCOUNT AT THE RAIL'S FOOT IS DRAWN FROM THE PAGE'S READ, AND THIS FILE MAKES NONE
 * (#478). It waits on `takePageUser()` — the user the page's own gate read, or null — and
 * hands the rail `accountOf`'s words, and it never gates: a layout is rendered once and kept
 * across the navigations under it, so a gate here would stand in front of the first page
 * only, and a read here would land outside every page's ops scope. **It waits rather than
 * handing the rail a promise**, and the wait costs nothing: the page waits on the same read,
 * and with no `loading.js` nothing is sent before the page is done. A sign-in step's read
 * answers nothing the rail draws, since the rail draws nothing there, and a step's action
 * that leads on renders this file again: Next renders an action's redirect with no router
 * tree, so the layout above it is drawn afresh (`createRedirectRenderResult`, 16.2.10).
 */
export default async function RootLayout({ children }) {
  const user = await takePageUser();
  return (
    <html
      lang="en"
      className={`${uiFace.variable} ${idFace.variable} ${brandFace.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white font-ui text-foreground-default">
        <Rail account={user ? accountOf(user) : null}>{children}</Rail>
      </body>
    </html>
  );
}
