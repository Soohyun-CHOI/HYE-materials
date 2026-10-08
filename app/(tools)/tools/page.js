import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getAllTools } from "@/lib/airtable/tools";
import { getToolItemsByRecordIds } from "@/lib/airtable/toolItems";
import { assignedJobsFor } from "@/lib/toolJob";
import { TOOL_LIST_COPY as COPY, pageOfTools, summarizeTools } from "@/lib/toolListView";
import { toolPath, toolsPath } from "@/lib/toolRoutes";
import { TOOL_STATUS_VALUES } from "@/lib/toolStatus";
import { TOOL_REGISTRATION_COPY, canRegisterToolItems } from "@/lib/toolRegistration";
import { withOpsLabel } from "@/lib/airtableOps";
import { isSiteManager } from "@/lib/siteManager";
import ListFrame from "@/app/components/ListFrame";
import { ListHeader, Pager, TABLE_HEAD, TABLE_ROW, TABLE_ROW_LINK } from "@/app/components/ListTable";
import RegistrationDialog from "./RegistrationDialog";

// The constant rather than a second spelling of the word: the tab and the
// heading are both the table's name and must not drift apart.
export const metadata = { title: COPY.heading };

// 1a's columns: the name, then a count for each status at 96, right-aligned.
const COLUMNS = "grid-cols-[minmax(0,1fr)_repeat(3,var(--width-table-count))]";

/**
 * Every tool the company owns, with a count per status (#339).
 *
 * WHAT IT ANSWERS IS A QUESTION ABOUT THE FLEET rather than about any one tool:
 * how many of each kind of tool there are, and how many of them are out. That is
 * why the row carries three counts and no total — see `summarizeTools` for why a
 * single figure cannot be written without deciding whether a retired tool is
 * still owned.
 *
 * FOUR OPERATIONS, AND THE FOURTH IS THE ONE THAT GROWS. The session find,
 * `getAllTools` — the whole table in one query, bounded by what the company has
 * bought — and then every tool item those tools name, read in one batch of 50 at
 * a time. `getAllTools` already returns each tool's `Tool Items` link array, so
 * finding the units costs no query per tool (#193), and `getToolItemsByRecordIds`
 * was written for exactly this call. **The job list is the third since #456**, read
 * beside the tools rather than after them: the registration dialog opens over this
 * page, and what it offers — the reader's own jobs, or none and a disabled opener —
 * is `/tools/new`'s old read, moved here with the form. The tools it suggests as a
 * name is typed are the list this page has already read, each with its count off the
 * link array, so they cost nothing. **Since #506 it is read for a site manager alone**,
 * since nobody else is offered the dialog it is for, so anybody else's list is one
 * operation less.
 *
 * A READER WHO IS NOT A SITE MANAGER READS THE SAME LIST WITH NO OPENER (#506), in the
 * head or under an empty list: adding tools is a site manager's, and the action behind
 * the dialog refuses anybody else through `withSiteManagerAction`. The empty list keeps
 * its heading and its sentence, which say what the list is for whoever reads it.
 *
 * NO PER-STATUS ROLLUP ON `Tools`, WHICH IS A DECISION WITH A MEASURED TRIGGER.
 * The walk is `ceil(total tool items / 50)`, so this page passes ten operations
 * at 401 tool items; at that point the count moves into a rollup and
 * `Purchase Orders."Uninvoiced Items"` (#244) is the worked example of the move.
 * Five rollups nothing reads today would be five fields to keep in step for
 * nothing. docs/notes/tools.md carries the arithmetic.
 *
 * DRAWN AS 1a (#463): the list's head with how many tools there are, the table under a
 * column head that holds while the rows scroll, and the pager pinned at the foot —
 * `ListFrame.js` and `ListTable.js` for the parts. **It pages at 25 since that issue**,
 * 0b's page of rows, and paging costs nothing: every tool's counts need every tool item,
 * so the page reads them all whichever page it draws and slices what it built
 * (`pageOfTools`). The suggestions the registration offers are every tool, not the page's.
 *
 * ONE EMPTY STATE, NOT THREE. The shared brief's three empties tell "nothing
 * exists yet" from "nothing you can see" and "nothing matching your filters";
 * nothing on this axis is scoped by role or job (#337) and this list has no
 * filters, so only the first has a producer here. It draws a second opener under its
 * sentence, and no pager: there is nothing to page.
 *
 * NO WIDTH OF ITS OWN AND NO TEXT IN THE MARKUP — #336 put this axis's only container
 * in the layout, the 1080 here is the content's measure inside it (0b), and every
 * string comes from a constant so a vocabulary sweep can reach it.
 */
// Labeled for #190 by #224's rule that every entry point opens a scope. An outer
// wrapper and the route template, so repeated loads aggregate into one row.
export default async function ToolsPage(props) {
    return withOpsLabel("/tools", () => renderToolsPage(props));
}

// Every signed-in user, with no Role and no Job scoping (#337): a scan needs an
// account only because it records who performed it, and a tool item moves between
// jobs, so the person scanning one is not always assigned to the job it is on. What a
// reader may DO here is narrower since #506 — adding tools is a site manager's — and
// what everybody may READ is unchanged.
async function renderToolsPage({ searchParams }) {
    const user = await requireUser();
    const sp = (await searchParams) ?? {};
    // Whether this reader adds tools (#506) — the one question every opener below is drawn
    // under, and the reason the job list is read at all.
    const recorder = isSiteManager(user);

    const [tools, allJobs] = await Promise.all([getAllTools(), recorder ? getAllJobs() : []]);
    // The link arrays the tools already carry, flattened into one batched read.
    const toolItems = await getToolItemsByRecordIds(tools.flatMap((tool) => tool.toolItems));
    const rows = summarizeTools(tools, toolItems);
    const page = pageOfTools(rows, sp.page);
    // How many a tool has is its link array's length — the figure its own page heads
    // its list with — and never a sum of statuses, so one word says one number on both.
    const itemCount = Object.fromEntries(tools.map((tool) => [tool.id, tool.toolItems.length]));

    // The control that opens the registration dialog, carrying that dialog's own title so
    // the two cannot drift (#338). It is in the list's head rather than under it because a
    // reader with no tools yet needs it most, and it opens on no tool (#456).
    const registration = {
        opener: TOOL_REGISTRATION_COPY.heading,
        canRegister: canRegisterToolItems(user, allJobs),
        jobs: assignedJobsFor(user, allJobs).map(({ id, jobCode }) => ({ id, jobCode })),
        tools: rows.map((row) => ({ toolName: row.toolName, count: itemCount[row.id] })),
    };

    return (
        <ListFrame
            header={
                <ListHeader title={COPY.heading} count={rows.length} noun={COPY.toolNoun(rows.length)}>
                    {recorder && <RegistrationDialog {...registration} />}
                </ListHeader>
            }
            footer={
                rows.length > 0 && (
                    <Pager
                        range={COPY.range({ from: page.from + 1, to: page.to, total: page.total })}
                        position={COPY.pagePosition(page)}
                        previous={{ href: page.page > 1 ? toolsPath(page.page - 1) : null, label: COPY.previous }}
                        next={{ href: page.page < page.pageCount ? toolsPath(page.page + 1) : null, label: COPY.next }}
                    />
                )
            }
        >
            {rows.length === 0 ? (
                <div className="flex flex-col items-center pt-list-empty-state-inset-top text-center">
                    <h2 className="text-heading font-semibold">{COPY.noToolsHeading}</h2>
                    <p className="mt-gap max-w-empty-state text-body-sm text-pretty text-foreground-muted">{COPY.noTools}</p>
                    {recorder && (
                        <div className="mt-gap-lg">
                            <RegistrationDialog {...registration} variant="bordered" />
                        </div>
                    )}
                </div>
            ) : (
                <div role="table" aria-label={COPY.heading}>
                    <div role="row" className={`${TABLE_HEAD} ${COLUMNS}`}>
                        <span role="columnheader">{COPY.toolLabel}</span>
                        {TOOL_STATUS_VALUES.map((status) => (
                            <span key={status} role="columnheader" className="text-right">
                                {status}
                            </span>
                        ))}
                    </div>
                    {page.rows.map((row) => (
                        <div key={row.id} role="row" className={`${TABLE_ROW} ${COLUMNS}`}>
                            <span role="cell" className="min-w-0 truncate">
                                <Link href={toolPath(row.id)} className={TABLE_ROW_LINK}>
                                    {row.toolName}
                                </Link>
                            </span>
                            {/* All three statuses on every row, a zero included: an absent
                                one would read as "not known" where a `0` reads as "none",
                                and a zero takes Ink 3. The column head is the label, so a
                                count is never carried by color alone. */}
                            {row.counts.map((entry) => (
                                <span
                                    key={entry.status}
                                    role="cell"
                                    className={`text-right tabular-nums ${entry.count === 0 ? "text-foreground-subtle" : ""}`}
                                >
                                    {entry.count}
                                </span>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </ListFrame>
    );
}
