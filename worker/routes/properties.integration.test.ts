import { SELF, env, fetchMock } from "cloudflare:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { submitChange } from "../lib/changes";
import type { GitHubClient } from "../lib/github";

// Capa de integración: corre sobre Miniflare, con D1 real (aplicando
// migrations/0001_init.sql al arrancar, ver test/apply-migrations.ts).
// Complementa (no reemplaza) delete.test.ts, que mockea todo (incluido
// submitChange) para probar la lógica de cada handler en aislamiento.
//
// Dos piezas separadas, cada una probada de la forma más real posible
// dentro de lo que este entorno permite:
//
// 1. requireAuth de punta a punta, vía HTTP real contra el Worker
//    (binding de servicio SELF): la verificación criptográfica del JWT
//    corre de VERDAD (jose real, contra un keypair generado para el
//    test; el JWKS se sirve interceptando esa única llamada de red con
//    `fetchMock`, el mecanismo nativo del pool para esto), y la consulta
//    a D1 sobre `users` también corre real.
//
// 2. submitChange (el punto único por el que todo cambio sale hacia
//    Lefinor) llamado DIRECTAMENTE con el D1 real de Miniflare, para
//    probar que sus escrituras a `pending_changes`/`audit_log` -- lo que
//    pidió José explícitamente -- funcionan de verdad. Se le pasa un
//    GitHubClient de mentira (objeto plano, no una llamada de red real)
//    en vez del real.
//
// Por qué no se probó todo junto en una sola request HTTP (más fiel,
// intento inicial): se investigó a fondo intentar correr GitHubClient
// real (Octokit) contra `fetchMock` dentro de una request completa vía
// SELF. La primera llamada de Octokit de la cadena (el `readTextFile`
// que properties.ts hace antes de decidir crear-vs-editar) SÍ se
// interceptaba correctamente -- pero la segunda llamada de la MISMA
// secuencia (el `getRef` dentro de `createBranch`, ya llamado desde
// dentro de `submitChange`) dejaba de matchear el mismo interceptor
// catch-all (`path: () => true`, que debería matchear cualquier cosa) y
// resolvía con `data` vacío en vez de lanzar o de llamar al handler del
// mock -- descartando con eso incluso la hipótesis de un simple problema
// de encoding de path. No se encontró la causa raíz exacta dentro del
// tiempo razonable para este PR (posiblemente una limitación de esta
// versión del pool -- 0.6.0 -- con más de una llamada de red saliente
// encadenada dentro de una misma request); tampoco vi.mock() de
// GitHubClient o de jose interceptó nada corriendo bajo este pool (ni
// vía SELF ni importando `app` directo), a diferencia de delete.test.ts,
// que corre bajo el pool normal de Node y ahí sí funciona limpio. Queda
// documentado acá como limitación conocida para revisar en una futura
// actualización de @cloudflare/vitest-pool-workers.

const TEST_EMAIL = "propietario-test@example.com";
const TEAM_DOMAIN = "test-team.cloudflareaccess.com";
const AUD = "test-aud";

let validJwt: string;

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  const kid = "test-kid";

  fetchMock.activate();
  fetchMock.disableNetConnect();
  fetchMock
    .get(`https://${TEAM_DOMAIN}`)
    .intercept({ method: "GET", path: "/cdn-cgi/access/certs" })
    .reply(200, { keys: [{ ...jwk, kid, use: "sig", alg: "RS256" }] })
    .persist();

  validJwt = await new SignJWT({ email: TEST_EMAIL })
    .setProtectedHeader({ alg: "RS256", kid })
    .setIssuedAt()
    .setIssuer(`https://${TEAM_DOMAIN}`)
    .setAudience(AUD)
    .setExpirationTime("1h")
    .sign(privateKey);
});

const AUTH_HEADERS = () => ({ "Cf-Access-Jwt-Assertion": validJwt });

async function seedPropietario() {
  await env.DB.prepare(
    "INSERT INTO users (email, role, invited_by, created_at) VALUES (?, 'propietario', NULL, ?)"
  )
    .bind(TEST_EMAIL, new Date().toISOString())
    .run();
}

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM users").run();
  await env.DB.prepare("DELETE FROM pending_changes").run();
  await env.DB.prepare("DELETE FROM audit_log").run();
});

describe("requireAuth de punta a punta (JWT real + D1 real, vía HTTP)", () => {
  it("sin header Cf-Access-Jwt-Assertion -> 401", async () => {
    const res = await SELF.fetch("https://panel.test/api/propiedades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  it("JWT con firma válida (verificación criptográfica real) pero email no registrado en D1 -> 403", async () => {
    const res = await SELF.fetch("https://panel.test/api/propiedades", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...AUTH_HEADERS() },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
  });

  it("JWT válido + usuario Propietario sembrado en D1 -> pasa el middleware (llega a la validación del body)", async () => {
    await seedPropietario();
    const res = await SELF.fetch("https://panel.test/api/propiedades", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...AUTH_HEADERS() },
      body: JSON.stringify({}), // body inválido a propósito
    });
    // 400 (validación del schema) y no 401/403 confirma que requireAuth
    // dejó pasar la request -- JWT real verificado + fila de D1
    // encontrada + c.set("user", ...) -- hasta la lógica de la ruta.
    expect(res.status).toBe(400);
  });
});

describe("submitChange escribe pending_changes + audit_log reales en D1", () => {
  const fakeGithub = {
    readTextFile: async () => null,
    listDir: async () => [],
    createBranch: async () => {},
    commitFiles: async () => {},
    openPullRequest: async () => ({ number: 202, headSha: "deadbeef" }),
  } as unknown as GitHubClient;

  it("crea las filas correctas al someter un cambio de tipo create", async () => {
    const { prNumber, branch } = await submitChange(
      env,
      fakeGithub,
      { email: TEST_EMAIL, role: "propietario" },
      {
        entityType: "propiedad",
        entityId: "casa-submitchange",
        actionType: "create",
        summary: "Nueva propiedad: Casa de integración",
        files: [{ path: "data/propiedades/casa-submitchange.json", content: "{}" }],
      }
    );

    expect(prNumber).toBe(202);
    expect(branch).toContain("panel/propiedad-casa-submitchange-");

    const pending = await env.DB.prepare("SELECT * FROM pending_changes WHERE entity_id = ?")
      .bind("casa-submitchange")
      .first<{
        entity_type: string;
        action_type: string;
        status: string;
        created_by: string;
        github_pr_number: number;
        branch_name: string;
      }>();
    expect(pending).toBeTruthy();
    expect(pending?.entity_type).toBe("propiedad");
    expect(pending?.action_type).toBe("create");
    expect(pending?.status).toBe("pending");
    expect(pending?.created_by).toBe(TEST_EMAIL);
    expect(pending?.github_pr_number).toBe(202);
    expect(pending?.branch_name).toBe(branch);

    const audit = await env.DB.prepare("SELECT * FROM audit_log WHERE entity_id = ?")
      .bind("casa-submitchange")
      .first<{ action_type: string; user_email: string; role: string }>();
    expect(audit).toBeTruthy();
    expect(audit?.action_type).toBe("create");
    expect(audit?.user_email).toBe(TEST_EMAIL);
    expect(audit?.role).toBe("propietario");
  });

  it("crea las filas correctas al someter un cambio de tipo delete", async () => {
    await submitChange(
      env,
      fakeGithub,
      { email: TEST_EMAIL, role: "propietario" },
      {
        entityType: "propiedad",
        entityId: "casa-submitchange-delete",
        actionType: "delete",
        summary: "Eliminar propiedad: Casa a borrar",
        files: [],
        deletePaths: ["data/propiedades/casa-submitchange-delete.json"],
      }
    );

    const pending = await env.DB.prepare("SELECT * FROM pending_changes WHERE entity_id = ?")
      .bind("casa-submitchange-delete")
      .first<{ action_type: string }>();
    expect(pending?.action_type).toBe("delete");

    const audit = await env.DB.prepare("SELECT * FROM audit_log WHERE entity_id = ?")
      .bind("casa-submitchange-delete")
      .first<{ action_type: string }>();
    expect(audit?.action_type).toBe("delete");
  });
});
