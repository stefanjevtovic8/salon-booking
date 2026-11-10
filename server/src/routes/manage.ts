import { Router } from "express";
import { z } from "zod";
import { formatInTimeZone } from "date-fns-tz";
import { db, TZ } from "../lib/db.js";
import { slotsForStylist } from "../lib/availability.js";
import { HttpError, normalizePhone } from "../lib/booking.js";
import { mailAppointment } from "../lib/mail.js";

export const manageRouter = Router();
const wrap = (fn: (q: any, r: any) => Promise<unknown>) => (q: any, r: any, n: any) => fn(q, r).catch(n);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function load(token: string) {
  const a = await db.appointment.findUnique({ where: { manageToken: token }, include: { items: true, stylist: true } });
  if (!a) throw new HttpError(404, "Termin nije pronađen");
  const salon = await db.salon.findUniqueOrThrow({ where: { id: 1 } });
  const canChange = a.status === "zakazan" && +a.startsAt - Date.now() >= salon.cancelHours * 3_600_000;
  const svcs = await db.service.findMany({ where: { id: { in: a.items.map((i) => i.serviceId) } } });
  const step = svcs.length ? Math.max(...svcs.map((s) => s.stepMin)) : salon.defaultStepMin;
  return { a, salon, canChange, step };
}
const blocked = (hours: number, phone: string) =>
  new HttpError(403, `Termin se može otkazati ili pomeriti najkasnije ${hours} h pre početka. Pozovite salon: ${phone}`);

manageRouter.get("/manage/:token", wrap(async (q, r) => {
  const { a, salon, canChange } = await load(q.params.token);
  r.json({
    status: a.status, startsAt: a.startsAt, endsAt: a.endsAt, stylistName: a.stylist.name,
    totalPriceRsd: a.totalPriceRsd, totalDurationMin: a.totalDurationMin, shortCode: a.shortCode,
    items: a.items.map((i) => ({ name: i.nameSnapshot, priceRsd: i.priceRsd, durationMin: i.durationMin })),
    canChange, cancelHours: salon.cancelHours, salonPhone: salon.phone, salonName: salon.name,
    salonAddress: salon.address, maxAdvanceDays: salon.maxAdvanceDays,
  });
}));

manageRouter.post("/manage/:token/cancel", wrap(async (q, r) => {
  const { a, salon, canChange } = await load(q.params.token);
  if (!canChange) throw blocked(salon.cancelHours, salon.phone);
  await db.appointment.update({ where: { id: a.id }, data: { status: "otkazan" } });
  void mailAppointment(a.id, "otkazan");
  r.json({ ok: true });
}));

manageRouter.get("/manage/:token/availability", wrap(async (q, r) => {
  const date = dateStr.parse(q.query.date);
  const { a, salon, canChange, step } = await load(q.params.token);
  if (!canChange) throw blocked(salon.cancelHours, salon.phone);
  const list = await slotsForStylist(a.stylistId, date, a.totalDurationMin, step, a.id);
  r.json(list.map((s) => ({ start: s, label: formatInTimeZone(s, TZ, "HH:mm"), stylistIds: [a.stylistId] })));
}));

manageRouter.post("/manage/:token/reschedule", wrap(async (q, r) => {
  const { start } = z.object({ start: z.string().datetime() }).parse(q.body);
  const { a, salon, canChange, step } = await load(q.params.token);
  if (!canChange) throw blocked(salon.cancelHours, salon.phone);
  const date = formatInTimeZone(start, TZ, "yyyy-MM-dd");
  const startsAt = new Date(start);
  const endsAt = new Date(+startsAt + a.totalDurationMin * 60_000);

  await db.$transaction(async (tx) => {
    const free = (await slotsForStylist(a.stylistId, date, a.totalDurationMin, step, a.id)).includes(startsAt.toISOString());
    const clash = await tx.appointment.findFirst({
      where: { id: { not: a.id }, stylistId: a.stylistId, status: "zakazan", startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
    });
    if (!free || clash) throw new HttpError(409, "Termin više nije slobodan, izaberite drugi.");
    await tx.appointment.update({ where: { id: a.id }, data: { startsAt, endsAt, reminderSent: false } });
  }, { isolationLevel: "Serializable" });

  void mailAppointment(a.id, "pomeren");
  r.json({ ok: true });
}));

// "Pronađi moj termin"
manageRouter.post("/lookup", wrap(async (q, r) => {
  const b = z.object({ phone: z.string().max(30), code: z.string().regex(/^\d{6}$/) }).parse(q.body);
  const phone = normalizePhone(b.phone);
  const a = phone ? await db.appointment.findFirst({ where: { shortCode: b.code, customer: { phone } }, orderBy: { startsAt: "desc" } }) : null;
  if (!a) throw new HttpError(404, "Termin nije pronađen. Proverite broj telefona i kod.");
  r.json({ manageToken: a.manageToken });
}));