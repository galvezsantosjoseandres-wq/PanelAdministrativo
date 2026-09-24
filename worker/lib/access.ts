import type { Env } from "./env";

interface AccessIncludeRule {
  email?: { email: string };
  [key: string]: unknown;
}

interface AccessPolicy {
  id: string;
  decision: string;
  include: AccessIncludeRule[];
  [key: string]: unknown;
}

function apiBase(env: Env): string {
  return `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/access/apps/${env.CF_ACCESS_APP_ID}/policies/${env.CF_ACCESS_POLICY_ID}`;
}

async function cfFetch<T>(url: string, env: Env, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.CF_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const json = await res.json<{ success: boolean; result: T; errors: unknown }>();
  if (!res.ok || !json.success) {
    throw new Error(
      `Cloudflare Access API error: ${res.status} ${JSON.stringify(json.errors)}`
    );
  }
  return json.result;
}

/**
 * Añade un email a la política de Access de panel.lefinor.com -- misma
 * acción que invitar un usuario en el panel, para que D1 y Access nunca
 * queden desincronizados (decisión tomada con José: automatizar en vez de
 * dejarlo manual).
 */
export async function addEmailToAccessPolicy(
  env: Env,
  email: string
): Promise<void> {
  const url = apiBase(env);
  const policy = await cfFetch<AccessPolicy>(url, env);
  const alreadyIncluded = policy.include.some((r) => r.email?.email === email);
  if (alreadyIncluded) return;

  const include = [...policy.include, { email: { email } }];
  await cfFetch(url, env, {
    method: "PUT",
    body: JSON.stringify({ ...policy, include }),
  });
}

export async function removeEmailFromAccessPolicy(
  env: Env,
  email: string
): Promise<void> {
  const url = apiBase(env);
  const policy = await cfFetch<AccessPolicy>(url, env);
  const include = policy.include.filter((r) => r.email?.email !== email);
  await cfFetch(url, env, {
    method: "PUT",
    body: JSON.stringify({ ...policy, include }),
  });
}
