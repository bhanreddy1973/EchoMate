import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Coding workspace API routes are handled by Next.js directly
      // Only proxy non-coding API routes to the Python backend
      {
        source: "/api/token",
        destination: "http://127.0.0.1:8081/api/token",
      },
      {
        source: "/api/chat",
        destination: "http://127.0.0.1:8081/api/chat",
      },
      {
        source: "/api/coding/context",
        destination: "http://127.0.0.1:8081/api/coding/context",
      },
      {
        source: "/api/memories/:path*",
        destination: "http://127.0.0.1:8081/api/memories/:path*",
      },
      {
        source: "/api/conversations/:path*",
        destination: "http://127.0.0.1:8081/api/conversations/:path*",
      },
      {
        source: "/api/connectors/:path*",
        destination: "http://127.0.0.1:8081/api/connectors/:path*",
      },
    ];
  },
};

export default nextConfig;
