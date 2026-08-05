/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/.well-known/x402.json',
        destination: '/well-known/x402.json',
      },
      {
        source: '/api/openapi.json',
        destination: '/openapi.json',
      },
      {
        source: '/api/pricing',
        destination: '/api/stats/public',
      },
    ];
  },
};

module.exports = nextConfig;
