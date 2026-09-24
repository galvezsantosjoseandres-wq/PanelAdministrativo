import { createRemoteJWKSet, jwtVerify } from "jose";
import type { MiddlewareHandler } from "hono";
import type { AuthedUser, Env } from "./env";

// Cloudflare Access firma un JWT propio (distinto del que el IdP entrega al
// usuario) y lo adjunta en el header Cf-Access-Jwt-Assertion en cada
// petición que llega al origen, una vez que la política de Access ya
// autenticó a la persona. Verificamos SIEMPRE la firma contra el JWKS del
// team domain antes de confiar en el email -- nunca leemos el email de un
// header sin validar, porque cualquiera podría falsificarlo si el Worker
// no estuviera detrás de Access (defensa en profundidad).
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJWKS(teamDomain: string) {
  let jwks = jwksCache.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`https://${teamDomain}/cdn-cgi/access/certs`)
    );
    jwksCache.set(teamDomain, jwks);
  }
  return jwks;
}

export async function verifyAccessJwt(
  token: string,
  env: Env
): Promise<string> {
  const jwks = getJWKS(env.CF_ACCESS_TEAM_DOMAIN);
  const { payload } = await jwtVerify(token, jwks, {
    issuer: `https://${env.CF_ACCESS_TEAM_DOMAIN}`,
    audience: env.CF_ACCESS_AUD,
  });
  const email = payload.email as string | undefined;
  if (!email) {
    throw new Error("Token de Access válido pero sin email");
  }
  return email.toLowerCase();
}

declare module "hono" {
  interface ContextVariableMap {
    user: AuthedUser;
  }
}

/** Exige sesión válida de Access + usuario dado de alta en D1. */
export const requireAuth: MiddlewareHandler<{ Bindings: Env }> = async (
  c,
  next
) => {
  const token = c.req.header("Cf-Access-Jwt-Assertion");
  if (!token) {
    return c.json({ error: "No autenticado (falta el JWT de Access)" }, 401);
  }

  let email: string;
  try {
    email = await verifyAccessJwt(token, c.env);
  } catch {
    return c.json({ error: "Token de Access inválido o expirado" }, 401);
  }

  const row = await c.env.DB.prepare(
    "SELECT email, role FROM users WHERE email = ?"
  )
    .bind(email)
    .first<{ email: string; role: AuthedUser["role"] }>();

  if (!row) {
    // Access ya lo dejó entrar, pero el panel no lo tiene dado de alta:
    // esto pasa si alguien se agrega a la política de Access sin pasar
    // por "Invitar usuario" del panel. Se bloquea en vez de asumir un rol.
    return c.json(
      { error: "Tu cuenta no está registrada en el panel. Contacta al Propietario." },
      403
    );
  }

  c.set("user", { email: row.email, role: row.role });
  await next();
};

/** Exige además rol Propietario. Debe ir después de requireAuth. */
export const requireOwner: MiddlewareHandler<{ Bindings: Env }> = async (
  c,
  next
) => {
  const user = c.get("user");
  if (user.role !== "propietario") {
    return c.json({ error: "Solo el Propietario puede hacer esto" }, 403);
  }
  await next();
};
