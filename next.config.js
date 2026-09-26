/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Required on Next.js 14 for src/instrumentation.ts (self-ping loop) to
  // run at all. Stable without this flag from Next.js 15 onward — safe to
  // remove this block after upgrading past 14.
  experimental: {
    instrumentationHook: true,
    // whatsapp-web.js's RemoteAuth pulls in `unzipper`, which does an
    // unconditional top-level `require('@aws-sdk/client-s3')` in
    // lib/Open/index.js purely to offer an *optional* Open.s3() method we
    // never call (we only ever open local zip files/buffers, never S3).
    // That package isn't installed (we don't use S3), so when Next's
    // webpack build tries to statically bundle whatsapp-web.js for the
    // server, it fails trying to resolve that require - even though the
    // code path is never exercised at runtime. This is a known upstream
    // issue: https://github.com/ZJONSSON/node-unzipper/issues/330
    //
    // Listing the package here tells Next to leave it (and everything it
    // pulls in, including unzipper) out of the webpack bundle entirely and
    // load it via native Node `require()` at runtime instead - so webpack
    // never walks into the unzipper/aws-sdk code path in the first place.
    // Renamed to the stable top-level `serverExternalPackages` in Next 15;
    // update this key when upgrading past 14.
    serverComponentsExternalPackages: ["whatsapp-web.js"],
  },
};

module.exports = nextConfig;
