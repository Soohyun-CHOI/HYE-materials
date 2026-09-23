import { Inconsolata } from "next/font/google";
import { headers } from "next/headers";
import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { withOpsLabel } from "@/lib/airtableOps";
import { getToolItemsByToolItemIds } from "@/lib/airtable/toolItems";
import { getToolsByRecordIds } from "@/lib/airtable/tools";
import { QR_SIDE_MODULES, buildToolItemQR } from "@/lib/toolLabelQR";
import { MAX_LABELS_PER_REQUEST, TOOL_LABEL_SHEET_COPY as COPY } from "@/lib/toolLabelSheet";
import { TOOLS_PATH, canonicalToolItemId, labelCodeFor } from "@/lib/toolRoutes";
import { TOOL_LIST_COPY } from "@/lib/toolListView";
import LabelSheet from "./LabelSheet";
import "./labels.css";

export const metadata = { title: "Print tool labels" };

// The sheet of labels a printer takes (#353).
//
// THE SYMBOLS ARE BUILT HERE RATHER THAN FETCHED, which is the boundary #351 wrote
// down for this issue. Its endpoint costs two Airtable operations a symbol, so a
// sheet of a hundred fetched one `<img>` at a time would be two hundred requests
// against a base limited to five a second. `buildToolItemQR` is pure and
// importable, so this page pays for its own batched read and nothing more: the
// session, one `Tool Items` query per 50 printed ids, and one `Tools` query per 50
// links. Three operations for any sheet this screen will print.
//
// READ BY PRINTED ID, BATCHED. `getToolItemsByToolItemIds` is the reader that
// exists for this page; the single-id one beside it would be one query per label,
// which is the per-record shape #193 forbids. It returns the table's order and no
// error for an id that resolves to nothing, so the matching back and the account of
// what was missing are this page's own — and the ids are put back into the
// ADDRESS's order, which for a registration is the order its account listed them.
//
// THE HOST IS READ AND SHOWN, AND THAT IS A SAFEGUARD RATHER THAN A DECORATION.
// A symbol encodes the host it was printed from, so a sheet printed on a preview
// domain is thirty stickers pointing at somewhere that will stop resolving.
// docs/notes/tools.md has said not to print a label from a preview host since #340,
// and until this screen existed that was a rule with nothing to attach to. Naming
// the host ON THE SCREEN — never on the label — is what puts it in front of the
// person about to spend a sheet of adhesive stock, and the app is on a Vercel
// domain today, so it is the live case rather than a hypothetical one.
//
// NOTHING IS GATED PER ROW. `requireUser()` is #337's decision for the whole axis:
// no Role, no Job scoping, and no tool item is one reader's rather than another's.

// THE FACE THE PRINTED CODE IS SET IN, LOADED HERE AND NOWHERE ELSE (#431). The
// label's width budget is this face's measured advance —
// `lib/toolLabelSheet.js:CHARACTER_WIDTH_RATIO` — so the code has to print in it, or
// the budget describes letters that are not on the paper. The face is the design's
// choice and `LABEL_CODE_TYPEFACE` names it; `next/font` takes it as a static
// import, so the name is spelled here as well and `offline/tool-label-sheet.mjs`
// compares the two. It reaches this route and the code alone: the root layout and
// the tools layout are where a design is applied to screens, and #336 left the
// second empty for that.
//
// IF THE FACE HAS NOT ARRIVED WHEN PRINT IS PRESSED, THE FALLBACK PRINTS, and
// nothing here can stop that. **Not observed.** The code has the room: ten
// characters at the floor fit under the symbol in any face up to 0.69 of its size
// per character, and the fallback `next/font` declares — Arial at a `size-adjust`
// of 112.16%, read off the rendered page — comes to 0.6.
const labelCodeFont = Inconsolata({ subsets: ["latin"], variable: "--font-label-code" });

export default async function ToolLabelSheetPage({ searchParams }) {
    return withOpsLabel("/tool-items/labels", async () => {
        await requireUser();

        const params = await searchParams;
        const raw = params?.id ?? [];
        const asked = (Array.isArray(raw) ? raw : [raw])
            .map((value) => canonicalToolItemId(value))
            .filter(Boolean);
        // A repeated id in the address would print one tool item twice, which is
        // two stickers for one drill — the failure the whole id family exists to
        // prevent.
        const requested = [...new Set(asked)];
        const printing = requested.slice(0, MAX_LABELS_PER_REQUEST);

        // The public host behind Vercel's proxy rather than the request URL, which
        // is the source `/api/auth/verify` already compares an Origin against.
        const headerList = await headers();
        const host = headerList.get("host") ?? "";
        const proto = headerList.get("x-forwarded-proto") ?? "http";
        const origin = `${proto}://${host}`;

        if (printing.length === 0) {
            return (
                <main>
                    <div className="label-screen-only">
                        <h1>{COPY.heading}</h1>
                        <p>{COPY.noneRequested}</p>
                        <Link href={TOOLS_PATH}>{TOOL_LIST_COPY.backToTools}</Link>
                    </div>
                </main>
            );
        }

        const toolItems = await getToolItemsByToolItemIds(printing);
        const found = new Map(toolItems.map((toolItem) => [toolItem.toolItemId, toolItem]));

        const toolRecordIds = [...new Set(toolItems.map((toolItem) => toolItem.tool[0]).filter(Boolean))];
        const tools = toolRecordIds.length > 0 ? await getToolsByRecordIds(toolRecordIds) : [];
        const toolNames = new Map(tools.map((tool) => [tool.id, tool.toolName]));

        const labels = [];
        const missing = [];
        for (const toolItemId of printing) {
            const toolItem = found.get(toolItemId);
            if (!toolItem) {
                missing.push(toolItemId);
                continue;
            }
            const symbol = await buildToolItemQR({ origin, toolItemId: toolItem.toolItemId });
            labels.push({
                toolItemId: toolItem.toolItemId,
                // WHAT THE STICKER PRINTS, AND IT IS THE SAME STRING THE SYMBOL'S
                // PATH CARRIES (#411). The readable code is the fallback for a
                // scratched symbol, and what that person does with it is type it
                // into the address — so printing one form while routing another
                // would break the path at the only point it is used. The tool
                // item's id stays the key everything else on this page is matched
                // and reported by.
                labelCode: labelCodeFor(toolItem.toolItemId),
                toolName: toolNames.get(toolItem.tool[0]) ?? "",
                svg: symbol.svg,
                // ITS OWN side count, not the constant. The module size is fixed
                // for the stock; the BOX is this symbol's own modules times that,
                // so a longer address prints a bigger symbol rather than a denser
                // one. Sizing every box from `QR_SIDE_MODULES` is the defect #353
                // measured in a browser — see `symbolBox`.
                sideModules: symbol.sideModules,
            });
        }

        // EVERYTHING THAT IS NOT A SHEET SITS INSIDE ONE SCREEN-ONLY WRAPPER, and
        // that is a print requirement rather than tidiness. A sheet is exactly one
        // page tall against a page box with no margin, so ANY ink above the first
        // one takes a page of its own and pushes every sheet down by one — which is
        // what the heading did until it was wrapped. `labels.css` hides this class
        // at print, and `offline/tool-label-sheet.mjs` requires every heading,
        // sentence and link in this file to be inside it.
        //
        // The face's property is defined here, above the sheet, and `.label-id` is
        // the one rule that reads it.
        return (
            <main className={labelCodeFont.variable}>
                <div className="label-screen-only">
                    <h1>{COPY.heading}</h1>
                    {requested.length > printing.length && (
                        <p>{COPY.overCap({ requested: requested.length, cap: MAX_LABELS_PER_REQUEST })}</p>
                    )}
                    {missing.length > 0 && <p>{COPY.missing({ toolItemIds: missing })}</p>}
                    {labels.length === 0 && (
                        <>
                            <p>{COPY.noneFound}</p>
                            <Link href={TOOLS_PATH}>{TOOL_LIST_COPY.backToTools}</Link>
                        </>
                    )}
                </div>
                {labels.length > 0 && (
                    <LabelSheet labels={labels} origin={origin} sideModules={QR_SIDE_MODULES} />
                )}
            </main>
        );
    });
}
