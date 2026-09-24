import type { GitHubClient, FileChange } from "./github";
import type { AuthedUser, Env } from "./env";

export function slugTimestamp(): string {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

export function branchName(entityType: string, entityId: string): string {
  return `panel/${entityType}-${entityId}-${slugTimestamp()}`;
}

export interface SubmitChangeInput {
  entityType: string; // propiedad, publicacion, curso, profesional, hero
  entityId: string;
  actionType: "create" | "edit" | "destacar" | "hide";
  summary: string;
  files: FileChange[];
  deletePaths?: string[];
}

/**
 * Punto único por el que TODO cambio de contenido sale hacia Lefinor:
 * crea la rama, commitea, abre el PR, y dejsa registro en pending_changes
 * + audit_log en la misma operación. Los routes de cada entidad (propiedades,
 * publicaciones, academy, profesionales) solo arman los `files` -- esta
 * función es la que garantiza que ningún cambio se salte el flujo de
 * revisión ni el registro de auditoría (sección 4 y 6 del plan).
 */
export async function submitChange(
  env: Env,
  github: GitHubClient,
  user: AuthedUser,
  input: SubmitChangeInput
): Promise<{ prNumber: number; branch: string }> {
  const branch = branchName(input.entityType, input.entityId);
  await github.createBranch(branch);
  await github.commitFiles(
    branch,
    input.files,
    input.summary,
    input.deletePaths ?? []
  );
  const { number: prNumber } = await github.openPullRequest(
    branch,
    input.summary,
    `Cambio enviado desde el Panel Administrativo por ${user.email}.\n\n` +
      `<!-- panel:entity_type=${input.entityType} entity_id=${input.entityId} -->`
  );

  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO pending_changes
        (entity_type, entity_id, action_type, summary, branch_name, github_pr_number, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
    ).bind(
      input.entityType,
      input.entityId,
      input.actionType,
      input.summary,
      branch,
      prNumber,
      user.email,
      now,
      now
    ),
    env.DB.prepare(
      `INSERT INTO audit_log
        (user_email, role, action_type, entity_type, entity_id, summary, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      user.email,
      user.role,
      input.actionType,
      input.entityType,
      input.entityId,
      input.summary,
      now
    ),
  ]);

  return { prNumber, branch };
}
