import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent an unrelated lockfile higher in the home directory from becoming
  // Turbopack's workspace root.
  turbopack: {
    root: process.cwd(),
  },
  // Keep napi-rs and its platform-specific binary in Node's module loader.
  // Bundling it through Turbopack prevents the optional native package from
  // being resolved at runtime.
  serverExternalPackages: ["@firecrawl/pdf-inspector"],
};

export default nextConfig;
