import { Hono } from "hono";
import { properties } from "./routes/properties";
import { publications } from "./routes/publications";
import { academy } from "./routes/academy";
import { professionals } from "./routes/professionals";
import { pendingChanges } from "./routes/pendingChanges";
import { settings } from "./routes/settings";
import { auditLog } from "./routes/auditLog";
import { requireAuth } from "./lib/auth";
import type { Env } from "./lib/env";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true }));

app.get("/api/me", requireAuth, (c) =>
  c.json({ ...c.get("user"), teamDomain: c.env.CF_ACCESS_TEAM_DOMAIN })
);

app.route("/api/propiedades", properties);
app.route("/api/publicaciones", publications);
app.route("/api/academy", academy);
app.route("/api/profesionales", professionals);
app.route("/api/cambios-pendientes", pendingChanges);
app.route("/api/ajustes", settings);
app.route("/api/historial", auditLog);

// Todo lo que no sea /api/* lo sirve el binding ASSETS (el SPA de app/).
app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
