import { SLUG_REGEX } from "./schemas";

/**
 * Valida un `slug` recibido como parámetro de URL (`c.req.param("slug")`)
 * antes de usarlo para construir una ruta del repo o una key de R2.
 *
 * Hono decodifica secuencias como `%2F` dentro de un param a un `/`
 * literal (verificado: `GET /api/propiedades/..%2Fdata/galeria` produce
 * `param("slug") === "../data"`), así que un slug nunca validado permite
 * escapar del directorio esperado (`public/img/propiedades/<slug>/...`)
 * hacia cualquier otra ruta del repo -- lectura o escritura arbitraria
 * (path traversal) para cualquier usuario ya autenticado del panel.
 *
 * Usa el mismo regex que `propiedadSchema.slug` (la validación que ya
 * corre al CREAR una propiedad) -- un slug real nunca necesita `.`, `/`
 * ni mayúsculas, así que esto no rechaza ningún slug legítimo.
 *
 * Devuelve el slug si es válido, o null si no lo es (el caller decide el
 * código de estado, normalmente 400).
 */
export function parseSlugParam(raw: string): string | null {
  return SLUG_REGEX.test(raw) ? raw : null;
}
