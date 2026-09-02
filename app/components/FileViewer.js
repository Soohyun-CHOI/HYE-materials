"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MODAL_BACKDROP, MODAL_CARD } from "@/app/components/modalStyles";
import {
    FILE_RENDER,
    FILE_VIEWER_COPY,
    fileHref,
    fileRenderKind,
    fileViewerTitle,
} from "@/lib/fileLinks";

/**
 * An uploaded file, shown over the screen that named it (#331).
 *
 * ONE COMPONENT FOR ALL FIVE AXES, and the argument is one this repository already
 * made about the same five files: `lib/uploadLimit.js` holds a single ceiling because
 * quotation files, invoice files and packing list photos "accept the same three
 * content types and hold the same kind of artifact — a vendor-issued document
 * captured as PDF, JPEG or PNG — and no measurement separates them". Nothing
 * separates them here either, so the only per-axis thing is the title, and the
 * condition that would split this is the same one that would split the ceiling: a
 * path's accepted content types diverging.
 *
 * WHY IT IS NOT A NEW TAB. Following the old link left the app, and the tab it landed
 * in named neither the document the file belongs to nor a way back to it. Over the
 * page, the document is behind the overlay and closing is the way back — which is
 * also why the title needs the axis and the filename and nothing else.
 *
 * THE DOWNLOAD CONTROL IS ALWAYS RENDERED, AND THAT IS THE DESIGN RATHER THAN A
 * FALLBACK. There is no reliable way to learn that a document failed to render in
 * place, measured twice: `navigator.pdfViewerEnabled` returned `true` in a browser
 * that displayed nothing, and `<object type="application/pdf">`'s fallback children
 * stayed hidden while its box sat empty. So nothing here branches on detection; the
 * way out is beside the frame in every state, and an empty frame is never a dead end.
 * An image is the one kind that reports its own failure, so it is the one kind with a
 * state.
 *
 * THE FIRST OVERLAY IN THIS APP THAT HONORS CLAUDE.md's KEYBOARD RULE — closes on
 * `Escape` as well as by its opener, and hands focus back to that opener. The other
 * ten do not, which is a finding about them rather than work for this file.
 */
export default function FileViewer({ axis, documentId, filename, contentType, children }) {
    const [open, setOpen] = useState(false);
    const openerRef = useRef(null);
    const cardRef = useRef(null);

    // Focus goes back to the control that opened this, not to the top of the
    // document — the reader was in the middle of a record and lands where they left.
    const close = useCallback(() => {
        setOpen(false);
        openerRef.current?.focus();
    }, []);

    useEffect(() => {
        if (!open) return;
        cardRef.current?.focus();
        const onKey = (e) => {
            if (e.key === "Escape") close();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, close]);

    const href = fileHref({ axis, documentId, filename });
    const kind = fileRenderKind(contentType);
    const title = fileViewerTitle({ axis, filename });

    return (
        <>
            <button
                type="button"
                ref={openerRef}
                onClick={() => setOpen(true)}
                className="underline"
            >
                {children || filename}
            </button>

            {open && (
                <div className={MODAL_BACKDROP} onClick={close}>
                    {/* The card stops the backdrop's close, so a click inside the
                        document does not dismiss it. The backdrop click is an
                        addition to the two the rule asks for, not a substitute. */}
                    <div
                        ref={cardRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label={title}
                        tabIndex={-1}
                        onClick={(e) => e.stopPropagation()}
                        className={`${MODAL_CARD} flex max-h-[90vh] w-full max-w-4xl flex-col`}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <h2 className="text-sm font-medium break-all">{title}</h2>
                            <div className="flex shrink-0 items-center gap-3">
                                {/* Same origin, so `download` binds and the saved name
                                    is the record's own — the attribute #331 records as
                                    ignored across origins. This is the only place in
                                    the app that carries it. */}
                                <a
                                    href={href}
                                    download={filename || undefined}
                                    className="rounded border border-zinc-300 px-3 py-1.5 text-sm"
                                >
                                    {FILE_VIEWER_COPY.download}
                                </a>
                                <button
                                    type="button"
                                    onClick={close}
                                    className="rounded border border-zinc-300 px-3 py-1.5 text-sm"
                                >
                                    {FILE_VIEWER_COPY.close}
                                </button>
                            </div>
                        </div>

                        <FileFrame href={href} kind={kind} title={title} />
                    </div>
                </div>
            )}
        </>
    );
}

/**
 * The file itself, or the sentence that stands in for it.
 *
 * An image element for a photo, a frame for a document, and neither for a type the
 * route will not serve as itself — that last one becomes `application/octet-stream`
 * upstream, so a frame would offer a download dialog inside an overlay that already
 * has the control.
 */
function FileFrame({ href, kind, title }) {
    const [failed, setFailed] = useState(false);

    if (kind === FILE_RENDER.unknown) {
        return <p className="mt-4 text-sm text-zinc-600">{FILE_VIEWER_COPY.notViewable}</p>;
    }

    if (kind === FILE_RENDER.image) {
        if (failed) {
            return <p className="mt-4 text-sm text-red-700">{FILE_VIEWER_COPY.imageFailed}</p>;
        }
        return (
            <div className="mt-4 min-h-0 flex-1 overflow-auto">
                {/* eslint-disable-next-line @next/next/no-img-element -- the route
                    streams a gated attachment and re-reads the record per request, so
                    there is nothing for the image optimizer to cache or resize. */}
                <img
                    src={href}
                    alt={title}
                    onError={() => setFailed(true)}
                    className="mx-auto max-w-full"
                />
            </div>
        );
    }

    return (
        <>
            <iframe src={href} title={title} className="mt-4 min-h-0 w-full flex-1 border-0" />
            <p className="mt-2 text-xs text-zinc-500">{FILE_VIEWER_COPY.documentHint}</p>
        </>
    );
}
