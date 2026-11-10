import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { fmtDate, fmtTime, rsd } from "../../lib/format";
import { Card, Msg } from "../../components/admin/ui";

type A = { id: number; startsAt: string; status: string; customerName: string; customerPhone: string; stylistName: string; services: string; totalPriceRsd: number };
type D = { today: A[]; upcoming: A[]; weekCount: number; popular: { name: string; count: number }[] };

const Row = ({ a, date }: { a: A; date?: boolean }) => (
  <li className="py-2 flex gap-3">
    <b className="w-24 shrink-0">{date && <span className="block text-xs font-normal text-stone-500">{fmtDate(a.startsAt)}</span>}{fmtTime(a.startsAt)}</b>
    <span className="flex-1 text-sm">
      <b>{a.customerName}</b> · <a className="text-accent underline" href={`tel:${a.customerPhone}`}>{a.customerPhone}</a>
      {a.status !== "zakazan" && <span className="ml-1 text-xs bg-stone-200 rounded-full px-2 py-0.5">{a.status === "zavrsen" ? "završen" : "nije došao"}</span>}
      <span className="block text-stone-500">{a.stylistName} · {a.services} · {rsd(a.totalPriceRsd)}</span>
    </span>
  </li>
);

export default function Dashboard() {
  const [d, setD] = useState<D | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api<D>("/admin/dashboard").then(setD).catch((e) => setErr(e.message)); }, []);
  if (!d) return err ? <Msg err={err} /> : <p className="text-stone-500">Učitavanje…</p>;
  return (<>
    <div className="grid grid-cols-2 gap-3 mb-4">
      <div className="rounded-2xl bg-white border border-stone-200 p-4"><p className="text-3xl font-bold">{d.today.length}</p><p className="text-sm text-stone-500">termina danas</p></div>
      <div className="rounded-2xl bg-white border border-stone-200 p-4"><p className="text-3xl font-bold">{d.weekCount}</p><p className="text-sm text-stone-500">termina ove nedelje</p></div>
    </div>
    <Card title="Danas">
      {d.today.length ? <ul className="divide-y divide-stone-100">{d.today.map((a) => <Row key={a.id} a={a} />)}</ul> : <p className="text-sm text-stone-500">Nema termina danas.</p>}
    </Card>
    <Card title="Nadolazeći termini">
      {d.upcoming.length ? <ul className="divide-y divide-stone-100">{d.upcoming.map((a) => <Row key={a.id} a={a} date />)}</ul> : <p className="text-sm text-stone-500">Nema nadolazećih termina.</p>}
    </Card>
    <Card title="Najpopularnije usluge (30 dana)">
      {d.popular.length ? <ol className="text-sm space-y-1">{d.popular.map((p) => <li key={p.name} className="flex justify-between"><span>{p.name}</span><b>{p.count}×</b></li>)}</ol> : <p className="text-sm text-stone-500">Još nema podataka.</p>}
    </Card>
  </>);
}