import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type ManageData, type Slot, type WorkingDays } from "../lib/api";
import { addDays, dur, fmtDate, fmtTime, rsd, todayYmd, ymdLong } from "../lib/format";
import { downloadIcs } from "../lib/ics";
import Calendar from "../components/Calendar";
import { Skeleton } from "../components/Skeleton";

const STATUS: Record<string, string> = { zakazan: "Zakazan", otkazan: "Otkazan", zavrsen: "Završen", nije_dosao: "Nije se pojavio" };
const btn = "w-full h-12 rounded-xl font-semibold disabled:opacity-40";

export default function Manage() {
  const { token } = useParams();
  const [d, setD] = useState<ManageData | null>(null);
  const [wd, setWd] = useState<WorkingDays | null>(null);
  const [move, setMove] = useState(false);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const today = todayYmd();

  const load = () => api<ManageData>(`/manage/${token}`).then(setD).catch((e) => setErr(e.message));
  useEffect(() => { load(); api<WorkingDays>("/working-days").then(setWd).catch(() => {}); }, [token]);
  useEffect(() => {
    if (!move || !date) return;
    setSlots(null); setSlot(null);
    api<Slot[]>(`/manage/${token}/availability?date=${date}`).then(setSlots).catch((e) => { setErr(e.message); setSlots([]); });
  }, [move, date]);

  async function act(path: string, body: object, ok: string) {
    setBusy(true); setErr(""); setMsg("");
    try {
      await api(`/manage/${token}/${path}`, { method: "POST", body: JSON.stringify(body) });
      setMsg(ok); setMove(false); setDate(""); setSlot(null); await load();
    } catch (e: any) { setErr(e.message); if (/slobodan/.test(e.message)) { setDate(""); setSlot(null); } }
    finally { setBusy(false); }
  }

  if (!d) return (
    <main className="max-w-lg mx-auto px-4 py-10 text-center fade-up">
      {err ? <><p role="alert" className="text-red-700">{err}</p><Link to="/nadji" className="block mt-4 underline">Pronađi moj termin</Link></>
           : <p className="text-stone-500">Učitavanje…</p>}
    </main>
  );

  const active = d.status === "zakazan";
  return (
    <main className="min-h-screen px-4 py-6 lg:py-16 max-w-lg mx-auto fade-up">
      <h1 className="text-2xl font-bold mb-4">Vaš termin</h1>
      {msg && <p role="status" className="mb-3 rounded-xl bg-green-50 text-green-800 border border-green-200 p-3 text-sm">{msg}</p>}
      {err && <p role="alert" className="mb-3 rounded-xl bg-red-50 text-red-700 border border-red-200 p-3 text-sm">{err}</p>}

      <div className="rounded-2xl bg-white border border-stone-200 p-4 space-y-1">
        <p className={`inline-block text-sm px-2 py-0.5 rounded-full ${active ? "bg-green-100 text-green-800" : "bg-stone-200 text-stone-700"}`}>{STATUS[d.status] ?? d.status}</p>
        <p className="text-lg pt-1"><b>{fmtDate(d.startsAt)}</b> u <b>{fmtTime(d.startsAt)}</b></p>
        <p>Frizer: {d.stylistName}</p>
        <p className="text-stone-500 text-sm">{d.salonName} · {d.salonAddress}</p>
        <ul className="pt-2 text-sm divide-y divide-stone-100">
          {d.items.map((i, k) => <li key={k} className="flex justify-between py-1"><span>{i.name} <span className="text-stone-500">({dur(i.durationMin)})</span></span><span>{rsd(i.priceRsd)}</span></li>)}
        </ul>
        <p className="flex justify-between pt-2 font-bold"><span>Ukupno · {dur(d.totalDurationMin)}</span><span>{rsd(d.totalPriceRsd)}</span></p>
      </div>

      {active && !move && (
        <div className="mt-4 space-y-2">
          <button className={`${btn} border border-stone-300 bg-white`}
            onClick={() => downloadIcs({ start: d.startsAt, end: d.endsAt, title: `${d.salonName} – termin`, location: d.salonAddress })}>Dodaj u kalendar</button>
          {d.canChange ? (<>
            <button className={`${btn} bg-accent text-white`} onClick={() => { setMove(true); setErr(""); setMsg(""); }}>Pomeri termin</button>
            <button disabled={busy} className={`${btn} border border-red-300 text-red-700 bg-white`}
              onClick={() => confirm("Da li sigurno želite da otkažete termin?") && act("cancel", {}, "Termin je otkazan.")}>Otkaži termin</button>
            <p className="text-sm text-stone-500 text-center">Izmene su moguće najkasnije {d.cancelHours} h pre početka.</p>
          </>) : (
            <p className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm">
              Termin se više ne može otkazati ni pomeriti online (rok je {d.cancelHours} h pre početka). Pozovite salon: <a className="underline font-medium" href={`tel:${d.salonPhone}`}>{d.salonPhone}</a>
            </p>
          )}
        </div>
      )}

      {move && (
        <section className="mt-4 space-y-3">
          <h2 className="font-semibold">Izaberite novi termin</h2>
          {wd ? <Calendar value={date} onPick={setDate} today={today} max={addDays(today, d.maxAdvanceDays)} weekdays={wd.hours.map((h) => h.weekday)} holidays={wd.holidays} /> : <p className="text-stone-500">Učitavanje…</p>}
          {date && (<>
            <h3 className="font-medium">{ymdLong(date)}</h3>
            {slots === null ? <Skeleton h="h-12" n={2} /> : slots.length === 0 ? <p className="text-stone-500">Nema slobodnih termina za izabrani dan.</p> : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((s) => <button key={s.start} onClick={() => setSlot(s)} aria-pressed={slot?.start === s.start}
                  className={`h-12 rounded-xl border font-medium ${slot?.start === s.start ? "bg-accent text-white border-accent" : "bg-white border-stone-200"}`}>{s.label}</button>)}
              </div>
            )}
          </>)}
          <button disabled={!slot || busy} className={`${btn} bg-accent text-white`} onClick={() => act("reschedule", { start: slot!.start }, "Termin je pomeren.")}>{busy ? "Čuvanje…" : "Potvrdi novi termin"}</button>
          <button className={`${btn} bg-white border border-stone-300`} onClick={() => setMove(false)}>Odustani</button>
        </section>
      )}
      <Link to="/" className="block mt-8 text-center text-stone-500 underline">Nazad na početnu</Link>
    </main>
  );
}