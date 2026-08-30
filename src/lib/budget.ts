import { CUSHION_TOTAL, HOLE_ABSORPTION_ORDER, ROLES } from "./constants";
import type { Role, Watch } from "../types";

// ---------------------------------------------------------------------------
// §1 — regola crediti residui / legal_max
// ---------------------------------------------------------------------------

/** legal_max = remaining − (slots_left_totali − 1). `must` non può mai superarlo. */
export function computeLegalMax(remaining: number, slotsLeftTotal: number): number {
  return remaining - (slotsLeftTotal - 1);
}

// ---------------------------------------------------------------------------
// §2.7 — cap_piano, formula canonica
// ---------------------------------------------------------------------------

export interface CapPianoInput {
  nominal: Record<Role, number>;
  spent: Record<Role, number>;
  slots: Record<Role, number>;
  ownedCount: Record<Role, number>;
}

export interface CapPianoResult {
  capPiano: Record<Role, number>;
  holes: Record<Role, number>;
  surplus: Record<Role, number>;
  minClose: Record<Role, number>;
  holesAbsorbedByCushion: Record<Role, number>;
  cushionLeft: number;
  planDeficit: number;
  requiresReallocation: boolean;
}

export function computeCapPiano(input: CapPianoInput): CapPianoResult {
  const { nominal, spent, slots, ownedCount } = input;

  const holes = {} as Record<Role, number>;
  const surplus = {} as Record<Role, number>;
  const minClose = {} as Record<Role, number>;
  const capPiano = {} as Record<Role, number>;

  for (const R of ROLES) {
    const slotsLeft = slots[R] - ownedCount[R];
    minClose[R] = slotsLeft * 1;

    const nominaleR = Math.floor(nominal[R]);
    const residuoNom = nominaleR - spent[R];

    holes[R] = Math.max(0, -residuoNom);
    surplus[R] = Math.max(0, residuoNom);
    capPiano[R] = Math.max(minClose[R], surplus[R]);
  }

  let cushionLeft = CUSHION_TOTAL;
  const holesAbsorbedByCushion = {} as Record<Role, number>;
  for (const R of HOLE_ABSORPTION_ORDER) {
    const absorbed = Math.min(holes[R], cushionLeft);
    holesAbsorbedByCushion[R] = absorbed;
    cushionLeft -= absorbed;
  }

  const totalHoles = ROLES.reduce((sum, R) => sum + holes[R], 0);
  const planDeficit = Math.max(0, totalHoles - CUSHION_TOTAL);

  return {
    capPiano,
    holes,
    surplus,
    minClose,
    holesAbsorbedByCushion,
    cushionLeft,
    planDeficit,
    requiresReallocation: planDeficit > 0,
  };
}

// ---------------------------------------------------------------------------
// §2.8 — mio max, unica formula
// ---------------------------------------------------------------------------

export interface PersonalMaxInput {
  legalMax: number;
  fairLive: number | null;
  capPiano: number;
  watch: Watch | undefined;
}

export interface PersonalMaxResult {
  personalMax: number;
  basePersonalMax: number;
  mustPersonalMax: number;
}

export function computePersonalMax(input: PersonalMaxInput): PersonalMaxResult {
  const { legalMax, fairLive, capPiano, watch } = input;

  // fair_live sconosciuto (nessun seed) → non vincola il minimo, si segue legal_max/cap_piano.
  const fairLiveOrInf = fairLive ?? Number.POSITIVE_INFINITY;

  // i crediti sono sempre interi: fair_live è l'unico termine potenzialmente frazionario nel min().
  const basePersonalMax = Math.floor(Math.min(legalMax, fairLiveOrInf, capPiano));
  const mustPersonalMax = Math.min(
    legalMax,
    Number.isFinite(fairLiveOrInf) ? Math.floor(fairLiveOrInf * 1.15) : Number.POSITIVE_INFINITY,
    Math.floor(capPiano * 1.1),
  );

  const personalMax = watch === "no" ? 0 : watch === "must" ? mustPersonalMax : basePersonalMax;

  return { personalMax, basePersonalMax, mustPersonalMax };
}

// ---------------------------------------------------------------------------
// §2.9 — overpay / extreme_overpay
// ---------------------------------------------------------------------------

export function isOverpay(currentPrice: number, personalMax: number): boolean {
  return currentPrice > personalMax;
}

export function isExtremeOverpay(currentPrice: number, personalMax: number, fairLive: number | null): boolean {
  const fairBound = fairLive != null ? fairLive * 1.2 : Number.NEGATIVE_INFINITY;
  return currentPrice > Math.max(personalMax * 1.1, fairBound);
}

/** Rosa inchiodabile — §2.7: alert bloccante se legal_max < 1 con slot ancora aperti. */
export function isRosterUnclosable(legalMax: number, slotsLeftTotal: number): boolean {
  return slotsLeftTotal > 0 && legalMax < 1;
}
