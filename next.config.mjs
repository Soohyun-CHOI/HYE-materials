/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse (issue #46) wraps pdfjs-dist, which resolves its worker
  // script via a path relative to its own module location at runtime —
  // bundling it through Turbopack/webpack breaks that (the worker file
  // ends up somewhere pdfjs-dist doesn't expect). Excluding it from
  // bundling leaves Node's normal module resolution in charge, which
  // keeps the worker file discoverable.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],

  // The uppercase spelling of the address a tool label carries (#348). A QR
  // code's alphanumeric mode holds digits, A-Z and a few marks and packs them
  // far tighter than byte mode, so the label encodes the whole URL in upper
  // case — `HTTPS://HYEUSA.COM/T/HYE-TL-260909-004`, one symbol version smaller
  // at every error-correction level. The scheme and host are case-insensitive
  // per RFC 3986; the PATH is not, so `/T/` has to resolve on its own.
  //
  // A REWRITE RATHER THAN A SECOND ROUTE OR A REDIRECT. Two directories
  // differing only in case cannot coexist on a case-insensitive filesystem
  // (measured: `mkdir T` beside `t` was refused), and two pages for one entry
  // point would be two briefs and two entry points. A redirect would cost a
  // second hop, which is the one thing the printed path may not do — it already
  // redirects once, to the tool item's own screen. A rewrite runs that same page
  // under the other spelling and leaves the hop count at one.
  //
  // The two literals are `lib/toolRoutes.js:LABEL_REWRITE`, and
  // `offline/tool-routes.mjs` compares this file against it — nothing else in
  // this repository can see a rewrite.
  async rewrites() {
    return [{ source: "/T/:toolItemId", destination: "/t/:toolItemId" }];
  },
};

export default nextConfig;
