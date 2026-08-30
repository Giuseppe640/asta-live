import {
  FAIR_LIVE_MAX_MULT,
  FAIR_LIVE_MIN_MULT,
  SEED_WEIGHT_FVM,
  SEED_WEIGHT_MARKET,
  TECH_ADJ_MAX,
  TECH_ADJ_MIN,
} from "./constants";
import { clamp } from "./stats";
import type { PricedIn, PriceSourceSnapshot, Starter } from "../types";

// ---------------------------------------------------------------------------
// §2.3.1 — technical_adjustment: 3 correttori di fair, sommati e clampati.
// Ogni correttore vale 0 se pricedIn=true per quel segnale, o se il dato manca.
// newNoMarket NON entra qui: agisce solo sulla confidence (vedi computeConfidence).
// ---------------------------------------------------------------------------

export interface TechnicalAdjustmentResult {
  value: number;
  titolarita: number;
  rigori: number;
  departure: number;
  rawAdj: number;
}

function titolaritaAdjustment(starter: Starter, starterPct: number): number {
  if (starter === "riserva" || starter === "out" || starterPct < 40) return -0.06;
  if (starter === "fisso" && starterPct >= 80) return 0.04;
  return 0; // ballottaggio / ruota / 40-79
}

function rigoriAdjustment(penalties: 0 | 1 | 2): number {
  if (penalties === 1) return 0.05;
  if (penalties === 2) return 0.02;
  return 0;
}

function departureAdjustment(departureRisk: number | undefined): number {
  if (departureRisk == null) return 0;
  if (departureRisk >= 60) return -0.08;
  if (departureRisk >= 30) return -0.03;
  return 0;
}

export function computeTechnicalAdjustment(
  player: { starter: Starter; starterPct: number; penalties: 0 | 1 | 2; departureRisk?: number },
  pricedIn: PricedIn = {},
): TechnicalAdjustmentResult {
  const titolarita = pricedIn.starter ? 0 : titolaritaAdjustment(player.starter, player.starterPct);
  const rigori = pricedIn.penalties ? 0 : rigoriAdjustment(player.penalties);
  const departure = pricedIn.departure ? 0 : departureAdjustment(player.departureRisk);

  const rawAdj = 1 + titolarita + rigori + departure;
  const value = clamp(TECH_ADJ_MIN, TECH_ADJ_MAX, rawAdj);

  return { value, titolarita, rigori, departure, rawAdj };
}

// ---------------------------------------------------------------------------
// §2.3 — fair seed
// ---------------------------------------------------------------------------

export type FairSeedBasis = "blend" | "market" | "fvm" | "quota_only";

export interface FairSeedResult {
  fairSeed: number | null;
  basis: FairSeedBasis;
  market1000?: number;
  fvm1000?: number;
}

export function computeFairSeed(
  snapshot: Pick<PriceSourceSnapshot, "market10x500" | "fvm1000">,
  technicalAdjustment: number,
): FairSeedResult {
  const market1000 = snapshot.market10x500 != null ? snapshot.market10x500 * 2 : undefined;
  const fvm1000 = snapshot.fvm1000;

  if (market1000 != null && fvm1000 != null) {
    const seedBlend = SEED_WEIGHT_MARKET * market1000 + SEED_WEIGHT_FVM * fvm1000;
    return { fairSeed: seedBlend * technicalAdjustment, basis: "blend", market1000, fvm1000 };
  }
  if (fvm1000 != null) {
    return { fairSeed: fvm1000 * technicalAdjustment, basis: "fvm", fvm1000 };
  }
  if (market1000 != null) {
    return { fairSeed: market1000 * technicalAdjustment, basis: "market", market1000 };
  }
  // Manca tutto: niente intero finto, solo quota + range (gestito a valle da chi chiama).
  return { fairSeed: null, basis: "quota_only" };
}

export function isNewNoMarket(
  player: { isNew: boolean },
  snapshot: { market10x500?: number },
): boolean {
  return player.isNew && snapshot.market10x500 == null;
}

// ---------------------------------------------------------------------------
// §2.10 — confidence 0-100
// ---------------------------------------------------------------------------

export interface ConfidenceInput {
  basis: FairSeedBasis;
  market1000?: number;
  fvm1000?: number;
  comparableCountInBucket?: number;
  departureRisk?: number;
  starter?: Starter;
  newNoMarket?: boolean;
}

export function computeConfidence(input: ConfidenceInput): number {
  let base: number;
  if (input.basis === "quota_only") {
    base = 25;
  } else if (input.basis === "blend") {
    const { market1000 = 0, fvm1000 = 0 } = input;
    const divergence = Math.abs(market1000 - fvm1000) / Math.max(market1000, fvm1000, 1);
    base = divergence > 0.25 ? 60 : 75;
  } else {
    base = 45; // solo FVM o solo mercato
  }

  let confidence = base;

  if ((input.comparableCountInBucket ?? 0) >= 4) {
    confidence = Math.min(95, confidence + 10);
  }
  if ((input.departureRisk ?? 0) >= 60 || input.starter === "out") {
    confidence = Math.max(15, confidence - 15);
  }
  if (input.newNoMarket) {
    confidence = Math.max(15, confidence - 15);
  }

  return confidence;
}

// ---------------------------------------------------------------------------
// §2.4 — inflazione live, calcolata per bucket ruolo+fascia (fascia seed)
// ---------------------------------------------------------------------------

export interface InflationBucketResult {
  rawInflation: number;
  nEff: number;
  confidence: number;
  inflationLive: number;
}

/** `paidRatios` = prezzo_pagato / fair_seed per ogni comparabile già aggiudicato nello stesso bucket ruolo+fascia. */
export function computeInflationForBucket(paidRatios: number[]): InflationBucketResult {
  const nEff = paidRatios.length;
  if (nEff === 0) {
    return { rawInflation: 1, nEff: 0, confidence: 0, inflationLive: 1 };
  }
  const sorted = [...paidRatios].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const rawInflation = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const confidence = nEff / (nEff + 5);
  const inflationLive = 1 + confidence * (rawInflation - 1);
  return { rawInflation, nEff, confidence, inflationLive };
}

// ---------------------------------------------------------------------------
// §2.6 — fair live
// ---------------------------------------------------------------------------

export function computeFairLive(
  fairSeed: number,
  inflationLive: number,
  demandMult: number,
): { baseLive: number; fairLive: number } {
  const baseLive = fairSeed * inflationLive;
  const fairLive = clamp(FAIR_LIVE_MIN_MULT * fairSeed, FAIR_LIVE_MAX_MULT * fairSeed, baseLive * demandMult);
  return { baseLive, fairLive };
}

/**
 * Ampiezza del range mostrato in UI quando la confidence è bassa (§2.9 "confidence < 50 → primario = range").
 * Il piano non fissa una formula numerica per la larghezza: qui si interpola linearmente da ±5% (confidence 95)
 * a ±30% (confidence 15), unico punto non specificato a scaglioni nel piano.
 */
export function computeDisplayRange(fairLive: number, confidence: number): { low: number; high: number } {
  const k = clamp(0.05, 0.3, 0.3 - ((confidence - 15) / 80) * 0.25);
  return { low: fairLive * (1 - k), high: fairLive * (1 + k) };
}
