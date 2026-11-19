import Link from "next/link";
import Instant from "@/app/components/Instant";
import UndrawnPage from "@/app/components/UndrawnPage";
import { requireUser } from "@/lib/authz";
import { withOpsLabel } from "@/lib/airtableOps";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getUsersByRecordIds } from "@/lib/airtable/users";
import { itemLabel } from "@/lib/materialIdentity";
import {
    INVENTORY_COPY,
    activityWords,
    canAccessJobInventory,
    inventoryPath,
    materialActivity,
    qtyText,
} from "@/lib/materialStock";
import { readJobInventory } from "@/lib/materialStock.server";
import { userName } from "@/lib/userName";
import IssueForm from "./IssueForm";

const COPY = INVENTORY_COPY.material;

/**
 * One material on one job (#675): what is in stock at each address, what has happened to it —
 * each delivery of it and each row of its log, newest first — and, for a reader who may record,
 * the form that issues it from an address holding some. A job outside the reader's reach, and a
 * material nothing on the job names, read as ones that do not exist.
 *
 * THE FORM IS DRAWN FOR EVERY READER THIS PAGE ADMITS, because the page admits exactly those who
 * may issue (`canAccessJobInventory`), and its action asks again.
 */
export default async function JobMaterialPage(props) {
    return withOpsLabel("/materials/[jobCode]/[materialId]", () => renderJobMaterialPage(props));
}

async function renderJobMaterialPage({ params }) {
    const user = await requireUser();
    const { jobCode, materialId } = await params;
    const code = decodeURIComponent(jobCode);
    const materialRecordId = decodeURIComponent(materialId);
    const job = (await getAllJobs()).find((candidate) => candidate.jobCode === code) ?? null;
    const allowed = job && canAccessJobInventory(user, job.id);
    const read = allowed ? await readJobInventory(job) : null;
    const stock = read?.inventory.get(materialRecordId) ?? null;
    const material = read?.materialById.get(materialRecordId) ?? null;

    if (!stock || !material) {
        return (
            <UndrawnPage measure="list">
                <h1 className="text-2xl font-semibold">{allowed ? INVENTORY_COPY.notFound.material : INVENTORY_COPY.notFound.job}</h1>
                <Link href={allowed ? inventoryPath(job.jobCode) : "/materials"} className="mt-6 inline-block text-sm underline">
                    {allowed ? COPY.back(job.jobCode) : INVENTORY_COPY.notFound.back}
                </Link>
            </UndrawnPage>
        );
    }

    const unit = material.unit ?? "";
    const label = (addressRecordId) => read.addressLabelById.get(addressRecordId) ?? addressRecordId;
    const addresses = [...stock.byAddress]
        .map(([addressRecordId, at]) => ({ addressRecordId, label: label(addressRecordId), ...at }))
        .sort((a, b) => a.label.localeCompare(b.label));
    const activity = materialActivity({ materialRecordId, ...read });
    const users = await getUsersByRecordIds([...new Set(activity.map((row) => row.recordedBy).filter(Boolean))]);
    const nameOf = new Map(users.map((u) => [u.id, userName(u)]));
    const issuable = addresses.filter((at) => at.inStock > 0).map(({ addressRecordId, label: addressLabel, inStock }) => ({ addressRecordId, label: addressLabel, inStock }));
    const columns = INVENTORY_COPY.list.columns;
    const activityColumns = COPY.activityColumns;

    return (
        <UndrawnPage measure="list">
            <Link href={inventoryPath(job.jobCode)} className="text-sm underline">
                {COPY.back(job.jobCode)}
            </Link>
            <h1 className="mt-4 text-2xl font-semibold">{itemLabel(material)}</h1>
            <p className="mt-1 text-sm text-zinc-600">{job.jobCode}</p>

            <h2 className="mt-8 text-lg font-semibold">{COPY.stockHeading}</h2>
            <table className="mt-2 w-full text-sm">
                <thead>
                    <tr className="border-b border-zinc-300 text-left">
                        <th className="py-2 font-medium">{columns.address}</th>
                        {["delivered", "issued", "inStock"].map((key) => (
                            <th key={key} className="w-28 py-2 text-right font-medium">
                                {columns[key]}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {addresses.map((at) => (
                        <tr key={at.addressRecordId} className="border-b border-zinc-200">
                            <td className="py-2 pr-4">{at.label}</td>
                            {["delivered", "issued", "inStock"].map((key) => (
                                <td key={key} className={`py-2 text-right tabular-nums ${key === "inStock" && at[key] < 0 ? "text-red-700" : ""}`}>
                                    {qtyText(at[key], unit)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>

            <IssueForm jobRecordId={job.id} materialRecordId={materialRecordId} unit={unit} addresses={issuable} />

            <h2 className="mt-10 text-lg font-semibold">{COPY.activityHeading}</h2>
            <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[44rem] text-sm">
                    <thead>
                        <tr className="border-b border-zinc-300 text-left">
                            {["date", "what", "address", "by", "at"].map((key) => (
                                <th key={key} className="py-2 pr-4 font-medium">
                                    {activityColumns[key]}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {activity.map((row) => (
                            <tr key={row.key} className="border-b border-zinc-200 align-top">
                                <td className="py-2 pr-4 tabular-nums">{row.date || "—"}</td>
                                <td className="py-2 pr-4">
                                    {activityWords(row, unit)}
                                    {row.deliveryId ? (
                                        <>
                                            {" · "}
                                            <Link href={`/deliveries/${encodeURIComponent(row.deliveryId)}`} className="underline">
                                                {row.deliveryId}
                                            </Link>
                                        </>
                                    ) : null}
                                </td>
                                <td className="py-2 pr-4">{row.addressRecordId ? label(row.addressRecordId) : "—"}</td>
                                <td className="py-2 pr-4">{nameOf.get(row.recordedBy) ?? "—"}</td>
                                <td className="py-2 pr-4">
                                    <Instant at={row.recordedAt} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </UndrawnPage>
    );
}
