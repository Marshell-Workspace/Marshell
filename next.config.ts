import createNextIntlPlugin from "@workspace/i18n/plugin";
import type { NextConfig } from "next";

// For Tauri static export, configure next-intl without server-side request config
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: process.env.NODE_ENV === "production" ? "export" : undefined,
  trailingSlash: false,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_IS_NATIVE: "true",
  },
  transpilePackages: ["@workspace/ui", "@workspace/core", "@workspace/i18n"],
};

export default withNextIntl(nextConfig) as NextConfig;
