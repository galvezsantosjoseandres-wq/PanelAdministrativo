import { useEffect, useState } from "react";
import { api, type AuditLogEntry } from "../lib/api";
import { Card, Input, PageHeader } from "../components/ui";

export function Historial() {
  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [usuario, setUsuario] = useState("");
  const [seccion, setSeccion] = useState("");

  async function load() {
    const res = await api.historial({ usuario: usuario || undefined, seccion: seccion || undefined });
    setItems(res.items);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <PageHeader title="Historial" subtitle="Registro de toda la actividad del panel" />
      <Card className="mb-4">
        <div className="flex gap-4">
          <Input placeholder="Filtrar por email" value={usuario} onChange={(e) => setUsuario(e.target.value)} />
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={seccion}
            onChange={(e) => setSeccion(e.target.value)}
          >
            <option value="">Todas las secciones</option>
            <option value="propiedad">Propiedades</option>
            <option value="publicacion">Publicaciones</option>
            <option value="curso">Academy</option>
            <option value="profesional">Equipo</option>
            <option value="hero">Carrusel</option>
            <option value="usuario">Usuarios</option>
            <option value="ajustes">Ajustes</option>
          </select>
          <button onClick={load} className="text-sm text-panel-gold font-medium">
            Filtrar
          </button>
        </div>
      </Card>
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400 uppercase">
              <th className="pb-2">Fecha</th>
              <th className="pb-2">Usuario</th>
              <th className="pb-2">Acción</th>
              <th className="pb-2">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-t">
                <td className="py-2 text-slate-500">{new Date(i.created_at).toLocaleString("es-DO")}</td>
                <td className="py-2">{i.user_email}</td>
                <td className="py-2">{i.action_type}</td>
                <td className="py-2">{i.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p className="text-sm text-slate-400">Sin registros.</p>}
      </Card>
    </div>
  );
}
