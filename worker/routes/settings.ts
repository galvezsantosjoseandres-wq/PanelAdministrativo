import { Hono } from "hono";
import { requireAuth, requireOwner } from "../lib/auth";
import { addEmailToAccessPolicy, removeEmailFromAccessPolicy } from "../lib/access";
import type { Env, Role } from "../lib/env";

export const settings = new Hono<{ Bindings: Env }>();
settings.use("*", requireAuth);

settings.get("/usuarios", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT email, role, invited_by, created_at FROM users ORDER BY created_at ASC`
  ).all();
  return c.json({ items: results });
});

settings.post("/usuarios", requireOwner, async (c) => {
  const body = await c.req.json<{ email: string; role: Role }>();
  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return c.json({ error: "Email inválido" }, 400);
  }
  if (body.role !== "propietario" && body.role !== "colaborador") {
    return c.json({ error: "Rol inválido" }, 400);
  }

  const user = c.get("user");
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO users (email, role, invited_by, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET role = excluded.role`
  )
    .bind(email, body.role, user.email, now)
    .run();

  // Sincronía automática con la política de Access -- si esto falla, el
  // usuario queda en D1 pero SIN acceso real todavía; se lo avisamos al
  // Propietario en la respuesta en vez de fallar en silencio.
  let accessSynced = true;
  try {
    await addEmailToAccessPolicy(c.env, email);
  } catch {
    accessSynced = false;
  }

  await c.env.DB.prepare(
    `INSERT INTO audit_log (user_email, role, action_type, entity_type, entity_id, summary, created_at)
     VALUES (?, ?, 'invite_user', 'usuario', ?, ?, ?)`
  )
    .bind(user.email, user.role, email, `Invitar/actualizar usuario ${email} como ${body.role}`, now)
    .run();

  return c.json({ ok: true, accessSynced });
});

settings.delete("/usuarios/:email", requireOwner, async (c) => {
  const email = c.req.param("email").toLowerCase();
  const user = c.get("user");

  const target = await c.env.DB.prepare(
    `SELECT email, role FROM users WHERE email = ?`
  )
    .bind(email)
    .first<{ email: string; role: Role }>();
  if (!target) return c.json({ error: "No encontrado" }, 404);
  if (target.role === "propietario") {
    return c.json({ error: "El Propietario no se puede quitar" }, 400);
  }

  await c.env.DB.prepare(`DELETE FROM users WHERE email = ?`).bind(email).run();

  let accessSynced = true;
  try {
    await removeEmailFromAccessPolicy(c.env, email);
  } catch {
    accessSynced = false;
  }

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO audit_log (user_email, role, action_type, entity_type, entity_id, summary, created_at)
     VALUES (?, ?, 'remove_user', 'usuario', ?, ?, ?)`
  )
    .bind(user.email, user.role, email, `Quitar acceso a ${email}`, now)
    .run();

  return c.json({ ok: true, accessSynced });
});
