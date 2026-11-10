import { useEffect, useState } from "react";
import { api, send } from "../../lib/api";
import { addDays, dur, fmtDate, fmtTime, hm, localYmd, minOf, mondayOf, phoneOk, rsd, todayYmd, toMin, WEEKDAYS_SHORT, ymdLong } from "../../lib/format";
import { btnP, btnS, Field, inp, Msg, Sheet, useStatus } from "../../components/admin/ui";

type Ap = { id: number; stylistId: number; status: string; startsAt: string; endsAt: string; note: string; source: string; totalPriceRsd: number;
  totalDurationMin: number; customerName: string; customerPhone: string; customerNote: string; services: string[] };
type Off = { id: number; stylistId: number | null; startsAt: string; endsAt: string; reason: string };
type Sty = { id: number; name: string };
type Data = { stylists: Sty[]; range: { startMin: number; endMin: number }; appointments: Ap[]; timeOff: Off[] };
type Reload = () => Promise<unknown>;

const H = 56; // px po satu
const COLOR: Record<string, string> = { zakazan: "bg-accent/15 border-accent", zavrsen: "bg-green-100 border-green-600", nije_dosao: "bg-red-100 border-red-500" };
const STATUS: Record<string, string> = { zakazan: "Zakazan", zavrsen: "Završen", nije_dosao: "Nije se pojavio" };
const dm = (d: string) => d.split("-").reverse().join(".") + ".";
const clip = (s: string, e: string, date: string): [number, number] | null => {
  if (localYmd(s) > date || localYmd(e) < date) return null;
  const a = localYmd(s) < date ? 0 : minOf(s), b = localYmd(e) > date ? 1440 : minOf(e);
  return b > a ? [a, b] : null;
};

export default function Schedule() {
  const [mode, setMode] = useState<"day" | "week">("day");
  const [date, setDate] = useState(todayYmd());
  const [wst, setWst] = useState<number | null>(null);
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [sel, setSel] = useState<Ap | null>(null);
  const [add, setAdd] = useState<{ date: string; time: string; stylistId: number } | null>(null);
  const [block, setBlock] = useState<{ date: string; time: string; stylistId: number | null } | null>(null);

  const from = mode === "day" ? date : mondayOf(date), days = mode === "day" ? 1 : 7;
  const load: Reload = () => api<Data>(`/admin/calendar?from=${from}&days=${days}`).then((x) => { setD(x); setErr(""); }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [from, days]);

  const ws = wst ?? d?.stylists[0]?.id ?? null;
  const cols = !d ? [] : mode === "day"
    ? d.stylists.map((s) => ({ key: String(s.id), label: s.name, date, stylistId: s.id }))
    : ws == null ? [] : Array.from({ length: 7 }, (_, i) => { const dt = addDays(from, i); return { key: dt, label: `${WEEKDAYS_SHORT[i]} ${dt.slice(8)}.${dt.slice(5, 7)}.`, date: dt, stylistId: ws }; });

  const gs = !d ? 0 : Math.floor(Math.min(d.range.startMin, ...d.appointments.map((a) => minOf(a.startsAt))) / 60) * 60;
  const ge = !d ? 0 : Math.ceil(Math.max(d.range.endMin, ...d.appointments.map((a) => minOf(a.endsAt))) / 60) * 60;
  const px = (m: number) => ((m - gs) / 60) * H;
  const step = (n: number) => setDate(addDays(date, n * days));
  const firstSty = d?.stylists[0]?.id;

  return (<>
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <button className={btnS + " !px-3"} aria-label="Prethodno" onClick={() => step(-1)}>‹</button>
      <input type="date" className={inp + " !w-auto"} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
      <button className={btnS + " !px-3"} aria-label="Sledeće" onClick={() => step(1)}>›</button>
      <button className={btnS} onClick={() => setDate(todayYmd())}>Danas</button>
      <div className="flex rounded-xl border border-stone-300 overflow-hidden">
        {(["day", "week"] as const).map((m) => <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m} className={`h-11 px-3 ${mode === m ? "bg-accent text-white" : "bg-white"}`}>{m === "day" ? "Dan" : "Nedelja"}</button>)}
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <b className="mr-auto">{mode === "day" ? ymdLong(date) : `${dm(from)} – ${dm(addDays(from, 6))}`}</b>
      {mode === "week" && d && <select className={inp + " !w-auto"} value={ws ?? ""} onChange={(e) => setWst(+e.target.value)}>{d.stylists.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
      <button className={btnP} disabled={!firstSty} onClick={() => setAdd({ date, time: "09:00", stylistId: ws ?? firstSty! })}>+ Termin</button>
      <button className={btnS} onClick={() => setBlock({ date, time: "09:00", stylistId: ws })}>Blokiraj vreme</button>
    </div>
    <Msg err={err} />
    {!d ? <p className="text-stone-500">Učitavanje…</p> : cols.length === 0 ? <p className="text-stone-500">Nema aktivnih frizera. Dodajte ih u odeljku Frizeri.</p> : (
      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <div className="flex min-w-max">
          <div className="w-12 shrink-0 sticky left-0 z-20 bg-white border-r border-stone-100">
            <div className="h-10" />
            <div className="relative" style={{ height: px(ge) }}>
              {Array.from({ length: (ge - gs) / 60 }, (_, i) => <span key={i} className="absolute right-1 -translate-y-2 text-xs text-stone-500" style={{ top: i * H }}>{hm(gs + i * 60)}</span>)}
            </div>
          </div>
          {cols.map((c) => (
            <div key={c.key} className="w-40 shrink-0 border-l border-stone-200">
              <div className={`h-10 flex items-center justify-center text-sm font-semibold border-b border-stone-200 ${c.date === todayYmd() ? "text-accent" : ""}`}>{c.label}</div>
              <div className="relative cursor-pointer" style={{ height: px(ge), backgroundImage: "linear-gradient(to bottom,#e7e5e4 1px,transparent 1px)", backgroundSize: `100% ${H}px` }}
                onClick={(e) => { const y = e.clientY - e.currentTarget.getBoundingClientRect().top; const m = Math.min(gs + Math.round(((y / H) * 60) / 15) * 15, 1425); setAdd({ date: c.date, time: hm(m), stylistId: c.stylistId }); }}>
                {d.timeOff.filter((t) => t.stylistId == null || t.stylistId === c.stylistId).map((t) => {
                  const r = clip(t.startsAt, t.endsAt, c.date); if (!r) return null;
                  return <button key={t.id} title="Klik za brisanje blokade" className="absolute inset-x-0 bg-stone-200/80 text-xs text-stone-600 text-left px-1 overflow-hidden border-y border-stone-300"
                    style={{ top: px(Math.max(r[0], gs)), height: px(Math.min(r[1], ge)) - px(Math.max(r[0], gs)) }}
                    onClick={(e) => { e.stopPropagation(); if (confirm(`Obrisati blokadu${t.reason ? ` „${t.reason}"` : ""}?`)) api(`/admin/timeoff/${t.id}`, send("DELETE")).then(load).catch((x) => setErr(x.message)); }}>
                    🚫 {t.reason || "Blokirano"}</button>;
                })}
                {d.appointments.filter((a) => a.stylistId === c.stylistId && localYmd(a.startsAt) === c.date).map((a) => (
                  <button key={a.id} onClick={(e) => { e.stopPropagation(); setSel(a); }}
                    className={`absolute left-0.5 right-0.5 rounded-lg border-l-4 px-1.5 py-0.5 text-left text-xs overflow-hidden ${COLOR[a.status] ?? ""}`}
                    style={{ top: px(minOf(a.startsAt)), height: Math.max(px(minOf(a.endsAt)) - px(minOf(a.startsAt)), 24) }}>
                    <b>{fmtTime(a.startsAt)}</b> {a.customerName}<span className="block text-stone-600">{a.services.join(", ")}</span>
                  </button>))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
    {sel && d && <Detail a={sel} stylists={d.stylists} reload={load} onClose={() => setSel(null)} />}
    {add && d && <AddAppt init={add} stylists={d.stylists} reload={load} onClose={() => setAdd(null)} />}
    {block && d && <BlockSheet init={block} stylists={d.stylists} reload={load} onClose={() => setBlock(null)} />}
  </>);
}

function Detail({ a, stylists, reload, onClose }: { a: Ap; stylists: Sty[]; reload: Reload; onClose: () => void }) {
  const [note, setNote] = useState(a.note);
  const [mv, setMv] = useState({ date: localYmd(a.startsAt), time: fmtTime(a.startsAt), stylistId: a.stylistId });
  const { err, ok, run } = useStatus();
  const put = (body: object, msg: string, close = true) =>
    run(async () => { await api(`/admin/appointments/${a.id}`, send("PUT", body)); await reload(); }, msg).then((s) => s && close && onClose());
  return (
    <Sheet title="Termin" onClose={onClose}>
      <Msg err={err} ok={ok} />
      <div className="rounded-2xl bg-white border border-stone-200 p-3 text-sm space-y-1 mb-3">
        <p className="text-base"><b>{fmtDate(a.startsAt)}</b> u <b>{fmtTime(a.startsAt)}</b> · {STATUS[a.status]}</p>
        <p><b>{a.customerName}</b> · <a className="text-accent underline" href={`tel:${a.customerPhone}`}>{a.customerPhone}</a></p>
        <p>{a.services.join(", ")}</p>
        <p>{dur(a.totalDurationMin)} · <b>{rsd(a.totalPriceRsd)}</b> · {a.source === "rucno" ? "uneto ručno" : "online"}</p>
        {a.customerNote && <p className="text-stone-500">Beleška o klijentu: {a.customerNote}</p>}
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {a.status === "zakazan" ? (<>
          <button className={btnP} onClick={() => put({ status: "zavrsen" }, "Označeno")}>Završen</button>
          <button className={btnS} onClick={() => put({ status: "nije_dosao" }, "Označeno")}>Nije se pojavio</button>
          <button className={btnS + " !text-red-700 !border-red-300"} onClick={() => confirm("Otkazati termin? Klijent dobija email ako ga je ostavio.") && put({ status: "otkazan" }, "Otkazano")}>Otkaži</button>
        </>) : <button className={btnS} onClick={() => put({ status: "zakazan" }, "Vraćeno")}>Vrati na „Zakazan"</button>}
      </div>
      <Field label="Napomena uz termin"><textarea className={inp + " h-20 py-2"} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <button className={btnS + " mb-4"} onClick={() => put({ note }, "Napomena sačuvana", false)}>Sačuvaj napomenu</button>
      <h3 className="font-semibold mb-2 pt-3 border-t border-stone-200">Pomeri termin</h3>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Datum"><input type="date" className={inp} value={mv.date} onChange={(e) => setMv({ ...mv, date: e.target.value })} /></Field>
        <Field label="Vreme"><input type="time" step={900} className={inp} value={mv.time} onChange={(e) => setMv({ ...mv, time: e.target.value })} /></Field>
      </div>
      <Field label="Frizer"><select className={inp} value={mv.stylistId} onChange={(e) => setMv({ ...mv, stylistId: +e.target.value })}>{stylists.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
      <button className={btnP} disabled={!mv.date || !mv.time} onClick={() => put(mv, "Pomereno")}>Pomeri</button>
    </Sheet>
  );
}

type Svc = { id: number; name: string; durationMin: number; priceRsd: number; active: boolean };
function AddAppt({ init, stylists, reload, onClose }: { init: { date: string; time: string; stylistId: number }; stylists: Sty[]; reload: Reload; onClose: () => void }) {
  const [cats, setCats] = useState<{ id: number; name: string; services: Svc[] }[]>([]);
  const [ids, setIds] = useState<number[]>([]);
  const [f, setF] = useState({ ...init, name: "", phone: "", email: "", note: "" });
  const { err, run } = useStatus();
  useEffect(() => { api<typeof cats>("/admin/categories").then(setCats).catch(() => {}); }, []);
  const chosen = cats.flatMap((c) => c.services).filter((s) => ids.includes(s.id));
  const ok = ids.length > 0 && f.name.trim().length >= 2 && phoneOk(f.phone) && !!f.date && !!f.time;
  return (
    <Sheet title="Novi termin" onClose={onClose}>
      <Msg err={err} />
      <div className="grid grid-cols-3 gap-2">
        <Field label="Datum"><input type="date" className={inp} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Vreme"><input type="time" step={900} className={inp} value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field>
        <Field label="Frizer"><select className={inp} value={f.stylistId} onChange={(e) => setF({ ...f, stylistId: +e.target.value })}>{stylists.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
      </div>
      <p className="text-sm text-stone-600 mb-1">Usluge</p>
      {cats.map((c) => (
        <div key={c.id} className="mb-2">
          <p className="text-xs text-accent font-medium">{c.name}</p>
          {c.services.filter((s) => s.active).map((s) => (
            <label key={s.id} className="flex items-center gap-3 min-h-9">
              <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={ids.includes(s.id)} onChange={() => setIds(ids.includes(s.id) ? ids.filter((x) => x !== s.id) : [...ids, s.id])} />
              <span>{s.name} <span className="text-stone-500 text-sm">{dur(s.durationMin)} · {rsd(s.priceRsd)}</span></span>
            </label>))}
        </div>))}
      {chosen.length > 0 && <p className="text-sm mb-3">Ukupno: <b>{rsd(chosen.reduce((a, s) => a + s.priceRsd, 0))}</b> · {dur(chosen.reduce((a, s) => a + s.durationMin, 0))} (cena frizera može biti drugačija)</p>}
      <Field label="Ime i prezime"><input className={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Telefon"><input className={inp} type="tel" placeholder="064 123 4567" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
      <Field label="Email (opciono, za potvrdu)"><input className={inp} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
      <Field label="Napomena (opciono)"><input className={inp} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
      <button className={btnP + " w-full"} disabled={!ok}
        onClick={async () => { if (await run(async () => { await api("/admin/appointments", send("POST", { ...f, serviceIds: ids })); await reload(); })) onClose(); }}>Zakaži</button>
    </Sheet>
  );
}

function BlockSheet({ init, stylists, reload, onClose }: { init: { date: string; time: string; stylistId: number | null }; stylists: Sty[]; reload: Reload; onClose: () => void }) {
  const [f, setF] = useState({ stylistId: init.stylistId ?? 0, from: init.date, to: init.date, fromTime: init.time, toTime: hm(Math.min(toMin(init.time) + 60, 1439)), reason: "" });
  const [allDay, setAllDay] = useState(false);
  const [warn, setWarn] = useState("");
  const { err, ok, run } = useStatus();
  return (
    <Sheet title="Blokiraj vreme" onClose={onClose}>
      <Msg err={err} ok={ok} />
      {warn && <p className="mb-3 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm">{warn}</p>}
      <Field label="Ko je odsutan"><select className={inp} value={f.stylistId} onChange={(e) => setF({ ...f, stylistId: +e.target.value })}>
        <option value={0}>Ceo salon</option>{stylists.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Od datuma"><input type="date" className={inp} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value, to: e.target.value > f.to ? e.target.value : f.to })} /></Field>
        <Field label="Do datuma"><input type="date" className={inp} value={f.to} min={f.from} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
      </div>
      <label className="flex items-center gap-3 mb-3"><input type="checkbox" className="size-5 accent-[var(--accent)]" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />Ceo dan</label>
      {!allDay && <div className="grid grid-cols-2 gap-2">
        <Field label="Od vremena"><input type="time" className={inp} value={f.fromTime} onChange={(e) => setF({ ...f, fromTime: e.target.value })} /></Field>
        <Field label="Do vremena"><input type="time" className={inp} value={f.toTime} onChange={(e) => setF({ ...f, toTime: e.target.value })} /></Field>
      </div>}
      <Field label="Razlog (opciono)"><input className={inp} placeholder="pauza, godišnji, bolovanje…" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
      <button className={btnP + " w-full"} onClick={async () => {
        let n = 0;
        const good = await run(async () => {
          const body = { ...f, stylistId: f.stylistId || null, ...(allDay ? { fromTime: "00:00", toTime: "23:59" } : {}) };
          n = (await api<{ conflicts: number }>("/admin/timeoff", send("POST", body))).conflicts;
          await reload();
        }, "Vreme je blokirano");
        if (good) { if (n) setWarn(`Pažnja: ${n} već zakazanih termina se preklapa sa blokadom. Otkažite ih ili pomerite ručno.`); else onClose(); }
      }}>Blokiraj</button>
    </Sheet>
  );
}