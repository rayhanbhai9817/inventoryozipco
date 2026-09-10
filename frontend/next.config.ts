import type { NextConfig } from 'next';

/**
 * Security headers applied to every response. These are intentionally
 * conservative defaults for a SaaS dashboard; the CSP allows the Laravel API
 * origin so the browser can talk to the backend directly.
 */
const apiOrigin = (() => {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api/v1';
  try {
    return new URL(raw).origin;
  } catch {
    return '';
  }
})();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "img-src 'self' data: blob:",
              "font-src 'self' https://fonts.gstatic.com data:",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Next.js injects inline bootstrap scripts; dev additionally needs eval.
              process.env.NODE_ENV === 'production'
                ? "script-src 'self' 'unsafe-inline'"
                : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              ["connect-src 'self'", apiOrigin].filter(Boolean).join(' '),
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
