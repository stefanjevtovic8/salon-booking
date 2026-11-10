import { useState } from "react";
import { MONTHS, WEEKDAYS_SHORT } from "../lib/format";

type P = { value: string; onPick: (d: string) => void; today: string; max: string; weekdays: number[]; holidays: string[] };

export default function Calendar({ value, onPick, today, max, weekdays, holidays }: P) {
  const [y0, m0] = today.split("-").map(Number);
  const [ym, setYm] = useState({ y: y0, m: m0 - 1 });
  const lead = (new Date(Date.UTC(ym.y, ym.m, 1)).getUTCDay() + 6) % 7;
  const n = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: n }, (_, i) => i + 1)];
  const ymd = (d: number) => `${ym.y}-${String(ym.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const off = (d: number) => {
    const s = ymd(d);
    return s < today || s > max || holidays.includes(s) || !weekdays.includes(new Date(Date.UTC(ym.y, ym.m, d)).getUTCDay());
  };
  const move = (k: number) => { const d = new Date(Date.UTC(ym.y, ym.m + k, 1)); setYm({ y: d.getUTCFullYear(), m: d.getUTCMonth() }); };
  const prevOff = ym.y === y0 && ym.m === m0 - 1;
  const nextOff = new Date(Date.UTC(ym.y, ym.m + 1, 1)).toISOString().slice(0, 10) > max;

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <button aria-label="Prethodni mesec" disabled={prevOff} onClick={() => move(-1)} className="size-11 text-xl disabled:opacity-20">‹</button>
        <b>{MONTHS[ym.m]} {ym.y}.</b>
        <button aria-label="Sledeći mesec" disabled={nextOff} onClick={() => move(1)} className="size-11 text-xl disabled:opacity-20">›</button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs text-stone-500 mb-1">{WEEKDAYS_SHORT.map((w) => <span key={w}>{w}</span>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => d === null ? <span key={i} /> : (
          <button key={i} disabled={off(d)} onClick={() => onPick(ymd(d))} aria-pressed={value === ymd(d)}
            className={`h-11 rounded-lg text-sm ${value === ymd(d) ? "bg-accent text-white font-bold" : "hover:bg-stone-100"} disabled:text-stone-300 disabled:hover:bg-transparent`}>
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}