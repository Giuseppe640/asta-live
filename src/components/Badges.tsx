import type { Fascia, Role } from "../types";

const ROLE_COLORS: Record<Role, string> = {
  P: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  D: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  C: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  A: "bg-rose-500/20 text-rose-300 border-rose-500/40",
};

const ROLE_NAMES: Record<Role, string> = {
  P: "Portiere",
  D: "Difensore",
  C: "Centrocampista",
  A: "Attaccante",
};

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      title={ROLE_NAMES[role]}
      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-lg border px-1.5 text-xs font-bold ${ROLE_COLORS[role]}`}
    >
      {role}
    </span>
  );
}

const FASCIA_COLORS: Record<Fascia, string> = {
  S: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40",
  A: "bg-violet-500/20 text-violet-300 border-violet-500/40",
  B: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  C: "bg-slate-500/20 text-slate-300 border-slate-500/40",
  D: "bg-neutral-600/20 text-neutral-400 border-neutral-600/40",
};

const FASCIA_NAMES: Record<Fascia, string> = {
  S: "Livello: top player",
  A: "Livello: molto forte",
  B: "Livello: buono",
  C: "Livello: discreto",
  D: "Livello: economico",
};

export function FasciaBadge({ fascia, uncertain }: { fascia: Fascia; uncertain?: boolean }) {
  return (
    <span
      title={uncertain ? `${FASCIA_NAMES[fascia]} (dato incerto, pochi riferimenti di prezzo)` : FASCIA_NAMES[fascia]}
      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-lg border px-1.5 text-xs font-bold ${FASCIA_COLORS[fascia]}`}
    >
      {fascia}
      {uncertain ? "?" : ""}
    </span>
  );
}

export function ConfidenceDot({ confidence }: { confidence: number }) {
  const color = confidence >= 75 ? "bg-emerald-400" : confidence >= 50 ? "bg-amber-400" : "bg-rose-400";
  return (
    <span title={`Affidabilità della stima: ${confidence}/100`} className="inline-flex items-center gap-1.5 text-xs text-neutral-400">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {confidence}
    </span>
  );
}

export function DemandLabelBadge({ label }: { label: "bassa" | "media" | "alta" }) {
  const styles = {
    bassa: "bg-neutral-700/50 text-neutral-300",
    media: "bg-amber-500/20 text-amber-300",
    alta: "bg-rose-500/20 text-rose-300",
  } as const;
  const titles = {
    bassa: "Poche squadre lo cercano: probabile chiuderlo a un buon prezzo",
    media: "Richiesta nella media",
    alta: "Molte squadre lo cercano: aspettati rilanci",
  } as const;
  return <span title={titles[label]} className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase ${styles[label]}`}>{label}</span>;
}
