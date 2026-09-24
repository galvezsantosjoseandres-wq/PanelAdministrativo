import { describe, expect, it } from "vitest";
import { decodeImageUpload, imageUploadErrorMessage, imageUploadSchema } from "./imageUpload";

describe("imageUploadSchema", () => {
  it("acepta las extensiones de foto permitidas", () => {
    for (const ext of ["jpg", "jpeg", "png", "webp"]) {
      const result = imageUploadSchema.safeParse({ ext, base64: "AAAA" });
      expect(result.success).toBe(true);
    }
  });

  it("acepta la extensión en mayúsculas (normaliza antes de validar)", () => {
    const result = imageUploadSchema.safeParse({ ext: "PNG", base64: "AAAA" });
    expect(result.success).toBe(true);
  });

  it("rechaza extensiones ejecutables/con marcado como .svg o .html con mensaje claro", () => {
    for (const ext of ["svg", "html", "htm", "exe", "php"]) {
      const result = imageUploadSchema.safeParse({ ext, base64: "AAAA" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(imageUploadErrorMessage(result.error)).toContain(ext);
        expect(imageUploadErrorMessage(result.error)).toMatch(/no soportada/);
      }
    }
  });

  it("rechaza extensiones de video (esas van por el endpoint de galería, no por portadas)", () => {
    const result = imageUploadSchema.safeParse({ ext: "mp4", base64: "AAAA" });
    expect(result.success).toBe(false);
  });

  it("rechaza base64 vacío", () => {
    const result = imageUploadSchema.safeParse({ ext: "jpg", base64: "" });
    expect(result.success).toBe(false);
  });
});

describe("decodeImageUpload", () => {
  it("decodifica el base64 a bytes y normaliza la extensión", () => {
    const { ext, bytes } = decodeImageUpload({ ext: "JPG", base64: btoa("hola") });
    expect(ext).toBe("jpg");
    expect(new TextDecoder().decode(bytes)).toBe("hola");
  });
});
