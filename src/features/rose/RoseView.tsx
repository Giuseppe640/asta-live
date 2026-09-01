import { useMemo, useState } from "react";
import { ChevronDown, Sparkles, TriangleAlert, X } from "lucide-react";
import { useAuctionStore } from "../../store/useAuctionStore";
import { computeTeamBudget } from "../../store/selectors";
import { ROLES } from "../../lib/constants";
import { RoleBadge } from "../../components/Badges";
import type { TeamProfile } from "../../types";

const PROFILE_LABELS: Record<TeamProfile, string> = {
  balanced_md: "Equilibrata MD forte",
  super_forward: "Super attaccante",
  depth: "Profondità / no super",
  custom: "Custom (riallocare)",
};

export function RoseView() {
  const players = useAuctionStore((s) => s.players);
  const teams = useAuctionStore((s) => s.teams);
  const myTeamId = useAuctionStore((s) => s.myTeamId);
  const setTeamProfile = useAuctionStore((s) => s.setTeamProfile);
  const unassignPlayer = useAuctionStore((s) => s.unassignPlayer);

  const [expanded, setExpanded] = useState<string | null>(myTeamId);
  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const orderedTeams = useMemo(() => {
    return [...teams].sort((a, b) => (a.id === myTeamId ? -1 : b.id === myTeamId ? 1 : 0));
  }, [teams, myTeamId]);

  return (
    <div className="flex h-full flex-col gap-2.5 overflow-y-auto p-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3 xl:grid-cols-3 2xl:grid-cols-4">
      {orderedTeams.map((team) => {
        const budget = computeTeamBudget(team, players);
        const isOpen = expanded === team.id;
        const isMine = team.id === myTeamId;
        return (
          <div
            key={team.id}
            className={`min-w-0 rounded-2xl border shadow-card transition-colors ${
              isMine ? "border-brand-500/30 bg-brand-500/[0.06]" : "border-white/10 bg-neutral-900/60"
            } ${isOpen ? "lg:col-span-full" : ""}`}
          >
            {/* overflow-hidden va su un wrapper interno, non sul grid item: su Chrome un grid item con overflow-hidden viene misurato come alto 0 per il sizing delle righe "auto", facendo iniziare la riga successiva troppo presto e sovrapporsi al contenuto */}
            <div className="overflow-hidden rounded-2xl">
            <button type="button" onClick={() => setExpanded(isOpen ? null : team.id)} className="flex w-full items-center gap-2.5 p-3.5 text-left">
              <span className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white/10" style={{ backgroundColor: team.color }} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate text-sm font-semibold text-neutral-100">
                  {team.name}
                  {isMine && <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand-400" />}
                </p>
                {team.president && <p className="truncate text-[11px] text-neutral-500">{team.president}</p>}
                <p className="text-xs text-neutral-500">
                  {team.roster.length}/25 · speso {budget.spent} · rimasti {budget.remaining}
                </p>
              </div>
              <div
                className="text-right"
                title="Il massimo che questa squadra può offrire per UN giocatore, senza poi restare senza crediti per completare la rosa"
              >
                <p className="font-display text-lg font-bold tabular-nums text-neutral-100">{budget.legalMax}</p>
                <p className="text-[10px] uppercase tracking-wide text-neutral-500">tetto per 1</p>
              </div>
              <ChevronDown className={`h-4 w-4 shrink-0 text-neutral-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {budget.capPiano.requiresReallocation && (
              <p className="mx-3.5 mb-2.5 flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-2.5 py-1.5 text-xs font-semibold text-rose-400">
                <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                budget sforato — servono {budget.capPiano.planDeficit} crediti in più di quelli previsti, vanno spostati da un altro reparto
              </p>
            )}
            {budget.rosterUnclosable && (
              <p className="mx-3.5 mb-2.5 flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-2.5 py-1.5 text-xs font-semibold text-rose-400">
                <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                rischio di restare con slot vuoti e zero crediti: rallenta con gli acquisti
              </p>
            )}

            {isOpen && (
              <div className="animate-fade-in-up border-t border-white/5 p-3.5">
                {isMine && (
                  <>
                    <p className="mb-1.5 text-[11px] text-neutral-500">Come vuoi dividere i crediti tra i reparti:</p>
                    <select
                      value={team.profile}
                      onChange={(e) => setTeamProfile(team.id, e.target.value as TeamProfile)}
                      className="mb-3.5 h-10 w-full rounded-xl border border-white/10 bg-black/30 px-2 text-sm text-neutral-200 outline-none focus:border-brand-500/50"
                    >
                      {(["balanced_md", "super_forward", "depth"] as const).map((p) => (
                        <option key={p} value={p}>
                          {PROFILE_LABELS[p]}
                        </option>
                      ))}
                      {team.profile === "custom" && <option value="custom">{PROFILE_LABELS.custom}</option>}
                    </select>
                  </>
                )}

                <p className="mb-1.5 text-[11px] text-neutral-500">Giocatori presi e budget ancora disponibile, reparto per reparto:</p>
                <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                  {ROLES.map((role) => (
                    <div key={role} className="rounded-xl border border-white/5 bg-black/20 p-2">
                      <div className="mb-1 flex items-center justify-center">
                        <RoleBadge role={role} />
                      </div>
                      <p className="text-neutral-400">
                        {budget.ownedCount[role]}/{{ P: 3, D: 8, C: 8, A: 6 }[role]}
                      </p>
                      <p className="font-display font-semibold text-neutral-100" title="Budget ancora previsto per questo reparto">
                        {budget.capPiano.capPiano[role]} cr
                      </p>
                      {budget.capPiano.holes[role] > 0 && (
                        <p className="text-rose-400" title="Hai speso più del previsto in questo reparto">
                          sforato di {budget.capPiano.holes[role]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <p className="mt-2.5 text-xs text-neutral-500" title="Margine extra tenuto da parte per gli imprevisti, condiviso tra tutti i reparti">
                  margine di sicurezza rimasto: {budget.capPiano.cushionLeft} cr
                </p>

                <ul className="mt-3 divide-y divide-white/5">
                  {team.roster
                    .map((r) => ({ entry: r, player: playerById.get(r.playerId) }))
                    .filter((x) => x.player)
                    .sort((a, b) => b.entry.price - a.entry.price)
                    .map(({ entry, player }) => (
                      <li key={entry.playerId} className="flex items-center gap-2 py-2 text-sm">
                        <RoleBadge role={player!.role} />
                        <span className="min-w-0 flex-1 truncate text-neutral-200">{player!.name}</span>
                        <span className="font-display tabular-nums text-neutral-400">{entry.price}</span>
                        <button
                          type="button"
                          title={`Togli ${player!.name} da ${team.name}: torna libero per l'asta`}
                          onClick={() => {
                            if (window.confirm(`Togliere ${player!.name} da ${team.name}? Torna libero per l'asta.`)) {
                              unassignPlayer(entry.playerId);
                            }
                          }}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  {team.roster.length === 0 && <li className="py-3 text-center text-xs text-neutral-600">Nessun giocatore ancora</li>}
                </ul>
              </div>
            )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
