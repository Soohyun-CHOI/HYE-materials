/**
 * How often a sign-in email may be asked for (#148): the three ceilings, how long
 * `Resend email` rests after an email goes, the mailbox and the IP a request is counted
 * against, and the judgment over the rows earlier requests made.
 *
 * WHAT IS COUNTED IS THE `Auth Tokens` ROWS THE REQUESTS ALREADY MAKE, and no counter of
 * this module's own. Every request for an email writes one row for any company address
 * without reading `Users`, so a count of rows treats an address somebody has signed in
 * with and one nobody has alike — which is what lets a request over a ceiling be told so
 * without the answer saying who has an account. `lib/airtable/authTokens.js` makes the
 * one read a request costs before it makes its row, and hands this module what each row
 * shares with the request, never a hash. `docs/notes/authorization.md` has why that read
 * sees a row made a moment earlier, and what it costs.
 *
 * A CEILING IS PER MAILBOX OR PER IP, and the mailbox is the address lowercased with its
 * `+` tag cut, because another case of an address signs in as the same person and a
 * tagged one lands in the same inbox. The IP is the one Vercel puts first in
 * `x-forwarded-for`, an IPv6 address cut to its first 64 bits, since one subscriber can
 * take any address in its /64.
 *
 * Pure and import-free, so the offline tier calls every clause and a sign-in screen can
 * read the rest without the crypto the hash needs, which stays in
 * `lib/airtable/authTokens.js`.
 *
 * WHAT IT DOES NOT BOUND, none of it seen on this base:
 *  - Two requests on two instances at once can each read a count one below a ceiling
 *    and each make a row. `lib/auth.js` takes the mailbox's lock around the read and the
 *    write, which closes it within one process and no further — the cross-invocation
 *    window `docs/notes/airtable-access.md` records for every lock here.
 *  - Anybody may ask for an email to any company address, so a stranger can spend an
 *    address's allowance and leave its owner unable to ask for a new email for up to a
 *    day. What the owner keeps is the links in the emails the stranger had sent, which
 *    sign in from any browser while they live.
 *  - Many IPs, or one with many /64s, can still use up the Resend quota the order mail
 *    shares; nothing here caps the app as a whole.
 *  - A refused request still costs its one read, so a flood of them spends the base's
 *    five requests a second as surely as a flood of anything else.
 *  - An office behind one IP shares one per-IP ceiling, which assumes fewer sign-in
 *    emails a day from that office than the ceiling allows.
 */

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/**
 * The ceilings, each a number of emails over a window ending now.
 *
 * TEN MINUTES PER MAILBOX IS MATCHED TO THE REST BELOW: an email at most once a minute
 * leaves no more than ten in any ten minutes, so pressing `Resend email` each time it
 * comes back never reaches eleven — even with the first press made the moment the code
 * step opens. The window bounds a burst into one inbox.
 *
 * A DAY PER MAILBOX IS THE BOUND ON GUESSING. Every email gives its asker five tries at a
 * six-digit code, so twenty a day is at most a hundred guesses at one address — about
 * one in ten thousand a day — and one inbox's share of the quota.
 *
 * A DAY PER IP IS THE BOUND ON ONE HOST MAILING MANY ADDRESSES, and it is fifty so that an
 * office behind one IP can sign everybody in on two devices in one day.
 */
export const SIGN_IN_CEILINGS = [
    { per: "mailbox", windowMs: 10 * MINUTE_MS, ceiling: 11 },
    { per: "mailbox", windowMs: DAY_MS, ceiling: 20 },
    { per: "ip", windowMs: DAY_MS, ceiling: 50 },
];

/**
 * How long `Resend email` rests after an email goes, whichever control sent it —
 * `Continue` included. The ten-minute ceiling above is set from it.
 */
export const RESEND_COOLDOWN_MS = MINUTE_MS;

/**
 * What is left of that rest, in milliseconds, for an email asked for at `askedAt` — 0 once
 * it is over, and for a time nobody knows. One clock from the press (1j): the code step
 * counts from the press it saw, and a page drawn while a rest runs counts from the time
 * the browser's binding holds (`lib/session.js`), so a reload or a phone that dropped the
 * tab comes back to the same count. Never more than the whole rest, so a clock ahead of
 * the server's cannot lengthen it.
 */
export function resendWaitLeft(askedAt, now = Date.now()) {
    if (!Number.isFinite(askedAt)) return 0;
    return Math.max(0, Math.min(RESEND_COOLDOWN_MS, askedAt + RESEND_COOLDOWN_MS - now));
}

/** How far back the one read looks: the longest window. */
export const SIGN_IN_LOOKBACK_MS = Math.max(...SIGN_IN_CEILINGS.map((c) => c.windowMs));

/**
 * The most rows the one read takes, Airtable's page — so a request costs one read and
 * never pages. It cannot cut a verdict short: the day's two ceilings together are below
 * it, so a full page always holds a ceiling's worth of one of them.
 */
export const SIGN_IN_READ_PAGE = 100;

/** The address an inbox is counted by: lowercased, with any `+` tag cut from its local part. */
export function mailboxOf(email) {
    const address = String(email ?? "").toLowerCase();
    const at = address.lastIndexOf("@");
    if (at === -1) return address;
    const local = address.slice(0, at);
    const tag = local.indexOf("+");
    return `${tag === -1 ? local : local.slice(0, tag)}${address.slice(at)}`;
}

/**
 * The key every request whose IP cannot be read shares. Vercel always sets the header,
 * so only a request that reached the app some other way meets it — and those then share
 * one ceiling rather than having none.
 */
export const UNKNOWN_IP = "unknown";

/**
 * The IP a request is counted against, from `x-forwarded-for` as it arrived.
 *
 * THE FIRST ENTRY, because that is the client. Vercel overwrites the header with the
 * address that connected, so a caller cannot choose it there; `next dev` fills it from
 * the socket when it is absent, which is what lets a local walk count like a deployed
 * one. An IPv4 address stands as itself, an IPv4-mapped IPv6 one as that IPv4 address,
 * and any other IPv6 address as its /64.
 */
export function ipKeyOf(forwardedFor) {
    const first = String(forwardedFor ?? "").split(",")[0].trim();
    const v4 = ipv4Of(first);
    if (v4) return `v4:${v4.join(".")}`;
    const v6 = ipv6Of(first);
    if (!v6) return UNKNOWN_IP;
    if (v6.slice(0, 5).every((group) => group === 0) && v6[5] === 0xffff) {
        return `v4:${[v6[6] >> 8, v6[6] & 0xff, v6[7] >> 8, v6[7] & 0xff].join(".")}`;
    }
    return `v6:${v6
        .slice(0, 4)
        .map((group) => group.toString(16))
        .join(":")}::/64`;
}

/** Four octets, or null. */
function ipv4Of(text) {
    const parts = text.split(".");
    if (parts.length !== 4 || !parts.every((part) => /^\d{1,3}$/.test(part))) return null;
    const octets = parts.map(Number);
    return octets.every((octet) => octet <= 255) ? octets : null;
}

/** Eight 16-bit groups, or null — brackets and a zone dropped, `::` expanded, an IPv4 tail read. */
function ipv6Of(text) {
    let address = text.startsWith("[") && text.endsWith("]") ? text.slice(1, -1) : text;
    const zone = address.indexOf("%");
    if (zone !== -1) address = address.slice(0, zone);
    if (!address.includes(":")) return null;

    const halves = address.split("::");
    if (halves.length > 2) return null;
    const groupsOf = (part) => (part === "" ? [] : part.split(":"));
    const head = groupsOf(halves[0]);
    const tail = halves.length === 2 ? groupsOf(halves[1]) : [];
    const last = halves.length === 2 ? tail : head;
    if (last.length > 0 && last[last.length - 1].includes(".")) {
        const v4 = ipv4Of(last.pop());
        if (!v4) return null;
        last.push(((v4[0] << 8) | v4[1]).toString(16), ((v4[2] << 8) | v4[3]).toString(16));
    }

    const written = [...head, ...tail];
    if (!written.every((group) => /^[0-9a-f]{1,4}$/i.test(group))) return null;
    const missing = 8 - written.length;
    if (halves.length === 2 ? missing < 1 : missing !== 0) return null;
    const zeros = halves.length === 2 ? Array(missing).fill("0") : [];
    return [...head, ...zeros, ...tail].map((group) => parseInt(group, 16));
}

/**
 * May this request make a row and send an email? `rows` are the rows of the last day
 * that share its mailbox or its IP, each `{ createdAt, mailbox, ip }` with the two
 * flags saying which it shares.
 *
 * A ROW COUNTS WHILE IT IS NEWER THAN ITS WINDOW, strictly, which is the read's own
 * `IS_AFTER`. A request at a ceiling is refused until the row that brought the count to
 * the ceiling leaves the window, so `retryAt` is that row's time plus the window — the
 * latest such time over every ceiling reached. It is the one thing a refusal says, and it
 * comes from the rows alone: which ceiling was reached is left out, since naming the
 * mailbox's would tell a caller that somebody else has been asking for that address.
 */
export function judgeSignInRequest(rows, now = Date.now()) {
    let retryAtMs = null;
    for (const { per, windowMs, ceiling } of SIGN_IN_CEILINGS) {
        const since = now - windowMs;
        const times = (rows ?? [])
            .filter((row) => row?.[per] === true)
            .map((row) => Date.parse(row.createdAt))
            .filter((at) => Number.isFinite(at) && at > since)
            .sort((a, b) => b - a);
        if (times.length < ceiling) continue;
        const opens = times[ceiling - 1] + windowMs;
        if (retryAtMs === null || opens > retryAtMs) retryAtMs = opens;
    }
    return retryAtMs === null ? { limited: false } : { limited: true, retryAt: new Date(retryAtMs).toISOString() };
}

/** Whole seconds until `retryAt`, at least one — a refusal's `Retry-After`. */
export function retryAfterSeconds(retryAt, now = Date.now()) {
    return Math.max(1, Math.ceil((Date.parse(retryAt) - now) / 1000));
}
