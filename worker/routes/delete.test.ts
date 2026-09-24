import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context, Next } from "hono";

// Estos tests verifican, sin red real, que cada handler DELETE arma el
// deletePaths correcto antes de llamar a submitChange -- la prueba
// end-to-end contra el repo real de Lefinor (fuera de este archivo, ver
// PRs de prueba #48/#49 en Lefinor) ya demuestra que el mecanismo de git
// (squash-merge de un PR con deletePaths) funciona; lo que falta cubrir
// acá es que la lógica de la aplicación construya esos deletePaths bien
// para cada una de las 4 entidades.

const mockReadTextFile = vi.fn();
const mockListDir = vi.fn();

vi.mock("../lib/github", () => ({
  GitHubClient: vi.fn().mockImplementation(() => ({
    readTextFile: mockReadTextFile,
    listDir: mockListDir,
  })),
}));

const mockSubmitChange = vi.fn();
vi.mock("../lib/changes", () => ({
  submitChange: (...args: unknown[]) => mockSubmitChange(...args),
}));

vi.mock("../lib/auth", () => ({
  requireAuth: async (c: Context, next: Next) => {
    c.set("user", { email: "test@example.com", role: "propietario" });
    await next();
  },
  requireOwner: async (_c: Context, next: Next) => next(),
}));

const fakeEnv = {} as never;

beforeEach(() => {
  vi.clearAllMocks();
  mockSubmitChange.mockResolvedValue({ prNumber: 1, branch: "panel/test" });
});

describe("DELETE /propiedades/:slug", () => {
  it("incluye el JSON y todos los archivos de la carpeta de galería en deletePaths", async () => {
    const { properties } = await import("./properties");
    mockReadTextFile.mockResolvedValue(
      JSON.stringify({
        slug: "casa-prueba",
        titulo: "Casa de prueba",
        tipo_operacion: "venta",
        ciudad: "Moca",
      })
    );
    mockListDir.mockResolvedValue([
      { name: "1.jpg", sha: "a", type: "file" },
      { name: "2.jpg", sha: "b", type: "file" },
    ]);

    const res = await properties.request("/casa-prueba", { method: "DELETE" }, fakeEnv);

    expect(res.status).toBe(200);
    expect(mockSubmitChange).toHaveBeenCalledTimes(1);
    const input = mockSubmitChange.mock.calls[0][3];
    expect(input.actionType).toBe("delete");
    expect(input.entityType).toBe("propiedad");
    expect(input.entityId).toBe("casa-prueba");
    expect(input.deletePaths).toEqual([
      "data/propiedades/casa-prueba.json",
      "public/img/propiedades/casa-prueba/1.jpg",
      "public/img/propiedades/casa-prueba/2.jpg",
    ]);
  });

  it("una propiedad sin fotos de galería subidas no revienta -- deletePaths solo trae el JSON", async () => {
    const { properties } = await import("./properties");
    mockReadTextFile.mockResolvedValue(
      JSON.stringify({
        slug: "casa-sin-galeria",
        titulo: "Casa sin galería",
        tipo_operacion: "alquiler",
        ciudad: "La Vega",
      })
    );
    // listDir real devuelve [] (no lanza) cuando la carpeta no existe en
    // GitHub -- github.ts:42-45, isNotFound() -> []. Se replica ese
    // comportamiento acá, no un mock que lance.
    mockListDir.mockResolvedValue([]);

    const res = await properties.request("/casa-sin-galeria", { method: "DELETE" }, fakeEnv);

    expect(res.status).toBe(200);
    const input = mockSubmitChange.mock.calls[0][3];
    expect(input.deletePaths).toEqual(["data/propiedades/casa-sin-galeria.json"]);
  });
});

describe("DELETE /publicaciones/:slug", () => {
  it("incluye la imagen de portada cuando su ruta matchea el prefijo propio de la publicación", async () => {
    const { publications } = await import("./publications");
    mockReadTextFile.mockResolvedValue(
      JSON.stringify({
        slug: "articulo-prueba",
        categoria: "derecho-civil",
        titulo: "Artículo de prueba",
        fecha: "1 de enero, 2026",
        extracto: "Extracto",
        cuerpo: ["Párrafo"],
        imagen_portada: "/img/publicaciones/articulo-prueba.jpg",
        autor_id: "franklin-morillo",
      })
    );

    const res = await publications.request("/articulo-prueba", { method: "DELETE" }, fakeEnv);

    expect(res.status).toBe(200);
    const input = mockSubmitChange.mock.calls[0][3];
    expect(input.actionType).toBe("delete");
    expect(input.entityType).toBe("publicacion");
    expect(input.deletePaths).toEqual([
      "data/publicaciones/articulo-prueba.json",
      "public/img/publicaciones/articulo-prueba.jpg",
    ]);
  });

  it("NO borra la imagen si su ruta no matchea el prefijo propio (ej. imagen por defecto de la categoría) -- limitación conocida, documentada", async () => {
    const { publications } = await import("./publications");
    mockReadTextFile.mockResolvedValue(
      JSON.stringify({
        slug: "articulo-sin-portada-propia",
        categoria: "derecho-civil",
        titulo: "Artículo sin portada propia",
        fecha: "1 de enero, 2026",
        extracto: "Extracto",
        cuerpo: ["Párrafo"],
        imagen_portada: "/img/publicaciones/categorias/derecho-civil.jpg",
        autor_id: "franklin-morillo",
      })
    );

    await publications.request("/articulo-sin-portada-propia", { method: "DELETE" }, fakeEnv);

    const input = mockSubmitChange.mock.calls[0][3];
    expect(input.deletePaths).toEqual([
      "data/publicaciones/articulo-sin-portada-propia.json",
    ]);
  });
});

describe("DELETE /academy/:id", () => {
  it("incluye la imagen de portada cuando su ruta matchea el prefijo propio del curso", async () => {
    const { academy } = await import("./academy");
    mockReadTextFile.mockResolvedValue(
      JSON.stringify({
        id: "curso-prueba",
        titulo: "Curso de prueba",
        instructor_ids: ["franklin-morillo"],
        estado: "disponible",
        fecha: "1 de enero, 2026",
        fecha_iso: "2026-01-01",
        lugar: "Virtual",
        modalidad: "Virtual",
        imagen_portada: "/img/academy/cursos/curso-prueba/portada.jpg",
      })
    );

    const res = await academy.request("/curso-prueba", { method: "DELETE" }, fakeEnv);

    expect(res.status).toBe(200);
    const input = mockSubmitChange.mock.calls[0][3];
    expect(input.actionType).toBe("delete");
    expect(input.entityType).toBe("curso");
    expect(input.deletePaths).toEqual([
      "data/academy/curso-prueba.json",
      "public/img/academy/cursos/curso-prueba/portada.jpg",
    ]);
  });
});

describe("DELETE /profesionales/:slug", () => {
  it("incluye la foto cuando su ruta matchea el prefijo propio del profesional", async () => {
    const { professionals } = await import("./professionals");
    mockReadTextFile.mockResolvedValue(
      JSON.stringify({
        slug: "profesional-prueba",
        orden: 1,
        nombre: "Profesional de Prueba",
        cargo: "Abogado Asociado",
        unidad: "abogados",
        area: "Lefinor Abogados",
        foto: "/img/equipo/profesional-prueba.jpg",
        bioCompleta: "Bio",
        telefono: "809-000-0000",
        email: "prueba@lefinor.com",
      })
    );

    const res = await professionals.request("/profesional-prueba", { method: "DELETE" }, fakeEnv);

    expect(res.status).toBe(200);
    const input = mockSubmitChange.mock.calls[0][3];
    expect(input.actionType).toBe("delete");
    expect(input.entityType).toBe("profesional");
    expect(input.deletePaths).toEqual([
      "data/profesionales/profesional-prueba.json",
      "public/img/equipo/profesional-prueba.jpg",
    ]);
  });
});
