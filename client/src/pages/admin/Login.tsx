import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, send } from "../../lib/api";
import { btnP, Field, inp, Msg } from "../../components/admin/ui";

export default function AdminLogin() {
  const nav = useNavigate();
  const [f, setF] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try { await api("/admin/login", send("POST", f)); nav("/admin"); }
    catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }

  return (
    <main className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-5">Prijava</h1>
      
      {/* --- OVO JE DODATO: Prikazuje demo nalog samo ako je uključeno u podešavanjima --- */}
      {import.meta.env.VITE_DEMO && (
        <p className="mb-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
          Demo nalog: <b>demo@salon.rs</b> / <b>demo1234</b>
        </p>
      )}

      <Msg err={err} />
      <form onSubmit={submit}>
        <Field label="Email"><input className={inp} type="email" autoComplete="username" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Lozinka"><input className={inp} type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <button className={btnP + " w-full"} disabled={busy || !f.email || !f.password}>{busy ? "Prijava…" : "Prijavi se"}</button>
      </form>
    </main>
  );
}