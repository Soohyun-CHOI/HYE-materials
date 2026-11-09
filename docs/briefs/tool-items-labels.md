# Print labels

Opens from: `/asset-categories/[categoryRecordId]` and `/assets/[assetId]`, as a dialog over the page that opens it.
Design: Tools 1e, 1d and 1f, on Invoices 0l and 0p.
Who reaches it: a site manager on the job of the items it prints — a category's list on
their own job, which alone draws the boxes, and an asset's page on such an item. Nobody
else is drawn a control that opens it, and the read behind a category's run refuses
anybody else and names the items off the reader's jobs rather than printing them.
At a desk everyone reads an asset's label on its own screen.
Which width comes first: **desktop**, and it is the only one: it is used at whatever
machine the printer is attached to.

## What it answers

We added some items and they need stickers. Print their QR labels on the label
printer's tape, one label to a page.

**An asset with no label is a row nothing can reach.** The symbol is the only way a
phone gets from an object to its record, so this dialog is the last step of a
registration rather than a convenience — which is why a registration lands on its
category's screen with what it wrote selected, one press from here.

**It is the one surface in this app whose correctness is physical.** What prints is
each label at its true size, a page each, and every dimension exists so the ink lands
inside the length of tape the printer cuts.

## What it always carries

**The run is what the opening page names**: a category's selection, in ascending id,
or an asset's one label. **It is at most `MAX_LABELS_PER_REQUEST`, 100** — the largest
registration's cap, one number — and the read behind it throws on a longer run, which
nothing the app draws can send.

**How many labels print, and on which stock**, both screen-only and never printed:
the count is the page count the print dialog has to agree with, and the stock is the
label's size, `ASSET_LABEL_PAGE_COPY.size`, since the tape is what a person loading the
printer has to get right. While anything prints, the two steps the browser's print
dialog needs (`ASSET_LABEL_PAGE_COPY.hintSteps`).

**Each label carries the symbol and, under it, the printed code**, and nothing else —
not the item's name. **Nothing may be drawn inside the symbol's box**, which includes
the four modules of quiet zone a camera needs. **The code is the fallback for a symbol
scratched or painted over**, so it is never truncated, and it is the end of the asset's
id (`l-labelCode.md`); **a design must not put the family token back**.

**Each label is drawn at twice its printed size** (`LABEL_PREVIEW_SCALE`) by a zoom the
print takes back to 1, so nothing inside a label moves between the two, and the dialog
draws it the right way up while **the print turns it a quarter turn clockwise**: the
page that comes off the tape is 12 mm along it and 11 mm across.

**What it reads:** an asset's one label nothing — the page built it; a category's run
the gate's 1 operation and the action's 2 — the session and the run's assets, one
query per fifty ids — so 3 for a run past fifty (`docs/notes/tools.md`). The opening
asks nothing.

## What it carries only sometimes

**While a category's run is read**, and while the code's face loads before the
browser's print dialog, the print is busy (`ASSET_LABEL_PAGE_COPY.working`); the dialog
opens at once.

**When the read fails** (`ASSET_LABEL_PAGE_COPY.readFailed`): the print reads again.
**When the reader is no longer a site manager** (`ASSET_LABEL_PAGE_COPY.noPermission`):
the print is turned away and the page behind is drawn again without its boxes. Neither
can arise from an asset's page, which reads nothing.

**When some codes name no item the app shows** — none on the base, or a deleted one
(`ASSET_LABEL_PAGE_COPY.notFound`) — **or items off the reader's jobs**
(`ASSET_LABEL_PAGE_COPY.notYours`): those codes are listed
apart under how many, and no label is drawn for them. **They are not folded into the
run** — a label that cannot print is a different state from one that can, and a short
run printed in silence leaves somebody counting stickers. Only a selection made before
an item moved or the reader left its job, or a copied address, carries an item off the
reader's jobs.

**When none of them prints** — every code not found or off the reader's jobs
(`ASSET_LABEL_PAGE_COPY.noLabels`): no steps, and the print does not act. A
hand-typed address reaches it.

**When the host is too long for the symbols** (`ASSET_LABEL_PAGE_COPY.symbolTooLarge`):
the run's shape with nothing to print and that sentence where the codes not found
stand. **A design must keep it where Print is pressed.**

**When nothing is selected, or more than one print takes**, the dialog does not open:
a category's page draws no print control, or draws it not acting and says why
(`asset-categories-categoryRecordId.md`).

## What must agree elsewhere

**The label's figures live in `lib/assetLabelPage.js`, and a design must take them
from there** rather than assume a size. The label is 11 mm wide and 12 mm tall as it
reads, on 12 mm tape cut after every page. The symbol and the code are at floors a
print on this printer proved and a phone read — `MIN_MODULE_MM`, 0.29 mm a module, and
`MIN_ID_FONT_PT`, 5 pt — and what the label leaves is margin. **A design adding
anything to the label takes it from the margins**; it may not take it from the quiet
zone or the code's floor.

**The symbol is sized in modules, never in millimeters.** A longer address is a bigger
symbol rather than a denser one, and the label keeps no room for a version above
today's (`VERSION_HEADROOM`): **the host's length decides whether a label prints**. A
host of up to seventeen characters gives today's symbol; the permanent host,
`app.hyeusa.com`, is fourteen, and a Vercel domain is past it. A design pinning the
symbol to a box in millimeters fails invisibly: a symbol a phone cannot read.

**The code sits under the symbol, and the order is part of the geometry**: they stack
along the tape, and their height and the margins are the label's 12 mm. The code
above the symbol or beside it is a different label, with different dimensions.

**The code's face is the design's, Inconsolata (`LABEL_CODE_TYPEFACE`), and it is part
of the arithmetic**: the label's width budget is that face's measured advance, so a
different face reopens the figure (`labelBudget`). Above its floor the code's size is
the design's, and the cost of going up is known: its height comes out of the margins,
and past about 5.4 pt ten characters outgrow the symbol's width.

**The label in an asset's rail and the label this dialog prints are one object**, built
once for both, so a replacement is the same physical label by construction.

**Nothing on the paper is a screen affordance.** Everything but the pages — the head,
the count, the codes, the steps, the controls, the backdrop and the page behind — is
hidden at print (`labels.css`). **What prints has to be the pages and nothing else**,
because a label is exactly one page and the page has no margin: any ink outside a
label takes a page of its own and pushes every label down by one. Something added
inside the pane beside a label has to stay on the screen side of that rule.
