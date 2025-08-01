import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 移除 webpack 配置以避免与 turbopack 冲突
  // Turbopack 会自动处理模块加载顺序
  
  // Enable standalone output for Docker deployment
  output: 'standalone',
  
  // Disable ESLint during build for Docker
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Disable TypeScript checking during build for Docker
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Experimental features for better Docker support
  experimental: {
    // 移除不支持的 logging 配置以避免构建警告
  },
};

export default nextConfig;
