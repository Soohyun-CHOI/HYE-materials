// The address a seeded or checked delivery is recorded at (#675).
//
// `createDelivery` refuses a delivery with no address since #675, because the inventory counts
// every delivery's quantity at its address. The demo seeds and the credentialed checks record
// deliveries outside the form that asks, so each takes one from here: the job's default
// address, else an address that names the job, else the first address on the base — a check's
// fixture job holds none, and which address a check's delivery stands at is no part of what it
// proves. Reads only.

import { getAllAddresses } from "../../lib/airtable/addresses.js";
import { getJobByRecordId } from "../../lib/airtable/jobs.js";

/** An address record id for a delivery on this job. Throws when the base holds no address at all. */
export async function deliveryAddressFor(jobRecordId) {
    const job = jobRecordId ? await getJobByRecordId(jobRecordId).catch(() => null) : null;
    const own = (job?.deliveryAddress ?? [])[0];
    if (own) return own;
    const addresses = await getAllAddresses();
    const named = addresses.find((address) => (address.jobs ?? []).includes(jobRecordId));
    const chosen = named ?? addresses[0];
    if (!chosen) throw new Error("deliveryAddressFor: the base holds no address to record a delivery at (#675)");
    return chosen.id;
}
