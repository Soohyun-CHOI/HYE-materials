// The unsigned-order signal (#198) — the judgment, the label, the copy, and the two
// places the judgment must NOT be repeated.
//
// WHAT THIS TIER CARRIES THAT A BROWSER CANNOT. The rendering is browsable on this
// base (`HYE-PO-20260817-05` is unsigned, open and not withdrawn, so the picker offers
// it), but three things are not: that the judgment reads `Status` rather than the
// `President Signed` checkbox, that a PO withdrawn before it was ever signed is NOT
// "unsigned", and that no client component compares the status string. The first two
// are indistinguishable on any screen this base can show, because a withdrawn PO never
// reaches an offered surface at all.
//
// THE MUTANTS ARE THE POINT OF THE FIRST TWO SECTIONS. `presidentSigned` is the
// plausible wrong field — it sits on the same record, reads as the same question, and
// agrees with the right answer on every PO the picker can offer.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    PO_UNSIGNED_STATUS,
    UNSIGNED_COPY,
    isPOUnsigned,
    poOptionLabel,
} from "../../../lib/poUnsigned.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "An unsigned order, wherever one is offered (#198)";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const read = (rel) => readFileSync(join(REPO_ROOT, rel), "utf8");

const po = (status, presidentSigned = false) => ({ poId: "HYE-PO-20260817-05", status, presidentSigned });

export function run({ check, assert, log }) {
    // -----------------------------------------------------------------------
    log("anti-vacuity — the judgment answers both ways and reads its input:");
    check("an order awaiting a signature is unsigned", isPOUnsigned(po(PO_UNSIGNED_STATUS)), true);
    check("  and a signed one is not — so the predicate is not a constant", isPOUnsigned(po("Signed", true)), false);
    check("the status string is the one Airtable holds", PO_UNSIGNED_STATUS, "Awaiting Signature");

    // -----------------------------------------------------------------------
    log("it reads `Status`, never the `President Signed` checkbox:");
    // The case that separates the two, and the reason it can only be pinned here: a
    // withdrawn PO is filtered out of both offered surfaces, so no screen shows it.
    check(
        "an order withdrawn before it was ever signed is NOT unsigned",
        isPOUnsigned({ status: "Withdrawn", presidentSigned: false }),
        false
    );
    const keyedOnCheckbox = (p) => !p?.presidentSigned;
    assert(
        "  and a mutant keyed on `presidentSigned` disagrees exactly there",
        keyedOnCheckbox({ status: "Withdrawn", presidentSigned: false }) !==
            isPOUnsigned({ status: "Withdrawn", presidentSigned: false })
    );
    assert(
        "  while agreeing on every PO an offered surface can hold, which is why it would pass unnoticed",
        keyedOnCheckbox(po(PO_UNSIGNED_STATUS)) === isPOUnsigned(po(PO_UNSIGNED_STATUS)) &&
            keyedOnCheckbox(po("Signed", true)) === isPOUnsigned(po("Signed", true))
    );
    const alwaysUnsigned = () => true;
    assert(
        "a mutant that always answers unsigned disagrees on a signed order",
        alwaysUnsigned() !== isPOUnsigned(po("Signed", true))
    );

    // -----------------------------------------------------------------------
    log("nothing else is unsigned, including what the field does not name:");
    check("`Withdrawn`", isPOUnsigned(po("Withdrawn")), false);
    check("a status the field gains later", isPOUnsigned(po("Sent to Vendor")), false);
    check("a blank status", isPOUnsigned(po("")), false);
    check("no status at all", isPOUnsigned({ poId: "HYE-PO-20260817-05" }), false);
    check("no record at all", isPOUnsigned(null), false);
    check("  and undefined", isPOUnsigned(undefined), false);

    // -----------------------------------------------------------------------
    log("the picker's label — the signal is part of the text, an `<option>` holding no markup:");
    check(
        "an unsigned order carries the word",
        poOptionLabel({ poId: "HYE-PO-20260817-05", unsigned: true }),
        "HYE-PO-20260817-05 — unsigned"
    );
    check(
        "  and a signed one carries the id alone",
        poOptionLabel({ poId: "HYE-PO-20260817-05", unsigned: false }),
        "HYE-PO-20260817-05"
    );
    check(
        "an absent flag says nothing rather than guessing",
        poOptionLabel({ poId: "HYE-PO-20260716-03" }),
        "HYE-PO-20260716-03"
    );
    check("a missing id yields an empty label, not `undefined`", poOptionLabel({ unsigned: true }), " — unsigned");
    check("  and no record at all yields nothing", poOptionLabel(null), "");
    // It reads the normalized boolean, NOT the status: the three server surfaces each
    // hand over `unsigned`, and only one of them still has a `status` to pass.
    check(
        "a raw status on the object does not turn the label on",
        poOptionLabel({ poId: "HYE-PO-20260817-05", status: PO_UNSIGNED_STATUS }),
        "HYE-PO-20260817-05"
    );

    // -----------------------------------------------------------------------
    log("the detect banner's clause — observed, selected, and no instruction:");
    const one = UNSIGNED_COPY.detected(["HYE-PO-20260817-05"]).text;
    const two = UNSIGNED_COPY.detected(["HYE-PO-20260817-05", "HYE-PO-20260817-01"]).text;
    check(
        "one order, singular throughout",
        one,
        " HYE-PO-20260817-05 is unsigned: the President has not signed it. It was still selected — an invoice can be recorded against an unsigned order."
    );
    assert("two orders, plural throughout", two.includes("are unsigned") && two.includes("They were still selected"));
    assert("  and both are named", two.includes("HYE-PO-20260817-05") && two.includes("HYE-PO-20260817-01"));
    assert("it starts with a space, being appended to whatever else detection found", one.startsWith(" "));
    check("the key is stable, so a call site can branch on it", UNSIGNED_COPY.detected([]).key, "unsigned-detected");
    // The restraint the issue asks for, asserted rather than trusted: no cause is
    // guessed and nothing is demanded of the office.
    for (const word of ["because", "must", "should", "has to", "have to", "need to", "directly", "overage"]) {
        assert(`  says nothing about "${word}"`, !one.toLowerCase().includes(word));
    }
    assert(
        "  and it does not print the Airtable status verbatim — the screen word is `unsigned`",
        !one.includes(PO_UNSIGNED_STATUS) && one.includes("unsigned")
    );

    // -----------------------------------------------------------------------
    log("one judgment, three server call sites, and none of it in the browser:");
    const form = read("app/invoices/new/InvoiceForm.js");
    assert("the form was read", form.length > 1000);
    assert("  and it renders labels through the helper", form.includes("poOptionLabel(po)"));
    // NARROWED ON PURPOSE, and the first version of this assertion is why: barring
    // `.status ===` outright failed on the form's own state machines — `slot.status`,
    // `invoiceFile.status`, `poItemsCache[id].status` are upload and fetch states with
    // nothing to do with a purchase order. What must not appear is the status STRING
    // and any read of a PO record's own status.
    assert("the client spells no PO status string", !form.includes(PO_UNSIGNED_STATUS));
    const readsPOStatus = (source) => /\b(?:po|c)\??\.status\b/.test(source);
    assert("  and reads no PO's `status` field", !readsPOStatus(form));
    assert(
        "  — a matcher that fires on a planted `po.status`, so the absence above means something",
        readsPOStatus("const x = po.status;") && readsPOStatus("if (c?.status) {}")
    );
    for (const [rel, source] of [
        ["app/invoices/new/page.js", read("app/invoices/new/page.js")],
        ["app/api/pos/search/route.js", read("app/api/pos/search/route.js")],
        ["app/api/invoices/detect-po/route.js", read("app/api/invoices/detect-po/route.js")],
    ]) {
        assert(`${rel} decides it with isPOUnsigned`, source.includes("unsigned: isPOUnsigned(po)"));
        assert(`  and spells the status nowhere itself`, !source.includes(`"${PO_UNSIGNED_STATUS}"`));
    }
    // The projection carries the ANSWER and not the status, which is what keeps the
    // judgment out of the browser — passing `status` would have been the easy version.
    const search = read("app/api/pos/search/route.js");
    assert("the search projection sends no `status` field", !/\bstatus:/.test(search));
    assert(
        "detect-po sets it on the candidate rather than in a bucket of its own",
        /confirmed\.push\(\{[\s\S]*?unsigned: isPOUnsigned\(po\)/.test(read("app/api/invoices/detect-po/route.js"))
    );
}

if (isMain(import.meta.url)) standalone(title, run);
