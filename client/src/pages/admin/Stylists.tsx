import { useEffect, useState } from "react";
import { api, send } from "../../lib/api";
import { rsd } from "../../lib/format";
import { btnP, Card, Field, inp, Msg, useStatus } from "../../components/admin/ui";
import HoursEditor from "../../components/admin/HoursEditor";
import TimeOffEditor from "../../components/admin/TimeOffEditor";
import ImageField from "../../components/admin/ImageField";
type St = { id: number; name: string; bio: string; photoUrl: string | null; active: boolean; services: { serviceId: number; priceRsd: number | null }[] };
type Cat = { id: number; name: string; services: { id: number; name: string; priceRsd: number; active: boolean }[] };

export default function Stylists() {
  const [list, setList] = useState<St[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const { err, run } = useStatus();
  const load = () => api<St[]>("/admin/stylists").then(setList).catch(() => {});
  useEffect(() => { load(); }, []);
  const add = () => {
    const name = prompt("Ime frizera");
    if (name?.trim()) run(async () => {
      const s = await api<St>("/admin/stylists", send("POST", { name: name.trim(), bio: "", photoUrl: null, active: true }));
      await load(); setOpen(s.id);
    }, "Frizer je dodat. Podesite usluge i radno vreme.");
  };
  return (<>
    <div className="flex justify-between items-center mb-4"><h1 className="text-xl font-bold">Frizeri</h1><button className={btnP} onClick={add}>+ Frizer</button></div>
    <Msg err={err} />
    {list.map((s) => (
      <Card key={s.id}>
        <button className="w-full flex justify-between items-center text-left h-9" onClick={() => setOpen(open === s.id ? null : s.id)}>
          <span className="font-semibold">{s.name} {!s.active && <span className="text-xs bg-stone-200 rounded-full px-2 py-0.5 ml-1 font-normal">neaktivan</span>}</span>
          <span>{open === s.id ? "▲" : "▼"}</span>
        </button>
        {open === s.id && <Editor s={s} reload={load} close={() => setOpen(null)} />}
      </Card>))}
  </>);
}

function Editor({ s, reload, close }: { s: St; reload: () => Promise<unknown>; close: () => void }) {
  const [b, setB] = useState({ name: s.name, bio: s.bio, photoUrl: s.photoUrl ?? "", active: s.active });
  const [cats, setCats] = useState<Cat[]>([]);
  const [sel, setSel] = useState<Record<number, string>>(Object.fromEntries(s.services.map((x) => [x.serviceId, x.priceRsd == null ? "" : String(x.priceRsd)])));
  const basic = useStatus(), sv = useStatus();
  useEffect(() => { api<Cat[]>("/admin/categories").then(setCats).catch(() => {}); }, []);

  const toggle = (id: number) => setSel((p) => { const n = { ...p }; if (id in n) delete n[id]; else n[id] = ""; return n; });
  const h2 = "font-semibold mt-6 mb-2 pt-4 border-t border-stone-200";

  return (
    <div className="mt-4">
      <Msg err={basic.err} ok={basic.ok} />
      <Field label="Ime"><input className={inp} value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} /></Field>
      <Field label="Kratak opis / specijalnost"><input className={inp} value={b.bio} onChange={(e) => setB({ ...b, bio: e.target.value })} /></Field>
      <ImageField label="Fotografija" value={b.photoUrl} onChange={(u) => setB({ ...b, photoUrl: u })} />
      <label className="flex items-center gap-3 mb-4"><input type="checkbox" className="size-5 accent-[var(--accent)]" checked={b.active} onChange={(e) => setB({ ...b, active: e.target.checked })} />Aktivan (prima zakazivanja)</label>
      <div className="flex gap-3">
        <button className={btnP} disabled={!b.name.trim()} onClick={() => basic.run(async () => { await api(`/admin/stylists/${s.id}`, send("PUT", b)); await reload(); })}>Sačuvaj</button>
        <button className="underline text-red-700" onClick={() => confirm(`Obrisati frizera "${s.name}"?`) && basic.run(async () => { await api(`/admin/stylists/${s.id}`, send("DELETE")); await reload(); close(); })}>Obriši frizera</button>
      </div>

      <h3 className={h2}>Usluge koje radi</h3>
      <Msg err={sv.err} ok={sv.ok} />
      {cats.map((c) => (
        <div key={c.id} className="mb-3">
          <p className="text-sm text-accent font-medium mb-1">{c.name}</p>
          {c.services.map((x) => (
            <div key={x.id} className="flex items-center gap-3 py-1">
              <label className="flex items-center gap-3 flex-1 min-h-9">
                <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={x.id in sel} onChange={() => toggle(x.id)} />
                <span className={x.active ? "" : "opacity-50"}>{x.name} <span className="text-stone-500 text-sm">({rsd(x.priceRsd)})</span></span>
              </label>
              {x.id in sel && <input className={inp + " !w-32"} type="number" inputMode="numeric" min={0} placeholder="druga cena" value={sel[x.id]} onChange={(e) => setSel({ ...sel, [x.id]: e.target.value })} />}
            </div>))}
        </div>))}
      <button className={btnP} onClick={() => sv.run(async () => {
        await api(`/admin/stylists/${s.id}/services`, send("PUT", Object.entries(sel).map(([id, p]) => ({ serviceId: +id, priceRsd: p === "" ? null : +p }))));
        await reload();
      })}>Sačuvaj usluge</button>
      <p className="text-xs text-stone-500 mt-1">Polje „druga cena" ostavite praznim da važi osnovna cena.</p>

      <h3 className={h2}>Radno vreme</h3>
      <HoursEditor owner={s.id} />
      <h3 className={h2}>Odsustva (godišnji, bolovanje…)</h3>
      <TimeOffEditor stylistId={s.id} />
    </div>
  );
}