import { useEffect, useRef, useState } from "react";
import { fileToBase64 } from "../lib/files";

export interface ImageUpload {
  ext: string;
  base64: string;
}

export function ImageUploadField({
  value,
  onChange,
  existingPreviewUrl,
  helpText,
}: {
  value: ImageUpload | null;
  onChange: (upload: ImageUpload | null) => void;
  /** URL a mostrar cuando se está editando y ya hay una imagen guardada. */
  existingPreviewUrl?: string | null;
  helpText?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      window.alert("Selecciona un archivo de imagen (jpg, png o webp)");
      return;
    }
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview(URL.createObjectURL(file));
    onChange(await fileToBase64(file));
  }

  function quitar() {
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const preview = localPreview ?? existingPreviewUrl ?? null;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt="Vista previa"
            className="w-full h-40 object-cover rounded-md border border-slate-200"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-sm text-panel-gold font-medium"
            >
              Reemplazar
            </button>
            {(value || localPreview) && (
              <button
                type="button"
                onClick={quitar}
                className="text-sm text-red-500 font-medium"
              >
                Quitar
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full h-32 rounded-md border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-panel-gold hover:text-panel-gold transition-colors"
        >
          <span className="text-2xl leading-none">+</span>
          <span className="text-sm font-medium">Subir imagen</span>
        </button>
      )}
      {helpText && <p className="text-xs text-slate-400 mt-2">{helpText}</p>}
    </div>
  );
}
