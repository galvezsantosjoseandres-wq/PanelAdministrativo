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
  me: () => request<{ email: string; role: "propietario" | "colaborador" }>("/me"),

  crearPropiedad: (data: unknown) =>
    request<{ prNumber: number }>("/propiedades", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  crearPublicacion: (data: unknown) =>
    request<{ prNumber: number }>("/publicaciones", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  crearCurso: (data: unknown) =>
    request<{ prNumber: number }>("/academy", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  crearProfesional: (data: unknown, consentimientoTelefonoPersonal?: boolean) =>
    request<{ prNumber: number }>("/profesionales", {
      method: "POST",
      body: JSON.stringify({ ...(data as object), consentimientoTelefonoPersonal }),
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

  obtenerHero: () => request<{ items: HeroSlide[] }>("/hero"),
  guardarHero: (items: HeroSlideInput[]) =>
    request<{ prNumber: number }>("/hero", {
      method: "PUT",
      body: JSON.stringify({ items }),
    }),

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
