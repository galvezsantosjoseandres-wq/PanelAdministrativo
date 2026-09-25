import { describe, expect, it } from "vitest";
import { base64ToUtf8, extractPreviewUrlFromComments } from "./github";

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

describe("extractPreviewUrlFromComments", () => {
  it("extrae la URL del comentario del bot de Cloudflare Workers Builds", () => {
    const comments = [
      { user: { type: "User" }, body: "Un comentario cualquiera de un humano." },
      {
        user: { type: "Bot" },
        body:
          "## 🚀 Deploying Preview to Cloudflare 🚀\n" +
          "### Preview URL: https://claude-fix-x-lefinor.estarlingg01.workers.dev (commit abc1234)\n" +
          "###### This URL reflects your latest Preview deployment",
      },
    ];
    expect(extractPreviewUrlFromComments(comments)).toBe(
      "https://claude-fix-x-lefinor.estarlingg01.workers.dev"
    );
  });

  it("ignora comentarios de bots que no traen 'Preview URL:'", () => {
    const comments = [
      {
        user: { type: "Bot" },
        body: "## 🚀 Deploying Preview to Cloudflare 🚀\n### Build: In progress 🔵",
      },
    ];
    expect(extractPreviewUrlFromComments(comments)).toBeNull();
  });

  it("ignora comentarios de usuarios humanos aunque contengan texto parecido", () => {
    const comments = [
      { user: { type: "User" }, body: "Preview URL: https://no-deberia-contar.example.com" },
    ];
    expect(extractPreviewUrlFromComments(comments)).toBeNull();
  });

  it("devuelve null si no hay comentarios", () => {
    expect(extractPreviewUrlFromComments([])).toBeNull();
  });
});
