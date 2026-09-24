import { Hono } from "hono";
import { GitHubClient, type FileChange } from "../lib/github";
import { submitChange } from "../lib/changes";
import { cursoAcademySchema } from "../lib/schemas";
import { listProfesionalSlugs } from "../lib/entities";
import { imageUploadSchema, decodeImageUpload } from "../lib/imageUpload";
import { requireAuth } from "../lib/auth";
import type { Env } from "../lib/env";

export const academy = new Hono<{ Bindings: Env }>();
academy.use("*", requireAuth);

academy.post("/", async (c) => {
  const body = await c.req.json();
  const { portadaUpload, ...rest } = body ?? {};

  const parsed = cursoAcademySchema.safeParse(rest);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  const curso = parsed.data;

  const uploadParsed = portadaUpload
    ? imageUploadSchema.safeParse(portadaUpload)
    : null;
  if (uploadParsed && !uploadParsed.success) {
    return c.json({ error: "Imagen de portada inválida" }, 400);
  }

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

  const files: FileChange[] = [];
  if (uploadParsed?.success) {
    const { ext, bytes } = decodeImageUpload(uploadParsed.data);
    const imagePath = `public/img/academy/cursos/${curso.id}/portada.${ext}`;
    curso.imagen_portada = `/img/academy/cursos/${curso.id}/portada.${ext}`;
    files.push({ path: imagePath, content: bytes });
  }

  const user = c.get("user");
  const path = `data/academy/${curso.id}.json`;
  const existing = await github.readTextFile(path);
  const actionType = existing ? "edit" : "create";

  files.push({ path, content: JSON.stringify(curso, null, 2) + "\n" });

  const { prNumber } = await submitChange(c.env, github, user, {
    entityType: "curso",
    entityId: curso.id,
    actionType,
    summary: `${actionType === "create" ? "Nuevo curso de Academy" : "Editar curso de Academy"}: ${curso.titulo}`,
    files,
  });

  return c.json({ prNumber }, 201);
});
