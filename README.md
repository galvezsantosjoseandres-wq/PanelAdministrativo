# Panel Administrativo — Activosweb / Lefinor

Panel administrativo de contenido para lefinor.com. Todo cambio pasa por
Pull Request + vista previa de Cloudflare antes de publicarse en producción.
Ver el plan de implementación completo para el contexto de diseño.

## Stack

- **Worker**: Hono (TypeScript) sirviendo `/api/*` + assets estáticos del SPA.
- **Frontend**: React + Vite, construido a `dist/` y servido por el mismo Worker.
- **Datos del panel**: Cloudflare D1 (`users`, `audit_log`, `pending_changes`).
- **Medios**: fotos → commit directo a GitHub. Videos → R2 (binding nativo) + puntero `.url`.
- **Contenido**: GitHub API (Octokit) sobre el repo `Lefinor` únicamente.
- **Auth**: Cloudflare Access delante de `panel.lefinor.com`.

## Arrancar en local

```bash
npm install
cp .dev.vars.example .dev.vars   # completar con secretos de desarrollo
npm run db:migrate:local
npm run dev                       # Vite (5173) + wrangler dev (8787), con proxy /api
```

## Antes del primer deploy real

1. `wrangler d1 create panel-lefinor` y pegar el `database_id` real en `wrangler.jsonc`.
2. Confirmar que el bucket R2 `lefinor-media` tiene un dominio público habilitado
   (r2.dev o propio) y poner esa URL en `R2_PUBLIC_BASE_URL` (`wrangler.jsonc`).
3. Crear el fine-grained PAT de GitHub (solo repo Lefinor, Contents + Pull requests)
   y cargarlo con `wrangler secret put GITHUB_TOKEN`.
4. Crear la app de Access `panel.lefinor.com` en Zero Trust; cargar
   `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, `CF_ACCOUNT_ID`, `CF_ACCESS_APP_ID`,
   `CF_ACCESS_POLICY_ID` y un `CF_ACCESS_TOKEN` con permiso de edición sobre esa
   política (para la sincronía automática de roles).
5. Reemplazar el email semilla en `migrations/0001_init.sql` por el de José y
   correr `npm run db:migrate:remote`.
6. `npm run deploy`.

## Comandos

- `npm run dev` — desarrollo local (Vite + wrangler dev).
- `npm run typecheck` — valida `app/` (DOM) y `worker/` (Workers) por separado,
  porque mezclan tipos de entorno distintos (ver los dos `tsconfig*.json`).
- `npm test` — unit tests (hoy: lógica pura de numeración de galería).
- `npm run deploy` — build + `wrangler deploy`.

## Pendiente antes de considerar el panel "terminado"

- Pantalla **Carrusel de Inicio**: bloqueada hasta que exista `data/hero.json`
  en Lefinor (hoy el hero es HTML fijo). Es un cambio de código al generador
  de Lefinor, a resolver en una sesión aparte con permiso explícito de
  escritura sobre ese repo — no es tarea de este repo.
- Subida de fotos/foto de perfil desde la UI (el endpoint de galería de
  propiedades ya existe en el backend; falta el widget de subida en el
  formulario de Editar propiedad y en Agregar profesional).
- Correr la revisión de seguridad de `mis-claude-skills` contra este código
  antes de la entrega final.
