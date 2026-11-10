import { useEffect, useState } from "react";
import { api, send } from "../../lib/api";
import { btnP, Card, Field, inp, Msg, useStatus } from "../../components/admin/ui";
import HoursEditor from "../../components/admin/HoursEditor";
import TimeOffEditor from "../../components/admin/TimeOffEditor";
import ImageField from "../../components/admin/ImageField";

type S = {
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string | null;
  mapEmbedUrl: string | null;
  accentColor: string;
  cancelHours: number;
  maxAdvanceDays: number;
  minLeadMin: number;
  defaultStepMin: number;
};

export default function Settings() {
  const [s, setS] = useState<S | null>(null);
  const { err, ok, run } = useStatus();

  useEffect(() => {
    api<S>("/admin/salon").then(setS).catch(() => {});
  }, []);

  if (!s) return <p className="text-stone-500">Učitavanje…</p>;

  const set = (k: keyof S) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setS({ ...s, [k]: typeof s[k] === "number" ? +e.target.value : e.target.value });

  return (
    <>
      <h1 className="text-xl font-bold mb-4">Podešavanja salona</h1>
      <Card title="Osnovni podaci">
        <Msg err={err} ok={ok} />
        <Field label="Naziv salona">
          <input className={inp} value={s.name} onChange={set("name")} />
        </Field>
        <Field label="Opis">
          <textarea className={inp + " h-24 py-2"} value={s.description} onChange={set("description")} />
        </Field>
        <Field label="Adresa">
          <input className={inp} value={s.address} onChange={set("address")} />
        </Field>
        <Field label="Telefon">
          <input className={inp} type="tel" value={s.phone} onChange={set("phone")} />
        </Field>
        <Field label="Email salona">
          <input className={inp} type="email" value={s.email} onChange={set("email")} />
        </Field>
        <ImageField label="Logo" value={s.logoUrl ?? ""} onChange={(u) => setS({ ...s, logoUrl: u })} />
        {/* Ispravljeni navodnici korišćenjem spoljnih jednostrukih navodnika */}
        <Field label='Google Maps: nalepite ceo „embed" kod ili samo src link'>
          <textarea className={inp + " h-20 py-2"} value={s.mapEmbedUrl ?? ""} onChange={set("mapEmbedUrl")} />
        </Field>
        <Field label="Akcentna boja">
          <input className="w-full h-11 rounded-xl border border-stone-300 bg-white" type="color" value={s.accentColor} onChange={set("accentColor")} />
        </Field>

        <h3 className="font-semibold mt-5 mb-2">Pravila zakazivanja</h3>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Otkazivanje do (sati pre)">
            <input className={inp} type="number" inputMode="numeric" min={0} max={168} value={s.cancelHours} onChange={set("cancelHours")} />
          </Field>
          <Field label="Maks. unapred (dana)">
            <input className={inp} type="number" inputMode="numeric" min={1} max={365} value={s.maxAdvanceDays} onChange={set("maxAdvanceDays")} />
          </Field>
          <Field label="Najmanje unapred (min)">
            <input className={inp} type="number" inputMode="numeric" min={0} step={15} value={s.minLeadMin} onChange={set("minLeadMin")} />
          </Field>
          <Field label="Korak za nove usluge">
            <select className={inp} value={s.defaultStepMin} onChange={set("defaultStepMin")}>
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={60}>60 min</option>
            </select>
          </Field>
        </div>
        <button className={btnP} onClick={() => run(async () => setS(await api<S>("/admin/salon", send("PUT", s))))}>
          Sačuvaj podešavanja
        </button>
      </Card>

      <Card title="Radno vreme salona">
        <HoursEditor owner="salon" />
      </Card>
      <Card title="Neradni dani i praznici">
        <Holidays />
      </Card>
      <Card title="Odsustvo celog salona (npr. renoviranje)">
        <TimeOffEditor stylistId={null} />
      </Card>
      <Card title="Šabloni email poruka">
        <Templates />
      </Card>
      <Password />
    </>
  );
}

function Holidays() {
  const [list, setList] = useState<{ id: number; date: string; name: string }[]>([]);
  const [f, setF] = useState({ date: "", name: "" });
  const { err, ok, run } = useStatus();
  const load = () => api<typeof list>("/admin/holidays").then(setList).catch(() => {});
  
  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <Msg err={err} ok={ok} />
      <ul className="mb-3 divide-y divide-stone-100">
        {list.length === 0 && <li className="text-sm text-stone-500">Nema unetih neradnih dana.</li>}
        {list.map((h) => (
          <li key={h.id} className="py-2 flex justify-between items-center text-sm">
            <span>{h.date.split("-").reverse().join(".")}. {h.name && <span className="text-stone-500">· {h.name}</span>}</span>
            <button className="underline text-red-700 h-9" onClick={() => run(async () => { await api(`/admin/holidays/${h.id}`, send("DELETE")); await load(); }, "Obrisano")}>
              obriši
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input className={inp} type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        <input className={inp} placeholder="Naziv (opciono)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </div>
      <button className={btnP + " mt-3"} disabled={!f.date} onClick={() => run(async () => { await api("/admin/holidays", send("POST", f)); setF({ date: "", name: "" }); await load(); }, "Dodato")}>
        Dodaj neradni dan
      </button>
    </>
  );
}

function Password() {
  const [p, setP] = useState({ current: "", next: "" });
  const { err, ok, run } = useStatus();
  return (
    <Card title="Promena lozinke">
      <Msg err={err} ok={ok} />
      <Field label="Trenutna lozinka">
        <input className={inp} type="password" autoComplete="current-password" value={p.current} onChange={(e) => setP({ ...p, current: e.target.value })} />
      </Field>
      <Field label="Nova lozinka (min. 8 karaktera)">
        <input className={inp} type="password" autoComplete="new-password" value={p.next} onChange={(e) => setP({ ...p, next: e.target.value })} />
      </Field>
      <button className={btnP} disabled={p.next.length < 8 || !p.current} onClick={() => run(async () => { await api("/admin/password", send("POST", p)); setP({ current: "", next: "" }); }, "Lozinka je promenjena")}>
        Promeni lozinku
      </button>
    </Card>
  );
}

const KINDS: [string, string][] = [
  ["potvrda", "Potvrda zakazivanja"],
  ["pomeren", "Termin pomeren"],
  ["podsetnik", "Podsetnik 24h pre"],
  ["otkazan", "Termin otkazan"]
];

const HINT: Record<string, string> = {
  potvrda: "Zdravo {ime}, vaš termin je uspešno zakazan.",
  pomeren: "Zdravo {ime}, vaš termin je pomeren.",
  podsetnik: "Zdravo {ime}, podsećamo vas da sutra imate termin.",
  otkazan: "Zdravo {ime}, vaš termin je otkazan."
};

function Templates() {
  const [t, setT] = useState<Record<string, { subject: string; intro: string }>>({});
  const { err, ok, run } = useStatus();

  useEffect(() => {
    api<typeof t>("/admin/templates").then(setT).catch(() => {});
  }, []);

  const set = (k: string, p: Partial<{ subject: string; intro: string }>) =>
    setT({
      ...t,
      [k]: {
        subject: t[k]?.subject ?? "",
        intro: t[k]?.intro ?? "",
        ...p,
      },
    });

  return (
    <>
      <Msg err={err} ok={ok} />
      <p className="text-sm text-stone-600 mb-3">
        Dostupne oznake: <code>{"{ime} {datum} {vreme} {frizer} {salon}"}</code>. Prazno polje znači podrazumevani tekst. Usluge, cena, link i kod se dodaju automatski.
      </p>
      {KINDS.map(([k, l]) => (
        <div key={k} className="mb-4 pb-4 border-b border-stone-100 last:border-0">
          <b className="block mb-1">{l}</b>
          <Field label="Naslov">
            <input
              className={inp}
              placeholder="npr. Termin je zakazan – {salon}"
              value={t[k]?.subject ?? ""}
              onChange={(e) => set(k, { subject: e.target.value })}
            />
          </Field>
          <Field label="Uvodni tekst">
            <textarea
              className={inp + " h-20 py-2"}
              placeholder={HINT[k]}
              value={t[k]?.intro ?? ""}
              onChange={(e) => set(k, { intro: e.target.value })}
            />
          </Field>
        </div>
      ))}
      <button
        className={btnP}
        onClick={() => run(async () => { await api("/admin/templates", send("PUT", t)); })}
      >
        Sačuvaj šablone
      </button>
    </>
  );
}