import { Hono } from "hono";
import { GitHubClient } from "../lib/github";
import { submitChange } from "../lib/changes";
import { cursoAcademySchema } from "../lib/schemas";
import { listProfesionalSlugs } from "../lib/entities";
import { requireAuth } from "../lib/auth";
import type { Env } from "../lib/env";

export const academy = new Hono<{ Bindings: Env }>();
academy.use("*", requireAuth);

academy.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = cursoAcademySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  const curso = parsed.data;
  const github = new GitHubClient(c.env);

  const profesionales = await listProfesionalSlugs(github);
  const invalidos = curso.instructor_ids.filter((id) => !profesionales.has(id));
  if (invalidos.length > 0) {
    return c.json(
      {
        error: `Instructor(es) inexistente(s) en el equipo: ${invalidos.join(", ")}`,
      },
      400
    );
  }

  const user = c.get("user");
  const path = `data/academy/${curso.id}.json`;
  const existing = await github.readTextFile(path);
  const actionType = existing ? "edit" : "create";

  const { prNumber } = await submitChange(c.env, github, user, {
    entityType: "curso",
    entityId: curso.id,
    actionType,
    summary: `${actionType === "create" ? "Nuevo curso de Academy" : "Editar curso de Academy"}: ${curso.titulo}`,
    files: [{ path, content: JSON.stringify(curso, null, 2) + "\n" }],
  });

  return c.json({ prNumber }, 201);
});
