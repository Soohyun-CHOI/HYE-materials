"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import useColumn from "@/app/components/useColumn";
import { FILE_VIEWER_COPY } from "@/lib/fileLinks";
import { FILE_LAYOUT, canvasRatio, drawnWidth } from "@/lib/fileView";
import "./pdfTextLayer.css";

/**
 * A PDF's pages, drawn by this app rather than by the reader's browser (#433).
 *
 * PDF.JS'S RENDERING LAYER AND NOT ITS VIEWER. A frame handed the pages to whatever
 * the browser draws a PDF with, so paging, zoom and the chrome around a page were the
 * browser's and differed between browsers, and the app could neither tell how many
 * pages there were nor turn one. Here the page is a canvas this component paints, and
 * every control around it belongs to the surface that holds it. The bundled viewer
 * (`pdfjs-dist/web/`) is not imported at all, and neither is its stylesheet:
 * `pdfTextLayer.css` carries the handful of rules the text layer needs.
 *
 * `pdfjs-dist` DIRECTLY, NOT A REACT WRAPPER. `react-pdf` 11 pins `pdfjs-dist` at an
 * exact 6.x, and `pdf-parse` — the server's text extraction since #46 — pins it at
 * 5.4.296, so the wrapper would have put a second copy of the engine in the tree.
 * What a wrapper would have saved is the part that has to be ours anyway: the scale,
 * the device pixel ratio, the turn, the cancelation of a stale render and which pages
 * are drawn at all.
 *
 * THE ENGINE ARRIVES ONLY WHEN A PDF IS DRAWN, and so does this module. `FileFrame`
 * loads it through `next/dynamic` with `ssr: false`, and it loads PDF.js itself by a
 * dynamic import inside an effect, so no screen pays for either until a document is
 * actually on it — the eight surfaces that can draw one link a file far more often
 * than anybody opens it. `ssr: false` is also what keeps the server's build from
 * compiling this file at all, which it did: `pdfjs-dist` is on `next.config.mjs`'s
 * server externals for `pdf-parse`, and the worker URL below, compiled for the server
 * pass of a client component, drew a build warning that it could not be external.
 *
 * THE WORKER IS A URL THE BUNDLER RESOLVES. `new URL(..., import.meta.url)` is the
 * form both Turbopack and webpack emit as a static asset of its own, served from
 * `/_next/static/media/` beside the rest of the build — measured under `next dev` and
 * under `next build`. Copying the file into `public/` was the other way, and it is a
 * second copy of a dependency that goes stale on the next install without anything
 * noticing.
 *
 * AND NOTHING STANDS IN ITS WAY, measured rather than assumed: `proxy.js` sets no
 * response header, `next.config.mjs` declares no `headers()`, and the file route sets
 * `nosniff`, a disposition and `cache-control` and no content security policy. An
 * object URL — the pane's address for a file the reader has just picked — is read by
 * PDF.js on the page's own thread and handed to the worker as bytes, so the worker is
 * never asked to resolve one.
 */

let engine = null;

function loadEngine() {
    if (!engine) {
        engine = import("pdfjs-dist").then((pdfjs) => {
            pdfjs.GlobalWorkerOptions.workerSrc = new URL(
                "pdfjs-dist/build/pdf.worker.min.mjs",
                import.meta.url
            ).toString();
            return pdfjs;
        });
        // A chunk that failed to arrive is asked for again on the next document,
        // rather than remembered as a failure for the life of the tab.
        engine.catch(() => {
            engine = null;
        });
    }
    return engine;
}

/**
 * Every page of one document, or a sentence where they would be.
 *
 * `layout` is `FILE_LAYOUT.page` — the one page `page` names, which is the viewer —
 * or `FILE_LAYOUT.scroll`, every page one under the next, which is the pane. The two
 * differ in which pages are drawn and in nothing else: `PdfPage` below is the one
 * rule for drawing a page, and both hand it the same width and zoom to fit it by.
 *
 * `onReady` is called with the page count once the document has opened, and never for
 * one that did not — the viewer shows its paging and zoom from that call, so a broken
 * file never offers controls over nothing. The callers pass a state setter, which is
 * stable, so the effect below runs once per document.
 *
 * Keyed by its address at the call site, so a new file starts over from `loading`
 * rather than showing the last one's pages while the next opens.
 */
export default function PdfPages({ href, title, layout, zoom, rotation, page, onReady, onVisiblePage }) {
    const [doc, setDoc] = useState({ status: "loading" });
    // The column the pages are fitted to. It reserves its scrollbar's gutter whether
    // or not it scrolls, so the width does not change when a page grows past the
    // bottom — without that, the fitted width would shrink by a scrollbar, the page
    // would stop overflowing, the scrollbar would go, and the two would take turns.
    const { ref: columnRef, nodeRef: columnNodeRef, element: column, width: room } = useColumn();
    const pageBoxes = useRef([]);

    useEffect(() => {
        let canceled = false;
        let task = null;
        loadEngine()
            .then(async (pdfjs) => {
                if (canceled) return;
                // `isEvalSupported: false` keeps PDF.js from compiling a font's
                // drawing instructions with `new Function`, which is the path a
                // hostile file would aim at; it costs speed on fonts nobody here
                // will notice.
                task = pdfjs.getDocument({ url: href, isEvalSupported: false });
                const pdf = await task.promise;
                const pages = await Promise.all(
                    Array.from({ length: pdf.numPages }, (_, i) => pdf.getPage(i + 1))
                );
                if (canceled) return;
                setDoc({ status: "ready", pdfjs, pages });
            })
            .catch((error) => {
                if (canceled) return;
                // A password is the one failure a reader can do something about,
                // and it is the one PDF.js names; everything else — a truncated
                // file, a file that is not a PDF, a request that failed — is the
                // same sentence, because the answer to all of them is the same.
                setDoc({ status: error?.name === "PasswordException" ? "locked" : "failed" });
            });
        return () => {
            canceled = true;
            // Destroying the loading task also destroys the document and the worker
            // it started, so a closed viewer leaves nothing running.
            task?.destroy();
        };
    }, [href]);

    useEffect(() => {
        if (doc.status === "ready") onReady?.(doc.pages.length);
    }, [doc, onReady]);

    const pages = doc.status === "ready" ? doc.pages : [];

    const scroll = layout === FILE_LAYOUT.scroll;
    const shown = scroll ? pages : pages.slice(page - 1, page);

    // A page stepped to starts at its top, not wherever the last one was left.
    useEffect(() => {
        if (!scroll && columnNodeRef.current) columnNodeRef.current.scrollTop = 0;
    }, [scroll, columnNodeRef, page]);

    // A ZOOM OR A TURN KEEPS THE READER'S PLACE. The column's scroll offset is in
    // pixels and every page just changed size, so left alone the offset would land
    // somewhere else in the document — at 200% it is half as far down. The place is
    // kept as a fraction of the column's height and put back once the new sizes are
    // laid out, before the browser paints the wrong place.
    const place = useRef(0);
    useLayoutEffect(() => {
        const el = columnNodeRef.current;
        if (el) el.scrollTop = place.current * el.scrollHeight;
    }, [zoom, rotation, columnNodeRef]);

    function handleScroll() {
        const el = columnNodeRef.current;
        if (el && el.scrollHeight > 0) place.current = el.scrollTop / el.scrollHeight;
        reportVisiblePage();
    }

    // Which page the pane's indicator names: the last one whose top has passed a
    // third of the way down the column, which is where a reader's eye is rather than
    // the page that happens to own the top pixel.
    function reportVisiblePage() {
        const el = columnNodeRef.current;
        if (!scroll || !el || !onVisiblePage) return;
        const probe = el.scrollTop + el.clientHeight / 3;
        let current = 1;
        pageBoxes.current.forEach((box, i) => {
            if (box && box.offsetTop <= probe) current = i + 1;
        });
        onVisiblePage(current);
    }

    useEffect(reportVisiblePage);

    if (doc.status === "failed") {
        return <p className="mt-4 text-sm text-red-700">{FILE_VIEWER_COPY.loadFailed}</p>;
    }
    if (doc.status === "locked") {
        return <p className="mt-4 text-sm text-red-700">{FILE_VIEWER_COPY.passwordProtected}</p>;
    }
    if (doc.status === "loading") {
        return (
            <p className="mt-4 text-sm text-zinc-600" aria-live="polite">
                {FILE_VIEWER_COPY.loading}
            </p>
        );
    }

    return (
        <div
            ref={columnRef}
            onScroll={handleScroll}
            // A region that scrolls is reached by the keyboard, or its arrow keys
            // cannot move it.
            tabIndex={0}
            role="region"
            aria-label={title}
            className="relative mt-4 min-h-0 flex-1 space-y-2 overflow-auto bg-zinc-100 p-2 [scrollbar-gutter:stable]"
        >
            {room > 0 &&
                shown.map((pdfPage, i) => (
                    <PdfPage
                        key={pdfPage.pageNumber}
                        pdfjs={doc.pdfjs}
                        page={pdfPage}
                        room={room}
                        zoom={zoom}
                        rotation={rotation}
                        lazyIn={scroll ? column : null}
                        boxRef={(box) => {
                            pageBoxes.current[i] = box;
                        }}
                    />
                ))}
        </div>
    );
}

/**
 * The turn a page is drawn at: the reader's, on top of the one the file declares.
 *
 * `getViewport`'s `rotation` REPLACES the page's own `/Rotate` rather than adding to
 * it, so passing the reader's turn alone would draw a scan the file stores sideways
 * — and marks upright — sideways again.
 */
function turnOf(pdfPage, rotation) {
    return (pdfPage.rotate + rotation) % 360;
}

/**
 * One page: a canvas, and the page's text laid invisibly over it.
 *
 * THE ONE RULE FOR DRAWING A PAGE, which is what the issue asks to stay single while
 * the two surfaces around it differ. Both layers are made from ONE viewport, so the
 * text sits on the glyphs it came from at every scale and every turn — which is the
 * whole of what makes a figure copyable rather than merely present.
 *
 * REDRAWN AT EVERY ZOOM, NOT STRETCHED. Stretching a canvas is free and blurs every
 * figure by the zoom factor, which is exactly the reading the zoom is for. The steps
 * are discrete, so this is one render per click, and the page does not go blank
 * while it happens: the old canvas stays in the box, stretched to the new size, until
 * the new one has finished and replaces it.
 *
 * THE TEXT IS NOT RE-LAID ON A ZOOM, ONLY ON A TURN. PDF.js positions it in percent
 * of the page and sizes it from `--total-scale-factor`, so setting that on the box
 * moves every span with the canvas; a turn changes which way the layer runs, and is
 * the one change that rebuilds it.
 *
 * `lazyIn` is the pane's scroller: a page there is drawn once it comes within a
 * screen of view, so a long document does not paint every page before the first can
 * be read. The viewer draws its one page at once.
 */
function PdfPage({ pdfjs, page, room, zoom, rotation, lazyIn, boxRef }) {
    const turn = turnOf(page, rotation);
    // EACH PAGE FITS THE WIDTH ON ITS OWN. A document of mixed sizes is common — a
    // Letter invoice with an A4 statement behind it, a scan of a slip — and one scale
    // taken from the first page left a wider page scrolling sideways at the opening
    // zoom, measured on this base's own three-page order document, whose third page is
    // wider than the first two. So `Fit width` means every page, and a zoom step
    // multiplies each page's own fit.
    const natural = page.getViewport({ scale: 1, rotation: turn }).width;
    const scale = drawnWidth({ natural, room, zoom, grow: true }) / natural;
    const viewport = page.getViewport({ scale, rotation: turn });
    const [near, setNear] = useState(!lazyIn);
    const boxEl = useRef(null);
    const canvasHolder = useRef(null);
    const textHolder = useRef(null);

    useEffect(() => {
        if (!lazyIn || near) return undefined;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((e) => e.isIntersecting)) setNear(true);
            },
            { root: lazyIn, rootMargin: "100% 0px" }
        );
        observer.observe(boxEl.current);
        return () => observer.disconnect();
    }, [lazyIn, near]);

    useEffect(() => {
        if (!near) return undefined;
        const drawn = page.getViewport({ scale, rotation: turn });
        const ratio = canvasRatio({
            width: drawn.width,
            height: drawn.height,
            devicePixelRatio: window.devicePixelRatio || 1,
        });
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.floor(drawn.width * ratio));
        canvas.height = Math.max(1, Math.floor(drawn.height * ratio));
        canvas.className = "absolute inset-0 h-full w-full";
        const task = page.render({
            canvas,
            viewport: drawn,
            transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0],
        });
        task.promise.then(
            () => canvasHolder.current?.replaceChildren(canvas),
            // A render canceled by the next zoom or by closing is not a failure.
            () => {}
        );
        return () => task.cancel();
    }, [page, scale, turn, near]);

    // The text layer is rebuilt on a turn and not on a zoom, as the comment above
    // says, so `scale` is deliberately absent: the viewport handed over only fixes
    // the proportions PDF.js measures against, and the box's scale factor does the
    // rest.
    useEffect(() => {
        if (!near) return undefined;
        const container = textHolder.current;
        container.replaceChildren();
        const layer = new pdfjs.TextLayer({
            textContentSource: page.streamTextContent(),
            container,
            viewport: page.getViewport({ scale: 1, rotation: turn }),
        });
        let unbind = null;
        layer.render().then(
            () => {
                unbind = bindSelection(container);
            },
            () => {}
        );
        return () => {
            layer.cancel();
            unbind?.();
        };
    }, [pdfjs, page, turn, near]);

    return (
        <div
            ref={(el) => {
                boxEl.current = el;
                boxRef(el);
            }}
            className="relative mx-auto bg-white shadow-sm ring-1 ring-zinc-200"
            style={{
                width: viewport.width,
                height: viewport.height,
                "--total-scale-factor": viewport.scale * (viewport.userUnit || 1),
                "--scale-round-x": "1px",
                "--scale-round-y": "1px",
            }}
        >
            <div ref={canvasHolder} className="absolute inset-0" aria-hidden="true" />
            <div ref={textHolder} className="textLayer" />
        </div>
    );
}

/**
 * Selection over the text layers: the end marker each layer carries, and the one set
 * of document listeners that moves it (#433).
 *
 * TAKEN FROM PDF.JS'S `TextLayerBuilder`, the part of its viewer this app needs. The
 * layer is absolutely positioned spans over empty space, and a drag released in that
 * space — one pixel past the last digit of an invoice number — let the browser extend
 * the selection to whatever span came next in the markup, measured here: dragging
 * across an order number selected it and the two lines under it. The viewer answers
 * that with an element at the end of the layer that, while a selection is being made,
 * covers the layer beneath the text and sits right after the span the selection ends
 * in, so empty space resolves to where the reader stopped.
 *
 * FIREFOX IS LEFT TO ITSELF, as PDF.js leaves it: it resolves the empty space without
 * the marker being moved, and moving it there makes the selection jump.
 */
const selectionLayers = new Map();
let selectionListeners = null;

function bindSelection(layerDiv) {
    const end = document.createElement("div");
    end.className = "endOfContent";
    layerDiv.append(end);
    const onDown = () => layerDiv.classList.add("selecting");
    layerDiv.addEventListener("mousedown", onDown);
    selectionLayers.set(layerDiv, end);
    listenForSelection();
    return () => {
        layerDiv.removeEventListener("mousedown", onDown);
        selectionLayers.delete(layerDiv);
        if (selectionLayers.size === 0) {
            selectionListeners?.abort();
            selectionListeners = null;
        }
    };
}

function resetSelectionLayer(end, layerDiv) {
    layerDiv.append(end);
    end.style.width = "";
    end.style.height = "";
    layerDiv.classList.remove("selecting");
}

function listenForSelection() {
    if (selectionListeners) return;
    selectionListeners = new AbortController();
    const { signal } = selectionListeners;
    let pointerDown = false;
    let firefox = null;
    let previous = null;

    document.addEventListener("pointerdown", () => (pointerDown = true), { signal });
    const resetAll = () => {
        pointerDown = false;
        selectionLayers.forEach(resetSelectionLayer);
    };
    document.addEventListener("pointerup", resetAll, { signal });
    window.addEventListener("blur", resetAll, { signal });
    document.addEventListener(
        "keyup",
        () => {
            if (!pointerDown) selectionLayers.forEach(resetSelectionLayer);
        },
        { signal }
    );

    document.addEventListener(
        "selectionchange",
        () => {
            const selection = document.getSelection();
            if (selection.rangeCount === 0) {
                selectionLayers.forEach(resetSelectionLayer);
                return;
            }
            const range = selection.getRangeAt(0);
            for (const [layerDiv, end] of selectionLayers) {
                if (range.intersectsNode(layerDiv)) layerDiv.classList.add("selecting");
                else resetSelectionLayer(end, layerDiv);
            }

            // The marker is `user-select: none`, and only Gecko answers for the
            // prefixed name — which is how PDF.js tells Firefox apart, on the same
            // element.
            const marker = selectionLayers.values().next().value;
            firefox ??= marker ? getComputedStyle(marker).getPropertyValue("-moz-user-select") === "none" : false;
            if (firefox) return;

            const movingStart =
                previous &&
                (range.compareBoundaryPoints(Range.END_TO_END, previous) === 0 ||
                    range.compareBoundaryPoints(Range.START_TO_END, previous) === 0);
            let anchor = movingStart ? range.startContainer : range.endContainer;
            if (anchor.nodeType === Node.TEXT_NODE) anchor = anchor.parentNode;
            if (!movingStart && range.endOffset === 0) {
                do {
                    while (!anchor.previousSibling) anchor = anchor.parentNode;
                    anchor = anchor.previousSibling;
                } while (!anchor.childNodes.length);
            }
            const layerDiv = anchor.parentElement?.closest(".textLayer");
            const end = selectionLayers.get(layerDiv);
            if (end) {
                end.style.width = layerDiv.style.width;
                end.style.height = layerDiv.style.height;
                anchor.parentElement.insertBefore(end, movingStart ? anchor : anchor.nextSibling);
            }
            previous = range.cloneRange();
        },
        { signal }
    );
}
