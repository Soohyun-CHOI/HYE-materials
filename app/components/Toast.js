"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import Icon from "./Icon";

// Its action and its dismiss: faceless 32s in white, filling at Toast's own hover (0k Toast).
const TOAST_BUTTON = "flex h-control shrink-0 items-center justify-center rounded-control text-white hover:bg-toast-hover";

// Whatever closes a toast hands focus back to its opener first, if focus is inside it.
function closeToast(toast, opener, then) {
    if (toast?.contains(document.activeElement)) opener?.current?.focus();
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
 * WRITTEN FOR 1a's EXPORT (#566), AND A FAILURE IS ALL IT DRAWS. A failure leads its line with a
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
export default function Toast({ shown, line, action, onAction, dismissLabel, onDismiss, opener }) {
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
            className="inset-auto bottom-0 mx-0 mt-0 mb-toast-offset h-toast -translate-x-1/2 items-center gap-toast-inline overflow-visible rounded-card bg-foreground-default pr-toast-inset-right pl-toast-inset-left font-ui whitespace-nowrap text-white shadow-toast open:flex"
        >
            <span className="flex items-center gap-gap text-body">
                <Icon name="circle-alert" className="size-icon shrink-0" />
                {line}
            </span>
            <div className="flex items-center gap-toast-action-gap">
                <button type="button" onClick={() => closeToast(toastRef.current, opener, onAction)} className={`${TOAST_BUTTON} px-ghost-inset-x text-body font-semibold`}>
                    {action}
                </button>
                <button type="button" aria-label={dismissLabel} onClick={() => closeToast(toastRef.current, opener, onDismiss)} className={`${TOAST_BUTTON} aspect-square`}>
                    <Icon name="x" className="size-icon-sm" />
                </button>
            </div>
        </div>
    );
}
