import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    globalSetup: "./test/global-setup.ts",
    // Integration tests share one database — keep files sequential.
    fileParallelism: false,
    testTimeout: 30_000,
    env: {
      DATABASE_URL: "postgres://localhost:5432/thesis_management_test",
      JWT_SECRET: "test-secret-at-least-16-chars",
      JWT_TTL: "1h",
      DEMO_PASSWORD: "Password123!",
      ALLOW_DEMO_RESET: "true",
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/db/migrations/**"],
    },
  },
  resolve: {
    alias: {
      "@shared": new URL("../web/src/lib", import.meta.url).pathname,
      "@": new URL("../web/src", import.meta.url).pathname,
    },
  },
})
