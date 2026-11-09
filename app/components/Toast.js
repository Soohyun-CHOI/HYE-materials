"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { focusPageHeading } from "./DialogFrame";
import Icon from "./Icon";

// Its action and its dismiss: faceless 32s in white, filling at Toast's own hover (0k Toast).
// 0k's ground, line and shadow, which a toast that stays and one that passes share (#617).
const TOAST_GROUND = "h-toast items-center rounded-card bg-foreground-default font-ui whitespace-nowrap text-white shadow-toast";

const TOAST_BUTTON = "flex h-control shrink-0 items-center justify-center rounded-control text-white hover:bg-toast-hover";

// Whatever closes a toast hands focus back to its opener first, if focus is inside it — or, where the
// page drawn again took the opener away, to the page's heading (#614).
function closeToast(toast, opener, then) {
    if (opener && toast?.contains(document.activeElement)) {
        if (opener.current?.isConnected) opener.current.focus();
        else focusPageHeading();
    }
    then();
}

/*
 * 0k's Toast — a line that reports how a finished action went: the Ink ground, 44 tall, at the
 * Group radius under Toast's shadow, centered on the content area and 24 above its end. Its line
 * is white 14 at 400, 14 from the start; its action follows 16 after the line, a faceless 32 at
 * white 14 and 600, and then a 32 dismiss holding a 14 ×, 2 after it and 6 from the end. The
 * line names what happened and the action what to do next, and the caller's words keep them
 * apart; this file has no words of its own.
 *
 * WRITTEN FOR 1a's EXPORT (#566), AND A FAILURE IS ALL IT DRAWS. Its action is the caller's to give:
 * an item's page at a desk says a refused press with no dialog here (#614) and gives none, 1f's
 * toast holding its line and its dismiss alone, and `desk` keeps it from the phone, which says the
 * same answer under the status (1k). A moment in its line is the date's notation with its slashes at
 * the toast's 60%, where the page's are 45% (`--opacity-toast-date-separator`, 1f). A failure leads its line with a
 * 16 white alert mark 8 before it and stays until it is dismissed or its action is taken (0k),
 * so `shown` is the caller's and nothing here times it out. A toast that reports a success,
 * which no screen draws yet, drops the mark; whether it goes by itself is the design's to say.
 *
 * IN THE TOP LAYER, PLACED ON THE COLUMN. It is drawn where its caller is — 1a's head, whose
 * blur would hold a fixed box to the head — so it opens as a popover, above everything and still
 * a descendant for the faces it reads. The content area is the rail's column
 * (`[data-content-area]`, `Rail.js`): the toast stands at its middle and is placed again whenever
 * the column changes width, as the rail opens beside it. Below the phone's edge there is no rail
 * and the column is the window. It stands 24 above the window's end, which is the column's while
 * the column is held to the window, as it is from the phone's edge up.
 *
 * `role="alert"`, SO IT IS HEARD AS IT COMES. Focus stays where it was; the toast's buttons come
 * after the caller's in the order the page is read. It closes on `Escape` — except while a dialog
 * is open, which `Escape` closes first, as the selection bar's does (0b) — as well as on its
 * dismiss, and whatever closes it while focus is inside it hands focus to `opener`, the control
 * whose press it reports: its action and its dismiss go with it, and focus never falls to the
 * page (`modalStyles.js`). One its caller stops drawing goes with the caller (#495).
 */
export default function Toast({ shown, line, action, onAction, dismissLabel, onDismiss, opener, desk = false }) {
    const toastRef = useRef(null);

    const place = useCallback(() => {
        const toast = toastRef.current;
        if (!toast) return;
        const column = toast.closest("[data-content-area]");
        const box = column ? column.getBoundingClientRect() : { left: 0, width: window.innerWidth };
        toast.style.left = `${box.left + box.width / 2}px`;
    }, []);

    useLayoutEffect(() => {
        const toast = toastRef.current;
        if (!shown || !toast) return undefined;
        place();
        if (!toast.matches(":popover-open")) toast.showPopover();
        const column = toast.closest("[data-content-area]");
        const observer = new ResizeObserver(place);
        if (column) observer.observe(column);
        window.addEventListener("resize", place);
        return () => {
            observer.disconnect();
            window.removeEventListener("resize", place);
        };
    }, [shown, place]);

    useEffect(() => {
        if (!shown) return undefined;
        const onKeyDown = (event) => {
            if (event.key !== "Escape" || event.defaultPrevented || document.querySelector("dialog[open]")) return;
            closeToast(toastRef.current, opener, onDismiss);
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [shown, opener, onDismiss]);

    if (!shown) return null;
    return (
        <div
            ref={toastRef}
            popover="manual"
            role="alert"
            className={`inset-auto bottom-0 mx-0 mt-0 mb-toast-offset -translate-x-1/2 gap-toast-inline overflow-visible pr-toast-inset-right pl-toast-inset-left ${TOAST_GROUND} open:flex ${desk ? "max-sm:open:hidden" : ""}`}
        >
            <span className="flex items-center gap-gap text-body [--opacity-date-separator:var(--opacity-toast-date-separator)]">
                <Icon name="circle-alert" kind="words" className="size-icon shrink-0" />
                {line}
            </span>
            <div className="flex items-center gap-toast-action-gap">
                {action && (
                    <button type="button" onClick={() => closeToast(toastRef.current, opener, onAction)} className={`${TOAST_BUTTON} px-ghost-inset-x text-body font-semibold`}>
                        {action}
                    </button>
                )}
                <button type="button" aria-label={dismissLabel} onClick={() => closeToast(toastRef.current, opener, onDismiss)} className={`${TOAST_BUTTON} aspect-square`}>
                    <Icon name="x" kind="words" className="size-icon-sm" />
                </button>
            </div>
        </div>
    );
}

/** How long a passing toast stands before it fades: the drawings' 4 s (Tools 57, 1c). */
const PASSING_TOAST_MS = 4000;

/**
 * 0k's Toast reporting a success, which goes by itself (#617): its line alone on the toast's ground,
 * 14 either side, with no mark, action or dismiss, standing for the drawings' 4 s and fading over
 * `--transition-duration-toast`, as Tools 57 draws 1c's `All written`. A status rather than an alert,
 * since it reports and asks nothing. Its caller places it — 1c's stands over the selection bar —
 * so it is drawn where it is put rather than in the top layer, and gone once it has faded.
 */
export function PassingToast({ line, className = "" }) {
    const [phase, setPhase] = useState("shown");
    useEffect(() => {
        const fade = setTimeout(() => setPhase("fading"), PASSING_TOAST_MS);
        return () => clearTimeout(fade);
    }, []);
    if (phase === "gone") return null;
    return (
        <div
            role="status"
            onTransitionEnd={() => setPhase((now) => (now === "fading" ? "gone" : now))}
            className={`flex px-toast-inset-left text-body tabular-nums transition-opacity duration-toast ${TOAST_GROUND} ${phase === "fading" ? "opacity-0" : "opacity-100"} ${className}`}
        >
            {line}
        </div>
    );
}
