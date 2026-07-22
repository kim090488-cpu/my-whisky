import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

function buildCsp(): string {
  const supabaseConnect = ["https://*.supabase.co", "wss://*.supabase.co"].join(" ");
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseConnect}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

const securityHeaders = [
  { key: "Content-Security-Policy", value: buildCsp() },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=(), camera=(), microphone=(), payment=(), usb=()" },
  { key: "X-XSS-Protection", value: "0" },
];

if (!isDev) {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  });
}

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
