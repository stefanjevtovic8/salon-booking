import { useEffect, useState } from "react";
import { api, send } from "../../lib/api";
import { fmtDate, fmtTime, todayYmd } from "../../lib/format";
import { btnP, inp, Msg, useStatus } from "./ui";

type T = { id: number; startsAt: string; endsAt: string; reason: string };

export default function TimeOffEditor({ stylistId }: { stylistId: number | null }) {
  const t = todayYmd();
  const [list, setList] = useState<T[]>([]);
  const [f, setF] = useState({ from: t, to: t, fromTime: "00:00", toTime: "23:59", reason: "" });
  const [warn, setWarn] = useState("");
  const { err, ok, run } = useStatus();
  const load = () => api<T[]>(`/admin/timeoff${stylistId ? `?stylistId=${stylistId}` : ""}`).then(setList).catch(() => {});
  useEffect(() => { load(); }, [stylistId]);

  const add = () => run(async () => {
    const r = await api<{ conflicts: number }>("/admin/timeoff", send("POST", { stylistId, ...f }));
    setWarn(r.conflicts ? `Pažnja: ${r.conflicts} već zakazanih termina se preklapa sa ovim odsustvom. Otkažite ih ili pomerite ručno.` : "");
    await load();
  }, "Odsustvo je dodato");
  const del = (id: number) => run(async () => { await api(`/admin/timeoff/${id}`, send("DELETE")); await load(); }, "Obrisano");

  return (
    <div>
      <Msg err={err} ok={ok} />
      {warn && <p className="mb-3 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm">{warn}</p>}
      <ul className="mb-3 divide-y divide-stone-100">
        {list.length === 0 && <li className="text-sm text-stone-500 py-1">Nema planiranih odsustava.</li>}
        {list.map((x) => (
          <li key={x.id} className="py-2 flex justify-between gap-2 items-center text-sm">
            <span>{fmtDate(x.startsAt)} {fmtTime(x.startsAt)} – {fmtDate(x.endsAt)} {fmtTime(x.endsAt)}{x.reason && <span className="text-stone-500"> · {x.reason}</span>}</span>
            <button className="underline text-red-700 h-9" onClick={() => del(x.id)}>obriši</button>
          </li>))}
      </ul>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-stone-500">Od datuma<input type="date" className={inp} value={f.from} min={t} onChange={(e) => setF({ ...f, from: e.target.value, to: e.target.value > f.to ? e.target.value : f.to })} /></label>
        <label className="text-xs text-stone-500">Do datuma<input type="date" className={inp} value={f.to} min={f.from} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
        <label className="text-xs text-stone-500">Od vremena<input type="time" className={inp} value={f.fromTime} onChange={(e) => setF({ ...f, fromTime: e.target.value })} /></label>
        <label className="text-xs text-stone-500">Do vremena<input type="time" className={inp} value={f.toTime} onChange={(e) => setF({ ...f, toTime: e.target.value })} /></label>
      </div>
      <input className={inp + " mt-2"} placeholder="Razlog (npr. godišnji odmor)" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
      <button className={btnP + " mt-3"} onClick={add}>Dodaj odsustvo</button>
    </div>
  );
}