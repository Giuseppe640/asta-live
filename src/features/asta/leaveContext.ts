import { FASCIA_ORDER } from "../../lib/constants";
import { fasciaAtLeast } from "../../lib/demand";
import { computeLivePricing } from "../../store/selectors";
import { computeRoleFasciaDemand } from "../rivali/rivaliLogic";
import type { FantasyTeam, Player } from "../../types";

export interface PlayerSummary {
  playerId: string;
  name: string;
  team: string;
  fairLive: number | null;
}

export type Scarcity = "low" | "medium" | "high";

export interface LeavePlayerContext {
  comparablePlayers: PlayerSummary[];
  comparableCount: number;
  demandersCount: number;
  scarcity: Scarcity;
  message: string;
}

/**
 * §10-11 del prompt Radar/Rivali: "Se lo lascio" — solo informazione decisionale, non tocca
 * personalMax/fairLive del giocatore chiamato. Comparabili = stesso ruolo, fascia pari o
 * immediatamente inferiore a quella del giocatore, ordinati per fair_seed.
 */
export function getLeavePlayerContext(playerId: string, players: Player[], teams: FantasyTeam[], myTeamId: string): LeavePlayerContext | null {
  const player = players.find((p) => p.id === playerId);
  if (!player) return null;

  const idx = FASCIA_ORDER.indexOf(player.fascia);
  const minFascia = FASCIA_ORDER[Math.max(0, idx - 1)];

  const comparablePool = players
    .filter((p) => p.assignedTo == null && p.id !== playerId && p.role === player.role && fasciaAtLeast(p.fascia, minFascia))
    .sort((a, b) => (b.pricing.fairSeed ?? 0) - (a.pricing.fairSeed ?? 0));

  const top = comparablePool.slice(0, 4).map((p) => {
    const live = computeLivePricing(players, teams, p.id, myTeamId);
    return { playerId: p.id, name: p.name, team: p.team, fairLive: live?.fairLive ?? p.pricing.fairSeed };
  });

  const demand = computeRoleFasciaDemand(players, teams, player.role, player.fascia);
  const comparableCount = comparablePool.length;
  const demandersCount = demand.demanders;

  let scarcity: Scarcity;
  if (comparableCount <= 1) scarcity = "high";
  else if (comparableCount <= 3 || demandersCount > comparableCount) scarcity = "medium";
  else scarcity = "low";

  const message =
    scarcity === "high"
      ? `Resta${comparableCount === 1 ? " solo 1 giocatore" : "no pochissimi giocatori"} di fascia ${player.fascia}+ liberi, ${demandersCount} squadre devono ancora coprire il livello.`
      : `Restano ${comparableCount} alternative comparabili, ${demandersCount} squadre interessate a questo livello.`;

  return { comparablePlayers: top, comparableCount, demandersCount, scarcity, message };
}
