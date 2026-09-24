import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type PendingChange } from "../lib/api";
import { Card, PageHeader } from "../components/ui";

export function Inicio() {
  const [pendientes, setPendientes] = useState<PendingChange[]>([]);
  const [recientes, setRecientes] = useState<PendingChange[]>([]);

  useEffect(() => {
    api.cambiosPendientes().then((r) => setPendientes(r.items)).catch(() => {});
    api.cambiosRecientes().then((r) => setRecientes(r.items)).catch(() => {});
  }, []);

  return (
    <div>
      <PageHeader title="Inicio" subtitle="Resumen general del sitio lefinor.com" />

      <Card className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-500">Cambios sin publicar</div>
            <div className="text-3xl font-bold text-panel-navy">{pendientes.length}</div>
          </div>
          {pendientes.length > 0 && (
            <span className="text-red-600 text-sm font-medium">esperando tu aprobación</span>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-panel-navy">Cambios recientes</h2>
            <Link to="/cambios-pendientes" className="text-sm text-panel-gold font-medium">
              Ver todos →
            </Link>
          </div>
          {pendientes.concat(recientes).slice(0, 5).map((c) => (
            <div key={c.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div>
                <div className="text-sm font-medium">{c.summary}</div>
                <div className="text-xs text-slate-500">
                  {c.created_by} · {new Date(c.created_at).toLocaleString("es-DO")}
                </div>
              </div>
              <StatusBadge status={c.status} />
            </div>
          ))}
          {pendientes.length + recientes.length === 0 && (
            <p className="text-sm text-slate-400">Sin actividad reciente.</p>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold text-panel-navy mb-4">Accesos rápidos</h2>
          <div className="flex flex-col gap-2">
            <Link to="/propiedades/nueva" className="px-4 py-3 rounded-md border text-sm hover:bg-slate-50">
              + Nueva propiedad
            </Link>
            <Link to="/publicaciones/nueva" className="px-4 py-3 rounded-md border text-sm hover:bg-slate-50">
              + Nueva publicación
            </Link>
            <Link to="/academy/nuevo" className="px-4 py-3 rounded-md border text-sm hover:bg-slate-50">
              + Nuevo curso de Academy
            </Link>
            <Link to="/equipo/nuevo" className="px-4 py-3 rounded-md border text-sm hover:bg-slate-50">
              + Agregar profesional
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    published: "bg-emerald-100 text-emerald-700",
    discarded: "bg-slate-100 text-slate-500",
  };
  const label: Record<string, string> = {
    pending: "En revisión",
    published: "Publicado",
    discarded: "Descartado",
  };
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-full ${map[status] ?? ""}`}>
      {label[status] ?? status}
    </span>
  );
}
