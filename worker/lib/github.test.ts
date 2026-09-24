import { describe, expect, it } from "vitest";
import { base64ToUtf8 } from "./github";

describe("base64ToUtf8", () => {
  it("decodifica acentos y ñ correctamente (bug de mojibake corregido)", () => {
    const original = "2 baños — Localización, área social techada, trámites";
    const base64 = btoa(unescape(encodeURIComponent(original)));
    expect(base64ToUtf8(base64)).toBe(original);
  });

  it("no altera texto puro ASCII", () => {
    const original = "Casa de Campo en Venta, Jarabacoa";
    const base64 = btoa(unescape(encodeURIComponent(original)));
    expect(base64ToUtf8(base64)).toBe(original);
  });

  it("reproduce el bug si se usara atob() sin decodificar (regresión negativa)", () => {
    const original = "baños";
    const base64 = btoa(unescape(encodeURIComponent(original)));
    // atob() crudo debe producir mojibake -- confirma que el test anterior
    // realmente ejercita el fix y no un caso donde daría lo mismo.
    expect(atob(base64)).not.toBe(original);
    expect(base64ToUtf8(base64)).toBe(original);
  });
});
