import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 移除 webpack 配置以避免与 turbopack 冲突
  // Turbopack 会自动处理模块加载顺序
};

export default nextConfig;
