import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable Next.js DevTools overlay in development
  devIndicators: {
    appIsrStatus: false,
    buildActivity: false,
    buildActivityPosition: 'bottom-right',
  },
  // Disable the new Next.js 16 devtools
  devtools: {
    enabled: false,
  },
};

export default nextConfig;
