import { FASCIA_ORDER, ROLE_SLOTS } from "../../lib/constants";
import { computeDemand, type DemandFreePlayer, type DemandResult } from "../../lib/demand";
import { buildDemandTeams, bucketKey, computeMarketBuckets, computeTeamBudget } from "../../store/selectors";
import type { FantasyTeam, Fascia, Player, Role } from "../../types";

/**
 * §2 Rivali del prompt "Radar/Rivali/Data Health": nessun motore nuovo, solo lettura di
 * computeTeamBudget/computeDemand già esistenti in prospettiva "una squadra alla volta".
 */
export interface RivalSummary {
  teamId: string;
  teamName: string;
  teamColor: string;
  remaining: number;
  legalMax: number;
  ownedCount: Record<Role, number>;
  openSlots: Record<Role, number>;
  bestFasciaByRole: Partial<Record<Role, Fascia>>;
}

function bestFasciaByRole(team: FantasyTeam, playerById: Map<string, Player>): Partial<Record<Role, Fascia>> {
  const best: Partial<Record<Role, Fascia>> = {};
  for (const entry of team.roster) {
    const p = playerById.get(entry.playerId);
    if (!p) continue;
    const current = best[p.role];
    if (!current || FASCIA_ORDER.indexOf(p.fascia) > FASCIA_ORDER.indexOf(current)) {
      best[p.role] = p.fascia;
    }
  }
  return best;
}

/** Riepilogo di ogni squadra avversaria (esclude `myTeamId`) — la matrice generale di Rivali. */
export function computeRivalSummaries(teams: FantasyTeam[], players: Player[], myTeamId: string): RivalSummary[] {
  const playerById = new Map(players.map((p) => [p.id, p]));
  return teams
    .filter((t) => t.id !== myTeamId)
    .map((t) => {
      const budget = computeTeamBudget(t, players);
      const openSlots: Record<Role, number> = {
        P: ROLE_SLOTS.P - budget.ownedCount.P,
        D: ROLE_SLOTS.D - budget.ownedCount.D,
        C: ROLE_SLOTS.C - budget.ownedCount.C,
        A: ROLE_SLOTS.A - budget.ownedCount.A,
      };
      return {
        teamId: t.id,
        teamName: t.name,
        teamColor: t.color,
        remaining: budget.remaining,
        legalMax: budget.legalMax,
        ownedCount: budget.ownedCount,
        openSlots,
        bestFasciaByRole: bestFasciaByRole(t, playerById),
      };
    });
}

/** Stessa `computeDemand` di sempre, ma per un ruolo/fascia scelti a mano (non per un giocatore chiamato). */
export function computeRoleFasciaDemand(players: Player[], teams: FantasyTeam[], role: Role, fascia: Fascia): DemandResult {
  const buckets = computeMarketBuckets(players);
  const freePlayers: DemandFreePlayer[] = players
    .filter((p) => p.assignedTo == null && p.role === role)
    .map((p) => ({
      role: p.role,
      fascia: p.fascia,
      baseLive: (p.pricing.fairSeed ?? 0) * (buckets.get(bucketKey(p.role, p.fascia))?.inflationLive ?? 1),
    }));
  const demandTeams = buildDemandTeams(players, teams);
  return computeDemand({ role, fascia, teams: demandTeams, freePlayers });
}

export type PressureLevel = "bassa" | "media" | "alta";

/**
 * Etichetta descrittiva, non un moltiplicatore: quanto è "pronta a competere" una squadra su
 * un ruolo/fascia, dedotta solo da legalMax vs la soglia (pavimentoFascia) che il motore
 * domanda usa già per decidere chi è un demander. Non tocca fairLive/personalMax.
 */
export function computePressureLevel(legalMax: number, isDemander: boolean, pavimentoFascia: number): PressureLevel {
  if (!isDemander) return "bassa";
  const ratio = legalMax / Math.max(pavimentoFascia, 1);
  if (ratio >= 2) return "alta";
  if (ratio >= 1.2) return "media";
  return "bassa";
}
