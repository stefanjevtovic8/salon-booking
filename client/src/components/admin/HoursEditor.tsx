import { useEffect, useState } from "react";
import { api, send } from "../../lib/api";
import { WEEKDAYS_SHORT, hm } from "../../lib/format";
import { btnP, inp, Msg, useStatus } from "./ui";

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Pon..Ned
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
type Row = { on: boolean; start: string; end: string; bs: string; be: string };
const blank = (): Row => ({ on: false, start: "09:00", end: "17:00", bs: "", be: "" });

export default function HoursEditor({ owner }: { owner: "salon" | number }) {
  const [rows, setRows] = useState<Row[]>(ORDER.map(() => blank()));
  const { err, ok, run } = useStatus();
  const set = (i: number, p: Partial<Row>) => setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...p } : r)));

  useEffect(() => {
    api<any[]>(`/admin/hours/${owner}`).then((d) => setRows(ORDER.map((wd) => {
      const h = d.find((x) => x.weekday === wd);
      return h ? { on: true, start: hm(h.startMin), end: hm(h.endMin), bs: h.breakStartMin != null ? hm(h.breakStartMin) : "", be: h.breakEndMin != null ? hm(h.breakEndMin) : "" } : blank();
    }))).catch(() => {});
  }, [owner]);

  const save = () => run(async () => {
    const body = ORDER.flatMap((wd, i) => {
      const r = rows[i];
      if (!r.on) return [];
      const brk = !!(r.bs && r.be);
      if (!r.start || !r.end || toMin(r.end) <= toMin(r.start) || (!!r.bs !== !!r.be) ||
          (brk && (toMin(r.bs) < toMin(r.start) || toMin(r.be) <= toMin(r.bs) || toMin(r.be) > toMin(r.end))))
        throw new Error(`Proverite radno vreme i pauzu za ${WEEKDAYS_SHORT[i]}.`);
      return [{ weekday: wd, startMin: toMin(r.start), endMin: toMin(r.end), breakStartMin: brk ? toMin(r.bs) : null, breakEndMin: brk ? toMin(r.be) : null }];
    });
    await api(`/admin/hours/${owner}`, send("PUT", body));
  });

  return (
    <div>
      <Msg err={err} ok={ok} />
      {ORDER.map((_, i) => { const r = rows[i]; return (
        <div key={i} className="py-2 border-b border-stone-100 last:border-0">
          <label className="flex items-center gap-3 h-9">
            <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={r.on} onChange={(e) => set(i, { on: e.target.checked })} />
            <b className="w-10">{WEEKDAYS_SHORT[i]}</b>{!r.on && <span className="text-stone-500 text-sm">ne radi</span>}
          </label>
          {r.on && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
              {([["Od", "start"], ["Do", "end"], ["Pauza od", "bs"], ["Pauza do", "be"]] as const).map(([l, k]) => (
                <label key={k} className="text-xs text-stone-500">{l}
                  <input type="time" className={inp} value={r[k]} onChange={(e) => set(i, { [k]: e.target.value })} /></label>
              ))}
            </div>
          )}
        </div>); })}
      <button className={btnP + " mt-3"} onClick={save}>Sačuvaj radno vreme</button>
    </div>
  );
}