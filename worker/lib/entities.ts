import type { GitHubClient } from "./github";

/**
 * El generador de Lefinor NO valida que autor_id/instructor_ids existan
 * (confirmado en build.js: usa find + filter(Boolean), omitiendo en
 * silencio el instructor/autor inválido sin avisar). El panel es el único
 * lugar que impide guardar una referencia rota, así que aquí sí se valida.
 */
export async function listProfesionalSlugs(
  github: GitHubClient
): Promise<Set<string>> {
  const entries = await github.listDir("data/profesionales");
  const slugs = new Set<string>();
  for (const entry of entries) {
    if (entry.type !== "file" || !entry.name.endsWith(".json")) continue;
    slugs.add(entry.name.replace(/\.json$/, ""));
  }
  return slugs;
}
