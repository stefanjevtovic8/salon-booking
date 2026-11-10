import { useState } from "react";
import { uploadImage } from "../../lib/image";
import { btnS } from "./ui";

export default function ImageField({ value, onChange, label }: { value: string; onChange: (u: string) => void; label: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function pick(f?: File) {
    if (!f) return;
    setBusy(true); setErr("");
    try { onChange(await uploadImage(f)); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  return (
    <div className="mb-3">
      <span className="block text-sm mb-1 text-stone-600">{label}</span>
      <div className="flex items-center gap-3">
        {value ? <img src={value} alt="" className="size-16 rounded-xl object-cover border border-stone-200" /> : <div className="size-16 rounded-xl bg-stone-100 border border-dashed border-stone-300" />}
        <label className={btnS + " grid place-items-center cursor-pointer"}>{busy ? "Otpremanje…" : value ? "Zameni sliku" : "Izaberi sliku"}
          <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => pick(e.target.files?.[0])} /></label>
        {value && <button type="button" className="underline text-red-700" onClick={() => onChange("")}>ukloni</button>}
      </div>
      {err && <p role="alert" className="text-sm text-red-700 mt-1">{err}</p>}
    </div>
  );
}