import type { DirEntry, FileChange } from "./github";

export const PHOTO_EXTS = ["jpg", "jpeg", "png", "webp"] as const;
export const VIDEO_EXTS = ["mp4", "mov", "webm"] as const;

export type MediaKind = "foto" | "video";

export function kindForExt(ext: string): MediaKind | null {
  const e = ext.toLowerCase();
  if ((PHOTO_EXTS as readonly string[]).includes(e)) return "foto";
  if ((VIDEO_EXTS as readonly string[]).includes(e)) return "video";
  return null;
}

/**
 * Un ítem de galería tal como lo entrega el formulario del panel, en el
 * orden final deseado (posición = índice + 1).
 *
 * - Si viene de un archivo ya existente en el repo, `existingName` +
 *   `blobSha` permiten reordenarlo sin re-subir los bytes.
 * - Si es nuevo, `newContent` trae los bytes (foto) o se deja vacío y se
 *   resuelve por fuera con `r2ObjectData` (video, sube a R2 antes de
 *   generar el puntero .url).
 */
export interface GalleryItemInput {
  ext: string; // sin punto, tal como llegó (jpg, MP4, webp...)
  existingName?: string; // ej. "2.jpg" o "3.mp4.url"
  existingBlobSha?: string;
  newContent?: Uint8Array; // solo para fotos nuevas
  newVideoObjectKey?: string; // key ya subida a R2, solo para videos nuevos
}

export interface GalleryPlan {
  folderPath: string;
  files: FileChange[]; // a escribir en el repo (fotos + punteros .url)
  deletePaths: string[]; // rutas viejas que ya no corresponden
  r2Uploads: { key: string; data: Uint8Array }[]; // videos a subir a R2 antes de commitear
  warnings: string[];
}

export class GalleryValidationError extends Error {}

/**
 * Calcula el plan de archivos para dejar la carpeta
 * public/img/propiedades/<slug>/ con numeración contigua 1..n según el
 * orden de `items`, separando fotos (commit directo) de videos (R2 +
 * puntero <n>.<ext>.url), sin depender de I/O -- toda función pura para
 * poder testearla sin red ni credenciales.
 */
export function planGallery(
  slug: string,
  items: GalleryItemInput[],
  r2PublicBaseUrl: string,
  currentEntries: DirEntry[] = []
): GalleryPlan {
  if (items.length === 0) {
    throw new GalleryValidationError("La galería no puede quedar vacía");
  }

  const first = items[0];
  const firstKind = kindForExt(first.ext);
  if (firstKind !== "foto") {
    // El generador de Lefinor solo advierte si la posición 1 es video; el
    // panel es más estricto y lo bloquea directamente, porque no hay forma
    // de que José corrija esto desde el sitio público una vez publicado.
    throw new GalleryValidationError(
      "La primera imagen (portada) debe ser una foto, no un video"
    );
  }

  const folderPath = `public/img/propiedades/${slug}`;
  const files: FileChange[] = [];
  const warnings: string[] = [];
  const r2Uploads: GalleryPlan["r2Uploads"] = [];

  const keptNames = new Set<string>();

  items.forEach((item, idx) => {
    const position = idx + 1;
    const ext = item.ext.toLowerCase();
    const kind = kindForExt(ext);
    if (!kind) {
      throw new GalleryValidationError(
        `Extensión no soportada: .${item.ext}`
      );
    }

    if (kind === "foto") {
      const targetPath = `${folderPath}/${position}.${ext}`;
      if (item.existingName) {
        keptNames.add(item.existingName);
        if (item.existingName !== `${position}.${ext}`) {
          if (!item.existingBlobSha) {
            throw new GalleryValidationError(
              `Falta blobSha para reordenar ${item.existingName}`
            );
          }
          files.push({ path: targetPath, blobSha: item.existingBlobSha });
        }
        // si el nombre no cambió, no hace falta tocar el archivo
      } else {
        if (!item.newContent) {
          throw new GalleryValidationError(
            `Falta contenido para la foto nueva en posición ${position}`
          );
        }
        files.push({ path: targetPath, content: item.newContent });
      }
    } else {
      // video: puntero <n>.<ext>.url apuntando al objeto público en R2
      const pointerPath = `${folderPath}/${position}.${ext}.url`;
      if (item.existingName) {
        keptNames.add(item.existingName);
        if (item.existingName !== `${position}.${ext}.url`) {
          if (!item.existingBlobSha) {
            throw new GalleryValidationError(
              `Falta blobSha para reordenar ${item.existingName}`
            );
          }
          files.push({ path: pointerPath, blobSha: item.existingBlobSha });
        }
      } else {
        if (!item.newVideoObjectKey) {
          throw new GalleryValidationError(
            `Falta el objeto R2 para el video nuevo en posición ${position}`
          );
        }
        const publicUrl = `${r2PublicBaseUrl.replace(/\/$/, "")}/${item.newVideoObjectKey}`;
        files.push({ path: pointerPath, content: publicUrl });
      }
    }
  });

  const deletePaths = computeDeletions(folderPath, currentEntries, keptNames);

  return { folderPath, files, deletePaths, r2Uploads, warnings };
}

/**
 * Compara el listado real de la carpeta (Contents API) contra los nombres
 * que el plan final conserva, para saber qué rutas viejas hay que borrar
 * del árbol de git (archivos que quedaron fuera de la nueva numeración).
 */
export function computeDeletions(
  folderPath: string,
  currentEntries: DirEntry[],
  keptNames: Set<string>
): string[] {
  return currentEntries
    .filter((e) => e.type === "file" && !keptNames.has(e.name))
    .map((e) => `${folderPath}/${e.name}`);
}

/** Parsea "1.jpg" o "3.mp4.url" -> { position, ext, isPointer }. null si no matchea la convención. */
export function parseGalleryFileName(
  name: string
): { position: number; ext: string; isPointer: boolean } | null {
  const pointerMatch = name.match(/^(\d+)\.([A-Za-z0-9]+)\.url$/);
  if (pointerMatch) {
    return {
      position: parseInt(pointerMatch[1], 10),
      ext: pointerMatch[2].toLowerCase(),
      isPointer: true,
    };
  }
  const fileMatch = name.match(/^(\d+)\.([A-Za-z0-9]+)$/);
  if (fileMatch) {
    return {
      position: parseInt(fileMatch[1], 10),
      ext: fileMatch[2].toLowerCase(),
      isPointer: false,
    };
  }
  return null;
}
