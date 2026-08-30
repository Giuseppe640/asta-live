import { DEFENSE_MODIFIER_TABLE } from "./constants";
import { clamp } from "./stats";

/**
 * Modificatore difesa — screenshot regolamento app 30/08/2026 (0→+7, non il MD Gazzetta).
 * `avgVoto` = media voti puri di P + 3 migliori D (riserva d'ufficio inclusa).
 */
export function defenseModifierBonus(avgVoto: number): number {
  for (const row of DEFENSE_MODIFIER_TABLE) {
    if (avgVoto < row.max) return row.bonus;
  }
  return DEFENSE_MODIFIER_TABLE[DEFENSE_MODIFIER_TABLE.length - 1].bonus;
}

/**
 * mdIndex §6.4 — solo P/D, non entra in technical_adjustment.
 * `votoAttesoNorm` e `starterPct` in 0–100.
 */
export function computeMdIndex(votoAttesoNorm: number, starterPct: number): number {
  return clamp(0, 100, 0.65 * votoAttesoNorm + 0.35 * starterPct);
}
