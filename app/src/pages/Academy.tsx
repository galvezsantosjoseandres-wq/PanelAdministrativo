import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, type CursoAcademy } from "../lib/api";
import { Button, Card, ErrorBanner, InfoBanner, PageHeader } from "../components/ui";
import { PreviewButton } from "../components/PreviewButton";

export function Academy() {
  const [items, setItems] = useState<CursoAcademy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function load() {
    const data = await api.listarCursos();
    setItems(data.items ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(id: string, campo: "destacado" | "visible", valor: boolean) {
    setError(null);
    try {
      await api.toggleCurso(id, campo, valor);
      setFeedback("Cambio enviado a revisión.");
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al actualizar");
    }
  }

  async function eliminar(id: string, titulo: string) {
    if (!window.confirm(`¿Enviar a revisión la eliminación de "${titulo}"?`)) return;
    setError(null);
    try {
      await api.eliminarCurso(id);
      setFeedback("Eliminación enviada a revisión.");
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al eliminar");
    }
  }

  return (
    <div>
      <PageHeader
        title="Academy"
        subtitle={`${items.filter((c) => c.visible).length} publicados · ${items.filter((c) => !c.visible).length} ocultos`}
        action={
          <Link to="/academy/nuevo">
            <Button>+ Nuevo curso</Button>
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
          <p className="text-sm text-slate-400">Todavía no hay cursos cargados.</p>
        )}
        <table className="w-full text-sm">
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b last:border-0">
                <td className="py-3">
                  <div className="font-medium">{c.titulo}</div>
                  <div className="text-slate-500">{c.fecha}</div>
                </td>
                <td className="py-3">
                  <span className="px-2 py-1 rounded-full bg-slate-100 text-xs capitalize">
                    {c.estado}
                  </span>
                </td>
                <td className="py-3">
                  <button
                    onClick={() => toggle(c.id, "destacado", !c.destacado)}
                    title="Destacar entre próximos cursos"
                    className={c.destacado ? "text-panel-gold" : "text-slate-300"}
                  >
                    ★
                  </button>
                </td>
                <td className="py-3 text-right space-x-2 whitespace-nowrap">
                  <Link to={`/academy/${c.id}`}>
                    <Button variant="secondary">Editar</Button>
                  </Link>
                  <PreviewButton entityType="curso" entityId={c.id} />
                  <Button variant="secondary" onClick={() => toggle(c.id, "visible", !c.visible)}>
                    {c.visible ? "Ocultar de producción" : "Publicar"}
                  </Button>
                  <Button variant="danger" onClick={() => eliminar(c.id, c.titulo)}>
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
