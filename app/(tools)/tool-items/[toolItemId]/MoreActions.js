"use client";

import { useId, useRef, useState } from "react";
import Icon from "@/app/components/Icon";
import { ActionMenu } from "@/app/components/Menu";
import { useTooltip } from "@/app/components/Tooltip";
import { menuButtonKey } from "@/lib/controls";
import { NAVIGATION_COPY } from "@/lib/navigation";
import { TOOL_ITEM_COPY } from "@/lib/toolItemView";
import { TOOL_TRANSITION_COPY } from "@/lib/toolTransition";
import { useToolItemTransition } from "./ToolItemTransition";

/** Three dots, 16 at a desk and 24 in a phone's top bar (1c, 1f). */
function Dots({ phone }) {
    return phone ? <Icon name="ellipsis" className="size-mobile-top-bar-icon" /> : <Icon name="ellipsis" className="size-icon" />;
}

/**
 * `More actions` (#463) — the button that holds the retirement, at a desk beside the
 * transition (1c) and on a phone at the right end of the top bar (1f). Retiring a tool item is
 * its last act and is not one a scan is for, so the design takes it off the page and puts it
 * one press away; the question it opens is the retirement's own (`RetirementConfirm`), as
 * #458 built it to be opened.
 *
 * WAI-ARIA'S MENU BUTTON, AS THE ACCOUNT AT THE RAIL'S FOOT IS (#478). The button says it opens
 * a menu and whether the menu is open; Enter, Space and Down open it on its first item and Up
 * on its last; the menu takes focus and the keys from there, and Escape hands focus back here.
 * Its one item, `Retire this tool`, is 0f's Destructive, and choosing it hands focus to this
 * button before the question opens — so the question's every way out comes back here, which
 * the browser's modal dialog does for whatever held focus as it opened.
 *
 * ONE NAME AT BOTH WIDTHS, `More actions`, and at a desk its tooltip — one string, as the
 * rail's icons have (0k: 6 above, not while its menu shows). The design names the phone's
 * button `More`; a name nobody sees follows this app's rule, and both open one menu.
 *
 * AT A DESK, 32 SQUARE WITH A 16 MARK, ITS INK ON THE CONTENT'S EDGE; ON A PHONE, 48 ROUND
 * IN INK 2 WITH A 24 MARK, ON THE FIELD WASH IN INK WHILE ITS MENU IS OPEN (1f).
 *
 * ON A PHONE ITS MENU ENDS ON THE ACCOUNT, AND EVERY SCREEN WITH A TOP BAR CARRIES IT (Tools
 * 0a Menu, #495). A phone has no rail, so this is where the reader is named and signs out:
 * under a full-width Inner rule, `Sign out` over the reader's email, posting where the rail's
 * account and the root screen do. Where the record takes no action — a retired tool, a code
 * no tool carries, a reader on no job — the menu holds the account alone, with no rule, and
 * there it needs no transition: the screen saying a code is on no tool has none. The desk's
 * menu stays the retirement alone, since the rail's foot holds the account there.
 */
export default function MoreActions({ phone = false, account = null }) {
    const transition = useToolItemTransition();
    const mayRetire = Boolean(transition?.plan.mayRetire);
    const [open, setOpen] = useState(false);
    const [focusOn, setFocusOn] = useState("first");
    const buttonRef = useRef(null);
    const id = useId();
    const tip = useTooltip({ enabled: !phone, placement: "above" });
    const word = TOOL_ITEM_COPY.moreActions;
    const buttonId = `${id}-more`;
    const menuId = `${id}-more-menu`;
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
        <div className={phone ? "flex" : "relative -mr-[calc((var(--height-control)-var(--size-icon))/2)] flex"}>
            <button
                ref={buttonRef}
                id={buttonId}
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                aria-label={word}
                onClick={() => (open ? close("toggle") : openOn("first"))}
                onKeyDown={(event) => {
                    const where = menuButtonKey(event);
                    if (!where || open) return;
                    event.preventDefault();
                    openOn(where);
                }}
                {...(open ? {} : tip.targetProps(word))}
                className={
                    phone
                        ? "flex aspect-square h-mobile-touch-target shrink-0 items-center justify-center rounded-full text-foreground-muted aria-expanded:bg-background-muted aria-expanded:text-foreground-default"
                        : "flex aspect-square h-control shrink-0 items-center justify-center rounded-control text-foreground-default hover:bg-hover"
                }
            >
                <Dots phone={phone} />
            </button>
            <ActionMenu
                id={menuId}
                anchorRef={buttonRef}
                shown={open}
                labelledBy={buttonId}
                look="record"
                focusOn={focusOn}
                items={[
                    ...(mayRetire
                        ? [
                              {
                                  key: "retire",
                                  label: TOOL_TRANSITION_COPY.retireOpener,
                                  tone: "danger",
                                  onSelect: () => {
                                      buttonRef.current?.focus();
                                      setOpen(false);
                                      transition.openRetirement();
                                  },
                              },
                          ]
                        : []),
                    ...(phone && account
                        ? [
                              {
                                  key: "sign-out",
                                  label: NAVIGATION_COPY.account.signOut,
                                  detail: account.email,
                                  separated: true,
                                  type: "submit",
                                  form: formId,
                              },
                          ]
                        : []),
                ]}
                onClose={close}
            />
            {phone && account && <form id={formId} action="/api/auth/logout" method="POST" hidden />}
            {!phone && tip.element}
        </div>
    );
}
