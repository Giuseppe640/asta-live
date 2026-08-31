import { useMemo } from "react";
import { ChevronRight, Radar as RadarIcon, TriangleAlert } from "lucide-react";
import { useAuctionStore } from "../../store/useAuctionStore";
import { computeTeamBudget, defaultNominalForProfile } from "../../store/selectors";
import { ROLES } from "../../lib/constants";
import { ConfidenceDot, DemandLabelBadge, FasciaBadge, RoleBadge } from "../../components/Badges";
import { WATCH_OPTIONS } from "../listone/watchOptions";
import { buildRosterPriorities, buildRadarTargets, type Severity } from "./radarLogic";
import type { Role } from "../../types";

const SEVERITY_STYLES: Record<Severity, string> = {
  high: "border-rose-500/30 bg-rose-500/[0.06]",
  medium: "border-amber-500/30 bg-amber-500/[0.06]",
  low: "border-white/10 bg-white/[0.02]",
};
const SEVERITY_BADGE: Record<Severity, string> = {
  high: "bg-rose-500/15 text-rose-400",
  medium: "bg-amber-500/15 text-amber-400",
  low: "bg-neutral-700/40 text-neutral-400",
};

function roleHealthColor(spent: number, nominal: number): string {
  if (spent > nominal) return "text-rose-400";
  if (nominal > 0 && spent / nominal >= 0.85) return "text-amber-400";
  return "text-emerald-400";
}

export function RadarView() {
  const players = useAuctionStore((s) => s.players);
  const teams = useAuctionStore((s) => s.teams);
  const myTeamId = useAuctionStore((s) => s.myTeamId);
  const requestSelectPlayer = useAuctionStore((s) => s.requestSelectPlayer);

  const myTeam = teams.find((t) => t.id === myTeamId);
  const budget = useMemo(() => (myTeam ? computeTeamBudget(myTeam, players) : null), [myTeam, players]);
  const nominal = myTeam ? defaultNominalForProfile(myTeam.profile) : null;

  const priorities = useMemo(() => buildRosterPriorities(players, teams, myTeamId), [players, teams, myTeamId]);
  const targets = useMemo(() => buildRadarTargets(players, teams, myTeamId, priorities), [players, teams, myTeamId, priorities]);

  if (!myTeam || !budget || !nominal) {
    return <p className="p-4 text-sm text-neutral-500">Squadra non trovata.</p>;
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3 lg:grid lg:grid-cols-[1fr_1.2fr] lg:items-start lg:gap-4 lg:p-4">
      <div className="flex flex-col gap-3">
        <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-3.5 shadow-card">
          <p className="text-sm font-bold text-neutral-100">{myTeam.name}</p>
          <p className="font-display mt-0.5 text-2xl font-extrabold tabular-nums text-neutral-50">{budget.remaining} cr</p>

          <div className="mt-3 grid grid-cols-4 gap-1.5 text-center text-xs">
            {ROLES.map((role) => (
              <div key={role} className="rounded-xl border border-white/5 bg-black/20 p-2">
                <div className="mb-1 flex items-center justify-center">
                  <RoleBadge role={role} />
                </div>
                <p className={`font-display font-bold tabular-nums ${roleHealthColor(budget.spentByRole[role], nominal[role])}`}>
                  {budget.spentByRole[role]}/{nominal[role]}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-2.5 text-xs text-neutral-500">
            cuscino residuo: {budget.capPiano.cushionLeft} cr
            {budget.capPiano.requiresReallocation && (
              <span className="ml-1 font-semibold text-rose-400">· deficit {budget.capPiano.planDeficit} cr</span>
            )}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            slot rimasti: {ROLES.map((r) => `${r} ${{ P: 3, D: 8, C: 8, A: 6 }[r] - budget.ownedCount[r]}`).join(" · ")}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {priorities.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-3.5 text-sm text-neutral-500">
              Rosa completa o senza priorità evidenti al momento.
            </p>
          ) : (
            priorities.map((p, i) => (
              <div key={`${p.role}-${i}`} className={`rounded-2xl border p-3.5 ${SEVERITY_STYLES[p.severity]}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-neutral-100">
                    {i + 1}. {p.title}
                  </p>
                  <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${SEVERITY_BADGE[p.severity]}`}>
                    {p.severity}
                  </span>
                </div>
                <p className="mt-1 text-xs text-neutral-400">{p.reason}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3.5">
        <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-neutral-400">
          <RadarIcon className="h-3.5 w-3.5" />
          Target consigliati
        </h2>

        {targets.length === 0 ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
            Nessun target compatibile trovato tra i liberi.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {targets.map((t) => (
              <li key={t.playerId}>
                <button
                  type="button"
                  onClick={() => requestSelectPlayer(t.playerId)}
                  className="flex w-full items-center gap-2 rounded-xl border border-white/5 bg-black/20 p-2.5 text-left transition-colors active:bg-white/5"
                >
                  <RoleBadge role={t.role as Role} />
                  <FasciaBadge fascia={t.fascia} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-100">{t.name}</p>
                    <p className="truncate text-[11px] text-neutral-500">{t.team}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-sm font-bold tabular-nums text-neutral-100">{t.fairLive != null ? Math.round(t.fairLive) : "—"}</p>
                    <p className="text-[10px] text-neutral-500">mio max {t.personalMax}</p>
                  </div>
                  <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                    <DemandLabelBadge label={t.demandLabel} />
                    <ConfidenceDot confidence={t.confidence} />
                  </div>
                  {t.watch && (
                    <span
                      className={`hidden shrink-0 rounded px-1.5 py-1 text-[10px] font-bold lg:inline-flex ${
                        WATCH_OPTIONS.find((o) => o.value === t.watch)?.className ?? ""
                      }`}
                    >
                      {WATCH_OPTIONS.find((o) => o.value === t.watch)?.label}
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-neutral-600" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
