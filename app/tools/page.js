import { requireUser } from "@/lib/authz";
import { withOpsLabel } from "@/lib/airtableOps";

export const metadata = { title: "Tools" };

/**
 * The tools axis's first screen (#336), and it is one heading.
 *
 * WHAT IT IS FOR IS THE LAYOUT UNDER IT rather than the content on it. #334 and
 * #335 delivered three tables and an ID and no screen at all, so nothing showed
 * that a tools page stands; a layout with no page beneath it renders nothing,
 * which is why this issue leaves one behind.
 *
 * IT READS NO TOOL TABLE, DELIBERATELY. `getAllTools` names this route in its own
 * docstring as the list of kinds, and #339 is the issue that puts that list here
 * — what this screen carries is that issue's to decide, and a list invented ahead
 * of it would be a shape #339 has to argue its way out of. The one operation this
 * page makes is the session's user read.
 *
 * The heading is the table's name, which is the standing rule for a concept with
 * a table behind it, and the same rule `Purchase Requests`, `Invoices` and
 * `Deliveries` already follow. It carries no styling for the reason the layout's
 * container carries none.
 */
// Labeled for #190 by #224's rule that every entry point opens a scope. An outer
// wrapper and the route template, so repeated loads aggregate into one row.
export default async function ToolsPage() {
    return withOpsLabel("/tools", () => renderToolsPage());
}

// Every signed-in user, with no Role and no Job scoping (#337): a scan needs an
// account only because it records who performed it, and a tool item moves between
// jobs, so the person scanning one is not always assigned to the job it is on.
async function renderToolsPage() {
    await requireUser();

    return <h1>Tools</h1>;
}
