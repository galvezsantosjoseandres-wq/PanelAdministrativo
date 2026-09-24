import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // *.integration.test.ts corre aparte, sobre Miniflare real
    // (vitest.integration.config.ts / npm run test:integration) -- acá
    // rompería porque importa "cloudflare:test", que solo existe dentro
    // del pool de Workers.
    include: ["worker/**/*.test.ts"],
    exclude: ["**/*.integration.test.ts", "**/node_modules/**"],
  },
});
