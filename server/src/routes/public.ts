import { Router } from "express";
import { z } from "zod";
import { db } from "../lib/db.js";
import { availability, eligibleStylists } from "../lib/availability.js";
import { createAppointment } from "../lib/booking.js";
import { mailAppointment } from "../lib/mail.js";
export const publicRouter = Router();
const ids = z.string().regex(/^\d+(,\d+)*$/).transform((s) => s.split(",").map(Number));


publicRouter.get("/working-days", async (_q, r) => {
  const [hours, hol] = await Promise.all([
    db.workingHours.findMany({ where: { stylistId: null } }),
    db.holiday.findMany(),
  ]);
  r.json({ hours, holidays: hol.map((h) => h.date) });
});

publicRouter.get("/salon", async (_q, r) => r.json(await db.salon.findUnique({ where: { id: 1 } })));
publicRouter.get("/team", async (_q, r) =>
  r.json(await db.stylist.findMany({ where: { active: true }, orderBy: { id: "asc" }, select: { id: true, name: true, bio: true, photoUrl: true } })));
publicRouter.get("/services", async (_q, r) =>
  r.json(await db.serviceCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: { services: { where: { active: true }, orderBy: { name: "asc" } } },
  })));

publicRouter.get("/stylists", async (q, r) => {
  const serviceIds = ids.parse(q.query.serviceIds);
  r.json(await eligibleStylists(serviceIds));
});

publicRouter.get("/availability", async (q, r) => {
  const p = z.object({
    serviceIds: ids, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    stylistId: z.coerce.number().optional(),
  }).parse(q.query);
  r.json(await availability(p.serviceIds, p.date, p.stylistId));
});

publicRouter.post("/appointments", async (q, r) => {
  const b = z.object({
    serviceIds: z.array(z.number()).min(1), stylistId: z.number().optional(),
    start: z.string().datetime(), name: z.string().trim().min(2).max(80),
    phone: z.string().max(30), email: z.string().email().optional().or(z.literal("")),
    note: z.string().max(500).optional(), website: z.string().max(0).optional(), // honeypot
    consent: z.literal(true),
  }).parse(q.body);
  const a = await createAppointment(b);
  void mailAppointment(a.id, "potvrda");
 r.status(201).json({ manageToken: a.manageToken, shortCode: a.shortCode, startsAt: a.startsAt, endsAt: a.endsAt, stylistName: a.stylist.name });
});