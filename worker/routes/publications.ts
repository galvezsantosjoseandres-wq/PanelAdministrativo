import { Hono } from "hono";
import { GitHubClient, type FileChange } from "../lib/github";
import { submitChange } from "../lib/changes";
import { publicacionSchema } from "../lib/schemas";
import { listProfesionalSlugs } from "../lib/entities";
import { imageUploadSchema, decodeImageUpload, imageUploadErrorMessage } from "../lib/imageUpload";
import { MAX_PORTADA_IMAGE_BYTES, MAX_PORTADA_REQUEST_BYTES, exceedsContentLength, mb } from "../lib/limits";
import { parseSlugParam } from "../lib/validation";
import { requireAuth } from "../lib/auth";
import type { Env } from "../lib/env";

export const publications = new Hono<{ Bindings: Env }>();
publications.use("*", requireAuth);

publications.get("/", async (c) => {
  const github = new GitHubClient(c.env);
  const entries = await github.listDir("data/publicaciones");
  const items = await Promise.all(
    entries
      .filter((e) => e.type === "file" && e.name.endsWith(".json"))
      .map(async (e) => {
        const raw = await github.readTextFile(`data/publicaciones/${e.name}`);
        return raw ? JSON.parse(raw) : null;
      })
  );
  return c.json({ items: items.filter(Boolean) });
});

publications.get("/:slug", async (c) => {
  const slug = parseSlugParam(c.req.param("slug"));
  if (!slug) return c.json({ error: "Slug inválido" }, 400);

  const github = new GitHubClient(c.env);
  const raw = await github.readTextFile(`data/publicaciones/${slug}.json`);
  if (!raw) return c.json({ error: "No encontrada" }, 404);
  return c.json(JSON.parse(raw));
});

/** Toggle rápido de visibilidad desde el listado. */
publications.patch("/:slug", async (c) => {
  const slug = parseSlugParam(c.req.param("slug"));
  if (!slug) return c.json({ error: "Slug inválido" }, 400);

  const body = await c.req.json<{ visible?: boolean }>();
  const github = new GitHubClient(c.env);
  const path = `data/publicaciones/${slug}.json`;
  const raw = await github.readTextFile(path);
  if (!raw) return c.json({ error: "No encontrada" }, 404);

  const current = publicacionSchema.parse(JSON.parse(raw));
  const updated = { ...current, ...(body.visible !== undefined ? { visible: body.visible } : {}) };

  const user = c.get("user");
  const { prNumber } = await submitChange(c.env, github, user, {
    entityType: "publicacion",
    entityId: slug,
    actionType: "hide",
    summary: `${body.visible ? "Publicar" : "Ocultar de producción"}: ${current.titulo}`,
    files: [{ path, content: JSON.stringify(updated, null, 2) + "\n" }],
  });

  return c.json({ prNumber });
});

publications.delete("/:slug", async (c) => {
  const slug = parseSlugParam(c.req.param("slug"));
  if (!slug) return c.json({ error: "Slug inválido" }, 400);

  const github = new GitHubClient(c.env);
  const path = `data/publicaciones/${slug}.json`;
  const raw = await github.readTextFile(path);
  if (!raw) return c.json({ error: "No encontrada" }, 404);
  const current = publicacionSchema.parse(JSON.parse(raw));

  const deletePaths = [path];
  // Limitación conocida: si imagen_portada no matchea este prefijo (ej.
  // sigue apuntando a la imagen por defecto de la categoría, o fue
  // asignada manualmente fuera de convención), esa imagen NO se borra y
  // queda huérfana en el repo. No se resuelve acá, solo documentado.
  const propioPrefijo = `/img/publicaciones/${slug}.`;
  if (current.imagen_portada?.startsWith(propioPrefijo)) {
    deletePaths.push(`public${current.imagen_portada}`);
  }

  const user = c.get("user");
  const { prNumber } = await submitChange(c.env, github, user, {
    entityType: "publicacion",
    entityId: slug,
    actionType: "delete",
    summary: `Eliminar publicación: ${current.titulo}`,
    files: [],
    deletePaths,
  });

  return c.json({ prNumber });
});

publications.post("/", async (c) => {
  if (exceedsContentLength(c.req.raw, MAX_PORTADA_REQUEST_BYTES)) {
    return c.json(
      { error: `La solicitud excede el máximo permitido (${mb(MAX_PORTADA_REQUEST_BYTES)}).` },
      413
    );
  }

  const body = await c.req.json();
  const { portadaUpload, ...rest } = body ?? {};

  const parsed = publicacionSchema.safeParse(rest);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  const publicacion = parsed.data;

  const uploadParsed = portadaUpload
    ? imageUploadSchema.safeParse(portadaUpload)
    : null;
  if (uploadParsed && !uploadParsed.success) {
    return c.json({ error: imageUploadErrorMessage(uploadParsed.error) }, 400);
  }

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
    const imagePath = `public/img/publicaciones/${publicacion.slug}.${ext}`;
    publicacion.imagen_portada = `/img/publicaciones/${publicacion.slug}.${ext}`;
    files.push({ path: imagePath, content: bytes });
  }

  const user = c.get("user");
  const path = `data/publicaciones/${publicacion.slug}.json`;
  const existing = await github.readTextFile(path);
  const actionType = existing ? "edit" : "create";

  files.push({ path, content: JSON.stringify(publicacion, null, 2) + "\n" });

  const { prNumber } = await submitChange(c.env, github, user, {
    entityType: "publicacion",
    entityId: publicacion.slug,
    actionType,
    summary: `${actionType === "create" ? "Nueva publicación" : "Editar publicación"}: ${publicacion.titulo}`,
    files,
  });

  return c.json({ prNumber }, 201);
});
