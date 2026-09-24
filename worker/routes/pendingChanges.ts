import { Hono } from "hono";
import { GitHubClient } from "../lib/github";
import { requireAuth, requireOwner } from "../lib/auth";
import type { Env } from "../lib/env";

export const pendingChanges = new Hono<{ Bindings: Env }>();
pendingChanges.use("*", requireAuth);

interface PendingChangeRow {
  id: number;
  entity_type: string;
  entity_id: string;
  action_type: string;
  summary: string;
  branch_name: string;
  github_pr_number: number;
  status: string;
  preview_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

pendingChanges.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM pending_changes WHERE status = 'pending' ORDER BY created_at DESC`
  ).all<PendingChangeRow>();
  return c.json({ items: results });
});

pendingChanges.get("/recientes", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM pending_changes WHERE status != 'pending' ORDER BY updated_at DESC LIMIT 10`
  ).all<PendingChangeRow>();
  return c.json({ items: results });
});

/** Resuelve/cachea la URL de vista previa del PR bajo demanda. */
pendingChanges.get("/:id/preview", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    `SELECT * FROM pending_changes WHERE id = ?`
  )
    .bind(id)
    .first<PendingChangeRow>();
  if (!row) return c.json({ error: "No encontrado" }, 404);

  if (row.preview_url) return c.json({ previewUrl: row.preview_url });

  const github = new GitHubClient(c.env);
  // el PR guarda su propio head sha; lo resolvemos vía la API en vez de
  // guardarlo aparte, para no arrastrar un dato que puede quedar stale
  // si alguien hace push adicional a la rama fuera del panel.
  const headSha = await github.getPullRequestHeadSha(row.github_pr_number);
  const previewUrl = await github.getPreviewUrl(headSha);
  if (previewUrl) {
    await c.env.DB.prepare(
      `UPDATE pending_changes SET preview_url = ?, updated_at = ? WHERE id = ?`
    )
      .bind(previewUrl, new Date().toISOString(), id)
      .run();
  }
  return c.json({ previewUrl });
});

pendingChanges.post("/:id/publicar", requireOwner, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const row = await c.env.DB.prepare(
    `SELECT * FROM pending_changes WHERE id = ? AND status = 'pending'`
  )
    .bind(id)
    .first<PendingChangeRow>();
  if (!row) return c.json({ error: "No encontrado o ya resuelto" }, 404);

  const github = new GitHubClient(c.env);
  await github.mergePullRequest(row.github_pr_number);

  const now = new Date().toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE pending_changes SET status = 'published', updated_at = ? WHERE id = ?`
    ).bind(now, id),
    c.env.DB.prepare(
      `INSERT INTO audit_log (user_email, role, action_type, entity_type, entity_id, summary, created_at)
       VALUES (?, ?, 'publish', ?, ?, ?, ?)`
    ).bind(user.email, user.role, row.entity_type, row.entity_id, row.summary, now),
  ]);

  return c.json({ ok: true });
});

pendingChanges.post("/:id/descartar", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const row = await c.env.DB.prepare(
    `SELECT * FROM pending_changes WHERE id = ? AND status = 'pending'`
  )
    .bind(id)
    .first<PendingChangeRow>();
  if (!row) return c.json({ error: "No encontrado o ya resuelto" }, 404);

  const github = new GitHubClient(c.env);
  await github.closePullRequest(row.github_pr_number);

  const now = new Date().toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE pending_changes SET status = 'discarded', updated_at = ? WHERE id = ?`
    ).bind(now, id),
    c.env.DB.prepare(
      `INSERT INTO audit_log (user_email, role, action_type, entity_type, entity_id, summary, created_at)
       VALUES (?, ?, 'discard', ?, ?, ?, ?)`
    ).bind(user.email, user.role, row.entity_type, row.entity_id, row.summary, now),
  ]);

  return c.json({ ok: true });
});
