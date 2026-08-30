import { useMemo, useState } from "react";
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

  const [expanded, setExpanded] = useState<string | null>(myTeamId);
  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const orderedTeams = useMemo(() => {
    return [...teams].sort((a, b) => (a.id === myTeamId ? -1 : b.id === myTeamId ? 1 : 0));
  }, [teams, myTeamId]);

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      {orderedTeams.map((team) => {
        const budget = computeTeamBudget(team, players);
        const isOpen = expanded === team.id;
        return (
          <div key={team.id} className="rounded-xl border border-neutral-800 bg-neutral-900">
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : team.id)}
              className="flex w-full items-center gap-2.5 p-3 text-left"
            >
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: team.color }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-100">
                  {team.name}
                  {team.id === myTeamId ? " · tu" : ""}
                </p>
                <p className="text-xs text-neutral-500">
                  {team.roster.length}/25 · speso {budget.spent} · rimasti {budget.remaining}
                </p>
              </div>
              <div className="text-right" title="Il massimo che questa squadra può offrire per UN giocatore, senza poi restare senza crediti per completare la rosa">
                <p className="text-lg font-bold tabular-nums text-neutral-100">{budget.legalMax}</p>
                <p className="text-[10px] uppercase text-neutral-500">tetto per 1 giocatore</p>
              </div>
            </button>

            {budget.capPiano.requiresReallocation && (
              <p className="mx-3 mb-2 rounded bg-rose-500/10 px-2 py-1 text-xs font-semibold text-rose-400">
                ⚠ budget sforato — servono {budget.capPiano.planDeficit} crediti in più di quelli previsti, vanno spostati da un altro reparto
              </p>
            )}
            {budget.rosterUnclosable && (
              <p className="mx-3 mb-2 rounded bg-rose-500/10 px-2 py-1 text-xs font-semibold text-rose-400">
                ⚠ rischio di restare con slot vuoti e zero crediti: rallenta con gli acquisti
              </p>
            )}

            {isOpen && (
              <div className="border-t border-neutral-800 p-3">
                {team.id === myTeamId && (
                  <>
                    <p className="mb-1 text-[11px] text-neutral-500">Come vuoi dividere i crediti tra i reparti:</p>
                    <select
                      value={team.profile}
                      onChange={(e) => setTeamProfile(team.id, e.target.value as TeamProfile)}
                      className="mb-3 h-10 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 text-sm text-neutral-200"
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

                <p className="mb-1 text-[11px] text-neutral-500">Giocatori presi e budget ancora disponibile, reparto per reparto:</p>
                <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                  {ROLES.map((role) => (
                    <div key={role} className="rounded-lg bg-neutral-950 p-2">
                      <div className="mb-1 flex items-center justify-center">
                        <RoleBadge role={role} />
                      </div>
                      <p className="text-neutral-400">
                        {budget.ownedCount[role]}/{{ P: 3, D: 8, C: 8, A: 6 }[role]}
                      </p>
                      <p className="font-semibold text-neutral-100" title="Budget ancora previsto per questo reparto">
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

                <p className="mt-2 text-xs text-neutral-500" title="Margine extra tenuto da parte per gli imprevisti, condiviso tra tutti i reparti">
                  margine di sicurezza rimasto: {budget.capPiano.cushionLeft} cr
                </p>

                <ul className="mt-3 divide-y divide-neutral-800">
                  {team.roster
                    .map((r) => ({ entry: r, player: playerById.get(r.playerId) }))
                    .filter((x) => x.player)
                    .sort((a, b) => b.entry.price - a.entry.price)
                    .map(({ entry, player }) => (
                      <li key={entry.playerId} className="flex items-center gap-2 py-1.5 text-sm">
                        <RoleBadge role={player!.role} />
                        <span className="flex-1 truncate text-neutral-200">{player!.name}</span>
                        <span className="tabular-nums text-neutral-400">{entry.price}</span>
                      </li>
                    ))}
                  {team.roster.length === 0 && <li className="py-2 text-center text-xs text-neutral-600">Nessun giocatore ancora</li>}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
