/**
 * 0i's Bar, drawn on a column that scrolls (#460, #463): a transparent track, a round thumb
 * at Ink 0.20 with its clearance, going 0.34 under the pointer, and no arrow buttons.
 * Firefox draws its own bar; these rules are WebKit's.
 *
 * ONE STRING FOR EVERY LANE ON THE AXIS. The rail's column drew it first (#460), and a list
 * scrolls its rows in a lane of its own since #463, so the two read it from here rather
 * than spelling it twice. Whatever scrolls with it reserves the lane itself — overflow,
 * `scrollbar-gutter` and the overscroll rule are the caller's, since only the caller knows
 * when it scrolls.
 */
export const SCROLL_LANE = [
    "[&::-webkit-scrollbar]:w-scrollbar [&::-webkit-scrollbar]:h-scrollbar [&::-webkit-scrollbar-track]:bg-transparent",
    "[&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-corner]:bg-transparent",
    "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-scrollbar-thumb [&::-webkit-scrollbar-thumb]:bg-clip-content",
    "[&::-webkit-scrollbar-thumb]:[border:var(--spacing-scrollbar-inset)_solid_transparent]",
    "[&::-webkit-scrollbar-thumb:hover]:bg-scrollbar-thumb-hover",
].join(" ");
