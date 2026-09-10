"use client";

import { useState } from "react";
import {
    CELLS_PER_SHEET,
    LABEL_GAP_MM,
    LABEL_SAFE_INSET_MM,
    LABEL_STOCK,
    MIN_ID_FONT_MM,
    TOOL_LABEL_SHEET_COPY as COPY,
    cellPosition,
    labelBudget,
    paginateLabels,
    readStartPosition,
    symbolBox,
} from "@/lib/toolLabelSheet";

// The sheet, the picker above it, and the start position (#353).
//
// A CLIENT COMPONENT BECAUSE THE SELECTION IS STATE, and that is the only reason.
// Nothing here reads the base or builds a symbol: the page has already done both
// and hands over one `svg` string per label. **It must never import
// `lib/toolLabelQR.js`** — that module imports `qrcode`, which would put the whole
// encoder in the browser bundle, and `offline/client-import-safety.mjs` cannot see
// it because the rule that check enforces is about `lib/airtable/`. #353 added an
// assertion for this one in `offline/tool-label-sheet.mjs`.
//
// EVERY DIMENSION COMES FROM `lib/toolLabelSheet.js` AND NONE FROM THIS FILE. The
// stock is not chosen yet, so the figures move together when it is; a millimeter
// written here would be the one that did not move.
//
// `dangerouslySetInnerHTML` IS THE ONLY WAY TO INLINE AN SVG STRING, and it is safe
// here for a reason rather than by inspection: the symbol is produced by `qrcode`'s
// own renderer from a payload that is the RECORD's `Tool Item ID`, so nothing a
// requester typed reaches these bytes — #351 established that when it made the
// endpoint read the record. The alternative, a base64 data URI per label, prints
// the same and costs a third more bytes at a hundred labels.
//
// THE PICKER AND THE CONTROLS ARE SCREEN-ONLY. `labels.css` hides them at print, so
// the paper carries labels and nothing else. Unchecked labels leave the grid rather
// than printing blank, which is what keeps a run contiguous from the start
// position.

/** What one label's box measures, and where the symbol's own box sits in it. */
function labelStyle({ leftMm, topMm }) {
    return {
        left: `${leftMm}mm`,
        top: `${topMm}mm`,
        width: `${LABEL_STOCK.labelWidthMm}mm`,
        height: `${LABEL_STOCK.labelHeightMm}mm`,
        padding: `${LABEL_SAFE_INSET_MM}mm`,
        gap: `${LABEL_GAP_MM}mm`,
    };
}

export default function LabelSheet({ labels, origin, sideModules }) {
    const [excluded, setExcluded] = useState(() => new Set());
    const [startPosition, setStartPosition] = useState(1);

    // One module size for the stock, derived against today's version plus the
    // headroom — it does not move per label. What moves per label is the BOX, from
    // that label's own side count.
    const budget = labelBudget({ sideModules });
    const boxes = new Map(
        labels.map((label) => [label.toolItemId, symbolBox({ sideModules: label.sideModules, moduleMm: budget.moduleMm })])
    );
    const oversized = labels.filter((label) => !boxes.get(label.toolItemId).fits);
    const printable = labels.filter((label) => boxes.get(label.toolItemId).fits);
    const selected = printable.filter((label) => !excluded.has(label.toolItemId));
    const sheets = paginateLabels(selected, startPosition);

    const toggle = (toolItemId) =>
        setExcluded((was) => {
            const next = new Set(was);
            if (next.has(toolItemId)) next.delete(toolItemId);
            else next.add(toolItemId);
            return next;
        });

    // The box is that label's own side count INCLUDING its quiet zone, times the
    // stock's module size. Sizing by the symbol proper would crop the four modules
    // of margin; sizing every box alike would thin the modules of a larger version.
    const symbolStyle = (toolItemId) => {
        const { boxMm } = boxes.get(toolItemId);
        return { width: `${boxMm}mm`, height: `${boxMm}mm`, flex: `0 0 ${boxMm}mm` };
    };

    return (
        <>
            <div className="label-screen-only label-controls">
                <p>
                    {COPY.hostLabel} <span className="label-host">{origin}</span>
                </p>
                <p>
                    <strong>{COPY.hostWarningTitle}</strong> {COPY.hostWarning}
                </p>
                <p>{COPY.stock({ name: LABEL_STOCK.name })}</p>

                {oversized.length > 0 && (
                    <p>
                        {COPY.symbolTooLarge({
                            toolItemIds: oversized.map((label) => label.toolItemId),
                        })}
                    </p>
                )}

                {/* NO SELECT-ALL AND NO SELECT-NONE. Everything the address named
                    starts included, so select-all was a control for the state the
                    screen already opens in, and select-none put the sheet into the
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

                <p>
                    <label htmlFor="startPosition">{COPY.startLabel}</label>
                    <input
                        id="startPosition"
                        name="startPosition"
                        type="number"
                        min={1}
                        max={CELLS_PER_SHEET}
                        value={startPosition}
                        onChange={(event) => setStartPosition(readStartPosition(event.target.value))}
                    />
                </p>
                <p>{COPY.startHint}</p>

                {selected.length === 0 ? (
                    <p>{COPY.nothingSelected}</p>
                ) : (
                    <p>{COPY.sheetCount({ sheets: sheets.length, labels: selected.length })}</p>
                )}

                <button type="button" onClick={() => window.print()} disabled={selected.length === 0}>
                    {COPY.print}
                </button>
            </div>

            {sheets.map((cells, sheetIndex) => (
                <div
                    key={sheetIndex}
                    className="label-sheet"
                    style={{
                        width: `${LABEL_STOCK.pageWidthMm}mm`,
                        height: `${LABEL_STOCK.pageHeightMm}mm`,
                    }}
                >
                    {cells.map((label, indexOnSheet) =>
                        label === null ? null : (
                            <div
                                key={label.toolItemId}
                                className="label-cell"
                                style={labelStyle(cellPosition(indexOnSheet))}
                            >
                                <div
                                    className="label-symbol"
                                    style={symbolStyle(label.toolItemId)}
                                    dangerouslySetInnerHTML={{ __html: label.svg }}
                                />
                                {/* ONE SIZE FOR BOTH, AND IT IS THE ID'S FLOOR
                                    BECAUSE THE ID IS THE ONLY THING ON THE LABEL
                                    THAT CONSTRAINS ONE. Setting it on the id alone
                                    and letting the tool's name inherit the body's
                                    size made the name larger than the id —
                                    measured in a browser — which is a hierarchy
                                    nothing here decided, on the one element that
                                    has to stay legible. Both at the floor is the
                                    absence of a choice, which is what
                                    `_shared.md` asks an undesigned screen for. */}
                                <div
                                    className="label-text"
                                    style={{ fontSize: `${MIN_ID_FONT_MM}mm` }}
                                >
                                    <div className="label-id">{label.toolItemId}</div>
                                    <div className="label-tool">{label.toolName}</div>
                                </div>
                            </div>
                        )
                    )}
                </div>
            ))}
        </>
    );
}
