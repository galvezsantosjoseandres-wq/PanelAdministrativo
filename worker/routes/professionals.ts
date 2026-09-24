import { Hono } from "hono";
import { GitHubClient, type FileChange } from "../lib/github";
import { submitChange } from "../lib/changes";
import { profesionalSchema } from "../lib/schemas";
import { imageUploadSchema, decodeImageUpload, imageUploadErrorMessage } from "../lib/imageUpload";
import { MAX_PORTADA_IMAGE_BYTES, MAX_PORTADA_REQUEST_BYTES, exceedsContentLength, mb } from "../lib/limits";
import { parseSlugParam } from "../lib/validation";
import { requireAuth } from "../lib/auth";
import type { Env } from "../lib/env";

export const professionals = new Hono<{ Bindings: Env }>();
professionals.use("*", requireAuth);

professionals.get("/", async (c) => {
  const github = new GitHubClient(c.env);
  const entries = await github.listDir("data/profesionales");
  const items = await Promise.all(
    entries
      .filter((e) => e.type === "file" && e.name.endsWith(".json"))
      .map(async (e) => {
        const raw = await github.readTextFile(`data/profesionales/${e.name}`);
        return raw ? JSON.parse(raw) : null;
      })
  );
  return c.json({ items: items.filter(Boolean) });
});

professionals.get("/:slug", async (c) => {
  const slug = parseSlugParam(c.req.param("slug"));
  if (!slug) return c.json({ error: "Slug inválido" }, 400);

  const github = new GitHubClient(c.env);
  const raw = await github.readTextFile(`data/profesionales/${slug}.json`);
  if (!raw) return c.json({ error: "No encontrado" }, 404);
  return c.json(JSON.parse(raw));
});

professionals.delete("/:slug", async (c) => {
  const slug = parseSlugParam(c.req.param("slug"));
  if (!slug) return c.json({ error: "Slug inválido" }, 400);

  const github = new GitHubClient(c.env);
  const path = `data/profesionales/${slug}.json`;
  const raw = await github.readTextFile(path);
  if (!raw) return c.json({ error: "No encontrado" }, 404);
  const current = profesionalSchema.parse(JSON.parse(raw));

  const deletePaths = [path];
  const propioPrefijo = `/img/equipo/${slug}.`;
  if (current.foto?.startsWith(propioPrefijo)) {
    deletePaths.push(`public${current.foto}`);
  }

  const user = c.get("user");
  const { prNumber } = await submitChange(c.env, github, user, {
    entityType: "profesional",
    entityId: slug,
    actionType: "delete",
    summary: `Eliminar profesional: ${current.nombre}`,
    files: [],
    deletePaths,
  });

  return c.json({ prNumber });
});

professionals.post("/", async (c) => {
  if (exceedsContentLength(c.req.raw, MAX_PORTADA_REQUEST_BYTES)) {
    return c.json(
      { error: `La solicitud excede el máximo permitido (${mb(MAX_PORTADA_REQUEST_BYTES)}).` },
      413
    );
  }

  const body = await c.req.json();
  const { fotoUpload, consentimientoTelefonoPersonal, ...rest } = body ?? {};

  const parsed = profesionalSchema.safeParse(rest);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  const profesional = parsed.data;

  if (profesional.telefono_personal) {
    // Requiere consentimiento explícito del profesional (nota del prompt
    // original) -- el panel no puede verificarlo por sí solo, así que se
    // exige una confirmación explícita en el body en vez de asumirla.
    if (!consentimientoTelefonoPersonal) {
      return c.json(
        {
          error:
            "Para guardar un teléfono personal debes confirmar que el profesional dio su consentimiento explícito.",
        },
        400
      );
    }
  }

  const uploadParsed = fotoUpload ? imageUploadSchema.safeParse(fotoUpload) : null;
  if (uploadParsed && !uploadParsed.success) {
    return c.json({ error: imageUploadErrorMessage(uploadParsed.error) }, 400);
  }

  const files: FileChange[] = [];
  if (uploadParsed?.success) {
    const { ext, bytes } = decodeImageUpload(uploadParsed.data);
    if (bytes.length > MAX_PORTADA_IMAGE_BYTES) {
      return c.json(
        {
          error: `La foto pesa ${mb(bytes.length)}; el máximo permitido es ${mb(MAX_PORTADA_IMAGE_BYTES)}.`,
        },
        413
      );
    }
    const imagePath = `public/img/equipo/${profesional.slug}.${ext}`;
    profesional.foto = `/img/equipo/${profesional.slug}.${ext}`;
    files.push({ path: imagePath, content: bytes });
  }

  const github = new GitHubClient(c.env);
  const user = c.get("user");
  const path = `data/profesionales/${profesional.slug}.json`;
  const existing = await github.readTextFile(path);
  const actionType = existing ? "edit" : "create";

  files.push({ path, content: JSON.stringify(profesional, null, 2) + "\n" });

  const { prNumber } = await submitChange(c.env, github, user, {
    entityType: "profesional",
    entityId: profesional.slug,
    actionType,
    summary: `${actionType === "create" ? "Nuevo profesional" : "Editar profesional"}: ${profesional.nombre}`,
    files,
  });

  return c.json({ prNumber }, 201);
});
