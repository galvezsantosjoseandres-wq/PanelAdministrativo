import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Inicio } from "./pages/Inicio";
import { Propiedades } from "./pages/Propiedades";
import { PropiedadEditar } from "./pages/PropiedadEditar";
import { Publicaciones } from "./pages/Publicaciones";
import { PublicacionNueva } from "./pages/PublicacionNueva";
import { Academy } from "./pages/Academy";
import { AcademyNuevo } from "./pages/AcademyNuevo";
import { Equipo } from "./pages/Equipo";
import { ProfesionalNuevo } from "./pages/ProfesionalNuevo";
import { CambiosPendientes } from "./pages/CambiosPendientes";
import { Ajustes } from "./pages/Ajustes";
import { CarruselInicio } from "./pages/CarruselInicio";
import { Historial } from "./pages/Historial";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/propiedades" element={<Propiedades />} />
        <Route path="/propiedades/nueva" element={<PropiedadEditar />} />
        <Route path="/propiedades/:slug" element={<PropiedadEditar />} />
        <Route path="/publicaciones" element={<Publicaciones />} />
        <Route path="/publicaciones/nueva" element={<PublicacionNueva />} />
        <Route path="/publicaciones/:slug" element={<PublicacionNueva />} />
        <Route path="/academy" element={<Academy />} />
        <Route path="/academy/nuevo" element={<AcademyNuevo />} />
        <Route path="/academy/:id" element={<AcademyNuevo />} />
        <Route path="/equipo" element={<Equipo />} />
        <Route path="/equipo/nuevo" element={<ProfesionalNuevo />} />
        <Route path="/equipo/:slug" element={<ProfesionalNuevo />} />
        <Route path="/carrusel-inicio" element={<CarruselInicio />} />
        <Route path="/cambios-pendientes" element={<CambiosPendientes />} />
        <Route path="/historial" element={<Historial />} />
        <Route path="/ajustes" element={<Ajustes />} />
      </Routes>
    </Layout>
  );
}
