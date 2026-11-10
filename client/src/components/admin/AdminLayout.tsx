import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { api, send } from "../../lib/api";
import { useSalon } from "../../lib/hooks";

const links = [["/admin", "Pregled"], ["/admin/kalendar", "Kalendar"], ["/admin/klijenti", "Klijenti"], ["/admin/usluge", "Usluge"], ["/admin/frizeri", "Frizeri"], ["/admin/podesavanja", "Podešavanja"]];
export default function AdminLayout() {
  const nav = useNavigate();
  const [me, setMe] = useState<{ email: string } | null>(null);
  useSalon(); // postavlja akcentnu boju
  useEffect(() => { api<{ email: string }>("/admin/me").then(setMe).catch(() => nav("/admin/prijava", { replace: true })); }, []);
  if (!me) return <p className="p-6 text-center text-stone-500">Učitavanje…</p>;
  const out = async () => { await api("/admin/logout", send("POST")); nav("/admin/prijava"); };
  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-between h-12">
          <b>Admin</b><span className="text-sm text-stone-500">{me.email} · <button onClick={out} className="underline">Odjava</button></span>
        </div>
        <nav className="max-w-3xl mx-auto px-2 flex overflow-x-auto">
          {links.map(([to, l]) => (
            <NavLink key={to} to={to} end={to === "/admin"}
              className={({ isActive }) => `px-3 h-11 leading-[2.75rem] whitespace-nowrap text-sm ${isActive ? "border-b-2 border-accent font-semibold" : "text-stone-600"}`}>{l}</NavLink>
          ))}
        </nav>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-5"><Outlet /></main>
    </div>
  );
}