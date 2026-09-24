import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, PageHeader } from "../components/ui";

interface Propiedad {
  slug: string;
  titulo: string;
  ciudad: string;
  tipo_operacion: "venta" | "alquiler";
  destacada: boolean;
  visible: boolean;
}

export function Propiedades() {
  const [items, setItems] = useState<Propiedad[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/propiedades");
    const data = (await res.json()) as { items: Propiedad[] };
    setItems(data.items ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(slug: string, field: "destacada" | "visible", value: boolean) {
    await fetch(`/api/propiedades/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    load();
  }

  return (
    <div>
      <PageHeader
        title="Propiedades"
        subtitle={`${items.filter((p) => p.visible).length} publicadas · ${items.filter((p) => !p.visible).length} ocultas`}
        action={
          <Link to="/propiedades/nueva">
            <Button>+ Nueva propiedad</Button>
          </Link>
        }
      />
      <Card>
        {loading && <p className="text-sm text-slate-400">Cargando…</p>}
        {!loading && items.length === 0 && (
          <p className="text-sm text-slate-400">Todavía no hay propiedades cargadas.</p>
        )}
        <table className="w-full text-sm">
          <tbody>
            {items.map((p) => (
              <tr key={p.slug} className="border-b last:border-0">
                <td className="py-3">
                  <div className="font-medium">{p.titulo}</div>
                  <div className="text-slate-500">{p.ciudad}</div>
                </td>
                <td className="py-3">
                  <span className="px-2 py-1 rounded-full bg-slate-100 text-xs capitalize">
                    {p.tipo_operacion}
                  </span>
                </td>
                <td className="py-3">
                  <button
                    onClick={() => toggle(p.slug, "destacada", !p.destacada)}
                    title="Destacar en Inicio"
                    className={p.destacada ? "text-panel-gold" : "text-slate-300"}
                  >
                    ★
                  </button>
                </td>
                <td className="py-3 text-right space-x-2">
                  <Link to={`/propiedades/${p.slug}`}>
                    <Button variant="secondary">Editar</Button>
                  </Link>
                  <Button variant="secondary" onClick={() => toggle(p.slug, "visible", !p.visible)}>
                    {p.visible ? "Ocultar" : "Mostrar"}
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
