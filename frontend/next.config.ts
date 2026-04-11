import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: 'standalone',
  async rewrites() {
    return [
      {
        // Docker 部署时 backend 是服务名；本地开发设 API_URL=http://localhost:8080 到 .env.local
        source: '/api/:path*',
        destination: `${process.env.API_URL || "http://backend:8080"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
