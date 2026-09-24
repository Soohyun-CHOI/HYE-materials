// Where a file handed to Airtable may come from (#438): this app's own Vercel Blob
// store, and nowhere else.
//
// Every upload path writes the file to Blob and hands Airtable the URL, and Airtable
// then FETCHES that URL and keeps what it finds (lib/blobIngest.js). So a URL a
// caller supplies is an address Airtable fetches on this app's behalf and stores as
// a quotation, an invoice file or a packing list photo — the same reach the rule in
// CLAUDE.md restricts for a route that fetches a caller's URL itself, which is why
// `/api/invoices/detect-po` asks this predicate too.
//
// "OURS" WAS A HOST SUFFIX UNTIL #438, AND A SUFFIX IS EVERY VERCEL CUSTOMER'S. The
// predicate asked whether a host ended in `.public.blob.vercel-storage.com`, which is
// true of any public store anybody has, so an address on a store of the caller's own
// passed every guard in the app — with neither the size ceiling (#146) nor the type
// allowlist in front of what it held. Our store is the one this deployment's
// credentials name. @vercel/blob 2.6.1 reads its id out of `BLOB_READ_WRITE_TOKEN`
// (`vercel_blob_rw_<storeId>_<secret>`, `parseStoreIdFromReadWriteToken`) or, under
// OIDC, out of `BLOB_STORE_ID` less a `store_` prefix, and builds a public URL as
// `https://<storeId>.public.blob.vercel-storage.com/<pathname>`. Measured against the
// store `.env.local` names: the five objects listed all carried the token's id,
// lower-cased, as their host, and the two variables named the same store. So both
// are read, and a URL on any other host is not ours.
//
// NO VARIABLE, NO STORE. A process holding neither name has no store, so no URL is
// ours — which is what the offline tier sees, and why both functions take the
// environment as an argument: a check hands them one rather than setting a process
// variable. If the deployment ever names its store some other way, every upload
// path refuses at once, which is loud; a predicate that fell back to the suffix
// would be quiet.
//
// Pure and import-free, so the offline tier loads it under plain `node`. It lived in
// lib/blobIngest.js until #438, behind that module's import of the Airtable client.

const PUBLIC_BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

function readEnv(env, name) {
    const value = env?.[name];
    return typeof value === "string" ? value.trim() : "";
}

/** The public hosts of the stores this environment's credentials name. */
function ourBlobHosts(env) {
    const [, , , fromToken = ""] = readEnv(env, "BLOB_READ_WRITE_TOKEN").split("_");
    const configured = readEnv(env, "BLOB_STORE_ID");
    const fromStoreId = configured.startsWith("store_") ? configured.slice("store_".length) : configured;
    return new Set(
        [fromToken, fromStoreId].filter(Boolean).map((id) => `${id.toLowerCase()}${PUBLIC_BLOB_HOST_SUFFIX}`)
    );
}

/**
 * Is this a URL on our own Blob store? https, no credentials in it, and a host that
 * is exactly our store's public one — `host` rather than `hostname`, so a port is
 * refused too. Nothing this app uploads carries either, so both are cheap to refuse.
 *
 * Not the ingest signal: whether Airtable has taken a file is lib/blobIngest.js's
 * question, answered by the attachment rather than by the URL.
 */
export function isOurBlobUrl(url, env = process.env) {
    if (typeof url !== "string" || url === "") return false;
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return false;
    }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return false;
    return ourBlobHosts(env).has(parsed.host);
}

/**
 * The backstop every service function that writes an attachment calls before it
 * writes (#438). An action refuses a URL that is not ours first, in a sentence and
 * before anything is written; this throws for the call that never went through one,
 * the shape `assertWholeCentPrice` has beside the precision refusals (#254).
 *
 * Abstains on no attachment at all, which is how a seed or a fixture writes a record
 * with no file, and refuses an entry carrying no URL — an attachment object that
 * points at an existing file by id is not something any writer here is handed.
 */
export function assertOurBlobFiles(caller, files, env = process.env) {
    if (files == null) return;
    if (!Array.isArray(files) || files.some((file) => !isOurBlobUrl(file?.url, env))) {
        throw new Error(
            `${caller}: refusing an attachment whose url is not on this app's Blob store. ` +
                "Airtable fetches and keeps whatever an attachment url points at (#438), and " +
                "re-submitting one of Airtable's own empties the field once it expires (#142)."
        );
    }
}
