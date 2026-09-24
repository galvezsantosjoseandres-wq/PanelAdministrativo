import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useMe } from "../lib/useMe";

const navItems = [
  { to: "/", label: "Inicio" },
  { to: "/propiedades", label: "Propiedades" },
  { to: "/publicaciones/nueva", label: "Publicaciones" },
  { to: "/academy/nuevo", label: "Academy" },
  { to: "/equipo/nuevo", label: "Equipo" },
  { to: "/carrusel-inicio", label: "Carrusel de Inicio" },
  { to: "/cambios-pendientes", label: "Cambios pendientes" },
  { to: "/historial", label: "Historial" },
  { to: "/ajustes", label: "Ajustes" },
];

export function Layout({ children }: { children: ReactNode }) {
  const { me } = useMe();

  return (
    <div className="flex min-h-screen font-sans">
      <aside className="w-64 shrink-0 bg-panel-navy text-slate-200 flex flex-col">
        <div className="px-6 py-6 border-b border-white/10">
          <div className="text-panel-gold font-bold tracking-wide">ACTIVOSWEB</div>
          <div className="text-xs text-slate-400 mt-1">Panel · Lefinor Capital Group</div>
        </div>
        <nav className="flex-1 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `block px-6 py-2.5 text-sm ${
                  isActive
                    ? "bg-panel-navyLight text-white border-l-2 border-panel-gold"
                    : "text-slate-300 hover:bg-panel-navyLight/60"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        {me && (
          <div className="px-6 py-4 border-t border-white/10 text-sm">
            <div className="font-medium">{me.email}</div>
            <div className="text-xs text-slate-400 capitalize">
              {me.role} · via Cloudflare Access
            </div>
          </div>
        )}
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
