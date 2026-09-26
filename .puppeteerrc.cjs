// Puppeteer configuration file — read automatically by both the
// `puppeteer` library (whatsapp-web.js's Client) at runtime AND the
// `npx puppeteer browsers install chrome` CLI step in render.yaml's
// buildCommand, so both agree on where Chrome lives.
//
// Why this exists (found 2026-09-26, session 24): Puppeteer's default
// cache directory is `$HOME/.cache/puppeteer` (os.homedir()-based). On
// Render, `$HOME` (/opt/render) is OUTSIDE the project directory
// (/opt/render/project/src) that actually gets carried from the build
// step into the running instance ("Uploading build..." in Render's
// build log only packages the project directory). So Chrome would
// download successfully during build, then be gone by the time the app
// actually runs — exactly the "Could not find Chrome" error this fixes.
// This is a documented, common issue for Puppeteer on Render specifically
// (see https://pptr.dev/guides/configuration and
// https://github.com/puppeteer/puppeteer/issues/9694) — the standard fix
// is to point the cache directory at somewhere inside the project folder
// instead, via this file, rather than $HOME.
const { join } = require("path");

/** @type {import("puppeteer").Configuration} */
module.exports = {
  cacheDirectory: join(__dirname, ".cache", "puppeteer"),
};
