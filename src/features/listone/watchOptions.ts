import type { Watch } from "../../types";

export const WATCH_OPTIONS: { value: Watch | undefined; label: string; title: string; className: string }[] = [
  { value: "must", label: "VOGLIO", title: "Da prendere assolutamente: alzo il budget massimo per lui", className: "bg-emerald-600 text-white" },
  { value: undefined, label: "OK", title: "Nessuna preferenza particolare", className: "bg-white/10 text-neutral-200" },
  { value: "no", label: "NO", title: "Non mi interessa: non me lo suggerire come priorità", className: "bg-rose-600 text-white" },
];
