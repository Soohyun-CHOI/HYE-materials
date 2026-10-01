"use client";

import { useState } from "react";
import {
    LABEL_STOCK,
    LABEL_STOCK_NAME,
    MIN_ID_FONT_PT,
    TOOL_LABEL_PAGE_COPY as COPY,
    labelBudget,
    symbolBox,
} from "@/lib/toolLabelPage";

// The label pages and the picker above them (#353, #467).
//
// ONE PAGE PER LABEL, AND THE PAGE ON SCREEN IS THE PAGE THAT PRINTS (#467). Each
// selected label is one box the size of the label, and `labels.css` gives each its
// own page at print, the page box being the label's size — so what a reader sees here
// is what comes off the tape, drawn in one place. Until #467 this laid a Letter sheet
// out, labels placed on it from a start position; a label printer cuts after every
// page, so there is no sheet to place them on and no part-used run to start into.
//
// AND EACH LABEL IS ONE SVG FROM THE PAGE'S CORNER, BECAUSE A PRINT SNAPS EVERY BOX TO
// A WHOLE PIXEL. Measured in the PDF Chrome and Edge save: drawn as boxes of their own,
// the symbol landed 0.12 mm higher than its margin and the code 0.10 mm lower, each
// box's corner rounded to the nearest CSS pixel — so the margins the print proved came
// out 0.53 and 0.55 mm instead of 0.65. Inside an SVG nothing is snapped, and the one
// SVG starts at the page's own corner, which is a whole pixel on every page. So the
// symbol and the code are placed in millimeters inside it, where `labelBudget` puts
// them, and only the label as a whole is a box.
//
// A CLIENT COMPONENT BECAUSE THE SELECTION IS STATE, and that is the only reason.
// Nothing here reads the base or builds a symbol: the page has already done both
// and hands over one `svg` string per label. **It must never import
// `lib/toolLabelQR.js`** — that module imports `qrcode`, which would put the whole
// encoder in the browser bundle, and `offline/client-import-safety.mjs` cannot see
// it because the rule that check enforces is about `lib/airtable/`. #353 added an
// assertion for this one, which `offline/tool-label-page.mjs` carries.
//
// EVERY DIMENSION COMES FROM `lib/toolLabelPage.js` AND NONE FROM THIS FILE. The
// stock's figures and what they derive move together there; a millimeter or a point
// written here would be the one that did not move.
//
// THE CODE GOES UNDER THE SYMBOL (#431), and a label carries those two and nothing
// else. The order below is the order they print in, which is the order the label's
// dimensions were derived for.
//
// `dangerouslySetInnerHTML` IS THE ONLY WAY TO INLINE AN SVG STRING, and it is safe
// here for a reason rather than by inspection: the symbol is drawn by
// `lib/toolLabelQR.js` out of `qrcode`'s module matrix — numbers and nothing else
// since #467, where it was the library's own renderer — for a payload that is the
// RECORD's `Tool Item ID`, so nothing a requester typed reaches these bytes — #351
// established that when it made the endpoint read the record. The alternative, a
// base64 data URI per label, prints the same and costs a third more bytes at a
// hundred labels. Its own `<svg>` fills the box it is set into, which is what sizes
// it.
//
// THE PICKER AND THE CONTROLS ARE SCREEN-ONLY. `labels.css` hides them at print, so
// the tape carries labels and nothing else. An unchecked label leaves the run rather
// than printing blank, so a run of N prints N pages.

export default function LabelPages({ labels, sideModules }) {
    const [excluded, setExcluded] = useState(() => new Set());

    // One budget for the label, sized for today's symbol plus the headroom — the
    // margins are what that symbol leaves, and they do not move per label. What moves
    // per label is the BOX, from that label's own side count.
    const budget = labelBudget({ sideModules });
    const boxes = new Map(
        labels.map((label) => [label.toolItemId, symbolBox({ sideModules: label.sideModules, budget })])
    );
    const oversized = labels.filter((label) => !boxes.get(label.toolItemId).fits);
    const printable = labels.filter((label) => boxes.get(label.toolItemId).fits);
    const selected = printable.filter((label) => !excluded.has(label.toolItemId));

    const toggle = (toolItemId) =>
        setExcluded((was) => {
            const next = new Set(was);
            if (next.has(toolItemId)) next.delete(toolItemId);
            else next.add(toolItemId);
            return next;
        });

    // The page is the label: the cut's length wide and the tape's width tall.
    const pageStyle = {
        width: `${LABEL_STOCK.labelWidthMm}mm`,
        height: `${LABEL_STOCK.tapeWidthMm}mm`,
    };

    return (
        <>
            <div className="label-screen-only label-controls">
                <p>{COPY.stock({ name: LABEL_STOCK_NAME })}</p>

                {oversized.length > 0 && (
                    <p>
                        {COPY.symbolTooLarge({
                            toolItemIds: oversized.map((label) => label.toolItemId),
                        })}
                    </p>
                )}

                {/* NO SELECT-ALL AND NO SELECT-NONE. Everything the address named
                    starts included, so select-all was a control for the state the
                    screen already opens in, and select-none put the run into the
                    one state it refuses to print from. What is left is the per-label
                    include, which is the only one of the three that reaches a state
                    a reader wants: this run less a label or two. A run is a handful,
                    so unchecking them one at a time is the whole interaction. */}
                <h2>{COPY.selectionHeading}</h2>
                <ul>
                    {printable.map((label) => (
                        <li key={label.toolItemId}>
                            <label>
                                <input
                                    type="checkbox"
                                    checked={!excluded.has(label.toolItemId)}
                                    onChange={() => toggle(label.toolItemId)}
                                />
                                <span className="label-include">{COPY.include}</span>{" "}
                                {label.toolItemId} {label.toolName}
                            </label>
                        </li>
                    ))}
                </ul>

                {selected.length === 0 ? (
                    <p>{COPY.nothingSelected}</p>
                ) : (
                    <p>{COPY.labelCount({ labels: selected.length })}</p>
                )}

                <button type="button" onClick={() => window.print()} disabled={selected.length === 0}>
                    {COPY.print}
                </button>
            </div>

            {selected.map((label) => {
                // The box is that label's own side count INCLUDING its quiet zone,
                // times the label's module. Sizing by the symbol proper would crop the
                // four modules of margin; sizing every box alike would thin the modules
                // of a larger version.
                const { boxMm } = boxes.get(label.toolItemId);
                return (
                    <div key={label.toolItemId} className="label-page" style={pageStyle}>
                        <svg className="label-face" width="100%" height="100%">
                            <svg
                                className="label-symbol"
                                x={`${budget.marginXMm}mm`}
                                y={`${budget.marginYMm}mm`}
                                width={`${boxMm}mm`}
                                height={`${boxMm}mm`}
                                dangerouslySetInnerHTML={{ __html: label.svg }}
                            />
                            {/* THE CODE IS SET BY ITS BASELINE, AND ITS HEIGHT IS ITS INK
                                (#467). SVG text's `y` IS the baseline, and `labelBudget`
                                puts it `ID_INK_ABOVE_EM` below the symbol's box, so the
                                digits' ink starts exactly where that box ends whatever
                                ascent and descent the platform takes the face to have. A
                                CSS line box puts the baseline where those metrics say
                                instead — measured at 0.600 em rather than 0.631, which
                                lifts the ink 0.055 mm into the symbol's box. It was a
                                line box one em tall from #431 until then. Centered on
                                the label, so a code longer than it is budgeted for
                                overhangs both side margins alike.

                                THE PRINTED CODE, NOT THE `Tool Item ID` (#411). It is the
                                same string the symbol's own path carries, because the
                                person reading it is reading it in order to type it. The
                                page computes it; nothing here spells the family token,
                                and `offline/tool-label-page.mjs` reads this expression
                                off the AST — a value check cannot tell the two fields
                                apart.

                                THE TOOL'S NAME IS NOT ON THE LABEL (#431). The design
                                dropped it, and the picker above is where a tool item is
                                still named by its tool. */}
                            <text
                                className="label-id"
                                x="50%"
                                y={`${budget.idBaselineMm}mm`}
                                fontSize={`${MIN_ID_FONT_PT}pt`}
                                textAnchor="middle"
                            >
                                {label.labelCode}
                            </text>
                        </svg>
                    </div>
                );
            })}
        </>
    );
}
