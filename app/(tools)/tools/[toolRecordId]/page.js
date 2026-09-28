import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getToolItemsByTool } from "@/lib/airtable/toolItems";
import { getToolsByRecordIds } from "@/lib/airtable/tools";
import { TOOL_LIST_COPY as COPY, pageOfToolItems } from "@/lib/toolListView";
import { TOOL_REGISTRATION_COPY, readRegistrationAccount } from "@/lib/toolRegistration";
import { TOOLS_PATH } from "@/lib/toolRoutes";
import { withOpsLabel } from "@/lib/airtableOps";
import RegistrationShortfall from "./RegistrationShortfall";
import ToolItemList from "./ToolItemList";

// Static, the way `/materials/[materialId]` is and for the same reason: the
// segment is an Airtable record id, which names nothing a reader would recognize,
// so a tab carrying the tool's name would have to resolve it — and that is a
// SECOND read of the same record, since generateMetadata runs separately from the
// page render and the Airtable SDK deduplicates nothing. The other tools screen
// with a dynamic segment carries the printed id in the URL already, so it names
// its record for no operations at all.
export const metadata = { title: "Tool" };

/**
 * One tool and its tool items, a page at a time (#339).
 *
 * IT IS KEYED ON THE AIRTABLE RECORD ID, which is `/materials/[materialId]`'s
 * answer to the same problem one axis over: `Tools` mints no id, the way
 * `Vendors` and `Materials` mint none, because nothing prints a tool and nobody
 * quotes one. The name a person typed is the identity and it is not a path — it
 * can hold any character, and a rename would move the address. The parameter is
 * `toolRecordId` and not `toolId` deliberately: there is no `Tool ID` field, and
 * a name a reader would search the base for and not find is what
 * docs/notes/naming.md exists to prevent.
 *
 * IT STOOD AT `/tools/tool/[toolRecordId]` UNTIL #348, AND THE HALF THAT SURVIVES
 * THE MOVE IS THE HALF WORTH KNOWING. What forced the extra segment was that the
 * flat slot under `/tools` held the tool item, because a QR code encodes the whole
 * address and the symbol's version grows with it. `/t/[toolItemId]` carries the
 * printed address now, so the slot came free and this page took it. **What did not
 * change is why this is a route at all rather than `/tools?tool=rec…`**: every
 * parameter this app carries narrows which rows appear, opens a form on a record
 * or accounts for something the arrival does not say, and none of them changes
 * what the page is a list of — a route rendering two different tables is a shape
 * the brief system, one file per page, cannot describe.
 *
 * FOUR OPERATIONS, WHATEVER THE TOOL'S SIZE. The session find, the tool, the one
 * batched read of this page's tool items, and the job list. The page is chosen
 * from the tool's own `Tool Items` link array BEFORE anything is fetched, so a
 * tool with three hundred units costs exactly what a tool with three costs, and
 * the total the screen states comes from that array's length for nothing.
 *
 * AND WHATEVER IS SELECTED (#443). Which tool items a label run is for rides in the
 * address as `id`, and this page never reads it: `ToolItemList.js` beside it reads
 * it off the address and rewrites it on every press without a render, and its header
 * says why the page cannot be the reader the way `/login`'s is (#373). So an id
 * selected on another page is never fetched here, and a press costs no operation.
 *
 * AND WHATEVER A REGISTRATION LANDS WITH (#449). A registration arrives here with what
 * it wrote selected, and its address carries two things more when they happened: how
 * many were asked for and not written, and which of those written have no
 * `Registered` row. This page DOES read those, off the address and for nothing. A box
 * or a step writes an address without them rather than a different value of them (see
 * `toolPath`), and the one control that removes one, the fork's dismissal, hides what
 * it removes — so the address never holds a different account from the one this
 * render drew, at most none, which is what makes a server read correct here and wrong
 * for the selection. The selection is the arrival's whole confirmation and nothing
 * here repeats it (#321); these are what it cannot show. The notice is drawn here and
 * the fork is `RegistrationShortfall.js`, whose header says why its dismissal edits
 * the address on the client.
 *
 * NO COUNT PER STATUS HERE, DELIBERATELY. That is the question one level up, and
 * answering it on this page would mean reading every tool item under the tool —
 * which is the cost the paging exists to avoid. If it is ever wanted here it
 * comes from a rollup, under the same measured condition docs/notes/tools.md
 * already states for the list.
 *
 * NO WIDTH, NO COLOR, NO SPACING, AND NO TEXT IN THE MARKUP — see the layout
 * (#336), lib/toolListView.js for the rules and lib/toolRoutes.js for the
 * addresses.
 */
// Labeled for #190 by #224's rule that every entry point opens a scope. An outer
// wrapper and the route template, so every page of every tool aggregates into one
// row rather than one per record.
export default async function ToolPage(props) {
    return withOpsLabel("/tools/[toolRecordId]", () => renderToolPage(props));
}

// Every signed-in user, with no Role and no Job scoping (#337) — the same reader
// the rest of this axis has.
async function renderToolPage({ params, searchParams }) {
    await requireUser();
    const { toolRecordId } = await params;
    const sp = (await searchParams) ?? {};

    // Batched by record id, so an id nothing carries comes back as no row rather
    // than as a throw. The id reaches a formula only through `orByRecordId`,
    // which escapes it.
    const [tool] = await getToolsByRecordIds([toolRecordId]);
    if (!tool) {
        return (
            <div>
                <h1>{COPY.notFoundHeading}</h1>
                <Link href={TOOLS_PATH}>{COPY.backToTools}</Link>
            </div>
        );
    }

    // The slice is decided here and the read follows it. `pageOfToolItems` clamps
    // as well as slices, so a typed or copied `?page=` never lands on an empty
    // screen for a page that exists.
    //
    // `rowIds: page.ids` IS WHAT DIVIDES THE READ, AND TWO CLAIMS REST ON IT (#442):
    // the four operations above, and the page box below selecting one page (#443;
    // until then the second claim was the print control sending one page). Without
    // it `getToolItemsByTool` reads the tool's whole link array, and this screen
    // reads every tool item under the tool and offers every one of them to the page
    // box with nothing on screen to show it — so `offline/tool-list-view.mjs` reads
    // the argument off the source, and the rows this hands the list, rather than
    // trusting a figure.
    const page = pageOfToolItems(tool.toolItems, sp.page);
    const [toolItems, jobs] = await Promise.all([
        getToolItemsByTool(tool.id, { rowIds: page.ids }),
        getAllJobs(),
    ]);

    const jobCodeById = Object.fromEntries(jobs.map((job) => [job.id, job.jobCode]));
    const account = readRegistrationAccount({ unwritten: sp.unwritten, unlogged: sp.unlogged });

    return (
        <div>
            {/* The tool's name is the heading and there is no heading word, which
                is the shape the tool item's page takes with its printed id. */}
            <h1>{tool.toolName}</h1>
            <Link href={TOOLS_PATH}>{COPY.backToTools}</Link>

            {page.total === 0 ? (
                <p>{COPY.noToolItems}</p>
            ) : (
                <>
                    {/* A registration's account, which only a list with rows in it can
                        carry: one that wrote nothing stays on the form (#449). The fork
                        carries two controls and the notice none, which is the difference
                        between a choice and a fact nothing repairs; they stand apart, and
                        the fork's count never includes the notice's tool items, which
                        were written. */}
                    {account.unwritten > 0 && (
                        <RegistrationShortfall toolName={tool.toolName} unwritten={account.unwritten} />
                    )}
                    {account.unlogged.length > 0 && (
                        <div>
                            <p>{TOOL_REGISTRATION_COPY.unlogged}</p>
                            <ul>
                                {account.unlogged.map((toolItemId) => (
                                    <li key={toolItemId}>{toolItemId}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <p>{COPY.total(page.total)}</p>

                    {/* The rows this render read, and only those, which is what
                        keeps the page box to this page (#443): the list selects
                        among what it is handed and has no way to name a tool item
                        it was not. What a label run is for is the list's to read
                        off the address, and the print control that sends it lives
                        there with the boxes that make it. */}
                    <ToolItemList
                        toolRecordId={tool.id}
                        rows={toolItems.map((toolItem) => ({
                            id: toolItem.id,
                            toolItemId: toolItem.toolItemId,
                            status: toolItem.status,
                            jobCode: jobCodeById[toolItem.job?.[0]],
                        }))}
                        page={page.page}
                        pageCount={page.pageCount}
                    />
                </>
            )}
        </div>
    );
}
