// The QR symbol a tool label carries (#351): what it encodes, how much damage it
// survives, and how many modules it puts on a side.
//
// WHAT THIS ISSUE CHANGED IN KIND. Every QR figure on this axis was a capacity-table
// lookup until now — #348 chose the printed address by reading the specification and
// encoded nothing. This module encodes, and the numbers below are what came back.
// Two of #348's calculations were confirmed and one was wrong; docs/notes/tools.md
// carries all three and the tables.
//
// THE VERSION IS RECORDED HERE AND NOT FORCED ONTO THE ENCODER. `QR_VERSION` is what
// the production address produces at `QR_ERROR_CORRECTION`, held to the encoder by
// `offline/tool-label-qr.mjs` rather than passed to it. Passing it would make an
// address that no longer fits REFUSE at print time, and the address is not fixed:
// `nextSequence` widens past its pad, so the thousandth tool item of one day is
// `HYE-TL-260909-1000` and one character longer — which is version 3 at this level,
// measured. A label that comes out bigger is a label; a label that refuses to print
// is a tool nothing can track. So the encoder picks, this module reports what it
// picked, and the geometry travels in the `viewBox` and in `buildToolItemQR`'s
// return rather than in a promise that the version never moves.
//
// WHICH MAKES ONE THING THE CONSUMER'S OBLIGATION: SIZE BY THE MODULE, NOT BY THE
// SYMBOL. A version step adds four modules to a side, so a fixed-width box prints
// them 16% thinner while a per-module width prints a larger label. Only the second
// stays scannable, and #353 is where the millimeter goes.
//
// BLACK ON WHITE, AND NEVER THEMED. The renderer writes `#ffffff` and `#000000` as
// literals and that is load-bearing rather than incidental: a symbol drawn in
// `currentColor` inverts with a theme, and an inverted symbol is outside what the
// specification asks a reader to decode. Nothing in this repository themes it today
// and nothing has been observed doing so — this is here so a design pass over the
// tools screens meets the constraint in the module that owns the bytes.
//
// SERVER-SHAPED, WHICH IS THE ONE BOUNDARY THIS FILE ADDS. It imports `qrcode`, so no
// `"use client"` file may import it — the constraint is bundle weight rather than
// credentials, which is a different rule from CLAUDE.md's forbidden roots and is why
// `offline/client-import-safety.mjs` will not catch a violation. It is nonetheless
// offline-safe: nothing here reaches `lib/airtable/`, `./toolRoutes.js` is imported
// with its extension spelled out (lib/materialPriceView.js's precedent, #19), and a
// bare package specifier resolves under plain `node`. That is what lets the offline
// tier encode a real address and read the version back.
//
// AND A PAGE MAY CALL THIS DIRECTLY, WHICH IS WHAT MAKES A SHEET AFFORDABLE. The
// endpoint at `/api/tool-items/[toolItemId]/qr` costs two Airtable operations per
// symbol, so a hundred labels fetched one `<img>` at a time is two hundred requests
// against a base limited to five a second. A screen rendering many symbols imports
// this instead and pays for the batched read it was already making. One
// implementation, two callers.

import QRCode from "qrcode";

import { canonicalToolItemId, labelPath } from "./toolRoutes.js";

/**
 * The error correction level, chosen against a worn label rather than a full one.
 *
 * MEASURED, AND `M` IS FREE OVER `L`. At the 38-character production address both
 * produce a version 2 symbol with 25 modules on a side, so the level costs nothing
 * in printed density — and a solid blot painted over the data region kills `L` at
 * 5x5 while `M` still decodes at 7x7. `Q` and `H` each cost a version (29 and 33
 * modules a side, so modules 16% and 32% thinner at a fixed sticker size) and buy
 * nothing where a sticker actually fails: one flipped module inside a finder pattern
 * leaves no symbol to find at `L`, `M`, `Q` and `H` alike. Error correction protects
 * the data region; it does not protect the corners that abrade first.
 *
 * The cost of `M` is that the address is at the exact capacity boundary — see
 * `QR_VERSION`.
 */
export const QR_ERROR_CORRECTION = "M";

/**
 * The light margin the specification requires around a symbol, in modules.
 *
 * INSIDE THE SVG RATHER THAN THE LABEL'S TO REMEMBER. The `viewBox` covers the
 * symbol plus this margin on all four sides, and the renderer paints white across
 * the whole of it — so a colored label stock or a neighboring mark cannot bleed
 * into the quiet zone, and the layout's whole obligation becomes "do not print over
 * this box".
 *
 * NO CHECK IN THIS REPOSITORY CAN PROVE IT, which is worth knowing before someone
 * tries: a software decoder reads a clean image with no margin at all — measured,
 * jsQR decoded the same symbol rendered with a 0-module margin. What the margin is
 * for is a camera separating the symbol from everything printed beside it, so the
 * four rests on the specification and on where the label sits.
 */
export const QR_QUIET_ZONE_MODULES = 4;

/**
 * The version the production address produces at `QR_ERROR_CORRECTION`.
 *
 * NOT A CEILING AND NOT AN ARGUMENT — see the header. `offline/tool-label-qr.mjs`
 * encodes `https://hyeusa.com` and fails if the answer is not this, so a change to
 * the address, the host, the level or the library lands as a failing check rather
 * than as a quietly denser sticker.
 *
 * ZERO CHARACTERS OF HEADROOM, AND THAT IS THE MEASURED BOUNDARY. Version 2 holds
 * exactly 38 alphanumeric characters at this level and the address is exactly 38.
 * docs/notes/tools.md records what #348 had calculated instead, and what happens at
 * 39.
 */
export const QR_VERSION = 2;

/** Modules on a side of the symbol proper, at `QR_VERSION`. */
export const QR_SYMBOL_MODULES = 25;

/**
 * Modules on a side of the whole SVG, quiet zone included — the `viewBox` side.
 *
 * THE FIGURE #353 MULTIPLIES. A printed size is this number times a per-module
 * width, and it is stated as a constant rather than only returned by the builder
 * because a number that lives inside an async call is one the label layout cannot
 * read while it is being drawn.
 */
export const QR_SIDE_MODULES = QR_SYMBOL_MODULES + QR_QUIET_ZONE_MODULES * 2;

/**
 * The absolute URL one label encodes, in the capitals that keep it in one mode.
 *
 * THE UPPERCASE SPELLING IS WORTH A FULL VERSION, MEASURED RATHER THAN CALCULATED.
 * A QR code's alphanumeric mode holds digits, `A`-`Z` and `$%*+-./:` and packs them
 * far tighter than byte mode. The same 38-character address in its lowercase form
 * segments into `Byte:20 + Alphanumeric:18` and needs version 3 — so #348's reason
 * for printing the whole URL in capitals is confirmed, at one version, and `/T/`
 * resolves through `next.config.mjs`'s rewrite.
 *
 * The path comes from `labelPath` rather than being spelled again here: one module
 * owns every address on this axis, and a printed one moving means reprinting every
 * label already glued to a tool.
 */
export function labelURL(origin, toolItemId) {
    const base = String(origin ?? "").replace(/\/+$/, "");
    return `${base}${labelPath(canonicalToolItemId(toolItemId))}`.toUpperCase();
}

/**
 * The symbol for one tool item, as SVG, generated on request and stored nowhere.
 *
 * IT TAKES THE ORIGIN BECAUSE THE HOST IS NOT THIS MODULE'S TO KNOW. The route reads
 * it off the request, so a label encodes the host it was printed from and cannot
 * disagree with reality — which is also why the figures above are measured against
 * `https://hyeusa.com` explicitly. A dev origin is longer (`HTTP://LOCALHOST:3000`
 * is 41 characters with the path and the id) and produces version 3, so a symbol
 * looked at locally is not the one a label carries. docs/notes/tools.md records that
 * a label may not be printed from a preview host at all.
 *
 * TWO ENCODES PER CALL, AND THE SECOND IS DELIBERATE. `create` is what answers which
 * version and which mode came out; `toString` is the library's own renderer and
 * re-encodes internally. Measured at 114us and 104us on this machine, against an
 * Airtable round trip of tens of milliseconds — so the alternatives both cost more
 * than they save: rendering the SVG from `create`'s matrix is a second
 * implementation of one rule, and reaching into `qrcode/lib/renderer/svg` is a
 * dependency on a path the package does not publish.
 *
 * THE MODE IS ASSERTED RATHER THAN ASSUMED. Anything outside the alphanumeric set
 * silently costs a version, and the one input that could carry such a character is
 * the origin — an IPv6 host would, since `[` and `]` are outside the set. No host
 * this app runs on does, so the throw is a tripwire on the invariant `labelURL`
 * exists for rather than a reachable state.
 */
export async function buildToolItemQR({ origin, toolItemId }) {
    const url = labelURL(origin, toolItemId);

    const symbol = QRCode.create(url, { errorCorrectionLevel: QR_ERROR_CORRECTION });
    const modes = symbol.segments.map((segment) => segment.mode.id);
    if (modes.length !== 1 || modes[0] !== "Alphanumeric") {
        throw new Error(
            `A tool label's URL must encode in one alphanumeric segment; ${url} encoded as ${modes.join("+")}`
        );
    }

    const svg = await QRCode.toString(url, {
        type: "svg",
        errorCorrectionLevel: QR_ERROR_CORRECTION,
        margin: QR_QUIET_ZONE_MODULES,
    });

    return {
        svg,
        url,
        version: symbol.version,
        symbolModules: symbol.modules.size,
        quietZoneModules: QR_QUIET_ZONE_MODULES,
        sideModules: symbol.modules.size + QR_QUIET_ZONE_MODULES * 2,
    };
}
