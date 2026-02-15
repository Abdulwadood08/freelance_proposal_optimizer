import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Use frontend as workspace root (avoids "multiple lockfiles" warning when root has package-lock.json)
  turbopack: {
    root: path.join(__dirname),
  },
  trailingSlash: false,
};

export default nextConfig;
