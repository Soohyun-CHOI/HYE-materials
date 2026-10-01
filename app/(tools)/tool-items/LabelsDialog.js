"use client";

import { Inconsolata } from "next/font/google";
import { useState, useTransition } from "react";
import { Button } from "@/app/components/Controls";
import { DialogActions, DialogBody, DialogFrame, DialogMessage } from "@/app/components/DialogFrame";
import {
    LABEL_PREVIEW_SCALE,
    LABEL_STOCK,
    MIN_ID_FONT_PT,
    TOOL_LABEL_PAGE_COPY as COPY,
    describeLabelRun,
    symbolBox,
} from "@/lib/toolLabelPage";
import { readToolItemLabelsAction } from "./actions";
import "./labels.css";

// The labels, as a dialog over the page that opens them (#457) — Claude Design's 1i —
// and the control that opens it. They were the screen `/tool-items/labels` from #353
// until then.
//
// TWO OPENERS, AND WHAT EACH HANDS OVER IS WHAT ITS PAGE HAS. A tool's page opens it on
// what its list has selected, which that page holds only as printed ids off its own
// address, so the press reads the run on the server first (`readToolItemLabelsAction`)
// and the dialog opens on what comes back. A tool item's page has read its record and
// built its symbol as it rendered, so it hands over that one label and the press opens
// the dialog at once. The opener is a 0a button in both, and a tool's page disables it
// where its list says why (`describeSelection`).
//
// A PRESS WHILE THE READ IS IN FLIGHT IS IGNORED RATHER THAN THE BUTTON DISABLED, which
// a browser showed: a button disabled under the pointer drops focus to the page, so the
// dialog opened with nothing to hand focus back to and its closing left the reader at the
// top of the document, where CLAUDE.md's overlay rule wants the opener. Nothing marks
// the wait, because 1i draws nothing between the press and the dialog; #469's
// submitting state is a dialog's action, which this read is not.
//
// NOTHING IS WRITTEN TO THE ADDRESS TO OPEN IT, which is #456's shape rather than #459's.
// A tool's page already carries the selection on its address, so a copied link is a
// request to print those labels again and its reader is one press away from them; an
// open dialog on the address would open a print dialog for whoever followed the link
// and read the run on every arrival. #459's dialogs ride on the address because they
// account for something that happened and must outlast a reload until answered; a
// print has not happened yet. A reload shows the page as it was, the dialog shut.
//
// ONE PAGE PER LABEL, AND THE PAGE ON SCREEN IS THE PAGE THAT PRINTS (#467). Each label
// is one box the size of the label, and `labels.css` gives each its own page at print,
// the page box being the label's size — so what a reader sees in the pane is what comes
// off the tape, drawn in one place. **On screen the pane draws each at
// `LABEL_PREVIEW_SCALE` times its size**, 1i's 22 × 24 mm, by a zoom the stylesheet
// takes back to 1 at print; no figure inside the page moves, so nothing here is a second
// drawing of it.
//
// AND EACH LABEL IS ONE SVG FROM THE PAGE'S CORNER, BECAUSE A PRINT SNAPS EVERY BOX TO
// A WHOLE PIXEL. Measured in the PDF Chrome and Edge save (#467): drawn as boxes of their
// own, the symbol landed 0.12 mm higher than its margin and the code 0.10 mm lower, each
// box's corner rounded to the nearest CSS pixel — so the margins the print proved came
// out 0.53 and 0.55 mm instead of 0.65. Inside an SVG nothing is snapped, and the one
// SVG starts at the page's own corner, which is a whole pixel on every page — in the
// dialog too, whose stylesheet sets every box around the pages to none at print. So the
// symbol and the code are placed in millimeters inside it, where `labelBudget` puts
// them, and only the label as a whole is a box.
//
// **IT MUST NEVER IMPORT `lib/toolLabelQR.js`** — that module imports `qrcode`, which
// would put the whole encoder in the browser bundle, and `offline/client-import-safety.mjs`
// cannot see it because the rule that check enforces is about `lib/airtable/`.
// `offline/tool-label-page.mjs` carries the assertion. The symbols arrive as strings,
// built where the run was read.
//
// EVERY DIMENSION COMES FROM `lib/toolLabelPage.js` AND NONE FROM THIS FILE. The stock's
// figures and what they derive move together there; a millimeter or a point written
// here would be the one that did not move.
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
// established that when it made the endpoint read the record, and the dialog's read
// builds a symbol only for an id it found. The alternative, a base64 data URI per
// label, prints the same and costs a third more bytes at a hundred labels. Its own
// `<svg>` fills the box it is set into, which is what sizes it.
//
// EVERY WORD IS IN `TOOL_LABEL_PAGE_COPY` AND NONE IS IN JSX, this axis's rule since
// #338, held by `offline/tool-list-view.mjs`.
//
// A RUN NAMING ANOTHER TOOL'S TOOL ITEMS PRINTS THEIR LABELS UNDER THIS TOOL'S NAME.
// The line under the title is the opening page's tool, and only an address somebody
// typed can put another tool's tool item in a tool's selection — the boxes select this
// tool's, and its page steps carry them. Seen with one: a hundred typed ids on a tool of
// four opened `18 of 100 labels` under its name, fourteen of them another tool's. The
// labels are right — each carries its own code — and only the line is wrong for them.
// The labels' screen named each tool item by its tool until #457.

// THE FACE THE PRINTED CODE IS SET IN, LOADED HERE AND NOWHERE ELSE (#431). The
// label's width budget is this face's measured advance and its height is this face's
// ink — `lib/toolLabelPage.js:CHARACTER_WIDTH_RATIO` and `ID_INK_ABOVE_EM` — so the
// code has to print in it, or the arithmetic describes letters that are not on the
// tape. The face is the design's choice and `LABEL_CODE_TYPEFACE` names it;
// `next/font` takes it as a static import, so the name is spelled here as well and
// `offline/tool-label-page.mjs` compares the two. It reaches the pages and the code
// alone: the root layout and the tools layout are where a design is applied to
// screens. The labels' page loaded it until #457.
//
// IF THE FACE HAS NOT ARRIVED WHEN PRINT IS PRESSED, THE FALLBACK WOULD PRINT, and the
// press waits for it (`document.fonts.ready`). The code is drawn only when the dialog
// opens, which is when the face is first asked for — later than on the labels' page,
// which drew it on arrival. The fallback `next/font` declares, Arial at a `size-adjust`
// of 112.16%, comes to 0.6 of its size per character, and ten characters of it would
// be 10.58 mm: 0.51 mm past the symbol on either side and 0.21 mm inside the label's
// edges.
const labelCodeFont = Inconsolata({ subsets: ["latin"], variable: "--font-label-code" });

/**
 * The control that opens the labels' dialog, and the dialog.
 *
 * `title` is the opener's word and the dialog's title, one string for both — the
 * arrangement the registration dialog has with its openers. `run` is the run a tool
 * item's page hands over; `toolItemIds` is what a tool's page has selected, read when
 * pressed. `toolName` is the line under the title.
 */
export default function LabelsDialog({ title, toolName, run: handed, toolItemIds, disabled = false, variant = "filled" }) {
    const [open, setOpen] = useState(false);
    const [run, setRun] = useState(handed ?? null);
    const [pending, startTransition] = useTransition();

    const press = () => {
        if (handed) {
            setRun(handed);
            setOpen(true);
            return;
        }
        if (pending) return;
        startTransition(async () => {
            const read = await readToolItemLabelsAction(toolItemIds);
            setRun(read);
            setOpen(true);
        });
    };

    return (
        <>
            <Button variant={variant} disabled={disabled} onClick={press}>
                {title}
            </Button>
            {run && <LabelsFrame open={open} onClose={() => setOpen(false)} title={title} toolName={toolName} run={run} />}
        </>
    );
}

/**
 * 1i: the pages in the pane, and beside them how many print, what did not, what to do in
 * the browser's print dialog, and the commitment.
 *
 * THREE STATES, AND THEY ARE ONE ARRANGEMENT. Every code named on a tool item and its
 * symbol fitting: the pages, `5 labels`, the steps, `Print 5 labels`. Some named on none:
 * the ones that are, `3 of 5 labels`, the codes not found under how many, the steps and
 * `Print 3 labels`. None that prints: `No labels to print.` in the pane, `0 of 3 labels`,
 * the codes, no steps and the title's words on a commitment drawn disabled, with no
 * reason before it since the pane and the codes are the reason (0f). A host long enough
 * that the symbols do not fit the label is 1i's third state too, with one sentence about
 * the host where the codes stand — the design draws nothing for it, and nothing the app
 * draws can be printed from such a host.
 */
function LabelsFrame({ open, onClose, title, toolName, run }) {
    const { budget, pages, printing, named, missing, tooLarge } = describeLabelRun(run);

    // The page is the label: the cut's length wide and the tape's width tall. The pane's
    // columns are the page as the pane draws it.
    const pageStyle = {
        width: `${LABEL_STOCK.labelWidthMm}mm`,
        height: `${LABEL_STOCK.tapeWidthMm}mm`,
    };
    const listStyle = {
        "--label-preview-scale": LABEL_PREVIEW_SCALE,
        gridTemplateColumns: `repeat(auto-fit, ${LABEL_STOCK.labelWidthMm * LABEL_PREVIEW_SCALE}mm)`,
    };

    // AFTER THE FACE, AND SHUT WHEN THE PRINT DIALOG IS. The browser's print dialog
    // closes with the label printed or not, and either way the dialog has done its
    // part — 1i's tool item page draws its commitment closing it. A print that did not
    // go is one press of the opener away.
    const print = async () => {
        await document.fonts.ready;
        window.addEventListener("afterprint", onClose, { once: true });
        window.print();
    };

    const preview =
        printing > 0 ? (
            <ul
                role="list"
                aria-label={COPY.pages}
                className={`label-list grid min-h-full content-center justify-center gap-x-dialog-preview-inline gap-y-dialog-preview-stack ${labelCodeFont.variable}`}
                style={listStyle}
            >
                {pages.map((label, index) => (
                    <li key={label.toolItemId} className="label-item" aria-label={COPY.page({ page: index + 1, code: label.labelCode })}>
                        <div className="label-frame overflow-hidden rounded-preview bg-white shadow-preview">
                            <LabelPage label={label} budget={budget} pageStyle={pageStyle} />
                        </div>
                    </li>
                ))}
            </ul>
        ) : (
            <p className="flex h-full items-center justify-center text-body text-foreground-subtle">{COPY.noLabels}</p>
        );

    return (
        <DialogFrame open={open} onClose={onClose} title={title} subtitle={toolName} preview={preview}>
            <DialogBody>
                <div className="flex flex-col gap-dialog-panel-stack">
                    <DialogMessage>
                        {COPY.count({ printing, named })}
                        <span aria-hidden="true" className="px-separator-inline text-foreground-faint">
                            {COPY.between}
                        </span>
                        <span className="text-foreground-muted">{COPY.size}</span>
                    </DialogMessage>
                    {missing.length > 0 && (
                        <div className="flex flex-col gap-gap">
                            <p className="text-body-sm font-medium">{COPY.notFound(missing.length)}</p>
                            <ul className="flex flex-col gap-dialog-panel-list-stack">
                                {missing.map((code) => (
                                    <li key={code} className="whitespace-nowrap font-id text-body-sm tracking-id text-foreground-muted">
                                        {code}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {tooLarge > 0 && <p className="text-body-sm text-pretty text-foreground-muted">{COPY.symbolTooLarge(tooLarge)}</p>}
                    {printing > 0 && (
                        <div className="flex flex-col gap-gap">
                            <p className="text-body-sm font-medium">{COPY.hintHeading}</p>
                            <ol className="flex flex-col gap-gap">
                                {COPY.hintSteps.map((step, index) => (
                                    <li key={step} className="flex items-center gap-gap text-body-sm">
                                        <span
                                            aria-hidden="true"
                                            className="flex size-dialog-step shrink-0 items-center justify-center rounded-full bg-background-muted text-heading-sm tabular-nums text-foreground-muted"
                                        >
                                            {index + 1}
                                        </span>
                                        {step}
                                    </li>
                                ))}
                            </ol>
                        </div>
                    )}
                </div>
            </DialogBody>
            <DialogActions>
                <Button variant="bordered" onClick={onClose}>
                    {COPY.cancel}
                </Button>
                <Button disabled={printing === 0} onClick={print}>
                    {printing > 0 ? COPY.print({ labels: printing }) : title}
                </Button>
            </DialogActions>
        </DialogFrame>
    );
}

/**
 * One label's page — the one drawing of a label, which is what prints (#467).
 *
 * The box is that label's own side count INCLUDING its quiet zone, times the label's
 * module. Sizing by the symbol proper would crop the four modules of margin; sizing every
 * box alike would thin the modules of a larger version.
 */
function LabelPage({ label, budget, pageStyle }) {
    const { boxMm } = symbolBox({ sideModules: label.sideModules, budget });
    return (
        <div className="label-page" style={pageStyle}>
            <svg className="label-face" width="100%" height="100%" aria-hidden="true">
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
                    run computes it (`buildToolItemLabel`); nothing here spells
                    the family token, and `offline/tool-label-page.mjs` reads
                    this expression off the AST — a value check cannot tell
                    the two fields apart.

                    THE TOOL'S NAME IS NOT ON THE LABEL (#431). The design
                    dropped it, and the line under the dialog's title is where
                    the run's tool is named. */}
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
}
