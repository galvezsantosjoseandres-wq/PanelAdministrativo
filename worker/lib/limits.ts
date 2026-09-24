/**
 * Límites de tamaño de subida.
 *
 * VALORES PROVISIONALES -- no están calibrados contra el plan real de
 * Cloudflare Workers que tenga la cuenta Activosweb. El techo real de la
 * plataforma (tamaño máximo de request body del plan) puede ser MENOR que
 * estos números, en cuyo caso Cloudflare rechaza la request en el borde
 * antes de que el Worker llegue a correr, y el mensaje de error "amigable"
 * de más abajo nunca se dispara -- el navegador vería un error genérico de
 * red/plataforma, no el JSON de error de esta API. Confirmar el plan real
 * y ajustar estos números (y avisar a José del límite real) antes de
 * considerar esto definitivo.
 */
export const MAX_PORTADA_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB, imagen ya decodificada
// Presupuesto del request completo (JSON): el base64 de una imagen de 8MB
// pesa ~10.7MB codificado (+33%), más el resto de los campos del
// formulario (texto, nunca pesado) -- 11MB de margen es holgado.
export const MAX_PORTADA_REQUEST_BYTES = 11 * 1024 * 1024;

export const MAX_GALLERY_REQUEST_BYTES = 100 * 1024 * 1024; // 100MB, incluye video

export function mb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Corta temprano por Content-Length cuando el header está presente, antes
 * de leer/parsear el body -- evita materializar en memoria una request que
 * ya sabemos que vamos a rechazar. No es infalible: un cliente puede omitir
 * el header o usar chunked transfer-encoding, así que esto es una
 * optimización, no la única defensa (el tamaño real decodificado se vuelve
 * a chequear después de leer el archivo, sección "backstop").
 */
export function exceedsContentLength(
  req: Request,
  maxBytes: number
): boolean {
  const contentLength = req.headers.get("content-length");
  if (!contentLength) return false;
  const declared = Number(contentLength);
  return Number.isFinite(declared) && declared > maxBytes;
}
