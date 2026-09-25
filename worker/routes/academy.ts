import { Hono } from "hono";
import { GitHubClient, type FileChange } from "../lib/github";
import { submitChange } from "../lib/changes";
import { cursoAcademySchema } from "../lib/schemas";
import { listProfesionalSlugs } from "../lib/entities";
import { imageUploadSchema, decodeImageUpload, imageUploadErrorMessage } from "../lib/imageUpload";
import { MAX_PORTADA_IMAGE_BYTES, MAX_PORTADA_REQUEST_BYTES, exceedsContentLength, mb } from "../lib/limits";
import { parseSlugParam } from "../lib/validation";
import { requireAuth } from "../lib/auth";
import type { Env } from "../lib/env";

export const academy = new Hono<{ Bindings: Env }>();
academy.use("*", requireAuth);

academy.get("/", async (c) => {
  const github = new GitHubClient(c.env);
  const entries = await github.listDir("data/academy");
  const items = await Promise.all(
    entries
      .filter((e) => e.type === "file" && e.name.endsWith(".json"))
      .map(async (e) => {
        const raw = await github.readTextFile(`data/academy/${e.name}`);
        return raw ? JSON.parse(raw) : null;
      })
  );
  return c.json({ items: items.filter(Boolean) });
});

academy.get("/:id", async (c) => {
  const id = parseSlugParam(c.req.param("id"));
  if (!id) return c.json({ error: "Id inválido" }, 400);

  const github = new GitHubClient(c.env);
  const raw = await github.readTextFile(`data/academy/${id}.json`);
  if (!raw) return c.json({ error: "No encontrado" }, 404);
  return c.json(JSON.parse(raw));
});

/** Toggle rápido de destacar/visibilidad desde el listado. */
academy.patch("/:id", async (c) => {
  const id = parseSlugParam(c.req.param("id"));
  if (!id) return c.json({ error: "Id inválido" }, 400);

  const body = await c.req.json<{ destacado?: boolean; visible?: boolean }>();
  const github = new GitHubClient(c.env);
  const path = `data/academy/${id}.json`;
  const raw = await github.readTextFile(path);
  if (!raw) return c.json({ error: "No encontrado" }, 404);

  const current = cursoAcademySchema.parse(JSON.parse(raw));
  const updated = {
    ...current,
    ...(body.destacado !== undefined ? { destacado: body.destacado } : {}),
    ...(body.visible !== undefined ? { visible: body.visible } : {}),
  };

  const actionType = body.destacado !== undefined ? "destacar" : "hide";
  const summary =
    body.destacado !== undefined
      ? `${body.destacado ? "Destacar" : "Quitar de destacados"}: ${current.titulo}`
      : `${body.visible ? "Publicar" : "Ocultar de producción"}: ${current.titulo}`;

  const user = c.get("user");
  const { prNumber } = await submitChange(c.env, github, user, {
    entityType: "curso",
    entityId: id,
    actionType,
    summary,
    files: [{ path, content: JSON.stringify(updated, null, 2) + "\n" }],
  });

  return c.json({ prNumber });
});

academy.delete("/:id", async (c) => {
  const id = parseSlugParam(c.req.param("id"));
  if (!id) return c.json({ error: "Id inválido" }, 400);

  const github = new GitHubClient(c.env);
  const path = `data/academy/${id}.json`;
  const raw = await github.readTextFile(path);
  if (!raw) return c.json({ error: "No encontrado" }, 404);
  const current = cursoAcademySchema.parse(JSON.parse(raw));

  const deletePaths = [path];
  // Limitación conocida: si imagen_portada no matchea este prefijo, esa
  // imagen NO se borra y queda huérfana en el repo. No se resuelve acá,
  // solo documentado (mismo caso que publications.ts/professionals.ts).
  const propioPrefijo = `/img/academy/cursos/${id}/portada.`;
  if (current.imagen_portada?.startsWith(propioPrefijo)) {
    deletePaths.push(`public${current.imagen_portada}`);
  }

  const user = c.get("user");
  const { prNumber } = await submitChange(c.env, github, user, {
    entityType: "curso",
    entityId: id,
    actionType: "delete",
    summary: `Eliminar curso de Academy: ${current.titulo}`,
    files: [],
    deletePaths,
  });

  return c.json({ prNumber });
});

academy.post("/", async (c) => {
  if (exceedsContentLength(c.req.raw, MAX_PORTADA_REQUEST_BYTES)) {
    return c.json(
      { error: `La solicitud excede el máximo permitido (${mb(MAX_PORTADA_REQUEST_BYTES)}).` },
      413
    );
  }

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
    return c.json({ error: imageUploadErrorMessage(uploadParsed.error) }, 400);
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
    if (bytes.length > MAX_PORTADA_IMAGE_BYTES) {
      return c.json(
        {
          error: `La imagen pesa ${mb(bytes.length)}; el máximo permitido es ${mb(MAX_PORTADA_IMAGE_BYTES)}.`,
        },
        413
      );
    }
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
