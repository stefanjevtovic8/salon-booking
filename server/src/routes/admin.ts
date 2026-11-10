import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { db, TZ } from "../lib/db.js";
import { COOKIE, requireAuth, signToken } from "../lib/auth.js";
import { randomBytes, randomInt } from "node:crypto";
import { HttpError, normalizePhone } from "../lib/booking.js";
import { loadServices } from "../lib/availability.js";
import { mailAppointment } from "../lib/mail.js";
import { Prisma } from "@prisma/client";
export const adminRouter = Router();
const wrap = (fn: (q: Request, r: Response) => Promise<unknown>) => (q: Request, r: Response, n: NextFunction) => fn(q, r).catch(n);
const pid = (q: Request) => z.coerce.number().int().parse(q.params.id);
const uid = (q: Request) => (q as any).user.uid as number;
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const step = z.union([z.literal(15), z.literal(30), z.literal(60)]);
const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const dayStart = (d: string) => fromZonedTime(`${d}T00:00:00`, TZ);

// ---------- prijava ----------
adminRouter.post("/login", wrap(async (q, r) => {
  const b = z.object({ email: z.string().email(), password: z.string().min(1).max(200) }).parse(q.body);
  const u = await db.user.findUnique({ where: { email: b.email.toLowerCase() } });
  if (!u || !(await bcrypt.compare(b.password, u.passwordHash))) throw new HttpError(401, "Pogrešan email ili lozinka");
  r.cookie(COOKIE, signToken(u.id, u.role), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 7 * 864e5 });
  r.json({ ok: true });
}));
adminRouter.post("/logout", (_q, r) => { r.clearCookie(COOKIE); r.json({ ok: true }); });

adminRouter.use(requireAuth); // sve ispod zahteva prijavu

adminRouter.get("/me", wrap(async (q, r) => {
  const u = await db.user.findUnique({ where: { id: uid(q) } });
  if (!u) throw new HttpError(401, "Niste prijavljeni");
  r.json({ email: u.email, role: u.role });
}));

adminRouter.post("/password", wrap(async (q, r) => {
  if (process.env.DEMO_MODE === "true") throw new HttpError(403, "Promena lozinke je isključena u demo režimu.");
  const b = z.object({ current: z.string(), next: z.string().min(8).max(200) }).parse(q.body);
  const u = await db.user.findUniqueOrThrow({ where: { id: uid(q) } });
  if (!(await bcrypt.compare(b.current, u.passwordHash))) throw new HttpError(400, "Trenutna lozinka nije tačna");
  await db.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(b.next, 10) } });
  r.json({ ok: true });
}));

// ---------- pregled ----------
adminRouter.get("/dashboard", wrap(async (_q, r) => {
  const today = formatInTimeZone(new Date(), TZ, "yyyy-MM-dd");
  const monday = addDays(today, -((new Date(today + "T12:00:00Z").getUTCDay() + 6) % 7));
  const include = { customer: true, stylist: true, items: true };
  const map = (a: any) => ({
    id: a.id, startsAt: a.startsAt, status: a.status, customerName: a.customer.name, customerPhone: a.customer.phone,
    stylistName: a.stylist.name, services: a.items.map((i: any) => i.nameSnapshot).join(", "), totalPriceRsd: a.totalPriceRsd,
  });
  const [todayList, upcoming, weekCount, popular] = await Promise.all([
    db.appointment.findMany({ where: { status: { not: "otkazan" }, startsAt: { gte: dayStart(today), lt: dayStart(addDays(today, 1)) } }, include, orderBy: { startsAt: "asc" } }),
    db.appointment.findMany({ where: { status: "zakazan", startsAt: { gte: dayStart(addDays(today, 1)) } }, include, orderBy: { startsAt: "asc" }, take: 10 }),
    db.appointment.count({ where: { status: { not: "otkazan" }, startsAt: { gte: dayStart(monday), lt: dayStart(addDays(monday, 7)) } } }),
    db.appointmentService.groupBy({
      by: ["nameSnapshot"], _count: { _all: true }, take: 5, orderBy: { _count: { nameSnapshot: "desc" } },
      where: { appointment: { status: { in: ["zakazan", "zavrsen"] }, startsAt: { gte: new Date(Date.now() - 30 * 864e5) } } },
    }),
  ]);
  r.json({ today: todayList.map(map), upcoming: upcoming.map(map), weekCount, popular: popular.map((p) => ({ name: p.nameSnapshot, count: p._count._all })) });
}));

// ---------- kategorije i usluge ----------
const cat = z.object({ name: z.string().trim().min(1).max(60), sortOrder: z.number().int().optional() });
adminRouter.get("/categories", wrap(async (_q, r) =>
  r.json(await db.serviceCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }], include: { services: { orderBy: { name: "asc" } } } }))));
adminRouter.post("/categories", wrap(async (q, r) => r.status(201).json(await db.serviceCategory.create({ data: cat.parse(q.body) }))));
adminRouter.put("/categories/:id", wrap(async (q, r) => r.json(await db.serviceCategory.update({ where: { id: pid(q) }, data: cat.parse(q.body) }))));
adminRouter.delete("/categories/:id", wrap(async (q, r) => {
  if (await db.service.count({ where: { categoryId: pid(q) } })) throw new HttpError(409, "Kategorija ima usluge. Prvo ih obrišite.");
  await db.serviceCategory.delete({ where: { id: pid(q) } });
  r.json({ ok: true });
}));

const svc = z.object({
  categoryId: z.number().int(), name: z.string().trim().min(1).max(80), description: z.string().max(300).default(""),
  durationMin: z.number().int().min(5).max(480), priceRsd: z.number().int().min(0).max(1_000_000), stepMin: step, active: z.boolean(),
});
adminRouter.post("/services", wrap(async (q, r) => r.status(201).json(await db.service.create({ data: svc.parse(q.body) }))));
adminRouter.put("/services/:id", wrap(async (q, r) => r.json(await db.service.update({ where: { id: pid(q) }, data: svc.parse(q.body) }))));
adminRouter.delete("/services/:id", wrap(async (q, r) => { await db.service.delete({ where: { id: pid(q) } }); r.json({ ok: true }); }));

// ---------- frizeri ----------
const sty = z.object({
  name: z.string().trim().min(1).max(60), bio: z.string().max(200).default(""),
  photoUrl: z.string().max(500).nullish().transform((v) => v || null), active: z.boolean(),
});
adminRouter.get("/stylists", wrap(async (_q, r) => r.json(await db.stylist.findMany({ orderBy: { id: "asc" }, include: { services: true } }))));
adminRouter.post("/stylists", wrap(async (q, r) => r.status(201).json(await db.stylist.create({ data: sty.parse(q.body) }))));
adminRouter.put("/stylists/:id", wrap(async (q, r) => r.json(await db.stylist.update({ where: { id: pid(q) }, data: sty.parse(q.body) }))));
adminRouter.delete("/stylists/:id", wrap(async (q, r) => {
  if (await db.appointment.count({ where: { stylistId: pid(q) } })) throw new HttpError(409, "Frizer ima istoriju termina. Deaktivirajte ga umesto brisanja.");
  await db.stylist.delete({ where: { id: pid(q) } });
  r.json({ ok: true });
}));
adminRouter.put("/stylists/:id/services", wrap(async (q, r) => {
  const rows = z.array(z.object({ serviceId: z.number().int(), priceRsd: z.number().int().min(0).nullable() })).parse(q.body);
  const stylistId = pid(q);
  await db.$transaction([
    db.stylistService.deleteMany({ where: { stylistId } }),
    db.stylistService.createMany({ data: rows.map((x) => ({ stylistId, ...x })) }),
  ]);
  r.json({ ok: true });
}));

// ---------- radno vreme (owner = "salon" ili ID frizera) ----------
const hoursRow = z.object({
  weekday: z.number().int().min(0).max(6), startMin: z.number().int().min(0).max(1439), endMin: z.number().int().min(1).max(1439),
  breakStartMin: z.number().int().nullable(), breakEndMin: z.number().int().nullable(),
}).refine((h) => h.endMin > h.startMin && (h.breakStartMin == null) === (h.breakEndMin == null) &&
  (h.breakStartMin == null || (h.breakStartMin >= h.startMin && h.breakEndMin! > h.breakStartMin && h.breakEndMin! <= h.endMin)));
const owner = (q: Request) => (q.params.owner === "salon" ? null : z.coerce.number().int().parse(q.params.owner));

adminRouter.get("/hours/:owner", wrap(async (q, r) => r.json(await db.workingHours.findMany({ where: { stylistId: owner(q) }, orderBy: { weekday: "asc" } }))));
adminRouter.put("/hours/:owner", wrap(async (q, r) => {
  const rows = z.array(hoursRow).max(7).parse(q.body);
  if (new Set(rows.map((x) => x.weekday)).size !== rows.length) throw new HttpError(400, "Dan je naveden dvaput");
  const stylistId = owner(q);
  await db.$transaction([
    db.workingHours.deleteMany({ where: { stylistId } }),
    db.workingHours.createMany({ data: rows.map((x) => ({ ...x, stylistId })) }),
  ]);
  r.json({ ok: true });
}));

// ---------- odsustva i praznici ----------
adminRouter.get("/timeoff", wrap(async (q, r) => {
  const s = q.query.stylistId ? z.coerce.number().parse(q.query.stylistId) : null;
  r.json(await db.timeOff.findMany({ where: { stylistId: s, endsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" } }));
}));
adminRouter.post("/timeoff", wrap(async (q, r) => {
  const b = z.object({
    stylistId: z.number().int().nullable(), from: ymd, to: ymd,
    fromTime: hhmm.default("00:00"), toTime: hhmm.default("23:59"), reason: z.string().max(100).default(""),
  }).parse(q.body);
  const startsAt = fromZonedTime(`${b.from}T${b.fromTime}:00`, TZ);
  const endsAt = fromZonedTime(`${b.to}T${b.toTime}:00`, TZ);
  if (endsAt <= startsAt) throw new HttpError(400, "Kraj mora biti posle početka");
  await db.timeOff.create({ data: { stylistId: b.stylistId, startsAt, endsAt, reason: b.reason } });
  const conflicts = await db.appointment.count({
    where: { status: "zakazan", ...(b.stylistId ? { stylistId: b.stylistId } : {}), startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
  });
  r.status(201).json({ conflicts });
}));
adminRouter.delete("/timeoff/:id", wrap(async (q, r) => { await db.timeOff.delete({ where: { id: pid(q) } }); r.json({ ok: true }); }));

adminRouter.get("/holidays", wrap(async (_q, r) =>
  r.json(await db.holiday.findMany({ where: { date: { gte: formatInTimeZone(new Date(), TZ, "yyyy-MM-dd") } }, orderBy: { date: "asc" } }))));
adminRouter.post("/holidays", wrap(async (q, r) => {
  const b = z.object({ date: ymd, name: z.string().max(80).default("") }).parse(q.body);
  await db.holiday.upsert({ where: { date: b.date }, update: { name: b.name }, create: b });
  r.status(201).json({ ok: true });
}));
adminRouter.delete("/holidays/:id", wrap(async (q, r) => { await db.holiday.delete({ where: { id: pid(q) } }); r.json({ ok: true }); }));

// ---------- podešavanja salona ----------
const embed = (v?: string | null) => {
  if (!v) return null;
  const u = v.match(/src=["']([^"']+)["']/)?.[1] ?? v.trim(); // prihvata ceo <iframe> ili samo link
  return u.startsWith("https://www.google.com/maps/embed") ? u : null;
};
const salonZ = z.object({
  name: z.string().trim().min(1).max(80), description: z.string().max(500), address: z.string().max(150),
  phone: z.string().max(30), email: z.string().max(100), logoUrl: z.string().max(500).nullish(),
  mapEmbedUrl: z.string().max(1000).nullish(), accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  cancelHours: z.number().int().min(0).max(168), maxAdvanceDays: z.number().int().min(1).max(365),
  minLeadMin: z.number().int().min(0).max(1440), defaultStepMin: step,
});
adminRouter.get("/salon", wrap(async (_q, r) => r.json(await db.salon.findUniqueOrThrow({ where: { id: 1 } }))));
adminRouter.put("/salon", wrap(async (q, r) => {
  const b = salonZ.parse(q.body);
  const map = embed(b.mapEmbedUrl);
  if (b.mapEmbedUrl && !map) throw new HttpError(400, "Neispravan Google Maps embed link");
  r.json(await db.salon.update({ where: { id: 1 }, data: { ...b, logoUrl: b.logoUrl || null, mapEmbedUrl: map } }));
}));
// ---------- kalendar ----------
const at = (date: string, time: string) => fromZonedTime(`${date}T${time}:00`, TZ);
type Tx = Pick<typeof db, "appointment">;
const clash = (tx: Tx, stylistId: number, s: Date, e: Date, ignoreId?: number) =>
  tx.appointment.findFirst({ where: { stylistId, status: "zakazan", ...(ignoreId ? { id: { not: ignoreId } } : {}), startsAt: { lt: e }, endsAt: { gt: s } } });
const BUSY = "Frizer već ima termin u to vreme.";

adminRouter.get("/calendar", wrap(async (q, r) => {
  const { from, days } = z.object({ from: ymd, days: z.coerce.number().int().min(1).max(7) }).parse(q.query);
  const s = dayStart(from), e = dayStart(addDays(from, days));
  const [stylists, hours, appts, offs] = await Promise.all([
    db.stylist.findMany({ where: { active: true }, orderBy: { id: "asc" }, select: { id: true, name: true } }),
    db.workingHours.findMany({ where: { stylistId: null } }),
    db.appointment.findMany({ where: { status: { not: "otkazan" }, startsAt: { lt: e }, endsAt: { gt: s } }, include: { customer: true, items: true }, orderBy: { startsAt: "asc" } }),
    db.timeOff.findMany({ where: { startsAt: { lt: e }, endsAt: { gt: s } } }),
  ]);
  r.json({
    stylists,
    range: hours.length ? { startMin: Math.min(...hours.map((h) => h.startMin)), endMin: Math.max(...hours.map((h) => h.endMin)) } : { startMin: 480, endMin: 1200 },
    appointments: appts.map((a) => ({
      id: a.id, stylistId: a.stylistId, status: a.status, startsAt: a.startsAt, endsAt: a.endsAt, note: a.note, source: a.source,
      totalPriceRsd: a.totalPriceRsd, totalDurationMin: a.totalDurationMin, customerId: a.customerId, customerName: a.customer.name,
      customerPhone: a.customer.phone, customerNote: a.customer.note, services: a.items.map((i) => i.nameSnapshot),
    })),
    timeOff: offs.map((t) => ({ id: t.id, stylistId: t.stylistId, startsAt: t.startsAt, endsAt: t.endsAt, reason: t.reason })),
  });
}));

adminRouter.post("/appointments", wrap(async (q, r) => {
  const b = z.object({
    serviceIds: z.array(z.number().int()).min(1), stylistId: z.number().int(), date: ymd, time: hhmm,
    name: z.string().trim().min(2).max(80), phone: z.string().max(30),
    email: z.string().email().optional().or(z.literal("")), note: z.string().max(500).default(""),
  }).parse(q.body);
  const phone = normalizePhone(b.phone);
  if (!phone) throw new HttpError(400, "Neispravan broj telefona");
  const svcs = await loadServices(b.serviceIds, b.stylistId);
  const minutes = svcs.reduce((a, x) => a + x.durationMin, 0);
  const startsAt = at(b.date, b.time), endsAt = new Date(+startsAt + minutes * 60_000);
  const a = await db.$transaction(async (tx) => {
    if (await clash(tx, b.stylistId, startsAt, endsAt)) throw new HttpError(409, BUSY);
    const c = await tx.customer.upsert({
      where: { phone }, update: { name: b.name, email: b.email || undefined }, create: { name: b.name, phone, email: b.email || null },
    });
    return tx.appointment.create({ data: {
      customerId: c.id, stylistId: b.stylistId, startsAt, endsAt, totalDurationMin: minutes,
      totalPriceRsd: svcs.reduce((x, s) => x + s.priceRsd, 0), manageToken: randomBytes(24).toString("base64url"),
      shortCode: String(randomInt(100000, 999999)), source: "rucno", note: b.note,
      items: { create: svcs.map((s) => ({ serviceId: s.id, nameSnapshot: s.name, priceRsd: s.priceRsd, durationMin: s.durationMin })) },
    } });
  }, { isolationLevel: "Serializable" });
  if (b.email) void mailAppointment(a.id, "potvrda");
  r.status(201).json({ id: a.id });
}));

adminRouter.put("/appointments/:id", wrap(async (q, r) => {
  const b = z.object({
    status: z.enum(["zakazan", "otkazan", "zavrsen", "nije_dosao"]).optional(), note: z.string().max(500).optional(),
    stylistId: z.number().int().optional(), date: ymd.optional(), time: hhmm.optional(),
  }).parse(q.body);
  const id = pid(q);
  const a = await db.appointment.findUnique({ where: { id } });
  if (!a) throw new HttpError(404, "Termin nije pronađen");
  const startsAt = b.date && b.time ? at(b.date, b.time) : a.startsAt;
  const endsAt = new Date(+startsAt + a.totalDurationMin * 60_000);
  const stylistId = b.stylistId ?? a.stylistId, status = b.status ?? a.status;
  const moved = +startsAt !== +a.startsAt || stylistId !== a.stylistId;
  await db.$transaction(async (tx) => {
    if (status === "zakazan" && (moved || status !== a.status) && (await clash(tx, stylistId, startsAt, endsAt, id))) throw new HttpError(409, BUSY);
    await tx.appointment.update({ where: { id }, data: { status, note: b.note ?? a.note, stylistId, startsAt, endsAt, ...(moved ? { reminderSent: false } : {}) } });
  }, { isolationLevel: "Serializable" });
  if (status === "otkazan" && a.status !== "otkazan") void mailAppointment(id, "otkazan");
  else if (moved && status === "zakazan") void mailAppointment(id, "pomeren");
  r.json({ ok: true });
}));

// ---------- klijenti ----------
adminRouter.get("/customers", wrap(async (q, r) => {
  const s = String(q.query.q ?? "").trim();
  const digits = s.replace(/\D/g, "").replace(/^(381|0)/, "");
  const where: Prisma.CustomerWhereInput = s
  ? { 
      OR: [
        { name: { contains: s } }, 
        ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : [])
      ] 
    }
  : {};
  const list = await db.customer.findMany({ where, take: 50, orderBy: { name: "asc" }, include: { appointments: { select: { startsAt: true, status: true } } } });
  r.json(list.map((c) => {
    const live = c.appointments.filter((a) => a.status !== "otkazan");
    return {
      id: c.id, name: c.name, phone: c.phone, email: c.email, note: c.note, total: live.length,
      done: live.filter((a) => a.status === "zavrsen").length, noShows: live.filter((a) => a.status === "nije_dosao").length,
      last: live.length ? new Date(Math.max(...live.map((a) => +a.startsAt))).toISOString() : null,
    };
  }));
}));
adminRouter.get("/customers/:id", wrap(async (q, r) => {
  const c = await db.customer.findUnique({ where: { id: pid(q) }, include: { appointments: { orderBy: { startsAt: "desc" }, include: { stylist: true, items: true } } } });
  if (!c) throw new HttpError(404, "Klijent nije pronađen");
  r.json({ id: c.id, name: c.name, phone: c.phone, email: c.email ?? "", note: c.note, appointments: c.appointments.map((a) => ({
    id: a.id, startsAt: a.startsAt, status: a.status, stylistName: a.stylist.name, totalPriceRsd: a.totalPriceRsd, services: a.items.map((i) => i.nameSnapshot).join(", "),
  })) });
}));
adminRouter.put("/customers/:id", wrap(async (q, r) => {
  const b = z.object({ name: z.string().trim().min(2).max(80), email: z.string().email().or(z.literal("")), note: z.string().max(1000) }).parse(q.body);
  await db.customer.update({ where: { id: pid(q) }, data: { name: b.name, email: b.email || null, note: b.note } });
  r.json({ ok: true });
}));
// ---------- upload slika ----------
import express from "express"; // premesti na vrh fajla uz ostale importe
adminRouter.post("/upload", express.raw({ type: ["image/webp", "image/jpeg", "image/png"], limit: "1mb" }), wrap(async (q, r) => {
  if (!Buffer.isBuffer(q.body) || q.body.length < 100) throw new HttpError(400, "Neispravna slika");
  const id = randomBytes(12).toString("base64url");
  
  // Zamenjen q.body sa new Uint8Array(q.body)
  await db.image.create({ 
    data: { 
      id, 
      mime: q.headers["content-type"]!, 
      data: new Uint8Array(q.body) 
    } 
  });
  
  r.status(201).json({ url: `/img/${id}` });
}));

// ---------- šabloni mejlova ----------
const tplZ = z.record(z.string(), z.object({ subject: z.string().max(120), intro: z.string().max(600) }));
adminRouter.get("/templates", wrap(async (_q, r) => r.json(JSON.parse((await db.salon.findUniqueOrThrow({ where: { id: 1 } })).emailTemplates))));
adminRouter.put("/templates", wrap(async (q, r) => {
  await db.salon.update({ where: { id: 1 }, data: { emailTemplates: JSON.stringify(tplZ.parse(q.body)) } });
  r.json({ ok: true });
}));