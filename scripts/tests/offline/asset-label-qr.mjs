// What an asset label's QR symbol encodes, and the version it comes out at (#351).
//
// WHAT THIS FILE IS FOR. Every QR figure on this axis was a capacity-table lookup
// until this issue — #348 chose the printed address by reading the specification and
// encoded nothing, and `docs/notes/tools.md` said so in its own heading. This check
// encodes a real address and reads the answers back, so the version, the module
// count and the mode are measurements that fail when they stop being true rather
// than sentences in a document nobody re-derives.
//
// THE VERSION IS HELD HERE BECAUSE IT IS NOT HELD AT RUNTIME. `lib/assetLabelQR.js`
// deliberately does not pass a version to the encoder — an address that no longer
// fits would refuse to print, and a label that comes out bigger beats an asset nothing
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
//   * IT DECODES THE SVG'S PATH, NOT A BROWSER'S PAINTING OF IT. Until #467 it decoded
//     the matrix alone; since the builder draws the symbol itself, section 7b fills the
//     SVG's own path into a raster and decodes that. Whether a browser PAINTS or PRINTS
//     the bytes decodably is still rendering, which this tier never does — and a print
//     is where the stroke the library drew became a hairline, which is why the builder
//     fills. That is checked in a printed PDF and recorded in the pull request.
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
    buildAssetQR,
    labelURL,
} from "../../../lib/assetLabelQR.js";
import { ID_KINDS, dailyIdPrefix, formatSequentialId } from "../../../lib/idSequence.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "What a tool label's QR symbol encodes, measured (#351)";

/**
 * The host a printed label carries, which is what every figure is measured at.
 *
 * `app.hyeusa.com` SINCE #467, the host decided for the app. It was `hyeusa.com`,
 * four characters shorter, from #348 until then, and #351 and #411 measured their
 * figures against that one — 31 characters, seven spare — which `docs/notes/tools.md`
 * keeps as the record of those two issues.
 */
const PRODUCTION_ORIGIN = "https://app.hyeusa.com";

/** The dev origin. One character shorter than production and, since #411, the
 *  same version — see section 8 for what that took away. */
const DEV_ORIGIN = "http://localhost:3000";

/** A Vercel preview domain, which is the host a label must never be printed from. */
const PREVIEW_ORIGIN = "https://materials-hye.vercel.app";

/** The four levels, so the table is computed rather than typed. */
const LEVELS = ["L", "M", "Q", "H"];

/** A minted `Asset ID`, from the generator rather than a literal typed here. */
function mintedId(sequence) {
    const prefix = dailyIdPrefix(ID_KINDS.ASSET, new Date(2026, 8, 9));
    return formatSequentialId(prefix, sequence, { padLength: ID_KINDS.ASSET.padLength });
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
    check(`the minted id is ${id}`, id, "HYE-AST-260909-004");
    check("the label's URL", url, "HTTPS://APP.HYEUSA.COM/L/260909-004");
    check("  and it is 35 characters", url.length, 35);
    // THE EIGHT THE FAMILY TOKEN WOULD SPEND (#411, #513), reached a second way so the
    // length above is not the only thing holding it: with the token the address would be
    // 43 characters at this host — 42 while the token was `HYE-TL-`, and 38 at
    // `hyeusa.com`, where #411 measured it — the id it names is 18, and what it ends with
    // is that id's last ten.
    check("  eight fewer than the 43 the token would make it", 43 - url.length, 8);
    assert("  ending in the id's own tail", url.endsWith(id.slice(8)) && id.slice(8) === "260909-004");
    // `HYE` on its own is in `HYEUSA.COM`, so the token is what is barred rather
    // than its first three characters.
    assert("  and carrying no part of the token", !url.includes("HYE-AST") && !url.includes("-AST-"));
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
        "the level matters: Q and H each cost a version over M",
        table.find((r) => r.level === "Q").version > measured.version &&
            table.find((r) => r.level === "H").version > measured.version
    );
    check("and L buys nothing in size over M", table.find((r) => r.level === "L").version, table.find((r) => r.level === "M").version);
    // WHAT #411 CHANGED IN THIS TABLE, RECORDED BECAUSE IT MADE AN ALTERNATIVE
    // CHEAPER. At the 38-character address `H` cost TWO versions and `Q` one; at 31
    // they cost one each, and at the 35 `app.hyeusa.com` makes they still do (#467),
    // so the highest level is now the same printed density as
    // `Q`. The choice does not reopen — what decided it is that a flipped module in
    // a finder pattern loses the symbol at every level alike, which section 6
    // measures and which no address length touches — but the price is not what it
    // was, and a comparison that used to be a step is now an equality.
    check(
        "H and Q now land on the same version",
        table.find((r) => r.level === "H").version,
        table.find((r) => r.level === "Q").version
    );
    check("  which is one above the chosen level", table.find((r) => r.level === "H").version - measured.version, 1);

    // ── 3: the capacity, which the address no longer fills (#411) ──────────
    log("");
    log("what this level's capacity leaves over:");

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
    // THIS READ `capacity - url.length === 0` UNTIL #411, WHICH IS THE FIGURE THAT
    // ISSUE EXISTS TO MOVE. The address filled the version exactly, so anything at
    // all — a wider sequence, a longer host — stepped it.
    // SEVEN AT `hyeusa.com` (#411), THREE AT `app.hyeusa.com` (#467): the four
    // characters the host decided since took four of them.
    check("  and the address leaves this many spare", capacity - url.length, 3);

    // WHAT THE THREE ACTUALLY BUY, measured rather than described, because a
    // headroom figure nobody can act on is one that gets re-derived. `nextSequence`
    // widens past its pad, so a five-digit daily sequence is a real id.
    const wide = labelURL(PRODUCTION_ORIGIN, mintedId(1000));
    check(`a four-digit sequence gives ${wide}`, wide.length, 36);
    check("  and stays at this version", encode(wide, QR_ERROR_CORRECTION).version, QR_VERSION);
    const wider = labelURL(PRODUCTION_ORIGIN, mintedId(10000));
    check(`a five-digit sequence gives ${wider}`, wider.length, 37);
    check("  and still stays", encode(wider, QR_ERROR_CORRECTION).version, QR_VERSION);
    // A HOST IS THE OTHER CLAIMANT ON THE SAME ROOM. `app.hyeusa.com` is fourteen
    // characters and seventeen is what the capacity allows beside today's code.
    const longestHost = labelURL(`https://${"h".repeat(17)}`, id);
    check(`a seventeen-character host gives ${longestHost.length} characters`, longestHost.length, capacity);
    check("  which is still this version", encode(longestHost, QR_ERROR_CORRECTION).version, QR_VERSION);

    // AND THE STEP IS SHOWN, so the figures above are a fact about the encoder
    // rather than about a version that never moves. One character past the capacity
    // is the next version — which is also the anti-vacuity this section used to get
    // for free from the four-digit sequence.
    const overCapacity = labelURL(`https://${"h".repeat(18)}`, id);
    check(`one character more is ${overCapacity.length}`, overCapacity.length, capacity + 1);
    check("  and steps to the next version", encode(overCapacity, QR_ERROR_CORRECTION).version, QR_VERSION + 1);

    // ── 4: the uppercase rule is worth a whole version ─────────────────────
    log("");
    log("the capitals are what keep it in one alphanumeric segment:");

    const upper = encode(url, QR_ERROR_CORRECTION);
    check("one segment", upper.segments.length, 1);
    check("  and its mode", upper.segments[0].mode.id, "Alphanumeric");

    // THE SHORTER ADDRESS DID NOT MAKE THE CAPITALS OPTIONAL (#411), which is worth
    // a measurement rather than an assumption: what costs the version is the mode
    // split and not the length, so the lowercase form is still version 3 while it is
    // three characters inside what version 2 holds.
    const lowercase = url.toLowerCase();
    const lower = encode(lowercase, QR_ERROR_CORRECTION);
    check("the same address in lowercase splits into modes", lower.segments.map((s) => s.mode.id).join("+"), "Byte+Alphanumeric");
    check("  and costs a version", lower.version, QR_VERSION + 1);
    check("  at the same character count", lowercase.length, url.length);
    check("  inside the capacity", capacity - lowercase.length, 3);

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
    // so the level is free rather than paid for. At the 7x7 M reads through, which is
    // where it holds for either path: at 5x5 the data decided it, L failing there for
    // `/L/` and reading through for `/L/` (#513), and failing from 6x6 on.
    assert("L, the same version and module count, does not", !survives("L", 7));

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

    const built = await buildAssetQR({ origin: PRODUCTION_ORIGIN, assetId: id });
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

    // ── 7b: the symbol is drawn in fills, and the drawing itself decodes (#467) ──
    log("");
    log("the dark modules are filled rectangles, and the SVG's own path reads back:");
    // A STROKE THINNER THAN A POINT PRINTS AS A HAIRLINE, measured in the PDF Chrome and
    // Edge save: the library's renderer drew each row as a stroke one module wide, which
    // at 0.29 mm is 0.82 pt, and the PDF wrote it at line width 0 and 82% alpha. So the
    // builder draws fills, and this holds that no stroke comes back.
    const darkPath = (svg) => svg.match(/<path fill="#000000" d="([^"]+)"/)?.[1] ?? null;
    assert("the ink is a filled path", Boolean(darkPath(built.svg)));
    check("  and nothing in the symbol is stroked", /stroke/.test(built.svg), false);
    // ANTI-VACUITY: the library's own renderer, which the builder used until #467, is
    // seen drawing exactly the stroke this refuses.
    const libraryRendering = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: QR_ERROR_CORRECTION, margin: QR_QUIET_ZONE_MODULES });
    assert("  where the library's own renderer strokes its rows", /<path stroke="#000000"/.test(libraryRendering));
    // AND THE DRAWING DECODES, which until #467 nothing here could say: the round trip
    // above reads the MATRIX. The SVG's dark path is filled into a raster at four
    // pixels a module, the way a printer fills it, and jsQR reads it back.
    const { createCanvas, Path2D } = await import("@napi-rs/canvas");
    const rasterOf = (d, draw) => {
        const scale = 4;
        const canvas = createCanvas(QR_SIDE_MODULES * scale, QR_SIDE_MODULES * scale);
        const context = canvas.getContext("2d");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.scale(scale, scale);
        context.fillStyle = "#000000";
        context.strokeStyle = "#000000";
        draw(context, new Path2D(d));
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        return jsQR(image.data, image.width, image.height);
    };
    const drawn = rasterOf(darkPath(built.svg), (context, path) => context.fill(path));
    check("the SVG's own path, filled, decodes to the address", drawn?.data, url);
    // AND IT SITS INSIDE ITS QUIET ZONE, which the decode cannot say, since a decoder
    // reads a symbol with no margin at all (section 7): the dark rectangles reach four
    // modules from every edge of the box and no closer. Read off the path's own corners.
    const extent = (d) => {
        const xs = [];
        const ys = [];
        for (const [, x, y, run] of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
            xs.push(Number(x), Number(x) + Number(run));
            ys.push(Number(y), Number(y) + 1);
        }
        return `${Math.min(...xs)}..${Math.max(...xs)} across, ${Math.min(...ys)}..${Math.max(...ys)} down`;
    };
    check("  its dark modules span the symbol proper, four in from every edge", extent(darkPath(built.svg)), "4..29 across, 4..29 down");
    // ANTI-VACUITY: the same reading of a path drawn with no quiet-zone offset is seen
    // starting at the box's own edge.
    check("  where a path drawn without the margin starts at the edge", extent("M0 0h7v1h-7zM18 24h7v1h-7z"), "0..25 across, 0..25 down");
    // ANTI-VACUITY, and the print's failure in miniature: the library's stroked rows
    // drawn as a quarter-module hairline do not decode, while the same rows stroked a
    // module wide do — so the decode above is a fact about how the modules are drawn.
    const strokedRows = libraryRendering.match(/<path stroke="#000000" d="([^"]+)"/)[1];
    const hairline = rasterOf(strokedRows, (context, path) => {
        context.lineWidth = 0.25;
        context.stroke(path);
    });
    check("  rows drawn as hairlines do not", hairline, null);
    const fullStroke = rasterOf(strokedRows, (context, path) => {
        context.lineWidth = 1;
        context.stroke(path);
    });
    check("  and the same rows a module wide do", fullStroke?.data, url);

    // ── 8: what the builder hands the label layout ──────────────────────────
    log("");
    log("what buildAssetQR reports back:");
    check("the URL it encoded", built.url, url);
    check("the version", built.version, QR_VERSION);
    check("the symbol's modules", built.symbolModules, QR_SYMBOL_MODULES);
    check("the quiet zone", built.quietZoneModules, 4);
    check("the side #353 multiplies", built.sideModules, 33);

    // A LOCAL SYMBOL USED TO BE A DIFFERENT SIZE AND IS NOT ANY MORE (#411), which
    // is a safeguard this issue took away rather than a detail. #351 asserted
    // version 3 here, and that difference was what stopped a figure measured in a
    // browser from being read as the printed one — and, on a screen, what made a
    // locally rendered symbol visibly not the sticker's. At 34 characters the dev
    // origin is version 2 with the same module count, so only the PAYLOAD tells them
    // apart now. Asserted in both directions so neither half can drift unnoticed.
    const local = await buildAssetQR({ origin: DEV_ORIGIN, assetId: id });
    check(`${DEV_ORIGIN} is ${local.url.length} characters`, local.url.length, 34);
    check("  and now gives the SAME version as production", local.version, QR_VERSION);
    check("  at the same modules a side", local.sideModules, QR_SIDE_MODULES);
    assert("  so only the payload distinguishes them", local.url !== url && local.url.includes("LOCALHOST"));

    // WHICH LEFT THE HOST WARNING ON `/tool-items/labels` AS THE DEFENSE UNTIL #454
    // TOOK IT OFF, and the one case where the geometry still tells is the one that
    // needed it least: a Vercel preview domain is long enough to step a version anyway.
    const preview = await buildAssetQR({ origin: PREVIEW_ORIGIN, assetId: id });
    check(`a preview domain is ${preview.url.length} characters`, preview.url.length, 45);
    assert("  past the capacity", preview.url.length > capacity);
    check("  so it still steps a version", preview.version, QR_VERSION + 1);
    check("  and more modules a side", preview.sideModules, QR_SIDE_MODULES + 4);

    // ── 9: the mode invariant is enforced, not assumed ─────────────────────
    log("");
    log("an origin outside the alphanumeric set is refused rather than encoded:");
    let refused = null;
    try {
        await buildAssetQR({ origin: "http://[::1]:3000", assetId: id });
    } catch (error) {
        refused = error.message;
    }
    assert("an IPv6 origin throws", typeof refused === "string" && refused.includes("alphanumeric"));
    assert("  and the message names what it encoded as", Boolean(refused) && refused.includes("Byte"));
}

if (isMain(import.meta.url)) standalone(title, run);
