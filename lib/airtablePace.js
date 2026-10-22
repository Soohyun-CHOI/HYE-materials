// At most five Airtable requests in any second, for one caller that sends many (#553).
//
// WHY A CALLER PACES ITSELF. Airtable's published rule is five requests a second per base, and a
// base that is sent more answers 429 and asks for thirty seconds' wait — every screen on the base
// waiting with it, since the limit is the base's and not the caller's. `findByRecordIds` sends
// its chunks together, which a page reading one or two never notices; the Tools & Equipment
// export reads every item on what the list stands on, fourteen requests for 643 (#553), and sent
// together those would be a burst nothing guarantees the base forgives. #560 saw thirteen at once
// draw no 429 twice, which says how often the limit is enforced to the request and not that it is
// not. airtable@0.12.2 retries a 429 itself, from five seconds; that is the floor under this and
// not a reason to lean on it.
//
// A WINDOW, NOT A GAP. Each request waits until fewer than five began in the second before it,
// so five can go at once and the sixth goes a second after the first — what the rule allows,
// where a fixed fifth of a second between every two would make the first five wait for nothing.
// A request begun exactly a second after another counts them both as one second's, so the sixth
// waits a millisecond past it: no closed second holds six.
//
// IT PACES ITS OWN CALLER AND NOBODY ELSE. One pace is made per export and every request the
// export sends asks it — the session's read included — so the export cannot pass five; other
// people's pages share the base and are not counted here, and that is what the SDK's retry is
// left for. A process-wide pace would slow every screen to make that guarantee and is not built.
//
// PURE AND OFFLINE-SAFE: it imports nothing and is handed its clock and its wait, so
// `scripts/tests/offline/asset-export.mjs` drives it with fakes.

/** How many requests Airtable answers in a second, per base. */
export const AIRTABLE_REQUESTS_PER_SECOND = 5;

/** How many rows one list request answers — Airtable's page, which `.all()` reads one request at a time. */
export const AIRTABLE_PAGE_ROWS = 100;

const WINDOW_MS = 1000;

/**
 * A pace: `await pace()` before each request, which resolves once the request may begin, in
 * the order the calls were made. `pace.spent(n)` counts `n` requests begun just now without
 * waiting for them — a whole-table read's later pages, which `.all()` sends after the first
 * answers and nothing outside it can await; counting them on their return is later than they
 * began, so the window holds them longer than it had to, which is the safe direction.
 */
export function createRequestPace({ perSecond = AIRTABLE_REQUESTS_PER_SECOND, now = () => Date.now(), wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
    // When each request in the last second began, oldest first.
    const begun = [];
    let queue = Promise.resolve();
    const forget = (moment) => {
        while (begun.length > 0 && begun[0] + WINDOW_MS < moment) begun.shift();
    };

    const pace = () => {
        const turn = queue.then(async () => {
            for (;;) {
                const moment = now();
                forget(moment);
                if (begun.length < perSecond) {
                    begun.push(moment);
                    return;
                }
                await wait(begun[0] + WINDOW_MS + 1 - moment);
            }
        });
        queue = turn.catch(() => {});
        return turn;
    };
    pace.spent = (count) => {
        const moment = now();
        for (let i = 0; i < count; i += 1) begun.push(moment);
    };
    return pace;
}

/**
 * How many requests a whole-table read of `rows` rows sent: one per page of a hundred, and one
 * for an empty table.
 */
export function pagesOf(rows) {
    return Math.max(1, Math.ceil((rows?.length ?? 0) / AIRTABLE_PAGE_ROWS));
}
