// Correcting a recorded delivery's address (#680) — every read and write it makes. The judgment
// and the words are `lib/deliveryAddress.js`; why a delivery's address may be corrected at all is
// that module's header.
//
// WHO: WHOEVER MAY RECORD A DELIVERY ON ITS JOB. `canAccessJobDeliveries` — anyone assigned to the
// job, and the office and the President on every job — and the job open, `createDeliveryAction`'s
// two questions asked of the job the delivery already names. The decision and the write live here
// rather than in the Server Action so that a script can call the real guard, `deliveryDelete.js`'s
// arrangement; the action adds the session and the redirect.
//
// THE ORDER, AND WHAT EACH STEP IS FOR.
//   1. Under a lock on the delivery, read it, its job and every address, and refuse what the pure
//      judgment refuses — no address, an unknown one, a page drawn before the address changed, the
//      address it already stands at, one off the job — and a closed job.
//   2. Read the stock before the write and refuse when taking this delivery off its address would
//      leave a material there below zero: `shortfallWithout`, the judgment a delete asks (#675).
//   3. Write the new address. The delivery's stock moves with it, since it is read off the delivery.
//   4. Read the stock again, and if a material on the delivery now stands below zero at the address
//      it left, write the old address back and refuse — `recordIssue`'s take-back, for the write an
//      issue cannot see before it lands.
//   5. Out of the lock, append the `Delivery Log` row. Its id is minted under the delivery's own
//      child lock, and two locks are never nested. If it fails the address is written back, so a
//      correction never stands without its row.
//
// HOW FAR AN ISSUE AT THE SAME ADDRESS IS HELD OFF, which is `lib/materialStock.server.js`'s three
// steps applied to a second kind of write:
//   - a second press of one button: the form is busy while its submission is in flight;
//   - two corrections of one delivery in one process: the lock, and the delivery read again under
//     it, so the second sees where the first left it and is refused as out of date;
//   - an issue at the address the delivery leaves, in this process or another: no shared lock — an
//     issue locks one material at one address and a correction moves every material on the
//     delivery at once, and two locks are never nested — so the reads after each write hold it. An
//     issue reads its stock after its write and a correction after its own, and the later of the
//     two writes is read after the earlier lands, so they cannot both stand; both may be taken
//     back, which leaves nothing overdrawn.
//   WHAT IS LEFT: a take-back that itself fails, which is logged and leaves the address below zero
//   as it is shown; a third write in the same moment — an issue from the address the delivery was
//   moving TO, drawing on stock the take-back then removes; another delivery at the same address
//   deleted in the same moment, which cannot be taken back, so the correction yields to it; and two
//   corrections of one delivery from two processes, which the lock cannot see, both of which can
//   stand with rows that each name the address both left. None has been seen.

import { withKeyLock } from "./airtable/client";
import { getAllAddresses } from "./airtable/addresses";
import { getDeliveryById, setDeliveryAddress } from "./airtable/deliveries";
import { getItemsByDelivery } from "./airtable/deliveryItems";
import { createDeliveryLogEntry } from "./airtable/deliveryLog";
import { getJobByRecordId } from "./airtable/jobs";
import { closedJobRefusal } from "./closedJob";
import { canAccessJobDeliveries } from "./deliveryAccess";
import { correctionRefusal, correctionRefusalText } from "./deliveryAddress";
import { DELIVERY_LOG_EVENTS } from "./deliveryLog";
import { itemLabel } from "./materialIdentity";
import { readBelowZeroAt, readShortfallWithout } from "./materialStock.server";

/** The not-found sentence the delivery's other actions give, for a delivery outside a reader's jobs too. */
const NOT_FOUND = "That delivery no longer exists.";

/**
 * Correct the address of the delivery printed `deliveryId` to `chosenAddressId` (#680), as
 * `actingUser`: `{ ok: true, deliveryId }`, or `{ error, reason }` — `reason` a key of
 * `correctionRefusalText`, or `not-found` or `closed`. `shownAddressId` is the address the page
 * was drawn with. The module header has the order and why.
 */
export async function correctDeliveryAddress({ deliveryId, chosenAddressId, shownAddressId, actingUser }) {
    const outcome = await withKeyLock(`delivery-address::${deliveryId}`, async () => {
        const delivery = deliveryId ? await getDeliveryById(deliveryId) : null;
        // A delivery outside the reader's jobs reads as one that does not exist.
        if (!delivery || !canAccessJobDeliveries(actingUser, delivery.job?.[0])) return { error: NOT_FOUND, reason: "not-found" };

        const [job, addresses] = await Promise.all([getJobByRecordId(delivery.job[0]), getAllAddresses()]);
        const closed = closedJobRefusal(job);
        if (closed) return { error: closed, reason: "closed" };

        const standingAddressId = (delivery.deliveryAddress ?? [])[0] ?? "";
        const refusal = correctionRefusal({ job, addresses, standingAddressId, shownAddressId, chosenAddressId });
        if (refusal) return { error: correctionRefusalText(refusal), reason: refusal };

        const labelOf = (addressRecordId) => addresses.find((a) => a.id === addressRecordId)?.addressLabel ?? "its address";
        const items = await getItemsByDelivery(delivery.id, { rowIds: delivery.deliveryItems });
        const namesOf = (short) => {
            const ids = new Set(short.map((s) => s.materialRecordId));
            return [...new Set(items.filter((item) => ids.has((item.material ?? [])[0])).map((item) => itemLabel(item)))].join(", ");
        };
        const belowZero = (short) => ({
            error: correctionRefusalText("below-zero", { names: namesOf(short), addressLabel: labelOf(standingAddressId) }),
            reason: "below-zero",
        });

        const before = await readShortfallWithout(delivery, items, job);
        if (before.length > 0) return belowZero(before);

        await setDeliveryAddress(delivery.id, chosenAddressId);

        const materialRecordIds = items.map((item) => (item.material ?? [])[0]).filter(Boolean);
        let after = [];
        try {
            after = await readBelowZeroAt(job.id, materialRecordIds, standingAddressId);
        } catch (error) {
            console.error(`correctDeliveryAddress: ${deliveryId}'s stock could not be read after its write`, error);
            after = null;
        }
        if (after === null || after.length > 0) {
            try {
                await setDeliveryAddress(delivery.id, standingAddressId);
            } catch (error) {
                console.error(`correctDeliveryAddress: ${deliveryId} left ${labelOf(standingAddressId)} below zero and could not be taken back`, error);
                return { ok: true, delivery, standingAddressId };
            }
            return after === null ? { error: correctionRefusalText("failed"), reason: "failed" } : belowZero(after);
        }
        return { ok: true, delivery, standingAddressId };
    });

    if (!outcome.ok) return outcome;

    try {
        await createDeliveryLogEntry({
            deliveryRecordId: outcome.delivery.id,
            deliveryId: outcome.delivery.deliveryId,
            event: DELIVERY_LOG_EVENTS.ADDRESS_CORRECTED,
            addressRecordId: chosenAddressId,
            formerAddressRecordId: outcome.standingAddressId,
            recordedByUserId: actingUser.id,
        });
    } catch (error) {
        console.error(`correctDeliveryAddress: ${deliveryId}'s activity row could not be written, so its address is taken back`, error);
        try {
            await setDeliveryAddress(outcome.delivery.id, outcome.standingAddressId);
        } catch (takeBackError) {
            console.error(`correctDeliveryAddress: ${deliveryId} keeps its corrected address with no activity row`, takeBackError);
            return { ok: true, deliveryId: outcome.delivery.deliveryId };
        }
        return { error: correctionRefusalText("failed"), reason: "failed" };
    }
    return { ok: true, deliveryId: outcome.delivery.deliveryId };
}
