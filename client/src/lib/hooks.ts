import { useEffect, useState } from "react";
import { api, type Salon } from "./api";

let cache: Promise<Salon> | null = null;
export function useSalon() {
  const [s, setS] = useState<Salon | null>(null);
  useEffect(() => {
    cache ??= api<Salon>("/salon");
    cache.then((x) => { setS(x); document.documentElement.style.setProperty("--accent", x.accentColor); });
  }, []);
  return s;
}