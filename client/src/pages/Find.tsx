import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { phoneOk } from "../lib/format";

const input = "w-full h-12 rounded-xl border border-stone-300 bg-white px-4 text-base";

export default function Find() {
  const nav = useNavigate();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = phoneOk(phone) && /^\d{6}$/.test(code);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const r = await api<{ manageToken: string }>("/lookup", { method: "POST", body: JSON.stringify({ phone, code }) });
      nav(`/termin/${r.manageToken}`);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen px-4 py-6 lg:py-16 max-w-lg mx-auto fade-up">
      <h1 className="text-2xl font-bold mb-1">Pronađi moj termin</h1>
      <p className="text-stone-600 mb-5">Unesite broj telefona i 6-cifreni kod iz potvrde.</p>
      {err && <p role="alert" className="mb-3 rounded-xl bg-red-50 text-red-700 border border-red-200 p-3 text-sm">{err}</p>}
      <form onSubmit={submit} className="space-y-4">
        <div><label htmlFor="p" className="block mb-1 font-medium">Broj telefona</label>
          <input id="p" className={input} type="tel" inputMode="tel" autoComplete="tel" placeholder="064 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <div><label htmlFor="c" className="block mb-1 font-medium">Kod termina</label>
          <input id="c" className={input} inputMode="numeric" maxLength={6} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></div>
        <button disabled={!ok || busy} className="w-full h-12 rounded-xl bg-accent text-white font-semibold disabled:opacity-40">{busy ? "Traženje…" : "Pronađi termin"}</button>
      </form>
      <Link to="/" className="block mt-6 text-center text-stone-500 underline">Nazad na početnu</Link>
    </main>
  );
}