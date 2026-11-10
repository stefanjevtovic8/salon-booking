import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { db, TZ } from "./db.js";

const MIN = 60_000;
type Iv = { s: number; e: number };
const overlaps = (a: Iv, b: Iv) => a.s < b.e && b.s < a.e;
const localToUtc = (date: string, min: number) =>
  fromZonedTime(`${date}T${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}:00`, TZ).getTime();

export async function loadServices(serviceIds: number[], stylistId?: number) {
  const services = await db.service.findMany({
    where: { id: { in: serviceIds }, active: true },
    include: { stylists: true },
  });
  if (services.length !== new Set(serviceIds).size) throw new Error("Nepoznata usluga");
  return services.map((s) => ({
    id: s.id, name: s.name, durationMin: s.durationMin, stepMin: s.stepMin,
    priceRsd: (stylistId && s.stylists.find((x) => x.stylistId === stylistId)?.priceRsd) ?? s.priceRsd,
    stylistIds: s.stylists.map((x) => x.stylistId),
  }));
}

/** Frizeri koji rade SVE izabrane usluge */
export async function eligibleStylists(serviceIds: number[]) {
  const svcs = await loadServices(serviceIds);
  const ids = svcs.map((s) => s.stylistIds).reduce((a, b) => a.filter((x) => b.includes(x)));
  return db.stylist.findMany({ where: { id: { in: ids }, active: true } });
}

/** Slobodni početci (UTC ISO) za jednog frizera u jednom lokalnom danu */
export async function slotsForStylist(stylistId: number, date: string, durationMin: number, stepMin: number, ignoreId?: number) {  const salon = await db.salon.findUniqueOrThrow({ where: { id: 1 } });
  const now = Date.now();
  const dayStart = localToUtc(date, 0);
  const dayEnd = localToUtc(date, 24 * 60 - 1) + MIN;
  if (dayEnd < now || dayStart > now + salon.maxAdvanceDays * 86_400_000) return [];
  if (await db.holiday.findUnique({ where: { date } })) return [];

  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const [sh, th] = await Promise.all([
    db.workingHours.findFirst({ where: { stylistId: null, weekday } }),
    db.workingHours.findFirst({ where: { stylistId, weekday } }),
  ]);
  if (!sh || !th) return [];
  const startMin = Math.max(sh.startMin, th.startMin);
  const endMin = Math.min(sh.endMin, th.endMin);

  const busy: Iv[] = [];
  if (th.breakStartMin != null && th.breakEndMin != null)
    busy.push({ s: localToUtc(date, th.breakStartMin), e: localToUtc(date, th.breakEndMin) });

  const [appts, offs] = await Promise.all([
db.appointment.findMany({ where: { stylistId, status: "zakazan", ...(ignoreId ? { id: { not: ignoreId } } : {}), startsAt: { lt: new Date(dayEnd) }, endsAt: { gt: new Date(dayStart) } } }),    db.timeOff.findMany({ where: { OR: [{ stylistId }, { stylistId: null }], startsAt: { lt: new Date(dayEnd) }, endsAt: { gt: new Date(dayStart) } } }),
  ]);
  appts.forEach((a) => busy.push({ s: +a.startsAt, e: +a.endsAt }));
  offs.forEach((o) => busy.push({ s: +o.startsAt, e: +o.endsAt }));

  const out: string[] = [];
  const earliest = now + salon.minLeadMin * MIN;
  const latest = now + salon.maxAdvanceDays * 86_400_000;
  for (let m = startMin; m + durationMin <= endMin; m += stepMin) {
    const s = localToUtc(date, m);
    const iv = { s, e: s + durationMin * MIN };
    if (s < earliest || s > latest) continue;
    if (busy.some((b) => overlaps(iv, b))) continue;
    out.push(new Date(s).toISOString());
  }
  return out;
}

export async function availability(serviceIds: number[], date: string, stylistId?: number) {
  const svcs = await loadServices(serviceIds);
  const durationMin = svcs.reduce((a, s) => a + s.durationMin, 0);
  const stepMin = Math.max(...svcs.map((s) => s.stepMin));
  const stylists = (await eligibleStylists(serviceIds)).filter((s) => !stylistId || s.id === stylistId);

  const map = new Map<string, number[]>(); // ISO -> frizeri
  for (const st of stylists)
    for (const iso of await slotsForStylist(st.id, date, durationMin, stepMin))
      map.set(iso, [...(map.get(iso) ?? []), st.id]);

  return [...map.entries()].sort().map(([iso, stylistIds]) => ({
    start: iso, label: formatInTimeZone(iso, TZ, "HH:mm"), stylistIds,
  }));
}