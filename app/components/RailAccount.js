"use client";

import { useId, useRef, useState } from "react";
import { ActionMenu } from "./Menu";
import { menuButtonKey } from "@/lib/controls";
import { NAVIGATION_COPY as COPY } from "@/lib/navigation";

/*
 * The account at the rail's foot — Claude Design's 0m Account (#478): who is reading, and
 * the menu that signs them out, the one way to do that on the tools screens.
 *
 * WHAT IT SAYS ARRIVES AS WORDS, FROM THE READ THE PAGE MADE. The tools layout waits on
 * `takePageUser()` and hands the rail `accountOf`'s words: the user the page's own gate
 * read, never a read of the layout's — `lib/authz.js` has why, and the order that makes
 * it work. No reader, or nobody signed in, is null, and then the rail draws none of this.
 *
 * TWO SHAPES, AND THE AVATAR STAYS PUT BETWEEN THEM (0m). Collapsed, a 32 round button
 * holding the 24 avatar, 8 above the rail's foot, with the rail's tooltip; expanded, a 48
 * row at the Group corner holding the avatar, the name over the role, and a chevron
 * pointing the way the menu opens. The 8 under the button is (48 − 32) / 2 and the 4
 * before the row's avatar is (32 − 24) / 2, so the avatar's center is one point in both,
 * and both are written as those differences rather than as two more names. The shape
 * follows the rail's own `data-expanded` at once; the rail's width carries the change, as
 * it does for every row.
 *
 * ONE STRING IS THE BUTTON'S NAME AND ITS TOOLTIP (`accountOf`'s `label`), the rail's rule
 * for every collapsed icon. The design's tooltip parted the name and the role with a
 * middle dot where its name has a comma; a screen reader may say the dot, so both have the
 * comma.
 *
 * THE MENU IS WAI-ARIA'S MENU BUTTON. The button says that it opens a menu and whether the
 * menu is open; Enter, Space and Down open it on its first item and Up on its last; the
 * menu (`ActionMenu`) takes focus and the keys from there, and Escape hands focus back
 * here. Its one item submits the same `POST /api/auth/logout` the root screen's control
 * does, which ends the session and lands on `/login`.
 *
 * Below the phone's edge there is none, because there is no rail.
 */
export default function RailAccount({ account: words, tip }) {
    const [open, setOpen] = useState(false);
    const [focusOn, setFocusOn] = useState("first");
    const buttonRef = useRef(null);
    const id = useId();
    if (!words) return null;

    const buttonId = `${id}-account`;
    const menuId = `${id}-account-menu`;
    const formId = `${id}-sign-out`;

    const openOn = (where) => {
        tip.hide();
        setFocusOn(where);
        setOpen(true);
    };
    const close = (how) => {
        setOpen(false);
        if (how === "escape") buttonRef.current?.focus();
    };

    return (
        <div className="mt-auto flex shrink-0 flex-col">
            <button
                ref={buttonRef}
                id={buttonId}
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                aria-label={words.label}
                onClick={() => (open ? close("toggle") : openOn("first"))}
                onKeyDown={(event) => {
                    const where = menuButtonKey(event);
                    if (!where || open) return;
                    event.preventDefault();
                    openOn(where);
                }}
                {...(open ? {} : tip.targetProps(words.label))}
                className="group/account mb-[calc((var(--height-account)-var(--height-control))/2)] flex aspect-square h-control shrink-0 items-center justify-center self-start rounded-full text-foreground-default group-data-expanded:mb-0 group-data-expanded:aspect-auto group-data-expanded:h-account group-data-expanded:justify-start group-data-expanded:gap-account-gap group-data-expanded:self-stretch group-data-expanded:rounded-card group-data-expanded:pr-account-inset-right group-data-expanded:pl-[calc((var(--height-control)-var(--size-avatar))/2)] group-data-expanded:hover:bg-hover"
            >
                <span
                    aria-hidden="true"
                    className="flex size-avatar shrink-0 items-center justify-center rounded-full bg-selected text-body-sm font-semibold text-primary transition-colors duration-avatar ease-linear group-hover/account:bg-selected-hover group-data-expanded:group-hover/account:bg-selected"
                >
                    {words.initial}
                </span>
                <span className="hidden min-w-0 flex-col items-start gap-account-name-stack group-data-expanded:flex">
                    <span className="max-w-full truncate text-body-sm font-semibold text-foreground-default">{words.name}</span>
                    <span className="max-w-full truncate text-heading-sm font-normal text-foreground-subtle">{words.role}</span>
                </span>
                <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                    className="ml-auto hidden size-account-chevron shrink-0 text-foreground-subtle group-data-expanded:block"
                >
                    <path d="M4.5 9.5 8 6l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>
            <ActionMenu
                id={menuId}
                anchorRef={buttonRef}
                shown={open}
                labelledBy={buttonId}
                placement="above"
                focusOn={focusOn}
                items={[{ key: "sign-out", label: COPY.account.signOut, type: "submit", form: formId }]}
                onClose={close}
            />
            <form id={formId} action="/api/auth/logout" method="POST" hidden />
        </div>
    );
}
