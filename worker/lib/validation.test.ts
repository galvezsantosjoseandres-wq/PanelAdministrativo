import { describe, expect, it } from "vitest";
import { parseSlugParam } from "./validation";

describe("parseSlugParam", () => {
  it("acepta un slug válido", () => {
    expect(parseSlugParam("apartamento-moca")).toBe("apartamento-moca");
    expect(parseSlugParam("casa2")).toBe("casa2");
  });

  it("rechaza path traversal vía secuencia .. decodificada por el router", () => {
    // Hono decodifica %2F a "/" dentro del valor del param -- estos son
    // los valores reales que c.req.param("slug") devuelve para
    // GET /api/propiedades/..%2Fdata/galeria y
    // GET /api/propiedades/..%2f..%2fdata%2fsite/galeria, verificado
    // empíricamente contra el router antes de este fix.
    expect(parseSlugParam("../data")).toBeNull();
    expect(parseSlugParam("../../data/site")).toBeNull();
  });

  it("rechaza cualquier variante con punto, barra o mayúsculas", () => {
    for (const bad of ["..", "a/b", "a.b", "Apartamento-Moca", "", " "]) {
      expect(parseSlugParam(bad)).toBeNull();
    }
  });
});
