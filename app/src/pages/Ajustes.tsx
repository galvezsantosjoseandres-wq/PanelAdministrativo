import { useEffect, useState } from "react";
import { api, ApiError, type PanelUser } from "../lib/api";
import { useMe } from "../lib/useMe";
import { Button, Card, ErrorBanner, Field, Input, PageHeader } from "../components/ui";

export function Ajustes() {
  const { isOwner } = useMe();
  const [users, setUsers] = useState<PanelUser[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"propietario" | "colaborador">("colaborador");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    const { items } = await api.usuarios();
    setUsers(items);
  }

  useEffect(() => {
    load();
  }, []);

  async function invitar() {
    setError(null);
    setNotice(null);
    try {
      const res = await api.invitarUsuario(email, role);
      setEmail("");
      if (!res.accessSynced) {
        setNotice(
          "Se guardó en el panel, pero no se pudo sincronizar automáticamente con la política de Cloudflare Access. Añade el email manualmente en el dashboard de Access."
        );
      }
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al invitar");
    }
  }

  async function quitar(target: string) {
    const res = await api.quitarUsuario(target);
    if (!res.accessSynced) {
      setNotice(
        `Se quitó a ${target} del panel, pero no se pudo sincronizar automáticamente con Access. Quítalo manualmente en el dashboard.`
      );
    }
    load();
  }

  return (
    <div>
      <PageHeader title="Ajustes" subtitle="Usuarios, permisos y conexión con el repositorio" />
      <ErrorBanner message={error} />
      {notice && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 text-amber-800 text-sm px-4 py-3">
          {notice}
        </div>
      )}

      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold">Usuarios con acceso</h2>
            <p className="text-xs text-slate-400">Gestionado a través de Cloudflare Access + este panel</p>
          </div>
        </div>

        {users.map((u) => (
          <div key={u.email} className="flex items-center justify-between py-2 border-b last:border-0">
            <div>
              <div className="text-sm font-medium">{u.email}</div>
              <div className="text-xs text-slate-500 capitalize">{u.role}</div>
            </div>
            {u.role === "propietario" ? (
              <span className="text-xs text-slate-400">No se puede quitar</span>
            ) : (
              isOwner && (
                <Button variant="danger" onClick={() => quitar(u.email)}>
                  Quitar acceso
                </Button>
              )
            )}
          </div>
        ))}

        {isOwner && (
          <div className="mt-4 pt-4 border-t flex gap-2 items-end">
            <Field label="Email">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@activosweb.com" />
            </Field>
            <select
              className="rounded-md border border-slate-300 px-3 py-2 text-sm mb-4"
              value={role}
              onChange={(e) => setRole(e.target.value as "propietario" | "colaborador")}
            >
              <option value="colaborador">Colaborador</option>
              <option value="propietario">Propietario</option>
            </select>
            <Button onClick={invitar} className="mb-4">+ Invitar usuario</Button>
          </div>
        )}

        <p className="text-xs text-slate-400 mt-4">
          <strong>Propietario:</strong> crea, edita, publica en producción, y administra usuarios y ajustes.
          <br />
          <strong>Colaborador:</strong> crea y edita contenido, envía cambios a revisión, pero no puede publicar ni cambiar quién tiene acceso.
        </p>
      </Card>

      <Card>
        <h2 className="font-semibold mb-2">Seguridad de la sesión</h2>
        <p className="text-sm text-slate-500">
          Esto se configura en la política de Cloudflare Access de panel.lefinor.com, no en el
          código del panel. Valores recomendados: 30 minutos de inactividad / 24 horas de
          duración máxima.
        </p>
      </Card>
    </div>
  );
}
