/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile workspace packages (TypeScript source, not pre-built)
  transpilePackages: ["@ai-comms-agent/agent-core", "@ai-comms-agent/shared", "@ai-comms-agent/db"],

  // Workspace packages need to be transpiled by Next.js
  experimental: {
    externalDir: true,
  },

  // Environment variables exposed to the browser (NEXT_PUBLIC_*)
  // Server-only vars (SUPABASE_SERVICE_ROLE_KEY, CREDENTIALS_MASTER_KEY, etc.)
  // are NEVER exposed here.

  eslint: {
    // Don't lint during build (we lint separately)
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
