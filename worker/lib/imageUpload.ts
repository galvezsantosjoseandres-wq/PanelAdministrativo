import { z } from "zod";

// Portadas únicas (publicaciones/academy/profesionales) son imágenes
// chicas -- a diferencia del endpoint de galería de propiedades (que puede
// llevar video y por eso usa multipart), acá base64-en-JSON es aceptable:
// un solo campo extra junto al resto del formulario, sin request separado.
export const imageUploadSchema = z.object({
  ext: z.string().min(1),
  base64: z.string().min(1),
});
export type ImageUpload = z.infer<typeof imageUploadSchema>;

export function decodeImageUpload(upload: ImageUpload): {
  ext: string;
  bytes: Uint8Array;
} {
  const binary = atob(upload.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { ext: upload.ext.toLowerCase(), bytes };
}
