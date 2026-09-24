import { describe, expect, it } from "vitest";
import {
  GalleryValidationError,
  computeDeletions,
  parseGalleryFileName,
  planGallery,
} from "./gallery";
import type { DirEntry } from "./github";

const R2_BASE = "https://media.lefinor.com";

describe("planGallery", () => {
  it("numera fotos nuevas de forma contigua desde 1", () => {
    const plan = planGallery(
      "apartamento-moca",
      [
        { ext: "jpg", newContent: new Uint8Array([1]) },
        { ext: "png", newContent: new Uint8Array([2]) },
      ],
      R2_BASE
    );
    expect(plan.files.map((f) => f.path)).toEqual([
      "public/img/propiedades/apartamento-moca/1.jpg",
      "public/img/propiedades/apartamento-moca/2.png",
    ]);
  });

  it("rechaza que la posición 1 sea un video", () => {
    expect(() =>
      planGallery(
        "x",
        [{ ext: "mp4", newVideoObjectKey: "propiedades/x/1.mp4" }],
        R2_BASE
      )
    ).toThrow(GalleryValidationError);
  });

  it("rechaza galería vacía", () => {
    expect(() => planGallery("x", [], R2_BASE)).toThrow(
      GalleryValidationError
    );
  });

  it("genera un puntero .url con la URL pública para videos nuevos", () => {
    const plan = planGallery(
      "x",
      [
        { ext: "jpg", newContent: new Uint8Array([1]) },
        { ext: "mp4", newVideoObjectKey: "lefinor/propiedades/x/2.mp4" },
      ],
      R2_BASE
    );
    const pointer = plan.files.find((f) => f.path.endsWith(".mp4.url"));
    expect(pointer && "content" in pointer && pointer.content).toBe(
      "https://media.lefinor.com/lefinor/propiedades/x/2.mp4"
    );
  });

  it("reordena un archivo existente reutilizando el blobSha sin re-subir bytes", () => {
    const plan = planGallery(
      "x",
      [
        { ext: "jpg", existingName: "2.jpg", existingBlobSha: "sha-2" },
        { ext: "jpg", existingName: "1.jpg", existingBlobSha: "sha-1" },
      ],
      R2_BASE
    );
    // el que era 2.jpg pasa a la posición 1 -> se reescribe con su mismo blobSha
    expect(plan.files).toContainEqual({
      path: "public/img/propiedades/x/1.jpg",
      blobSha: "sha-2",
    });
    // el que era 1.jpg pasa a la posición 2
    expect(plan.files).toContainEqual({
      path: "public/img/propiedades/x/2.jpg",
      blobSha: "sha-1",
    });
  });

  it("no reescribe un archivo cuya posición no cambió", () => {
    const plan = planGallery(
      "x",
      [{ ext: "jpg", existingName: "1.jpg", existingBlobSha: "sha-1" }],
      R2_BASE
    );
    expect(plan.files).toEqual([]);
  });

  it("marca para borrar los archivos que quedaron fuera de la nueva numeración", () => {
    const currentEntries: DirEntry[] = [
      { name: "1.jpg", sha: "sha-1", type: "file" },
      { name: "2.jpg", sha: "sha-2", type: "file" },
      { name: "3.mp4.url", sha: "sha-3", type: "file" },
    ];
    const plan = planGallery(
      "x",
      [{ ext: "jpg", existingName: "1.jpg", existingBlobSha: "sha-1" }],
      R2_BASE,
      currentEntries
    );
    expect(plan.deletePaths.sort()).toEqual([
      "public/img/propiedades/x/2.jpg",
      "public/img/propiedades/x/3.mp4.url",
    ]);
  });

  it("rechaza una extensión no soportada", () => {
    expect(() =>
      planGallery(
        "x",
        [{ ext: "gif", newContent: new Uint8Array([1]) }],
        R2_BASE
      )
    ).toThrow(GalleryValidationError);
  });
});

describe("computeDeletions", () => {
  it("no marca nada para borrar si todo se conserva", () => {
    const entries: DirEntry[] = [{ name: "1.jpg", sha: "s", type: "file" }];
    expect(
      computeDeletions("folder", entries, new Set(["1.jpg"]))
    ).toEqual([]);
  });
});

describe("parseGalleryFileName", () => {
  it("reconoce archivos numerados normales", () => {
    expect(parseGalleryFileName("3.jpg")).toEqual({
      position: 3,
      ext: "jpg",
      isPointer: false,
    });
  });

  it("reconoce punteros .url de video", () => {
    expect(parseGalleryFileName("2.mp4.url")).toEqual({
      position: 2,
      ext: "mp4",
      isPointer: true,
    });
  });

  it("devuelve null para nombres fuera de convención", () => {
    expect(parseGalleryFileName("portada.jpg")).toBeNull();
    expect(parseGalleryFileName("10a.jpg")).toBeNull();
  });
});
