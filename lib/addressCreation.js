// Creating an address in the app (#384) — the pure half of the first write
// screen outside `/admin`: what makes two typed labels one address, which
// addresses a job already uses, and every word the screen says.
//
// WHY THE SCREEN EXISTS AT ALL. Addresses were created by hand in Airtable while
// the jobs and vendors that link to them were created through the app, so the one
// table a requester needs at the moment of raising a request was the one table
// they could not reach. #385 puts an address on a purchase request, and a picker
// with no path to a value that does not exist yet sends the requester to a text
// field — which produces one row per spelling of one place.
//
// APPLIED BY THE ACTION, PREVIEWED BY THE FORM. That is lib/toolRegistration.js's
// shape and it is the reason this module exists rather than the rule living in
// the action: the person typing a label has to see that it matched an address
// that already exists BEFORE they submit, and the server has to reach the same
// verdict afterwards. One key, two readers, no second implementation.
//
// IT REFUSES WHERE `upsertTool` FOLDS, AND THE DIFFERENCE IS WHAT ELSE IS TYPED.
// A tool name is the whole of that row's identity, so a second submission under
// one name is the same tool and find-or-create is right. An address label arrives
// beside a street, a city and a zip, so folding would silently discard the second
// person's street and leave them believing they recorded it. The refusal names
// the address that exists, which is the thing they actually wanted.
//
// PURE AND OFFLINE-SAFE. It imports `./itemNaming.js` with the extension spelled
// out, which is the lib/toolRegistration.js precedent (#19, #338): the offline
// tier runs under plain `node` with no loader, and the alternative was a second
// copy of #18's naming rule. Nothing here reaches lib/airtable/, so the form can
// import it — an import is an execution, and a credentialed module in a
// "use client" file is a browser crash rather than a lint error.
//
// EVERY STRING THE SCREEN RENDERS IS IN `ADDRESS_CREATION_COPY` AND NONE IS IN
// JSX. A word written into a component is invisible to the vocabulary checks and
// to scripts/screen-strings.mjs, so a screen with copy in its markup cannot be
// swept. The three `/admin` create forms spell their labels straight into JSX and
// are the pattern this screen otherwise follows; that half of the pattern is not
// copied, deliberately.
//
// THE TWO STREET LABELS DIVERGE FROM THE FIELDS THEY WRITE, `Addresses."Line 1"`
// and `"Line 2"`, and the divergence is a row in docs/notes/naming.md. `Street
// address` and `Suite, unit, floor` are what a person filling a form in front of
// a gate reads; `Line 1` is what a postal schema calls the same box. What made it
// worth looking at is that `offline/line-vocabulary.mjs` bars the bare word from
// every `*_COPY` string — `Addresses."Line 1"` is the live collision that file's
// header records — so the label could not have been spelled here anyway. The
// check is why this was examined and not why it was decided.

import { textMatchKey } from "./itemNaming.js";

/**
 * The key two typed address labels have to share to be one address.
 *
 * `toolNameKey`'S READING ONE TABLE OVER, and it calls the same composition for
 * the same reason: whitespace is fixed in the STORED value because a formula
 * cannot collapse an internal run, and case is folded only in the COMPARISON
 * because the stored string is the only copy of what somebody typed — `Ste 200`,
 * `FM 1431` and `SW` are correct as written.
 *
 * Its Airtable counterpart is `LOWER(TRIM({Address Label}))`, which
 * `getAddressByLabel` makes. Measured in #338 and unchanged here: Airtable's `=`
 * on a text field is case-SENSITIVE, so the lookup cannot be a bare `=`.
 */
export function addressLabelKey(addressLabel) {
    return textMatchKey(addressLabel);
}

/**
 * The address an already-loaded list holds under this label, or null.
 *
 * The form's preview and nothing else — the ACTION asks Airtable, because a list
 * the browser loaded moments ago cannot answer whether an address exists now. So
 * this is the same key reaching the same verdict on stale data, which is what
 * makes the preview honest without making it authoritative.
 */
export function matchExistingAddress(addressLabel, addresses) {
    const key = addressLabelKey(addressLabel);
    if (!key) return null;
    return (addresses || []).find((address) => addressLabelKey(address.addressLabel) === key) || null;
}

/**
 * The addresses one job already uses, out of a loaded list.
 *
 * THE UNION OF TWO LINKS, AND TAKING THE UNION IS WHAT REMOVES AN INVARIANT
 * RATHER THAN ADDING ONE. A job reaches an address two ways: `Addresses."Jobs"`
 * names every job that uses it, and `Jobs."Delivery Address"` names the one that
 * is the default. The obvious alternative was to require the default to be a
 * member of the set and enforce that in the app — which is a rule with no schema
 * behind it, no writer in this issue (nothing in the app writes a job's default
 * address), and a silent failure mode: a default missing from the set is exactly
 * the address this list has to show, since it is the one a requester is most
 * likely to retype. Reading both links asks no one to keep anything in step.
 *
 * NO MARK ON THE DEFAULT, DELIBERATELY. This list exists so a person does not
 * type a fifth spelling of a place that already has a row, and which of them is
 * the job's default does not change that. The word for the default belongs to
 * #385's form, where a requester chooses between the default and a different
 * one, and coining one here would commit that issue to it.
 *
 * SORTED BY LABEL, CASE-INSENSITIVELY, because the list is scanned rather than
 * ranked and the label is the only thing on each row.
 */
export function addressesOnJob(job, addresses) {
    if (!job) return [];
    const defaultIds = new Set(job.deliveryAddress || []);
    return (addresses || [])
        .filter((address) => defaultIds.has(address.id) || (address.jobs || []).includes(job.id))
        .sort((a, b) => (a.addressLabel || "").localeCompare(b.addressLabel || "", "en-US"));
}

/**
 * The fields an address needs before it is worth storing, and the refusal.
 *
 * ONE FUNCTION FOR BOTH, so no call site can read the verdict without having
 * consulted the refusal — `readQuantity`'s shape. The form's own inputs carry
 * `required`, and this exists because a Server Action is directly callable: the
 * control constrains a person, not a caller.
 *
 * THE SET IS WHAT `Formatted Address` RENDERS, which is why `Line 2` is not in it
 * and `Country` is not either. That formula reads five fields and prints four of
 * them unconditionally, so an address missing any of those four renders a line
 * with a stray comma in the one place a vendor reads it. `Country` has a default
 * and `Line 2` is genuinely optional — a yard has no suite number.
 */
export function readAddressFields(fields) {
    const clean = (value) => String(value ?? "").trim();
    const values = {
        addressLabel: clean(fields?.addressLabel),
        line1: clean(fields?.line1),
        line2: clean(fields?.line2),
        city: clean(fields?.city),
        state: clean(fields?.state),
        zipCode: clean(fields?.zipCode),
    };
    const missing = ["addressLabel", "line1", "city", "state", "zipCode"].some((key) => !values[key]);
    if (missing) return { values: null, refusal: ADDRESS_CREATION_COPY.fieldsMissing };
    return { values, refusal: null };
}

/**
 * The two options `Addresses."Country"` holds, in the order the field lists them.
 *
 * A FIELD'S CLOSED VOCABULARY RATHER THAN SCREEN COPY, which is why it is a
 * constant of its own and not a key in `ADDRESS_CREATION_COPY`. These are
 * Airtable's own option names — `lib/units.js:CANONICAL_UNITS` is the same shape
 * one table over, and CLAUDE.md's US-English rule already carves out a value that
 * belongs to something outside this repository. Rewording either of them breaks a
 * write rather than improving a sentence: nothing on this path passes `typecast`,
 * so a value that is not an option fails the create outright instead of inventing
 * a third.
 *
 * `Other` IS NOT A COUNTRY AND THIS ISSUE DID NOT COIN IT. It is what the field
 * has held since the base was built; narrowing a select's option list is the one
 * schema edit the Metadata API refuses outright (docs/notes/airtable-access.md),
 * so changing it is a table rebuild rather than an edit and is nobody's business
 * here.
 */
export const ADDRESS_COUNTRIES = ["USA", "Other"];

/** The one written when nothing is picked — every site and supplier is US today. */
export const DEFAULT_COUNTRY = "USA";

/**
 * Every word the address screen renders.
 *
 * SECOND PERSON THROUGHOUT, because every sentence here addresses the person
 * filling the form in the moment they are filling it — the voice
 * `ALLOCATION_COPY.preview` and `TOOL_REGISTRATION_COPY` already use for a
 * recorder about to act.
 */
export const ADDRESS_CREATION_COPY = {
    heading: "New Address",
    intro: "A place this company ships to, and the name people will know it by.",

    labelLabel: "Address Label",
    // The label is the identity and the only thing that tells two addresses in
    // one city apart, so the hint says what kind of answer is wanted rather than
    // restating the field name.
    labelHint: "What people call this place — the site, the gate, the yard.",
    // See the module header: these two write `Line 1` and `Line 2`. The KEYS are
    // named after the screen word rather than the field, which is the same split
    // the labels themselves make — the form's input `name` attributes are `line1`
    // and `line2`, so the wire carries the schema's word and only the reader gets
    // this one. `offline/line-vocabulary.mjs` inventories those two as the
    // `Addresses` fields they are; a `line1Label` key would have been a third
    // identifier carrying a barred stem to say something it does not mean.
    streetLabel: "Street address",
    suiteLabel: "Suite, unit, floor",
    cityLabel: "City",
    stateLabel: "State",
    zipLabel: "Zip Code",
    countryLabel: "Country",

    jobLabel: "Job",
    // NOT `lib/toolJob.js:TOOL_JOB_COPY.unchosen`, which reads `Pick a job` and
    // is a prompt for a picker that must be answered. This one is optional — a
    // vendor's own address belongs to no job — so the empty option states a
    // choice rather than asking for one, and reusing that word would make a
    // reader think they had left something out.
    jobUnchosen: "No job",

    // THE THREE GROUP LABELS ARE `/prs/new`'s, VERBATIM, AND COPYING THEM IS THE
    // POINT. That screen offers every job to every requester with the reader's own
    // assignments grouped first, and this picker is the same control for the same
    // reader — #385 sends them here from that form. Two screens naming one grouping
    // two ways is the drift `naming.md` exists against, so the words are taken
    // rather than chosen, including `All Jobs` over a group that renders only the
    // REST: that reading is slightly loose and it is that screen's wording to
    // tighten, not this one's to fork. **They live here and are spelled into JSX
    // there**, which is the one difference and is this repository's stated
    // direction rather than an inconsistency to resolve in an issue about
    // addresses.
    jobGroupMine: "My Jobs",
    jobGroupRest: "All Jobs",
    jobGroupOnly: "Jobs",

    submit: "Create Address",

    // ONE SENTENCE FOR THE PREVIEW AND THE REFUSAL, because it is one fact. The
    // form says it while somebody types and the action says it after they
    // submit; a second wording would be two words for one collision the first
    // time either was reworded.
    labelTaken: (addressLabel) =>
        `${addressLabel} is already an address. Use that one, or give this one a name ` +
        `that tells the two apart.`,

    fieldsMissing:
        "An address needs a label, a street address, a city, a state and a zip code.",

    // The job's own addresses, shown so a person does not record a second row for
    // a place that already has one. The empty case is a sentence rather than a
    // silence, because an absent list cannot be told apart from one that looked
    // and found nothing.
    onJob: (jobCode) => `Addresses already on ${jobCode}:`,
    noneOnJob: (jobCode) => `No address is recorded on ${jobCode} yet.`,

    created: ({ addressLabel, jobCode }) =>
        jobCode ? `Created ${addressLabel} on ${jobCode}.` : `Created ${addressLabel}.`,
};
