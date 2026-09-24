import { applyD1Migrations, env } from "cloudflare:test";

// Aplica migrations/0001_init.sql al D1 local de Miniflare antes de cada
// archivo de test de esta capa -- así los tests de integración escriben
// contra el mismo esquema real (users, pending_changes, audit_log) que
// usa producción, sin tocar la base real de Cloudflare.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
