"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { NAVIGATION_COPY as COPY, NAVIGATION_SECTIONS, currentOf } from "@/lib/navigation";
import { WORDMARK } from "@/lib/productName";
import RailAccount from "./RailAccount";

/*
 * The rail, and the column it holds a screen in — Claude Design's 0m, "the frame every
 * screen sits in" (#460). `docs/notes/tools.md`'s `The navigation` has what was weighed
 * and measured for it.
 *
 * WRITTEN WHERE ANY SCREEN COULD CALL IT, AND ONLY THE TOOLS LAYOUT DOES. The screens
 * above the tools axis each hold a width container inside their own page — twenty-four
 * of them across twenty pages (`docs/notes/tools.md`) — and a rail beside them would
 * fight every one. So the materials sections are on it and their screens are not under
 * it: pressing one leaves the rail behind, which is the state until #258. **What moves
 * it is #258**, which gathers those screens into one layout: the call moves from
 * `app/(tools)/layout.js` to `app/layout.js`, the design's faces move with it, and
 * `offline/design-values.mjs` widens its boundary to every route file, in one commit.
 * Nothing in this file changes, which is why it reads its section off the address
 * rather than taking it from the caller (`lib/navigation.js`).
 *
 * FROM THE 1280 WINDOW THE EXPANDED RAIL PUSHES THE SCREEN; BELOW IT, IT COVERS IT AS A
 * PANEL (0m). The breakpoint is Tailwind's `xl`, the design's 1280 at the default text
 * size, and the only place it is spelled is the classes below: the handlers ask how the
 * rail is laid out rather than repeating it. **Nothing lies behind a Panel** — the files
 * as Design sent them on 2026-10-01 took away the wash 0k had drawn there — so the Panel
 * is not modal: the screen beside it still answers, and the Panel goes when the reader
 * presses outside it, moves focus out of it, presses Escape or chooses a section. It
 * never stays open over the screen it took the reader to.
 *
 * BELOW THE PHONE'S EDGE THERE IS NO RAIL. The phone frame draws a top bar in its place
 * — on the tool item page, 1f's, with the id and one 48 button — and no rail at any
 * width, so the two never meet: they divide at `max-sm`, the edge every phone name
 * already divides at. The top bar is #463's. Below that edge the document scrolls
 * rather than this column.
 *
 * THE EXPANDED STATE IS THIS COMPONENT'S, AND NOTHING STORES IT. A layout does not render
 * again on a navigation, so a rail held by the tools layout keeps what the reader set
 * across every move between tools screens. A reload, a new tab, a scan and a trip
 * through a screen without the rail start collapsed — the design's resting state.
 * Storage only the browser reads would have the server draw the rail collapsed and
 * widen it after hydration, shifting the screen sideways on every load from 1280 up.
 *
 * A COLLAPSED ICON'S TOOLTIP AND ITS NAME ARE ONE STRING. A section's word is its link's
 * `aria-label`, its text — clipped out of sight while the rail is collapsed — and the
 * tooltip beside its icon, all three the one `word` below; the toggle's word is its name
 * and its tooltip alike. The label is written out rather than computed from the text
 * inside the link, so the name and the tooltip are one expression by construction, and
 * `offline/navigation.mjs` reads all three off this file. The tooltip is 0k's: after
 * 360ms, beside the icon, on hover and on keyboard focus, gone on Escape, and only while
 * the rail is collapsed. It is in the top layer, so nothing the rail clips can clip it,
 * and it is hidden from assistive tech, which has the name already.
 *
 * AND AT ITS FOOT, THE ACCOUNT (0m, #478) — `RailAccount`, held to the rail's bottom at
 * either width by an auto margin. The caller hands over `account`, the words the page's
 * own read gives (`accountOf`), or null, and then nothing is drawn. Its menu is a
 * popover inside the nav, so a press on the menu is a press inside a Panel and focus in
 * the menu is focus in the rail; an Escape the menu takes is marked handled, so a Panel
 * closes on the next one rather than with the menu.
 *
 * THE FRAME NEVER SCROLLS; THE COLUMN DOES (0i). The column holds the bar, the stable
 * gutter and the chain; how a column ends — its End and its give-back — is the column's,
 * and #463's.
 *
 * AND THE RAIL NEVER PRINTS. A print is a page the browser lays out once, so under
 * `print:` the rail is not drawn and the frame and its column give up the window's height
 * and their own scroll: a column held to the window would print one window of it. A
 * label prints on a page 11 mm wide, where `sm:` does not match and the frame and its
 * column set no `display` at all — so a print rule that makes a dialog's ancestors
 * `display: contents` (#457) meets nothing here to override.
 */

// 0m's icons, 16 in a 32 box, drawn as the design draws them.
const SECTION_ICONS = {
    "purchase-requests": (
        <>
            <path d="M4.5 2.5h4.6l3.4 3.4v7.6a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" />
            <path d="M9.1 2.5v3.4h3.4M5.8 9h4.4M5.8 11.4h3" />
        </>
    ),
    "purchase-orders": (
        <>
            <path d="M4 4h8a1 1 0 0 1 1 1v8.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
            <path d="M6.2 2.2h3.6v2.4H6.2z" />
            <path d="M5.8 8h4.4M5.8 10.6h3" />
        </>
    ),
    invoices: (
        <>
            <path d="M3.6 2.5h8.8v11.4l-1.5-1-1.5 1-1.4-1-1.5 1-1.4-1-1.5 1z" />
            <path d="M6 6h4M6 8.6h2.6" />
        </>
    ),
    deliveries: (
        <>
            <path d="M1.8 5h6.4v5.8H1.8z" />
            <path d="M8.2 7.2h2.6l2.4 2.3v1.3H8.2z" />
            <circle cx="4.4" cy="12" r="1.4" />
            <circle cx="10.6" cy="12" r="1.4" />
        </>
    ),
    tools: (
        <path d="M11.9 2.6a3.2 3.2 0 0 0-3.6 4.1l-5.1 5.1a1.2 1.2 0 0 0 1.7 1.7l5.1-5.1a3.2 3.2 0 0 0 4.1-3.6l-1.9 1.9-1.9-.5-.4-1.9z" />
    ),
    "material-prices": (
        <>
            <path d="M8.4 2.3 13.7 7.6 8 13.3 2.7 8V2.3z" />
            <circle cx="5.4" cy="5" r="1" />
        </>
    ),
};

// The column a screen sits in (0i): it scrolls from the phone's edge up, its lane is
// reserved whether or not the bar shows, and the thumb is round with 2 of clearance,
// going darker under the pointer. Firefox draws its own bar; these rules are WebKit's.
const COLUMN = [
    "min-w-0 flex-1 sm:overflow-y-auto sm:overscroll-y-contain sm:[scrollbar-gutter:stable] print:overflow-visible",
    "[&::-webkit-scrollbar]:w-scrollbar [&::-webkit-scrollbar]:h-scrollbar [&::-webkit-scrollbar-track]:bg-transparent",
    "[&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-corner]:bg-transparent",
    "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-scrollbar-thumb [&::-webkit-scrollbar-thumb]:bg-clip-content",
    "[&::-webkit-scrollbar-thumb]:[border:var(--spacing-scrollbar-inset)_solid_transparent]",
    "[&::-webkit-scrollbar-thumb:hover]:bg-scrollbar-thumb-hover",
].join(" ");

/**
 * 0k's tooltip beside an icon in the collapsed rail: one for the whole rail, placed
 * beside whichever target asked, in the top layer. `enabled` is false while the rail is
 * expanded, when every word is on the screen already.
 */
function useRailTooltip(enabled) {
    const tipRef = useRef(null);
    const [word, setWord] = useState("");

    const hide = useCallback(() => {
        const tip = tipRef.current;
        if (tip?.matches(":popover-open")) tip.hidePopover();
    }, []);

    const show = useCallback(
        (target, text) => {
            const tip = tipRef.current;
            if (!tip || !enabled) return;
            setWord(text);
            const box = target.getBoundingClientRect();
            tip.style.left = `${box.right}px`;
            tip.style.top = `${box.top + box.height / 2}px`;
            if (!tip.matches(":popover-open")) tip.showPopover();
        },
        [enabled]
    );

    // Escape takes it away wherever focus is, which is how a reader dismisses something
    // the pointer opened without moving the pointer.
    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key === "Escape") hide();
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [hide]);

    useEffect(() => {
        if (!enabled) hide();
    }, [enabled, hide]);

    /** What a target needs to show it: on hover, and on focus from the keyboard. */
    const targetProps = (text) => ({
        onPointerEnter: (event) => show(event.currentTarget, text),
        onPointerLeave: hide,
        onFocus: (event) => {
            if (event.currentTarget.matches(":focus-visible")) show(event.currentTarget, text);
        },
        onBlur: hide,
    });

    const element = (
        <div
            ref={tipRef}
            popover="manual"
            aria-hidden="true"
            className="pointer-events-none inset-auto my-0 mr-0 ml-tooltip-rail-offset -translate-y-1/2 whitespace-nowrap rounded-control bg-foreground-default px-tooltip-inset-x pt-tooltip-inset-top pb-tooltip-inset-bottom font-ui text-body-sm font-medium text-white shadow-popover transition-opacity delay-tooltip duration-tooltip starting:open:opacity-0"
        >
            {word}
        </div>
    );

    return { targetProps, hide, element };
}

/**
 * The rail beside the column `children` render in. Whether the reader has it expanded is
 * kept here, so it lasts as long as the layout that holds it.
 */
export default function Rail({ account, children }) {
    const pathname = usePathname();
    const [expanded, setExpanded] = useState(false);
    const navRef = useRef(null);
    const toggleRef = useRef(null);
    const tip = useRailTooltip(!expanded);
    const toggleWord = expanded ? COPY.collapse : COPY.expand;

    // A Panel is the expanded rail below the 1280 window, which the classes lay out over
    // the screen rather than beside it — asked of the layout rather than of a breakpoint
    // written a second time.
    const isPanel = useCallback(() => {
        const nav = navRef.current;
        return Boolean(nav) && getComputedStyle(nav).position === "absolute";
    }, []);

    const closePanel = useCallback(() => {
        if (isPanel()) setExpanded(false);
    }, [isPanel]);

    // A Panel goes on a press outside it and on Escape, which hands focus back to the
    // toggle that opened it. From 1280 up the rail is part of the layout and stays.
    useEffect(() => {
        if (!expanded) return undefined;
        const onPointerDown = (event) => {
            if (!navRef.current?.contains(event.target)) closePanel();
        };
        const onKeyDown = (event) => {
            if (event.key !== "Escape" || event.defaultPrevented || !isPanel()) return;
            setExpanded(false);
            toggleRef.current?.focus();
        };
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [expanded, closePanel, isPanel]);

    return (
        <div className="sm:flex sm:h-dvh print:h-auto">
            <div className="relative w-rail shrink-0 max-sm:hidden xl:w-auto print:hidden">
                <nav
                    ref={navRef}
                    aria-label={COPY.rail}
                    data-expanded={expanded ? "" : undefined}
                    // Focus leaving a Panel takes the Panel with it.
                    onBlur={(event) => {
                        if (!navRef.current?.contains(event.relatedTarget)) closePanel();
                    }}
                    className="group absolute inset-y-0 left-0 z-20 flex w-rail flex-col overflow-hidden bg-white p-rail-inset font-ui transition-[width] duration-rail ease-rail after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-divider data-expanded:w-rail-expanded max-xl:data-expanded:shadow-drawer xl:relative xl:h-full"
                >
                    <div className="flex shrink-0 items-center gap-[calc(var(--spacing-nav-gap)-(var(--height-control)-var(--size-icon))/2)]">
                        <button
                            ref={toggleRef}
                            type="button"
                            aria-expanded={expanded}
                            aria-label={toggleWord}
                            onClick={() => setExpanded((was) => !was)}
                            {...tip.targetProps(toggleWord)}
                            className="flex h-control aspect-square shrink-0 items-center justify-center rounded-control text-foreground-default hover:bg-hover"
                        >
                            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-icon">
                                <rect x="2.5" y="3" width="11" height="10" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
                                <path d="M6.4 3v10" stroke="currentColor" strokeWidth="1.4" />
                            </svg>
                        </button>
                        {/* The wordmark stays drawn until the rail has closed over it, and is
                            not drawn at all while it is collapsed (0h, 0m). Its first word is
                            set at 700 and the rest at 500 in Ink 2, split where
                            `lib/productName.js` splits it. */}
                        <span className="invisible whitespace-nowrap font-brand text-brand tracking-brand text-foreground-default transition-[visibility] delay-(--transition-duration-rail) duration-0 group-data-expanded:visible group-data-expanded:delay-0">
                            <span className="font-bold">{WORDMARK.lead}</span>
                            <span className="text-foreground-muted">{WORDMARK.rest}</span>
                        </span>
                    </div>
                    <div aria-hidden="true" className="my-rail-divider-stack h-px shrink-0 bg-divider" />
                    <ul className="flex flex-col gap-rail-stack">
                        {NAVIGATION_SECTIONS.map((section) => {
                            const word = COPY.sections[section.key];
                            const current = currentOf(section, pathname);
                            return (
                                <li key={section.key}>
                                    {/* The row is clipped at its own edge, so a collapsed rail shows the
                                        icon and keeps the word as the link's name; the current section
                                        sits on the Face, its icon in Accent (0c). */}
                                    <Link
                                        href={section.href}
                                        aria-label={word}
                                        aria-current={current}
                                        data-current={current ? "" : undefined}
                                        onClick={() => {
                                            tip.hide();
                                            closePanel();
                                        }}
                                        {...tip.targetProps(word)}
                                        className="group/row flex h-control items-center gap-nav-gap overflow-hidden rounded-control pr-control-inset-x pl-[calc((var(--height-control)-var(--size-icon))/2)] text-body font-medium text-foreground-subtle group-data-expanded:text-foreground-muted data-current:bg-selected data-current:text-primary group-data-expanded:data-current:font-semibold group-data-expanded:data-current:text-foreground-default not-data-current:hover:bg-hover not-data-current:hover:text-foreground-default"
                                    >
                                        <svg
                                            viewBox="0 0 16 16"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.4"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            aria-hidden="true"
                                            className="size-icon shrink-0 group-data-current/row:text-primary"
                                        >
                                            {SECTION_ICONS[section.key]}
                                        </svg>
                                        <span className="whitespace-nowrap">{word}</span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                    {account ? <RailAccount account={account} tip={tip} /> : null}
                </nav>
                {tip.element}
            </div>
            <div className={COLUMN}>{children}</div>
        </div>
    );
}
