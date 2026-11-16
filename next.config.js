/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
};

if (process.env.DOCKER_BUILD === '1') {
  nextConfig.output = 'standalone';
}

module.exports = nextConfig;
