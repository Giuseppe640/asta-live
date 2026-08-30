import type { Role, TeamProfile } from "../types";

// §1 — vincoli di lega
export const NUM_TEAMS = 10;
export const STARTING_BUDGET = 1000;
export const ROSTER_SIZE = 25;

export const ROLE_SLOTS: Record<Role, number> = { P: 3, D: 8, C: 8, A: 6 };

export const ROLES: Role[] = ["P", "D", "C", "A"];

// §2.7 — profili cap_piano (quote su 1000, cuscino escluso dai reparti)
export const CUSHION_TOTAL = 30;

export const PROFILE_QUOTAS: Record<Exclude<TeamProfile, "custom">, Record<Role, number>> = {
  balanced_md: { P: 80, D: 230, C: 260, A: 400 },
  super_forward: { P: 70, D: 200, C: 240, A: 460 },
  depth: { P: 80, D: 240, C: 310, A: 340 },
};

// ordine fisso di assorbimento buchi dal cuscino — §2.7
export const HOLE_ABSORPTION_ORDER: Role[] = ["A", "C", "D", "P"];

// §2.3 — pesi fair seed
export const SEED_WEIGHT_MARKET = 0.6;
export const SEED_WEIGHT_FVM = 0.4;

// §2.3.1 — clamp technical_adjustment
export const TECH_ADJ_MIN = 0.88;
export const TECH_ADJ_MAX = 1.12;

// §2.6 — clamp fair live rispetto al seed
export const FAIR_LIVE_MIN_MULT = 0.7;
export const FAIR_LIVE_MAX_MULT = 1.35;

// §2.5 — clamp domanda
export const DEMAND_MULT_MIN = 0.9;
export const DEMAND_MULT_MAX = 1.2;
export const COVERAGE_RATIO_MIN = 0.25;
export const COVERAGE_RATIO_MAX = 4.0;
export const BUDGET_PRESSURE_MIN = 0.5;
export const BUDGET_PRESSURE_MAX = 2.0;

// §6.2 — percentili fasce sul fair seed
export const FASCIA_PERCENTILES: Record<Exclude<import("../types").Fascia, "D">, number> = {
  S: 90,
  A: 70,
  B: 40,
  C: 15,
};

export const FASCIA_ORDER: import("../types").Fascia[] = ["D", "C", "B", "A", "S"];

// Modificatore difesa — screenshot regolamento 30/08/2026 (non è il MD Gazzetta)
export const DEFENSE_MODIFIER_TABLE: { max: number; bonus: number }[] = [
  { max: 6.0, bonus: 0 },
  { max: 6.25, bonus: 1 },
  { max: 6.5, bonus: 2 },
  { max: 6.75, bonus: 3 },
  { max: 7.0, bonus: 4 },
  { max: 7.25, bonus: 5 },
  { max: 7.5, bonus: 6 },
  { max: Infinity, bonus: 7 },
];
