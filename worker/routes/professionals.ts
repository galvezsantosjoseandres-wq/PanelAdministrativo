import { Hono } from "hono";
import { GitHubClient, type FileChange } from "../lib/github";
import { submitChange } from "../lib/changes";
import { profesionalSchema } from "../lib/schemas";
import { imageUploadSchema, decodeImageUpload } from "../lib/imageUpload";
import { requireAuth } from "../lib/auth";
import type { Env } from "../lib/env";

export const professionals = new Hono<{ Bindings: Env }>();
professionals.use("*", requireAuth);

professionals.post("/", async (c) => {
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
    return c.json({ error: "Foto de perfil inválida" }, 400);
  }

  const files: FileChange[] = [];
  if (uploadParsed?.success) {
    const { ext, bytes } = decodeImageUpload(uploadParsed.data);
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
