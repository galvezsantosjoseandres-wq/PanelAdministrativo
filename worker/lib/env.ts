export type Role = "propietario" | "colaborador";

export interface Env {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  ASSETS: Fetcher;

  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_DEFAULT_BRANCH: string;
  R2_PUBLIC_BASE_URL: string;

  GITHUB_TOKEN: string;
  CF_ACCESS_TOKEN: string;
  CF_ACCESS_TEAM_DOMAIN: string;
  CF_ACCESS_AUD: string;
  CF_ACCOUNT_ID: string;
  CF_ACCESS_APP_ID: string;
  CF_ACCESS_POLICY_ID: string;
}

export interface AuthedUser {
  email: string;
  role: Role;
}
