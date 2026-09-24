// Debe coincidir exactamente con SLUG_REGEX en worker/lib/schemas.ts -- se
// usa acá solo para habilitar/deshabilitar UI, la validación real sigue
// siendo la del backend.
export const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
