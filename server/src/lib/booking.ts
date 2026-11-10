import { randomBytes, randomInt } from "node:crypto";
import { db } from "./db.js";
import { loadServices, slotsForStylist } from "./availability.js";
import { formatInTimeZone } from "date-fns-tz";
import { TZ } from "./db.js";

export function normalizePhone(raw: string): string | null {
  const p = raw.replace(/[\s\-/()]/g, "");
  const m = p.match(/^(?:\+381|00381|0)(6\d{7,8})$/);
  return m ? `+381${m[1]}` : null;
}

export async function createAppointment(input: {
  serviceIds: number[]; stylistId?: number; start: string;
  name: string; phone: string; email?: string; note?: string; source?: "online" | "rucno";
}) {
  const phone = normalizePhone(input.phone);
  if (!phone) throw new HttpError(400, "Neispravan broj telefona");
  const date = formatInTimeZone(input.start, TZ, "yyyy-MM-dd");

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const base = await loadServices(input.serviceIds);
        const durationMin = base.reduce((a, s) => a + s.durationMin, 0);
        const stepMin = Math.max(...base.map((s) => s.stepMin));
        const candidates = base.map((s) => s.stylistIds).reduce((a, b) => a.filter((x) => b.includes(x)));
        const pool = input.stylistId ? candidates.filter((x) => x === input.stylistId) : candidates;

        // pronađi frizera koji je slobodan u tačno taj početak (provera UNUTAR transakcije)
        let chosen: number | null = null, bestLoad = Infinity;
        for (const id of pool) {
          if (!(await slotsForStylist(id, date, durationMin, stepMin)).includes(new Date(input.start).toISOString())) continue;
          const load = await tx.appointment.count({ where: { stylistId: id, status: "zakazan", startsAt: { gte: new Date(date) } } });
          if (load < bestLoad) { bestLoad = load; chosen = id; }
        }
        if (!chosen) throw new HttpError(409, "Termin više nije slobodan, izaberite drugi.");

        // konačna provera preklapanja kroz tx (konzistentno sa Serializable)
        const startsAt = new Date(input.start);
        const endsAt = new Date(+startsAt + durationMin * 60_000);
        const clash = await tx.appointment.findFirst({
          where: { stylistId: chosen, status: "zakazan", startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
        });
        if (clash) throw new HttpError(409, "Termin više nije slobodan, izaberite drugi.");

        const svcs = await loadServices(input.serviceIds, chosen);
        const customer = await tx.customer.upsert({
          where: { phone }, update: { name: input.name, email: input.email || undefined },
          create: { name: input.name, phone, email: input.email || null },
        });
        return tx.appointment.create({
          data: {
            customerId: customer.id, stylistId: chosen, startsAt, endsAt,
            totalDurationMin: durationMin, totalPriceRsd: svcs.reduce((a, s) => a + s.priceRsd, 0),
            manageToken: randomBytes(24).toString("base64url"),
            shortCode: String(randomInt(100000, 999999)),
            source: input.source ?? "online", note: input.note ?? "",
            items: { create: svcs.map((s) => ({ serviceId: s.id, nameSnapshot: s.name, priceRsd: s.priceRsd, durationMin: s.durationMin })) },
          },
          include: { items: true, stylist: true, customer: true },
        });
      }, { isolationLevel: "Serializable" });
    } catch (e: any) {
      if (e.code === "P2034" && attempt < 2) continue; // konflikt serijalizacije -> ponovi
      throw e;
    }
  }
  throw new HttpError(409, "Pokušajte ponovo.");
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}