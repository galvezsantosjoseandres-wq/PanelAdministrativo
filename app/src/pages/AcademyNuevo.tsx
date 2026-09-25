import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError, type Profesional } from "../lib/api";
import { Button, Card, ErrorBanner, Field, Input, ListEditor, PageHeader, Textarea, Toggle } from "../components/ui";
import { ImageUploadField, type ImageUpload } from "../components/ImageUploadField";

const LEFINOR_BASE_URL = "https://lefinor.com";

const empty = {
  id: "",
  titulo: "",
  fecha: "",
  fecha_iso: new Date().toISOString().slice(0, 10),
  lugar: "Vía Zoom / Google Meet",
  modalidad: "Virtual",
  precio: "",
  descripcionTexto: "",
  temario: [] as string[],
  instructor_ids: [] as string[],
  estado: "disponible" as "disponible" | "impartido",
  destacado: false,
  visible: false,
  imagen_portada: null as string | null,
};

export function AcademyNuevo() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const [portadaUpload, setPortadaUpload] = useState<ImageUpload | null>(null);
  const [form, setForm] = useState(empty);
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.listarProfesionales().then((data) => setProfesionales(data.items));
  }, []);

  useEffect(() => {
    if (!id) return;
    api.obtenerCurso(id).then((data) => {
      const c = data as unknown as {
        id: string;
        titulo: string;
        fecha: string;
        fecha_iso: string;
        lugar: string;
        modalidad: string;
        precio?: string;
        descripcion?: string[];
        temario?: string[];
        instructor_ids?: string[];
        estado: "disponible" | "impartido";
        destacado?: boolean;
        visible: boolean;
        imagen_portada?: string | null;
      };
      setForm({
        ...empty,
        ...c,
        precio: c.precio ?? "",
        descripcionTexto: (c.descripcion ?? []).join("\n\n"),
        temario: c.temario ?? [],
        instructor_ids: c.instructor_ids ?? [],
        destacado: c.destacado ?? false,
      });
    });
  }, [id]);

  function toggleInstructor(slug: string) {
    setForm((f) => ({
      ...f,
      instructor_ids: f.instructor_ids.includes(slug)
        ? f.instructor_ids.filter((s) => s !== slug)
        : [...f.instructor_ids, slug],
    }));
  }

  async function guardar() {
    setSaving(true);
    setError(null);
    try {
      await api.crearCurso({
        ...form,
        descripcion: form.descripcionTexto.split("\n\n").map((p) => p.trim()).filter(Boolean),
        temario: form.temario.filter(Boolean),
        precio: form.precio || undefined,
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
        title={isNew ? "Nuevo curso de Academy" : form.titulo || "Editar curso de Academy"}
        action={
          <div className="space-x-2">
            <Button variant="secondary" onClick={() => navigate("/academy")}>Cancelar</Button>
            <Button onClick={guardar} disabled={saving}>{saving ? "Enviando…" : "Enviar a revisión"}</Button>
          </div>
        }
      />
      <ErrorBanner message={error} />
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card>
            <Field label="Identificador (id)" required>
              <Input
                value={form.id}
                disabled={!isNew}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                placeholder="procesos-basicos-registro-titulos"
              />
            </Field>
            <Field label="Título del curso" required>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Fecha (texto para mostrar)" required>
                <Input value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} placeholder="Sábado 14 de noviembre, 2026 · 9:00 a.m. a 12:00 p.m." />
              </Field>
              <Field label="Fecha (para ordenar, AAAA-MM-DD)" required>
                <Input type="date" value={form.fecha_iso} onChange={(e) => setForm({ ...form, fecha_iso: e.target.value })} />
              </Field>
            </div>
            <Field label="Lugar" required>
              <Input value={form.lugar} onChange={(e) => setForm({ ...form, lugar: e.target.value })} />
            </Field>
            <Field label="Modalidad" required>
              <Input value={form.modalidad} onChange={(e) => setForm({ ...form, modalidad: e.target.value })} />
            </Field>
            <Field label="Precio (opcional)">
              <Input value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} placeholder="RD$500.00 por persona" />
            </Field>
            <Field label="Descripción (un párrafo por línea en blanco)" required>
              <Textarea rows={6} value={form.descripcionTexto} onChange={(e) => setForm({ ...form, descripcionTexto: e.target.value })} />
            </Field>
            <Field label="Temario (opcional)">
              <ListEditor items={form.temario} onChange={(temario) => setForm({ ...form, temario })} />
            </Field>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <h2 className="font-semibold mb-1">Imagen de portada</h2>
            <p className="text-xs text-slate-400 mb-3">Opcional</p>
            <ImageUploadField
              value={portadaUpload}
              onChange={setPortadaUpload}
              existingPreviewUrl={form.imagen_portada ? `${LEFINOR_BASE_URL}${form.imagen_portada}` : null}
            />
          </Card>
          <Card>
            <h2 className="font-semibold mb-1">Instructores</h2>
            <p className="text-xs text-slate-400 mb-3">Uno o más · deben ser profesionales ya registrados</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {profesionales.map((p) => (
                <label key={p.slug} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.instructor_ids.includes(p.slug)}
                    onChange={() => toggleInstructor(p.slug)}
                  />
                  {p.nombre} — {p.cargo}
                </label>
              ))}
              {profesionales.length === 0 && (
                <p className="text-xs text-slate-400">Cargando profesionales…</p>
              )}
            </div>
          </Card>
          <Card>
            <h2 className="font-semibold mb-4">Estado</h2>
            <Toggle
              label="Disponible (muestra inscripción)"
              checked={form.estado === "disponible"}
              onChange={(v) => setForm({ ...form, estado: v ? "disponible" : "impartido" })}
            />
            <Toggle
              label="Destacar entre próximos cursos"
              checked={form.destacado}
              onChange={(destacado) => setForm({ ...form, destacado })}
            />
            <Toggle label="Visible al público" checked={form.visible} onChange={(visible) => setForm({ ...form, visible })} />
          </Card>
        </div>
      </div>
    </div>
  );
}
