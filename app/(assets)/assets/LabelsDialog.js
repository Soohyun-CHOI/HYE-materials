"use client";

import { Inconsolata } from "next/font/google";
import { useId, useRef, useState, useTransition } from "react";
import { Button } from "@/app/components/Controls";
import { DialogActions, DialogBody, DialogFrame, DialogMessage } from "@/app/components/DialogFrame";
import Dot from "@/app/components/Dot";
import {
    LABEL_PREVIEW_SCALE,
    LABEL_STOCK,
    MIN_ID_FONT_PT,
    ASSET_LABEL_PAGE_COPY as COPY,
    describeLabelRun,
    symbolBox,
} from "@/lib/assetLabelPage";
import { readAssetLabelsAction } from "./actions";
import "./labels.css";

// The labels, as a dialog over the page that opens them (#457) — Claude Design's 1e —
// and the control that opens it. They were the screen `/tool-items/labels` from #353
// until then.
//
// TWO OPENERS, AND WHAT EACH HANDS OVER IS WHAT ITS PAGE HAS. A category's page opens it on
// what its list has selected, which that page holds only as printed ids off its own
// address, so the run is read on the server (`readAssetLabelsAction`) while the dialog
// stands (`useLabelRun`). An asset's page has read its record and built its symbol as it
// rendered, so it hands over that one label (`LabelsDialog`). Either press opens the dialog at
// once. The opener is a 0a button in both, and a category's page marks it unable to
// act — `aria-disabled`, still reached by the keyboard (#612) — where its list says why
// (`describeSelection`). **Both pages draw it for a site manager
// alone (#506)**, and the read behind the first refuses anybody else.
//
// THE WAIT IS THE DIALOG'S `Print`, AS 1e AND 1f DRAW IT SINCE THE FILES OF 2026-11-06 (#616):
// 0f's Working, busy and not disabled — after 300ms its spinner stands in its label's place at
// its resting width, `Loading…` for assistive tech (`ASSET_LABEL_PAGE_COPY.working`) — while a
// category's page reads its run, and in either dialog while the code's face is awaited before the
// browser's print dialog. While the run reads, the pane is empty and the column holds nothing but
// its actions, `Print` with the dialog's title. **A read that fails is said over the actions,
// `Couldn't load the labels. Try again.`, and `Print` reads again; one refused to a reader no
// longer a site manager says so, `Print` turned away (#612) and described by it**, the page drawn
// again behind without its boxes and bar — which is why a category's page holds the dialog
// outside its selection bar, where it stands across that page. From #495 until #616 the opener
// was busy while it read, the dialog opened on what came back and a refused read opened nothing.
// A press while the read is in flight is turned away rather than the button disabled, as the
// opener's was: a button disabled under the pointer drops focus to the page.
//
// NOTHING IS WRITTEN TO THE ADDRESS TO OPEN IT, which is #456's shape rather than #459's.
// A category's page already carries the selection on its address, so a copied link is a
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
// `LABEL_PREVIEW_SCALE` times its size**, 1e's 22 × 24 mm, by a zoom the stylesheet
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
// AND THE PRINT TURNS IT A QUARTER TURN CLOCKWISE INSIDE THAT SVG (#526). The pane draws
// a label the right way up, as it reads stuck on the asset; the tape takes it turned,
// its height along the tape and its width across, so it reads the right way up with the
// tape held crosswise. `labels.css` makes the turn at print alone: the page's box takes
// the label's height across and its width down — the two custom properties the page is
// sized by, swapped — and the group holding the symbol and the code turns about the
// face's corner and moves along by the label's height, which lands it back on the page.
// Turning the label's box instead was measured against: a transform moves no layout
// box, so the box would stay 12 mm tall on a page whose breaks fall at 42 px, 11.11 mm —
// a box 11.12 mm tall spilled onto a second page in the PDF Chrome and Edge save. Inside
// the SVG nothing is a box but the face, still the page's own size from its corner.
//
// **IT MUST NEVER IMPORT `lib/assetLabelQR.js`** — that module imports `qrcode`, which
// would put the whole encoder in the browser bundle, and `offline/client-import-safety.mjs`
// cannot see it because the rule that check enforces is about `lib/airtable/`.
// `offline/asset-label-page.mjs` carries the assertion. The symbols arrive as strings,
// built where the run was read.
//
// EVERY DIMENSION COMES FROM `lib/assetLabelPage.js` AND NONE FROM THIS FILE. The stock's
// figures and what they derive move together there; a millimeter or a point written
// here would be the one that did not move.
//
// THE CODE GOES UNDER THE SYMBOL (#431), and a label carries those two and nothing
// else. The order below is the order they print in, which is the order the label's
// dimensions were derived for.
//
// `dangerouslySetInnerHTML` IS THE ONLY WAY TO INLINE AN SVG STRING, and it is safe
// here for a reason rather than by inspection: the symbol is drawn by
// `lib/assetLabelQR.js` out of `qrcode`'s module matrix — numbers and nothing else
// since #467, where it was the library's own renderer — for a payload that is the
// RECORD's `Asset ID`, so nothing a requester typed reaches these bytes — #351
// established that when it made the endpoint read the record, and the dialog's read
// builds a symbol only for an id it found. The alternative, a base64 data URI per
// label, prints the same and costs a third more bytes at a hundred labels. Its own
// `<svg>` fills the box it is set into, which is what sizes it.
//
// EVERY WORD IS IN `ASSET_LABEL_PAGE_COPY` AND NONE IS IN JSX, this axis's rule since
// #338, held by `offline/asset-list-view.mjs`.
//
// A RUN NAMING ANOTHER CATEGORY'S ASSETS PRINTS THEIR LABELS UNDER THIS CATEGORY'S NAME.
// The line under the title is the opening page's category, and only an address somebody
// typed can put another category's asset in a category's selection — the boxes select
// this category's, and its page steps carry them. Seen with one: a hundred typed ids on a
// category of four opened `18 of 100 labels` under its name, fourteen of them another
// category's. The
// labels are right — each carries its own code — and only the line is wrong for them.
// The labels' screen named each asset by its tool until #457.

// THE FACE THE PRINTED CODE IS SET IN, LOADED HERE AND NOWHERE ELSE (#431). The
// label's width budget is this face's measured advance and its height is this face's
// ink — `lib/assetLabelPage.js:CHARACTER_WIDTH_RATIO` and `ID_INK_ABOVE_EM` — so the
// code has to print in it, or the arithmetic describes letters that are not on the
// tape. The face is the design's choice and `LABEL_CODE_TYPEFACE` names it;
// `next/font` takes it as a static import, so the name is spelled here as well and
// `offline/asset-label-page.mjs` compares the two. It reaches the pages and the code
// alone: the root layout and the assets layout are where a design is applied to
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
 * An asset's page's control that opens the labels' dialog on the one label it hands over, and the
 * dialog, which opens at once.
 *
 * `title` is the opener's word and the dialog's title, one string for both — the
 * arrangement the registration dialog has with its openers. `run` is the run the page
 * hands over. `itemName` is the line under the title.
 */
export default function LabelsDialog({ title, itemName, run, variant = "filled" }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <Button variant={variant} onClick={() => setOpen(true)}>
                {title}
            </Button>
            <LabelsFrame open={open} onClose={() => setOpen(false)} title={title} itemName={itemName} answer={{ run }} />
        </>
    );
}

/**
 * A category's page's labels (#457, #616): what its opener's press does — open the dialog and
 * read the run of what the list selected, `assetIds`, while it stands — and what the dialog shows.
 * The page draws the opener in its selection bar and `LabelRunFrame` outside it, so a refusal that
 * draws the page again without the bar leaves the dialog standing.
 *
 * `answer` is null until a press's first read answers, then `{ run }`, `{ refusal }` — the
 * action's sentence for a reader no longer a site manager — or `{ failed: true }` for a read that
 * threw; `reading` is whether a read is on its way, a failure's answer standing over a read again
 * until the next takes its place (Tools 56's 1e); `opening` counts the presses, so each mounts the
 * dialog anew. A read an earlier press
 * sent is not answered over a later one's. ONE READ A PRESS, the run's operations and no more: the
 * dialog opening asks the server nothing.
 */
export function useLabelRun() {
    const [open, setOpen] = useState(false);
    const [opening, setOpening] = useState(0);
    const [asked, setAsked] = useState([]);
    const [answer, setAnswer] = useState(null);
    const [reading, setReading] = useState(false);
    const [, startTransition] = useTransition();
    const latest = useRef(0);

    const read = (assetIds) => {
        latest.current += 1;
        const sent = latest.current;
        setReading(true);
        startTransition(async () => {
            let answered;
            try {
                const run = await readAssetLabelsAction(assetIds);
                answered = run?.error ? { refusal: run.error } : { run };
            } catch {
                answered = { failed: true };
            }
            if (sent !== latest.current) return;
            setAnswer(answered);
            setReading(false);
        });
    };

    return {
        open,
        opening,
        answer,
        reading,
        press: (assetIds) => {
            setOpening((count) => count + 1);
            setAsked(assetIds);
            setOpen(true);
            setAnswer(null);
            read(assetIds);
        },
        // A read again after a failure keeps the failure's sentence over the actions while `Print`
        // waits, as 1e draws it (Tools 56), and the run's answer takes its place.
        retry: () => read(asked),
        close: () => setOpen(false),
    };
}

/** The dialog a category's page's press opens (`useLabelRun`), mounted anew for each press. */
export function LabelRunFrame({ labels, title, itemName }) {
    if (labels.opening === 0) return null;
    return (
        <LabelsFrame
            key={labels.opening}
            open={labels.open}
            onClose={labels.close}
            title={title}
            itemName={itemName}
            answer={labels.answer}
            reading={labels.reading}
            onRetry={labels.retry}
        />
    );
}

/**
 * Codes the run named and draws no label for, under how many and why (1e): the codes no asset
 * carries, and since #597 those on items off the reader's jobs — one shape for both, so the two
 * reasons read alike. The frame draws it only where there are some.
 */
function NamedCodes({ heading, codes }) {
    return (
        <div className="flex flex-col gap-gap">
            <p className="text-body-sm font-medium">{heading}</p>
            <ul className="flex flex-col gap-dialog-column-list-stack">
                {codes.map((code) => (
                    <li key={code} className="whitespace-nowrap font-id text-body-sm tracking-id text-foreground-muted">
                        {code}
                    </li>
                ))}
            </ul>
        </div>
    );
}

/**
 * 1e: the pages in the pane, and beside them how many print, what did not, what to do in
 * the browser's print dialog, and the commitment.
 *
 * THREE STATES, AND THEY ARE ONE ARRANGEMENT. Every code named on an asset and its
 * symbol fitting: the pages, `5 labels`, the steps, `Print 5 labels`. Some named on none:
 * the ones that are, `3 of 5 labels`, the codes not found under how many, the steps and
 * `Print 3 labels`. None that prints: `No labels to print.` in the pane, `0 of 3 labels`,
 * the codes, no steps and the title's words on a commitment drawn disabled, with no
 * reason before it since the pane and the codes are the reason (0f). A host long enough
 * that the symbols do not fit the label is 1e's third state too, with one sentence about
 * the host where the codes stand — the design draws nothing for it, and nothing the app
 * draws can be printed from such a host. **Codes on items off the reader's jobs (#597)** are
 * the second state's again, under their own count beside the codes not found, as the read
 * refuses their labels: the design draws nothing for them either.
 *
 * AND THREE BEFORE A RUN (#616), a category's page's read, each 0l's dialog whose content could
 * not be prepared or may no longer be shown (Invoices 53, Tools 56's 1e `Labels failed` and `No
 * permission`): its head, the message line and its actions alone, the pane kept empty so the
 * dialog keeps its size, and `Print` with the title's words, no count. On its way, no line and
 * `Print` waiting; failed, `Couldn't load the labels. Try again.` and `Print` reading again,
 * waiting with the sentence kept until the run comes; refused, the action's sentence and `Print`
 * turned away, described by it. `answer` is `{ run }` once there is one, `reading` whether a read
 * is on its way (`useLabelRun`).
 */
function LabelsFrame({ open, onClose, title, itemName, answer, reading = false, onRetry }) {
    const refusalId = useId();
    // Whether the press is waiting for the code's face before the browser's print dialog.
    const [preparing, setPreparing] = useState(false);
    const run = answer?.run ?? null;
    const refusal = answer?.refusal ?? null;
    const said = refusal ?? (answer?.failed ? COPY.readFailed : null);
    const { budget, pages, printing, named, missing, elsewhere, tooLarge } = run ? describeLabelRun(run) : {};

    // The page is the label as it reads, sized through two custom properties so the
    // stylesheet can turn it at print (#526). The pane's columns are the page as the
    // pane draws it.
    const pageStyle = {
        "--label-width": `${LABEL_STOCK.labelWidthMm}mm`,
        "--label-height": `${LABEL_STOCK.labelHeightMm}mm`,
    };
    const listStyle = {
        "--label-preview-scale": LABEL_PREVIEW_SCALE,
        gridTemplateColumns: `repeat(auto-fit, ${LABEL_STOCK.labelWidthMm * LABEL_PREVIEW_SCALE}mm)`,
    };

    // AFTER THE FACE, AND SHUT WHEN THE PRINT DIALOG IS. The browser's print dialog
    // closes with the label printed or not, and either way the dialog has done its
    // part — 1e's asset page draws its commitment closing it. A print that did not
    // go is one press of the opener away. `Print` waits while the face is awaited (#616).
    const print = async () => {
        setPreparing(true);
        await document.fonts.ready;
        window.addEventListener(
            "afterprint",
            () => {
                setPreparing(false);
                onClose();
            },
            { once: true }
        );
        window.print();
    };

    const preview = !run ? null : printing > 0 ? (
        <ul
            role="list"
            aria-label={COPY.pages}
            className={`label-list grid min-h-full content-center justify-center gap-x-dialog-preview-inline gap-y-dialog-preview-stack ${labelCodeFont.variable}`}
            style={listStyle}
        >
            {pages.map((label, index) => (
                <li key={label.assetId} className="label-item" aria-label={COPY.page({ page: index + 1, code: label.labelCode })}>
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
        <DialogFrame open={open} onClose={onClose} title={title} subtitle={itemName} preview={preview}>
            <DialogBody>
                {run && (
                    <div className="flex flex-col gap-dialog-column-stack">
                        <DialogMessage>
                            {COPY.count({ printing, named })}
                            <Dot />
                            <span className="text-foreground-muted">{COPY.size}</span>
                        </DialogMessage>
                        {missing.length > 0 && <NamedCodes heading={COPY.notFound(missing.length)} codes={missing} />}
                        {elsewhere.length > 0 && <NamedCodes heading={COPY.notYours(elsewhere.length)} codes={elsewhere} />}
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
                )}
            </DialogBody>
            <DialogActions refusal={said} refusalId={refusalId}>
                <Button variant="bordered" onClick={onClose}>
                    {COPY.cancel}
                </Button>
                {/* Waiting while the run is read or the face awaited, reading again after a read
                    that failed, and turned away after a refusal (#616). */}
                <Button
                    disabled={run !== null && printing === 0}
                    unavailable={refusal !== null}
                    describedBy={refusal !== null ? refusalId : undefined}
                    busy={reading || preparing}
                    busyLabel={COPY.working}
                    onClick={run ? print : onRetry}
                >
                    {run && printing > 0 ? COPY.print({ labels: printing }) : title}
                </Button>
            </DialogActions>
        </DialogFrame>
    );
}

/**
 * One label as the asset page's record rail draws it (#463): the label's own page, the
 * one the dialog draws and prints, at the dialog's preview scale on the Preview's face —
 * so the page and the dialog show the same drawing, as 1f and 1e do. `name` is what an
 * image takes for assistive tech; the code under the symbol is nothing a heading says.
 *
 * THE PREVIEW'S FACE AND NOT 1f's. The design draws this one on a 1 corner with an 8% ring
 * over a 1 2 shadow, and the dialog's on 0k's Preview — the Mark corner, a 6% ring over 2 8
 * at 8% — which the spec gives a print shown on the page; the frame takes the spec's, the
 * one the dialog has worn since #457, so the two drawings stay one.
 *
 * IT IS NEVER TURNED. The stylesheet turns a label page inside an open dialog at print
 * (#526), and this one is on the page behind it — off the paper while the dialog prints,
 * and the right way up in a print of the asset's page.
 */
export function LabelPreview({ label, budget, name }) {
    const pageStyle = {
        "--label-width": `${LABEL_STOCK.labelWidthMm}mm`,
        "--label-height": `${LABEL_STOCK.labelHeightMm}mm`,
    };
    return (
        <div
            role="img"
            aria-label={name}
            className={`label-frame overflow-hidden rounded-preview bg-white shadow-preview ${labelCodeFont.variable}`}
            style={{ "--label-preview-scale": LABEL_PREVIEW_SCALE }}
        >
            <LabelPage label={label} budget={budget} pageStyle={pageStyle} />
        </div>
    );
}

/**
 * One label's page — the one drawing of a label, which is what prints (#467).
 *
 * The box is that label's own side count INCLUDING its quiet zone, times the label's
 * module. Sizing by the symbol proper would crop the four modules of margin; sizing every
 * box alike would thin the modules of a larger version.
 *
 * The symbol and the code are one group, `label-turn`, which the stylesheet turns a
 * quarter turn at print and nowhere else (#526); everything inside it is placed as the
 * label reads.
 */
function LabelPage({ label, budget, pageStyle }) {
    const { boxMm } = symbolBox({ sideModules: label.sideModules, budget });
    return (
        <div className="label-page" style={pageStyle}>
            <svg className="label-face" width="100%" height="100%" aria-hidden="true">
                <g className="label-turn">
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
                        overhangs both side margins alike — at the label's
                        middle in millimeters since #526, where it was `50%`:
                        a percentage is the face's, and at print the face is the
                        turned page, 12 mm across, which would have put the code
                        0.5 mm off the middle of a label 11 mm wide.

                        THE PRINTED CODE, NOT THE `Asset ID` (#411). It is the
                        same string the symbol's own path carries, because the
                        person reading it is reading it in order to type it. The
                        run computes it (`buildAssetLabel`); nothing here spells
                        the family token, and `offline/asset-label-page.mjs` reads
                        this expression off the AST — a value check cannot tell
                        the two fields apart.

                        THE CATEGORY'S NAME IS NOT ON THE LABEL (#431). The design
                        dropped it, and the line under the dialog's title is where
                        the run's category is named. */}
                    <text
                        className="label-id"
                        x={`${budget.idCenterMm}mm`}
                        y={`${budget.idBaselineMm}mm`}
                        fontSize={`${MIN_ID_FONT_PT}pt`}
                        textAnchor="middle"
                    >
                        {label.labelCode}
                    </text>
                </g>
            </svg>
        </div>
    );
}
