import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, type Publicacion } from "../lib/api";
import { Button, Card, ErrorBanner, InfoBanner, PageHeader } from "../components/ui";
import { PreviewButton } from "../components/PreviewButton";

export function Publicaciones() {
  const [items, setItems] = useState<Publicacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function load() {
    const data = await api.listarPublicaciones();
    setItems(data.items ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(slug: string, visible: boolean) {
    setError(null);
    try {
      await api.togglePublicacion(slug, visible);
      setFeedback("Cambio enviado a revisión.");
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al actualizar");
    }
  }

  async function eliminar(slug: string, titulo: string) {
    if (!window.confirm(`¿Enviar a revisión la eliminación de "${titulo}"?`)) return;
    setError(null);
    try {
      await api.eliminarPublicacion(slug);
      setFeedback("Eliminación enviada a revisión.");
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al eliminar");
    }
  }

  return (
    <div>
      <PageHeader
        title="Publicaciones"
        subtitle={`${items.filter((p) => p.visible).length} publicadas · ${items.filter((p) => !p.visible).length} ocultas`}
        action={
          <Link to="/publicaciones/nueva">
            <Button>+ Nueva publicación</Button>
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
          <p className="text-sm text-slate-400">Todavía no hay publicaciones cargadas.</p>
        )}
        <table className="w-full text-sm">
          <tbody>
            {items.map((p) => (
              <tr key={p.slug} className="border-b last:border-0">
                <td className="py-3">
                  <div className="font-medium">{p.titulo}</div>
                  <div className="text-slate-500">{p.fecha}</div>
                </td>
                <td className="py-3">
                  <span className="px-2 py-1 rounded-full bg-slate-100 text-xs capitalize">
                    {p.categoria}
                  </span>
                </td>
                <td className="py-3 text-right space-x-2 whitespace-nowrap">
                  <Link to={`/publicaciones/${p.slug}`}>
                    <Button variant="secondary">Editar</Button>
                  </Link>
                  <PreviewButton entityType="publicacion" entityId={p.slug} />
                  <Button variant="secondary" onClick={() => toggle(p.slug, !p.visible)}>
                    {p.visible ? "Ocultar de producción" : "Publicar"}
                  </Button>
                  <Button variant="danger" onClick={() => eliminar(p.slug, p.titulo)}>
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
