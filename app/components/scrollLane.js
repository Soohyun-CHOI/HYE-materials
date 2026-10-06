/**
 * 0i's Bar, drawn on a column that scrolls (#460, #463): a transparent track, a round thumb
 * at Ink 0.20 with its clearance, going 0.34 under the pointer, and no arrow buttons.
 * Firefox draws its own bar; these rules are WebKit's.
 *
 * ONE STRING FOR EVERY LANE. The rail's column drew it first (#460), a list scrolls its rows
 * in a lane of its own since #463, and the labels' pane and a sign-in step's column at a
 * desk since #495, so each reads it from here rather than spelling it again. Whatever
 * scrolls with it reserves the lane itself — overflow, `scrollbar-gutter` and the
 * overscroll rule are the caller's, since only the caller knows when it scrolls.
 */
export const SCROLL_LANE = [
    "[&::-webkit-scrollbar]:w-scrollbar-gutter [&::-webkit-scrollbar]:h-scrollbar-gutter [&::-webkit-scrollbar-track]:bg-transparent",
    "[&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-corner]:bg-transparent",
    "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-scrollbar-thumb [&::-webkit-scrollbar-thumb]:bg-clip-content",
    "[&::-webkit-scrollbar-thumb]:[border:var(--spacing-scrollbar-inset)_solid_transparent]",
    "[&::-webkit-scrollbar-thumb:hover]:bg-scrollbar-thumb-hover",
].join(" ");
