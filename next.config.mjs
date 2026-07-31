/** @type {import('next').NextConfig} */
const nextConfig = {
  // The cohort platform needs a server runtime (Stripe webhooks, Postgres,
  // sessions, cron), so `output: 'export'` is gone. The marketing pages are
  // still prerendered at build time.
  images: { unoptimized: true },
  poweredByHeader: false,
  // /api/setup reads these at runtime. Next's tracing cannot see a readFileSync
  // built from process.cwd(), so without this they are absent from the Vercel
  // bundle and setup fails in production while working perfectly locally.
  outputFileTracingIncludes: {
    '/api/setup': ['./db/*.sql'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        // Member-facing surfaces must never be held by a shared cache.
        source: '/(dashboard|admin|leaderboard)/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
    ];
  },
};
export default nextConfig;
