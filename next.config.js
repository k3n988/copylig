/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: '/triage',  destination: '/queue',  permanent: true },
      { source: '/dispatch', destination: '/assets', permanent: true },
    ]
  },
}

module.exports = nextConfig
