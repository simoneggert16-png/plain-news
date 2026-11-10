const isDev = process.env.NODE_ENV !== 'production';

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://va.vercel-scripts.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com https:",
  "frame-src 'self' https://plain-maven.vercel.app https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://plain-maven.vercel.app https://vitals.vercel-insights.com${isDev ? ' ws: http:' : ''}`,
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Article JSON is read from disk at build time (fallback when Supabase is not
  // configured); keep the snapshot available to server functions.
  outputFileTracingIncludes: {
    '/**': ['./content/**/*'],
  },
  outputFileTracingExcludes: {
    '/**': ['./maven/**/*', './remotion/**/*', './social_content/**/*', './public/footage/**/*'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
          { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
        ],
      },
    ];
  },
};

export default nextConfig;
