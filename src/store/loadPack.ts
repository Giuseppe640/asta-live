import { computeBands, type BandInput } from "../lib/bands";
import { computeConfidence, computeFairSeed, computeTechnicalAdjustment, isNewNoMarket } from "../lib/pricing";
import type { Player } from "../types";

/** Forma grezza attesa in src/data/players.*.json: tutto tranne i campi calcolati (fascia, pricing). */
export type RawPlayer = Omit<Player, "fascia" | "pricing"> & { fascia?: never; pricing?: never };

/**
 * Ingest di un pack dati: calcola technical_adjustment → fair_seed → confidence
 * (§2.3) e le fasce una tantum sul pack (§6.2). Va chiamata solo al caricamento
 * di un nuovo pack, mai ad ogni assegnazione — altrimenti le fasce si spostano
 * e i bucket di inflazione si sporcano (vedi docs/piano-webapp-asta-fantacalcio-FINALE.md §6.2).
 */
export function buildInitialPlayers(raw: RawPlayer[]): Player[] {
  const withFairSeed = raw.map((p) => {
    const techAdj = computeTechnicalAdjustment(p, p.sourceSnapshot.pricedIn);
    const { fairSeed, basis, market1000, fvm1000 } = computeFairSeed(p.sourceSnapshot, techAdj.value);

    const confidence = computeConfidence({
      basis,
      market1000,
      fvm1000,
      comparableCountInBucket: 0,
      departureRisk: p.departureRisk,
      starter: p.starter,
      newNoMarket: isNewNoMarket(p, p.sourceSnapshot),
    });

    return { raw: p, techAdj, fairSeed, basis, confidence };
  });

  const bandInputs: BandInput[] = withFairSeed.map((p) => ({
    id: p.raw.id,
    role: p.raw.role,
    fairSeed: p.fairSeed,
    fasciaOverride: p.raw.fasciaOverride,
    starter: p.raw.starter,
  }));
  const bandById = new Map(computeBands(bandInputs).map((b) => [b.id, b]));

  const now = new Date().toISOString();

  return withFairSeed.map(({ raw, techAdj, fairSeed, confidence }): Player => {
    const band = bandById.get(raw.id)!;
    return {
      ...raw,
      fascia: band.fascia,
      fasciaUncertain: band.fasciaUncertain,
      pricing: {
        fairSeed,
        fairLive: fairSeed,
        personalMax: 0,
        confidence,
        inflationMult: 1,
        demandMult: 1,
        demandLabel: "media",
        technicalAdjustment: techAdj.value,
        reasons: [],
        updatedAt: now,
      },
    };
  });
}
