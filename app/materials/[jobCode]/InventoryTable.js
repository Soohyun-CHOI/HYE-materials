"use client";

import Link from "next/link";
import { useState } from "react";
import { LIST_TABLE_CLASS } from "@/app/components/listTableWidth";
import { INVENTORY_COPY, inventoryPath, qtyText, signedQtyText } from "@/lib/materialStock";
import InTransitCell from "../InTransitCell";

const COPY = INVENTORY_COPY.list;

/**
 * A job's materials, all addresses together or one group per address (#675). The choice is
 * offered only to a job holding material at two addresses or more — at one, the two views would
 * be the same table — and it is the reader's for this visit alone: it changes what is drawn,
 * not what is read, so nothing about it reaches the address.
 *
 * WHAT WAS ORDERED IS THE JOB'S, so the view by address has no column for it: an order's
 * address is where the vendor was told to send it and stock is counted where a delivery was
 * recorded, and splitting one by the other would draw differences no one made.
 *
 * WHAT MOVED BETWEEN ADDRESSES (#677) is three columns more once any material on the job has a
 * figure in one (`showsTransit`): `Received`, `Sent` — what left, less what was taken back — and
 * `In transit`, which says on the row what is leaving it and what is coming to it. With them the row
 * adds up: in stock is delivered and received, less issued and sent.
 *
 * WHAT COUNT EDITS CHANGED (#678) is one column more once any material on the job has one
 * (`showsCountEdits`), `Count edited`, signed since an edit moves a count either way — so the row
 * still adds up.
 */
export default function InventoryTable({ jobCode, rows, groups, offersByAddress, withTransit, withCountEdits }) {
    const [byAddress, setByAddress] = useState(false);
    const showByAddress = offersByAddress && byAddress;

    return (
        <div className="mt-6">
            {offersByAddress ? (
                <div role="group" aria-label={COPY.viewLabel} className="mb-4 flex gap-2 text-sm">
                    {[
                        [false, COPY.views.all],
                        [true, COPY.views.byAddress],
                    ].map(([value, label]) => (
                        <button
                            key={label}
                            type="button"
                            aria-pressed={showByAddress === value}
                            onClick={() => setByAddress(value)}
                            className={`rounded border px-3 py-1 ${showByAddress === value ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300"}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            ) : null}
            {showByAddress ? (
                groups.map((group) => (
                    <section key={group.addressRecordId} className="mb-8">
                        <h2 className="mb-2 text-lg font-semibold">{group.label}</h2>
                        <MaterialTable jobCode={jobCode} rows={group.rows} withOrdered={false} withTransit={withTransit} withCountEdits={withCountEdits} />
                    </section>
                ))
            ) : (
                <MaterialTable jobCode={jobCode} rows={rows} withOrdered withTransit={withTransit} withCountEdits={withCountEdits} />
            )}
        </div>
    );
}

function MaterialTable({ jobCode, rows, withOrdered, withTransit, withCountEdits }) {
    const figures = [
        ...(withOrdered ? ["ordered"] : []),
        ...(withTransit ? ["delivered", "received", "issued", "sent"] : ["delivered", "issued"]),
        ...(withCountEdits ? ["countEdited"] : []),
        ...(withTransit ? ["inTransit"] : []),
        "inStock",
    ];
    return (
        <div className="overflow-x-auto">
            <table className={LIST_TABLE_CLASS}>
                <thead>
                    <tr className="border-b border-zinc-300 text-left">
                        <th className="py-2 font-medium">{COPY.columns.material}</th>
                        {figures.map((key) => (
                            <th key={key} className="w-28 py-2 text-right font-medium">
                                {COPY.columns[key]}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.materialRecordId} className="border-b border-zinc-200">
                            <td className="py-2 pr-4">
                                <Link href={inventoryPath(jobCode, row.materialRecordId)} className="underline">
                                    {row.label}
                                </Link>
                            </td>
                            {figures.map((key) => (
                                <td key={key} className={`py-2 text-right tabular-nums ${key === "inStock" && row[key] < 0 ? "text-red-700" : ""}`}>
                                    {key === "inTransit" ? (
                                        <InTransitCell figures={row} unit={row.unit} />
                                    ) : key === "countEdited" ? (
                                        signedQtyText(row[key], row.unit)
                                    ) : (
                                        qtyText(row[key], row.unit)
                                    )}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
