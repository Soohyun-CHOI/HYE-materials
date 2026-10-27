import { useEffect, useState } from "react";
import { isTyping, keyboardCover, keyboardPan } from "./keyboardViewport";

/**
 * How far a phone's keyboard covers the page, and whether one is up (Tools 0a Keyboard):
 * `cover` in px, which what stands at the foot of the screen is lifted by, and `keyboard`,
 * which is also true where the browser shrinks the page for its keyboard and reports no
 * cover. The judgments are `keyboardViewport.js`'s; this reads the browser into them.
 *
 * ITS OWN MODULE BECAUSE TWO THINGS STAND AT THE FOOT (#568): the foot bar (`BottomBar.js`)
 * and a sheet (`DialogFrame.js`). The bar measured the cover itself from #473, and a sheet
 * measured nothing, so on a browser that covers the page — Safari, which ignores
 * `interactive-widget` — the name and note sheets on the asset page stood under the
 * keyboard their field raised.
 *
 * Measured on every change of the visual viewport and every move of focus, since a keyboard
 * comes and goes with focus and a viewport may report its new size before or after. The
 * cover asks what holds focus as it measures; `typing` turns on with a move of focus into a
 * field and not with a field focused as the page opened — the code step's, which raises no
 * keyboard on a phone until it is pressed — so the bar keeps its 20 under it until then, as
 * it did before #568.
 *
 * `pan` IS HOW FAR THE BROWSER HAS MOVED THE VIEW FOR THE KEYBOARD (#579), which a sheet puts
 * the page it holds back by (`sheetHold.js`). `onPage` is the foot bar's: a keyboard a field
 * in an open dialog raised is the dialog's, and the bar behind it does not ride it.
 */
export default function useKeyboardCover({ onPage = false } = {}) {
    const [cover, setCover] = useState(0);
    const [pan, setPan] = useState(0);
    const [typing, setTyping] = useState(false);
    useEffect(() => {
        const view = window.visualViewport;
        const coarse = window.matchMedia("(pointer: coarse)");
        const measure = () => {
            if (!view) return;
            const reading = {
                layoutHeight: window.innerHeight,
                viewportHeight: view.height,
                viewportTop: view.offsetTop,
                scale: view.scale,
                typing: isTyping({ coarse: coarse.matches, element: document.activeElement, onPage }),
            };
            setCover(keyboardCover(reading));
            setPan(keyboardPan(reading));
        };
        const onFocus = (event) => {
            setTyping(isTyping({ coarse: coarse.matches, element: event.target, onPage }));
            measure();
        };
        const onBlur = () => {
            setTyping(false);
            measure();
        };
        measure();
        view?.addEventListener("resize", measure);
        view?.addEventListener("scroll", measure);
        document.addEventListener("focusin", onFocus);
        document.addEventListener("focusout", onBlur);
        return () => {
            view?.removeEventListener("resize", measure);
            view?.removeEventListener("scroll", measure);
            document.removeEventListener("focusin", onFocus);
            document.removeEventListener("focusout", onBlur);
        };
    }, [onPage]);
    return { cover, pan, keyboard: cover > 0 || typing };
}
