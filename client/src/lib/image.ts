import { api } from "./api";

async function shrink(file: File, max = 800): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("Slika se ne može obraditi"))), "image/webp", 0.85));
}

export async function uploadImage(file: File): Promise<string> {
  const blob = await shrink(file);
  const r = await fetch("/api/admin/upload", { method: "POST", body: blob, headers: { "Content-Type": "image/webp" }, credentials: "include" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? "Upload nije uspeo");
  return d.url;
}