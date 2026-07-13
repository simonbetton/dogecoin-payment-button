import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Homepage docs read these sources at runtime via fs; turbopackIgnore in
  // lib/docs-server.ts skips NFT, so include them explicitly for Vercel.
  outputFileTracingIncludes: {
    "/": [
      "./app/api/dogecoin/resolve-address/route.ts",
      "./app/api/dogecoin/mempool/watch/route.ts",
      "./lib/onlydoge.ts",
      "./registry.json",
      "./registry/default/dogecoin-payment-button/**/*",
    ],
  },
};

export default nextConfig;
