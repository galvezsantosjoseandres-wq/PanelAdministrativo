import { Card, PageHeader } from "../components/ui";

export function CarruselInicio() {
  return (
    <div>
      <PageHeader title="Carrusel de Inicio" subtitle="Imágenes que se desplazan en el hero de la página principal" />
      <Card className="bg-amber-50 border-amber-200 text-amber-800 text-sm">
        Esta pantalla queda pendiente hasta que el repo Lefinor tenga un <code>data/hero.json</code>{" "}
        del que leer los slides -- hoy el carrusel es HTML fijo en el template
        (<code>templates/pages/index.html</code>). Es un prerrequisito de código en Lefinor,
        coordinado aparte, no un problema de este panel. Ver el plan de implementación para el
        detalle.
      </Card>
    </div>
  );
}
