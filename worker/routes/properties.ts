import { Hono } from "hono";
import { GitHubClient } from "../lib/github";
import { submitChange } from "../lib/changes";
import { propiedadSchema } from "../lib/schemas";
import {
  GalleryValidationError,
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

interface GalleryUploadItem {
  ext: string;
  existingName?: string;
  existingBlobSha?: string;
  /** base64, solo para fotos nuevas */
  newContentBase64?: string;
  /** base64, solo para videos nuevos -- se sube a R2 antes de commitear */
  newVideoBase64?: string;
}

properties.post("/:slug/galeria", async (c) => {
  const slug = c.req.param("slug");
  const body = await c.req.json<{ items: GalleryUploadItem[] }>();
  const github = new GitHubClient(c.env);
  const user = c.get("user");
  const folderPath = `public/img/propiedades/${slug}`;

  const currentEntries = await github.listDir(folderPath);

  const r2Uploads: { key: string; data: Uint8Array }[] = [];
  const items: GalleryItemInput[] = body.items.map((item, idx) => {
    if (item.existingName) {
      return {
        ext: item.ext,
        existingName: item.existingName,
        existingBlobSha: item.existingBlobSha,
      };
    }
    if (item.newContentBase64) {
      return {
        ext: item.ext,
        newContent: base64ToUint8Array(item.newContentBase64),
      };
    }
    if (item.newVideoBase64) {
      const key = `lefinor/propiedades/${slug}/${idx + 1}.${item.ext.toLowerCase()}`;
      r2Uploads.push({ key, data: base64ToUint8Array(item.newVideoBase64) });
      return { ext: item.ext, newVideoObjectKey: key };
    }
    throw new GalleryValidationError(
      `Ítem de galería incompleto en la posición ${idx + 1}`
    );
  });

  let plan;
  try {
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

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
