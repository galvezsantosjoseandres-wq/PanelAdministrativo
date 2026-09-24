import { Hono } from "hono";
import { GitHubClient } from "../lib/github";
import { submitChange } from "../lib/changes";
import { propiedadSchema } from "../lib/schemas";
import {
  GalleryValidationError,
  kindForExt,
  parseGalleryFileName,
  planGallery,
  type GalleryItemInput,
} from "../lib/gallery";
import { requireAuth } from "../lib/auth";
import type { Env } from "../lib/env";

export const properties = new Hono<{ Bindings: Env }>();
properties.use("*", requireAuth);

properties.get("/", async (c) => {
  const github = new GitHubClient(c.env);
  const entries = await github.listDir("data/propiedades");
  const items = await Promise.all(
    entries
      .filter((e) => e.type === "file" && e.name.endsWith(".json"))
      .map(async (e) => {
        const raw = await github.readTextFile(`data/propiedades/${e.name}`);
        return raw ? JSON.parse(raw) : null;
      })
  );
  return c.json({ items: items.filter(Boolean) });
});

properties.get("/:slug", async (c) => {
  const github = new GitHubClient(c.env);
  const raw = await github.readTextFile(
    `data/propiedades/${c.req.param("slug")}.json`
  );
  if (!raw) return c.json({ error: "No encontrada" }, 404);
  return c.json(JSON.parse(raw));
});

/** Toggle rápido de destacar/ocultar desde el listado, sin pasar por el formulario completo. */
properties.patch("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const body = await c.req.json<{ destacada?: boolean; visible?: boolean }>();
  const github = new GitHubClient(c.env);
  const path = `data/propiedades/${slug}.json`;
  const raw = await github.readTextFile(path);
  if (!raw) return c.json({ error: "No encontrada" }, 404);

  const current = propiedadSchema.parse(JSON.parse(raw));
  const updated = {
    ...current,
    ...(body.destacada !== undefined ? { destacada: body.destacada } : {}),
    ...(body.visible !== undefined ? { visible: body.visible } : {}),
  };

  const actionType =
    body.destacada !== undefined ? "destacar" : "hide";
  const summary =
    body.destacada !== undefined
      ? `${body.destacada ? "Destacar" : "Quitar de destacadas"}: ${current.titulo}`
      : `${body.visible ? "Mostrar" : "Ocultar"}: ${current.titulo}`;

  const user = c.get("user");
  const { prNumber } = await submitChange(c.env, github, user, {
    entityType: "propiedad",
    entityId: slug,
    actionType,
    summary,
    files: [{ path, content: JSON.stringify(updated, null, 2) + "\n" }],
  });

  return c.json({ prNumber });
});

properties.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = propiedadSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  const propiedad = parsed.data;
  // El generador calcula galeria/portada solo -- nunca se escriben acá.
  const github = new GitHubClient(c.env);
  const user = c.get("user");
  const path = `data/propiedades/${propiedad.slug}.json`;

  const existing = await github.readTextFile(path);
  const actionType = existing ? "edit" : "create";

  const { prNumber } = await submitChange(c.env, github, user, {
    entityType: "propiedad",
    entityId: propiedad.slug,
    actionType,
    summary: `${actionType === "create" ? "Nueva propiedad" : "Editar propiedad"}: ${propiedad.titulo}`,
    files: [
      {
        path,
        content: JSON.stringify(propiedad, null, 2) + "\n",
      },
    ],
  });

  return c.json({ prNumber }, 201);
});

interface GalleryPreviewItem {
  position: number;
  ext: string;
  kind: "foto" | "video";
  name: string;
  blobSha: string;
  previewUrl: string | null;
}

/** Estado actual de la galería para pintar el editor sin adivinar nada. */
properties.get("/:slug/galeria", async (c) => {
  const slug = c.req.param("slug");
  const github = new GitHubClient(c.env);
  const folderPath = `public/img/propiedades/${slug}`;
  const entries = await github.listDir(folderPath);

  const items: GalleryPreviewItem[] = [];
  for (const entry of entries) {
    if (entry.type !== "file") continue;
    const parsed = parseGalleryFileName(entry.name);
    if (!parsed) continue; // archivo ajeno a la convención (ej. .gitkeep)

    const kind = parsed.isPointer ? "video" : "foto";
    const previewUrl = parsed.isPointer
      ? await github.readTextFile(`${folderPath}/${entry.name}`)
      : await github.getDownloadUrl(`${folderPath}/${entry.name}`);

    items.push({
      position: parsed.position,
      ext: parsed.ext,
      kind,
      name: entry.name,
      blobSha: entry.sha,
      previewUrl,
    });
  }
  items.sort((a, b) => a.position - b.position);

  return c.json({ items });
});

/**
 * multipart/form-data: campo `order` (JSON con el orden final de la
 * galería) + partes `file-<index>` para cada ítem nuevo -- los videos
 * pueden pesar cientos de MB, así que viajan binarios, nunca como base64
 * dentro de un JSON que el Worker tendría que parsear entero en memoria.
 */
interface GalleryOrderItem {
  ext: string;
  existingName?: string;
  existingBlobSha?: string;
  isNew?: boolean;
}

properties.post("/:slug/galeria", async (c) => {
  const slug = c.req.param("slug");
  const form = await c.req.parseBody({ all: true });

  const orderRaw = form["order"];
  if (typeof orderRaw !== "string") {
    return c.json({ error: "Falta el campo 'order' con el orden de la galería" }, 400);
  }
  let order: GalleryOrderItem[];
  try {
    order = JSON.parse(orderRaw);
  } catch {
    return c.json({ error: "'order' no es JSON válido" }, 400);
  }

  const github = new GitHubClient(c.env);
  const user = c.get("user");
  const folderPath = `public/img/propiedades/${slug}`;
  const currentEntries = await github.listDir(folderPath);

  const r2Uploads: { key: string; data: Uint8Array }[] = [];
  const items: GalleryItemInput[] = [];
  let plan;
  try {
    for (let idx = 0; idx < order.length; idx++) {
      const item = order[idx];
      if (!item.isNew) {
        if (!item.existingName) {
          throw new GalleryValidationError(
            `Ítem existente sin nombre en la posición ${idx + 1}`
          );
        }
        items.push({
          ext: item.ext,
          existingName: item.existingName,
          existingBlobSha: item.existingBlobSha,
        });
        continue;
      }

      const file = form[`file-${idx}`];
      if (!(file instanceof File)) {
        throw new GalleryValidationError(
          `Falta el archivo para la posición ${idx + 1}`
        );
      }
      const bytes = new Uint8Array(await file.arrayBuffer());

      if (kindForExt(item.ext) === "video") {
        const key = `lefinor/propiedades/${slug}/${idx + 1}.${item.ext.toLowerCase()}`;
        r2Uploads.push({ key, data: bytes });
        items.push({ ext: item.ext, newVideoObjectKey: key });
      } else {
        items.push({ ext: item.ext, newContent: bytes });
      }
    }

    plan = planGallery(slug, items, c.env.R2_PUBLIC_BASE_URL, currentEntries);
  } catch (err) {
    if (err instanceof GalleryValidationError) {
      return c.json({ error: err.message }, 400);
    }
    throw err;
  }

  // Subir videos a R2 ANTES de commitear los punteros -- si esto falla no
  // queremos un .url apuntando a un objeto que nunca se subió.
  for (const upload of r2Uploads) {
    await c.env.R2_BUCKET.put(upload.key, upload.data);
  }

  const { prNumber } = await submitChange(c.env, github, user, {
    entityType: "propiedad",
    entityId: slug,
    actionType: "edit",
    summary: `Actualizar galería de fotos/video: ${slug}`,
    files: plan.files,
    deletePaths: plan.deletePaths,
  });

  return c.json({ prNumber }, 200);
});
