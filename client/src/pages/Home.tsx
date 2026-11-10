import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Category, type Stylist,type WorkingDays } from "../lib/api";
import { useSalon } from "../lib/hooks";
import { dur, hm, minOf, rsd, todayYmd, WEEKDAYS_SHORT } from "../lib/format";
import { Skeleton } from "../components/Skeleton";

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Pon..Ned
const card = "rounded-2xl bg-white border border-stone-200 shadow-sm";

export default function Home() {
  const salon = useSalon();
  const [cats, setCats] = useState<Category[] | null>(null);
  const [team, setTeam] = useState<Pick<Stylist, "id" | "name" | "bio" | "photoUrl">[]>([]);
  const [wd, setWd] = useState<WorkingDays | null>(null);
  useEffect(() => {
    api<Category[]>("/services").then(setCats).catch(() => setCats([]));
    api<typeof team>("/team").then(setTeam).catch(() => {});
    api<WorkingDays>("/working-days").then(setWd).catch(() => {});
  }, []);

  if (!salon) return <main className="max-w-xl mx-auto px-4 py-10"><Skeleton n={3} h="h-28" /></main>;

  const today = todayYmd();
  const wdNow = new Date(today + "T12:00:00Z").getUTCDay();
  const hNow = wd?.hours.find((x) => x.weekday === wdNow);
  const m = minOf(new Date().toISOString());
  const open = !!wd && !!hNow && !wd.holidays.includes(today) && m >= hNow.startMin && m < hNow.endMin;
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(salon.address)}`;
const action = "flex-1 lg:flex-none lg:px-6 h-12 rounded-xl border border-stone-300 bg-white font-medium grid place-items-center hover:border-accent";
    return (
    <div className="pb-32 lg:pb-0">
      <nav className="hidden lg:block sticky top-0 z-20 bg-white/85 backdrop-blur border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-8 h-16 flex items-center justify-between">
          <span className="font-display text-xl font-semibold">{salon.name}</span>
          <div className="flex items-center gap-6">
            <Link to="/nadji" className="text-stone-600 hover:text-accent">Pronađi moj termin</Link>
            <Link to="/zakazi" className="h-11 px-6 leading-[2.75rem] rounded-xl bg-accent text-white font-semibold hover:opacity-90">Zakaži termin</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-xl lg:max-w-6xl mx-auto px-4 lg:px-8">
        <div className="lg:grid lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:items-center lg:py-16">
          <header className="pt-10 pb-6 text-center lg:text-left fade-up bg-gradient-to-b from-accent/10 to-transparent -mx-4 px-4 lg:mx-0 lg:px-0 lg:pt-0 lg:pb-0 lg:bg-none">
            {salon.logoUrl
              ? <img src={salon.logoUrl} alt="" className="h-24 w-auto mx-auto lg:mx-0 mb-4 object-contain" />
              : <div className="size-20 mx-auto lg:mx-0 mb-4 rounded-full bg-accent text-white grid place-items-center text-3xl font-display">{salon.name[0]}</div>}
            <h1 className="font-display text-4xl lg:text-6xl font-semibold tracking-tight">{salon.name}</h1>
            {wd && <p className={`inline-flex items-center gap-2 mt-3 text-sm px-3 py-1 rounded-full ${open ? "bg-green-100 text-green-800" : "bg-stone-200 text-stone-700"}`}>
              <span className={`size-2 rounded-full ${open ? "bg-green-600" : "bg-stone-500"}`} />{open ? `Otvoreno do ${hm(hNow!.endMin)}` : "Trenutno zatvoreno"}</p>}
            <p className="mt-4 text-stone-600 leading-relaxed lg:text-lg lg:max-w-md">{salon.description}</p>
            <div className="flex gap-2 mt-5 lg:mt-8">
              <Link to="/zakazi" className="hidden lg:grid h-12 px-8 rounded-xl bg-accent text-white font-semibold place-items-center shadow-md hover:opacity-90">Zakaži termin</Link>
              {salon.phone && <a href={`tel:${salon.phone}`} className={action}>📞 Pozovi</a>}
              {salon.address && <a href={maps} target="_blank" rel="noopener noreferrer" className={action}>📍 Putanja</a>}
            </div>
          </header>

          <div>
            <section className={`${card} p-4 lg:p-6 mt-2 lg:mt-0`}>
              <h2 className="font-display text-xl font-semibold mb-2">Radno vreme</h2>
              {wd ? (
                <ul className="text-sm space-y-1">
                  {ORDER.map((d, i) => {
                    const h = wd.hours.find((x) => x.weekday === d), now = d === wdNow;
                    return <li key={d} className={`flex justify-between py-0.5 ${now ? "font-semibold text-accent" : ""}`}>
                      <span>{WEEKDAYS_SHORT[i]}{now && " (danas)"}</span><span>{h ? `${hm(h.startMin)} – ${hm(h.endMin)}` : "Zatvoreno"}</span></li>;
                  })}
                </ul>
              ) : <Skeleton n={3} h="h-5" />}
              {salon.address && <p className="text-sm text-stone-600 mt-3 pt-3 border-t border-stone-100">{salon.address}</p>}
            </section>
            {salon.mapEmbedUrl && <iframe title="Mapa salona" src={salon.mapEmbedUrl} loading="lazy" className="w-full h-56 rounded-2xl border border-stone-200 mt-4" />}
          </div>
        </div>

        {team.length > 0 && (
          <section className="mt-8 lg:mt-4">
            <h2 className="font-display text-2xl lg:text-3xl font-semibold mb-3 lg:mb-5">Naš tim</h2>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x lg:mx-0 lg:px-0 lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible">
              {team.map((s) => (
                <div key={s.id} className={`${card} p-4 lg:p-6 w-36 lg:w-auto shrink-0 text-center snap-start`}>
                  {s.photoUrl ? <img src={s.photoUrl} alt="" loading="lazy" className="size-20 lg:size-28 rounded-full object-cover mx-auto" />
                    : <div className="size-20 lg:size-28 rounded-full bg-accent/15 text-accent grid place-items-center text-2xl lg:text-4xl font-display mx-auto">{s.name[0]}</div>}
                  <b className="block mt-2 lg:text-lg">{s.name}</b>
                  {s.bio && <span className="block text-xs lg:text-sm text-stone-600 mt-0.5">{s.bio}</span>}
                </div>))}
            </div>
          </section>
        )}

        <h2 className="font-display text-2xl lg:text-3xl font-semibold mt-8 lg:mt-16 mb-3 lg:mb-5">Cenovnik</h2>
        {cats === null ? <Skeleton n={4} h="h-14" /> : (
          <div className="lg:columns-2 lg:gap-8">
            {cats.filter((c) => c.services.length).map((c) => (
              <section key={c.id} className="mb-5 lg:mb-8 break-inside-avoid">
                <h3 className="font-semibold text-accent mb-1.5 px-1">{c.name}</h3>
                <ul className={`${card} divide-y divide-stone-100`}>
                  {c.services.map((s) => (
                    <li key={s.id} className="flex justify-between gap-3 p-3.5">
                      <span><span className="block font-medium">{s.name}</span>
                        {s.description && <span className="block text-sm text-stone-600">{s.description}</span>}
                        <span className="block text-sm text-stone-500">{dur(s.durationMin)}</span></span>
                      <b className="whitespace-nowrap">{rsd(s.priceRsd)}</b>
                    </li>))}
                </ul>
              </section>))}
          </div>
        )}

        <p className="text-center mt-8 lg:hidden"><Link to="/nadji" className="text-accent underline underline-offset-4">Već imate termin? Pronađi moj termin</Link></p>
        <footer className="text-center text-xs text-stone-500 mt-10 lg:py-10">© {new Date().getFullYear()} {salon.name}</footer>
      </main>

      <div className="lg:hidden fixed inset-x-0 bottom-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white/90 backdrop-blur border-t border-stone-200">
        <Link to="/zakazi" className="block max-w-xl mx-auto h-14 leading-[3.5rem] text-center rounded-xl bg-accent text-white text-lg font-semibold shadow-md active:scale-[.98]">Zakaži termin</Link>
      </div>
    </div>
  );
}