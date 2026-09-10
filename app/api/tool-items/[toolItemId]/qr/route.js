import { NextResponse } from "next/server";
import { withOpsLabel } from "@/lib/airtableOps";
import { getActiveUser } from "@/lib/authz";
import { buildToolItemQR } from "@/lib/toolLabelQR";
import { getToolItemByToolItemId } from "@/lib/airtable/toolItems";

// One tool item's QR symbol, as SVG, generated on request and stored nowhere (#351).
//
// WHY IT IS GENERATED RATHER THAN STORED. The symbol is a pure function of the id
// and the host, so storing one would be a second copy of a string the base already
// holds — and the copy would be the stale one the day the host changes. Nothing on
// this axis has a `Tool Items` attachment field and nothing needs one.
//
// THE RECORD IS READ, AND THAT IS THIS ROUTE'S ONE JUDGMENT. A symbol can be built
// with no read at all, which is exactly why the read has to be argued for: a label
// for an id with no row behind it is a sticker that leads nowhere, and the person
// who discovers that is on a site holding a phone in front of a drill. The read is
// also what keeps user input out of the response — the string encoded is the
// RECORD's own `Tool Item ID` rather than whatever the path carried, so no spelling
// the base does not hold can reach the SVG.
//
// TWO OPERATIONS PER SYMBOL, AND WHAT THAT MEANS FOR A SHEET. The session and the
// tool item, both once. A hundred labels fetched one `<img>` at a time is two
// hundred requests against a base Airtable limits to five a second, so a sheet does
// NOT come through here: `lib/toolLabelQR.js` is pure and a screen rendering many
// symbols imports it and pays for the batched read it already makes (#353). This
// route is the single-label address — the tool item's own page (#352), a reprint,
// anywhere an `<img>` is the natural shape.
//
// CACHED FOR A YEAR AND `private`. The mapping from an id to its symbol is fixed for
// the life of the id, which is #340's argument for `permanentRedirect` one level
// over: a `Tool Item ID` is minted once and printed, nothing deletes a tool item,
// and `Retired` takes one out of the count while keeping its row. The cache key is
// this origin's URL, so a host change cannot serve a symbol for the old host.
// `private` rather than `public` because the response sits behind a session, and a
// gated response in a shared cache is not a rule this app breaks for 1.2 KB — even
// bytes that carry nothing the requester did not supply.
//
// WHAT `immutable` COSTS, MEASURED RATHER THAN INFERRED: a browser serves the cached
// symbol without asking, so a reader who has signed out still sees one they already
// fetched in that profile. Observed while verifying the gate — three fetches of one
// URL produced one server request, and a `credentials: "omit"` fetch came back 200
// from the cache while `curl` with no cookie got the 401. That is accepted rather
// than worked around: the symbol encodes the id that was in the path, so a stale
// cached copy tells its holder nothing they did not already type. Anything with a
// fact of its own in it would need `no-store` instead.
//
// A `Retired` TOOL ITEM STILL GETS ONE. Its label may be on the object, and a
// reprint of a worn label is the same act whatever the status says. No status rule
// is written here because none was asked for.

export async function GET(request, { params }) {
    return withOpsLabel("GET /api/tool-items/[toolItemId]/qr", async () => {
        const user = await getActiveUser();
        // A plain 401 rather than a redirect to /login: the consumer is an `<img>`,
        // and a redirect puts an HTML document in an image slot. `requireUser()`
        // cannot be used at all — redirect() is for the page-render pipeline.
        if (!user) {
            return new NextResponse("Sign in to read this.", {
                status: 401,
                headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
            });
        }

        const { toolItemId } = await params;
        const toolItem = await getToolItemByToolItemId(decodeURIComponent(toolItemId));
        if (!toolItem) {
            return new NextResponse("Not found.", {
                status: 404,
                headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
            });
        }

        // The origin the label will carry, from the public host behind Vercel's
        // proxy rather than from `request.url` — the same source `/api/auth/verify`
        // compares an Origin against. A label encodes where it was printed from,
        // which is the one value that cannot disagree with reality.
        const host = request.headers.get("host");
        const proto = request.headers.get("x-forwarded-proto") ?? "http";
        const { svg } = await buildToolItemQR({
            origin: `${proto}://${host}`,
            toolItemId: toolItem.toolItemId,
        });

        return new NextResponse(svg, {
            status: 200,
            headers: {
                "content-type": "image/svg+xml; charset=utf-8",
                // Nothing user-supplied reaches these bytes and the SVG carries no
                // script, so this is belt and braces rather than the door it is on
                // `/api/files` — where an attachment can claim any type.
                "x-content-type-options": "nosniff",
                "cache-control": "private, max-age=31536000, immutable",
            },
        });
    });
}
