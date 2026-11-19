/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Required on Next.js 14 for src/instrumentation.ts (self-ping loop) to
  // run at all. Stable without this flag from Next.js 15 onward — safe to
  // remove this block after upgrading past 14.
  experimental: {
    instrumentationHook: true,
  },
};

module.exports = nextConfig;
