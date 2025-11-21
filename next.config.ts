import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  output: 'standalone',
  
  // Production optimizations
  poweredByHeader: false, // Remove X-Powered-By header for security
  compress: true, // Enable gzip compression
  
  // Build optimizations - temporarily ignore ESLint during builds
  eslint: {
    ignoreDuringBuilds: true, // Temporarily ignore ESLint errors during build
  },
  
  typescript: {
    ignoreBuildErrors: false, // Keep TypeScript checking for critical errors
  },
  
  // Image optimization for production
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  
  // Experimental features for Turbopack
  experimental: {
    // Enable modern bundling optimizations for commonly used packages
    optimizePackageImports: ['antd', '@ant-design/icons', 'lucide-react'],
  },
  
  // Server external packages (moved from experimental in Next.js 15)
  serverExternalPackages: ['mysql2', 'prisma', '@prisma/client'],
  
  // Turbopack configuration for optimal performance
  turbopack: {
    // Configure module resolution aliases
    resolveAlias: {
      // Optimize lodash imports for better tree shaking
      'lodash': 'lodash-es',
    },
    
    // Configure file extensions resolution
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
    
    // Custom rules for specific file types (if needed in future)
    rules: {
      // Future: Add custom loaders here if needed
    },
  },
  
  // Headers for security and performance
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0',
          },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  
  // Redirects for better SEO
  async redirects() {
    return [
      {
        source: '/',
        destination: '/dashboard',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
