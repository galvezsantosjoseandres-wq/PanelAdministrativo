import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { Button, Card, ErrorBanner, Field, Input, ListEditor, PageHeader, Textarea } from "../components/ui";

export function ProfesionalNuevo() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    slug: "",
    nombre: "",
    honorifico: "",
    cargo: "",
    unidad: "abogados",
    area: "Lefinor Abogados",
    bioCompleta: "",
    formacion: [] as string[],
    experiencia: [] as string[],
    email: "",
    telefono: "",
    telefono_personal: "",
    orden: 1,
    foto: "",
    fotoAlt: "",
    vcardArchivo: "",
  });
  const [consiente, setConsiente] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function guardar() {
    setSaving(true);
    setError(null);
    try {
      await api.crearProfesional(
        { ...form, telefono_personal: form.telefono_personal || undefined },
        consiente
      );
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
        title="Agregar profesional"
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
            <h2 className="font-semibold mb-4">Datos generales</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Slug" required>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="nombre-apellido" />
              </Field>
              <Field label="Honorífico">
                <Input value={form.honorifico} onChange={(e) => setForm({ ...form, honorifico: e.target.value })} placeholder="Lic." />
              </Field>
            </div>
            <Field label="Nombre completo" required>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre y apellidos" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Cargo" required>
                <Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} placeholder="Ej. Abogado Asociado" />
              </Field>
              <Field label="Área" required>
                <Input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
              </Field>
            </div>
            <Field label="Biografía completa" required>
              <Textarea rows={5} value={form.bioCompleta} onChange={(e) => setForm({ ...form, bioCompleta: e.target.value })} placeholder="Texto para su página individual" />
            </Field>
            <Field label="Formación">
              <ListEditor items={form.formacion} onChange={(formacion) => setForm({ ...form, formacion })} />
            </Field>
            <Field label="Experiencia">
              <ListEditor items={form.experiencia} onChange={(experiencia) => setForm({ ...form, experiencia })} />
            </Field>
          </Card>

          <Card>
            <h2 className="font-semibold mb-4">Contacto</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Correo electrónico" required>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nombre@lefinor.com" />
              </Field>
              <Field label="Teléfono" required>
                <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="Respaldo si no hay personal" />
              </Field>
            </div>
            <Field label="Teléfono personal (WhatsApp)">
              <Input value={form.telefono_personal} onChange={(e) => setForm({ ...form, telefono_personal: e.target.value })} placeholder="Requiere su consentimiento por escrito" />
            </Field>
            {form.telefono_personal && (
              <label className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">
                <input type="checkbox" checked={consiente} onChange={(e) => setConsiente(e.target.checked)} className="mt-0.5" />
                Confirmo que {form.nombre || "el profesional"} dio su consentimiento explícito para publicar este número.
              </label>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="font-semibold mb-4">Foto de perfil</h2>
            <div className="w-32 h-32 rounded-full bg-slate-100 mx-auto mb-4" />
            <p className="text-xs text-slate-400 text-center mb-4">Fondo de estudio, a color, cara centrada</p>
            <Field label="Ruta de la foto (temporal, hasta wirear subida de imagen)">
              <Input value={form.foto} onChange={(e) => setForm({ ...form, foto: e.target.value })} placeholder="/img/equipo/nombre-apellido.jpg" />
            </Field>
          </Card>
          <Card>
            <Field label="Orden de aparición">
              <Input
                type="number"
                value={form.orden}
                onChange={(e) => setForm({ ...form, orden: Number(e.target.value) })}
              />
            </Field>
          </Card>
        </div>
      </div>
    </div>
  );
}
