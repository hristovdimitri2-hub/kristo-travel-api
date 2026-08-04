/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/.well-known/x402.json',
        destination: '/well-known/x402.json',
      },
    ];
  },
};

module.exports = nextConfig;
