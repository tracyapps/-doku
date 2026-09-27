// Catch-all for /api/* paths deeper than one segment (e.g. /api/auth/sign-in/social).
// Vercel's [...name] files only match one segment outside Next.js, so vercel.json
// rewrites /api/:path* here; Express still sees the original URL.
export { app as default } from '../server/app.js';
