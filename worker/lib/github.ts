import { Octokit } from "octokit";
import type { Env } from "./env";

export type FileChange =
  | { path: string; content: string | Uint8Array; blobSha?: undefined }
  | { path: string; blobSha: string; content?: undefined };

export interface DirEntry {
  name: string;
  sha: string;
  type: "file" | "dir";
}

export class GitHubClient {
  private octokit: Octokit;
  private owner: string;
  private repo: string;
  private defaultBranch: string;

  constructor(env: Env) {
    this.octokit = new Octokit({ auth: env.GITHUB_TOKEN });
    this.owner = env.GITHUB_OWNER;
    this.repo = env.GITHUB_REPO;
    this.defaultBranch = env.GITHUB_DEFAULT_BRANCH;
  }

  /** Lista el contenido de una carpeta en la rama default. [] si no existe. */
  async listDir(path: string): Promise<DirEntry[]> {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref: this.defaultBranch,
      });
      if (!Array.isArray(data)) return [];
      return data.map((e) => ({
        name: e.name,
        sha: e.sha,
        type: e.type === "dir" ? "dir" : "file",
      }));
    } catch (err: unknown) {
      if (isNotFound(err)) return [];
      throw err;
    }
  }

  /** Lee un archivo de texto de la rama default. null si no existe. */
  async readTextFile(path: string): Promise<string | null> {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref: this.defaultBranch,
      });
      if (Array.isArray(data) || data.type !== "file" || !data.content) {
        return null;
      }
      return base64ToUtf8(data.content.replace(/\n/g, ""));
    } catch (err: unknown) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  /**
   * URL pública de descarga de un archivo puntual (CDN de GitHub) -- sirve
   * para previsualizar fotos de la galería sin tener que leer y re-servir
   * los bytes desde el propio Worker. listDir() no trae este campo (solo
   * lo da la variante de un único archivo de Contents API), por eso es un
   * método aparte.
   */
  async getDownloadUrl(path: string): Promise<string | null> {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref: this.defaultBranch,
      });
      if (Array.isArray(data) || data.type !== "file") return null;
      return data.download_url;
    } catch (err: unknown) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  /** Crea una rama nueva partiendo de la punta actual de la rama default. */
  async createBranch(branchName: string): Promise<void> {
    const { data: ref } = await this.octokit.rest.git.getRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${this.defaultBranch}`,
    });
    await this.octokit.rest.git.createRef({
      owner: this.owner,
      repo: this.repo,
      ref: `refs/heads/${branchName}`,
      sha: ref.object.sha,
    });
  }

  /**
   * Commitea uno o más archivos en una sola operación atómica (Git Trees
   * API) en vez de un commit por archivo -- importante porque una
   * propiedad nueva puede tocar el JSON + varias fotos a la vez, y no
   * queremos un historial de PR con 6 commits sueltos por cada foto.
   */
  async commitFiles(
    branchName: string,
    files: FileChange[],
    message: string,
    deletePaths: string[] = []
  ): Promise<void> {
    const { data: branchRef } = await this.octokit.rest.git.getRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${branchName}`,
    });
    const baseCommitSha = branchRef.object.sha;

    const { data: baseCommit } = await this.octokit.rest.git.getCommit({
      owner: this.owner,
      repo: this.repo,
      commit_sha: baseCommitSha,
    });

    // Para archivos con contenido nuevo, subimos el blob. Para los que solo
    // cambian de posición (renombrado dentro de la galería numerada) se
    // reutiliza el blobSha existente sin volver a leer/subir los bytes.
    const blobs = await Promise.all(
      files.map(async (f) => {
        if (f.blobSha) return { path: f.path, sha: f.blobSha };
        const { data: blob } = await this.octokit.rest.git.createBlob({
          owner: this.owner,
          repo: this.repo,
          content:
            typeof f.content === "string"
              ? btoa(unescape(encodeURIComponent(f.content)))
              : uint8ArrayToBase64(f.content as Uint8Array),
          encoding: "base64",
        });
        return { path: f.path, sha: blob.sha };
      })
    );

    const { data: tree } = await this.octokit.rest.git.createTree({
      owner: this.owner,
      repo: this.repo,
      base_tree: baseCommit.tree.sha,
      tree: [
        ...blobs.map((b) => ({
          path: b.path,
          mode: "100644" as const,
          type: "blob" as const,
          sha: b.sha,
        })),
        // sha: null en la Git Trees API elimina la ruta del árbol.
        ...deletePaths.map((path) => ({
          path,
          mode: "100644" as const,
          type: "blob" as const,
          sha: null,
        })),
      ],
    });

    const { data: commit } = await this.octokit.rest.git.createCommit({
      owner: this.owner,
      repo: this.repo,
      message,
      tree: tree.sha,
      parents: [baseCommitSha],
    });

    await this.octokit.rest.git.updateRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${branchName}`,
      sha: commit.sha,
    });
  }

  async openPullRequest(
    branchName: string,
    title: string,
    body: string
  ): Promise<{ number: number; headSha: string }> {
    const { data: pr } = await this.octokit.rest.pulls.create({
      owner: this.owner,
      repo: this.repo,
      head: branchName,
      base: this.defaultBranch,
      title,
      body,
    });
    return { number: pr.number, headSha: pr.head.sha };
  }

  /**
   * Cloudflare Pages/Workers despliega una vista previa por cada PR de
   * forma nativa (confirmado: build.yml de Lefinor no tiene paso de
   * deploy). La URL aparece como un check-run o un deployment status
   * sobre el head commit del PR -- se consulta bajo demanda, no por
   * webhook, para no montar infraestructura de recepción de eventos en v1.
   */
  async getPreviewUrl(headSha: string): Promise<string | null> {
    const { data: checks } = await this.octokit.rest.checks.listForRef({
      owner: this.owner,
      repo: this.repo,
      ref: headSha,
    });
    for (const run of checks.check_runs) {
      if (run.details_url && /pages\.dev|workers\.dev/.test(run.details_url)) {
        return run.details_url;
      }
    }

    const { data: deployments } = await this.octokit.rest.repos.listDeployments(
      { owner: this.owner, repo: this.repo, sha: headSha }
    );
    for (const dep of deployments) {
      const { data: statuses } =
        await this.octokit.rest.repos.listDeploymentStatuses({
          owner: this.owner,
          repo: this.repo,
          deployment_id: dep.id,
        });
      const withUrl = statuses.find((s) => s.environment_url);
      if (withUrl?.environment_url) return withUrl.environment_url;
    }
    return null;
  }

  async getPullRequestHeadSha(prNumber: number): Promise<string> {
    const { data: pr } = await this.octokit.rest.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
    });
    return pr.head.sha;
  }

  async mergePullRequest(prNumber: number): Promise<void> {
    await this.octokit.rest.pulls.merge({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
      merge_method: "squash",
    });
    await this.deleteBranchSafely(prNumber);
  }

  async closePullRequest(prNumber: number): Promise<void> {
    await this.octokit.rest.pulls.update({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
      state: "closed",
    });
    await this.deleteBranchSafely(prNumber);
  }

  private async deleteBranchSafely(prNumber: number): Promise<void> {
    const { data: pr } = await this.octokit.rest.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
    });
    try {
      await this.octokit.rest.git.deleteRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${pr.head.ref}`,
      });
    } catch {
      // La rama ya pudo haber sido borrada (ej. por GitHub al hacer merge
      // con "auto delete branch" activado en el repo) -- no es fatal.
    }
  }
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    (err as { status: number }).status === 404
  );
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Decodifica un blob base64 (tal como lo devuelve la Contents API de GitHub)
 * a texto UTF-8. atob() por sí solo produce una "binary string" byte-a-byte
 * (equivalente a interpretar los bytes como Latin-1), por lo que hace falta
 * reconstruir los code points reales con TextDecoder -- sin este paso,
 * cualquier acento o ñ sale corrupto (mojibake tipo "baÃ±os").
 */
export function base64ToUtf8(base64: string): string {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
