import Link from "next/link";
import UndrawnPage from "@/app/components/UndrawnPage";
import { requireUser } from "@/lib/authz";
import { withOpsLabel } from "@/lib/airtableOps";
import { getAllJobs } from "@/lib/airtable/jobs";
import { INVENTORY_COPY, canAccessJobInventory, inventoryRows, offersAddressView } from "@/lib/materialStock";
import { readJobInventory } from "@/lib/materialStock.server";
import InventoryTable from "./InventoryTable";

/**
 * One job's materials (#675): a row per material ordered, delivered or issued on the job, with
 * what was ordered, delivered and issued and what is in stock; and, for a job holding material
 * at two addresses or more, the same by address. A job outside the reader's reach reads as one
 * that does not exist.
 *
 * WHAT IT READS: the jobs (which carry each job's deliveries and log rows), those by id, the
 * ordered items through delivery entry's walk, the materials by id and the address table —
 * `lib/materialStock.server.js` has the count, which does not grow with the jobs or the
 * materials.
 */
export default async function JobInventoryPage(props) {
    return withOpsLabel("/materials/[jobCode]", () => renderJobInventoryPage(props));
}

async function renderJobInventoryPage({ params }) {
    const user = await requireUser();
    const { jobCode } = await params;
    const code = decodeURIComponent(jobCode);
    const job = (await getAllJobs()).find((candidate) => candidate.jobCode === code) ?? null;

    if (!job || !canAccessJobInventory(user, job.id)) {
        return (
            <UndrawnPage measure="list">
                <h1 className="text-2xl font-semibold">{INVENTORY_COPY.notFound.job}</h1>
                <Link href="/materials" className="mt-6 inline-block text-sm underline">
                    {INVENTORY_COPY.notFound.back}
                </Link>
            </UndrawnPage>
        );
    }

    const { inventory, materialById, addressLabelById } = await readJobInventory(job);
    const { rows, groups } = inventoryRows({ inventory, materialById, addressLabelById });

    return (
        <UndrawnPage measure="list">
            <Link href="/materials" className="text-sm underline">
                {INVENTORY_COPY.notFound.back}
            </Link>
            <h1 className="mt-4 text-2xl font-semibold">
                {INVENTORY_COPY.heading} · {job.jobCode}
            </h1>
            {job.jobName ? <p className="mt-1 text-sm text-zinc-600">{job.jobName}</p> : null}
            {rows.length === 0 ? (
                <p className="mt-6 text-sm text-zinc-600">{INVENTORY_COPY.list.empty}</p>
            ) : (
                <InventoryTable jobCode={job.jobCode} rows={rows} groups={groups} offersByAddress={offersAddressView(inventory)} />
            )}
        </UndrawnPage>
    );
}
