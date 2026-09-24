import path from "node:path";
import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";

// Capa de tests de integración: corre el Worker real (Hono + requireAuth +
// D1) sobre Miniflare, sin tocar Cloudflare real. Complementa (no
// reemplaza) los tests unitarios de vitest.config.ts, que mockean todo
// -- acá solo se mockea GitHubClient (red externa real) y la verificación
// criptográfica de jose (no se puede probar sin infraestructura real de
// Cloudflare Access); requireAuth, el enrutamiento de Hono y las
// escrituras a D1 (pending_changes, audit_log vía submitChange) corren
// de verdad.
const migrationsPath = path.join(__dirname, "migrations");
const migrations = await readD1Migrations(migrationsPath);

export default defineWorkersConfig({
  test: {
    include: ["worker/**/*.integration.test.ts"],
    setupFiles: ["./test/apply-migrations.ts"],
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            // CF_ACCESS_TEAM_DOMAIN/CF_ACCESS_AUD son secretos reales en
            // producción (nunca en wrangler.jsonc) -- acá son solo los
            // valores contra los que el test firma su propio JWT de
            // prueba (ver properties.integration.test.ts), no apuntan a
            // ninguna cuenta real de Cloudflare Access.
            CF_ACCESS_TEAM_DOMAIN: "test-team.cloudflareaccess.com",
            CF_ACCESS_AUD: "test-aud",
          },
        },
      },
    },
  },
});
