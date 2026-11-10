import { useEffect, useState } from "react";
import { api, send } from "../../lib/api";
import { dur, rsd } from "../../lib/format";
import { btnP, btnS, Card, Field, inp, Msg, useStatus } from "../../components/admin/ui";

type Svc = { id: number; categoryId: number; name: string; description: string; durationMin: number; priceRsd: number; stepMin: number; active: boolean };
type Cat = { id: number; name: string; services: Svc[] };
type Edit = Omit<Svc, "id"> & { id?: number };

export default function Services() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [defStep, setDefStep] = useState(30);
  const [e, setE] = useState<Edit | null>(null);
  const [newCat, setNewCat] = useState("");
  const { err, ok, run } = useStatus();

  const load = () => api<Cat[]>("/admin/categories").then(setCats).catch(() => {});
  useEffect(() => { load(); api<{ defaultStepMin: number }>("/admin/salon").then((s) => setDefStep(s.defaultStepMin)).catch(() => {}); }, []);
  const act = (fn: () => Promise<unknown>) => run(async () => { await fn(); await load(); });
  const empty = (categoryId: number): Edit => ({ categoryId, name: "", description: "", durationMin: 30, priceRsd: 0, stepMin: defStep, active: true });
  const save = async () => { if (await act(() => api(e!.id ? `/admin/services/${e!.id}` : "/admin/services", send(e!.id ? "PUT" : "POST", e)))) setE(null); };
  const num = (k: "durationMin" | "priceRsd" | "stepMin") => (x: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setE({ ...e!, [k]: +x.target.value });

  return (<>
    <h1 className="text-xl font-bold mb-4">Usluge i cenovnik</h1>
    <Msg err={err} ok={ok} />
    <Card title="Nova kategorija">
      <div className="flex gap-2">
        <input className={inp} placeholder="npr. Muško šišanje" value={newCat} onChange={(x) => setNewCat(x.target.value)} />
        <button className={btnP} disabled={!newCat.trim()} onClick={async () => { if (await act(() => api("/admin/categories", send("POST", { name: newCat.trim() })))) setNewCat(""); }}>Dodaj</button>
      </div>
    </Card>

    {e && (
      <Card title={e.id ? "Izmena usluge" : "Nova usluga"}>
        <Field label="Naziv"><input className={inp} value={e.name} onChange={(x) => setE({ ...e, name: x.target.value })} /></Field>
        <Field label="Opis"><input className={inp} value={e.description} onChange={(x) => setE({ ...e, description: x.target.value })} /></Field>
        <Field label="Kategorija">
<select className={inp} value={e.categoryId} onChange={(x) => setE({ ...e, categoryId: +x.target.value })}>            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Trajanje (min)"><input className={inp} type="number" inputMode="numeric" min={5} step={5} value={e.durationMin} onChange={num("durationMin")} /></Field>
          <Field label="Cena (RSD)"><input className={inp} type="number" inputMode="numeric" min={0} step={50} value={e.priceRsd} onChange={num("priceRsd")} /></Field>
          <Field label="Korak termina">
            <select className={inp} value={e.stepMin} onChange={num("stepMin")}><option value={15}>15 min</option><option value={30}>30 min</option><option value={60}>60 min</option></select>
          </Field>
        </div>
        <label className="flex items-center gap-3 mb-4"><input type="checkbox" className="size-5 accent-[var(--accent)]" checked={e.active} onChange={(x) => setE({ ...e, active: x.target.checked })} />Aktivna (vidljiva klijentima)</label>
        <div className="flex gap-2"><button className={btnP} disabled={!e.name.trim() || e.durationMin < 5} onClick={save}>Sačuvaj</button><button className={btnS} onClick={() => setE(null)}>Odustani</button></div>
      </Card>
    )}

    {cats.map((c) => (
      <Card key={c.id}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="font-semibold text-accent">{c.name}</h2>
          <div className="flex text-sm">
            <button className="underline px-2 h-9" onClick={() => setE(empty(c.id))}>+ usluga</button>
            <button className="underline px-2 h-9" onClick={() => { const n = prompt("Novi naziv kategorije", c.name); if (n?.trim()) act(() => api(`/admin/categories/${c.id}`, send("PUT", { name: n.trim() }))); }}>preimenuj</button>
            <button className="underline px-2 h-9 text-red-700" onClick={() => confirm(`Obrisati kategoriju "${c.name}"?`) && act(() => api(`/admin/categories/${c.id}`, send("DELETE")))}>obriši</button>
          </div>
        </div>
        <ul className="divide-y divide-stone-100">
          {c.services.length === 0 && <li className="text-sm text-stone-500 py-1">Nema usluga.</li>}
          {c.services.map((s) => (
            <li key={s.id} className="py-2 flex justify-between gap-2 items-center">
              <span className={s.active ? "" : "opacity-50"}>
                {s.name} {!s.active && <span className="text-xs bg-stone-200 rounded-full px-2 py-0.5">neaktivna</span>}
                <span className="block text-sm text-stone-500">{dur(s.durationMin)} · {rsd(s.priceRsd)} · korak {s.stepMin} min</span>
              </span>
              <span className="flex text-sm shrink-0">
                <button className="underline px-2 h-9" onClick={() => { setE(s); window.scrollTo(0, 0); }}>uredi</button>
                <button className="underline px-2 h-9 text-red-700" onClick={() => confirm(`Obrisati uslugu "${s.name}"?`) && act(() => api(`/admin/services/${s.id}`, send("DELETE")))}>obriši</button>
              </span>
            </li>))}
        </ul>
      </Card>))}
  </>);
}