import { useEffect, useState } from "react";
import { api, ApiError, type HeroBoton, type HeroSlide } from "../lib/api";
import { Button, Card, ErrorBanner, Field, Input, InfoBanner, PageHeader, Textarea } from "../components/ui";
import { ImageUploadField, type ImageUpload } from "../components/ImageUploadField";

const LEFINOR_BASE_URL = "https://lefinor.com";

interface SlideRow extends HeroSlide {
  key: string;
  imagenUpload?: ImageUpload | null;
}

let keySeq = 0;
function nextKey() {
  return `slide-${++keySeq}`;
}

const nuevoSlide = (): SlideRow => ({
  key: nextKey(),
  eyebrow: "",
  titulo: "",
  subtexto: "",
  imagen: "",
  imagen_alt: "",
  imagen_posicion: "50% 50%",
  botones: [],
  imagenUpload: null,
});

export function CarruselInicio() {
  const [rows, setRows] = useState<SlideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    api
      .obtenerHero()
      .then((data) => setRows(data.items.map((s) => ({ ...s, key: nextKey(), imagenUpload: null }))))
      .finally(() => setLoading(false));
  }, []);

  function actualizar(idx: number, cambios: Partial<SlideRow>) {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...cambios } : row)));
  }

  function mover(idx: number, dir: -1 | 1) {
    setRows((r) => {
      const next = [...r];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return r;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function quitar(idx: number) {
    setRows((r) => r.filter((_, i) => i !== idx));
  }

  function agregarBoton(idx: number) {
    const row = rows[idx];
    const botones: HeroBoton[] = [...(row.botones ?? []), { texto: "", href: "" }];
    actualizar(idx, { botones });
  }

  function actualizarBoton(idx: number, botonIdx: number, cambios: Partial<HeroBoton>) {
    const row = rows[idx];
    const botones = (row.botones ?? []).map((b, i) => (i === botonIdx ? { ...b, ...cambios } : b));
    actualizar(idx, { botones });
  }

  function quitarBoton(idx: number, botonIdx: number) {
    const row = rows[idx];
    const botones = (row.botones ?? []).filter((_, i) => i !== botonIdx);
    actualizar(idx, { botones });
  }

  async function guardar() {
    setError(null);
    setOk(null);
    if (rows.length === 0) {
      setError("Debe haber al menos un slide");
      return;
    }
    setSaving(true);
    try {
      const items = rows.map(({ key: _key, ...rest }) => rest);
      const { prNumber } = await api.guardarHero(items);
      setOk(`Enviado a revisión (PR #${prNumber}).`);
      setRows((r) => r.map((row) => ({ ...row, imagenUpload: null })));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al guardar el carrusel");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-400">Cargando…</p>;

  return (
    <div>
      <PageHeader
        title="Carrusel de Inicio"
        subtitle="Imágenes que se desplazan en el hero de la página principal"
        action={
          <Button onClick={guardar} disabled={saving}>
            {saving ? "Enviando…" : "Enviar a revisión"}
          </Button>
        }
      />
      <ErrorBanner message={error} />
      <InfoBanner message={ok} />

      <div className="space-y-6">
        {rows.map((row, idx) => (
          <Card key={row.key}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Slide {idx + 1}</h2>
              <div className="space-x-2 text-sm">
                <button type="button" disabled={idx === 0} onClick={() => mover(idx, -1)} className="disabled:opacity-30">
                  ↑
                </button>
                <button
                  type="button"
                  disabled={idx === rows.length - 1}
                  onClick={() => mover(idx, 1)}
                  className="disabled:opacity-30"
                >
                  ↓
                </button>
                <button type="button" onClick={() => quitar(idx)} className="text-red-500">
                  Quitar slide
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2 space-y-4">
                <Field label="Eyebrow (texto pequeño arriba del título)" required>
                  <Input value={row.eyebrow} onChange={(e) => actualizar(idx, { eyebrow: e.target.value })} />
                </Field>
                <Field label="Título" required>
                  <Input value={row.titulo} onChange={(e) => actualizar(idx, { titulo: e.target.value })} />
                </Field>
                <Field label="Subtexto" required>
                  <Textarea rows={2} value={row.subtexto} onChange={(e) => actualizar(idx, { subtexto: e.target.value })} />
                </Field>
                <Field label="Texto alternativo de la imagen" required>
                  <Input value={row.imagen_alt} onChange={(e) => actualizar(idx, { imagen_alt: e.target.value })} />
                </Field>
                <Field label="Posición de la imagen (CSS object-position)" required>
                  <Input
                    value={row.imagen_posicion}
                    onChange={(e) => actualizar(idx, { imagen_posicion: e.target.value })}
                    placeholder="50% 0%"
                  />
                </Field>
                <div>
                  <span className="block text-sm font-medium text-slate-700 mb-2">Botones</span>
                  {(row.botones ?? []).map((boton, botonIdx) => (
                    <div key={botonIdx} className="flex gap-2 mb-2">
                      <Input
                        value={boton.texto}
                        placeholder="Contáctanos"
                        onChange={(e) => actualizarBoton(idx, botonIdx, { texto: e.target.value })}
                      />
                      <Input
                        value={boton.href}
                        placeholder="/contacto.html"
                        onChange={(e) => actualizarBoton(idx, botonIdx, { href: e.target.value })}
                      />
                      <button type="button" className="text-red-500 px-2" onClick={() => quitarBoton(idx, botonIdx)}>
                        ×
                      </button>
                    </div>
                  ))}
                  <button type="button" className="text-sm text-panel-gold font-medium" onClick={() => agregarBoton(idx)}>
                    + Agregar botón
                  </button>
                </div>
              </div>
              <div>
                <span className="block text-sm font-medium text-slate-700 mb-1">Imagen</span>
                <ImageUploadField
                  value={row.imagenUpload ?? null}
                  onChange={(imagenUpload) => actualizar(idx, { imagenUpload })}
                  existingPreviewUrl={row.imagen ? `${LEFINOR_BASE_URL}${row.imagen}` : null}
                />
              </div>
            </div>
          </Card>
        ))}
        <button
          type="button"
          onClick={() => setRows((r) => [...r, nuevoSlide()])}
          className="w-full h-16 rounded-md border-2 border-dashed border-slate-300 text-slate-400 hover:border-panel-gold hover:text-panel-gold transition-colors text-sm font-medium"
        >
          + Agregar slide
        </button>
      </div>
    </div>
  );
}
