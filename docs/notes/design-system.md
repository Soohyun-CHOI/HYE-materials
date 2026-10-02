# Design system — the reasoning

Governs `app/designValues.css` and `app/globals.css`. **Read this before editing there** — CLAUDE.md carries only the rules that bind code outside this area; the derivation, the evidence and the alternatives weighed are here.

What the tools axis owes these names is in `tools.md`, and how the check reads a class is in the header of `offline/design-values.mjs`. **Write a name here as its variable, never as a utility class**: Tailwind scans this file for class names, and a class spelled in it is built into every page's stylesheet.

## The design's values, declared once (#462)

`app/designValues.css` declares the values the design settled for the tools screens, each under a conventional name and in rem, and `app/globals.css` imports it right after Tailwind so every page's stylesheet carries them. **The registration dialog is the first reader (#456)**: its frame, its controls and the lists they open read 44 of the names, the two it added included. The issues that apply the rest come next — #457 to #459 open the other three dialogs the design drew for the tools screens, #460 draws the rail and #463 gives the screens the rest of the look — and until #258 a name is read only by a file the tools axis alone calls, or since #473 the sign-in steps.

**TAILWIND 4 HAS NO CONFIGURATION FILE TO WEIGH AGAINST, SO THE CHOICE WAS THE NAMESPACE.** `@theme` is the configuration and it is CSS: every name it declares is a custom property and a utility at once, so "Tailwind configuration or CSS variables" is not a choice this version offers. What was chosen is to put the names inside Tailwind's namespaces rather than in a plain `:root` block. Every screen in this app styles with utilities, so a name a screen reads has to be one — a plain variable would be read through the arbitrary-value syntax at every site. Measured on 4.3.2 before anything was written: a `--height-*` name is readable as a height and as nothing else, so a control height cannot become somebody's padding; a `--text-*` name carries its `--line-height`, tracking and weight in the one utility, which is the design's "every size carries its own line height, declared wherever a size is" made into a structure; a `@theme` block in an imported file works.

**`@theme` AND NOT `@theme inline`, FOR THE APPEARANCE #218 DEFERRED.** A plain block makes each utility read `var(--name)`, so a second set of values later is values behind names that already exist — #218's own description of the version worth building — where an inline block would bake each value into its utility. **The three faces are the exception and have to be**: a face is the variable its next/font call sets, that call's class sits on an element below `:root`, and a `:root` variable referring to it would resolve before the class exists. So the faces are the one inline block, and each utility carries the face's variable to the element that reads it.

**WHAT THE BUILD EMITS IS NOT A SIGNAL OF WHAT IS READ, AND THAT WAS MEASURED BEFORE THE CHECK WAS DESIGNED.** Tailwind leaves a theme variable out of the stylesheet until something uses it, and it counts a variable as used as soon as its name appears in any file it scans — a markdown sentence citing one was enough. So "is this name read" cannot be read off the build, and the check decides it from the source instead. **The consequence was measured by compiling the stylesheet of the base commit's tree and of this branch's, each scanning its own tree and in a process of its own** — the PostCSS plugin caches a compiler per input path, so one process compiling both reports no difference at all, and one tree scanned for both hides whatever the new files' prose adds. The check names every variable, so every declared variable reaches every page's `:root` from this commit rather than from the one that first reads it, and so do seven of Tailwind's and the app's own that this file and the check name — the two breakpoints, the blur, and the app's two faces and two colors: 8,902 bytes minified, 1,698 gzipped, which is what the stylesheet carries anyway once the tools screens read them all.

**AND NO RULE COMES WITH THEM, WHICH THE FIRST NAMES COULD NOT SAY.** Tailwind reads a class out of any file it scans, prose and SVG included, so a name can be read by a word that was never a class. The first set of names had a color called `rule`, and `public/`'s create-next-app SVGs carry `fill-rule="evenodd"`, so Tailwind built `.fill-rule` into every page. Every candidate the scanner finds in the repository was handed to Tailwind with the conventional names declared, and none reads one; a color called `shadow` would have repeated the shape, since `text-shadow` is a CSS property prose cites, which is why the shadow ink is `--color-elevation`. **The scanner does not read `.css` files** — measured by planting one of each type in a folder — so the declaration's comments may say anything, and this file, which it does read, writes every name as its variable.

**A RUNNING DEV SERVER DID NOT SEE AN EDIT TO THIS FILE, AND THAT WAS MEASURED ON #460.** With Next 16.2.10's Turbopack serving the tools screens, `app/designValues.css` was edited and the stylesheet the server handed out stayed the one compiled before it — none of the edit's names or classes in it — while a standalone PostCSS compile of the same tree carried every one. Saving `app/globals.css`, which imports this file, made the server rebuild with the edit, and the edit held after `globals.css` was put back. So after an edit here, save `globals.css` or restart the server before reading a page: a page that looks unstyled may be a stale stylesheet rather than a wrong name.

**A DECLARATION FILE HOLDS NOTHING THAT SELECTS AN ELEMENT.** A rule in it would style every page, the ones above the tools axis included, and those each hold a width container of their own that a global rule would fight. The file is `@theme` blocks and comments, and the check fails anything else — a `@custom-variant` line included, since both edges the design needs are Tailwind's (below) — which is what makes "declared and applied nowhere" a thing a check can hold rather than a promise. **The one other thing a block holds is the keyframes an animation it declares runs (#473)**: `@keyframes` selects nothing, and inside `@theme` Tailwind emits it only once the animation is read, so the caret's blink costs a page nothing until a page draws the caret. The check fails a keyframes block no declared animation runs, and an animation running keyframes that are neither declared here nor Tailwind's own, which is how the spinner turns on Tailwind's `spin`. `app/globals.css` imports it and reads none of it.

## The names

**A NAME IS THE WORD DESIGN SYSTEMS USE FOR THE KIND, AND THE DESIGN'S OWN WORD STAYS BESIDE IT.** The first names were the design's row names — Commitment, Nested, Face, Accent, Edge, Rule, Band, Wash, Field, Reading, Beside, Section, Margin, Pill, Mark, Group, Surface, Raised, Sticky — and, where a row was numbered, a word taken from its description. Both are this design's own vocabulary, which a reader who has not opened the design cannot read, so the names take the words design systems conventionally use: an ink is a `foreground` step (`default`, `muted`, `subtle`, `faint`), a line a `border` or a `divider`, a color `primary`, `danger` or `selected`, a state `hover`, `disabled` or `focus`, what lies behind a lifted surface an `overlay`, the surface itself a `popover`, a `drawer` or a `dialog`, type a `heading` or a `body`, and the phone's own set `mobile`. **Conversations with Design stay in the design's words**, so each declaration's comment carries its row's name and figure, and the table at the end of this file translates.

**SPACING IS NAMED FOR ITS ROLE.** Inside a thing is `inset`, a vertical space between things `stack`, a horizontal one `inline`, the page's edge `gutter` and the space within a cluster `gap` — so the 32 either side of a page is `--spacing-page-gutter` and a dialog's 24 all round `--spacing-dialog-inset`. Two roles the five do not cover take the words design systems use for them: `offset` for how far a surface sits from what opens it, and `bleed` for how far a face reaches past the text it sits under. A role on one side only takes `-x`, `-y`, `-top`, `-bottom` or `-right`.

**A STEP SUFFIX MARKS THE STEPS OF ONE KIND AND NOTHING ELSE.** The four control heights are `--height-control-lg`, `--height-control`, `--height-control-sm` and `--height-control-inline`; the headings take `-lg`, nothing and `-sm`; the body `-sm` and, on the phone, `-xs`. A color's steps are strengths rather than sizes, so a divider is `-subtle`, plain and `-strong`. **No name carries a digit, and the check fails one that does**: a digit is a scale step, and a scale is what the design declined to draw.

**A KEY TAILWIND OR THE APP ALREADY DECLARES IS NOT DECLARED AGAIN, AND THE CHECK FAILS ONE.** The conventional words are the ones most likely to be keys already — Tailwind's text, radius, shadow, container and blur steps, its palette and its two faces — and the materials screens read those keys today, `text-sm` alone at 344 sites, so declaring one would restyle those screens with nothing on them changing. The app has keys of its own: `app/globals.css` declares `--color-foreground` and `--color-background` from the template it started as, and 30 sites on the materials screens read them (`bg-foreground`, `text-background`). That is why the design's Ink is `--color-foreground-default`, its grounds `--color-background-muted` and `--color-background-translucent`, and its faces `--font-ui`, `--font-id` and `--font-brand` rather than anything beside `--font-sans` and `--font-mono`. **A mutation that declared `--color-foreground` again was caught by that assertion and by nothing else**: the app's later `@theme inline` wins the key, so no class the corpus holds reads the design's value and the judgment of who reads what sees nothing wrong.

**TAILWIND'S OWN NAME IS USED FOR A VALUE THAT BELONGS TO NO LADDER, AND A LADDER IS DECLARED WHOLE.** The three weights are Tailwind's `--font-weight-normal`, `--font-weight-medium` and `--font-weight-semibold`, and the wordmark's `HYE` at 700 is its `--font-weight-bold`; the phone's edge is `--breakpoint-sm` and the rail's `--breakpoint-xl` (below); Sticky's blur is `--blur-sm`; and the Pill radius is Tailwind's full radius, which is `calc(infinity * 1px)` rather than 999 and draws the same corner on anything shorter than 1998px — the phone's own row calls it round. Each stands alone, so a name here would be a second name for one value. **A type size or a radius is a step of a ladder the design draws, and it stays declared even where it equals a default.** Reading is exactly `text-sm`'s value and Control `rounded-lg`'s, and reading those two through Tailwind would stand `text-sm` beside `--text-body-sm` and `rounded-lg` beside `--radius-card` — one ladder in two vocabularies, which a reader would take for two systems. So the check fails a key already declared and does not fail a value already held. **A weight a row names still rides on its size**: the large and small headings, the brand, and the phone's large and small headings carry theirs as a default, and a `font-*` utility overrides it.

**TWO NAMES WERE CHOSEN AGAINST A WORD THIS AXIS ALREADY SPENDS.** The phone's sheet is a `drawer`, since on this axis a sheet was the label sheet when the names were chosen (`lib/toolLabelSheet.js`, until #467), and its foot bar is `bottom-bar`. `Label` is `--text-heading-sm`: a label is the sticker a tool item wears (`naming.md`), and the row's own uses are a column head and a block's name, which are headings.

**NO NAME BORROWS A TABLE'S WORD.** `Auth Tokens` is a table, so these are values and names and nothing here is a "token".

## A length is rem

**THE VALUES ARE REM, THE DESIGN'S PX OVER 16.** The design draws in px, and px is the design's unit; every other screen in this app is in rem, and so is Tailwind. A px length beside a rem one comes apart for a reader who has changed the browser's text size — a size in rem grows and one in px does not, so a 14 in rem passes a 13 in px — where with every length in rem the reader's setting moves them together, and it is respected. At the default 16px root nothing draws differently. **Line heights sit on the 0.25rem grid**, the design's 4 grid restated, and the check holds every rem to a whole number of the design's pixels, so a mistyped conversion fails rather than drawing a figure the design never had.

**WHAT STAYS PX IS WHAT IS DRAWN IN PX BY CONVENTION.** The 1.5px ring an open status is drawn with; every shadow, its offsets, its blurs and the Preview's 1px ring; and the scrollbar. Its 8px lane is the browser's own scrollbar, whose width follows no text size, so the 2px of clearance inside it follows the lane, and 0i's give-back has to match the gutter the browser reserves. A 1px line is Tailwind's own border width and is not declared here. The label's millimeters are the label's, in `lib/toolLabelPage.js`, and nothing here touches them.

## The phone takes names of its own

The Tools file's 0a gives the values the phone screen takes in place of the web ones, and each is a separate name under `mobile-` rather than the web name with a second value. **A second value under one name cannot be right, because the two sets divide the elements differently**: the web's Reading covers an item row, a table row and any control, where the phone gives a log entry's event 16, what the entry says under it 14, a button 17, a field's value 16 and a pill's label 15; the web's Commitment is the phone's 50 in the foot bar, 48 in a dialog and 50 for a field. One name holds one value, so an override would draw some of those elements at another element's size, silently. The phone also has kinds the web has none of — the top bar, the foot bar, the touch target, the sheet — and only one tools screen is drawn in the phone frame at all, so an override at the edge would reach screens the design drew only at a desk. **Where a kind and its value are the same on both, the web name serves both**: 12 from a block's name to what it heads, the round corner of a pill, and every foreground, border, divider and wash.

**THE EDGE IS 40rem, AND IT IS THIS REPOSITORY'S DECISION RATHER THAN THE DESIGN'S.** The design draws the phone frame at 375 and the web frame at 1600 and never the edge between them. 40rem is 640px, above the widest iPhone held upright (430) and below the narrowest iPad (744), so the frame a scan opens on is the phone's and a site's laptop gets the web's; a phone turned on its side is wider than the edge and gets the web frame, which no drawing covers. **40rem is Tailwind's `--breakpoint-sm`**, so the edge is a key Tailwind already holds: a screen writes a phone name under its `max-sm` variant beside the web name, and nothing here declares it. The rail's own edge is `--breakpoint-xl`, 80rem, which is the design's 1280 window at the default text size: from there the expanded rail pushes the page, and below it covers the page as a Panel (0m).

## Who may read a name, and when that widens

**THE BOUNDARY IS WHO CALLS A FILE, NOT WHERE THE FILE SITS.** #460's rail is written where any screen could call it and only the tools layout does, so a rule about directories would refuse the one arrangement that issue settled. The check walks the import graph from every route file under `app/`: a file that only the route files of the screens the design is applied to reach may read a name — `app/(tools)/`'s, and since #473 `app/login/`'s — a file that any other route file reaches may not, wherever it lives, the root layout included, and a file no route file reaches reads nothing, since nothing renders it. So a component shared with the screens above those reads no name until #258, and a tools screen that needs one of those components' shapes draws its own; the tool item page's two dialogs, built on `MODAL_BACKDROP` and `MODAL_CARD`, were the case on this axis until #458 moved them onto the frame #456 built. **That frame and its controls are the rail's arrangement again**: `app/components/DialogFrame.js`, `Controls.js` and `Menu.js` sit beside the components both axes share, since #463 draws the screens' own buttons and fields with the same controls, and only the tools axis calls them.

**THE FIRST ISSUE TO READ A FACE LOADS IT.** A face read by a file the tools axis alone reaches needs its next/font call — `Instrument_Sans`, `Fragment_Mono` or `Bricolage_Grotesque`, with the `variable` the face resolves to — in a file the tools axis alone reaches, and the check fails a face read without one. Which issue that is follows from the table rather than from a plan: `Instrument_Sans` is #456's by it, `Fragment_Mono` #457's and the wordmark's face #460's. **The second was #459's in the event**: the landing notice's ids read `--font-id` before #457 came to it, so #459 loaded it. **The third changed before it loaded**: the files of 2026-10-01 set the wordmark in Bricolage Grotesque where earlier files set it in Fraunces, and #460 loaded Bricolage. The design loads 400, 500 and 600 of the first, 400 of the second, and 500 and 700 of the third at optical sizes 12 to 96 — #460 loads the third's variable face, whose weight axis holds both, with its optical-size axis. **#456 loaded the first in `app/(tools)/layout.js`**: a face is a variable its call's class sets, the layout's one element is above every tools page, and #459's and #460's calls went beside it with their classes on the same element, rather than in the file that first reads each. **#473 moved the three calls into `app/faces/`, a module a face, when the sign-in steps' layout came to draw two of them.** next/font preloads a face on every route under the file that imports its call, so one module holding all three would have had `/login` preload Fragment Mono, which no sign-in step sets, and a second set of calls in the sign-in layout would have written each face's options twice. Each layout imports the faces it draws and sets their classes on its one element — the tools layout all three, the sign-in layout Instrument Sans and Bricolage Grotesque — and `/login` was read preloading those two and Geist's two, the root layout's, and no Fragment Mono. The check holds that a face read on a design axis has its call in a module only those axes reach. A dialog, a list or a tooltip in the top layer is still a descendant of that element, so the face reaches them — read in a browser on the registration dialog, both its lists and the rail's tooltip. Until #463 only what reads `--font-ui` draws in the face — the registration dialog, the rail and the breadcrumb — and the screens beside them keep today's, which is the plan rather than a defect.

**#473 WIDENED IT TO THE SIGN-IN STEPS, ON A CONDITION THAT STILL HOLDS FOR THEM.** The three steps are drawn whole and have a layout of their own — the column, the wordmark and the faces are `app/login/layout.js`'s — and no file their route files reach is reached by a materials screen's, so a name read there styles nothing else; the check lists the two directories as the design's axes and walks the graph from both. A component a sign-in step and a materials screen came to share would read no name, as on the tools axis.

**WHAT WIDENS IT TO EVERYTHING IS #258, AND ONE COMMIT DOES ALL OF IT.** That issue gives the screens above the tools axis one layout in place of the width container each holds, which is what lets the root layout take what the tools layout and the sign-in layout apply — the ground, the foreground, the faces, which it imports from `app/faces/` onto its own element while the two layouts stop — and lets the check's boundary become every route file. CLAUDE.md's sentence, the check's boundary and this paragraph change in that commit. **The design's faces replace the two the root layout declares today**: `app/layout.js` loads Geist Sans and Geist Mono for every page and no element renders either, since `body` sets Arial and nothing reads the utilities that would set them.

## What is declared, and what waits

**WHAT IS DECLARED IS WHAT THE TOOLS DRAWINGS USE.** Each row of the spec was held against the tools screens as drawn — the lists, the tool item page at both widths, the four dialogs, the phone's sheets — and a row went in when one of them draws its kind. A row only the screens above this axis draw is declared by #258 with the first screen that reads it, which is this issue's own rule running on: a name arrives with its reader, and this issue is the one step that declares ahead of readers, bounded by the issues that read next. **The rows that wait**, each for the reason it is not on this axis: the one figure, the detail title and the block value (money, a mono id as a title, a figure titling its block), the glyph and the 11 of a calendar's weekday, the tracking of text set in capitals, the calendar date, the comparison line, the gutter mark, the inline marker and Wrong's red mark, the tab and its count, the Split dialog — all but its summary's inside, which #459's notice draws — the Paper shadow, the record rail on Fill and the header's figure, the nested list, the blue and red edges (a blue-outlined control, the inline marker), and the padding of a band of controls. **The Badge radius and Ink 5 were on that list and the spec has since given each a checkbox**, which a tool's page draws in every row: 0j's Badge, 4, is `the PDF chip, a checkbox`, and the files of 2026-10-01 give Ink 5 `the edge of an empty checkbox` beside the bar standing in for a line of text. Neither is declared; the issue that draws the checkbox's look declares both with it, and Ink 5's `--color-skeleton` below was named for the bar alone. **Two sets of rows the tools drawings use are not declared.** The record rail on 1080 is one: #462 read the tool item page as a layout of its own rather than 0n's record page (answer 4), so the rail's 336, the 32 and 28 either side of its Rule and its blocks' 24 and 40 went undeclared, and #463 declares them with the screen. Six rows the Tools file's 0a gained after #462 read it were the other — Field label, Field error, Busy, Keyboard, Notice and Step page. They are the phone's, the registration dialog is drawn at a desk and reads none of them, and the issue that first drew each was to hold it against its screen and declare what it read: #458 drew the first, Field label, whose 20 from a field to the next label is `--spacing-mobile-field-stack`, and #473 the other five, on the sign-in steps at a phone's width, and declared them with their readers.

**AND THREE THINGS ARE NOT DECLARED ANYWHERE.** 0b's Page of rows is a paging figure a module reads, not a value a stylesheet does, and `tools.md` records why the two page sizes stay two constants; the spec states the figure for a list and not that the tools list and the document lists are one reader's page, which is the decision a fold needs. The drawing widths, 1600 and 375 × 812, are the canvas. White is Tailwind's own name, which the design uses as the word it is.

**EVERY NAME WAITS ON THE ISSUE THAT READS IT FIRST**, written in the check's table, and it was assigned from the bodies of #456 to #460 and #463 held against the drawings: the dialog frame, its controls and the colors they use are #456's, since its registration dialog is the frame the other three follow; the Preview is #457's, as the label sheet's cells were until #467 took the sheet; the phone's sheets are #458's, and its foot bar was until #458 handed it on (below); the rail, the breadcrumb, the tooltip and the scroll are #460's; the lists, the tool item page and the phone's top bar and history are #463's. **This said #459 reads no name first, and 1k did not bear it out**: its notice lists ids in the id face on a dialog's summary, so #459 read `--color-background-muted`, `--font-id` and `--tracking-id` before #457, whose marks they carried, and declared the three the summary needed. **A wrong assignment corrects itself at the next landing**: an issue reading a name marked for a later one fails until it takes the mark out, and an issue that lands takes its number out of the list, after which every name still marked for it fails until it is read or undeclared. **#456 was the first landing, and it moved eight marks.** Five of #463's are the registration dialog's lists — the Menu's offset and inset, a menu option's side room, the Group corner and Raised — since a list a field opens is 0a's Menu (answer 6); `--size-icon` was #460's and is the whole-dialog refusal's alert mark (answer 9); `--color-divider` was #457's and is the Rule a scrolling dialog body shows at the edge its content is hidden past (0l); and `--color-background-muted` went from #456 to #457 when Design took the fields off Field (answer 5). The Menu's two widths stay #463's.

**#460 landed next and took its number out, which settled every name it held.** The rail, the breadcrumb, the tooltip and the column read theirs, and three of #457's first: `--height-control`, which a rail row and its toggle are; `--spacing-control-inline-inset-x`, a breadcrumb level's side room; and `--color-foreground-faint`, the `/` between two levels, which the files of 2026-10-01 give Ink 4. Three marks moved: `--spacing-tooltip-offset` to #463, since the rail's tooltip opens beside its icon and the 6 is for one above its target; `--spacing-scroll-inset-bottom` to #463, since how a column ends — 0i's End and its give-back — is the screen's; and `--color-drawer-overlay` to #457, since the files of 2026-10-01 put nothing behind a Panel and #457 takes out what the spec dropped. **0m's account was not drawn and its two names went** — `--height-account` and `--size-avatar` — because the read it needs would have reached the `/t/` hop a scan passes through (`tools.md`, `The navigation`); the issue that draws it declares them again with it, which #478 did. Five names came from the drawings rather than the spec, and the table and `What the drawings carry` mark them.

**#457 landed third and took its number out.** It read the three names still marked for it — a step's number is Label, and a page in the pane sits at the Mark corner on the Preview shadow — and undeclared `--color-drawer-overlay`, the Panel's wash #460 left it, since nothing draws one. It declared nine names with their reader: the dot's 9 either side (answer 7), and 1i's dialog at 780 by 520, its 440 pane, the 20 and 12 between pages, the column's 24 and 4, and a step's 20 mark.

**#478 drew 0m's account, and declared its two names again with it.** `--height-account` is the expanded row and `--size-avatar` the avatar on Face; the collapsed button's 8 above the rail's foot is (48 − 32) / 2 and the row's 4 before the avatar (32 − 24) / 2, written as those differences so the avatar's center is one point in both shapes. The account and its menu read three names marked for #463 first — the menu's two widths, since a menu opened from a button is 0a Menu's other half, and Face hover, which the collapsed avatar takes under the pointer — and five more came from the drawings rather than the spec, each declaration saying so: the row's 10 from the avatar to the name, its 12 inside the right end, the 1 between the name and the role, the 13 chevron, and the avatar's 90ms fade. The role line is the Label step at 400, 12 on 16 in Ink 3, and takes no name of its own, and the menu's items are the Control, 32, the height the collapsed button is.

**#458 drew the tool item page's dialogs and 1f's three sheets, and took its number out.** Of the thirty-two names marked for it, twenty-two are read — the sheet's, the phone's type, its field, its radii and its Target — and seven of #463's are read first: the button in a dialog, Red's hover, which the retirement's commitment takes under the pointer, and the sheet that confirms. **The foot bar went to the issues that draw one**, since 1f draws the tool item page's check-out as a foot bar and #473 builds 0a's for the sign-in steps: its room above, below and between its rows, its 50 button and the pill's height and sides to #473, and the pill's chevron side, a field's icon and the icon's gap to #463's tool item page. **Its shadow was undeclared**, since 0a now draws the foot bar with none. Two of the sheet that confirms' names are every sheet's — the 20 under what it holds and the 12 between its stacked actions, the one arrangement 0a gives a sheet's actions — so they are `--spacing-mobile-drawer-body-stack` and `--spacing-mobile-drawer-action-stack`, named for the sheet rather than for its one kind. It declared six more with their readers: the one field in a sheet, filled at Ink 5.5% with no edge (`--color-mobile-input-background`), and Field label's 20 (`--spacing-mobile-field-stack`), both the spec's; and four from the drawings, each declaration saying so — the clear mark's 15 at a filled field's end, the 17 check on the row already chosen, the 4 from a list's heading to its first row, and the 12 either side of `Done`, pulled back out so its word meets the gutter.

**#473 drew the sign-in steps and took its number out.** Of the six names #458 marked for it, five are read — the foot bar's room above and below, its 50 button and the pill's height and sides — and the foot bar's 12 between its rows went to #463's tool item page, since no step page has two. Three of #463's are read first: the Page title at both widths, and a phone field's gap, which a step page's field keeps between what is typed and what stands beside it. Its address pill's avatar is the account's, so `--size-avatar` has two readers and one declaration, and two of the names it reads are #458's, declared by that issue first and with the same values: Field label's 20 and the clear mark's 15. The rest it declared: 0o's column, head, pill and code, the 40 field and action and the 12 inside them, 0f's Working, the wordmark at 20 and the phone's at 17, the five Tools 0a rows above, and the drawings' values below.

**0f's Working is built once, in `Controls.js`'s `Button`.** The resting and the working label share one grid cell, and the switch is a visibility transition delayed by `--transition-delay-busy`, so an answer quicker than 300 ms never shows the spinner and no timer is kept for it; below the phone's edge the working label is announced and not drawn, which is Tools 0a's Busy. A `danger` commitment keeps its red while busy, and in a sheet an action keeps 0f's spinner and word, since Tools 0a draws a busy action on a step page and in no sheet. The sign-in steps are its first readers, and #469 is where the dialogs' actions take it.

**A field's help or refusal sits 6 under it, and that corrected the registration dialog.** 0l's Compact row and 0o both set the line 6 under its field, where the registration dialog set its `Up to 100` 8 under on `--spacing-gap`; the field component reads `--spacing-input-message-stack` now, and the dialog was read with it at 6. A field in one of #458's sheets takes the same 6, which is Tools 0a's Field error, under the phone's 15 that #458 gives the line.

## Design's answers

The values were read from Claude Design's `Tools - new direction` and `Invoices - new direction` files and their `support.js`, rendered in a browser. Four places in them disagreed with each other or with the app and Design answered each (2026-09-29); #456 read the files again as Design sent them after that, and took eight answers more (2026-09-30). **Design sent the files twice on 2026-10-01, and the second sending carries every answer** — the last two, 7 and 12, rendered and read by #460, which was built from it. Where this file says the files of 2026-10-01, it means that second sending. A reading of older files must take these answers over what those files say.

1. **A phone field's value is 16.** Design moved `a field's value` from the Tools file's 0a Bar row (17) to its Event row (16). The field reads `--text-mobile-body` and has no name of its own.
2. **Every disabled glyph is Ink 4.** Design widened 0e's Ink 4 row with `a disabled control's glyph` and took that item out of Ink 5, whose one remaining use was then a bar standing in for a line of text — which is why Ink 4 is `--color-foreground-faint`, a word that covers the separators and the disabled glyphs alike, and Ink 5 waits under `--color-skeleton`. The files of 2026-10-01 give Ink 5 the edge of an empty checkbox as well.
3. **The selection bar reads `3 selected · 3 not on this page`.** The second clause appears only while other pages hold a selection, an Ink 4 middle dot parts the two, and the second is set at 400 in Ink 3; the page box's name is `Select this page`. Design put both rules on 0b's Page of rows row. They are words and their application, so no name changed for them and #462 says none of them; the issue that restyles a tool's page does.
4. **The tool item page's 336 column is right as drawn, and it is 0n's record rail.** The page is 0n's record page with its label block in the rail, which 0n draws 336 wide at the right edge of the 1080 content — 32 from the main column's text to its Rule and 28 from the Rule to its own — and 384 wide on Fill. #462 read it as a layout of its own holding the label in a 336 column, left the rail waiting for #258 and listed the 336 among what the spec does not state; all three were false, and #456 corrected them where they stood. The rail's rows are #463's, declared with the screen, beside 0n's header, which the page takes and whose five names are #463's already: 14 under the breadcrumb bar, 24 above and below its rule, 10 and 12 down the stack, 12 from a block's name. The file is not behind here.
5. **A form field at rest is drawn on Edge, not on Field.** Design moved the fields from 0e's Field ground to an Edge border: 0f's Field row rests a form field — in a dialog or on a page of fields — white with an Edge border, and Edge's own row names it, `the border of a card, a button, a chip or a form field at rest`. The names did not move — `--color-border` is Edge and `--color-background-muted` Field — so Edge's comment took the field, and Field lost the registration dialog as a reader. What Field's row still holds is a search field, a field that is waiting, a dialog's summary and the ground under a print preview, and the last is #457's, so its mark went there. **A dialog's summary was drawn first**, in #459's notice, which read the name before #457 did.
6. **A list that opens from a field takes the field's width.** Design added the sentence to 0a's Menu row, whose other figures hold: 6 under the control, 5 inside, each item the height of the control that opens it — 36 under a 36 field — and 0k's Raised, the shadow of a surface that opens from a control. So a field's list is 0a's Menu, and the registration dialog's two read the Menu's names. The row's widths, from 140 to 280 on the longest item, are for a menu a button opens, and they wait for #463's `More actions`.
7. **The dot between two clauses is 9 either side, everywhere.** Design set 0e's Ink 4 row to `the dot between two clauses, 9 either side` and moved the line under a dialog's title from 8 to the same 9, since one mark does not take two values. The files of 2026-10-01 draw it at 9 in every caption. The breadcrumb's `/` keeps 8, and it is another mark. **The dot's name is `--spacing-separator-inline`**, declared by #457 with its first reader, the dot between the labels' count and their size; it was set with the text that held it until then.
8. **A dialog's head has two figures more, and both are names.** 0l's Head row now sets the close at least 16 from the title and a line under the title 2 under it — `--spacing-dialog-header-inline` and `--spacing-dialog-title-stack`, which the frame reads.
9. **A refusal about the whole dialog is drawn.** 0l's Actions row gives it one line above the actions: a 16 alert mark in Red, 8 before one sentence at 13 in Red, 14 over the actions — the mark the sign-in screens draw (1p, 1r). Every figure is a name already: `--size-icon`, `--spacing-gap`, `--text-body-sm`, `--color-danger` and `--spacing-gap-lg`. 1j's `Create failed` is where a registration that wrote nothing stands, and its sentence is Design's: `Couldn't create the tools. Try again.`
10. **A reader on no job meets every opener disabled, with why before it.** `Ask the office to assign you to a job` stands 14 before each of the three, on its line and at 13 in Ink 3 — 0f's Disabled row — and the dialog does not open for them. It is Design's answer to `Join a job to create tools`, which #455 sent back for naming an act nobody on this axis can take.
11. **The name sheet's `Done` is 48 tall**, the phone's Target, which settles the one place a drawing contradicted the spec: it was 44.
12. **A suggested tool and the preview say `N items`, and N is every item under the tool.** 1j suggests up to five tools as a name is typed, each row ending in its count, and a name typed in full is answered under the field instead: `Adds to X, which already has N items`, or `Creates a new tool`. N is the figure the tool's own page heads its list with, retired items included, since one word showing two figures on two screens reads as a discrepancy. The files of 2026-10-01 draw both that way.

## What the drawings carry that the spec does not state

Each is for the issue that draws it to name, in the same commit as its reader, since a name given now for a value no row states would be a guess at its kind.

- A row's checkbox is 16 — the mark a 32 box holds, `--size-icon`. Its radius of 4 and its edge at rest at Ink 5's value were the drawings' alone, and the spec now gives both: 0j's Badge names a checkbox, and Ink 5 the edge of an empty one.
- The Retired mark is a ring with a slash through it; 0g draws an open and a settled mark and no third.
- The label sheet's cells — 26 × 29 at the Mark radius, an inset ring at the ink's 12% and 14%, and a used position filled at Hover — went with the sheet (#467): a label printer cuts after every page, so no position is picked, and none of the three is any issue's to name.
- The web history's entries hang from a 5 dot at Ink 4 on a 1px Rule, the text 26 from the dot's left edge.
- A list's row puts 16 between a suggested tool's name and its count and 10 between a job and its check, where 0a's Menu row states neither. The registration dialog's two lists are one component and take one gap, 0b's Gap within a cluster, 8 — the least room a row whose two ends are pushed apart keeps between them.
- The sticker in the tool item page's label block sits at a radius of 4 on a ring and a shadow at the shadow ink's 8%.
- A dialog's summary puts 4 between two ids it lists, one to a line (1k). #459 named it `--spacing-dialog-summary-stack` with its first reader, for the summary rather than for spacing in general, so another screen's line spacing does not borrow it.
- The rail and the breadcrumb carry five, which #460 named with their readers, each declaration saying it is the drawings' and not the spec's: 2 between two sections (`--spacing-rail-stack`) and 10 above and below the rule under the toggle (`--spacing-rail-divider-stack`), both 0m's; 12 that one level of the breadcrumb pulls left so its chevron's stroke meets the Margin (`--spacing-breadcrumb-back-offset`) and 2 between that chevron and its word (`--spacing-breadcrumb-back-gap`), both 1b's; and the 120ms a tooltip takes to fade in (`--transition-duration-tooltip`), which the drawings' stylesheet sets and 0k does not.
- The account at the rail's foot carries five more, which #478 named with their reader, each declaration saying the same: the expanded row's 10 from the avatar to the name (`--spacing-account-gap`), its 12 inside the right end (`--spacing-account-inset-right`), the 1 between the name and the role (`--spacing-account-name-stack`), the 13 chevron (`--size-account-chevron`), and the 90ms over which the collapsed avatar darkens to Face hover under the pointer (`--transition-duration-avatar`). 0m's Account row gives the 48 and the 24 and nothing else.
- 1f's sheets carry four, which #458 named with their readers, each declaration saying the same: the 15 mark of the clear × at a filled field's end (`--size-mobile-input-clear-icon`), the 17 check at the end of the row already chosen (`--size-mobile-drawer-row-icon`), the 4 from a list's heading to its first row (`--spacing-mobile-drawer-heading-stack`), and the 12 either side of the name sheet's `Done`, pulled back out so its word meets the gutter (`--spacing-mobile-drawer-header-action-inset-x`). 0a's Sheet row gives the rows, the handle and the title, and none of these.
- The sign-in steps carry eight, which #473 named with their readers, each declaration saying the same: the 12 between the name step's two fields (`--spacing-sign-in-form-inline`, 1g); the caret's height, 24 in a desk's box and 26 in a phone's (`--height-code-caret`, 1e; `--height-mobile-code-caret`, 1a); the clear ×'s target 6 from a phone field's inside edge, beside the 15 mark #458 named (`--spacing-mobile-input-clear-inset-right`, 1a); the 4 the resend control pulls left into the space before it, where it pulls its whole 8 to the right (`--spacing-code-resend-offset`, 1e and 1a); and, from the drawings' stylesheet, the spinner's 0.7 s turn and its track at 35% of its label's ink (`--animate-spinner`, `--color-spinner-track`) and the 160ms the foot bar's soft edge fades in over (`--transition-duration-mobile-bottom-bar`). The line under a phone's code stands 4 in, as 1a draws it, which is a field's refusal's 4 (`--spacing-mobile-input-message-inset-x`) and takes no name of its own.

**THE ONE PLACE A DRAWING CONTRADICTED THE SPEC IS SETTLED**: the name sheet's `Done` is 48 now, the phone's Target (answer 11).

## The label's code, settled at 400 and no tracking (#467)

The design set the code on a tool label in Inconsolata at 500 with −0.04em of tracking, while the label printed it at the face's default weight with none, and `CHARACTER_WIDTH_RATIO` was measured in the second. It is printed rather than drawn on a screen, so neither #463, whose subject is the screens, nor #457 covered it, and where it went waited. **A print answered it**: the label that proved the floors printed the code at 400 with no letter-spacing (`tools.md`, `A label is a page of its own`), so those are the code's, `labels.css` sets both on the code rather than leaving them to inheritance, and `offline/tool-label-page.mjs` pins them. The design was asked to draw the code that way, and the files of 2026-10-01 do, in 0p and 1i. No name here is for it: its face and both values are the label's.

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
| 0o Field and Action, 40 tall | `--height-control-xl` | 2.5rem (40) |
| 0a Side room, inside a form field, and 0o Field, its fixed domain from the border | `--spacing-control-xl-inset-x` | 0.75rem (12) |
| 0l Compact, a field's help under it, and 0o Refusal, one field's | `--spacing-input-message-stack` | 0.375rem (6) |
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
| 0e Ink 4, the dot's room either side | `--spacing-separator-inline` | 0.5625rem (9) |
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
| 0f Working, the wait before it shows | `--transition-delay-busy` | 300ms |
| 0f Working, the spinner | `--size-spinner` | 1rem (16) |
| The drawings' spinner, its turn — not the spec | `--animate-spinner` | Tailwind's `spin`, 0.7s, linear |
| The drawings' spinner, its track — not the spec | `--color-spinner-track` | the label's ink at 35% |
| 0g the mark | `--size-status-indicator` | 0.5625rem (9) |
| 0g the ring | `--stroke-width-status-ring` | 1.5px |
| 0h Page title | `--text-heading-lg` | 1.5rem at 2rem, −0.012em, 600 (24 at 32) |
| 0h Section | `--text-heading` | 1rem at 1.5rem (16 at 24) |
| 0h Reading | `--text-body` | 0.875rem at 1.25rem (14 at 20) |
| 0h Beside | `--text-body-sm` | 0.8125rem at 1.25rem (13 at 20) |
| 0h Label | `--text-heading-sm` | 0.75rem at 1rem, 600 (12 at 16) |
| 0h Wordmark, in the rail | `--text-brand` | 1rem at 1.5rem, 500 (16 at 24) |
| 0h Wordmark, on a sign-in page | `--text-brand-lg` | 1.25rem at 1.75rem, 500 (20 at 28) |
| 0h Tracking, a mono id under 21px | `--tracking-id` | −0.02em |
| 0h Tracking, the wordmark | `--tracking-brand` | −0.03em |
| 0h Instrument Sans | `--font-ui` | Instrument Sans |
| 0h Fragment Mono | `--font-id` | Fragment Mono |
| 0h Bricolage Grotesque | `--font-brand` | Bricolage Grotesque |
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
| The drawings' tooltip, fading in — not the spec | `--transition-duration-tooltip` | 120ms |
| 0l Width | `--container-dialog` | 26.25rem (420) |
| 0l Position | `--spacing-dialog-gutter` | 1.75rem (28) |
| 0l Compact, all round | `--spacing-dialog-inset` | 1.5rem (24) |
| 0l Compact, the title to the body | `--spacing-dialog-header-stack` | 1.25rem (20) |
| 0l Compact, two fields in a row | `--spacing-dialog-inline` | 0.75rem (12) |
| 0l Head, the close pulled out | `--spacing-dialog-close-offset` | 0.25rem (4) |
| 0l Head, the close from the title | `--spacing-dialog-header-inline` | 1rem (16) |
| 0l Head, a line under the title | `--spacing-dialog-title-stack` | 0.125rem (2) |
| 0l Split, the summary inside, above and below | `--spacing-dialog-summary-inset-y` | 1rem (16) |
| 0l Split, the summary inside, either side | `--spacing-dialog-summary-inset-x` | 1.125rem (18) |
| 1k, between two ids a summary lists | `--spacing-dialog-summary-stack` | 0.25rem (4) |
| 1i, a dialog with a preview, across | `--container-dialog-preview` | 48.75rem (780) |
| 1i, a dialog with a preview, down | `--height-dialog-preview` | 32.5rem (520) |
| 1i, the pane a preview is drawn in | `--width-dialog-preview-pane` | 27.5rem (440) |
| 1i, between two rows of pages in the pane | `--spacing-dialog-preview-stack` | 1.25rem (20) |
| 1i, between two pages in a row | `--spacing-dialog-preview-inline` | 0.75rem (12) |
| 1i, between the blocks of the column beside the pane | `--spacing-dialog-panel-stack` | 1.5rem (24) |
| 1i, between two codes the column lists | `--spacing-dialog-panel-list-stack` | 0.25rem (4) |
| 1i, a numbered step's mark | `--size-dialog-step` | 1.25rem (20) |
| 0m Rail, collapsed | `--width-rail` | 3.5rem (56) |
| 0m Rail, expanded | `--width-rail-expanded` | 15.5rem (248) |
| 0m Rail, inside | `--spacing-rail-inset` | 0.75rem (12) |
| 0m Rail, widens over | `--transition-duration-rail` | 200ms |
| 0m Rail, widens on | `--ease-rail` | cubic-bezier(0.2, 0, 0, 1) |
| 0m's drawing, between two sections — not the spec | `--spacing-rail-stack` | 0.125rem (2) |
| 0m's drawing, around the rule under the toggle — not the spec | `--spacing-rail-divider-stack` | 0.625rem (10) |
| 0m Account | `--height-account` | 3rem (48) |
| 0m Account, the avatar, and 0o Address pill's | `--size-avatar` | 1.5rem (24) |
| 0m's drawing, the avatar to the name — not the spec | `--spacing-account-gap` | 0.625rem (10) |
| 0m's drawing, inside the row's right end — not the spec | `--spacing-account-inset-right` | 0.75rem (12) |
| 0m's drawing, the name to the role — not the spec | `--spacing-account-name-stack` | 0.0625rem (1) |
| 0m's drawing, the row's chevron — not the spec | `--size-account-chevron` | 0.8125rem (13) |
| 0m's drawing, the avatar darkening under the pointer — not the spec | `--transition-duration-avatar` | 90ms |
| 0m Breadcrumb | `--height-breadcrumb` | 3rem (48) |
| 1b's drawing, one level pulled left — not the spec | `--spacing-breadcrumb-back-offset` | 0.75rem (12) |
| 1b's drawing, its chevron to its word — not the spec | `--spacing-breadcrumb-back-gap` | 0.125rem (2) |
| 0n Record header, around its rule | `--spacing-page-header-stack` | 1.5rem (24) |
| 0n Record header, under the breadcrumb bar | `--spacing-breadcrumb-stack` | 0.875rem (14) |
| 0n Header stack, from the title | `--spacing-title-stack` | 0.625rem (10) |
| 0n Header stack, to the status | `--spacing-subtitle-stack` | 0.75rem (12) |
| 0n Rail blocks, from a block's name | `--spacing-heading-sm-stack` | 0.75rem (12) |
| 0o Column | `--container-sign-in` | 22.5rem (360) |
| 0o Column, the wordmark from the page's top | `--spacing-sign-in-inset-top` | 16.75rem (268) |
| 0o Wordmark, above the title | `--spacing-sign-in-brand-stack` | 2.5rem (40) |
| 0o Head, the sentence under the title and the pill under it | `--spacing-sign-in-header-gap` | 0.5rem (8) |
| 0o Head, to the first field or the actions | `--spacing-sign-in-header-stack` | 2rem (32) |
| 0o Action under the last field, Refusal under the fields, and Code's line under the action | `--spacing-sign-in-form-stack` | 1.5rem (24) |
| 1g's drawing, two name fields in a row — not the spec | `--spacing-sign-in-form-inline` | 0.75rem (12) |
| 0o Address pill, inside before the avatar | `--spacing-avatar-chip-inset-left` | 0.25rem (4) |
| 0o Address pill, inside after its words | `--spacing-avatar-chip-inset-right` | 0.75rem (12) |
| 0o Code, a box | `--size-code-slot` | 3.25rem (52) |
| 0o Code, between its two groups | `--spacing-code-group-inline` | 1rem (16) |
| 0o Code, its figure set 1 below center | `--spacing-code-slot-inset-top` | 0.125rem (2) |
| 0o Code, its figure | `--text-code-slot` | 1.375rem at 1.75rem, 500 (22 at 28) |
| 0o Code, the drawn caret | `--width-code-caret` | 0.125rem (2) |
| 1e's drawing, the caret's height — not the spec | `--height-code-caret` | 1.5rem (24) |
| 0o Code, the caret blinking on a 1s cycle | `--animate-code-caret` | 1s, hidden for its second half |
| 1e's and 1a's drawings, the resend control pulled left — not the spec | `--spacing-code-resend-offset` | 0.25rem (4) |
| Tools 0a Screen, either side | `--spacing-mobile-gutter` | 1rem (16) |
| Tools 0a Top bar | `--height-mobile-top-bar` | 3.5rem (56) |
| Tools 0a Top bar, right | `--spacing-mobile-top-bar-inset-right` | 0.25rem (4) |
| Tools 0a Top bar, the mark | `--size-mobile-top-bar-icon` | 1.5rem (24) |
| Tools 0a Foot bar, above | `--spacing-mobile-bottom-bar-inset-top` | 1rem (16) |
| Tools 0a Foot bar, below | `--spacing-mobile-bottom-bar-inset-bottom` | 1.25rem (20) |
| Tools 0a Foot bar, between its rows | `--spacing-mobile-bottom-bar-stack` | 0.75rem (12) |
| Tools 0a Keyboard, the foot bar riding on it | `--spacing-mobile-bottom-bar-keyboard-inset-bottom` | 0.75rem (12) |
| Tools 0a Foot bar, its soft edge over the 24 above it | `--spacing-mobile-bottom-bar-bleed` | 1.5rem (24) |
| The drawings' soft edge, fading in — not the spec | `--transition-duration-mobile-bottom-bar` | 160ms |
| Tools 0a Target | `--spacing-mobile-touch-target` | 3rem (48) |
| Tools 0a Title | `--text-mobile-heading-lg` | 1.375rem at 1.75rem, −0.012em, 600 (22 at 28) |
| Tools 0a Bar | `--text-mobile-heading` | 1.0625rem at 1.5rem (17 at 24) |
| Tools 0a Event | `--text-mobile-body` | 1rem at 1.5rem (16 at 24) |
| Tools 0a Beside | `--text-mobile-body-sm` | 0.9375rem at 1.25rem (15 at 20) |
| Tools 0a Log detail | `--text-mobile-body-xs` | 0.875rem at 1.25rem (14 at 20) |
| Tools 0a Block name | `--text-mobile-heading-sm` | 0.8125rem at 1.25rem, 600 (13 at 20) |
| Tools 0a Step page, the Wordmark | `--text-mobile-brand` | 1.0625rem at 1.5rem, 500 (17 at 24) |
| Tools 0a Button, in the foot bar | `--height-mobile-button` | 3.125rem (50) |
| Tools 0a Button, in a dialog | `--height-mobile-dialog-button` | 3rem (48) |
| Tools 0a Busy, the spinner | `--size-mobile-spinner` | 1.25rem (20) |
| Tools 0a Field | `--height-mobile-input` | 3.125rem (50) |
| Tools 0a Field, inside | `--spacing-mobile-input-inset-x` | 1rem (16) |
| Tools 0a Field, its icon | `--size-mobile-input-icon` | 1.125rem (18) |
| Tools 0a Field, its icon to its value, and any two parts inside it | `--spacing-mobile-input-gap` | 0.625rem (10) |
| 1f's and 1a's drawings, the clear × at a filled field's end — not the spec | `--size-mobile-input-clear-icon` | 0.9375rem (15) |
| 1a's drawing, the clear ×'s target from the field's inside edge — not the spec | `--spacing-mobile-input-clear-inset-right` | 0.375rem (6) |
| Tools 0a Field, a text button pressed | `--opacity-mobile-pressed` | 50% |
| Tools 0a Field, the one field in a sheet | `--color-mobile-input-background` | Ink at 5.5% |
| Tools 0a Field label, a field to the next label | `--spacing-mobile-field-stack` | 1.25rem (20) |
| Tools 0a Field error, 4 in, and 1a's line under a code | `--spacing-mobile-input-message-inset-x` | 0.25rem (4) |
| Tools 0a Field error, its mark to its sentence | `--spacing-mobile-input-message-gap` | 0.375rem (6) |
| Tools 0a Notice, inside, above and below | `--spacing-mobile-alert-inset-y` | 0.875rem (14) |
| Tools 0a Notice, inside, either side | `--spacing-mobile-alert-inset-x` | 1rem (16) |
| Tools 0a Notice, its mark | `--size-mobile-alert-icon` | 1.125rem (18) |
| Tools 0a Notice, its mark to its sentence | `--spacing-mobile-alert-gap` | 0.625rem (10) |
| Tools 0a Pill | `--height-mobile-chip` | 2.25rem (36) |
| Tools 0a Pill, either side | `--spacing-mobile-chip-inset-x` | 0.875rem (14) |
| Tools 0a Pill, its chevron side | `--spacing-mobile-chip-inset-right` | 0.75rem (12) |
| Tools 0a Pill, an address pill's avatar from its round end | `--spacing-mobile-avatar-chip-inset-left` | 0.375rem (6) |
| Tools 0a Status, the mark | `--size-mobile-status-indicator` | 0.625rem (10) |
| Tools 0a Radius, a control and a dialog | `--radius-mobile-control` | 0.75rem (12) |
| Tools 0a Radius, a sheet's top corners | `--radius-mobile-drawer` | 1.75rem (28) |
| Tools 0a Title block, under the top bar | `--spacing-mobile-top-bar-stack` | 1rem (16) |
| Tools 0a Title block, below | `--spacing-mobile-title-stack` | 1.375rem (22) |
| Tools 0a Section | `--spacing-mobile-stack` | 2rem (32) |
| Tools 0a Step page, the wordmark from the top | `--spacing-mobile-sign-in-inset-top` | 4.5rem (72) |
| Tools 0a Step page, the wordmark to the title | `--spacing-mobile-sign-in-brand-stack` | 2rem (32) |
| Tools 0a Keypad, the code under the address pill | `--spacing-mobile-code-stack` | 1.5rem (24) |
| Tools 0a Code, the line under the field | `--spacing-mobile-code-help-stack` | 1.25rem (20) |
| 1a's drawing, the caret's height in a phone's box — not the spec | `--height-mobile-code-caret` | 1.625rem (26) |
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
| 1f's drawing, the check on the row already chosen — not the spec | `--size-mobile-drawer-row-icon` | 1.0625rem (17) |
| 1f's drawing, a list's heading to its first row — not the spec | `--spacing-mobile-drawer-heading-stack` | 0.25rem (4) |
| 1f's drawing, either side of `Done`, pulled back out — not the spec | `--spacing-mobile-drawer-header-action-inset-x` | 0.75rem (12) |
| Tools 0a Sheet that confirms, its title | `--spacing-mobile-confirm-inset-top` | 1.5rem (24) |
| Tools 0a Sheet that confirms, its id | `--spacing-mobile-confirm-title-stack` | 0.25rem (4) |
| Tools 0a Sheet that confirms, the sentence | `--spacing-mobile-confirm-id-stack` | 0.875rem (14) |
| Tools 0a Sheet that confirms, the actions — every sheet's | `--spacing-mobile-drawer-body-stack` | 1.25rem (20) |
| Tools 0a Sheet that confirms, between actions — every sheet's | `--spacing-mobile-drawer-action-stack` | 0.75rem (12) |
| Tools 0a Menu | `--width-mobile-menu` | 14.5rem (232) |
| Tools 0a Menu, from the right edge | `--spacing-mobile-menu-gutter` | 0.75rem (12) |
| Tools 0a Menu, under the top bar | `--spacing-mobile-menu-offset` | 0.25rem (4) |
| Tools 0a Menu, inside a row | `--spacing-mobile-menu-row-inset-x` | 1rem (16) |
| 0h 400, the page | `--font-weight-normal`, Tailwind's | 400 |
| 0h 500, what you choose from | `--font-weight-medium`, Tailwind's | 500 |
| 0h 600, what titles or acts | `--font-weight-semibold`, Tailwind's | 600 |
| 0h Wordmark, its `HYE` | `--font-weight-bold`, Tailwind's | 700 |
| The phone frame's edge | `--breakpoint-sm`, Tailwind's | 40rem |
| 0m Rail, from a 1280 window | `--breakpoint-xl`, Tailwind's | 80rem |
| 0k Sticky, its blur | `--blur-sm`, Tailwind's | 8px |
| 0j Pill, and Tools 0a's round | Tailwind's full radius | calc(infinity * 1px) |
| 0e Ink 5 | `--color-skeleton`, not declared yet | oklch(0.800 0.010 265) |
