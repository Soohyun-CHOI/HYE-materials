import { requireUser } from "@/lib/authz";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getToolItemsByTool } from "@/lib/airtable/toolItems";
import { getToolsByRecordIds } from "@/lib/airtable/tools";
import { assignedJobsFor } from "@/lib/toolJob";
import { TOOL_LIST_COPY as COPY, pageOfToolItems } from "@/lib/toolListView";
import { TOOL_REGISTRATION_COPY, canRegisterToolItems, readRegistrationAccount } from "@/lib/toolRegistration";
import { TOOLS_PATH } from "@/lib/toolRoutes";
import { withOpsLabel } from "@/lib/airtableOps";
import Breadcrumb from "@/app/components/Breadcrumb";
import { ButtonLink } from "@/app/components/Controls";
import ListFrame from "@/app/components/ListFrame";
import { ListHeader } from "@/app/components/ListTable";
import RegistrationDialog from "../RegistrationDialog";
import RegistrationShortfall from "./RegistrationShortfall";
import RegistrationUnlogged from "./RegistrationUnlogged";
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
 * address and the symbol's version grows with it. `/t/[labelCode]` carries the
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
 * many were asked for and not written — with how many were asked for beside it since
 * #455 — and which of those written have no first log row. This page DOES read those,
 * off the address and for nothing. A box or a step writes an address without them
 * rather than a different value of them (see `toolPath`), and the two controls that
 * remove them, the fork's `Not now` and the notice's `Got it`, each hide what they
 * remove — so the address never holds a different account from the one this render
 * drew, at most less of it, which is what makes a server read correct here and wrong
 * for the selection. The selection is the arrival's whole confirmation and nothing
 * here repeats it (#321); these are what it cannot show. The fork is
 * `RegistrationShortfall.js` and the notice `RegistrationUnlogged.js`, whose headers
 * say why each dismissal edits the address on the client. **Each is a dialog over this
 * page since #459**, told one at a time and the notice first — which is
 * `lib/toolRegistration.js:accountToTell`, asked of this render's reading and of the
 * address as it stands — so both are handed the whole account.
 *
 * AND IT IS WHERE SOMEBODY REGISTERS MORE OF THIS TOOL (#451). One control opens the
 * registration dialog on this tool and with no count — nothing here knows how many
 * were bought — and costs nothing: the name is on the row already read, and the reader
 * and the job list are what this page reads anyway. It is drawn for every tool this page
 * finds, the one with nothing under it included, and for every reader — disabled, with
 * the reason before it, for a reader on no job, as `/tools`' own control and the offer
 * below are (#456). `registerToolItemsAction`'s header records what finding the tool by
 * its name rather than its record id costs.
 *
 * NO COUNT PER STATUS HERE, DELIBERATELY. That is the question one level up, and
 * answering it on this page would mean reading every tool item under the tool —
 * which is the cost the paging exists to avoid. If it is ever wanted here it
 * comes from a rollup, under the same measured condition docs/notes/tools.md
 * already states for the list.
 *
 * DRAWN AS 1b (#463): the breadcrumb and the list's head with how many items the tool has,
 * held still over the rows, the selection bar floating over the pinned pager while anything
 * is selected — `ListFrame.js` and `ListTable.js` for the parts, `ToolItemList.js` for the
 * rows, the boxes and the bar, which read the selection off the address. **Newest first,
 * as 1b draws it** (`pageOfToolItems`), so a registration moves every page's edges, which
 * was accepted: the selection is printed ids and moves with nothing.
 *
 * NO WIDTH OF ITS OWN AND NO TEXT IN THE MARKUP — see the layout (#336), lib/toolListView.js
 * for the rules and lib/toolRoutes.js for the addresses.
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
    const user = await requireUser();
    const { toolRecordId } = await params;
    const sp = (await searchParams) ?? {};

    // Batched by record id, so an id nothing carries comes back as no row rather
    // than as a throw. The id reaches a formula only through `orByRecordId`,
    // which escapes it.
    const [tool] = await getToolsByRecordIds([toolRecordId]);
    if (!tool) {
        // 1l's shape, which the tool item page draws for a code no tool item carries: the
        // heading centered in the column and the way back under it. An address carries a
        // record id here, which says nothing to a reader, so there is no sentence naming it.
        return (
            <div className="flex min-h-full flex-col items-center justify-center px-page-gutter text-center font-ui text-foreground-default">
                <h1 className="text-heading font-semibold">{COPY.notFoundHeading}</h1>
                <div className="mt-gap-lg">
                    <ButtonLink variant="bordered" href={TOOLS_PATH}>
                        {COPY.backToTools}
                    </ButtonLink>
                </div>
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
    const account = readRegistrationAccount({ asked: sp.asked, unwritten: sp.unwritten, unlogged: sp.unlogged });
    // What both openers on this page hand the registration dialog (#456): whether this
    // reader may register at all, which is the one predicate every opener asks, and the
    // jobs its choice offers.
    const canRegister = canRegisterToolItems(user, jobs);
    const assignedJobs = assignedJobsFor(user, jobs).map(({ id, jobCode }) => ({ id, jobCode }));

    // The way back is the breadcrumb's one level since #460, the list's own heading behind a
    // chevron (1b). The tool's name is the heading and there is no heading word, which is
    // the shape the tool item's page takes. Registering more of this tool (#451) is the
    // head's one control, so a tool with nothing under it keeps it — there it is the way to
    // write what a registration did not. It opens the dialog on this tool (#456).
    const top = <Breadcrumb levels={[{ label: COPY.heading, href: TOOLS_PATH }]} />;
    const registration = { opener: TOOL_REGISTRATION_COPY.heading, canRegister, jobs: assignedJobs, tool: { toolName: tool.toolName } };
    const header = (
        <ListHeader title={tool.toolName} count={page.total} noun={COPY.itemNoun(page.total)}>
            <RegistrationDialog {...registration} />
        </ListHeader>
    );

    if (page.total === 0) {
        return (
            <ListFrame top={top} header={header}>
                <div className="flex flex-col items-center pt-list-empty-state-inset-top text-center">
                    <h2 className="text-heading font-semibold">{COPY.noToolItemsHeading}</h2>
                    <p className="mt-gap max-w-empty-state text-body-sm text-pretty text-foreground-muted">{COPY.noToolItems}</p>
                    <div className="mt-gap-lg">
                        <RegistrationDialog {...registration} variant="bordered" />
                    </div>
                </div>
            </ListFrame>
        );
    }

    // The rows this render read, and only those, which is what keeps the page box to this
    // page (#443): the list selects among what it is handed and has no way to name a tool
    // item it was not. What a label run is for is the list's to read off the address, and
    // the print control that opens the labels on it stands in the selection bar with the
    // count; the tool's name is the line under that dialog's title (#457).
    return (
        <ToolItemList
            toolRecordId={tool.id}
            toolName={tool.toolName}
            rows={toolItems.map((toolItem) => ({
                id: toolItem.id,
                toolItemId: toolItem.toolItemId,
                status: toolItem.status,
                jobCode: jobCodeById[toolItem.job?.[0]],
            }))}
            page={page}
            top={top}
            header={header}
        >
            {/* A registration's account, which only a list with rows in it can carry: one
                that wrote nothing stays in the dialog (#449, #456). The fork asks a question
                and the notice states a fact nothing repairs, so the fork's two controls answer
                it and the notice's one only takes it away (#455), and the fork's count never
                includes the notice's tool items, which were written. Each is a dialog since
                #459, one at a time and the notice first; it stands first here too, so when
                its answer hands over to the fork the one closes before the other opens. */}
            {account.unlogged.length > 0 && <RegistrationUnlogged toolName={tool.toolName} account={account} />}
            {account.unwritten > 0 && <RegistrationShortfall toolName={tool.toolName} account={account} canRegister={canRegister} jobs={assignedJobs} />}
        </ToolItemList>
    );
}
