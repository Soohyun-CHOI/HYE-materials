// Creating many rows in Airtable — ten to a request, one request at a time, and an
// account of which rows landed that a failed request cannot make wrong (#470).
//
// PURE, AND THE FAILURES ARE WHY. What this module decides is what a run of creates
// says when one of its requests fails: which rows are on the base, which are not, and
// where the run stops. Those are exactly the cases the live base cannot be made to
// produce on demand, so the only place they can be run is the offline tier, and that
// tier reaches a module only if it imports nothing credentialed. So this imports
// nothing, and `lib/airtable/client.js:createRecords` hands it the base — `create` and
// `readBack` are the two requests it may make. Same split, for the same measured
// reason, as `lib/airtableFormula.js` (#159) and `lib/idSequence.js` (#164);
// `offline/airtable-batch.mjs` runs it against fake answers.
//
// ONE REQUEST AT A TIME, AND A CALLER HOLDING A LOCK IS WHO NEEDS THAT MOST.
// `createAssets` calls this inside the day-prefix lock, and the lock covers the
// requests only while the callback is still waiting on them: a run that returned with
// a request in flight would let the next registration read the day's ids before that
// request landed, and mint them a second time. So each request is awaited before the
// next is sent, a failed one's read-back included, and the function returns only once
// nothing it sent is still on the wire. `Promise.all` over the batches is the shape
// this refuses — it rejects on the first failure with the others still in flight.
//
// THE FIRST FAILED REQUEST STOPS THE RUN, which is the posture `createAssets` and
// the log pass had one row at a time: a write that fails is failing systemically far
// more often than per row, and sending the rest at a rate limit makes the account
// longer rather than better.
//
// A FAILED REQUEST IS READ BACK BEFORE IT IS COUNTED, AND THAT IS THE WHOLE OF WHAT
// MAKES THE ACCOUNT EXACT. A request Airtable refuses writes nothing — measured on
// this base for a batch destroy (#191) and a single update (#444), never for a create,
// and nothing here rests on it. A request whose ANSWER was lost — a connection that
// dropped after the commit, or the five-minute client timeout — reaches the caller as
// the same kind of error, and its rows may all be there. airtable@0.12.2 retries a 429
// and nothing else (`run_action.js`), and Airtable did not process a 429, so a failure
// is never re-sent and no row is written twice. Telling the two failures apart by
// status would be a second judgment about Airtable's semantics that no check here can
// hold; asking the base which of the batch's ids it holds costs one request, on a path
// that has already failed. **The ids are the caller's minted ones** — a row carries its
// id in the field `idField` names — so the question has an exact answer, and the read
// leans on the freshness the mint itself leans on: `mintDailyIds` finds the day's
// highest id with a formula over the same field.
//
// WHAT IS LEFT, AND NONE OF IT HAS BEEN SEEN.
//   - A read-back that fails as well counts its batch as not written. The screens have
//     no word for not knowing, and the alternative — throwing — would lose the account
//     of every batch before it. If those rows did land they stand outside it: assets
//     with no `Created` row that the landing does not name. It takes two failed
//     requests in a row, and the landing's own render reads the same base.
//   - A write that lands after its failure was answered and after the read-back is
//     counted as not written. That is the window a single create has always had.
//   - A request that never settles is nothing this can count: airtable@0.12.2 never
//     calls back on a 200 whose body does not parse (`run_action.js`), so a run waits
//     out the function's ceiling — as every create in this app already would.

/** Airtable's ceiling on the rows one create request may carry. */
export const RECORDS_PER_CREATE = 10;

/**
 * Create one row per item, `RECORDS_PER_CREATE` to a request, and say which landed.
 *
 * `items` are the caller's own values, in the order their rows are to land, and
 * `rowOf(item)` is a row's fields — its minted id under `idField` among them.
 * `create(rows)` resolves to the records Airtable made; `readBack(ids)` to the records
 * the base holds under those ids, in any order.
 *
 * Every item comes back in exactly one of `written` (beside its record) and
 * `unwritten`, each list in the items' order — matched by id rather than by position,
 * so the order an answer arrives in decides nothing. `failure` is the error that
 * stopped the run, or null.
 */
export async function createInBatches(items, { idField, rowOf, create, readBack }) {
    const written = [];
    const unwritten = [];
    let failure = null;

    for (let start = 0; start < items.length; start += RECORDS_PER_CREATE) {
        const batch = items.slice(start, start + RECORDS_PER_CREATE);
        const rows = batch.map(rowOf);

        let landed;
        try {
            landed = await create(rows);
        } catch (error) {
            failure = error;
            // A read-back that fails too is a batch nobody can vouch for, which is
            // counted as not written — the header carries why.
            landed = await readBack(rows.map((row) => row[idField])).catch(() => []);
        }

        const byId = new Map(landed.map((record) => [record.get(idField), record]));
        batch.forEach((item, i) => {
            const record = byId.get(rows[i][idField]);
            if (record) written.push({ item, record });
            else unwritten.push(item);
        });

        if (failure) {
            unwritten.push(...items.slice(start + batch.length));
            break;
        }
    }

    return { written, unwritten, failure };
}
