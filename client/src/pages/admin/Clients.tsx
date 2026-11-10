import { useEffect, useState } from "react";
import { api, send } from "../../lib/api";
import { fmtDate, fmtTime, rsd } from "../../lib/format";
import { btnP, Card, Field, inp, Msg, useStatus } from "../../components/admin/ui";

type C = { id: number; name: string; phone: string; email: string | null; note: string; total: number; done: number; noShows: number; last: string | null };
type Det = { id: number; name: string; phone: string; email: string; note: string; appointments: { id: number; startsAt: string; status: string; stylistName: string; totalPriceRsd: number; services: string }[] };
const ST: Record<string, string> = { zakazan: "zakazan", otkazan: "otkazan", zavrsen: "završen", nije_dosao: "nije došao" };

export default function Clients() {
  const [q, setQ] = useState("");
  const [list, setList] = useState<C[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const load = () => api<C[]>(`/admin/customers?q=${encodeURIComponent(q)}`).then(setList).catch(() => setList([]));
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q]);
  return (<>
    <h1 className="text-xl font-bold mb-4">Klijenti</h1>
    <input className={inp + " mb-4"} type="search" placeholder="Pretraga po imenu ili telefonu" value={q} onChange={(e) => setQ(e.target.value)} />
    {list === null ? <p className="text-stone-500">Učitavanje…</p> : list.length === 0 ? <p className="text-stone-500">Nema rezultata.</p> : list.map((c) => (
      <Card key={c.id}>
        <button className="w-full text-left" onClick={() => setOpen(open === c.id ? null : c.id)}>
          <b>{c.name}</b> <span className="text-stone-500 text-sm">· {c.phone}</span>
          <span className="block text-sm text-stone-500">{c.total} termina · {c.done} završeno{c.noShows ? ` · ${c.noShows}× nije došao` : ""}{c.last ? ` · poslednji ${fmtDate(c.last)}` : ""}</span>
          {c.note && <span className="block text-sm mt-1">📝 {c.note}</span>}
        </button>
        {open === c.id && <Detail id={c.id} reload={load} />}
      </Card>))}
    <p className="text-xs text-stone-500">Prikazano najviše 50 rezultata. Pretraga imena razlikuje velika i mala slova kod slova sa kvačicama (š, č, ž).</p>
  </>);
}

function Detail({ id, reload }: { id: number; reload: () => unknown }) {
  const [d, setD] = useState<Det | null>(null);
  const { err, ok, run } = useStatus();
  useEffect(() => { api<Det>(`/admin/customers/${id}`).then(setD).catch(() => {}); }, [id]);
  if (!d) return <p className="mt-3 text-stone-500">Učitavanje…</p>;
  return (
    <div className="mt-4 pt-4 border-t border-stone-200">
      <Msg err={err} ok={ok} />
      <Field label="Ime i prezime"><input className={inp} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></Field>
      <Field label="Email"><input className={inp} type="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} /></Field>
      <Field label="Beleška (npr. alergije, omiljena frizura)"><textarea className={inp + " h-24 py-2"} value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} /></Field>
      <button className={btnP} onClick={() => run(async () => { await api(`/admin/customers/${id}`, send("PUT", { name: d.name, email: d.email, note: d.note })); reload(); })}>Sačuvaj</button>
      <h3 className="font-semibold mt-5 mb-1">Istorija termina</h3>
      <ul className="divide-y divide-stone-100 text-sm">
        {d.appointments.map((a) => (
          <li key={a.id} className="py-2"><b>{fmtDate(a.startsAt)} {fmtTime(a.startsAt)}</b> · {ST[a.status]}
            <span className="block text-stone-500">{a.stylistName} · {a.services} · {rsd(a.totalPriceRsd)}</span></li>))}
      </ul>
    </div>
  );
}