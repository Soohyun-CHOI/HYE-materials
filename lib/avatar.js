// An avatar's pair, and the addresses this device has signed in with (Invoices 0q, #690).
//
// SIX PAIRS, PICKED FROM THE ADDRESS, SO A PERSON KEEPS ONE PAIR EVERYWHERE. 0q.5 picks one of
// six fill-and-letters pairs by the FNV-1a 32-bit hash of the address in lower case, modulo
// six, and a new pair joins at the end (0q.6) — so the order below is the design's and is not
// sorted. The hash runs over the address's UTF-8 bytes, as the Sign in file's does; every
// address this app admits is ASCII, where bytes and characters are one. The pairs are
// `app/designValues.css`'s, each class written whole here because Tailwind builds only a class
// it reads in full.
//
// WHAT THE DEVICE REMEMBERS, AND WHY THAT AND NO MORE. 0q.9 draws an address this device has not
// signed in with as a person mark with no letters, so a sign-in step needs to know two things
// about an address it is shown: whether this device has signed in with it, and the letters to
// draw if so. Asking the base would hand any signed-out reader a person's initials for any
// address they type, and cost a read on a page that reads nothing, so the answer is the
// device's own: each time a signed-in page draws the rail's account, the reader's address and
// their letters (`lib/userName.js:avatarLetters`) are written to this origin's `localStorage`,
// newest first, at most `SIGNED_IN_ADDRESSES_LIMIT` of them. No name is kept, only the one or two
// letters the avatar draws; nothing is sent anywhere, and signing out leaves the entry, since
// the step that reads it is the one a reader meets after signing out. A device that refuses
// storage remembers nothing, and every address on it is one it has not signed in with.
//
// PURE AND OFFLINE-SAFE: no import, so a "use client" file and `offline/avatar.mjs` both take it.

/** The six pairs in the design's order (0q.12 to 0q.17): fill and letters, as one class string each. */
export const AVATAR_TONES = Object.freeze([
    Object.freeze({ name: "orange", className: "bg-avatar-orange text-avatar-orange-foreground" }),
    Object.freeze({ name: "grass", className: "bg-avatar-grass text-avatar-grass-foreground" }),
    Object.freeze({ name: "teal", className: "bg-avatar-teal text-avatar-teal-foreground" }),
    Object.freeze({ name: "violet", className: "bg-avatar-violet text-avatar-violet-foreground" }),
    Object.freeze({ name: "plum", className: "bg-avatar-plum text-avatar-plum-foreground" }),
    Object.freeze({ name: "crimson", className: "bg-avatar-crimson text-avatar-crimson-foreground" }),
]);

/** An address as the hash and the device's memory take it: trimmed, in lower case. */
export function addressKey(email) {
    return String(email ?? "")
        .trim()
        .toLowerCase();
}

/** FNV-1a, 32 bits, over a string's UTF-8 bytes (0q.5). */
function fnv1a(text) {
    let hash = 2166136261;
    for (const byte of new TextEncoder().encode(text)) {
        hash ^= byte;
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash >>> 0;
}

/** The pair an address draws in (0q.5). */
export function avatarTone(email) {
    return AVATAR_TONES[fnv1a(addressKey(email)) % AVATAR_TONES.length];
}

/** Where this origin keeps the addresses signed in on it, and how many it keeps. */
export const SIGNED_IN_ADDRESSES_KEY = "hye-portal:signed-in-addresses";
export const SIGNED_IN_ADDRESSES_LIMIT = 20;

/** Letters as an avatar draws them: one or two characters, nothing else. */
const isLetters = (letters) => typeof letters === "string" && [...letters].length >= 1 && [...letters].length <= 2;

/**
 * The addresses a stored value names, newest first, as `[address, letters]` — an unreadable or
 * foreign value is no address at all, and an entry in any other shape is dropped.
 */
export function signedInAddresses(stored) {
    let list;
    try {
        list = JSON.parse(stored ?? "[]");
    } catch {
        return [];
    }
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const out = [];
    for (const entry of list) {
        if (!Array.isArray(entry) || entry.length !== 2) continue;
        const [address, letters] = entry;
        if (typeof address !== "string" || !address.includes("@") || !isLetters(letters)) continue;
        const key = addressKey(address);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push([key, letters]);
    }
    return out.slice(0, SIGNED_IN_ADDRESSES_LIMIT);
}

/** The letters a stored value holds for an address this device has signed in with, or null. */
export function lettersSignedInWith(stored, email) {
    const key = addressKey(email);
    return signedInAddresses(stored).find(([address]) => address === key)?.[1] ?? null;
}

/**
 * The stored value once an address has signed in on this device with these letters: it first,
 * any older entry of it gone, the oldest beyond the limit dropped. An address or letters in no
 * usable shape leave the value as it was.
 */
export function withAddressSignedIn(stored, email, letters) {
    const key = addressKey(email);
    const kept = signedInAddresses(stored);
    if (!key.includes("@") || !isLetters(letters)) return JSON.stringify(kept);
    return JSON.stringify([[key, letters], ...kept.filter(([address]) => address !== key)].slice(0, SIGNED_IN_ADDRESSES_LIMIT));
}
