/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Article JSON is read from disk at build time (fallback when Supabase is not
  // configured); keep the snapshot available to server functions.
  outputFileTracingIncludes: {
    '/**': ['./content/**/*'],
  },
};

export default nextConfig;
