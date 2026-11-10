import { Resend } from "resend";
import { formatInTimeZone } from "date-fns-tz";
import { db, TZ } from "./db.js";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const TITLES = { potvrda: "Termin je zakazan", pomeren: "Termin je pomeren", podsetnik: "Podsetnik: uskoro imate termin", otkazan: "Termin je otkazan" };

const DEFAULT_INTRO: Record<string, string> = {
  potvrda: "Zdravo {ime}, vaš termin je uspešno zakazan.",
  pomeren: "Zdravo {ime}, vaš termin je pomeren.",
  podsetnik: "Zdravo {ime}, podsećamo vas da sutra imate termin.",
  otkazan: "Zdravo {ime}, vaš termin je otkazan.",
};
const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m);

export async function mailAppointment(id: number, kind: keyof typeof TITLES) {
  try {
    const [a, salon] = await Promise.all([
      db.appointment.findUnique({ where: { id }, include: { items: true, stylist: true, customer: true } }),
      db.salon.findUnique({ where: { id: 1 } }),
    ]);
    if (!a?.customer.email || !salon) return;
    const date = formatInTimeZone(a.startsAt, TZ, "dd.MM.yyyy."), time = formatInTimeZone(a.startsAt, TZ, "HH:mm");
    const link = `${process.env.APP_URL}/termin/${a.manageToken}`;
    const tpl = JSON.parse(salon.emailTemplates || "{}")[kind] ?? {};
    const vars = { ime: a.customer.name, datum: date, vreme: time, frizer: a.stylist.name, salon: salon.name };
    const subject = fill(tpl.subject || `${TITLES[kind]} – {salon}`, vars);
    const intro = esc(fill(tpl.intro || DEFAULT_INTRO[kind], vars)).replace(/\n/g, "<br>");
    const html = `<div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2>${TITLES[kind]}</h2><p>${intro}</p>
      <p><b>${date} u ${time}</b><br>Frizer: ${esc(a.stylist.name)}<br>${esc(salon.address)}</p>
      <ul>${a.items.map((i) => `<li>${esc(i.nameSnapshot)}</li>`).join("")}</ul>
      <p>Ukupno: <b>${a.totalPriceRsd.toLocaleString("de-DE")} RSD</b></p>
      ${kind === "otkazan" ? "" : `<p><a href="${link}">Pregled, pomeranje ili otkazivanje termina</a></p><p>Vaš kod: <b>${a.shortCode}</b></p>
      <p style="color:#666">Termin se može otkazati ili pomeriti najkasnije ${salon.cancelHours} h pre početka. Telefon salona: ${esc(salon.phone)}</p>`}
    </div>`;
    if (!resend) { console.log(`\n[MAIL → ${a.customer.email}] ${subject}\n${intro}\n${link}\n`); return; }
    await resend.emails.send({ from: process.env.MAIL_FROM!, to: a.customer.email, subject, html });
  } catch (e) { console.error("Mail greška", e); }
}
