export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const errorField =
      body && typeof body === "object" && "error" in body
        ? (body as { error: unknown }).error
        : null;
    const message =
      typeof errorField === "string" ? errorField : `Error ${res.status}`;
    throw new ApiError(message, res.status);
  }
  return body as T;
}

export const api = {
  me: () =>
    request<{ email: string; role: "propietario" | "colaborador"; teamDomain: string }>("/me"),

  listarPropiedades: () => request<{ items: Propiedad[] }>("/propiedades"),
  obtenerPropiedad: (slug: string) => request<Propiedad>(`/propiedades/${slug}`),
  crearPropiedad: (data: unknown) =>
    request<{ prNumber: number }>("/propiedades", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  togglePropiedad: (slug: string, campo: "destacada" | "visible", valor: boolean) =>
    request<{ prNumber: number }>(`/propiedades/${slug}`, {
      method: "PATCH",
      body: JSON.stringify({ [campo]: valor }),
    }),
  eliminarPropiedad: (slug: string) =>
    request<{ prNumber: number }>(`/propiedades/${slug}`, { method: "DELETE" }),

  listarPublicaciones: () => request<{ items: Publicacion[] }>("/publicaciones"),
  obtenerPublicacion: (slug: string) => request<Publicacion>(`/publicaciones/${slug}`),
  crearPublicacion: (data: unknown) =>
    request<{ prNumber: number }>("/publicaciones", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  togglePublicacion: (slug: string, visible: boolean) =>
    request<{ prNumber: number }>(`/publicaciones/${slug}`, {
      method: "PATCH",
      body: JSON.stringify({ visible }),
    }),
  eliminarPublicacion: (slug: string) =>
    request<{ prNumber: number }>(`/publicaciones/${slug}`, { method: "DELETE" }),

  listarCursos: () => request<{ items: CursoAcademy[] }>("/academy"),
  obtenerCurso: (id: string) => request<CursoAcademy>(`/academy/${id}`),
  crearCurso: (data: unknown) =>
    request<{ prNumber: number }>("/academy", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  toggleCurso: (id: string, campo: "destacado" | "visible", valor: boolean) =>
    request<{ prNumber: number }>(`/academy/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ [campo]: valor }),
    }),
  eliminarCurso: (id: string) =>
    request<{ prNumber: number }>(`/academy/${id}`, { method: "DELETE" }),

  listarProfesionales: () => request<{ items: Profesional[] }>("/profesionales"),
  obtenerProfesional: (slug: string) => request<Profesional>(`/profesionales/${slug}`),
  crearProfesional: (data: unknown, consentimientoTelefonoPersonal?: boolean) =>
    request<{ prNumber: number }>("/profesionales", {
      method: "POST",
      body: JSON.stringify({ ...(data as object), consentimientoTelefonoPersonal }),
    }),
  eliminarProfesional: (slug: string) =>
    request<{ prNumber: number }>(`/profesionales/${slug}`, { method: "DELETE" }),

  obtenerHero: () => request<{ items: HeroSlide[] }>("/hero"),
  guardarHero: (items: HeroSlideInput[]) =>
    request<{ prNumber: number }>("/hero", {
      method: "PUT",
      body: JSON.stringify({ items }),
    }),

  cambiosPendientes: () =>
    request<{ items: PendingChange[] }>("/cambios-pendientes"),
  cambiosRecientes: () =>
    request<{ items: PendingChange[] }>("/cambios-pendientes/recientes"),
  vistaPrevia: (id: number) =>
    request<{ previewUrl: string | null }>(`/cambios-pendientes/${id}/preview`),
  publicarCambio: (id: number) =>
    request<{ ok: true }>(`/cambios-pendientes/${id}/publicar`, { method: "POST" }),
  descartarCambio: (id: number) =>
    request<{ ok: true }>(`/cambios-pendientes/${id}/descartar`, { method: "POST" }),

  usuarios: () => request<{ items: PanelUser[] }>("/ajustes/usuarios"),
  invitarUsuario: (email: string, role: "propietario" | "colaborador") =>
    request<{ ok: true; accessSynced: boolean }>("/ajustes/usuarios", {
      method: "POST",
      body: JSON.stringify({ email, role }),
    }),
  quitarUsuario: (email: string) =>
    request<{ ok: true; accessSynced: boolean }>(
      `/ajustes/usuarios/${encodeURIComponent(email)}`,
      { method: "DELETE" }
    ),

  historial: (params: Record<string, string | undefined>) => {
    const q = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v) as [string, string][]
    );
    return request<{ items: AuditLogEntry[] }>(`/historial?${q.toString()}`);
  },
};

export interface HeroBoton {
  texto: string;
  href: string;
}

export interface Propiedad {
  slug: string;
  titulo: string;
  ciudad: string;
  tipo_operacion: "venta" | "alquiler";
  destacada: boolean;
  visible: boolean;
}

export interface Publicacion {
  slug: string;
  categoria: string;
  titulo: string;
  fecha: string;
  autor_id: string;
  visible: boolean;
}

export interface CursoAcademy {
  id: string;
  titulo: string;
  estado: "disponible" | "impartido";
  fecha: string;
  destacado: boolean;
  visible: boolean;
}

export interface Profesional {
  slug: string;
  nombre: string;
  cargo: string;
  area: string;
  orden: number;
}

export interface HeroSlide {
  eyebrow: string;
  titulo: string;
  subtexto: string;
  imagen: string;
  imagen_alt: string;
  imagen_posicion: string;
  botones?: HeroBoton[];
}

export interface HeroSlideInput extends HeroSlide {
  imagenUpload?: { ext: string; base64: string } | null;
}

export interface PendingChange {
  id: number;
  entity_type: string;
  entity_id: string;
  action_type: string;
  summary: string;
  github_pr_number: number;
  status: string;
  preview_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PanelUser {
  email: string;
  role: "propietario" | "colaborador";
  invited_by: string | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: number;
  user_email: string;
  role: string;
  action_type: string;
  entity_type: string | null;
  entity_id: string | null;
  summary: string | null;
  created_at: string;
}
