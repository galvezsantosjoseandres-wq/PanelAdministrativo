import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import {
  Button,
  Card,
  ErrorBanner,
  Field,
  Input,
  ListEditor,
  PageHeader,
  Textarea,
  Toggle,
} from "../components/ui";
import { GalleryUploader } from "../components/GalleryUploader";
import { SLUG_REGEX } from "../lib/slug";

interface CaracteristicaRow {
  label: string;
  valor: string;
}

const empty = {
  slug: "",
  titulo: "",
  tipo_operacion: "venta" as "venta" | "alquiler",
  ciudad: "",
  quickspecs: [] as string[],
  caracteristicas: [] as CaracteristicaRow[],
  detalle_intro: "",
  detalle_bullets: [] as string[],
  detalle_cierre: "",
  destacada: false,
  visible: false,
};

export function PropiedadEditar() {
  const { slug } = useParams();
  const isNew = !slug;
  const navigate = useNavigate();
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [gallerySaved, setGallerySaved] = useState(false);
  const slugValido = SLUG_REGEX.test(form.slug);
  const slugBloqueado = !isNew || gallerySaved;

  useEffect(() => {
    if (!slug) return;
    api.obtenerPropiedad(slug).then((data) => setForm({ ...empty, ...data }));
  }, [slug]);

  async function guardar() {
    setSaving(true);
    setError(null);
    try {
      await api.crearPropiedad(form);
      navigate("/cambios-pendientes");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={isNew ? "Nueva propiedad" : form.titulo || "Editar propiedad"}
        action={
          <div className="space-x-2">
            <Button variant="secondary" onClick={() => navigate("/propiedades")}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={saving}>
              {saving ? "Enviando…" : "Enviar a revisión"}
            </Button>
          </div>
        }
      />
      <ErrorBanner message={error} />

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card>
            <h2 className="font-semibold mb-4">Información general</h2>
            <Field label="Slug (identificador único, no se puede cambiar luego)" required>
              <Input
                value={form.slug}
                disabled={slugBloqueado}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="apartamento-moca"
              />
            </Field>
            <Field label="Título del anuncio" required>
              <Input
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tipo de operación" required>
                <select
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={form.tipo_operacion}
                  onChange={(e) =>
                    setForm({ ...form, tipo_operacion: e.target.value as "venta" | "alquiler" })
                  }
                >
                  <option value="venta">En venta</option>
                  <option value="alquiler">En alquiler</option>
                </select>
              </Field>
              <Field label="Ciudad" required>
                <Input
                  value={form.ciudad}
                  onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Descripción introductoria" required>
              <Textarea
                rows={3}
                value={form.detalle_intro}
                onChange={(e) => setForm({ ...form, detalle_intro: e.target.value })}
              />
            </Field>
            <Field label="Datos rápidos (specs)">
              <ListEditor
                items={form.quickspecs}
                onChange={(quickspecs) => setForm({ ...form, quickspecs })}
                placeholder="3 habitaciones, 2 baños, 1 nivel"
              />
            </Field>
          </Card>

          <Card>
            <h2 className="font-semibold mb-1">Características detalladas</h2>
            <p className="text-xs text-slate-400 mb-4">Opcional · pares etiqueta / valor</p>
            {form.caracteristicas.map((row, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <Input
                  value={row.label}
                  placeholder="Localización"
                  onChange={(e) => {
                    const next = [...form.caracteristicas];
                    next[idx] = { ...next[idx], label: e.target.value };
                    setForm({ ...form, caracteristicas: next });
                  }}
                />
                <Input
                  value={row.valor}
                  placeholder="Moca"
                  onChange={(e) => {
                    const next = [...form.caracteristicas];
                    next[idx] = { ...next[idx], valor: e.target.value };
                    setForm({ ...form, caracteristicas: next });
                  }}
                />
                <button
                  className="text-red-500 px-2"
                  onClick={() =>
                    setForm({
                      ...form,
                      caracteristicas: form.caracteristicas.filter((_, i) => i !== idx),
                    })
                  }
                >
                  ×
                </button>
              </div>
            ))}
            <button
              className="text-sm text-panel-gold font-medium"
              onClick={() =>
                setForm({
                  ...form,
                  caracteristicas: [...form.caracteristicas, { label: "", valor: "" }],
                })
              }
            >
              + Agregar característica
            </button>
          </Card>

          <Card>
            <h2 className="font-semibold mb-1">Puntos destacados / cierre</h2>
            <p className="text-xs text-slate-400 mb-4">Opcional · viñetas adicionales</p>
            <ListEditor
              items={form.detalle_bullets}
              onChange={(detalle_bullets) => setForm({ ...form, detalle_bullets })}
            />
            <Field label="Cierre">
              <Textarea
                rows={2}
                value={form.detalle_cierre}
                onChange={(e) => setForm({ ...form, detalle_cierre: e.target.value })}
              />
            </Field>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="font-semibold mb-4">Visibilidad</h2>
            <Toggle
              label="Destacar en Inicio"
              checked={form.destacada}
              onChange={(destacada) => setForm({ ...form, destacada })}
            />
            <Toggle
              label="Visible en el sitio"
              checked={form.visible}
              onChange={(visible) => setForm({ ...form, visible })}
            />
          </Card>
          <Card className="bg-amber-50 border-amber-200">
            <p className="text-sm text-amber-800">
              <strong>Antes de publicar:</strong> este cambio se enviará como una revisión. Vas
              a poder ver una vista previa y compartirla con Lefinor por WhatsApp antes de que
              se publique en producción.
            </p>
          </Card>
          <Card>
            <h2 className="font-semibold mb-4">Galería</h2>
            {slugValido ? (
              <GalleryUploader
                slug={slug ?? form.slug}
                onSaved={() => setGallerySaved(true)}
              />
            ) : (
              <p className="text-sm text-slate-500">
                Escribe primero un slug válido arriba para poder subir fotos y video.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
