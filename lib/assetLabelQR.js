// The QR symbol an asset label carries (#351): what it encodes, how much damage it
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
// `offline/asset-label-qr.mjs` rather than passed to it. Passing it would make the
// encoder THROW on an address that no longer fits, and the address is not fixed: its
// host is whatever the request arrived on. This named the thousandth asset of one
// day as the case, and #411 is where that stopped being one — the shortened address
// is 36 characters at a four-digit sequence on the production host and stays at
// version 2, measured. What the encoder choosing buys since #453 is WHERE a larger
// symbol is refused: the label absorbs no version step, so the labels' dialog asks
// `symbolBox` and says why it draws no page for it (`/tool-items/labels` did until
// #457), while the asset's own page still draws what the host built — and a throw
// here would take the dialog's read or that page down instead. So the encoder picks,
// this module reports what it picked, and the geometry travels in the `viewBox` and in
// `buildAssetQR`'s return rather than in a promise that the version never moves.
//
// WHICH MAKES ONE THING THE CONSUMER'S OBLIGATION: SIZE BY THE MODULE, NOT BY THE
// SYMBOL. A version step adds four modules to a side, so a fixed-width box prints
// them 16% thinner while a per-module width draws a larger symbol — which the labels
// refuse since #453, where the label has no room for it, rather than thinning. Only a
// module at its own width stays scannable, and `lib/assetLabelPage.js` is where the
// millimeter goes.
//
// BLACK ON WHITE, AND NEVER THEMED. The renderer writes `#ffffff` and `#000000` as
// literals and that is load-bearing rather than incidental: a symbol drawn in
// `currentColor` inverts with a theme, and an inverted symbol is outside what the
// specification asks a reader to decode. Nothing in this repository themes it today
// and nothing has been observed doing so — this is here so a design pass over the
// asset screens meets the constraint in the module that owns the bytes.
//
// SERVER-SHAPED, WHICH IS THE ONE BOUNDARY THIS FILE ADDS. It imports `qrcode`, so no
// `"use client"` file may import it — the constraint is bundle weight rather than
// credentials, which is a different rule from CLAUDE.md's forbidden roots and is why
// `offline/client-import-safety.mjs` will not catch a violation. It is nonetheless
// offline-safe: nothing here reaches `lib/airtable/`, `./assetRoutes.js` is imported
// with its extension spelled out (lib/materialPriceView.js's precedent, #19), and a
// bare package specifier resolves under plain `node`. That is what lets the offline
// tier encode a real address and read the version back.
//
// EVERY CALLER IMPORTS THIS, AND #352 IS WHERE THAT BECAME TRUE OF ALL OF THEM.
// #351 also served a symbol from `GET /api/tool-items/[toolItemId]/qr` and expected
// the asset's own page to be its caller; that page builds one instead, because
// the endpoint's two Airtable operations were a session read and an asset read it
// had already made. With the sheet importing this for the same reason at a different
// scale — a hundred labels fetched one `<img>` at a time would be two hundred
// requests against a base limited to five a second — the address had no caller and
// went. So the two places that draw a symbol both call this module — the asset's
// own page, and since #457 the labels' read, `readAssetLabelsAction`, which took
// the place of the labels' screen — and the ONLY thing that reads an asset for the
// purpose is whichever of them is running. docs/notes/tools.md records what that
// invalidated of #351.

import QRCode from "qrcode";

import { canonicalAssetId, labelCodeFor, labelPath } from "./assetRoutes.js";

/**
 * The error correction level, chosen against a worn label rather than a full one.
 *
 * MEASURED, AND `M` IS FREE OVER `L`. At the 35-character production address — 31
 * at `hyeusa.com`, where #411 measured it — both produce a version 2 symbol with 25
 * modules on a side, so the level costs nothing in printed density — and a solid
 * blot painted over the data region kills `L` at 5x5 while `M` still decodes at 7x7.
 * `Q` and `H` cost a version each (29 modules a side, so modules 16% thinner at a
 * fixed sticker size) and buy nothing where a sticker actually fails: one flipped
 * module inside a finder pattern leaves no symbol to find at `L`, `M`, `Q` and `H`
 * alike. Error correction protects the data region; it does not protect the corners
 * that abrade first.
 *
 * WHAT #411 CHANGED HERE IS THE PRICE AND NOT THE CHOICE, AND THE PRICE MOVED IN
 * THE ALTERNATIVES' FAVOR. `M` used to put the address on the exact capacity
 * boundary and the shortened one leaves room — seven characters at `hyeusa.com`,
 * three at `app.hyeusa.com`; `H` used to cost TWO versions and now costs one, which
 * puts it level with `Q`. The deciding measurement is untouched by any of that — a
 * finder pattern is outside what every level protects — so the conclusion stands on
 * the argument that reached it rather than on the arithmetic that moved.
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
 * NOT A CEILING AND NOT AN ARGUMENT — see the header. `offline/asset-label-qr.mjs`
 * encodes `https://app.hyeusa.com` and fails if the answer is not this, so a change to
 * the address, the host, the level or the library lands as a failing check rather
 * than as a quietly denser sticker.
 *
 * THREE CHARACTERS OF HEADROOM AT THE HOST DECIDED FOR THE APP (#467), SEVEN AT
 * `hyeusa.com` SINCE #411, ZERO BEFORE IT. Version 2 holds exactly 38 alphanumeric
 * characters at this level; the address was exactly 38 at `hyeusa.com` before #411
 * took the token out, 31 after, and it is 35 at `app.hyeusa.com`. What the three buy
 * is measured rather than described: a daily sequence of up to six digits, before 39
 * steps this to version 3 — and a host longer than seventeen characters is the other
 * thing that would. docs/notes/tools.md records what #348 had calculated, what #351
 * measured instead, and what the headroom is for.
 *
 * **SINCE #453 THE STEP IS A LABEL THE LABEL SCREEN REFUSES**, because the label
 * absorbs no version above this one — so these characters decide whether a label
 * prints at all. `lib/assetLabelPage.js:VERSION_HEADROOM` carries the condition for
 * changing that.
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
 * far tighter than byte mode. The same address in its lowercase form — 31 characters
 * when #411 measured it, 35 at the host decided since — segments into two modes and
 * needs version 3, so #348's reason for printing the whole URL in capitals is
 * confirmed, at one version, and `/L/` resolves through `next.config.mjs`'s rewrite.
 * **#411 shortened the address and re-measured this rather than inheriting it**: a
 * shorter string buys no relief here, because what costs the version is the mode
 * split and not the length.
 *
 * The path comes from `labelPath` rather than being spelled again here: one module
 * owns every address on this axis, and a printed one moving means reprinting every
 * label already glued to an asset. `labelPath` is also what drops the family token,
 * so the printed code is spelled in exactly one place (#411).
 */
export function labelURL(origin, assetId) {
    const base = String(origin ?? "").replace(/\/+$/, "");
    return `${base}${labelPath(canonicalAssetId(assetId))}`.toUpperCase();
}

/**
 * The symbol for one asset, as SVG, generated on request and stored nowhere.
 *
 * IT TAKES THE ORIGIN BECAUSE THE HOST IS NOT THIS MODULE'S TO KNOW. Its caller reads
 * it off the request, so a label encodes the host it was printed from and cannot
 * disagree with reality — which is also why the figures above are measured against
 * `https://app.hyeusa.com` explicitly. docs/notes/tools.md records that a label may not
 * be printed from a preview host at all.
 *
 * AND #411 TOOK AWAY THE TELL THAT USED TO MAKE A LOCAL SYMBOL OBVIOUS, WHICH IS A
 * LOSS RATHER THAN A DETAIL. A dev origin produced version 3 against production's
 * version 2, so a symbol looked at locally was visibly a different object; at 34
 * characters it is version 2 with the same 25 modules, and only the PAYLOAD differs
 * now. A Vercel preview domain is long enough to still step a version, and since #453
 * that step is a refusal rather than a tell: the label absorbs none, so a preview
 * domain's labels are not drawn at all. **For a host short enough to stay at version 2
 * — a local server is one — nothing the app draws tells the two apart since #454**,
 * when `/tool-items/labels` stopped naming the host above the sheet and warning under
 * it. What stands between a person and a run of stickers pointing at the wrong host
 * is the rule the paragraph above cites.
 *
 * ONE ENCODE PER CALL SINCE #467, AND THE SVG IS DRAWN FROM IT — see `symbolSvg`.
 * `create` answers which version and which mode came out, and its matrix is what the
 * symbol is drawn from. It was two until then, `toString` being the library's own
 * renderer and re-encoding internally, at 114us and 104us measured.
 *
 * THE MODE IS ASSERTED RATHER THAN ASSUMED. Anything outside the alphanumeric set
 * silently costs a version, and the one input that could carry such a character is
 * the origin — an IPv6 host would, since `[` and `]` are outside the set. No host
 * this app runs on does, so the throw is a tripwire on the invariant `labelURL`
 * exists for rather than a reachable state.
 */
export async function buildAssetQR({ origin, assetId }) {
    const url = labelURL(origin, assetId);

    const symbol = QRCode.create(url, { errorCorrectionLevel: QR_ERROR_CORRECTION });
    const modes = symbol.segments.map((segment) => segment.mode.id);
    if (modes.length !== 1 || modes[0] !== "Alphanumeric") {
        throw new Error(
            `An asset label's URL must encode in one alphanumeric segment; ${url} encoded as ${modes.join("+")}`
        );
    }

    return {
        svg: symbolSvg(symbol.modules),
        url,
        version: symbol.version,
        symbolModules: symbol.modules.size,
        quietZoneModules: QR_QUIET_ZONE_MODULES,
        sideModules: symbol.modules.size + QR_QUIET_ZONE_MODULES * 2,
    };
}

/**
 * The label one asset prints (#457): its printed code and its symbol, which is what
 * the labels' dialog draws a page from.
 *
 * BUILT HERE ONCE FOR BOTH OF THE DIALOG'S OPENERS. A category's page has the dialog read
 * its run on the server (`readAssetLabelsAction`) and an asset's page builds its
 * own label as it renders, so two places hand the dialog one shape — and a shape
 * assembled in each would be two answers to what a label carries, one of which a later
 * field would reach and the other not. The code is `labelCodeFor`'s and the symbol
 * `buildAssetQR`'s, so neither is spelled again. `sideModules` is the side count
 * this symbol came out at, which the dialog sizes the symbol's box from (`symbolBox`).
 */
export async function buildAssetLabel({ origin, assetId }) {
    const symbol = await buildAssetQR({ origin, assetId });
    return {
        assetId,
        labelCode: labelCodeFor(assetId),
        svg: symbol.svg,
        sideModules: symbol.sideModules,
    };
}

/**
 * The symbol's modules as SVG FILLS: a white box the quiet zone wide, and one
 * rectangle a module tall for every run of dark modules along a row.
 *
 * NOT THE LIBRARY'S RENDERER SINCE #467, AND A PRINT IS WHY. `qrcode`'s own SVG draws
 * each run as a STROKE one module wide, and a stroke thinner than a point comes out of
 * Chrome's and Edge's print as a hairline — measured in the PDF both save: at 0.29 mm a
 * module is 0.82 pt, and every row was written at line width 0 and 82% alpha, so the
 * modules printed as thin lines rather than bars and no page of it, rendered at
 * 1200 dpi, decoded. A fill has no width to round, so it prints at its size. Nothing at
 * #351's 0.4 mm module or larger ever met this, since that is over a point.
 *
 * #351 CHOSE THE LIBRARY'S RENDERER FOR TWO REASONS AND THIS KEEPS WHAT THEY WERE FOR:
 * the margin and the absent `width`/`height` are drawn the way that renderer drew them,
 * and the runs are the same runs, read off the same matrix `create` made, so there is
 * one encoding of the address and one drawing of it. What it costs is bytes — about
 * twice the library's path, which #351 measured at 1210 against 2346 for one written
 * here.
 *
 * BLACK ON WHITE AS LITERALS, for the reason the header gives.
 */
function symbolSvg(modules) {
    const size = modules.size;
    const side = size + QR_QUIET_ZONE_MODULES * 2;
    let runs = "";
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; ) {
            if (!modules.get(row, col)) {
                col++;
                continue;
            }
            const start = col;
            while (col < size && modules.get(row, col)) col++;
            const length = col - start;
            runs += `M${start + QR_QUIET_ZONE_MODULES} ${row + QR_QUIET_ZONE_MODULES}h${length}v1h-${length}z`;
        }
    }
    return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" shape-rendering="crispEdges">` +
        `<path fill="#ffffff" d="M0 0h${side}v${side}H0z"/><path fill="#000000" d="${runs}"/></svg>\n`
    );
}
