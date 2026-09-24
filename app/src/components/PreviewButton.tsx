import { useEffect, useState } from "react";
import { api, type PendingChange } from "../lib/api";
import { Button } from "./ui";

/**
 * Una entidad oculta no tiene página construida en dist/ (generator/build.js
 * filtra visible === false antes de generar HTML) -- la única vista previa
 * posible es la del PR abierto para esa entidad, si hay uno pendiente.
 * Reutiliza el mismo GET /:id/preview que ya usa Cambios Pendientes, no
 * crea ningún mecanismo de preview nuevo.
 */
export function PreviewButton({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: string;
}) {
  const [pending, setPending] = useState<PendingChange | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.cambiosPendientes().then((data) => {
      if (cancelled) return;
      const match = data.items.find(
        (p) => p.entity_type === entityType && p.entity_id === entityId
      );
      setPending(match ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId]);

  async function abrir() {
    if (!pending) return;
    setLoading(true);
    try {
      const { previewUrl } = await api.vistaPrevia(pending.id);
      if (previewUrl) window.open(previewUrl, "_blank", "noopener");
    } finally {
      setLoading(false);
    }
  }

  const disabled = !pending || loading;
  return (
    <Button
      variant="secondary"
      onClick={abrir}
      disabled={disabled}
      title={
        pending
          ? "Abrir la vista previa del cambio pendiente"
          : "No hay cambios pendientes que previsualizar -- edita y envía a revisión para generar una vista previa"
      }
    >
      {loading ? "Abriendo…" : "Vista previa"}
    </Button>
  );
}
