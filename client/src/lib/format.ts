const TZ = "Europe/Belgrade";
export const MONTHS = ["Januar","Februar","Mart","April","Maj","Jun","Jul","Avgust","Septembar","Oktobar","Novembar","Decembar"];
export const WEEKDAYS_SHORT = ["Pon","Uto","Sre","Čet","Pet","Sub","Ned"];
export const WEEKDAYS_LONG = ["Nedelja","Ponedeljak","Utorak","Sreda","Četvrtak","Petak","Subota"]; // indeks = getUTCDay()
export const rsd = (n: number) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} RSD`;
export const dur = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`);
const fmt = (iso: string, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, ...o }).format(new Date(iso));
export const fmtDate = (iso: string) => fmt(iso, { day: "2-digit", month: "2-digit", year: "numeric" }).replaceAll("/", ".") + ".";
export const fmtTime = (iso: string) => fmt(iso, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
export const hm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
export const todayYmd = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
export const addDays = (ymd: string, n: number) => new Date(Date.parse(ymd + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
export const ymdLong = (ymd: string) =>
  `${WEEKDAYS_LONG[new Date(ymd + "T12:00:00Z").getUTCDay()]}, ${ymd.split("-").reverse().join(".")}.`;
export const phoneOk = (s: string) => /^(\+381|00381|0)6\d{7,8}$/.test(s.replace(/[\s\-/()]/g, ""));
export const localYmd = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
export const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
export const minOf = (iso: string) => toMin(fmtTime(iso));
export const mondayOf = (ymd: string) => addDays(ymd, -((new Date(ymd + "T12:00:00Z").getUTCDay() + 6) % 7));