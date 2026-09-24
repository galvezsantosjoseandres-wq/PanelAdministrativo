import { Hono } from "hono";
import { GitHubClient } from "../lib/github";
import { submitChange } from "../lib/changes";
import { profesionalSchema } from "../lib/schemas";
import { requireAuth } from "../lib/auth";
import type { Env } from "../lib/env";

export const professionals = new Hono<{ Bindings: Env }>();
professionals.use("*", requireAuth);

professionals.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = profesionalSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  const profesional = parsed.data;

  if (profesional.telefono_personal) {
    // Requiere consentimiento explícito del profesional (nota del prompt
    // original) -- el panel no puede verificarlo por sí solo, así que se
    // exige una confirmación explícita en el body en vez de asumirla.
    if (!body?.consentimientoTelefonoPersonal) {
      return c.json(
        {
          error:
            "Para guardar un teléfono personal debes confirmar que el profesional dio su consentimiento explícito.",
        },
        400
      );
    }
  }

  const github = new GitHubClient(c.env);
  const user = c.get("user");
  const path = `data/profesionales/${profesional.slug}.json`;
  const existing = await github.readTextFile(path);
  const actionType = existing ? "edit" : "create";

  const { prNumber } = await submitChange(c.env, github, user, {
    entityType: "profesional",
    entityId: profesional.slug,
    actionType,
    summary: `${actionType === "create" ? "Nuevo profesional" : "Editar profesional"}: ${profesional.nombre}`,
    files: [{ path, content: JSON.stringify(profesional, null, 2) + "\n" }],
  });

  return c.json({ prNumber }, 201);
});
