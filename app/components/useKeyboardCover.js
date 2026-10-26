import { useEffect, useState } from "react";
import { keyboardCover, takesTyping } from "./keyboardViewport";

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
 */
export default function useKeyboardCover() {
    const [cover, setCover] = useState(0);
    const [typing, setTyping] = useState(false);
    useEffect(() => {
        const view = window.visualViewport;
        const coarse = window.matchMedia("(pointer: coarse)");
        const measure = () => {
            if (!view) return;
            setCover(
                keyboardCover({
                    layoutHeight: window.innerHeight,
                    viewportHeight: view.height,
                    viewportTop: view.offsetTop,
                    scale: view.scale,
                    typing: coarse.matches && takesTyping(document.activeElement),
                })
            );
        };
        const onFocus = (event) => {
            setTyping(coarse.matches && takesTyping(event.target));
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
    }, []);
    return { cover, keyboard: cover > 0 || typing };
}
