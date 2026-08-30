import {
  BUDGET_PRESSURE_MAX,
  BUDGET_PRESSURE_MIN,
  COVERAGE_RATIO_MAX,
  COVERAGE_RATIO_MIN,
  DEMAND_MULT_MAX,
  DEMAND_MULT_MIN,
  FASCIA_ORDER,
} from "./constants";
import { clamp, median, percentile } from "./stats";
import type { DemandLabel, Fascia, Role } from "../types";

export function fasciaAtLeast(fascia: Fascia, min: Fascia): boolean {
  return FASCIA_ORDER.indexOf(fascia) >= FASCIA_ORDER.indexOf(min);
}

export interface DemandFreePlayer {
  role: Role;
  fascia: Fascia;
  baseLive: number;
}

export interface DemandTeamRosterEntry {
  role: Role;
  fasciaSeed: Fascia;
}

export interface DemandTeam {
  id: string;
  openSlots: Record<Role, number>;
  legalMax: number;
  roster: DemandTeamRosterEntry[];
}

export interface DemandInput {
  role: Role;
  fascia: Fascia;
  teams: DemandTeam[];
  freePlayers: DemandFreePlayer[];
}

export interface DemandResult {
  demandMult: number;
  demandLabel: DemandLabel;
  demanders: number;
  supply: number;
  coverageRatio: number;
  budgetPressure: number;
  rawDemand: number;
  nEff: number;
  demandConfidence: number;
  pavimentoFascia: number;
}

function demandLabelFor(demandMult: number): DemandLabel {
  if (demandMult < 0.98) return "bassa";
  if (demandMult <= 1.08) return "media";
  return "alta";
}

/**
 * §2.5 — domanda: un solo moltiplicatore, formula congelata.
 * Usa sempre base_live (fair_seed × inflation_live), mai fair_live: niente circolo.
 */
export function computeDemand(input: DemandInput): DemandResult {
  const { role, fascia, teams, freePlayers } = input;

  const comparablePool = freePlayers.filter((p) => p.role === role && fasciaAtLeast(p.fascia, fascia));
  const comparableBaseLive = comparablePool.map((p) => p.baseLive);
  const pavimentoFascia = Math.max(1, percentile(comparableBaseLive, 25));
  const supply = comparablePool.length;

  const isHighFascia = fascia === "S" || fascia === "A";

  const demanders = teams.filter((t) => {
    if ((t.openSlots[role] ?? 0) <= 0) return false;
    if (t.legalMax < pavimentoFascia) return false;
    if (isHighFascia) {
      const alreadyCovered = t.roster.some((r) => r.role === role && fasciaAtLeast(r.fasciaSeed, fascia));
      if (alreadyCovered) return false;
    }
    return true;
  });

  const demandersCount = demanders.length;
  const coverageRatio = demandersCount / Math.max(supply, 1);

  if (demandersCount === 0) {
    return {
      demandMult: 0.9,
      demandLabel: "bassa",
      demanders: 0,
      supply,
      coverageRatio,
      budgetPressure: 0,
      rawDemand: 0,
      nEff: 0,
      demandConfidence: 0,
      pavimentoFascia,
    };
  }

  const budgetPressure = median(demanders.map((t) => t.legalMax)) / Math.max(median(comparableBaseLive), 1);

  const rawDemand =
    0.7 * Math.log(clamp(COVERAGE_RATIO_MIN, COVERAGE_RATIO_MAX, coverageRatio)) +
    0.3 * Math.log(clamp(BUDGET_PRESSURE_MIN, BUDGET_PRESSURE_MAX, budgetPressure));

  const nEff = Math.min(demandersCount, supply + 2);
  const demandConfidence = nEff / (nEff + 4);
  const adjustedDemand = demandConfidence * rawDemand;

  const demandMult = clamp(DEMAND_MULT_MIN, DEMAND_MULT_MAX, Math.exp(0.25 * adjustedDemand));

  return {
    demandMult,
    demandLabel: demandLabelFor(demandMult),
    demanders: demandersCount,
    supply,
    coverageRatio,
    budgetPressure,
    rawDemand,
    nEff,
    demandConfidence,
    pavimentoFascia,
  };
}
