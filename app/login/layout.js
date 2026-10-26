import { KEYBOARD_VIEWPORT } from "@/app/components/keyboardViewport";
import { SCROLL_LANE } from "@/app/components/scrollLane";
import { brandFace } from "@/app/faces/brand";
import { uiFace } from "@/app/faces/ui";
import { WORDMARK } from "@/lib/productName";

/**
 * A phone's browser that would cover the page with its keyboard shrinks it instead, so the
 * bar a step's action stands in stays above the keyboard (Tools 0a Keyboard). A browser
 * that ignores the hint covers the page, and the bar measures how far
 * (`app/components/BottomBar.js`). Every sign-in step takes it, as every screen with a foot
 * bar does (`app/components/keyboardViewport.js`).
 */
export const viewport = KEYBOARD_VIEWPORT;

/**
 * The frame every sign-in step is drawn in (#473): the sign-in screen, the confirmation a
 * link opens, the name step a first sign-in meets and the job step after it (#554) — the
 * design's 0o at a desk and its step page below the phone's edge (Tools 0a).
 *
 * ONE COLUMN UNDER THE WORDMARK, AND THE WORDMARK DOES NOT MOVE. At a desk the column is
 * 360 wide and centered, and the wordmark's top stands 24% of the window's height from the
 * page's top, never under 64 nor over 240, in every state, so a refusal or a changed state
 * grows the page downward only — 268 whatever the window until the files of 2026-10-22 (0o
 * Column, #554). On a phone it is set left, 72 from the top, and the column fills the screen
 * between the 16 either side so a step's bottom bar can sit at its foot. **The screen is the
 * dynamic viewport there (#568)**, `min-h-dvh` as the assets' column is (`Rail.js`): until
 * then the frame filled `<body>`, which fills the initial containing block, and a phone
 * keeps that at its height with the browser's bars shown — so a step taller than that and
 * shorter than the screen with the bars hidden stood its bar above the screen's foot. The
 * wordmark is the product's name split where `lib/productName.js` splits it, and is where a
 * reader arriving from the email first meets the name the email was sent under.
 *
 * A STEP WHOSE COLUMN HOLDS A LIST TO CHOOSE FROM STANDS AT 10% (0o, Sign in 1l): the room
 * above the wordmark is 10% of the window, never under 48 nor over 112, the same room is kept
 * under the column, and the list fills what lies between. The step marks itself
 * `data-sign-in-list`, which is all this frame reads of it — the job step is the one (#554).
 *
 * AT A DESK THE COLUMN SCROLLS, AND THE PAGE DOES NOT (0i, #495). The frame never scrolls:
 * the column scrolls in 0i's 8 lane, reserved on both sides so the centered column stays
 * centered whether or not the bar shows (0o), stops at its end, and ends on 0i's 40, since
 * it ends in open space. Until #495 a short window scrolled the document in the browser's
 * own bar. On a phone the document scrolls still, which is what lets the foot bar ride on
 * the keyboard.
 *
 * THE SIGN-IN SCREENS ARE THE SECOND SET THE DESIGN IS APPLIED TO, AND THIS IS WHAT LETS
 * THEM BE (#473). No screen here holds a width container or shares a component with the
 * screens above the assets axis, so a file only these steps and the asset screens reach may
 * read the design's names until #258 — `offline/design-values.mjs` holds the boundary —
 * and this layout is above every step the way the assets layout is above that axis.
 *
 * THE FACES ARE APPLIED HERE, the two the steps draw: Instrument Sans for every word and
 * Bricolage Grotesque for the wordmark, from `app/faces/`, where each face is loaded once
 * for every layout that draws it. The root layout's own two faces are drawn by no element.
 * #258 applies the design's faces on the root layout's element, and this one stops.
 */
export default function SignInLayout({ children }) {
    return (
        <div
            className={`${uiFace.variable} ${brandFace.variable} flex flex-1 flex-col bg-white font-ui text-foreground-default max-sm:min-h-dvh sm:h-dvh sm:flex-none`}
        >
            <main
                className={`flex flex-1 justify-center px-page-gutter pt-sign-in-inset-top max-sm:px-mobile-gutter max-sm:pt-mobile-sign-in-inset-top sm:has-[[data-sign-in-list]]:items-stretch sm:has-[[data-sign-in-list]]:pt-sign-in-list-step-inset-y sm:has-[[data-sign-in-list]]:pb-sign-in-list-step-inset-y sm:min-h-0 sm:items-start sm:overflow-y-auto sm:overscroll-y-contain sm:pb-scroll-inset-bottom sm:[scrollbar-gutter:stable_both-edges] ${SCROLL_LANE}`}
            >
                <div className="flex w-full max-w-sign-in flex-col max-sm:max-w-none">
                    <p className="whitespace-nowrap text-center font-brand text-brand-lg tracking-brand max-sm:text-left max-sm:text-mobile-brand">
                        <span className="font-bold">{WORDMARK.lead}</span>
                        <span className="text-foreground-muted">{WORDMARK.rest}</span>
                    </p>
                    <div className="mt-sign-in-brand-stack flex min-h-0 flex-1 flex-col max-sm:mt-mobile-sign-in-brand-stack">{children}</div>
                </div>
            </main>
        </div>
    );
}
