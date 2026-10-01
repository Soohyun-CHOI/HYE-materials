// The navigation the design settled (#460): the sections the rail carries, which of
// them a screen is in, and every word the rail and the breadcrumb say. The rail is
// `app/components/Rail.js` and the breadcrumb `app/components/Breadcrumb.js`; this is
// what both of them know, and `docs/notes/tools.md`'s `The navigation` is why.
//
// A SECTION IS A SCREEN TO GO TO, AND THE DESIGN'S `Office` HAS NONE YET. The design
// draws seven sections, `Office` last. `app/admin/` holds four create forms and no
// screen that lists them, and nothing links to any of them, so an `Office` entry would
// lead nowhere. It joins this list with the screen it opens.
//
// WHICH SECTION A SCREEN IS IN IS READ OFF ITS ADDRESS, NOT HANDED OVER BY THE CALLER.
// A section owns the first segments of the routes its screens live under — the tools
// axis owns three, `TOOLS_ROUTES`' own, since a tool item and a printed label are not
// under `/tools` — and `currentOf` asks which one owns the address being read. Two
// things follow, and they are why it is not a prop the tools layout passes. A dialog
// is not a route, so the registration and #457's labels leave the address where the
// page that opened them put it, and the section stays that page's. And the rail
// moves to the root layout at #258, which cannot know what is below it, while an
// address it can always read; nothing here changes when it does. A route no section
// owns — `/`, the sign-in steps, `/addresses/new`, `/admin/*` — is in none.
//
// AND A COLLAPSED ICON'S NAME IS ONE STRING IN TWO PLACES. A section's word is its
// link's accessible name in both widths — clipped out of sight while the rail is
// collapsed, read aloud all the same — and the tooltip beside the collapsed icon draws
// the same string, so the two cannot say different things. The design had them
// differ once, `Expand navigation` named against an `Expand` tooltip; the toggle says
// `Expand navigation` in both.
//
// THE WORDS ARE THE DESIGN'S, AND TWO OF THEM DISAGREE WITH THE SCREENS THEY OPEN.
// `Purchase requests` and `Purchase orders` are sentence case, where those lists' own
// headings still say `Purchase Requests` and `Purchase Orders`; `docs/briefs/_shared.md`
// records it beside the root screen's own, and settling it is a copy decision about
// those screens rather than about this list. `Tools` is the tool list's own heading,
// imported rather than spelled again.
//
// PURE AND OFFLINE-SAFE, importing two modules with the extension spelled out, so the
// rail — a `"use client"` file — can import it and `offline/navigation.mjs` can call it.

import { TOOLS_PATH, TOOLS_ROUTES } from "./toolRoutes.js";
import { TOOL_LIST_COPY } from "./toolListView.js";

/** The first segment of an address or a route template: `/tool-items/[toolItemId]` → `tool-items`. */
function firstSegment(path) {
    return String(path ?? "").split(/[/?#]/)[1] ?? "";
}

/** Every word the rail and the breadcrumb say. */
export const NAVIGATION_COPY = {
    // The rail's own name, the design's: a screen reader announces the landmark by it.
    rail: "Sections",
    // The toggle, collapsed and expanded. Collapsed, this is also the tooltip beside it.
    expand: "Expand navigation",
    collapse: "Collapse navigation",
    // The breadcrumb's landmark, and the mark between two of its levels.
    breadcrumb: "Breadcrumb",
    separator: "/",
    // Each section's word, by its key — the link's name and, collapsed, its tooltip.
    sections: {
        "purchase-requests": "Purchase requests",
        "purchase-orders": "Purchase orders",
        invoices: "Invoices",
        deliveries: "Deliveries",
        tools: TOOL_LIST_COPY.heading,
        "material-prices": "Material prices",
    },
};

/**
 * The sections, in the design's order: each one's key, the address it opens, and the
 * first segments it owns. A materials section owns its own address's; the tools axis
 * owns every first segment its routes start with.
 */
export const NAVIGATION_SECTIONS = Object.freeze(
    [
        { key: "purchase-requests", href: "/prs" },
        { key: "purchase-orders", href: "/pos" },
        { key: "invoices", href: "/invoices" },
        { key: "deliveries", href: "/deliveries" },
        { key: "tools", href: TOOLS_PATH, routes: TOOLS_ROUTES },
        { key: "material-prices", href: "/materials" },
    ].map(({ key, href, routes = [href] }) =>
        Object.freeze({ key, href, segments: Object.freeze([...new Set(routes.map(firstSegment))]) })
    )
);

/**
 * What a section's link says about the address being read: `"page"` when the address
 * IS the section's own, `"true"` when it is a screen under it, and nothing otherwise —
 * the values `aria-current` takes. A tool's page is in Tools without being `/tools`,
 * so its link is the current section rather than the current page.
 */
export function currentOf(section, pathname) {
    const path = String(pathname ?? "").split(/[?#]/)[0];
    if (path === section.href) return "page";
    return section.segments.includes(firstSegment(path)) ? "true" : undefined;
}
