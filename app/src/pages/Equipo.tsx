import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, type Profesional } from "../lib/api";
import { Button, Card, ErrorBanner, InfoBanner, PageHeader } from "../components/ui";
import { PreviewButton } from "../components/PreviewButton";

export function Equipo() {
  const [items, setItems] = useState<Profesional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function load() {
    const data = await api.listarProfesionales();
    setItems((data.items ?? []).slice().sort((a, b) => a.orden - b.orden));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function eliminar(slug: string, nombre: string) {
    if (!window.confirm(`¿Enviar a revisión la eliminación de "${nombre}"?`)) return;
    setError(null);
    try {
      await api.eliminarProfesional(slug);
      setFeedback("Eliminación enviada a revisión.");
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al eliminar");
    }
  }

  return (
    <div>
      <PageHeader
        title="Equipo"
        subtitle={`${items.length} profesionales`}
        action={
          <Link to="/equipo/nuevo">
            <Button>+ Agregar profesional</Button>
          </Link>
        }
      />
      <ErrorBanner message={error} />
      <InfoBanner
        message={
          feedback && (
            <>
              {feedback}{" "}
              <Link to="/cambios-pendientes" className="underline font-medium">
                Ver Cambios pendientes
              </Link>
            </>
          )
        }
      />
      <Card>
        {loading && <p className="text-sm text-slate-400">Cargando…</p>}
        {!loading && items.length === 0 && (
          <p className="text-sm text-slate-400">Todavía no hay profesionales cargados.</p>
        )}
        <table className="w-full text-sm">
          <tbody>
            {items.map((p) => (
              <tr key={p.slug} className="border-b last:border-0">
                <td className="py-3">
                  <div className="font-medium">{p.nombre}</div>
                  <div className="text-slate-500">{p.cargo}</div>
                </td>
                <td className="py-3">
                  <span className="px-2 py-1 rounded-full bg-slate-100 text-xs">{p.area}</span>
                </td>
                <td className="py-3 text-right space-x-2 whitespace-nowrap">
                  <Link to={`/equipo/${p.slug}`}>
                    <Button variant="secondary">Editar</Button>
                  </Link>
                  <PreviewButton entityType="profesional" entityId={p.slug} />
                  <Button variant="danger" onClick={() => eliminar(p.slug, p.nombre)}>
                    Eliminar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
