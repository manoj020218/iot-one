import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: {
      "@jenix/shared": resolve(__dirname, "../../../packages/shared/src/index.ts"),
      "@jenix/device-schemas": resolve(
        __dirname,
        "../../../packages/device-schemas/src/index.ts"
      )
    }
  },
  test: {
    include: ["src/**/*.test.ts"]
  }
});
