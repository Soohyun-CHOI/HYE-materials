// A base whose every answer is chosen, for the checks that run `lib/airtableBatch.js`
// against a failure the live base cannot be made to produce (#470).
//
// TWO CHECKS RUN THE SAME FAILURES, SO THEY RUN THEM AGAINST ONE FAKE. The batch
// writer's own check asks what a failed request does to its account; the
// registration's asks what that account does to a landing. If each built its own, a
// lost answer could mean two things in two files, and the second file would be
// testing a fake the first never agreed with — the reason `_entrypoints.mjs` is shared.
//
// It holds rows by their minted id. `create` lands a batch, refuses it whole, or lands
// some or all of it and THEN throws — a lost answer — and `readBack` answers from what
// it holds, in reverse order, or fails. It counts its requests and the most it had in
// flight at once, and the later a request, the longer it takes to settle, so two sent
// together would overlap and the earlier one would settle first.

const settle = () => new Promise((resolve) => setTimeout(resolve, 1));

/**
 * `answer(n, rows)` decides request `n` (0-based): `null` lands the batch, and
 * `{ land }` lands its first `land` rows and then throws — `{ land: 0 }` is a refusal,
 * `{ land: rows.length }` an answer lost after the commit.
 */
export function fakeBase({ idField, answer = () => null, readBackFails = false, reverseAnswer = false }) {
    const held = new Map();
    const state = { requests: [], readBacks: [], inFlight: 0, maxInFlight: 0 };
    const recordOf = (fields) => ({ fields, get: (name) => fields[name] });
    return {
        state,
        held,
        create: async (rows) => {
            const n = state.requests.length;
            state.requests.push(rows.map((row) => row[idField]));
            state.inFlight += 1;
            state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
            try {
                for (let i = 0; i <= n; i += 1) await settle();
                const plan = answer(n, rows);
                if (plan) {
                    for (const row of rows.slice(0, plan.land)) held.set(row[idField], recordOf(row));
                    throw new Error(`request ${n + 1} failed`);
                }
                const made = rows.map(recordOf);
                for (const record of made) held.set(record.get(idField), record);
                return reverseAnswer ? [...made].reverse() : made;
            } finally {
                state.inFlight -= 1;
            }
        },
        readBack: async (ids) => {
            state.readBacks.push([...ids]);
            await settle();
            if (readBackFails) throw new Error("read-back failed");
            return ids.filter((id) => held.has(id)).map((id) => held.get(id)).reverse();
        },
    };
}
