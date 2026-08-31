import { FASCIA_ORDER, ROLES } from "../../lib/constants";
import { fasciaAtLeast } from "../../lib/demand";
import { computeLivePricing, computeTeamBudget } from "../../store/selectors";
import { computeRoleFasciaDemand } from "../rivali/rivaliLogic";
import type { DemandLabel, FantasyTeam, Fascia, Player, Role, Watch } from "../../types";

const ROLE_NAMES: Record<Role, string> = { P: "Portiere", D: "Difensore", C: "Centrocampista", A: "Attaccante" };

export type Severity = "low" | "medium" | "high";

export interface Priority {
  role: Role;
  level?: Fascia;
  severity: Severity;
  title: string;
  reason: string;
  action?: "wait" | "buy" | "watch";
}

function bestOwnedFascia(role: Role, roster: { role: Role; fascia: Fascia }[]): Fascia | null {
  let best: Fascia | null = null;
  for (const p of roster) {
    if (p.role !== role) continue;
    if (!best || FASCIA_ORDER.indexOf(p.fascia) > FASCIA_ORDER.indexOf(best)) best = p.fascia;
  }
  return best;
}

/**
 * §4 del prompt Radar: deterministica, nessuna chiamata AI. Usa solo dati già calcolati dal
 * motore (fasce, domanda per ruolo/fascia, slot/cap_piano) — non introduce nuovi coefficienti
 * economici, "VOGLIO/OK/NO" non altera questa logica.
 */
export function buildRosterPriorities(players: Player[], teams: FantasyTeam[], myTeamId: string): Priority[] {
  const myTeam = teams.find((t) => t.id === myTeamId);
  if (!myTeam) return [];

  const playerById = new Map(players.map((p) => [p.id, p]));
  const myRoster = myTeam.roster
    .map((r) => playerById.get(r.playerId))
    .filter((p): p is Player => p != null)
    .map((p) => ({ role: p.role, fascia: p.fascia }));

  const budget = computeTeamBudget(myTeam, players);

  const candidates: Priority[] = [];

  for (const role of ROLES) {
    const ownedInRole = budget.ownedCount[role];
    const roleSlotsTotal = { P: 3, D: 8, C: 8, A: 6 }[role];
    const slotsLeftRole = roleSlotsTotal - ownedInRole;
    if (slotsLeftRole <= 0) continue; // reparto già completo: nessuna priorità, non va sovraprioritizzato

    const owned = bestOwnedFascia(role, myRoster);
    // punto più in alto se ho già una base decente (B+), altrimenti il target resta B come soglia minima ragionevole
    const targetFascia: Fascia = owned && fasciaAtLeast(owned, "B") ? "A" : "B";

    const demand = computeRoleFasciaDemand(players, teams, role, targetFascia);
    const wellCovered = owned != null && fasciaAtLeast(owned, "A");
    const scarce = demand.supply <= slotsLeftRole * 2; // poca scelta rispetto a quanti slot mi restano

    let severity: Severity;
    if (!wellCovered && (scarce || demand.demandLabel === "alta")) severity = "high";
    else if (!wellCovered || demand.demandLabel !== "bassa") severity = "medium";
    else severity = "low";

    const action: Priority["action"] = severity === "high" ? "buy" : severity === "medium" ? "watch" : "wait";

    const title = owned == null ? `${ROLE_NAMES[role].toUpperCase()} DA IMPOSTARE` : severity === "high" ? `${ROLE_NAMES[role].toUpperCase()} DI QUALITÀ` : `COMPLETARE ${ROLE_NAMES[role].toUpperCase()}`;

    const reason =
      `Ti restano ${slotsLeftRole} slot ${role}` +
      (owned ? `, migliore fascia presa finora: ${owned}` : ", nessuno ancora preso") +
      `. ${demand.supply} liberi in fascia ${targetFascia}+, domanda ${demand.demandLabel}.` +
      (scarce ? " Scarsità concreta." : "");

    candidates.push({ role, level: targetFascia, severity, title, reason, action });
  }

  const severityRank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  candidates.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  return candidates.slice(0, 3);
}

export interface RadarTarget {
  playerId: string;
  name: string;
  team: string;
  role: Role;
  fascia: Fascia;
  fairLive: number | null;
  personalMax: number;
  demandLabel: DemandLabel;
  confidence: number;
  watch: Watch | undefined;
}

/** Shortlist di massimo `limit` giocatori liberi compatibili con le priorità correnti, prezzo live incluso. */
export function buildRadarTargets(players: Player[], teams: FantasyTeam[], myTeamId: string, priorities: Priority[], limit = 8): RadarTarget[] {
  const seen = new Set<string>();
  const candidates: Player[] = [];

  for (const priority of priorities) {
    for (const p of players) {
      if (p.assignedTo != null || p.role !== priority.role) continue;
      if (priority.level && !fasciaAtLeast(p.fascia, priority.level)) continue;
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      candidates.push(p);
    }
  }

  candidates.sort((a, b) => (b.pricing.fairSeed ?? 0) - (a.pricing.fairSeed ?? 0));

  return candidates.slice(0, limit).map((p) => {
    const live = computeLivePricing(players, teams, p.id, myTeamId);
    return {
      playerId: p.id,
      name: p.name,
      team: p.team,
      role: p.role,
      fascia: p.fascia,
      fairLive: live?.fairLive ?? null,
      personalMax: live?.personalMax ?? 0,
      demandLabel: live?.demand.demandLabel ?? "media",
      confidence: p.pricing.confidence,
      watch: p.watch,
    };
  });
}
