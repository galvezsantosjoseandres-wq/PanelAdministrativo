import { Hono } from "hono";
import { GitHubClient } from "../lib/github";
import { submitChange } from "../lib/changes";
import { publicacionSchema } from "../lib/schemas";
import { listProfesionalSlugs } from "../lib/entities";
import { requireAuth } from "../lib/auth";
import type { Env } from "../lib/env";

export const publications = new Hono<{ Bindings: Env }>();
publications.use("*", requireAuth);

publications.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = publicacionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  const publicacion = parsed.data;
  const github = new GitHubClient(c.env);

  const profesionales = await listProfesionalSlugs(github);
  if (!profesionales.has(publicacion.autor_id)) {
    return c.json(
      {
        error: `El autor "${publicacion.autor_id}" no existe en el equipo. Regístralo primero en Equipo.`,
      },
      400
    );
  }

  const user = c.get("user");
  const path = `data/publicaciones/${publicacion.slug}.json`;
  const existing = await github.readTextFile(path);
  const actionType = existing ? "edit" : "create";

  const { prNumber } = await submitChange(c.env, github, user, {
    entityType: "publicacion",
    entityId: publicacion.slug,
    actionType,
    summary: `${actionType === "create" ? "Nueva publicación" : "Editar publicación"}: ${publicacion.titulo}`,
    files: [
      { path, content: JSON.stringify(publicacion, null, 2) + "\n" },
    ],
  });

  return c.json({ prNumber }, 201);
});
