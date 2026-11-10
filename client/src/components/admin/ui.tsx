import { type ReactNode, useState } from "react";

export const inp = "w-full h-11 rounded-xl border border-stone-300 bg-white px-3 text-base";
export const btnP = "h-11 px-4 rounded-xl bg-accent text-white font-semibold disabled:opacity-40";
export const btnS = "h-11 px-4 rounded-xl border border-stone-300 bg-white font-medium disabled:opacity-40";

export const Card = ({ title, children }: { title?: string; children: ReactNode }) => (
  <section className="rounded-2xl bg-white border border-stone-200 p-4 mb-4">
    {title && <h2 className="font-semibold mb-3">{title}</h2>}{children}
  </section>
);
export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block mb-3"><span className="block text-sm mb-1 text-stone-600">{label}</span>{children}</label>
);
export const Msg = ({ err, ok }: { err?: string; ok?: string }) =>
  err ? <p role="alert" className="mb-3 rounded-xl bg-red-50 text-red-700 border border-red-200 p-3 text-sm">{err}</p>
  : ok ? <p role="status" className="mb-3 rounded-xl bg-green-50 text-green-800 border border-green-200 p-3 text-sm">{ok}</p> : null;

export function useStatus() {
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const run = async (fn: () => Promise<unknown>, okMsg = "Sačuvano") => {
    setErr(""); setOk("");
    try { await fn(); setOk(okMsg); return true; } catch (x: any) { setErr(x.message); return false; }
  };
  return { err, ok, run };
}
export const Sheet = ({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) => (
  <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
    <div role="dialog" aria-label={title} className="bg-[#faf7f4] w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-4" onClick={(e) => e.stopPropagation()}>
      <div className="flex justify-between items-center mb-3"><h2 className="font-semibold text-lg">{title}</h2><button aria-label="Zatvori" onClick={onClose} className="size-10 text-2xl">×</button></div>
      {children}
    </div>
  </div>
);