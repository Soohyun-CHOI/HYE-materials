# Design system — the reasoning

Governs `app/designValues.css` and `app/globals.css`. **Read this before editing there** — CLAUDE.md carries only the rules that bind code outside this area; the derivation, the evidence and the alternatives weighed are here.

What the tools axis owes these names is in `tools.md`, and how the check reads a class is in the header of `offline/design-values.mjs`. **Write a name here as its variable, never as a utility class**: Tailwind scans this file for class names, and a class spelled in it is built into every page's stylesheet.

## The design's values, declared once (#462)

`app/designValues.css` declares the values the design settled for the tools screens, each under a conventional name and in rem, and `app/globals.css` imports it right after Tailwind so every page's stylesheet carries them. **No screen reads one yet.** The issues that apply them come next — #456 to #459 open the four dialogs the design drew for the tools screens, #460 draws the rail and #463 gives the screens the rest of the look — and until #258 a name is read only by a file the tools axis alone calls.

**TAILWIND 4 HAS NO CONFIGURATION FILE TO WEIGH AGAINST, SO THE CHOICE WAS THE NAMESPACE.** `@theme` is the configuration and it is CSS: every name it declares is a custom property and a utility at once, so "Tailwind configuration or CSS variables" is not a choice this version offers. What was chosen is to put the names inside Tailwind's namespaces rather than in a plain `:root` block. Every screen in this app styles with utilities, so a name a screen reads has to be one — a plain variable would be read through the arbitrary-value syntax at every site. Measured on 4.3.2 before anything was written: a `--height-*` name is readable as a height and as nothing else, so a control height cannot become somebody's padding; a `--text-*` name carries its `--line-height`, tracking and weight in the one utility, which is the design's "every size carries its own line height, declared wherever a size is" made into a structure; a `@theme` block in an imported file works.

**`@theme` AND NOT `@theme inline`, FOR THE APPEARANCE #218 DEFERRED.** A plain block makes each utility read `var(--name)`, so a second set of values later is values behind names that already exist — #218's own description of the version worth building — where an inline block would bake each value into its utility. **The three faces are the exception and have to be**: a face is the variable its next/font call sets, that call's class sits on an element below `:root`, and a `:root` variable referring to it would resolve before the class exists. So the faces are the one inline block, and each utility carries the face's variable to the element that reads it.

**WHAT THE BUILD EMITS IS NOT A SIGNAL OF WHAT IS READ, AND THAT WAS MEASURED BEFORE THE CHECK WAS DESIGNED.** Tailwind leaves a theme variable out of the stylesheet until something uses it, and it counts a variable as used as soon as its name appears in any file it scans — a markdown sentence citing one was enough. So "is this name read" cannot be read off the build, and the check decides it from the source instead. **The consequence was measured by compiling the stylesheet of the base commit's tree and of this branch's, each scanning its own tree and in a process of its own** — the PostCSS plugin caches a compiler per input path, so one process compiling both reports no difference at all, and one tree scanned for both hides whatever the new files' prose adds. The check names every variable, so every declared variable reaches every page's `:root` from this commit rather than from the one that first reads it, and so do seven of Tailwind's and the app's own that this file and the check name — the two breakpoints, the blur, and the app's two faces and two colors: 8,902 bytes minified, 1,698 gzipped, which is what the stylesheet carries anyway once the tools screens read them all.

**AND NO RULE COMES WITH THEM, WHICH THE FIRST NAMES COULD NOT SAY.** Tailwind reads a class out of any file it scans, prose and SVG included, so a name can be read by a word that was never a class. The first set of names had a color called `rule`, and `public/`'s create-next-app SVGs carry `fill-rule="evenodd"`, so Tailwind built `.fill-rule` into every page. Every candidate the scanner finds in the repository was handed to Tailwind with the conventional names declared, and none reads one; a color called `shadow` would have repeated the shape, since `text-shadow` is a CSS property prose cites, which is why the shadow ink is `--color-elevation`. **The scanner does not read `.css` files** — measured by planting one of each type in a folder — so the declaration's comments may say anything, and this file, which it does read, writes every name as its variable.

**A DECLARATION FILE HOLDS NOTHING THAT SELECTS AN ELEMENT.** A rule in it would style every page, the ones above the tools axis included, and those each hold a width container of their own that a global rule would fight. The file is `@theme` blocks and comments, and the check fails anything else — a `@custom-variant` line included, since both edges the design needs are Tailwind's (below) — which is what makes "declared and applied nowhere" a thing a check can hold rather than a promise. `app/globals.css` imports it and reads none of it.

## The names

**A NAME IS THE WORD DESIGN SYSTEMS USE FOR THE KIND, AND THE DESIGN'S OWN WORD STAYS BESIDE IT.** The first names were the design's row names — Commitment, Nested, Face, Accent, Edge, Rule, Band, Wash, Field, Reading, Beside, Section, Margin, Pill, Mark, Group, Surface, Raised, Sticky — and, where a row was numbered, a word taken from its description. Both are this design's own vocabulary, which a reader who has not opened the design cannot read, so the names take the words design systems conventionally use: an ink is a `foreground` step (`default`, `muted`, `subtle`, `faint`), a line a `border` or a `divider`, a color `primary`, `danger` or `selected`, a state `hover`, `disabled` or `focus`, what lies behind a lifted surface an `overlay`, the surface itself a `popover`, a `drawer` or a `dialog`, type a `heading` or a `body`, and the phone's own set `mobile`. **Conversations with Design stay in the design's words**, so each declaration's comment carries its row's name and figure, and the table at the end of this file translates.

**SPACING IS NAMED FOR ITS ROLE.** Inside a thing is `inset`, a vertical space between things `stack`, a horizontal one `inline`, the page's edge `gutter` and the space within a cluster `gap` — so the 32 either side of a page is `--spacing-page-gutter` and a dialog's 24 all round `--spacing-dialog-inset`. Two roles the five do not cover take the words design systems use for them: `offset` for how far a surface sits from what opens it, and `bleed` for how far a face reaches past the text it sits under. A role on one side only takes `-x`, `-y`, `-top`, `-bottom` or `-right`.

**A STEP SUFFIX MARKS THE STEPS OF ONE KIND AND NOTHING ELSE.** The four control heights are `--height-control-lg`, `--height-control`, `--height-control-sm` and `--height-control-inline`; the headings take `-lg`, nothing and `-sm`; the body `-sm` and, on the phone, `-xs`. A color's steps are strengths rather than sizes, so a divider is `-subtle`, plain and `-strong`. **No name carries a digit, and the check fails one that does**: a digit is a scale step, and a scale is what the design declined to draw.

**A KEY TAILWIND OR THE APP ALREADY DECLARES IS NOT DECLARED AGAIN, AND THE CHECK FAILS ONE.** The conventional words are the ones most likely to be keys already — Tailwind's text, radius, shadow, container and blur steps, its palette and its two faces — and the materials screens read those keys today, `text-sm` alone at 344 sites, so declaring one would restyle those screens with nothing on them changing. The app has keys of its own: `app/globals.css` declares `--color-foreground` and `--color-background` from the template it started as, and 30 sites on the materials screens read them (`bg-foreground`, `text-background`). That is why the design's Ink is `--color-foreground-default`, its grounds `--color-background-muted` and `--color-background-translucent`, and its faces `--font-ui`, `--font-id` and `--font-brand` rather than anything beside `--font-sans` and `--font-mono`. **A mutation that declared `--color-foreground` again was caught by that assertion and by nothing else**: the app's later `@theme inline` wins the key, so no class the corpus holds reads the design's value and the judgment of who reads what sees nothing wrong.

**TAILWIND'S OWN NAME IS USED FOR A VALUE THAT BELONGS TO NO LADDER, AND A LADDER IS DECLARED WHOLE.** The three weights are Tailwind's `--font-weight-normal`, `--font-weight-medium` and `--font-weight-semibold`; the phone's edge is `--breakpoint-sm` and the rail's `--breakpoint-xl` (below); Sticky's blur is `--blur-sm`; and the Pill radius is Tailwind's full radius, which is `calc(infinity * 1px)` rather than 999 and draws the same corner on anything shorter than 1998px — the phone's own row calls it round. Each stands alone, so a name here would be a second name for one value. **A type size or a radius is a step of a ladder the design draws, and it stays declared even where it equals a default.** Reading is exactly `text-sm`'s value and Control `rounded-lg`'s, and reading those two through Tailwind would stand `text-sm` beside `--text-body-sm` and `rounded-lg` beside `--radius-card` — one ladder in two vocabularies, which a reader would take for two systems. So the check fails a key already declared and does not fail a value already held. **A weight a row names still rides on its size**: the large and small headings, the brand, and the phone's large and small headings carry theirs as a default, and a `font-*` utility overrides it.

**TWO NAMES WERE CHOSEN AGAINST A WORD THIS AXIS ALREADY SPENDS.** The phone's sheet is a `drawer`, since on this axis a sheet is the label sheet (`lib/toolLabelSheet.js`), and its foot bar is `bottom-bar`. `Label` is `--text-heading-sm`: a label is the sticker a tool item wears (`naming.md`), and the row's own uses are a column head and a block's name, which are headings.

**NO NAME BORROWS A TABLE'S WORD.** `Auth Tokens` is a table, so these are values and names and nothing here is a "token".

## A length is rem

**THE VALUES ARE REM, THE DESIGN'S PX OVER 16.** The design draws in px, and px is the design's unit; every other screen in this app is in rem, and so is Tailwind. A px length beside a rem one comes apart for a reader who has changed the browser's text size — a size in rem grows and one in px does not, so a 14 in rem passes a 13 in px — where with every length in rem the reader's setting moves them together, and it is respected. At the default 16px root nothing draws differently. **Line heights sit on the 0.25rem grid**, the design's 4 grid restated, and the check holds every rem to a whole number of the design's pixels, so a mistyped conversion fails rather than drawing a figure the design never had.

**WHAT STAYS PX IS WHAT IS DRAWN IN PX BY CONVENTION.** The 1.5px ring an open status is drawn with; every shadow, its offsets, its blurs and the Preview's 1px ring; and the scrollbar. Its 8px lane is the browser's own scrollbar, whose width follows no text size, so the 2px of clearance inside it follows the lane, and 0i's give-back has to match the gutter the browser reserves. A 1px line is Tailwind's own border width and is not declared here. The label's millimeters are the label's, in `lib/toolLabelSheet.js`, and nothing here touches them.

## The phone takes names of its own

The Tools file's 0a gives the values the phone screen takes in place of the web ones, and each is a separate name under `mobile-` rather than the web name with a second value. **A second value under one name cannot be right, because the two sets divide the elements differently**: the web's Reading covers an item row, a table row and any control, where the phone gives a log entry's event 16, what the entry says under it 14, a button 17, a field's value 16 and a pill's label 15; the web's Commitment is the phone's 50 in the foot bar, 48 in a dialog and 50 for a field. One name holds one value, so an override would draw some of those elements at another element's size, silently. The phone also has kinds the web has none of — the top bar, the foot bar, the touch target, the sheet — and only one tools screen is drawn in the phone frame at all, so an override at the edge would reach screens the design drew only at a desk. **Where a kind and its value are the same on both, the web name serves both**: 12 from a block's name to what it heads, the round corner of a pill, and every foreground, border, divider and wash.

**THE EDGE IS 40rem, AND IT IS THIS REPOSITORY'S DECISION RATHER THAN THE DESIGN'S.** The design draws the phone frame at 375 and the web frame at 1600 and never the edge between them. 40rem is 640px, above the widest iPhone held upright (430) and below the narrowest iPad (744), so the frame a scan opens on is the phone's and a site's laptop gets the web's; a phone turned on its side is wider than the edge and gets the web frame, which no drawing covers. **40rem is Tailwind's `--breakpoint-sm`**, so the edge is a key Tailwind already holds: a screen writes a phone name under its `max-sm` variant beside the web name, and nothing here declares it. The rail's own edge is `--breakpoint-xl`, 80rem, which is the design's 1280 window at the default text size: from there the expanded rail pushes the page, and below it covers the page as a Panel (0m).

## Who may read a name, and when that widens

**THE BOUNDARY IS WHO CALLS A FILE, NOT WHERE THE FILE SITS.** #460's rail is written where any screen could call it and only the tools layout does, so a rule about directories would refuse the one arrangement that issue settled. The check walks the import graph from every route file under `app/`: a file that only `app/(tools)/` route files reach may read a name, a file that any other route file reaches may not — wherever it lives, the root layout included — and a file no route file reaches reads nothing, since nothing renders it. So a component shared by both axes reads no name until #258, and a tools screen that needs one of those components' shapes draws its own; the tool item page's two dialogs, built on `MODAL_BACKDROP` and `MODAL_CARD`, are the case on this axis today.

**THE FIRST ISSUE TO READ A FACE LOADS IT.** A face read by a file the tools axis alone reaches needs its next/font call — `Instrument_Sans`, `Fragment_Mono` or `Fraunces`, with the `variable` the face resolves to — in a file the tools axis alone reaches, and the check fails a face read without one. Which issue that is follows from the table rather than from a plan: `Instrument_Sans` is #456's by it, `Fragment_Mono` #457's and `Fraunces` #460's. The design loads 400, 500 and 600 of the first, 400 of the second and 500 of the third at optical sizes 9 to 144. Whether the class sits above every element reading the face is a browser's to see.

**WHAT WIDENS IT IS #258, AND ONE COMMIT DOES ALL OF IT.** That issue gives the screens above the tools axis one layout in place of the width container each holds, which is what lets the root layout take what the tools layout applies — the ground, the foreground, the faces — and lets the check's boundary become every route file. CLAUDE.md's sentence, the check's boundary and this paragraph change in that commit. **The design's faces replace the two the root layout declares today**: `app/layout.js` loads Geist Sans and Geist Mono for every page and no element renders either, since `body` sets Arial and nothing reads the utilities that would set them.

## What is declared, and what waits

**WHAT IS DECLARED IS WHAT THE TOOLS DRAWINGS USE.** Each row of the spec was held against the tools screens as drawn — the lists, the tool item page at both widths, the four dialogs, the phone's sheets — and a row went in when one of them draws its kind. A row only the screens above this axis draw is declared by #258 with the first screen that reads it, which is this issue's own rule running on: a name arrives with its reader, and this issue is the one step that declares ahead of readers, bounded by the issues that read next. **The rows that wait**, each for the reason it is not on this axis: the one figure, the detail title and the block value (money, a mono id as a title, a figure titling its block), the glyph and the 11 of a calendar's weekday, the tracking of text set in capitals, the calendar date, the comparison line, the gutter mark, the inline marker and Wrong's red mark, the tab and its count, the Split dialog, the Paper shadow, the record rail, its blocks and the header's figure, the nested list, the blue and red edges (a blue-outlined control, the inline marker), the Badge radius (the spec gives it the PDF chip alone), the padding of a band of controls, and Ink 5. **Ink 5's one use in the spec is a bar standing in for a line of text**, and no tools drawing has one; its name is `--color-skeleton`, and the screen that first draws a stand-in bar declares it.

**AND THREE THINGS ARE NOT DECLARED ANYWHERE.** 0b's Page of rows is a paging figure a module reads, not a value a stylesheet does, and `tools.md` records why the two page sizes stay two constants; the spec states the figure for a list and not that the tools list and the document lists are one reader's page, which is the decision a fold needs. The drawing widths, 1600 and 375 × 812, are the canvas. White is Tailwind's own name, which the design uses as the word it is.

**EVERY NAME WAITS ON THE ISSUE THAT READS IT FIRST**, written in the check's table, and it was assigned from the bodies of #456 to #460 and #463 held against the drawings: the dialog frame, its controls and the colors they use are #456's, since its registration dialog is the frame the other three follow; the label sheet's cells and the Preview are #457's; the phone's sheets and foot bar are #458's; the rail, the breadcrumb, the tooltip and the scroll are #460's; the lists, the tool item page and the phone's top bar and history are #463's. #459 reads no name first. **A wrong assignment corrects itself at the next landing**: an issue reading a name marked for a later one fails until it takes the mark out, and an issue that lands takes its number out of the list, after which every name still marked for it fails until it is read or undeclared.

## Design's answers, and where the HTML this was read from is behind (2026-09-29)

The values were read from Claude Design's `Tools - new direction` and `Invoices - new direction` files and their `support.js`, rendered in a browser. Four places in them disagreed with each other or with the app, Design answered each, and **the files were not sent again, so in the first three they are behind the answer.** A later reading of the same files must take these over what the files say.

1. **A phone field's value is 16.** Design moved `a field's value` from the Tools file's 0a Bar row (17) to its Event row (16). The field reads `--text-mobile-body` and has no name of its own. The file still lists it under Bar; its rendered field was already 16.
2. **Every disabled glyph is Ink 4.** Design widened 0e's Ink 4 row with `a disabled control's glyph` and took that item out of Ink 5, whose one remaining use is a bar standing in for a line of text — which is why Ink 4 is `--color-foreground-faint`, a word that covers the separators and the disabled glyphs alike, and Ink 5 waits under `--color-skeleton`. The file still lists the glyph under Ink 5.
3. **The selection bar reads `3 selected · 3 not on this page`.** The second clause appears only while other pages hold a selection, an Ink 4 middle dot parts the two, and the second is set at 400 in Ink 3; the page box's name is `Select this page`. Design put both rules on 0b's Page of rows row. The file's 1b draws the bar without them. They are words and their application, so no name changed for them and nothing in this issue says them; the issue that restyles a tool's page does.
4. **The tool item page's 336 column is right as drawn.** The page is not 0n's record page but a layout that holds the label in a 336 column inside the 1080 content, so 0n's record rail waits for #258 and the 336 is named by #463 with the screen. The file is not behind here. The page does take 0n's header — 14 under the breadcrumb bar, 24 above and below its rule, 10 and 12 down the stack, 12 from a block's name — measured on the drawing, so those five names are #463's.

## What the drawings carry that the spec does not state

Each is for the issue that draws it to name, in the same commit as its reader, since a name given now for a value no row states would be a guess at its kind.

- A row's checkbox is 16 — the mark a 32 box holds, `--size-icon` — with a radius of 4 and, at rest, an edge at Ink 5's value; the spec gives a checkbox neither.
- The Retired mark is a ring with a slash through it; 0g draws an open and a settled mark and no third.
- The tool item page's label column is 336 inside the 1080 content (answer 4).
- The label sheet's cells are 26 × 29 at the Mark radius, an inset ring at the ink's 12% and 14%, and a used position filled at Hover — #457's.
- The web history's entries hang from a 5 dot at Ink 4 on a 1px Rule, the text 26 from the dot's left edge.
- The dot between clauses in the tool item page's header and history takes 9 either side, where the spec says 8 for a dialog's record line and the breadcrumb.
- The sticker in the tool item page's label block sits at a radius of 4 on a ring and a shadow at the shadow ink's 8%.

**AND ONE PLACE WHERE A DRAWING CONTRADICTS THE SPEC.** The name sheet's `Done` is 44 tall, where the phone's Target is the least a touch target takes, 48. The name is the spec's; the issue that draws the sheet meets the difference, and it is Design's to settle.

## The label's code, which no issue takes yet

The design sets the code on a tool label in Inconsolata at 500 with −0.04em of tracking, and the label prints it at the face's default weight with none. `CHARACTER_WIDTH_RATIO` was measured in the second, so taking the first reopens that measurement and the label's width budget with it (`tools.md`, `The code under the symbol`). It is printed rather than drawn on a screen, so neither #463, whose subject is the screens, nor #457, which prints what was printed before, covers it, and no name here is for it. Where it goes is not decided.

## From the design's words to the names

Every declaration, by the design's row and the figure the design draws, and after them the values read under Tailwind's own names. A length's rem is the design's px over 16, and the px is given beside it.

| The design's row | Name | Value |
|---|---|---|
| 0a Commitment | `--height-control-lg` | 2.25rem (36) |
| 0a Control | `--height-control` | 2rem (32) |
| 0a Nested | `--height-control-sm` | 1.875rem (30) |
| 0a Inline | `--height-control-inline` | 1.625rem (26) |
| 0a Icon box, 28 (0l's close) | `--height-dialog-close` | 1.75rem (28) |
| 0a Icon box, 16 in a 32 | `--size-icon` | 1rem (16) |
| 0a Icon box, 14 in a 28 | `--size-icon-sm` | 0.875rem (14) |
| 0a Side room, an inline summary | `--spacing-control-inline-inset-x` | 0.5rem (8) |
| 0a Side room, a chip or a menu option | `--spacing-control-inset-x` | 0.625rem (10) |
| 0a Side room, any 36px button | `--spacing-control-lg-inset-x` | 1rem (16) |
| 0a Menu, from | `--min-width-menu` | 8.75rem (140) |
| 0a Menu, to | `--max-width-menu` | 17.5rem (280) |
| 0a Menu, under the control | `--spacing-menu-offset` | 0.375rem (6) |
| 0a Menu, inside | `--spacing-menu-inset` | 0.3125rem (5) |
| 0b Content | `--container-content` | 67.5rem (1080) |
| 0b Margin | `--spacing-page-gutter` | 2rem (32) |
| 0b Gap, within a cluster | `--spacing-gap` | 0.5rem (8) |
| 0b Gap, between clusters | `--spacing-gap-lg` | 0.875rem (14) |
| 0b Gap, in a nav row | `--spacing-nav-gap` | 0.6875rem (11) |
| 0b Band padding, above a band of type | `--spacing-list-header-inset-top` | 1.25rem (20) |
| 0b Row | `--height-table-row` | 2.5rem (40) |
| 0b Row, past the text | `--spacing-table-bleed` | 0.75rem (12) |
| 0b Column head | `--height-table-header` | 2.25rem (36) |
| 0b Selection bar, above the pager | `--spacing-selection-bar-offset` | 0.75rem (12) |
| 0b Selection bar, inside | `--spacing-selection-bar-inset` | 0.5rem (8) |
| 0b Selection bar, rises | `--spacing-selection-bar-slide` | 0.5rem (8) |
| 0b Selection bar, fades in | `--transition-duration-selection-bar` | 160ms |
| 0c Face | `--color-selected` | #F0F9FF |
| 0c Face hover | `--color-selected-hover` | #E6F5FF |
| 0c Accent | `--color-primary` | oklch(0.487 0.216 257) |
| 0c Accent hover | `--color-primary-hover` | oklch(0.437 0.211 257) |
| 0f Disabled | `--color-primary-disabled` | the Accent at 40% |
| 0d Face | `--color-danger-subtle` | #FFF4F5 |
| 0d Accent | `--color-danger` | #DC0015 |
| 0d Accent hover | `--color-danger-hover` | oklch(0.512 0.205 27) |
| 0e Ink | `--color-foreground-default` | oklch(0.255 0.013 265) |
| 0e Ink 2 | `--color-foreground-muted` | oklch(0.405 0.013 265) |
| 0e Ink 3 | `--color-foreground-subtle` | oklch(0.505 0.012 265) |
| 0e Ink 4 | `--color-foreground-faint` | oklch(0.760 0.010 265) |
| 0e Inner rule | `--color-divider-subtle` | oklch(0.946 0.005 265) |
| 0e Rule | `--color-divider` | oklch(0.928 0.006 265) |
| 0e Band | `--color-divider-strong` | oklch(0.896 0.007 265) |
| 0e Edge | `--color-border` | oklch(0.888 0.008 265) |
| 0e Edge focus | `--color-border-focus` | oklch(0.640 0.010 265) |
| 0e Wash | `--color-hover-subtle` | Ink at 3% |
| 0e Field | `--color-background-muted` | Ink at 4.5% |
| 0e Hover | `--color-hover` | Ink at 5.5% |
| 0i Bar, the thumb | `--color-scrollbar-thumb` | Ink at 20% |
| 0e Thumb hover | `--color-scrollbar-thumb-hover` | Ink at 34% |
| 0f Field, a number field | `--width-number-input` | 7.5rem (120) |
| 0f Field, its steps from its ends | `--spacing-stepper-inset` | 0.1875rem (3) |
| 0g the mark | `--size-status-indicator` | 0.5625rem (9) |
| 0g the ring | `--stroke-width-status-ring` | 1.5px |
| 0h Page title | `--text-heading-lg` | 1.5rem at 2rem, −0.012em, 600 (24 at 32) |
| 0h Section | `--text-heading` | 1rem at 1.5rem (16 at 24) |
| 0h Reading | `--text-body` | 0.875rem at 1.25rem (14 at 20) |
| 0h Beside | `--text-body-sm` | 0.8125rem at 1.25rem (13 at 20) |
| 0h Label | `--text-heading-sm` | 0.75rem at 1rem, 600 (12 at 16) |
| 0h Wordmark | `--text-brand` | 1.0625rem at 1.5rem, 500 (17 at 24) |
| 0h Tracking, a mono id under 21px | `--tracking-id` | −0.02em |
| 0h Instrument Sans | `--font-ui` | Instrument Sans |
| 0h Fragment Mono | `--font-id` | Fragment Mono |
| 0h Fraunces | `--font-brand` | Fraunces |
| 0i Bar, the lane | `--spacing-scrollbar` | 8px |
| 0i Bar, the clearance | `--spacing-scrollbar-inset` | 2px |
| 0i End | `--spacing-scroll-inset-bottom` | 2.5rem (40) |
| 0j Mark | `--radius-preview` | 0.125rem (2) |
| 0j Control | `--radius-control` | 0.5rem (8) |
| 0j Group | `--radius-card` | 0.625rem (10) |
| 0j Surface | `--radius-dialog` | 0.75rem (12) |
| 0k Shadow ink | `--color-elevation` | oklch(0.22 0.025 265) |
| 0k Sticky | `--color-background-translucent` | oklch(1 0 0 / 0.82) |
| 0k Wash, behind a Modal | `--color-dialog-overlay` | the shadow ink at 40% |
| 0k Wash, behind a Panel | `--color-drawer-overlay` | the shadow ink at 10% |
| 0k Raised | `--shadow-popover` | 0 8px 24px at 10% over 0 1px 2px at 6% |
| 0k Panel | `--shadow-drawer` | 0 12px 48px at 16% |
| 0k Modal | `--shadow-dialog` | 0 24px 60px at 24% |
| 0k Preview | `--shadow-preview` | a 1px ring at 6% over 0 2px 8px at 8% |
| 0k Tooltip, inside above | `--spacing-tooltip-inset-top` | 0.1875rem (3) |
| 0k Tooltip, either side | `--spacing-tooltip-inset-x` | 0.5625rem (9) |
| 0k Tooltip, below | `--spacing-tooltip-inset-bottom` | 0.25rem (4) |
| 0k Tooltip, above its target | `--spacing-tooltip-offset` | 0.375rem (6) |
| 0k Tooltip, beside a rail icon | `--spacing-tooltip-rail-offset` | 0.625rem (10) |
| 0k Tooltip, its delay | `--transition-delay-tooltip` | 360ms |
| 0l Width | `--container-dialog` | 26.25rem (420) |
| 0l Position | `--spacing-dialog-gutter` | 1.75rem (28) |
| 0l Compact, all round | `--spacing-dialog-inset` | 1.5rem (24) |
| 0l Compact, the title to the body | `--spacing-dialog-header-stack` | 1.25rem (20) |
| 0l Compact, two fields in a row | `--spacing-dialog-inline` | 0.75rem (12) |
| 0l Head, the close pulled out | `--spacing-dialog-close-offset` | 0.25rem (4) |
| 0m Rail, collapsed | `--width-rail` | 3.5rem (56) |
| 0m Rail, expanded | `--width-rail-expanded` | 15.5rem (248) |
| 0m Rail, inside | `--spacing-rail-inset` | 0.75rem (12) |
| 0m Rail, widens over | `--transition-duration-rail` | 200ms |
| 0m Rail, widens on | `--ease-rail` | cubic-bezier(0.2, 0, 0, 1) |
| 0m Account | `--height-account` | 3rem (48) |
| 0m Account, the avatar | `--size-avatar` | 1.5rem (24) |
| 0m Breadcrumb | `--height-breadcrumb` | 3rem (48) |
| 0n Record header, around its rule | `--spacing-page-header-stack` | 1.5rem (24) |
| 0n Record header, under the breadcrumb bar | `--spacing-breadcrumb-stack` | 0.875rem (14) |
| 0n Header stack, from the title | `--spacing-title-stack` | 0.625rem (10) |
| 0n Header stack, to the status | `--spacing-subtitle-stack` | 0.75rem (12) |
| 0n Rail blocks, from a block's name | `--spacing-heading-sm-stack` | 0.75rem (12) |
| Tools 0a Screen, either side | `--spacing-mobile-gutter` | 1rem (16) |
| Tools 0a Top bar | `--height-mobile-top-bar` | 3.5rem (56) |
| Tools 0a Top bar, right | `--spacing-mobile-top-bar-inset-right` | 0.25rem (4) |
| Tools 0a Top bar, the mark | `--size-mobile-top-bar-icon` | 1.5rem (24) |
| Tools 0a Foot bar, above | `--spacing-mobile-bottom-bar-inset-top` | 1rem (16) |
| Tools 0a Foot bar, below | `--spacing-mobile-bottom-bar-inset-bottom` | 1.25rem (20) |
| Tools 0a Foot bar, between its rows | `--spacing-mobile-bottom-bar-stack` | 0.75rem (12) |
| Tools 0a Foot bar, cast upward | `--shadow-mobile-bottom-bar` | 0 −1px 12px at 6% |
| Tools 0a Target | `--spacing-mobile-touch-target` | 3rem (48) |
| Tools 0a Title | `--text-mobile-heading-lg` | 1.375rem at 1.75rem, −0.012em, 600 (22 at 28) |
| Tools 0a Bar | `--text-mobile-heading` | 1.0625rem at 1.5rem (17 at 24) |
| Tools 0a Event | `--text-mobile-body` | 1rem at 1.5rem (16 at 24) |
| Tools 0a Beside | `--text-mobile-body-sm` | 0.9375rem at 1.25rem (15 at 20) |
| Tools 0a Log detail | `--text-mobile-body-xs` | 0.875rem at 1.25rem (14 at 20) |
| Tools 0a Block name | `--text-mobile-heading-sm` | 0.8125rem at 1.25rem, 600 (13 at 20) |
| Tools 0a Button, in the foot bar | `--height-mobile-button` | 3.125rem (50) |
| Tools 0a Button, in a dialog | `--height-mobile-dialog-button` | 3rem (48) |
| Tools 0a Field | `--height-mobile-input` | 3.125rem (50) |
| Tools 0a Field, inside | `--spacing-mobile-input-inset-x` | 1rem (16) |
| Tools 0a Field, its icon | `--size-mobile-input-icon` | 1.125rem (18) |
| Tools 0a Field, its icon to its value | `--spacing-mobile-input-gap` | 0.625rem (10) |
| Tools 0a Field, a text button pressed | `--opacity-mobile-pressed` | 50% |
| Tools 0a Pill | `--height-mobile-chip` | 2.25rem (36) |
| Tools 0a Pill, either side | `--spacing-mobile-chip-inset-x` | 0.875rem (14) |
| Tools 0a Pill, its chevron side | `--spacing-mobile-chip-inset-right` | 0.75rem (12) |
| Tools 0a Status, the mark | `--size-mobile-status-indicator` | 0.625rem (10) |
| Tools 0a Radius, a control and a dialog | `--radius-mobile-control` | 0.75rem (12) |
| Tools 0a Radius, a sheet's top corners | `--radius-mobile-drawer` | 1.75rem (28) |
| Tools 0a Title block, under the top bar | `--spacing-mobile-top-bar-stack` | 1rem (16) |
| Tools 0a Title block, below | `--spacing-mobile-title-stack` | 1.375rem (22) |
| Tools 0a Section | `--spacing-mobile-stack` | 2rem (32) |
| Tools 0a Log, the dot | `--size-mobile-log-dot` | 0.375rem (6) |
| Tools 0a Log, beside the dot | `--spacing-mobile-log-gap` | 0.75rem (12) |
| Tools 0a Log, between entries | `--spacing-mobile-log-stack` | 1.25rem (20) |
| Tools 0a Log, the icon | `--size-mobile-log-icon` | 0.875rem (14) |
| Tools 0a Sheet, the handle's width | `--width-mobile-drawer-handle` | 2.25rem (36) |
| Tools 0a Sheet, the handle's height | `--height-mobile-drawer-handle` | 0.25rem (4) |
| Tools 0a Sheet, the handle from the top | `--spacing-mobile-drawer-inset-top` | 0.75rem (12) |
| Tools 0a Sheet, around the title | `--spacing-mobile-drawer-title-inset-y` | 0.875rem (14) |
| Tools 0a Sheet, a row | `--height-mobile-drawer-row` | 3.5rem (56) |
| Tools 0a Sheet, inside a row, above and below | `--spacing-mobile-drawer-row-inset-y` | 0.9375rem (15) |
| Tools 0a Sheet, inside a row, either side | `--spacing-mobile-drawer-row-inset-x` | 1rem (16) |
| Tools 0a Sheet, at the foot | `--spacing-mobile-drawer-inset-bottom` | 1.25rem (20) |
| Tools 0a Sheet, cast upward | `--shadow-mobile-drawer` | 0 −12px 48px at 16% |
| Tools 0a Sheet, behind it | `--color-mobile-drawer-overlay` | the shadow ink at 24% |
| Tools 0a Sheet that confirms, its title | `--spacing-mobile-confirm-inset-top` | 1.5rem (24) |
| Tools 0a Sheet that confirms, its id | `--spacing-mobile-confirm-title-stack` | 0.25rem (4) |
| Tools 0a Sheet that confirms, the sentence | `--spacing-mobile-confirm-id-stack` | 0.875rem (14) |
| Tools 0a Sheet that confirms, the actions | `--spacing-mobile-confirm-description-stack` | 1.25rem (20) |
| Tools 0a Sheet that confirms, between actions | `--spacing-mobile-confirm-action-stack` | 0.75rem (12) |
| Tools 0a Menu | `--width-mobile-menu` | 14.5rem (232) |
| Tools 0a Menu, from the right edge | `--spacing-mobile-menu-gutter` | 0.75rem (12) |
| Tools 0a Menu, under the top bar | `--spacing-mobile-menu-offset` | 0.25rem (4) |
| Tools 0a Menu, inside a row | `--spacing-mobile-menu-row-inset-x` | 1rem (16) |
| 0h 400, the page | `--font-weight-normal`, Tailwind's | 400 |
| 0h 500, what you choose from | `--font-weight-medium`, Tailwind's | 500 |
| 0h 600, what titles or acts | `--font-weight-semibold`, Tailwind's | 600 |
| The phone frame's edge | `--breakpoint-sm`, Tailwind's | 40rem |
| 0m Rail, from a 1280 window | `--breakpoint-xl`, Tailwind's | 80rem |
| 0k Sticky, its blur | `--blur-sm`, Tailwind's | 8px |
| 0j Pill, and Tools 0a's round | Tailwind's full radius | calc(infinity * 1px) |
| 0e Ink 5 | `--color-skeleton`, not declared yet | oklch(0.800 0.010 265) |
