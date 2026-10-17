import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.VERCEL ? '.next' : process.env.NEXT_BUILD_DIR || '.next-native',

};

export default nextConfig;




