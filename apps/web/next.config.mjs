/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Server mode — required for API routes (OAuth callbacks, mail sync, etc.)
  // output: 'standalone' for Cloud Function deployment
  // output: 'export'    for static-only (disables API routes — do NOT use)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
    ],
  },
};

export default nextConfig;
