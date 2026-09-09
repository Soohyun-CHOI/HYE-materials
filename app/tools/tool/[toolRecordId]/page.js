import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getToolItemsByTool } from "@/lib/airtable/toolItems";
import { getToolsByRecordIds } from "@/lib/airtable/tools";
import { TOOL_LIST_COPY as COPY, pageOfToolItems, toolPagePath } from "@/lib/toolListView";
import { withOpsLabel } from "@/lib/airtableOps";

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
 * AND IT STANDS A LEVEL DEEPER BECAUSE THE FLAT SLOT IS SPENT. `/tools/[toolItemId]`
 * is the address a QR code carries, and the symbol's version grows with the
 * string — thinner modules on a sticker of the same size, read through oil and
 * wear — so #336 reserved that segment and #340 occupies it. A tool therefore
 * says its own name in the path. The alternative was naming the tool in a query
 * parameter on `/tools`, which would make one route render two different tables:
 * every parameter this app carries narrows which rows appear or opens a form on a
 * record, and none of them changes what the page is a list of.
 *
 * FOUR OPERATIONS, WHATEVER THE TOOL'S SIZE. The session find, the tool, the one
 * batched read of this page's tool items, and the job list. The page is chosen
 * from the tool's own `Tool Items` link array BEFORE anything is fetched, so a
 * tool with three hundred units costs exactly what a tool with three costs, and
 * the total the screen states comes from that array's length for nothing.
 *
 * NO COUNT PER STATUS HERE, DELIBERATELY. That is the question one level up, and
 * answering it on this page would mean reading every tool item under the tool —
 * which is the cost the paging exists to avoid. If it is ever wanted here it
 * comes from a rollup, under the same measured condition docs/notes/tools.md
 * already states for the list.
 *
 * NO WIDTH, NO COLOR, NO SPACING, AND NO TEXT IN THE MARKUP — see the layout
 * (#336) and lib/toolListView.js.
 */
// Labeled for #190 by #224's rule that every entry point opens a scope. An outer
// wrapper and the route template, so every page of every tool aggregates into one
// row rather than one per record.
export default async function ToolPage(props) {
    return withOpsLabel("/tools/tool/[toolRecordId]", () => renderToolPage(props));
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
                <Link href="/tools">{COPY.backToTools}</Link>
            </div>
        );
    }

    // The slice is decided here and the read follows it. `pageOfToolItems` clamps
    // as well as slices, so a typed or copied `?page=` never lands on an empty
    // screen for a page that exists.
    const page = pageOfToolItems(tool.toolItems, sp.page);
    const [toolItems, jobs] = await Promise.all([
        getToolItemsByTool(tool.id, { rowIds: page.ids }),
        getAllJobs(),
    ]);

    const jobCodeById = Object.fromEntries(jobs.map((job) => [job.id, job.jobCode]));

    return (
        <div>
            {/* The tool's name is the heading and there is no heading word, which
                is the shape the tool item's page takes with its printed id. */}
            <h1>{tool.toolName}</h1>
            <Link href="/tools">{COPY.backToTools}</Link>

            {page.total === 0 ? (
                <p>{COPY.noToolItems}</p>
            ) : (
                <>
                    <p>{COPY.total(page.total)}</p>

                    {/* Oldest first, which is the link array's own order and so
                        ascending `Tool Item ID` — the number a person reads off a
                        label. Nothing sorts. */}
                    <ol>
                        {toolItems.map((toolItem) => (
                            <li key={toolItem.id}>
                                <dl>
                                    <div>
                                        <dt>{COPY.toolItemLabel}</dt>
                                        <dd>
                                            <Link
                                                href={`/tools/${encodeURIComponent(toolItem.toolItemId)}`}
                                            >
                                                {toolItem.toolItemId}
                                            </Link>
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>{COPY.statusLabel}</dt>
                                        <dd>{toolItem.status}</dd>
                                    </div>
                                    <div>
                                        <dt>{COPY.jobLabel}</dt>
                                        <dd>{jobCodeById[toolItem.job?.[0]]}</dd>
                                    </div>
                                </dl>
                            </li>
                        ))}
                    </ol>

                    {/* Which page this is, stated whether or not there is a
                        second one: #326 names "nothing on screen says whether a
                        reader is looking at everything or at the beginning of it"
                        as the defect, and a position that appears only once a
                        list is long leaves the short case saying nothing. The two
                        steps are absent at the ends rather than drawn dead. */}
                    <p>{COPY.pagePosition(page)}</p>
                    {page.page > 1 && (
                        <Link href={toolPagePath(tool.id, page.page - 1)}>{COPY.previous}</Link>
                    )}
                    {page.page < page.pageCount && (
                        <Link href={toolPagePath(tool.id, page.page + 1)}>{COPY.next}</Link>
                    )}
                </>
            )}
        </div>
    );
}
