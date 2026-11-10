import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes, randomInt } from "crypto";
import { fromZonedTime } from "date-fns-tz";
const db = new PrismaClient();
const TZ = "Europe/Belgrade";

const ymd = (o: number) => new Date(Date.now() + o * 864e5).toISOString().slice(0, 10);
const workdays = (dir: 1 | -1, n: number) => {
  const out: string[] = []; let o = dir;
  while (out.length < n) { const d = ymd(o); if (new Date(d + "T12:00:00Z").getUTCDay() !== 0) out.push(d); o += dir; }
  return out;
};

const CATS: [string, [string, number, number, number][]][] = [
  ["Muško šišanje", [["Šišanje", 30, 900, 30], ["Fade", 60, 1500, 60], ["Šišanje + brada", 45, 1300, 30]]],
  ["Brada", [["Oblikovanje brade", 15, 500, 15], ["Brijanje", 30, 700, 30]]],
  ["Žensko šišanje", [["Šišanje i feniranje", 45, 2000, 30], ["Feniranje", 30, 1200, 30]]],
  ["Farbanje", [["Farbanje korena", 90, 3500, 60], ["Pramenovi", 150, 6500, 60]]],
  ["Dečije šišanje", [["Dečije šišanje", 30, 700, 30]]],
];
const STYLISTS = [
  { name: "Marko", bio: "Fade i brada", cats: ["Muško šišanje", "Brada", "Dečije šišanje"] },
  { name: "Jelena", bio: "Farbanje i žensko šišanje", cats: ["Žensko šišanje", "Farbanje", "Dečije šišanje"] },
  { name: "Nikola", bio: "Klasično muško šišanje", cats: ["Muško šišanje", "Brada", "Dečije šišanje"] },
];
const CUSTOMERS: [string, string][] = [["Petar Jovanović", "+381641110001"], ["Ana Ilić", "+381641110002"], ["Stefan Kostić", "+381641110003"], ["Milica Nikolić", "+381641110004"], ["Jovana Petrović", "+381641110005"]];

async function main() {
  for (const m of [db.appointmentService, db.appointment, db.customer, db.stylistService, db.workingHours, db.timeOff, db.holiday, db.stylist, db.service, db.serviceCategory] as any[]) await m.deleteMany();

  const salon = { name: "Salon Lepota", description: "Moderan frizerski salon u centru grada. Zakažite termin online za manje od minuta.",
    address: "Knez Mihailova 10, Beograd", phone: "+381601234567", email: "info@salon-lepota.example", accentColor: "#b4543a", emailTemplates: "{}" };
  await db.salon.upsert({ where: { id: 1 }, update: salon, create: { id: 1, ...salon } });

  const hash = await bcrypt.hash("demo1234", 10);
  await db.user.deleteMany({ where: { email: { not: "demo@salon.rs" } } });
  await db.user.upsert({ where: { email: "demo@salon.rs" }, update: { passwordHash: hash }, create: { email: "demo@salon.rs", passwordHash: hash } });

  const svc = new Map<string, { id: number; name: string; dur: number; price: number; cat: string }>();
  for (const [i, [cat, items]] of CATS.entries()) {
    const c = await db.serviceCategory.create({ data: { name: cat, sortOrder: i } });
    for (const [name, dur, price, step] of items) {
      const s = await db.service.create({ data: { categoryId: c.id, name, durationMin: dur, priceRsd: price, stepMin: step } });
      svc.set(name, { id: s.id, name, dur, price, cat });
    }
  }

  const sty: number[] = [];
  for (const s of STYLISTS) {
    const st = await db.stylist.create({ data: { name: s.name, bio: s.bio } });
    sty.push(st.id);
    await db.stylistService.createMany({ data: [...svc.values()].filter((v) => s.cats.includes(v.cat)).map((v) => ({ stylistId: st.id, serviceId: v.id })) });
    await db.workingHours.createMany({ data: [1, 2, 3, 4, 5, 6].map((d) => ({ stylistId: st.id, weekday: d, startMin: 540, endMin: d === 6 ? 900 : 1200, breakStartMin: 780, breakEndMin: 810 })) });
  }
  await db.workingHours.createMany({ data: [1, 2, 3, 4, 5, 6].map((d) => ({ stylistId: null, weekday: d, startMin: 540, endMin: d === 6 ? 900 : 1200 })) });
  const inWeeks = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
  await db.holiday.create({ data: { date: inWeeks, name: "Neradni dan (primer)" } });

  const cust: number[] = [];
  for (const [name, phone] of CUSTOMERS) cust.push((await db.customer.create({ data: { name, phone, note: name.startsWith("Ana") ? "Preosetljiva koža glave" : "" } })).id);

  const [f0, f1, f2, f3] = workdays(1, 4), [p0, p1] = workdays(-1, 2);
  // [datum, vreme, frizer, [usluge], klijent, status]
  const list: [string, string, number, string[], number, string][] = [
    [p0, "10:00", 0, ["Šišanje"], 0, "zavrsen"], [p0, "11:00", 1, ["Feniranje"], 1, "zavrsen"],
    [p1, "09:30", 2, ["Fade"], 2, "nije_dosao"], [p1, "11:00", 0, ["Brijanje"], 0, "zavrsen"],
    [f0, "10:00", 0, ["Fade"], 0, "zakazan"], [f0, "11:00", 1, ["Šišanje i feniranje"], 1, "zakazan"],
    [f1, "09:30", 0, ["Šišanje + brada"], 2, "zakazan"], [f1, "10:30", 1, ["Farbanje korena"], 3, "zakazan"], [f1, "11:00", 2, ["Dečije šišanje"], 1, "zakazan"],
    [f2, "10:00", 2, ["Brijanje"], 0, "zakazan"], [f2, "09:00", 1, ["Pramenovi"], 4, "zakazan"],
    [f3, "12:00", 0, ["Šišanje"], 2, "zakazan"],
  ];
  if (new Date().getUTCDay() !== 0) list.push([ymd(0), "11:00", 0, ["Šišanje"], 4, "zakazan"], [ymd(0), "12:00", 1, ["Feniranje"], 3, "zakazan"]);

  for (const [date, time, si, names, ci, status] of list) {
    const items = names.map((n) => svc.get(n)!);
    const dur = items.reduce((a, x) => a + x.dur, 0);
    const startsAt = fromZonedTime(`${date}T${time}:00`, TZ);
    await db.appointment.create({ data: {
      customerId: cust[ci], stylistId: sty[si], status, startsAt, endsAt: new Date(+startsAt + dur * 60_000),
      totalDurationMin: dur, totalPriceRsd: items.reduce((a, x) => a + x.price, 0),
      manageToken: randomBytes(24).toString("base64url"), shortCode: String(randomInt(100000, 999999)), source: "online",
      items: { create: items.map((x) => ({ serviceId: x.id, nameSnapshot: x.name, priceRsd: x.price, durationMin: x.dur })) },
    } });
  }
  console.log("Demo podaci su spremni. Admin: demo@salon.rs / demo1234");
}
main().finally(() => db.$disconnect());