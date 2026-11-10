export function downloadIcs(a: { start: string; end: string; title: string; location: string }) {
  const f = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (s: string) => s.replace(/[,;]/g, (m) => "\\" + m);
  const body = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Salon//SR","BEGIN:VEVENT",
    `UID:${f(a.start)}-${Math.random().toString(36).slice(2)}@salon`, `DTSTAMP:${f(new Date().toISOString())}`,
    `DTSTART:${f(a.start)}`, `DTEND:${f(a.end)}`, `SUMMARY:${esc(a.title)}`, `LOCATION:${esc(a.location)}`,
    "END:VEVENT","END:VCALENDAR"].join("\r\n");
  const url = URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
  const el = document.createElement("a");
  el.href = url; el.download = "termin.ics"; el.click();
  URL.revokeObjectURL(url);
}