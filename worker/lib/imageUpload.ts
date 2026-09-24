import { z } from "zod";
import { PHOTO_EXTS } from "./gallery";

// Portadas únicas (publicaciones/academy/profesionales) son imágenes
// chicas -- a diferencia del endpoint de galería de propiedades (que puede
// llevar video y por eso usa multipart), acá base64-en-JSON es aceptable:
// un solo campo extra junto al resto del formulario, sin request separado.
//
// El whitelist de extensión es el mismo PHOTO_EXTS que usa gallery.ts --
// nunca lo que el cliente diga que es. Sin esto, cualquiera con acceso a la
// API (no solo la UI, que sí filtra por accept="image/*") podía commitear
// un .svg o .html con JS embebido bajo public/img/.../<slug>.<ext> y
// quedaba servido desde el dominio real de Lefinor: XSS almacenado contra
// visitantes del sitio, no solo un problema cosmético de "subieron mal el
// archivo".
export const imageUploadSchema = z.object({
  ext: z
    .string()
    .toLowerCase()
    .refine(
      (ext) => (PHOTO_EXTS as readonly string[]).includes(ext),
      (ext) => ({
        message: `Extensión de imagen no soportada: .${ext}. Solo se aceptan: ${PHOTO_EXTS.join(", ")}.`,
      })
    ),
  base64: z.string().min(1),
});
export type ImageUpload = z.infer<typeof imageUploadSchema>;

/** Mensaje legible del primer error de validación, en vez de un genérico. */
export function imageUploadErrorMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Imagen inválida";
}

export function decodeImageUpload(upload: ImageUpload): {
  ext: string;
  bytes: Uint8Array;
} {
  const binary = atob(upload.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { ext: upload.ext.toLowerCase(), bytes };
}
