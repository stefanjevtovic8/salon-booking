export type Service = { id: number; categoryId: number; name: string; description: string; durationMin: number; priceRsd: number; stepMin: number };
export type Category = { id: number; name: string; services: Service[] };
export type Stylist = { id: number; name: string; photoUrl: string | null; bio: string };
export type Slot = { start: string; label: string; stylistIds: number[] };
export type Salon = { name: string; description: string; address: string; phone: string; email: string; logoUrl: string | null; mapEmbedUrl: string | null; accentColor: string; cancelHours: number; maxAdvanceDays: number };
export type WorkingDays = { hours: { weekday: number; startMin: number; endMin: number }[]; holidays: string[] };

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch("/api" + path, { ...init, headers: { "Content-Type": "application/json" }, credentials: "include" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error ?? "Došlo je do greške, pokušajte ponovo.");
  return data;
}
export type ManageData = {
  status: string; startsAt: string; endsAt: string; stylistName: string; totalPriceRsd: number; totalDurationMin: number;
  shortCode: string; items: { name: string; priceRsd: number; durationMin: number }[]; canChange: boolean;
  cancelHours: number; salonPhone: string; salonName: string; salonAddress: string; maxAdvanceDays: number;
};
export const send = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });