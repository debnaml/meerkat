import type { NextConfig } from "next";
import path from "node:path";

const workspaceRoot = path.join(__dirname, "..", "..");

const nextConfig: NextConfig = {
  turbopack: {
    root: workspaceRoot,
  },
};

export default nextConfig;
