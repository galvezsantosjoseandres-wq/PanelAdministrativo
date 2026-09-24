import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { Button, Card, ErrorBanner, Field, Input, PageHeader, Textarea } from "../components/ui";
import { ImageUploadField, type ImageUpload } from "../components/ImageUploadField";

export function PublicacionNueva() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    slug: "",
    categoria: "derecho-civil",
    titulo: "",
    fecha: new Date().toLocaleDateString("es-DO", { day: "numeric", month: "long", year: "numeric" }),
    extracto: "",
    cuerpoTexto: "",
    fuente: "",
    autor_id: "",
    imagen_portada: null as string | null,
    visible: false,
  });
  const [portadaUpload, setPortadaUpload] = useState<ImageUpload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function guardar() {
    setSaving(true);
    setError(null);
    try {
      await api.crearPublicacion({
        ...form,
        cuerpo: form.cuerpoTexto.split("\n\n").map((p) => p.trim()).filter(Boolean),
        portadaUpload,
      });
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
        title="Nueva publicación"
        action={
          <div className="space-x-2">
            <Button variant="secondary" onClick={() => navigate(-1)}>Cancelar</Button>
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
            <div className="grid grid-cols-2 gap-4">
              <Field label="Categoría" required>
                <Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
              </Field>
              <Field label="Fecha" required>
                <Input value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
              </Field>
            </div>
            <Field label="Slug" required>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="analisis-codigo-penal-empresas"
              />
            </Field>
            <Field label="Título" required>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </Field>
            <Field label="Extracto / resumen" required>
              <Textarea rows={3} value={form.extracto} onChange={(e) => setForm({ ...form, extracto: e.target.value })} />
            </Field>
            <Field label="Cuerpo del artículo (un párrafo por línea en blanco)" required>
              <Textarea rows={8} value={form.cuerpoTexto} onChange={(e) => setForm({ ...form, cuerpoTexto: e.target.value })} />
            </Field>
            <Field label="Fuente">
              <Input value={form.fuente} onChange={(e) => setForm({ ...form, fuente: e.target.value })} />
            </Field>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <h2 className="font-semibold mb-1">Imagen de portada</h2>
            <p className="text-xs text-slate-400 mb-3">
              Opcional. Si no subes una, el artículo usa la imagen por defecto de la categoría.
            </p>
            <ImageUploadField value={portadaUpload} onChange={setPortadaUpload} />
          </Card>
          <Card>
            <h2 className="font-semibold mb-1">Autor</h2>
            <p className="text-xs text-slate-400 mb-3">Obligatorio · debe ser un profesional ya registrado</p>
            <Field label="Slug del profesional" required>
              <Input
                value={form.autor_id}
                onChange={(e) => setForm({ ...form, autor_id: e.target.value })}
                placeholder="franklin-morillo"
              />
            </Field>
          </Card>
          <Card className="bg-amber-50 border-amber-200 text-sm text-amber-800">
            El autor se muestra en la tarjeta al final del artículo, con su foto y cargo
            tomados directamente de su ficha de profesional.
          </Card>
        </div>
      </div>
    </div>
  );
}
