import { Hono } from "hono";
import { GitHubClient, type FileChange } from "../lib/github";
import { submitChange } from "../lib/changes";
import { profesionalSchema } from "../lib/schemas";
import { imageUploadSchema, decodeImageUpload, imageUploadErrorMessage } from "../lib/imageUpload";
import { MAX_PORTADA_IMAGE_BYTES, MAX_PORTADA_REQUEST_BYTES, exceedsContentLength, mb } from "../lib/limits";
import { requireAuth } from "../lib/auth";
import type { Env } from "../lib/env";

export const professionals = new Hono<{ Bindings: Env }>();
professionals.use("*", requireAuth);

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
