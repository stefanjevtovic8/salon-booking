import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Category, type Slot, type Stylist, type WorkingDays } from "../lib/api";
import { useSalon } from "../lib/hooks";
import { addDays, dur, fmtDate, fmtTime, phoneOk, rsd, todayYmd, ymdLong } from "../lib/format";
import { downloadIcs } from "../lib/ics";
import Calendar from "../components/Calendar";
import { Skeleton } from "../components/Skeleton";

const STEPS = ["Usluge", "Frizer", "Termin", "Podaci", "Potvrda"];
const input = "w-full h-12 rounded-xl border border-stone-300 bg-white px-4 text-base";

export default function Book() {
  const salon = useSalon();
  const [step, setStep] = useState(0);
  const [cats, setCats] = useState<Category[]>([]);
  const [wd, setWd] = useState<WorkingDays | null>(null);
  const [sel, setSel] = useState<number[]>([]);
  const [stylists, setStylists] = useState<Stylist[] | null>(null);
  const [stylistId, setStylistId] = useState<number | null>(null); // 0 = bilo koji
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [f, setF] = useState({ name: "", phone: "", email: "", note: "", website: "", consent: false });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<any>(null);

  const chosen = useMemo(() => cats.flatMap((c) => c.services).filter((s) => sel.includes(s.id)), [cats, sel]);
  const total = chosen.reduce((a, s) => a + s.priceRsd, 0);
  const minutes = chosen.reduce((a, s) => a + s.durationMin, 0);
  const ids = sel.join(",");
  const today = todayYmd();

  useEffect(() => {
    api<Category[]>("/services").then(setCats).catch((e) => setErr(e.message));
    api<WorkingDays>("/working-days").then(setWd).catch(() => {});
  }, []);

  useEffect(() => {
    if (step !== 1) return;
    setStylists(null);
    api<Stylist[]>(`/stylists?serviceIds=${ids}`).then(setStylists).catch((e) => setErr(e.message));
  }, [step]);

  useEffect(() => {
    if (step !== 2 || !date) return;
    setSlots(null); setSlot(null);
    api<Slot[]>(`/availability?serviceIds=${ids}&date=${date}${stylistId ? `&stylistId=${stylistId}` : ""}`)
      .then(setSlots).catch((e) => { setErr(e.message); setSlots([]); });
  }, [step, date]);

  const go = (n: number) => { setErr(""); setStep(n); window.scrollTo(0, 0); };
  const toggle = (id: number) => {
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    setStylistId(null); setDate(""); setSlot(null);
  };
  const formOk = f.name.trim().length >= 2 && phoneOk(f.phone) && (!f.email || /^\S+@\S+\.\S+$/.test(f.email)) && f.consent;
  const can = [sel.length > 0, stylistId !== null, !!slot, formOk, true][step];

  async function submit() {
    if (f.website) { setDone({ fake: true, startsAt: slot!.start, endsAt: slot!.start, stylistName: "", shortCode: "", manageToken: "" }); return; } // honeypot
    setBusy(true); setErr("");
    try {
      setDone(await api("/appointments", { method: "POST", body: JSON.stringify({
        serviceIds: sel, stylistId: stylistId || undefined, start: slot!.start, name: f.name.trim(),
        phone: f.phone, email: f.email || undefined, note: f.note || undefined, website: f.website, consent: true }) }));
    } catch (e: any) {
      setErr(e.message);
      if (/slobodan/.test(e.message)) setStep(2); // termin zauzet -> nazad na izbor termina
    } finally { setBusy(false); }
  }

  if (done) return (
    <main className="max-w-lg mx-auto px-4 py-10 text-center">
      <div className="mx-auto size-16 rounded-full bg-green-100 text-green-700 text-3xl leading-[4rem]">✓</div>
      <h1 className="font-display text-3xl font-semibold mt-4">Termin je zakazan!</h1>
      <div className="mt-6 rounded-2xl bg-white border border-stone-200 p-4 text-left space-y-1">
        <p><b>{fmtDate(done.startsAt)}</b> u <b>{fmtTime(done.startsAt)}</b></p>
        {done.stylistName && <p>Frizer: {done.stylistName}</p>}
        <p>{chosen.map((s) => s.name).join(", ")}</p>
        <p>Ukupno: <b>{rsd(total)}</b> · {dur(minutes)}</p>
        {done.shortCode && <p className="pt-2 text-sm text-stone-500">Vaš kod za termin: <b className="text-stone-900 text-base tracking-widest">{done.shortCode}</b></p>}
      </div>
      <button className="w-full h-12 rounded-xl bg-accent text-white font-semibold mt-5"
        onClick={() => downloadIcs({ start: done.startsAt, end: done.endsAt, title: `${salon?.name ?? "Frizer"} – termin`, location: salon?.address ?? "" })}>
        Dodaj u kalendar
      </button>
      {done.manageToken && <Link to={`/termin/${done.manageToken}`} className="block mt-3 h-12 leading-[3rem] rounded-xl border border-stone-300 bg-white font-medium">Pregled / otkazivanje termina</Link>}
      <Link to="/" className="block mt-4 text-stone-500 underline">Nazad na početnu</Link>
    </main>
  );

  return (
    <main className="min-h-screen px-4 pb-28 pt-4 lg:py-16 max-w-lg lg:max-w-5xl mx-auto fade-up">
      <header className="pt-4 lg:pt-8 pb-3 sticky top-0 bg-[#faf7f4] z-10">
        <div className="flex items-center gap-2 lg:max-w-2xl">
          {step > 0 ? <button aria-label="Nazad" onClick={() => go(step - 1)} className="size-11 text-2xl">‹</button>
                    : <Link aria-label="Početna" to="/" className="size-11 text-2xl text-center leading-[2.75rem]">‹</Link>}
          <div className="flex-1">
            <p className="text-sm text-stone-500">Korak {step + 1} od 5 · {STEPS[step]}</p>
            <div className="flex gap-1 mt-1" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={5}>
              {STEPS.map((_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-stone-200"}`} />)}
            </div>
          </div>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-12 lg:items-start">
        <div>
          {err && <p role="alert" className="mb-3 rounded-xl bg-red-50 text-red-700 border border-red-200 p-3 text-sm">{err}</p>}
          
          {/* Animacija prelaza između koraka */}
          <div key={step} className="fade-up">
            {step === 0 && (cats.length === 0 ? <Skeleton/> : cats.map((c) => (
              <section key={c.id} className="mb-6">
                <h2 className="font-semibold text-lg mb-2 font-display">{c.name}</h2>
                <div className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3">
                  {c.services.map((s) => { const on = sel.includes(s.id); return (
                    <button key={s.id} onClick={() => toggle(s.id)} aria-pressed={on}
                      className={`w-full text-left rounded-xl border p-4 flex gap-3 ${on ? "border-accent bg-accent/10" : "border-stone-200 bg-white"}`}>
                      <span className={`mt-0.5 size-6 shrink-0 rounded-full border grid place-items-center text-white text-sm ${on ? "bg-accent border-accent" : "border-stone-300"}`}>{on && "✓"}</span>
                      <span className="flex-1">
                        <span className="block font-medium">{s.name}</span>
                        {s.description && <span className="block text-sm text-stone-500">{s.description}</span>}
                        <span className="block text-sm text-stone-500 mt-1">{dur(s.durationMin)}</span>
                      </span>
                      <b className="whitespace-nowrap">{rsd(s.priceRsd)}</b>
                    </button>); })}
                </div>
              </section>
            )))}

            {step === 1 && (stylists === null ? <Skeleton h="h-20"/> : stylists.length === 0 ? (
              <p>Nijedan frizer ne radi sve izabrane usluge zajedno. Vratite se i izaberite manje usluga.</p>
            ) : (
              <div className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3">
                {[{ id: 0, name: "Bilo koji slobodan frizer", bio: "Najbrži termin", photoUrl: null }, ...stylists].map((s) => (
                  <button key={s.id} onClick={() => { setStylistId(s.id); setDate(""); setSlot(null); }} aria-pressed={stylistId === s.id}
                    className={`w-full text-left rounded-xl border p-3 flex items-center gap-3 ${stylistId === s.id ? "border-accent bg-accent/10" : "border-stone-200 bg-white"}`}>
                    {s.photoUrl ? <img src={s.photoUrl} alt="" className="size-14 rounded-full object-cover" />
                      : <span className="size-14 rounded-full bg-stone-200 grid place-items-center text-xl">{s.id ? s.name[0] : "★"}</span>}
                    <span><b className="block">{s.name}</b><span className="text-sm text-stone-500">{s.bio}</span></span>
                  </button>
                ))}
              </div>
            ))}

            {step === 2 && (
              <div className="lg:grid lg:grid-cols-[360px_1fr] lg:gap-8 lg:items-start">
                <div>
                  {wd && salon ? <Calendar value={date} onPick={setDate} today={today} max={addDays(today, salon.maxAdvanceDays)}
                    weekdays={wd.hours.map((h) => h.weekday)} holidays={wd.holidays} /> : <p className="text-stone-500">Učitavanje…</p>}
                </div>
                <div className="mt-4 lg:mt-0">
                  {date && (
                    <section>
                      <h2 className="font-semibold mb-2 font-display">{ymdLong(date)}</h2>
                      {slots === null ? <Skeleton h="h-12" n={2} /> : slots.length === 0 ? <p className="text-stone-500">Nema slobodnih termina za izabrani dan.</p> : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                          {slots.map((s) => (
                            <button key={s.start} onClick={() => setSlot(s)} aria-pressed={slot?.start === s.start}
                              className={`h-12 rounded-xl border font-medium ${slot?.start === s.start ? "bg-accent text-white border-accent" : "bg-white border-stone-200"}`}>{s.label}</button>
                          ))}
                        </div>
                      )}
                    </section>
                  )}
                </div>
              </div>
            )}

            {step === 3 && (
              <form className="space-y-4 lg:max-w-xl mx-auto" onSubmit={(e) => { e.preventDefault(); if (formOk) go(4); }}>
                <div><label htmlFor="name" className="block mb-1 font-medium">Ime i prezime</label>
                  <input id="name" className={input} autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
                <div><label htmlFor="phone" className="block mb-1 font-medium">Broj telefona</label>
                  <input id="phone" className={input} type="tel" inputMode="tel" autoComplete="tel" placeholder="064 123 4567" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
                  {f.phone && !phoneOk(f.phone) && <p className="text-sm text-red-600 mt-1">Unesite srpski mobilni broj, npr. 064 123 4567.</p>}</div>
                <div><label htmlFor="email" className="block mb-1 font-medium">Email <span className="text-stone-500 font-normal">(opciono)</span></label>
                  <input id="email" className={input} type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
                <div><label htmlFor="note" className="block mb-1 font-medium">Napomena <span className="text-stone-500 font-normal">(opciono)</span></label>
                  <textarea id="note" rows={3} className={input + " h-auto py-3"} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
                <input tabIndex={-1} autoComplete="off" aria-hidden name="website" className="absolute -left-[9999px]" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
                <label className="flex gap-3 items-start">
                  <input type="checkbox" className="mt-1 size-5 accent-[var(--accent)]" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} />
                  <span className="text-sm">Slažem se sa pravilima otkazivanja: termin se može otkazati ili pomeriti najkasnije {salon?.cancelHours ?? 12} h pre početka.</span>
                </label>
              </form>
            )}

            {step === 4 && slot && (
              <dl className="rounded-2xl bg-white border border-stone-200 p-5 space-y-3 lg:max-w-xl mx-auto">
                {[
                  ["Usluge", chosen.map((s) => s.name).join(", ")],
                  ["Frizer", stylistId ? stylists?.find((s) => s.id === stylistId)?.name : "Bilo koji slobodan"],
                  ["Datum", `${ymdLong(date)}`],
                  ["Vreme", slot.label],
                  ["Trajanje", dur(minutes)],
                  ["Ime", f.name], ["Telefon", f.phone],
                ].map(([k, v]) => <div key={k} className="flex justify-between gap-4"><dt className="text-stone-500">{k}</dt><dd className="text-right font-medium">{v}</dd></div>)}
                <div className="flex justify-between pt-3 border-t border-stone-100 text-lg"><dt>Ukupno</dt><dd className="font-bold">{rsd(total)}</dd></div>
              </dl>
            )}
          </div>
        </div>

        <aside className="hidden lg:block sticky top-28 rounded-2xl bg-white border border-stone-200 shadow-sm p-5">
          <h2 className="font-display text-xl font-semibold mb-3">Vaš termin</h2>
          {sel.length === 0 ? (
            <p className="text-sm text-stone-500">Izaberite jednu ili više usluga.</p>
          ) : (
            <dl className="text-sm space-y-2">
              <div>
                <dt className="text-stone-500">Usluge</dt>
                {chosen.map((s) => (
                  <dd key={s.id} className="flex justify-between">
                    <span>{s.name}</span>
                    <span>{rsd(s.priceRsd)}</span>
                  </dd>
                ))}
              </div>
              {stylistId !== null && (
                <div className="flex justify-between">
                  <dt className="text-stone-500">Frizer</dt>
                  <dd>{stylistId ? stylists?.find((s) => s.id === stylistId)?.name : "Bilo koji slobodan"}</dd>
                </div>
              )}
              {slot && (
                <div className="flex justify-between">
                  <dt className="text-stone-500">Termin</dt>
                  <dd>{date.split("-").reverse().join(".")}. u {slot.label}</dd>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-stone-100 text-base">
                <dt>Ukupno · {dur(minutes)}</dt>
                <dd className="font-bold">{rsd(total)}</dd>
              </div>
            </dl>
          )}
          <button
            disabled={!can || busy}
            onClick={step === 4 ? submit : () => go(step + 1)}
            className="w-full h-12 mt-4 rounded-xl bg-accent text-white font-semibold disabled:opacity-40 hover:opacity-90"
          >
            {step === 4 ? (busy ? "Zakazivanje…" : "Potvrdi termin") : "Dalje"}
          </button>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 lg:hidden bg-white/95 backdrop-blur border-t border-stone-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-lg mx-auto">
          {sel.length > 0 && <div className="flex justify-between text-sm mb-2"><span>{sel.length} {sel.length === 1 ? "usluga" : "usluge"} · {dur(minutes)}</span><b>{rsd(total)}</b></div>}
          <button disabled={!can || busy} onClick={step === 4 ? submit : () => go(step + 1)}
            className="w-full h-12 rounded-xl bg-accent text-white font-semibold disabled:opacity-40">
            {step === 4 ? (busy ? "Zakazivanje…" : "Potvrdi termin") : "Dalje"}
          </button>
        </div>
      </div>
    </main>
  );
}