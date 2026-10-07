/*
 * Every mark the design draws, and the one frame they are drawn in (#502). Claude Design draws
 * each from Lucide on its 24 grid, stroked at 1.25px whatever its size, with round caps and
 * joins (0a Icon box); a screen names the shape here and gives it a size, its ink coming from
 * the text around it. `docs/notes/design-system.md` has what was weighed and measured.
 *
 * LUCIDE 1.52.0'S SHAPES, COPIED RATHER THAN DEPENDED ON. That is the release the design draws
 * its marks from since Design moved them to it on 2026-10-07; that morning's files drew Lucide as
 * it stood from 0.416.0 to 0.532.0, whose `file-text`, `receipt` and `wrench` 1.52.0 redraws.
 * The release is Design's to choose and has moved once already, so each shape is copied out of
 * it and held to it by value in `offline/icons.mjs`, where a dependency would move with its own
 * upgrades — and could not carry the line either (below). A shape the design comes to draw is
 * copied out of Lucide at the design's release, its elements in Lucide's order.
 *
 * ONE LINE FOR EVERY MARK, AND IT DOES NOT SCALE. The stroke is `--stroke-width-icon` and
 * every shape is drawn `non-scaling-stroke`, so a 40 mark and an 11 chevron carry the one
 * 1.25px the design gives both — which its files write in each mark's own grid units, 1.88 at
 * 16 and 2.14 at 14. A size is rem and grows with the reader's text; the line stays the line,
 * as a border does.
 *
 * A MARK IS DECORATION. It is hidden from assistive tech and takes no name: the control it
 * stands in is named, and its tooltip says the same words. So the frame takes a shape, a crop
 * and classes, and nothing that could give it a name.
 *
 * A CROPPED MARK IS AS WIDE AS ITS INK. `crop` is the grid's columns the ink spans, `[from,
 * width]`, and the box holds those at the grid's full height and the caller's height, so its
 * stroke meets whatever its box meets and the room beside it is measured from ink — 1b's
 * chevron, the grid's 8 to 16. It draws past its box, so the round caps the crop runs through
 * are not cut.
 *
 * NOT EVERY DRAWING IS A MARK: a status dot is not one (0a), and `StatusMark.js` draws it; a
 * label's face and its symbol are the label's. `offline/icons.mjs` holds every other `<svg>`
 * in the tree to this module, and every shape here to the design's by value.
 *
 * The shapes are Lucide's and under its license, and those Lucide derived from Feather are
 * under Feather's too:
 *
 *   ISC License
 *
 *   Copyright (c) 2026 Lucide Icons and Contributors
 *
 *   Permission to use, copy, modify, and/or distribute this software for any purpose with or
 *   without fee is hereby granted, provided that the above copyright notice and this
 *   permission notice appear in all copies.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO
 *   THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT
 *   SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR
 *   ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION
 *   OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE
 *   USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 *   The MIT License (MIT), for the shapes derived from Feather
 *
 *   Copyright (c) 2013-present Cole Bemis
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy of this
 *   software and associated documentation files (the "Software"), to deal in the Software
 *   without restriction, including without limitation the rights to use, copy, modify, merge,
 *   publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons
 *   to whom the Software is furnished to do so, subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included in all copies or
 *   substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 *   INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
 *   PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
 *   FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 *   OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 *   DEALINGS IN THE SOFTWARE.
 */

// Each shape by its Lucide name, as lucide-react 1.52.0 holds it, its elements in Lucide's order.
const SHAPES = {
    check: [["path", { d: "M20 6 9 17l-5-5" }]],
    "chevron-down": [["path", { d: "m6 9 6 6 6-6" }]],
    "chevron-left": [["path", { d: "m15 18-6-6 6-6" }]],
    "chevron-right": [["path", { d: "m9 18 6-6-6-6" }]],
    "chevron-up": [["path", { d: "m18 15-6-6-6 6" }]],
    "circle-alert": [
        ["circle", { cx: "12", cy: "12", r: "10" }],
        ["line", { x1: "12", x2: "12", y1: "8", y2: "12" }],
        ["line", { x1: "12", x2: "12.01", y1: "16", y2: "16" }],
    ],
    "clipboard-list": [
        ["rect", { width: "8", height: "4", x: "8", y: "2", rx: "1", ry: "1" }],
        ["path", { d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" }],
        ["path", { d: "M12 11h4" }],
        ["path", { d: "M12 16h4" }],
        ["path", { d: "M8 11h.01" }],
        ["path", { d: "M8 16h.01" }],
    ],
    ellipsis: [
        ["circle", { cx: "12", cy: "12", r: "1" }],
        ["circle", { cx: "19", cy: "12", r: "1" }],
        ["circle", { cx: "5", cy: "12", r: "1" }],
    ],
    "file-text": [
        ["path", { d: "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" }],
        ["path", { d: "M14 2v5a1 1 0 0 0 1 1h5" }],
        ["path", { d: "M10 9H8" }],
        ["path", { d: "M16 13H8" }],
        ["path", { d: "M16 17H8" }],
    ],
    info: [
        ["circle", { cx: "12", cy: "12", r: "10" }],
        ["path", { d: "M12 16v-4" }],
        ["path", { d: "M12 8h.01" }],
    ],
    "map-pin": [
        ["path", { d: "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" }],
        ["circle", { cx: "12", cy: "10", r: "3" }],
    ],
    minus: [["path", { d: "M5 12h14" }]],
    "panel-left": [
        ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2" }],
        ["path", { d: "M9 3v18" }],
    ],
    plus: [
        ["path", { d: "M5 12h14" }],
        ["path", { d: "M12 5v14" }],
    ],
    receipt: [
        ["path", { d: "M12 17V7" }],
        ["path", { d: "M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8" }],
        ["path", { d: "M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z" }],
    ],
    // 1g-c's mark, which Design settled as this where the files of 2026-10-07 drew their own.
    "search-x": [
        ["path", { d: "m13.5 8.5-5 5" }],
        ["path", { d: "m8.5 8.5 5 5" }],
        ["circle", { cx: "11", cy: "11", r: "8" }],
        ["path", { d: "m21 21-4.3-4.3" }],
    ],
    tag: [
        ["path", { d: "M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" }],
        ["circle", { cx: "7.5", cy: "7.5", r: ".5", fill: "currentColor" }],
    ],
    truck: [
        ["path", { d: "M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" }],
        ["path", { d: "M15 18H9" }],
        ["path", { d: "M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" }],
        ["circle", { cx: "17", cy: "18", r: "2" }],
        ["circle", { cx: "7", cy: "18", r: "2" }],
    ],
    user: [
        ["path", { d: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" }],
        ["circle", { cx: "12", cy: "7", r: "4" }],
    ],
    wrench: [
        ["path", { d: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z" }],
    ],
    x: [
        ["path", { d: "M18 6 6 18" }],
        ["path", { d: "m6 6 12 12" }],
    ],
};

/**
 * One mark: `name` is its shape's Lucide name, `className` its size — a `size-*` name the
 * design gives it, or a height alone when it is cropped — and anything else it takes from where
 * it stands, its ink among them. `crop` is the grid's columns its ink spans, `[from, width]`.
 *
 * The shapes are drawn before the frame holds them, so `scripts/screen-strings.mjs` — which
 * takes a module's table read inside a JSX child as a screen's words — does not list their
 * path data as copy on every screen that draws a mark.
 */
export default function Icon({ name, crop, className }) {
    const shapes = SHAPES[name].map(([Shape, attributes], index) => <Shape key={index} vectorEffect="non-scaling-stroke" {...attributes} />);
    return (
        <svg
            viewBox={crop ? `${crop[0]} 0 ${crop[1]} 24` : "0 0 24 24"}
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={crop ? { aspectRatio: `${crop[1]} / 24` } : undefined}
            className={`stroke-icon ${crop ? "overflow-visible" : ""} ${className}`}
        >
            {shapes}
        </svg>
    );
}
