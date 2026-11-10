import { db } from "./db.js";
import { mailAppointment } from "./mail.js";

const H24 = 24 * 3_600_000;

export function startReminders() {
  const run = async () => {
    try {
      const now = Date.now();
      const list = await db.appointment.findMany({
        where: { status: "zakazan", reminderSent: false, startsAt: { gt: new Date(now), lte: new Date(now + H24) } },
      });
      for (const a of list) {
        await db.appointment.update({ where: { id: a.id }, data: { reminderSent: true } }); // prvo označi, da nikad ne pošalje dvaput
        if (+a.startsAt - +a.createdAt >= H24) await mailAppointment(a.id, "podsetnik");
      }
    } catch (e) { console.error("Podsetnici", e); }
  };
  run();
  setInterval(run, 10 * 60_000);
}