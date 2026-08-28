// The one ceiling every user upload in this app is held to (#146).
//
// WHERE 20 MB CAME FROM, which is the question this module exists to answer.
// Nothing on either platform forces it. Every real limit is one to five orders of
// magnitude above, measured against the docs on 2026-08-28:
//
//   Vercel Blob, one blob                                    5 TB
//   Airtable attachment, when we hand it a URL                5 GB
//   @vercel/blob's own multipart recommendation             100 MB
//   Airtable's uploadAttachment endpoint                      5 MB  (not our path —
//                                                                   we submit a URL
//                                                                   and Airtable
//                                                                   fetches it)
//
// So the figure is a PRODUCT bound, not a platform one, and what it actually
// protects is the base's attachment storage allowance and the reader's patience. A
// scanned invoice, an emailed quotation and a phone photo of a packing list all run
// 1-10 MB, so 20 MB is about twice the largest plausible document: no real one is
// refused and a runaway upload is. **Raising it is not blocked by anything above** —
// which is the sentence a future reader needs, because #296 established that a
// number is the first thing in this repository to go stale.
//
// ONE CONSTANT FOR ALL THREE UPLOAD PATHS, and the condition under which that stops
// being right. Quotation files, invoice files and packing list photos accept the
// same three content types and hold the same kind of artifact — a vendor-issued
// document captured as PDF, JPEG or PNG — and no measurement separates them, so
// CLAUDE.md's "one rule, one implementation" leaves nothing to justify a second
// number with. The measurable condition that would split them is a path's accepted
// content types diverging: a packing list path that took HEIC, or a multi-page scan
// class, would be holding a different kind of file and could need a different
// ceiling. Until then, one.
//
// PURE ON PURPOSE. Five `"use client"` forms import `refuseOversizeUpload`, so
// nothing here may reach `lib/airtable/` at any depth.

/**
 * The ceiling, in bytes. Read by the three client-upload token routes, which mint it
 * into the signed upload token, and by the guard below.
 */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const BYTES_PER_MB = 1024 * 1024;

/**
 * A byte count as the reader's own units, ROUNDED UP.
 *
 * Up rather than to-nearest because the only sentence that uses this compares a
 * refused file against the limit, and 20.02 MB rounded to `20.0 MB` reads as a file
 * that is exactly at a limit it was just refused for. Rounding up, a file over the
 * line always prints over the line.
 *
 * A whole number keeps no decimal, which is what makes the limit render as `20 MB`
 * rather than `20.0 MB` — the label is derived here rather than written down, so
 * there is one figure in this file and not two.
 */
export function describeBytes(bytes) {
    const mb = Math.ceil((Number(bytes) || 0) / BYTES_PER_MB * 10) / 10;
    return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
}

/**
 * The refusal's words. A builder rather than a literal, and it takes BYTES rather
 * than strings, for `offline/mail-money.mjs`'s reason one level down: a caller that
 * formats its own figure is a caller that can format it differently, and a check
 * can only ask what a builder prints if the builder is what prints it.
 *
 * No closing period — every one of the five forms renders this after `Upload
 * failed: ` and three of them append a sentence of their own.
 */
export const UPLOAD_LIMIT_COPY = {
    tooLarge: ({ bytes, limitBytes }) =>
        `This file is larger than the upload limit — ${describeBytes(bytes)} against ${describeBytes(limitBytes)}`,
};

/**
 * The refusal for a file of `bytes`, or null when it is within the limit.
 *
 * STRICTLY GREATER, to match what actually refuses on the other side. The Blob SDK
 * compares `computeBodyLength(body) > options.maximumSizeInBytes`, so a file of
 * exactly 20 MB is accepted there; a `>=` here would refuse in the browser what the
 * server would have taken, and the two halves of one limit would disagree on the
 * one input where a disagreement is invisible in testing.
 */
export function uploadLimitRefusal(bytes) {
    const size = Number(bytes) || 0;
    if (size <= MAX_UPLOAD_BYTES) return null;
    return UPLOAD_LIMIT_COPY.tooLarge({ bytes: size, limitBytes: MAX_UPLOAD_BYTES });
}

/**
 * The one line all five upload forms call.
 *
 * It THROWS rather than returning, and that is what makes it one identical line in
 * five places instead of five slightly different ones. Every form already wraps its
 * `upload()` in a try whose catch puts `err.message` into that entry's error slot;
 * placed as the first statement inside that try, this reaches the slot the same way
 * a rejected upload does, and no form needs a new branch, a new state shape or a new
 * place to render. Both `setState` calls land in one synchronous handler tick, so
 * the `uploading` state set just above never renders.
 */
export function refuseOversizeUpload(file) {
    const refusal = uploadLimitRefusal(file?.size);
    if (refusal) throw new Error(refusal);
}

/**
 * A caller asking for a MULTIPART upload is refused, by all three token routes.
 *
 * THE CEILING DOES NOT BIND A MULTIPART UPLOAD, and that is measured rather than
 * assumed. A forged caller — real session, real token route, `multipart: true` in the
 * generate-client-token payload — receives a token whose payload reads
 * `maximumSizeInBytes: 20971520` and then uploads 21 MB successfully. So the signed
 * ceiling, which is the whole of the server half, is something a client can opt out
 * of by setting one flag. Without this refusal there is no server enforcement at all
 * on the path the issue is actually about: a directly-called route.
 *
 * REFUSING COSTS NOTHING BECAUSE NOBODY ASKS. `multipart` defaults to false in the
 * SDK and not one of the five call sites passes it, so this cannot refuse an upload
 * any screen makes. If a path ever needs multipart — @vercel/blob recommends it above
 * 100 MB, five times this ceiling — the thing to reopen is the ceiling, not this.
 *
 * DEVELOPER-FACING, not copy. It reaches a caller that is not one of our forms, which
 * is the same class as the `Not authenticated` these routes already throw.
 */
export const MULTIPART_REFUSAL = "Multipart uploads are not accepted on this route";

export function refuseMultipartUpload(multipart) {
    if (multipart) throw new Error(MULTIPART_REFUSAL);
}
