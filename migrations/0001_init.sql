-- Esquema inicial del panel. Ver plan en /root/.claude/plans/... para contexto.

CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('propietario', 'colaborador')),
  invited_by TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL,
  role TEXT NOT NULL,
  action_type TEXT NOT NULL,   -- create, edit, publish, discard, hide, delete,
                                -- invite_user, remove_user, upload_media, settings_change
  entity_type TEXT,            -- propiedad, publicacion, curso, profesional, hero, usuario, ajustes
  entity_id TEXT,
  summary TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_email ON audit_log (user_email);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity_type ON audit_log (entity_type);

CREATE TABLE IF NOT EXISTS pending_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action_type TEXT NOT NULL,   -- create, edit, destacar, hide
  summary TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  github_pr_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'discarded')),
  preview_url TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pending_changes_status ON pending_changes (status);

-- Seed: primer Propietario.
INSERT OR IGNORE INTO users (email, role, invited_by, created_at)
VALUES ('estarlingg01@gmail.com', 'propietario', NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
