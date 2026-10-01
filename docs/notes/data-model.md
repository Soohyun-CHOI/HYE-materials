# Data model — the field lists

Governs `lib/airtable/**` (with `airtable-access.md` and `naming.md`), `scripts/import/**`, `scripts/demo/**` and `scripts/tests/verify-*.mjs`, and any change to a field or a table. **Read this before editing there** — CLAUDE.md carries only the rules that bind code outside this area; the field lists and their link topology are here, and why a field is shaped the way it is stays in the notes file for its area.

Moved verbatim out of CLAUDE.md, and three lines have changed since. The `PR Signers` entry ended on a colon introducing the list that the CLAUDE.md / docs/notes split had moved to `purchase-requests.md`, and it now points there. Two sentences pointed at CLAUDE.md's index and at its `Editing the Airtable schema` section without naming the file, which held only while they stood in it, and now name it. The migration was audited line by line and the result is in the pull request that created this file.

**This list was CLAUDE.md's until the headroom pass after #471, and the audience test is what moved it.** A field is read and written by name in its table's module under `lib/airtable/**`, and every other module takes the object that module maps a record to; a field is made by a script under `scripts/import/**`, and the seeds under `scripts/demo/**` and the credentialed checks write records by field name as well. Those are the paths the index points here. The list was also the part of CLAUDE.md that grew with the app — a paragraph per table, the growth #407 named — so here a new table costs that file nothing.

**Five files outside those paths read or write a field by name, measured when the list moved, and the index does not point them here.** `lib/ids.js` and `lib/blobIngest.js` take the field's name from their caller, `lib/deliveryCandidates.js` reads two links on `Disciplines`, `app/login/confirm/page.js` reads three `Auth Tokens` fields, and `app/prs/[prId]/actions.js` restores one `PR Edit Requests` row. Every other file outside `lib/airtable/` that imports the client destroys rows by id, names a table or takes the lock. None of the five writes a field this list carries a rule for; if another file outside those paths starts reading or writing fields by name, widening the index row is the fix.

**If the Airtable MCP connector is available, prefer querying the live base schema over trusting this document for exact field types — this file can drift, but the rules below stay authoritative.**

## Data model (26 tables)

Field lists and link topology only. Why a field is shaped the way it is lives in the `docs/notes/` file for its area — see the index in CLAUDE.md.

**Users**: First Name (primary, typed at the first sign-in, blank until then), Last Name, Email, Phone, Role (Employee/President), Is Admin, Status (Active/Inactive), Created At, Assigned Jobs (link -> Jobs, multiple, optional).

**Jobs**: Job Code (primary), Job Name, Business Unit, PIC/Manager (link -> Users) + Phone/Email (Lookups), Delivery Address (link -> Addresses, single — the DEFAULT; `Alternate Delivery Address` went in #384), Disciplines/Users/Addresses (reverse-links).

**Disciplines**: child of Jobs. Discipline Label (primary, formula = {Job} & "_" & {Discipline Name} — an underscore, as `Material Label` joins; this line said ` - ` until #280 read the live formula), Discipline Name (human-entered), Job (link, single). Was `Lines` until #280.

**Vendors**: Vendor Name (primary), PIC Name/Phone/Email (plain text, external), Address (link, single), Purchase Orders (Lookup via PR chain).

**Purchase Requests**: PR ID (HYE-PR-YYMMDD-##), Requester/Vendor (links, single), Discipline (link, single), Job (Lookup via Discipline, read-only), Delivery Address (link -> Addresses, single, app-enforced — required at submit, #385), Created At (datetime, UTC — timestamped per the *At convention), Status (Draft/In Review/Approved/PO Signed/Withdrawn; PO Signed fires when President signs the generated PO), Withdrawn At (datetime, UTC, *At convention — stamped only when withdrawn, #122), Current Signer Step, Items Subtotal (rollup, PR Items only), Shipping Fee (optional currency; fixed once set, changeable only via Edit and continue), Total Amount (formula = Items Subtotal + Shipping Fee, blank = 0), Notes, Quotation Files (Lookup, plural).

**PR Signers** — dynamic ordered approval chain. Its field list and the rules for each turn are under `PR Signers` in `purchase-requests.md`.

**PR Items**: PR Item ID, PR (link), Category (link, single -> Material Categories, app-enforced — **the item's identity since #355; `Item Name` is written from its `Item Name` and typed nowhere, #416**), Item Name, Size, Unit (single select, canonical list — see Units), Qty, Unit Price, Amount = live formula, Remark (free text only), Quotation (link, single -> Quotations — auto-linked when only one exists, dropdown once 2+, never silently reassigned).

**PR Edit Requests**: PR Edit Request ID, PR, Initiated By, Sent To, Notes, Requested At, Resolved At, Status (Pending/Resolved). Was `Correction Requests` until #333.

**PR Edit Log**: PR Edit Log ID, PR, Changed By, `Field` (select — exactly the seven labels the code can write: the six `ITEM_FIELD_LABELS` values plus `Shipping Fee`), Old Value, New Value, Changed At, Notes (optional). Append-only: no update function, and `prEditLog.js` deliberately has none.

**Purchase Orders**: strict 1:1 with PR. PO ID (HYE-PO-YYMMDD-## — #313 took the 4-digit year off and rewrote the stored ones), PR (link), Vendor (Lookup via PR), Quotation File (Lookup), Our PIC/Manager (links), Created Date, President Signed(+At), Status (Awaiting Signature/Signed/**Sent to Vendor**/Withdrawn — the third revived in #281), Withdrawn At (datetime, UTC, *At convention — stamped in the same write as Status -> Withdrawn, #138), Sent At / Sent By (link -> Users, single, app-enforced) / Sent To (text — the address used) — one send, one write, never rewritten (#281), PO PDF File, Items Subtotal (rollup, PO Items only), Shipping Fee (plain currency, frozen copy from PR at PO-generation time), Total Amount (formula = Items Subtotal + Shipping Fee, blank = 0 — PO PDF's TOTAL line), Delivery Address (link -> Addresses, single, app-enforced — frozen copy of the PR's at generation, #386; blank where the PR has none), Uninvoiced Items (rollup, SUM of PO Items."Has Uninvoiced Qty").

**PO Items**: frozen snapshot from PR Items at PO-generation — NOT live. PO Item ID, PO (link), Item Name, Size, Unit (single select, same list), Qty, Unit Price, Amount = static value, Remark, Invoice Items (reverse-link, multiple — partial invoicing is real), Has Uninvoiced Qty (formula = `IF({Qty} - {Invoiced Qty} > 0, 1, 0)`). No free-text/user-facing Unit entry point; the snapshot fields are written only by lib/poGeneration.js.

**Quotations**: Quotation ID ({PR ID}-Q{seq}), Vendor Quotation Code (human-entered), Vendor/PR (links, single), File (attachment, required at creation in-app). At least one required per PR; can have more than one over its lifetime (dynamic list on PR form, or later via Edit and continue).

**Invoices**: Invoice ID (HYE-INV-YYMMDD-##), Vendor Invoice Code (human-entered), Vendor (link), Issue/Due Date, Amount Due ("Vendor's Stated Total" — never auto-overwritten by the backend; human edits allowed and recompute variance, #117), Shipping Fee, Tariff (optional), Sales Tax (optional currency, #283 — on `Invoices` only), Items Subtotal (rollup), Calculated Total (formula = Items Subtotal + Shipping Fee + Tariff + Sales Tax, blank = 0), Variance Flag (checkbox, backend-set), Paid Date (calendar — its presence IS the payment, `Sent At`'s shape; the `Paid` checkbox went in #318), File (attachment, required), Delivery (link -> Deliveries, single, optional — app-enforced, #210), Recorded By (link -> Users, #382).

**Invoice-PO Link**: join table, many-to-many. Primary = plain autoNumber. Both link fields single-record.

**Invoice Items**: Invoice Item ID, Invoice + PO (links, single), PO Item (link, single, app-enforced — #278), Item Name, Size, Unit (single select, same list), Qty, Unit Price, Amount = live formula, Variance Flag (checkbox, backend-set), Remark (shared, Unit Price/Qty discrepancies). Size/Unit are frozen copies from the linked PO Item, reference-only, no edit path (mismatch = wrong PO Item picked). Only a PR takes typed items, so a charge with no ordered item behind it is not a state this app has.

**Addresses**: Address Label (primary, human-typed, app-enforced unique — the one `X Label` primary NOT composed, #384), Line 1/2, City, State, Zip Code, Country, Formatted Address (formula), Jobs (link -> Jobs, multiple, #384).

**Materials**: **item identity** (#18). Natural key = **Category + Size + Unit** (#356 — it was `Item Name` + Size + Unit, and a name was typed). `Category` (link, single -> Material Categories, app-enforced), `Size`, `Unit` (the same 19-value single select as the three item tables, see Units) are the only writable fields. Computed: `Item Name`, `Category Code` and `Category Path` (lookups through `Category`, of `Item Name`, `Level 4 Code` and `Category Label` — the last is searched and never rendered, #416), `Material Label` (primary, formula = `Item Name` + `_Size` + `_Unit`, omitting blanks — the lookup concatenates BARE, no `ARRAYJOIN`), `_Record ID`, the `Committed Qty` / `Signed Qty` / `Invoiced Qty` rollups and the `Uninvoiced Qty` formula. The `Material Prices`, `PO Items` and `Delivery Items` links are all maintained from the far side. USD only.

**Material Categories**: HQ's four-level tree, one row per path (#354). `Category Label` (primary, formula; the rule is `lib/materialCategory.js`), `Level 1–4 Code` / `Level 1–4 Category` (all singleLineText; **a code is text and never a number**), `Item Name` (singleLineText — the readable name, **stored and never composed**: eight templates produce it, so a hand-added path gets a label for free and no name, #415), `Materials` (reverse-link, #356). Reference data, loaded re-runnably from a committed CSV, keyed on `Level 4 Code`. **A leaf the office adds in the app takes the 900 block and a name no other category carries (#368).**

**Material Prices**: item × vendor (#18). Natural key = Material + Vendor. `Price Label` (primary, formula over the two links), `Material` / `Vendor` (links, single), `Unit Price`, `Latest Date` (calendar), `Latest PO` (link), and `Material Record ID` / `Vendor Record ID` lookups. Still a latest-value cache.

**Deliveries**: one recorded delivery (#162). `Delivery ID` (HYE-DL-YYMMDD-##), `Job` / `Vendor` (links, single), `Packing List PO` (link, single, optional), `Delivery Address` (link -> Addresses, single, app-enforced — required at entry, written once, #387), `Received Date` (calendar), `Recorded By` (link → Users, single), `Created At` (datetime, UTC), `Notes` (long text, optional), `Packing List File` (attachment, required at creation), `Delivery Items` (reverse-link), `Invoices` (reverse-link, plural).

**Delivery Items**: one allocated slice of a delivery (#162). `Delivery Item ID` ({Delivery ID}-{seq}, 3 digits), `Delivery` (link, single), `PO Item` (link, single, **optional**), `Material` (link, single), `Item Name` / `Size` / `Unit` (frozen reference copies), `Qty`, `Over Delivered` (checkbox, backend-set).

**Direct Purchases**: material a site bought with no order behind it (#272). `Direct Purchase ID` (HYE-DP-YYMMDD-##), `Vendor` / `Job` (links, single; Job required, and app-enforced), `Vendor Invoice Code`, `Issue Date` (calendar), `File` (attachment, required at creation), `Notes`, `Recorded By` (link → Users, single), `Created At` (datetime, UTC), `Purchase Request` (link, single, optional). No items, no total and no status — what a row is waiting for is read from that last link and the request's own `Status`. **The request's KIND is read from the same link and stored nowhere else**.

**Tools**: the KIND a tool is bought as (#334) — first table of the tools track, which shares this base, this login and these people with everything above it. `Tool Name` (primary, human-entered, app-enforced unique; no minted ID, as `Vendors` and `Materials` have none), `Tool Items` (reverse-link).

**Tool Items**: one physical tool, the thing a QR label is stuck to (#334). `Tool Item ID` (HYE-TL-YYMMDD-###, primary, 3-digit sequence — the label prints and the QR carries it WITHOUT the `HYE-TL-` token, #411), `Tool` (link, single), `Status` (In Stock/Out/Retired), `Job` (link → Jobs, single, **required and app-enforced**), `Tool Log` (reverse-link). **`Status` and `Job` are both caches of the last `Tool Log` row, written by this app and never by an Airtable formula.** No `Created At`: the `Created` log row holds it.

**Tool Log**: what has happened to one tool item, append-only (#334). `Tool Log ID` ({Tool Item ID}-{seq}, 3 digits), `Tool Item` (link, single), `Event` (select — Created/Checked Out/Checked In/Retired), `Job` (link → Jobs, single, **on every row and never blank**, which is what makes the previous row the previous job — so **no `Former Job` is stored**; where each event learns it is in `tools.md`), `Recorded By` (link → Users, single), `Event At` (datetime, UTC), `Checked Out To` (text — the person a tool item was handed to, **on `Checked Out` rows and blank on the other three, app-enforced both ways**; no account exists for these people, #376). `Notes` was here until #363 dropped the rule it existed for.

**Auth Tokens**: Token (primary), Code (text, six digits, #471), Code Attempts (number), Email, Expires At, Used, Created At. Single-use by link or code, 15-min TTL, five tries per code.

### Units

One shared 19-value single select, source of truth `lib/units.js:CANONICAL_UNITS`. **Never use `typecast` on a Unit write** — it invents an option, which is how a canonical list silently gains a 20th value; omit an empty Unit instead. The derivation is in `airtable-access.md`; what a NEW table owes this list is under `Editing the Airtable schema` in CLAUDE.md.
