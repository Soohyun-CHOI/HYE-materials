// What a tool label's QR symbol encodes, and the version it comes out at (#351).
//
// WHAT THIS FILE IS FOR. Every QR figure on this axis was a capacity-table lookup
// until this issue — #348 chose the printed address by reading the specification and
// encoded nothing, and `docs/notes/tools.md` said so in its own heading. This check
// encodes a real address and reads the answers back, so the version, the module
// count and the mode are measurements that fail when they stop being true rather
// than sentences in a document nobody re-derives.
//
// THE VERSION IS HELD HERE BECAUSE IT IS NOT HELD AT RUNTIME. `lib/toolLabelQR.js`
// deliberately does not pass a version to the encoder — an address that no longer
// fits would refuse to print, and a label that comes out bigger beats a tool nothing
// can track. So the pin lives in CI instead: a change to the address, the host, the
// error-correction level or the library lands as a failing check here rather than as
// a quietly denser sticker.
//
// AND THE DECODE IS A DIFFERENT LIBRARY ON PURPOSE. `qrcode` encodes and `jsqr`
// decodes, so the round trip is not the encoder agreeing with itself: jsQR reads the
// format information, corrects with its own error-correction implementation, and
// reports the version and the mode it found. Its answers are compared against the
// encoder's rather than assumed to match.
//
// WHAT IT CANNOT SEE, and both limits are real rather than disclaimers.
//   * IT DECODES THE MATRIX, NOT THE SERVED SVG. The bytes the route returns are
//     rendered by the library from the same input, and whether a browser PAINTS
//     them decodably is rendering — which this tier never does. That is checked
//     once in a browser against the running route and recorded in the pull request.
//   * THE QUIET ZONE IS UNPROVABLE HERE. A software decoder reads a clean image
//     with no margin at all — measured, and asserted below so the fact is in the
//     tier rather than only in prose. Four modules rests on the specification and
//     on a label sitting beside other ink, so nothing here should be read as
//     evidence for it.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import jsQR from "jsqr";

import {
    QR_ERROR_CORRECTION,
    QR_QUIET_ZONE_MODULES,
    QR_SIDE_MODULES,
    QR_SYMBOL_MODULES,
    QR_VERSION,
    buildToolItemQR,
    labelURL,
} from "../../../lib/toolLabelQR.js";
import { ID_KINDS, dailyIdPrefix, formatSequentialId } from "../../../lib/idSequence.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "What a tool label's QR symbol encodes, measured (#351)";

/** The host a printed label carries, which is what every figure is measured at. */
const PRODUCTION_ORIGIN = "https://hyeusa.com";

/** The dev origin, three characters longer, which is why a local symbol differs. */
const DEV_ORIGIN = "http://localhost:3000";

/** The four levels, so the table is computed rather than typed. */
const LEVELS = ["L", "M", "Q", "H"];

/** A minted `Tool Item ID`, from the generator rather than a literal typed here. */
function mintedId(sequence) {
    const prefix = dailyIdPrefix(ID_KINDS.TOOL_ITEM, new Date(2026, 8, 9));
    return formatSequentialId(prefix, sequence, { padLength: ID_KINDS.TOOL_ITEM.padLength });
}

/** RGBA at `scale` px per module, which is what jsQR takes. */
function raster(grid, side, scale) {
    const px = side * scale;
    const data = new Uint8ClampedArray(px * px * 4);
    for (let y = 0; y < px; y++) {
        for (let x = 0; x < px; x++) {
            const value = grid[Math.floor(y / scale)][Math.floor(x / scale)] ? 0 : 255;
            const at = (y * px + x) * 4;
            data[at] = value;
            data[at + 1] = value;
            data[at + 2] = value;
            data[at + 3] = 255;
        }
    }
    return { data, px };
}

/** The symbol's modules, with `quiet` modules of light margin around them. */
function gridOf(symbol, quiet) {
    const n = symbol.modules.size;
    const side = n + quiet * 2;
    const grid = Array.from({ length: side }, () => new Array(side).fill(0));
    for (let row = 0; row < n; row++) {
        for (let col = 0; col < n; col++) {
            grid[row + quiet][col + quiet] = symbol.modules.data[row * n + col];
        }
    }
    return { grid, side };
}

/** Decode a matrix through jsQR, at four pixels per module. */
function decode(symbol, quiet) {
    const { grid, side } = gridOf(symbol, quiet);
    const { data, px } = raster(grid, side, 4);
    return jsQR(data, px, px);
}

/** A solid blot over the data region, clear of all three finder patterns. */
function blotted(symbol, quiet, size) {
    const { grid, side } = gridOf(symbol, quiet);
    const n = symbol.modules.size;
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            const y = quiet + 10 + row;
            const x = quiet + n - 1 - size + col;
            if (y < side && x < side) grid[y][x] = 1;
        }
    }
    const { data, px } = raster(grid, side, 4);
    return jsQR(data, px, px);
}

export async function run({ check, assert, log }) {
    const QRCode = (await import("qrcode")).default;
    const encode = (text, level) => QRCode.create(text, { errorCorrectionLevel: level });

    // ── 1: the address a label carries ──────────────────────────────────────
    log("the address, in the capitals that keep it in one mode:");

    const id = mintedId(4);
    const url = labelURL(PRODUCTION_ORIGIN, id);
    check(`the minted id is ${id}`, id, "HYE-TL-260909-004");
    check("the label's URL", url, "HTTPS://HYEUSA.COM/T/HYE-TL-260909-004");
    check("  and it is 38 characters", url.length, 38);
    assert("  the origin's own case does not survive", !url.includes("hyeusa"));
    check("a typed lowercase id reaches the same URL", labelURL(PRODUCTION_ORIGIN, id.toLowerCase()), url);
    check("a trailing slash on the origin does not double", labelURL(`${PRODUCTION_ORIGIN}/`, id), url);

    // ── 2: the version each level produces, computed rather than typed ──────
    log("");
    log(`what each error-correction level produces for that address:`);

    const table = LEVELS.map((level) => {
        const symbol = encode(url, level);
        return { level, version: symbol.version, modules: symbol.modules.size };
    });
    for (const row of table) log(`  EC ${row.level}: version ${row.version}, ${row.modules} modules a side`);

    const measured = table.find((row) => row.level === QR_ERROR_CORRECTION);
    assert(`the chosen level \`${QR_ERROR_CORRECTION}\` is one of the four`, Boolean(measured));
    check(`  and it produces version ${measured.version}`, QR_VERSION, measured.version);
    check("  which is the module count the module states", QR_SYMBOL_MODULES, measured.modules);
    // The specification's own relation, so a version and a module count cannot be
    // recorded disagreeing with each other.
    check("  four modules per version plus seventeen", QR_SYMBOL_MODULES, 4 * QR_VERSION + 17);

    // BY VALUE, AND THAT IS THE POINT RATHER THAN LAZINESS. Comparing these against
    // an expression over the same constants is a tautology: a mutation of
    // QR_QUIET_ZONE_MODULES moves QR_SIDE_MODULES, the SVG's own margin and the
    // builder's report together, so every relation still holds and the DECISION goes
    // unchecked. Measured — 4 -> 2 passed all 47 assertions before these three
    // literals were written. It is #224's rule one file over: a second path to the
    // same number has to be a second path.
    check("the quiet zone is the specification's four modules", QR_QUIET_ZONE_MODULES, 4);
    check("and the viewBox side #353 multiplies", QR_SIDE_MODULES, 33);

    // ANTI-VACUITY: the table is seen DISAGREEING across levels, so the equality
    // above is a fact about this level rather than about four identical rows.
    assert(
        "the level matters: Q and H each cost at least a version",
        table.find((r) => r.level === "Q").version > measured.version &&
            table.find((r) => r.level === "H").version > table.find((r) => r.level === "Q").version
    );
    check("and L buys nothing in size over M", table.find((r) => r.level === "L").version, table.find((r) => r.level === "M").version);

    // ── 3: the capacity boundary #348 had calculated wrongly ───────────────
    log("");
    log("the address sits exactly on this level's capacity:");

    let capacity = 0;
    for (let n = 1; n <= 80; n++) {
        try {
            QRCode.create("A".repeat(n), { errorCorrectionLevel: QR_ERROR_CORRECTION, version: QR_VERSION });
            capacity = n;
        } catch {
            break;
        }
    }
    check(`version ${QR_VERSION} at ${QR_ERROR_CORRECTION} holds N alphanumeric characters`, capacity, 38);
    check("  and the address uses all of them", capacity - url.length, 0);

    // The next id width is one character longer, which is the state
    // docs/notes/tools.md had recorded as fitting with two characters to spare.
    const wide = labelURL(PRODUCTION_ORIGIN, mintedId(1000));
    check(`a four-digit sequence gives ${wide}`, wide.length, 39);
    check("  which steps to the next version", encode(wide, QR_ERROR_CORRECTION).version, QR_VERSION + 1);

    // ── 4: the uppercase rule is worth a whole version ─────────────────────
    log("");
    log("the capitals are what keep it in one alphanumeric segment:");

    const upper = encode(url, QR_ERROR_CORRECTION);
    check("one segment", upper.segments.length, 1);
    check("  and its mode", upper.segments[0].mode.id, "Alphanumeric");

    const lower = encode(`${PRODUCTION_ORIGIN}/t/${id}`, QR_ERROR_CORRECTION);
    check("the same address in lowercase splits into modes", lower.segments.map((s) => s.mode.id).join("+"), "Byte+Alphanumeric");
    check("  and costs a version", lower.version, QR_VERSION + 1);
    check("  at the same character count", `${PRODUCTION_ORIGIN}/t/${id}`.length, url.length);

    // ── 5: the round trip, through a different library ──────────────────────
    log("");
    log("jsQR reads the symbol back to the address it was built from:");

    const read = decode(upper, QR_QUIET_ZONE_MODULES);
    assert("a symbol was found", Boolean(read));
    check("the payload", read.data, url);
    check("  the version the DECODER reports", read.version, QR_VERSION);
    check("  and the mode it found", read.chunks.map((chunk) => chunk.type).join("+"), "alphanumeric");

    let round = 0;
    const ids = [1, 4, 17, 99, 100, 999].map(mintedId);
    for (const each of ids) {
        const eachUrl = labelURL(PRODUCTION_ORIGIN, each);
        const out = decode(encode(eachUrl, QR_ERROR_CORRECTION), QR_QUIET_ZONE_MODULES);
        if (out && out.data === eachUrl) round++;
    }
    check(`${ids.length} minted ids decode back to their own address`, round, ids.length);

    // ANTI-VACUITY: the decoder is seen REFUSING, twice and for two reasons, so a
    // pass above is a fact about the symbol rather than about a decoder that says
    // yes to anything. A matrix it cannot locate returns null; a different address
    // returns a different payload.
    assert(
        "  the decoder returns nothing when the finder pattern is destroyed",
        (() => {
            const { grid, side } = gridOf(upper, QR_QUIET_ZONE_MODULES);
            for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) grid[QR_QUIET_ZONE_MODULES + y][QR_QUIET_ZONE_MODULES + x] = 0;
            const { data, px } = raster(grid, side, 4);
            return jsQR(data, px, px) === null;
        })()
    );
    assert(
        "  and it reads a different address as a different payload",
        decode(encode(labelURL(PRODUCTION_ORIGIN, mintedId(5)), QR_ERROR_CORRECTION), QR_QUIET_ZONE_MODULES).data !== url
    );

    // ── 6: what the level buys, and where it buys nothing ──────────────────
    log("");
    log("what this level survives in the data region:");

    const survives = (level, size) => {
        const out = blotted(encode(url, level), QR_QUIET_ZONE_MODULES, size);
        return Boolean(out) && out.data === labelURL(PRODUCTION_ORIGIN, id);
    };
    assert(`${QR_ERROR_CORRECTION} decodes through a 5x5 blot`, survives(QR_ERROR_CORRECTION, 5));
    assert(`  and through a 7x7 blot`, survives(QR_ERROR_CORRECTION, 7));
    // The measurement the choice rests on: L is the same size and strictly weaker,
    // so the level is free rather than paid for.
    assert("L, the same version and module count, does not", !survives("L", 5));

    // AND WHERE ERROR CORRECTION BUYS NOTHING AT ANY LEVEL, which is the other half
    // of the argument: a sticker abrades at its corners, and a finder pattern is
    // outside what any level protects.
    const finderLost = LEVELS.filter((level) => {
        const symbol = encode(url, level);
        const { grid, side } = gridOf(symbol, QR_QUIET_ZONE_MODULES);
        grid[QR_QUIET_ZONE_MODULES + 1][QR_QUIET_ZONE_MODULES + 1] ^= 1;
        const { data, px } = raster(grid, side, 4);
        return jsQR(data, px, px) === null;
    });
    check("one flipped module inside a finder pattern loses the symbol at N levels", finderLost.length, LEVELS.length);

    // ── 7: the quiet zone, and what cannot be shown about it ───────────────
    log("");
    log("the quiet zone is in the SVG, and no decode here can justify it:");

    const built = await buildToolItemQR({ origin: PRODUCTION_ORIGIN, toolItemId: id });
    // The rendered geometry, by value for the reason above — the SVG really does
    // carry whatever margin the constant says, so comparing it against that constant
    // proves only that the renderer was passed it.
    check("the viewBox covers symbol plus margin", built.svg.match(/viewBox="([^"]*)"/)[1], "0 0 33 33");
    assert("the SVG sets no width or height, so the consumer sizes it", !/\swidth=/.test(built.svg) && !/\sheight=/.test(built.svg));
    assert("it paints white across the whole box", built.svg.includes(`fill="#ffffff" d="M0 0h${QR_SIDE_MODULES}v${QR_SIDE_MODULES}H0z"`));
    assert("and the ink is a literal rather than currentColor", built.svg.includes("#000000") && !built.svg.includes("currentColor"));
    // THE LIMIT, ASSERTED SO IT IS NOT MERELY CLAIMED: a clean image decodes with no
    // margin at all, so a passing round trip is not evidence for the four modules.
    assert(
        "a software decoder reads the same symbol with NO margin, which is why this proves nothing about it",
        (() => {
            const out = decode(upper, 0);
            return Boolean(out) && out.data === url;
        })()
    );

    // ── 8: what the builder hands the label layout ──────────────────────────
    log("");
    log("what buildToolItemQR reports back:");
    check("the URL it encoded", built.url, url);
    check("the version", built.version, QR_VERSION);
    check("the symbol's modules", built.symbolModules, QR_SYMBOL_MODULES);
    check("the quiet zone", built.quietZoneModules, 4);
    check("the side #353 multiplies", built.sideModules, 33);

    // A dev origin is a different symbol, which is what stops a figure measured in
    // a browser from being read as the printed one.
    const local = await buildToolItemQR({ origin: DEV_ORIGIN, toolItemId: id });
    check(`${DEV_ORIGIN} gives a ${local.version === QR_VERSION ? "matching" : "different"} version`, local.version, QR_VERSION + 1);
    check("  and more modules a side", local.sideModules, QR_SIDE_MODULES + 4);

    // ── 9: the mode invariant is enforced, not assumed ─────────────────────
    log("");
    log("an origin outside the alphanumeric set is refused rather than encoded:");
    let refused = null;
    try {
        await buildToolItemQR({ origin: "http://[::1]:3000", toolItemId: id });
    } catch (error) {
        refused = error.message;
    }
    assert("an IPv6 origin throws", typeof refused === "string" && refused.includes("alphanumeric"));
    assert("  and the message names what it encoded as", Boolean(refused) && refused.includes("Byte"));
}

if (isMain(import.meta.url)) standalone(title, run);
