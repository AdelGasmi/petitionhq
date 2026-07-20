/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // ESLint runs via `npm run lint` (scripts/check-raw-colors.sh) — not during build.
  // Pre-existing react/no-unescaped-entities violations would break build otherwise.
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: ["@react-pdf/renderer", "@prisma/client", "docx"],

  // ── A-8: JSON body size cap (1 MB) ─────────────────────────────────
  // Per-route bodyParser.sizeLimit can override this for specific routes.
  // Do NOT enforce via middleware Content-Length — Next.js 15 strips it
  // under chunked transfer encoding.
  experimental: {
    serverActions: {
      bodySizeLimit: "1mb",
    },
  },

  // ── A-4: Security headers (static config, NOT middleware) ──────────
  // CVE-2025-29927 — middleware-injected headers can be bypassed via
  // x-middleware-subrequest spoofing. Static headers() block is safe.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent clickjacking
          { key: "X-Frame-Options", value: "DENY" },
          // Block MIME-sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Control Referer leakage
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // HSTS — preload after confirming all subdomains are HTTPS
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          // Disable browser features we don't use
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          // CSP — tight default, allows Turnstile (A-6) and inline Next.js scripts
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://static.cloudflareinsights.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self' https://challenges.cloudflare.com https://cloudflareinsights.com",
              "frame-src https://challenges.cloudflare.com https://js.stripe.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
            ].join("; "),
          },
          // Cross-origin policies — "same-origin-allow-popups" lets Turnstile
          // iframe communicate back; "cross-origin" allows its script/frame loads.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          // XSS protection (legacy browsers)
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // Prevent DNS prefetching leaks
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
    ];
  },

  webpack(config, { isServer }) {
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false };
    }
    return config;
  },
};
module.exports = nextConfig;
