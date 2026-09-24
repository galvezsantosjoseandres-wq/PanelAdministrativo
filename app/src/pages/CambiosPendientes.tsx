import { useEffect, useState } from "react";
import { api, type PendingChange } from "../lib/api";
import { useMe } from "../lib/useMe";
import { Button, Card, PageHeader } from "../components/ui";

export function CambiosPendientes() {
  const { isOwner } = useMe();
  const [items, setItems] = useState<PendingChange[]>([]);
  const [recientes, setRecientes] = useState<PendingChange[]>([]);
  const [previews, setPreviews] = useState<Record<number, string | null>>({});
  const [busy, setBusy] = useState<number | null>(null);

  async function load() {
    const [pend, rec] = await Promise.all([
      api.cambiosPendientes(),
      api.cambiosRecientes(),
    ]);
    setItems(pend.items);
    setRecientes(rec.items);
  }

  useEffect(() => {
    load();
  }, []);

  async function verVistaPrevia(id: number) {
    const { previewUrl } = await api.vistaPrevia(id);
    setPreviews((p) => ({ ...p, [id]: previewUrl }));
  }

  async function publicar(id: number) {
    setBusy(id);
    await api.publicarCambio(id).finally(() => setBusy(null));
    load();
  }

  async function descartar(id: number) {
    setBusy(id);
    await api.descartarCambio(id).finally(() => setBusy(null));
    load();
  }

  return (
    <div>
      <PageHeader title="Cambios pendientes" subtitle="Cada edición se revisa aquí antes de llegar a producción" />

      <Card className="bg-panel-navy text-slate-100 mb-6">
        <p className="text-sm">
          Cada cambio que haces aquí se guarda como una propuesta separada, nunca directo al
          sitio en producción. Al presionar <strong>"Ver vista previa"</strong> obtienes un
          enlace que puedes reenviar por WhatsApp a Lefinor antes de aprobar.
        </p>
      </Card>

      <div className="space-y-4 mb-8">
        {items.length === 0 && (
          <p className="text-sm text-slate-400">No hay cambios esperando aprobación.</p>
        )}
        {items.map((item) => (
          <Card key={item.id}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{item.summary}</h3>
                <p className="text-sm text-slate-500">
                  {item.created_by} · PR #{item.github_pr_number}
                </p>
              </div>
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                Esperando aprobación
              </span>
            </div>
            <div className="mt-4 flex items-center justify-between">
              {previews[item.id] ? (
                <a
                  href={previews[item.id]!}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-panel-gold font-medium underline"
                >
                  Abrir vista previa
                </a>
              ) : (
                <Button variant="secondary" onClick={() => verVistaPrevia(item.id)}>
                  Ver vista previa
                </Button>
              )}
              <div className="space-x-2">
                <Button variant="secondary" disabled={busy === item.id} onClick={() => descartar(item.id)}>
                  Descartar
                </Button>
                <Button disabled={!isOwner || busy === item.id} onClick={() => publicar(item.id)}>
                  Publicar ahora
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Publicados recientemente
      </h2>
      <Card>
        {recientes.map((r) => (
          <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
            <div>
              <div className="text-sm font-medium">{r.summary}</div>
              <div className="text-xs text-slate-500">{new Date(r.updated_at).toLocaleString("es-DO")}</div>
            </div>
            <span
              className={`text-xs font-medium px-2 py-1 rounded-full ${
                r.status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
              }`}
            >
              {r.status === "published" ? "Publicado" : "Descartado"}
            </span>
          </div>
        ))}
        {recientes.length === 0 && <p className="text-sm text-slate-400">Sin historial aún.</p>}
      </Card>
    </div>
  );
}
