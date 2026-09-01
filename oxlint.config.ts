import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";
import vitest from "ultracite/oxlint/vitest";

export default defineConfig({
  extends: [core, react, next, vitest],
  ignorePatterns: [
    ...(core.ignorePatterns ?? []),
    "components/ui/**",
    "lib/utils.ts",
    "public/r/**",
    ".next/**",
  ],
  rules: {
    // Address discovery must query candidates sequentially with pacing.
    "eslint/no-await-in-loop": "off",
    // Local QR SVG encoder output is trusted.
    "react/no-danger": "off",
  },
});
