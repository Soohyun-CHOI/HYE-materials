"use client";

import { useId, useRef, useState } from "react";
import { ButtonLabel } from "@/app/components/Controls";
import Icon from "@/app/components/Icon";
import { ActionMenu, useOpenerPress } from "@/app/components/Menu";
import { useTooltip } from "@/app/components/Tooltip";
import { clickFromKeys, menuButtonKey } from "@/lib/controls";
import { NAVIGATION_COPY } from "@/lib/navigation";
import { ASSET_EVENT } from "@/lib/assetStatus";
import { ASSET_COPY } from "@/lib/assetView";
import { ASSET_TRANSITION_COPY } from "@/lib/assetTransition";
import { ASSET_OFFICE_COPY } from "@/lib/assetOfficeActs";
import { useAssetTransition } from "./AssetTransition";
import { JobChangeDialog, JobChangeSheet } from "./JobChange";
import { LendDialog, LendSheet } from "./LendDialog";

/** Three filled dots, 16 at a desk and 24 in a phone's top bar (1f, 1j; `Icon.js`, #607). */
function Dots({ phone }) {
    return phone ? <Icon name="ellipsis" kind="words" className="size-mobile-top-bar-icon" /> : <Icon name="ellipsis" kind="words" className="size-icon" />;
}

/**
 * `More actions` (#463) — the button that holds the retirement, at a desk beside the
 * transition (1f) and on a phone at the right end of the top bar (1j). Retiring an asset is
 * its last act and is not one a scan is for, so the design takes it off the page and puts it
 * one press away; the question it opens is the retirement's own (`RetirementConfirm`), as
 * #458 built it to be opened.
 *
 * AND SINCE #531 IT HOLDS `Send for repair` ABOVE IT, from stock alone (1f, 1j-a): an item
 * to its maker, in Ink at both widths, where the retirement is 0f's Destructive. It asks
 * nothing — the return undoes it — so choosing it hands focus to this button, as the
 * retirement does, and sends at once through the page's one answer; a refusal stands under
 * the status as a press's does (1k). While it is on its way this button is 0f's Working: busy
 * to assistive tech, its press turned away, the spinner laid over its dots after the wait,
 * and its `-ing` word heard and not seen. The design draws no wait for it; that is 0f's rule
 * that a wait is said in what sent it, and the menu has closed.
 *
 * WAI-ARIA'S MENU BUTTON, AS THE ACCOUNT AT THE RAIL'S FOOT IS (#478). The button says it opens
 * a menu and whether the menu is open; Enter, Space and Down open it on its first item and Up
 * on its last; the menu takes focus and the keys from there, and Escape hands focus back here.
 * `Retire this item` is 0f's Destructive, and choosing it hands focus to this button before
 * the question opens — so the question's every way out comes back here, which the browser's
 * modal dialog does for whatever held focus as it opened.
 *
 * ONE NAME AT BOTH WIDTHS, `More actions`, and at a desk its tooltip — one string, as the
 * rail's icons have (0k: 6 above, not while its menu shows). The design names the phone's
 * button `More`; a name nobody sees follows this app's rule, and both open one menu.
 *
 * AT A DESK, 32 SQUARE WITH A 16 MARK, ITS INK ON THE CONTENT'S EDGE, ON HOVER WHILE ITS MENU
 * IS OPEN (1f, #607); ON A PHONE, 48 ROUND IN INK 2 WITH A 24 MARK, ON THE FIELD WASH IN INK
 * WHILE ITS MENU IS OPEN (1j). A press on it while the menu is open closes the menu, in Safari too
 * (`useOpenerPress`, #607).
 *
 * ON A PHONE ITS MENU ENDS ON THE ACCOUNT, AND EVERY SCREEN WITH A TOP BAR CARRIES IT (Tools
 * 0a Menu, #495). A phone has no rail, so this is where the reader is named and signs out:
 * under a full-width Inner rule, `Sign out` over the reader's email, posting where the rail's
 * account does. Where the record takes no action — a retired asset, a code
 * no asset carries, a reader who does not record on the item (#506, #597) — not a site manager,
 * or one on another job or on none — and is not the office on an item nothing has happened to
 * (#583) — the menu holds the account alone, with no
 * rule, and
 * there it needs no transition: the screen saying a code is on no asset has none. The desk's
 * menu holds the record's acts alone — `Send for repair` from stock, the office's `Change job`,
 * the retirement and the office's deletion — since the rail's foot holds the account there.
 *
 * AND THE OFFICE'S `Change job` AFTER `Send for repair` (#583), while the item's history holds its
 * `Created` entry alone (1f, 1j-f): an act on the record that ends nothing, so it stands with the
 * sending, in Ink, and a full-width Inner rule parts the two from the acts that end the item —
 * the retirement, and #582's deletion beside it. The rule stands only where the office's line
 * does, as the files draw it: a site manager's menu holds the sending over the retirement with
 * none. Choosing it hands focus to this button and opens this width's own `Change job` — the
 * desk's dialog or the phone's sheet, drawn here (`JobChange.js`).
 *
 * AND A LOAN'S LINE AFTER `Send for repair` (#598; 1f, 1j-f, 1j-g), each in Ink: `Lend to another job`
 * for a site manager on the job that owns an item in stock there, and `Return to owner` for one on the
 * job it was lent to, never both. Each moves the item and ends nothing, so it stands with the sending;
 * **at a desk the rule parts it from the retirement, and on a phone no rule does**, as the files draw
 * the two widths. Choosing the lending hands focus to this button and opens this width's dialog or
 * sheet (`LendDialog.js`), drawn here as the job change's is; choosing the return opens its question,
 * one for both widths (`ReturnConfirm`), which the page's provider draws.
 *
 * AND THE OFFICE'S `Delete this item` LAST (#582; 1f, 1j), under the same condition, after the
 * retirement and in its tone — 0f's Destructive — the second act that ends the item. The rule stands
 * over the first of the two, whichever the reader is offered. Choosing it hands focus to this
 * button and opens the deletion's question, one for both widths (`DeleteConfirm`), which the page's
 * provider draws. A deletion left half done offers it alone of the office's two, since its job may
 * no longer change, and with no rule.
 */
export default function MoreActions({ phone = false, account = null }) {
    const transition = useAssetTransition();
    const maySendForRepair = Boolean(transition?.plan.maySendForRepair);
    const mayRetire = Boolean(transition?.plan.mayRetire);
    const mayChangeJob = Boolean(transition?.office?.mayChangeJob);
    const mayDelete = Boolean(transition?.office?.mayDelete);
    const mayLend = Boolean(transition?.plan.mayLend);
    const mayReturn = Boolean(transition?.plan.mayReturn);
    // Where a rule parts the acts that end nothing from those that end the item: under the office's
    // line at both widths, and under a loan's at a desk alone (#598).
    const ruled = mayChangeJob || (!phone && (mayLend || mayReturn));
    const busy = Boolean(transition?.repairPending);
    const [open, setOpen] = useState(false);
    const [focusOn, setFocusOn] = useState("first");
    const [keyed, setKeyed] = useState(false);
    const buttonRef = useRef(null);
    const press = useOpenerPress(open);
    const id = useId();
    const tip = useTooltip({ enabled: !phone, placement: "above" });
    const word = ASSET_COPY.moreActions;
    const buttonId = `${id}-more`;
    const menuId = `${id}-more-menu`;
    const formId = `${id}-sign-out`;

    const openOn = (where, byKey) => {
        tip.hide();
        setFocusOn(where);
        setKeyed(byKey);
        setOpen(true);
    };
    const close = (how) => {
        setOpen(false);
        if (how === "escape") buttonRef.current?.focus();
    };

    // The record's acts that end nothing, then those that end the item (#583, #582): the rule over
    // the first of the second where the office's line stands among the first, which is above it.
    const acts = [
        ...(maySendForRepair
            ? [
                  {
                      key: "repair",
                      label: ASSET_TRANSITION_COPY.control[ASSET_EVENT.SENT_FOR_REPAIR],
                      onSelect: () => {
                          buttonRef.current?.focus();
                          setOpen(false);
                          transition.sendForRepair();
                      },
                  },
              ]
            : []),
        ...(mayLend
            ? [
                  {
                      key: "lend",
                      label: ASSET_TRANSITION_COPY.control[ASSET_EVENT.LENT],
                      onSelect: () => {
                          buttonRef.current?.focus();
                          setOpen(false);
                          transition.lend.start(phone ? "phone" : "desk");
                      },
                  },
              ]
            : []),
        ...(mayReturn
            ? [
                  {
                      key: "return",
                      label: ASSET_TRANSITION_COPY.control[ASSET_EVENT.RETURNED_TO_OWNER],
                      onSelect: () => {
                          buttonRef.current?.focus();
                          setOpen(false);
                          transition.openReturn();
                      },
                  },
              ]
            : []),
        ...(mayChangeJob
            ? [
                  {
                      key: "job",
                      label: ASSET_OFFICE_COPY.changeJob,
                      onSelect: () => {
                          buttonRef.current?.focus();
                          setOpen(false);
                          transition.jobChange.start(phone ? "phone" : "desk");
                      },
                  },
              ]
            : []),
    ];
    const ends = [
        ...(mayRetire
            ? [
                  {
                      key: "retire",
                      label: ASSET_TRANSITION_COPY.retireOpener,
                      tone: "danger",
                      separated: ruled,
                      onSelect: () => {
                          buttonRef.current?.focus();
                          setOpen(false);
                          transition.openRetirement();
                      },
                  },
              ]
            : []),
        ...(mayDelete
            ? [
                  {
                      key: "delete",
                      label: ASSET_OFFICE_COPY.deleteOpener,
                      tone: "danger",
                      // The rule over it where it is the first that ends the item (#582).
                      separated: ruled && !mayRetire,
                      onSelect: () => {
                          buttonRef.current?.focus();
                          setOpen(false);
                          transition.openDeletion();
                      },
                  },
              ]
            : []),
    ];

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
                aria-busy={busy || undefined}
                aria-disabled={busy || undefined}
                data-busy={busy || undefined}
                onPointerDown={press.onPointerDown}
                onClick={(event) => {
                    if (busy) return;
                    if (press.closes(event)) close("toggle");
                    else openOn("first", clickFromKeys(event));
                }}
                onKeyDown={(event) => {
                    const where = menuButtonKey(event);
                    if (!where || open || busy) return;
                    event.preventDefault();
                    openOn(where, true);
                }}
                {...(open ? {} : tip.targetProps(word))}
                className={
                    phone
                        ? "group/button relative flex aspect-square h-mobile-touch-target shrink-0 items-center justify-center rounded-full text-foreground-muted aria-expanded:bg-background-muted aria-expanded:text-foreground-default"
                        : "group/button relative flex aspect-square h-control shrink-0 items-center justify-center rounded-control text-foreground-default not-aria-disabled:hover:bg-hover aria-expanded:bg-hover"
                }
            >
                <ButtonLabel size={phone ? "xl" : "lg"} busyLabel={ASSET_TRANSITION_COPY.working[ASSET_EVENT.SENT_FOR_REPAIR]}>
                    <Dots phone={phone} />
                </ButtonLabel>
            </button>
            <ActionMenu
                id={menuId}
                anchorRef={buttonRef}
                shown={open}
                labelledBy={buttonId}
                look="record"
                focusOn={focusOn}
                keyed={keyed}
                items={[
                    ...acts,
                    ...ends,
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
            {mayChangeJob && (phone ? <JobChangeSheet /> : <JobChangeDialog />)}
            {mayLend && (phone ? <LendSheet /> : <LendDialog />)}
            {!phone && tip.element}
        </div>
    );
}
