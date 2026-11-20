// An avatar, Invoices 0q (#690): the pair picked from the address, the letters, the device's memory
// of the addresses signed in on it, and the one component both callers draw.
//
// WHAT THIS FILE IS FOR. 0q gives an avatar six pairs picked by the FNV-1a hash of the address in
// lower case, modulo six; two capitals from the first and the last name, or the address's first
// when either is missing; and a person mark with no letters for an address this device has not
// signed in with. `lib/avatar.js` and `lib/userName.js:avatarLetters` are pure, so they are called
// here by value; `app/components/Avatar.js` and its two callers are read as source.
//
// THE HASH HAS AN ORACLE OF ITS OWN. Beside the Sign in file's drawn example — `minjae.seo@` on
// Plum — the pair is held against a second FNV-1a written here from the algorithm's definition,
// over every address the test base's people sign in with and a run of made-up ones, so a module
// hashing anything else (the address as typed, its characters' codes beyond ASCII, a different
// prime) cannot agree by luck on one example.
//
// WHAT IT CANNOT SEE. Whether a page draws the pill before or after it hydrates, what a browser
// keeps in `localStorage`, and the colors on the screen: the browser run in the pull request is
// where those were looked at (`docs/notes/tools.md`, #690).
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { parseFile, parseSource, walk, listJsFiles, repoPath, toPosix, REPO_ROOT } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";
import {
    AVATAR_TONES,
    addressKey,
    avatarTone,
    lettersSignedInWith,
    signedInAddresses,
    SIGNED_IN_ADDRESSES_KEY,
    SIGNED_IN_ADDRESSES_LIMIT,
    withAddressSignedIn,
} from "../../../lib/avatar.js";
import { avatarLetters } from "../../../lib/userName.js";

export const title = "An avatar, Invoices 0q — its pair, its letters and the device's memory (#690)";

const AVATAR = "app/components/Avatar.js";
const ACCOUNT = "app/components/RailAccount.js";
const PILL = "app/login/SignInParts.js";
const DECLARATIONS = "app/designValues.css";

/** FNV-1a 32 from its definition — offset basis 2166136261, prime 16777619, over octets — as the oracle. */
const oracle = (text) => {
    let hash = 0x811c9dc5;
    for (const octet of Buffer.from(text, "utf8")) {
        hash = (hash ^ octet) >>> 0;
        hash = Number((BigInt(hash) * 16777619n) & 0xffffffffn);
    }
    return hash;
};

export function run({ check, assert, log }) {
    // ── the six pairs ──────────────────────────────────────────────────────────
    log("the six pairs, in the design's order, each reading its two declared names:");
    check("  the order is 0q's, a new pair joining at the end", AVATAR_TONES.map((tone) => tone.name).join(" "), "orange grass teal violet plum crimson");
    check(
        "  each is its fill and its letters as one class string",
        AVATAR_TONES.every((tone) => tone.className === `bg-avatar-${tone.name} text-avatar-${tone.name}-foreground`),
        true
    );
    const declared = readFileSync(`${REPO_ROOT}/${DECLARATIONS}`, "utf8");
    check(
        "  and every name a pair reads is declared",
        AVATAR_TONES.flatMap((tone) => [`--color-avatar-${tone.name}:`, `--color-avatar-${tone.name}-foreground:`])
            .filter((name) => !declared.includes(name))
            .join(" "),
        ""
    );

    // ── the pair picked from the address ───────────────────────────────────────
    log("");
    log("the pair is the FNV-1a hash of the address in lower case, modulo six (0q.5):");
    check("  the Sign in file's minjae.seo@ is Plum, as 1e draws it", avatarTone("minjae.seo@hanyangengusa.com").name, "plum");
    check("  an address in another case, or with spaces round it, keeps its pair", avatarTone("  Minjae.Seo@HanyangEngUSA.com ").name, "plum");
    check("  the oracle agrees on the empty string's offset basis", oracle(""), 2166136261);
    check("  and on `a`'s, FNV-1a's published value", oracle("a"), 0xe40c292c);
    const addresses = ["soo@hanyangengusa.com", "soohyun.c@hanyangengusa.com", "lee@hanyangengusa.com", "daniel.lee@hanyangengusa.com", "scoped-fixture@hanyangengusa.com"];
    for (let i = 0; i < 60; i++) addresses.push(`walk.${i}.${(i * 7919) % 997}@hanyangengusa.com`);
    check(
        "  every address picks the oracle's pair, over the people's own and sixty made up",
        addresses.filter((address) => avatarTone(address).name !== AVATAR_TONES[oracle(address.toLowerCase()) % 6].name).join(" "),
        ""
    );
    check("  and the made-up run lands on all six", new Set(addresses.map((address) => avatarTone(address).name)).size, 6);
    check(
        "  each in capitals picks the pair of its lower case",
        addresses.filter((address) => avatarTone(address.toUpperCase()).name !== AVATAR_TONES[oracle(address) % 6].name).join(" "),
        ""
    );
    check("  an address is kept trimmed and in lower case", addressKey("  Soo@HanyangEngUSA.com "), "soo@hanyangengusa.com");

    // ── the letters ────────────────────────────────────────────────────────────
    log("");
    log("the letters: two capitals from the names, or the address's first when either is missing (0q.3, 0q.4):");
    const letters = (firstName, lastName, email) => avatarLetters({ firstName, lastName, email });
    check("  both names, as typed in lower case", letters("jongha", "baek", "whdgk0818@hanyangengusa.com"), "JB");
    check("  both names, as the base holds `soo@`'s", letters("Soo", "Choi", "soo@hanyangengusa.com"), "SC");
    check("  a first name of two words takes its first letter", letters("Min Jae", "Seo", "minjae.seo@hanyangengusa.com"), "MS");
    check("  a first name alone is half a name: the address's first, in capitals", letters("Cher", "", "cher@hanyangengusa.com"), "C");
    check("  a last name alone, the same", letters("", "Seo", "minjae.seo@hanyangengusa.com"), "M");
    check("  no name at all, the same", letters(undefined, undefined, "kji9408@hanyangengusa.com"), "K");
    check("  a name of spaces is no name", letters("   ", "Choi", "soo@hanyangengusa.com"), "S");
    check("  an address that starts with a figure draws the figure", letters("", "", "9soo@hanyangengusa.com"), "9");
    check("  letters with no capital stay as they are", letters("수현", "최", "soohyun.c@hanyangengusa.com"), "수최");
    check("  a letter whose capital is two characters draws the first", letters("ßeta", "Lee", "beta@hanyangengusa.com"), "SL");
    check("  no reader, or nothing to draw from, is nothing", [avatarLetters(null), letters("", "", "")].join("|"), "|");

    // ── the device's memory ────────────────────────────────────────────────────
    log("");
    log("what the device keeps — an address and its letters, newest first, at most twenty (lib/avatar.js):");
    check("  under one key of this app's", SIGNED_IN_ADDRESSES_KEY, "hye-portal:signed-in-addresses");
    check("  at most twenty", SIGNED_IN_ADDRESSES_LIMIT, 20);
    check(
        "  nothing kept, an unreadable value or a foreign one is no address",
        [signedInAddresses(null), signedInAddresses("{"), signedInAddresses('{"a":1}'), signedInAddresses("[1,[\"x\",\"AB\"]]")].map((list) => list.length).join(" "),
        "0 0 0 0"
    );
    const one = withAddressSignedIn(null, "Soo@HanyangEngUSA.com", "SC");
    check("  a sign-in keeps the address trimmed and in lower case, with its letters", one, '[["soo@hanyangengusa.com","SC"]]');
    check("  and a pill asks in any case", lettersSignedInWith(one, " SOO@hanyangengusa.com"), "SC");
    check("  an address it has not signed in with has no letters", lettersSignedInWith(one, "lee@hanyangengusa.com"), null);
    const two = withAddressSignedIn(one, "lee@hanyangengusa.com", "L");
    check("  the newest stands first", JSON.parse(two).map(([address]) => address).join(" "), "lee@hanyangengusa.com soo@hanyangengusa.com");
    check("  signing in again moves it first and takes its newer letters", withAddressSignedIn(two, "soo@hanyangengusa.com", "SH"), '[["soo@hanyangengusa.com","SH"],["lee@hanyangengusa.com","L"]]');
    let many = null;
    for (let i = 0; i < 25; i++) many = withAddressSignedIn(many, `walk.${i}@hanyangengusa.com`, "W");
    const kept = JSON.parse(many);
    check("  past twenty the oldest go", [kept.length, kept[0][0], kept[19][0]].join(" "), "20 walk.24@hanyangengusa.com walk.5@hanyangengusa.com");
    check(
        "  letters in no avatar's shape, or no address, change nothing",
        [withAddressSignedIn(one, "x@hanyangengusa.com", "ABC"), withAddressSignedIn(one, "x@hanyangengusa.com", ""), withAddressSignedIn(one, "nobody", "N")].every((value) => value === one),
        true
    );
    check("  and no name is kept, only the letters", /Soo|Choi/.test(withAddressSignedIn(null, "soo@hanyangengusa.com", avatarLetters({ firstName: "Soo", lastName: "Choi", email: "soo@hanyangengusa.com" }))), false);

    // ── the component ──────────────────────────────────────────────────────────
    log("");
    log("one component draws every avatar, and it never changes (0q):");
    const component = parseFile(AVATAR).source;
    const avatarClass = component.match(/const AVATAR = "([^"]*)";/)?.[1] ?? "";
    check("  a 24 circle that centers what it holds", avatarClass, "flex size-avatar shrink-0 items-center justify-center rounded-full");
    check(
        "  two letters at 12 on 16, one at 13, both at 600 (0q.2)",
        /const size = \[\.\.\.letters\]\.length > 1 \? "text-heading-sm font-semibold" : "text-body-sm font-semibold";/.test(component),
        true
    );
    check("  on its address's pair", /const tone = avatarTone\(email\);/.test(component) && /\$\{AVATAR\} \$\{tone\.className\} \$\{size\}/.test(component), true);
    const classes = [];
    walk(parseFile(AVATAR).ast, (n) => {
        if (n.type === "Literal" && typeof n.value === "string") classes.push(...n.value.split(/\s+/));
        if (n.type === "TemplateElement") classes.push(...n.value.raw.split(/\s+/));
    });
    check("  and takes no state of hover, focus, press or selection", classes.filter((t) => /^(hover|focus|focus-visible|active|aria-[a-z-]+|group-[a-z-]+|data-[a-z-]+|pointer-coarse):/.test(t)).join(" "), "");
    check(
        "  an address this device has not signed in with: the 14 person mark at Ink 3 on Field, no letters (0q.9)",
        /data-avatar="unknown" className=\{`\$\{AVATAR\} bg-background-muted`\}>\s*<Icon name="user" kind="qualifier" className="size-icon-sm" \/>/.test(component),
        true
    );
    check(
        "  before the page can read the device, an empty place and no mark it might take back",
        /useSyncExternalStore\(subscribe, readStored, \(\) => undefined\)/.test(component) && /if \(stored === undefined\) return <span aria-hidden="true" data-avatar="pending" className=\{`\$\{AVATAR\} invisible`\} \/>;/.test(component),
        true
    );
    check("  the letters come from the device's memory, by the address the pill shows", /const letters = lettersSignedInWith\(stored, email\);\s*if \(letters\) return <Avatar letters=\{letters\} email=\{email\} \/>;/.test(component), true);
    check(
        "  every touch of storage is caught, so a device that refuses it remembers nothing",
        [/const readStored = \(\) => \{\s*try \{\s*return window\.localStorage\.getItem\(SIGNED_IN_ADDRESSES_KEY\);\s*\} catch \{\s*return null;/.test(component), /try \{\s*const was = window\.localStorage\.getItem\(SIGNED_IN_ADDRESSES_KEY\);[\s\S]*?\} catch \{/.test(component)].join(" "),
        "true true"
    );
    check("  it is hidden from assistive tech, the address or name beside it saying who", (component.match(/aria-hidden="true"/g) ?? []).length, 3);
    const imports = [];
    walk(parseFile(AVATAR).ast, (n) => {
        if (n.type === "ImportDeclaration") imports.push(n.source.value);
    });
    check("  and asks nothing of the base: React, the mark and the pure module alone", imports.join(" "), "react ./Icon @/lib/avatar");
    check("  the pure module imports nothing", /^\s*import\s/m.test(parseFile("lib/avatar.js").source), false);

    // ── its two callers ────────────────────────────────────────────────────────
    log("");
    log("its two callers, and no other circle:");
    const account = parseFile(ACCOUNT).source;
    check(
        "  the rail's account hands it the reader's letters and keeps the address on the device as it draws",
        [account.includes("<Avatar letters={words.letters} email={words.email} />"), /useRememberAddress\(words\?\.email, words\?\.letters\);\s*if \(!words\) return null;/.test(account)].join(" "),
        "true true"
    );
    const pill = parseFile(PILL).source;
    check("  a sign-in step's address pill asks the device by its address", pill.includes("<AddressAvatar email={email} />"), true);
    check("  and draws no letter of its own from the address", /email\.slice\(0, 1\)|\[\.\.\.email\]\[0\]/.test(pill), false);
    const circles = listJsFiles(repoPath("app"))
        .filter((file) => /(^|[\s"`])size-avatar([\s"`]|$)/.test(readFileSync(file, "utf8")))
        .map((file) => toPosix(relative(REPO_ROOT, file)));
    check("  no other file draws an avatar's circle", circles.join(" "), AVATAR);

    // ── anti-vacuity ───────────────────────────────────────────────────────────
    log("");
    log("anti-vacuity — the readings fail on planted avatars:");
    const plantedClasses = (from, to) => {
        const out = [];
        walk(parseSource(component.replace(from, to), "<planted>").ast, (n) => {
            if (n.type === "Literal" && typeof n.value === "string") out.push(...n.value.split(/\s+/));
        });
        return out.filter((t) => /^(hover|focus|focus-visible|active|aria-[a-z-]+|group-[a-z-]+|data-[a-z-]+|pointer-coarse):/.test(t)).join(" ");
    };
    assert("  an avatar darkening under the pointer is seen", plantedClasses('rounded-full";', 'rounded-full hover:brightness-95";') === "hover:brightness-95");
    assert(
        "  a hash of the address as typed is seen: in capitals, some of these addresses pick another pair",
        addresses.some((address) => oracle(address.toUpperCase()) % 6 !== oracle(address) % 6)
    );
    assert("  an oracle off by its prime is seen", (() => {
        let h = 0x811c9dc5;
        for (const o of Buffer.from("a")) h = Number((BigInt((h ^ o) >>> 0) * 16777618n) & 0xffffffffn);
        return h !== oracle("a");
    })());
}

if (isMain(import.meta.url)) standalone(title, run);
