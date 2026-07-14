/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse (issue #46) wraps pdfjs-dist, which resolves its worker
  // script via a path relative to its own module location at runtime —
  // bundling it through Turbopack/webpack breaks that (the worker file
  // ends up somewhere pdfjs-dist doesn't expect). Excluding it from
  // bundling leaves Node's normal module resolution in charge, which
  // keeps the worker file discoverable.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
