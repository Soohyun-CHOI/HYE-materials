/**
 * A space the text holds and the drawing sets to a design value (#463).
 *
 * ROOM BETWEEN TWO WORDS IS A CHARACTER AS WELL AS A WIDTH. Padding is only the
 * width, so two values the design sets apart with it run together in the text: a
 * date and its time copied as `10/05/20268:55 AM`, and an assistive reader read the
 * same, until this replaced the padding. This is a real space in a box of the
 * design's width — `whitespace-pre` keeps the space from collapsing away, and the box
 * rather than the font's own space sets the figure. The caller names the width,
 * which is the design value it reads.
 */
export default function Space({ className }) {
    return <span className={`inline-block whitespace-pre ${className}`}>{" "}</span>;
}
