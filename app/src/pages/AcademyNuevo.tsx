import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { Button, Card, ErrorBanner, Field, Input, ListEditor, PageHeader, Textarea, Toggle } from "../components/ui";

export function AcademyNuevo() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    id: "",
    titulo: "",
    fecha: "",
    lugar: "Vía Zoom / Google Meet",
    modalidad: "Virtual",
    precio: "",
    descripcionTexto: "",
    temario: [] as string[],
    instructorIdsTexto: "",
    estado: "disponible" as "disponible" | "impartido",
    visible: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function guardar() {
    setSaving(true);
    setError(null);
    const instructor_ids = form.instructorIdsTexto
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await api.crearCurso({
        ...form,
        instructor_ids,
        descripcion: form.descripcionTexto.split("\n\n").map((p) => p.trim()).filter(Boolean),
        temario: form.temario.filter(Boolean),
        precio: form.precio || undefined,
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
        title="Nuevo curso de Academy"
        action={
          <div className="space-x-2">
            <Button variant="secondary" onClick={() => navigate(-1)}>Cancelar</Button>
            <Button onClick={guardar} disabled={saving}>{saving ? "Enviando…" : "Enviar a revisión"}</Button>
          </div>
        }
      />
      <ErrorBanner message={error} />
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card>
            <Field label="Identificador (id)" required>
              <Input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="procesos-basicos-registro-titulos" />
            </Field>
            <Field label="Título del curso" required>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Fecha" required>
                <Input value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} placeholder="Sábado 14 de noviembre, 2026 · 9:00 a.m. a 12:00 p.m." />
              </Field>
              <Field label="Lugar" required>
                <Input value={form.lugar} onChange={(e) => setForm({ ...form, lugar: e.target.value })} />
              </Field>
            </div>
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
            <h2 className="font-semibold mb-1">Instructores</h2>
            <p className="text-xs text-slate-400 mb-3">Uno o más · deben ser profesionales ya registrados</p>
            <Field label="Slugs separados por coma" required>
              <Input
                value={form.instructorIdsTexto}
                onChange={(e) => setForm({ ...form, instructorIdsTexto: e.target.value })}
                placeholder="franklin-morillo, francheska-rodriguez"
              />
            </Field>
          </Card>
          <Card>
            <h2 className="font-semibold mb-4">Estado</h2>
            <Toggle
              label="Disponible (muestra inscripción)"
              checked={form.estado === "disponible"}
              onChange={(v) => setForm({ ...form, estado: v ? "disponible" : "impartido" })}
            />
            <Toggle label="Visible al público" checked={form.visible} onChange={(visible) => setForm({ ...form, visible })} />
          </Card>
        </div>
      </div>
    </div>
  );
}
