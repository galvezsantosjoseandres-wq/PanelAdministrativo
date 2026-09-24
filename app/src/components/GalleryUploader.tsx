import { useEffect, useRef, useState } from "react";
import { extOf } from "../lib/files";
import { Button } from "./ui";

const PHOTO_EXTS = ["jpg", "jpeg", "png", "webp"];
const VIDEO_EXTS = ["mp4", "mov", "webm"];

function kindForExt(ext: string): "foto" | "video" | null {
  const e = ext.toLowerCase();
  if (PHOTO_EXTS.includes(e)) return "foto";
  if (VIDEO_EXTS.includes(e)) return "video";
  return null;
}

interface ExistingItem {
  position: number;
  ext: string;
  kind: "foto" | "video";
  name: string;
  blobSha: string;
  previewUrl: string | null;
}

interface GalleryRow {
  key: string; // clave estable para el render, no la posición (que cambia al reordenar)
  ext: string;
  kind: "foto" | "video";
  previewUrl: string | null;
  existingName?: string;
  existingBlobSha?: string;
  file?: File; // solo para ítems nuevos, no subidos todavía
}

let keySeq = 0;
function nextKey() {
  return `item-${++keySeq}`;
}

export function GalleryUploader({ slug, onSaved }: { slug: string; onSaved?: () => void }) {
  const [rows, setRows] = useState<GalleryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!slug) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/propiedades/${slug}/galeria`)
      .then((r) => r.json())
      .then((data: { items: ExistingItem[] }) => {
        setRows(
          data.items.map((it) => ({
            key: nextKey(),
            ext: it.ext,
            kind: it.kind,
            previewUrl: it.previewUrl,
            existingName: it.name,
            existingBlobSha: it.blobSha,
          }))
        );
      })
      .finally(() => setLoading(false));
  }, [slug]);

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const nuevos: GalleryRow[] = [];
    for (const file of Array.from(fileList)) {
      const ext = extOf(file);
      const kind = kindForExt(ext);
      if (!kind) {
        setError(`Extensión no soportada: .${ext} (${file.name})`);
        continue;
      }
      nuevos.push({
        key: nextKey(),
        ext,
        kind,
        previewUrl: URL.createObjectURL(file),
        file,
      });
    }
    setRows((r) => [...r, ...nuevos]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function mover(idx: number, dir: -1 | 1) {
    setRows((r) => {
      const next = [...r];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return r;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function quitar(idx: number) {
    setRows((r) => r.filter((_, i) => i !== idx));
  }

  async function guardar() {
    setError(null);
    setOk(null);

    if (rows.length === 0) {
      setError("La galería no puede quedar vacía");
      return;
    }
    if (rows[0].kind === "video") {
      setError("La primera imagen (portada) debe ser una foto, no un video");
      return;
    }

    setSaving(true);
    try {
      const order = rows.map((row) =>
        row.file
          ? { ext: row.ext, isNew: true }
          : { ext: row.ext, existingName: row.existingName, existingBlobSha: row.existingBlobSha }
      );
      const form = new FormData();
      form.set("order", JSON.stringify(order));
      rows.forEach((row, idx) => {
        if (row.file) form.set(`file-${idx}`, row.file);
      });

      const res = await fetch(`/api/propiedades/${slug}/galeria`, {
        method: "POST",
        body: form,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`);
      setOk(`Enviado a revisión (PR #${body.prNumber}).`);
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar la galería");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-400">Cargando galería…</p>;

  return (
    <div>
      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-xs px-3 py-2">
          {error}
        </div>
      )}
      {ok && (
        <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs px-3 py-2">
          {ok}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-3">
        {rows.map((row, idx) => (
          <div key={row.key} className="border border-slate-200 rounded-md overflow-hidden">
            <div className="relative aspect-video bg-slate-100">
              {row.kind === "foto" ? (
                row.previewUrl && (
                  <img src={row.previewUrl} alt="" className="w-full h-full object-cover" />
                )
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400 text-2xl">
                  ▶
                </div>
              )}
              <span className="absolute top-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                {idx === 0 ? "Portada" : `#${idx + 1}`}
              </span>
            </div>
            <div className="flex items-center justify-between px-2 py-1 text-xs">
              <div className="space-x-1">
                <button type="button" disabled={idx === 0} onClick={() => mover(idx, -1)} className="disabled:opacity-30">
                  ↑
                </button>
                <button type="button" disabled={idx === rows.length - 1} onClick={() => mover(idx, 1)} className="disabled:opacity-30">
                  ↓
                </button>
              </div>
              <button type="button" onClick={() => quitar(idx)} className="text-red-500">
                Quitar
              </button>
            </div>
          </div>
        ))}
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={() => inputRef.current?.click()}>
          + Agregar fotos/video
        </Button>
        <Button onClick={guardar} disabled={saving}>
          {saving ? "Guardando…" : "Guardar galería"}
        </Button>
      </div>
      <p className="text-xs text-slate-400 mt-2">
        La posición 1 es siempre la portada y debe ser una foto. El orden aquí es el orden en el sitio.
      </p>
    </div>
  );
}
