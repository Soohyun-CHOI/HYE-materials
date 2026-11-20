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
    countEditAddresses,
    countWasEdited,
    inventoryPath,
    materialActivity,
    movedBetweenAddresses,
    qtyText,
    signedQtyText,
} from "@/lib/materialStock";
import { readJobInventory } from "@/lib/materialStock.server";
import { userName } from "@/lib/userName";
import { daysWaiting } from "@/lib/deliveryStatus";
import { TRANSIT_COPY, canCancel, canReceive, canSendFrom, canWriteOff, destinationChoices, transitActivityWords } from "@/lib/materialTransit";
import { CancelSendForm, ReceiveForm, WriteOffForm } from "./InTransitForms";
import InTransitCell from "../../InTransitCell";
import EditCountForm from "./EditCountForm";
import IssueForm from "./IssueForm";
import SendForm from "./SendForm";

const COPY = INVENTORY_COPY.material;

/**
 * One material on one job (#675): what is in stock at each address, what has happened to it —
 * each delivery of it and each row of its log, newest first — and, for a reader who may record,
 * the form that issues it from an address holding some. A job outside the reader's reach, and a
 * material nothing on the job names, read as ones that do not exist.
 *
 * THE FORM IS DRAWN FOR EVERY READER THIS PAGE ADMITS, because the page admits exactly those who
 * may issue (`canAccessJobInventory`), and its action asks again.
 *
 * WHAT MOVED BETWEEN ADDRESSES (#677): the sends of this material leaving the job and coming to it
 * while any of them is still in transit — where each goes or came from, the day it was sent and by
 * whom, what is left of it and, for one leaving, how long it has been on the way — with what may be
 * done to each under it: received by the job it goes to, taken back by the job it left, written off
 * by the office. `Received`, `Sent` and `In transit` join the stock table once the material has a
 * figure in one, and the form that sends it sits beside the one that issues it. A receipt in the
 * activity names the day it was sent beside its own day in the Date column. A material that has
 * only ever been sent here is on this page too, since the job's inventory names it.
 *
 * HOW LONG A SEND HAS BEEN ON THE WAY IS COUNTED TO THE SERVER'S DAY, `daysWaiting`'s, as the
 * invoice screens count a wait: the reader's own today is known only in their browser.
 *
 * A COUNT IS EDITED HERE TOO (#678), at any address the stock table draws, by the same readers: the
 * count typed, the change it will record said before the press, a reason and any notes. Once the
 * material has a count edit, `Count edited` joins the stock table, signed, so each row still adds
 * up; the activity says each edit's count before and after, its reason, and its notes under it.
 */
export default async function JobMaterialPage(props) {
    return withOpsLabel("/materials/[jobCode]/[materialId]", () => renderJobMaterialPage(props));
}

async function renderJobMaterialPage({ params }) {
    const user = await requireUser();
    const { jobCode, materialId } = await params;
    const code = decodeURIComponent(jobCode);
    const materialRecordId = decodeURIComponent(materialId);
    const jobs = await getAllJobs();
    const job = jobs.find((candidate) => candidate.jobCode === code) ?? null;
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
    const jobCodeById = new Map(jobs.map((j) => [j.id, j.jobCode]));
    const jobCodeOf = (jobRecordId) => jobCodeById.get(jobRecordId) ?? jobRecordId;
    const addresses = [...stock.byAddress]
        .map(([addressRecordId, at]) => ({ addressRecordId, label: label(addressRecordId), ...at }))
        .sort((a, b) => a.label.localeCompare(b.label));
    const activity = materialActivity({ materialRecordId, ...read });
    const ofThis = (send) => send.materialRecordId === materialRecordId && send.remaining > 0;
    const outgoing = read.outgoing.filter(ofThis);
    const incoming = read.incoming.filter(ofThis);
    const people = [...activity.map((row) => row.recordedBy), ...outgoing.map((send) => send.sentBy), ...incoming.map((send) => send.sentBy)];
    const users = await getUsersByRecordIds([...new Set(people.filter(Boolean))]);
    const nameOf = new Map(users.map((u) => [u.id, userName(u)]));
    const issuable = addresses.filter((at) => at.inStock > 0).map(({ addressRecordId, label: addressLabel, inStock }) => ({ addressRecordId, label: addressLabel, inStock }));
    const columns = INVENTORY_COPY.list.columns;
    const activityColumns = COPY.activityColumns;
    const figures = [
        ...(movedBetweenAddresses(stock) ? ["delivered", "received", "issued", "sent"] : ["delivered", "issued"]),
        ...(countWasEdited(stock) ? ["countEdited"] : []),
        ...(movedBetweenAddresses(stock) ? ["inTransit"] : []),
        "inStock",
    ];
    const today = new Date().toISOString().slice(0, 10);
    const words = (row) => transitActivityWords(row, unit, { sendById: read.sendById, addressLabel: label, jobCode: jobCodeOf, plain: activityWords });

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
                        {figures.map((key) => (
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
                            {figures.map((key) => (
                                <td key={key} className={`py-2 text-right tabular-nums ${key === "inStock" && at[key] < 0 ? "text-red-700" : ""}`}>
                                    {key === "inTransit" ? (
                                        <InTransitCell figures={at} unit={unit} />
                                    ) : key === "countEdited" ? (
                                        signedQtyText(at[key], unit)
                                    ) : (
                                        qtyText(at[key], unit)
                                    )}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>

            {outgoing.length + incoming.length > 0 ? (
                <section>
                    <h2 className="mt-8 text-lg font-semibold">{TRANSIT_COPY.heading}</h2>
                    <ul className="mt-2 divide-y divide-zinc-200 border-y border-zinc-200 text-sm">
                        {outgoing.map((send) => (
                            <li key={`out-${send.id}`} className="py-3">
                                <p className="font-medium">
                                    {TRANSIT_COPY.outgoing(label(send.toAddressRecordId), jobCodeOf(send.toJobRecordId))}
                                </p>
                                <p className="text-zinc-600">
                                    {label(send.fromAddressRecordId)} · {TRANSIT_COPY.sent(send.sentDate, nameOf.get(send.sentBy))} ·{" "}
                                    {TRANSIT_COPY.left(send.remaining, send.qty, unit)} · {TRANSIT_COPY.days(daysWaiting(send.sentDate, today))}
                                </p>
                                {canCancel(user, send) ? <CancelSendForm sentRecordId={send.id} remaining={send.remaining} unit={unit} /> : null}
                                {canWriteOff(user) ? <WriteOffForm sentRecordId={send.id} remaining={send.remaining} unit={unit} /> : null}
                            </li>
                        ))}
                        {incoming.map((send) => (
                            <li key={`in-${send.id}`} className="py-3">
                                <p className="font-medium">
                                    {TRANSIT_COPY.incoming(label(send.fromAddressRecordId), jobCodeOf(send.fromJobRecordId))}
                                </p>
                                <p className="text-zinc-600">
                                    {label(send.toAddressRecordId)} · {TRANSIT_COPY.sent(send.sentDate, nameOf.get(send.sentBy))} ·{" "}
                                    {TRANSIT_COPY.left(send.remaining, send.qty, unit)}
                                </p>
                                {canReceive(user, send) ? <ReceiveForm sentRecordId={send.id} unit={unit} sentDate={send.sentDate} /> : null}
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}

            <IssueForm jobRecordId={job.id} materialRecordId={materialRecordId} unit={unit} addresses={issuable} />
            {canSendFrom(user, job.id) ? (
                <SendForm
                    jobRecordId={job.id}
                    materialRecordId={materialRecordId}
                    unit={unit}
                    addresses={issuable}
                    destinations={destinationChoices({ jobs, addresses: read.addresses, fromJobRecordId: job.id })}
                />
            ) : null}
            <EditCountForm jobRecordId={job.id} materialRecordId={materialRecordId} unit={unit} addresses={countEditAddresses(stock, label)} />


            {/* ONCE IT HAS A ROW, as a delivery's page draws its own (#680): a material only ever sent
                here and not yet received has none, and a header over nothing reads as a table that
                failed (#677). */}
            {activity.length > 0 ? (
                <>
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
                                            {words(row)}
                                            {row.deliveryId ? (
                                                <>
                                                    {" · "}
                                                    <Link href={`/deliveries/${encodeURIComponent(row.deliveryId)}`} className="underline">
                                                        {row.deliveryId}
                                                    </Link>
                                                </>
                                            ) : null}
                                            {row.notes ? <p className="mt-1 whitespace-pre-wrap text-zinc-600">{row.notes}</p> : null}
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
                </>
            ) : null}
        </UndrawnPage>
    );
}
