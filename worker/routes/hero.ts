import { Hono } from "hono";
import { GitHubClient, type FileChange } from "../lib/github";
import { submitChange } from "../lib/changes";
import { heroSlideSchema, heroSchema } from "../lib/schemas";
import { z } from "zod";
import { imageUploadSchema, decodeImageUpload, imageUploadErrorMessage } from "../lib/imageUpload";
import { MAX_PORTADA_IMAGE_BYTES, MAX_PORTADA_REQUEST_BYTES, exceedsContentLength, mb } from "../lib/limits";
import { requireAuth } from "../lib/auth";
import type { Env } from "../lib/env";

const HERO_PATH = "data/hero.json";

export const hero = new Hono<{ Bindings: Env }>();
hero.use("*", requireAuth);

hero.get("/", async (c) => {
  const github = new GitHubClient(c.env);
  const raw = await github.readTextFile(HERO_PATH);
  return c.json({ items: raw ? JSON.parse(raw) : [] });
});

// imagen puede venir vacía si el slide trae imagenUpload -- se completa
// después de decodificar y subir el archivo, y se re-valida con
// heroSchema al final sobre el array completo ya resuelto.
const heroItemInputSchema = heroSlideSchema
  .extend({ imagenUpload: imageUploadSchema.nullable().optional() })
  .omit({ imagen: true })
  .extend({ imagen: z.string() });

/** Reemplaza el array completo de slides -- un solo archivo, mismo patrón que un PATCH de propiedad. */
hero.put("/", async (c) => {
  if (exceedsContentLength(c.req.raw, MAX_PORTADA_REQUEST_BYTES)) {
    return c.json(
      { error: `La solicitud excede el máximo permitido (${mb(MAX_PORTADA_REQUEST_BYTES)}).` },
      413
    );
  }

  const body = await c.req.json<{ items?: unknown }>();
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return c.json({ error: "Debe haber al menos un slide" }, 400);
  }

  const files: FileChange[] = [];
  const slides = [];
  for (let idx = 0; idx < body.items.length; idx++) {
    const parsed = heroItemInputSchema.safeParse(body.items[idx]);
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    const { imagenUpload, ...slide } = parsed.data;

    if (imagenUpload) {
      const uploadParsed = imageUploadSchema.safeParse(imagenUpload);
      if (!uploadParsed.success) {
        return c.json({ error: imageUploadErrorMessage(uploadParsed.error) }, 400);
      }
      const { ext, bytes } = decodeImageUpload(uploadParsed.data);
      if (bytes.length > MAX_PORTADA_IMAGE_BYTES) {
        return c.json(
          { error: `La imagen pesa ${mb(bytes.length)}; el máximo permitido es ${mb(MAX_PORTADA_IMAGE_BYTES)}.` },
          413
        );
      }
      const fileName = `hero-${Date.now()}-${idx}.${ext}`;
      slide.imagen = `/img/hero/${fileName}`;
      files.push({ path: `public/img/hero/${fileName}`, content: bytes });
    }

    slides.push(slide);
  }

  const finalParsed = heroSchema.safeParse(slides);
  if (!finalParsed.success) {
    return c.json({ error: finalParsed.error.flatten() }, 400);
  }

  const github = new GitHubClient(c.env);
  const user = c.get("user");
  files.push({ path: HERO_PATH, content: JSON.stringify(finalParsed.data, null, 2) + "\n" });

  const { prNumber } = await submitChange(c.env, github, user, {
    entityType: "hero",
    entityId: "carrusel-inicio",
    actionType: "edit",
    summary: "Actualizar carrusel de Inicio",
    files,
  });

  return c.json({ prNumber });
});
