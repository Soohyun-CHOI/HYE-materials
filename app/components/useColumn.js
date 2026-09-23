import { useCallback, useRef, useState } from "react";

/**
 * The column a file is drawn in, and the width inside it (#433).
 *
 * THE WIDTH INSIDE THE PADDING AND THE SCROLLBAR, which is what `ResizeObserver`
 * reports as `contentRect.width` — read at once when the column appears, and then
 * observed. An observer delivers its first entry at the next rendering step, and a
 * tab the browser is not painting has none: measured, a viewer opened in a tab behind
 * another window had its document open and its page count read and drew no page,
 * because the width it was waiting for never came.
 *
 * A CALLBACK REF RATHER THAN AN EFFECT, so the first measurement is taken as the
 * element arrives rather than set from an effect body, and the observer is torn down
 * by the cleanup React 19 lets a ref return.
 *
 * Its own module because both `FileFrame.js` and `PdfPages.js` use it, and the second
 * is loaded only where a PDF is drawn: a helper living there could not be imported by
 * the first without loading it everywhere.
 *
 * `element` is the column as state, for a child that needs it during render — the
 * pane's pages hand it to an `IntersectionObserver` as the root; `nodeRef` is the
 * same element as a ref, for effects and handlers that scroll it or read its offsets.
 * The callers destructure what they use rather than holding the object, so the lint
 * sees a ref as a ref and a width as a width.
 */
export default function useColumn() {
    const [element, setElement] = useState(null);
    const [width, setWidth] = useState(0);
    const nodeRef = useRef(null);

    const ref = useCallback((el) => {
        nodeRef.current = el;
        setElement(el);
        if (!el) return undefined;
        const measure = () => {
            const style = getComputedStyle(el);
            setWidth(el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return { ref, nodeRef, element, width };
}
