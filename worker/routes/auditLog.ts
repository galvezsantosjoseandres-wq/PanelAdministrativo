import { Hono } from "hono";
import { requireAuth } from "../lib/auth";
import type { Env } from "../lib/env";

export const auditLog = new Hono<{ Bindings: Env }>();
auditLog.use("*", requireAuth);

auditLog.get("/", async (c) => {
  const userEmail = c.req.query("usuario");
  const entityType = c.req.query("seccion");
  const from = c.req.query("desde");
  const to = c.req.query("hasta");
  const limit = Math.min(Number(c.req.query("limite") ?? 50), 200);

  const conditions: string[] = [];
  const params: unknown[] = [];
  if (userEmail) {
    conditions.push("user_email = ?");
    params.push(userEmail);
  }
  if (entityType) {
    conditions.push("entity_type = ?");
    params.push(entityType);
  }
  if (from) {
    conditions.push("created_at >= ?");
    params.push(from);
  }
  if (to) {
    conditions.push("created_at <= ?");
    params.push(to);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT ?`
  )
    .bind(...params, limit)
    .all();

  return c.json({ items: results });
});
