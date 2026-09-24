import { z } from "zod";

// Esquemas exactos verificados contra data/*.json del repo Lefinor -- ver
// sección 9 del plan. No se inventan campos nuevos.

export const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const slug = z
  .string()
  .min(1)
  .regex(SLUG_REGEX, "Slug inválido: usa minúsculas, números y guiones");

export const propiedadSchema = z.object({
  slug,
  titulo: z.string().min(1),
  tipo_operacion: z.enum(["venta", "alquiler"]),
  ciudad: z.string().min(1),
  quickspecs: z.array(z.string()).default([]),
  caracteristicas: z
    .array(z.object({ label: z.string().min(1), valor: z.string().min(1) }))
    .default([]),
  detalle_intro: z.string().default(""),
  detalle_bullets: z.array(z.string()).default([]),
  detalle_cierre: z.string().default(""),
  destacada: z.boolean().default(false),
  visible: z.boolean().default(false),
});
export type Propiedad = z.infer<typeof propiedadSchema>;

export const publicacionSchema = z.object({
  slug,
  categoria: z.string().min(1),
  titulo: z.string().min(1),
  fecha: z.string().min(1),
  extracto: z.string().min(1),
  cuerpo: z.array(z.string()).min(1, "El cuerpo debe tener al menos un párrafo"),
  imagen_portada: z.string().nullable().default(null),
  fuente: z.string().nullable().default(null),
  autor_id: z.string().min(1, "El autor es obligatorio"),
  visible: z.boolean().default(false),
});
export type Publicacion = z.infer<typeof publicacionSchema>;

export const cursoAcademySchema = z.object({
  id: slug,
  titulo: z.string().min(1),
  instructor_ids: z
    .array(z.string().min(1))
    .min(1, "Debe haber al menos un instructor"),
  estado: z.enum(["disponible", "impartido"]),
  fecha: z.string().min(1),
  lugar: z.string().min(1),
  modalidad: z.string().min(1),
  precio: z.string().optional(),
  temario: z.array(z.string()).optional(),
  imagen_portada: z.string().nullable().default(null),
  descripcion: z.array(z.string()).default([]),
  visible: z.boolean().default(false),
});
export type CursoAcademy = z.infer<typeof cursoAcademySchema>;

export const profesionalSchema = z.object({
  slug,
  orden: z.number().int().nonnegative(),
  honorifico: z.string().default(""),
  nombre: z.string().min(1),
  cargo: z.string().min(1),
  unidad: z.string().min(1),
  area: z.string().min(1),
  foto: z.string().min(1),
  fotoAlt: z.string().default(""),
  formacion: z.array(z.string()).default([]),
  experiencia: z.array(z.string()).default([]),
  idiomas: z.array(z.string()).default([]),
  fraseDistintiva: z.string().default(""),
  bioCompleta: z.string().min(1),
  telefono_personal: z.string().optional(),
  telefono: z.string().min(1),
  email: z.string().email(),
  vcardArchivo: z.string().default(""),
});
export type Profesional = z.infer<typeof profesionalSchema>;
