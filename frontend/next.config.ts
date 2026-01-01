import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Ensure proper routing for Netlify
  trailingSlash: false,
};

export default nextConfig;
