import { describe, expect, it } from "vitest";
import {
  computeConfidence,
  computeFairLive,
  computeFairSeed,
  computeInflationForBucket,
  computeTechnicalAdjustment,
  isNewNoMarket,
} from "./pricing";

describe("computeFairSeed — snapshot 30/08/2026 (§2.2, §2.3)", () => {
  it("Lautaro: blend 60/40 di (137×2=274) e FVM 367 atterra 300-320 a tech_adj neutro", () => {
    const { fairSeed, basis } = computeFairSeed({ market10x500: 137, fvm1000: 367 }, 1);
    expect(basis).toBe("blend");
    expect(fairSeed).not.toBeNull();
    expect(fairSeed as number).toBeGreaterThanOrEqual(300);
    expect(fairSeed as number).toBeLessThanOrEqual(320);
  });

  it("Thuram: blend di (125×2=249 dichiarato) e FVM 263 atterra 250-260 a tech_adj neutro", () => {
    const { fairSeed, basis } = computeFairSeed({ market10x500: 124.5, fvm1000: 263 }, 1);
    expect(basis).toBe("blend");
    expect(fairSeed as number).toBeGreaterThanOrEqual(250);
    expect(fairSeed as number).toBeLessThanOrEqual(260);
  });

  it("Malen: senza mercato usa solo FVM (414), non un intero finto da un blend inesistente", () => {
    const { fairSeed, basis } = computeFairSeed({ market10x500: undefined, fvm1000: 414 }, 1);
    expect(basis).toBe("fvm");
    expect(fairSeed).toBeCloseTo(414, 6);
  });

  it("manca tutto → niente intero finto, solo quota_only", () => {
    const { fairSeed, basis } = computeFairSeed({}, 1);
    expect(fairSeed).toBeNull();
    expect(basis).toBe("quota_only");
  });

  it("manca FVM → ancora = mercato", () => {
    const { fairSeed, basis } = computeFairSeed({ market10x500: 100 }, 1);
    expect(basis).toBe("market");
    expect(fairSeed).toBeCloseTo(200, 6);
  });
});

describe("computeTechnicalAdjustment — §2.3.1, 3 correttori + clamp", () => {
  const base = { starter: "ruota" as const, starterPct: 60, penalties: 0 as const, departureRisk: undefined };

  it("titolarita: fisso + starterPct>=80 → +0.04", () => {
    const r = computeTechnicalAdjustment({ ...base, starter: "fisso", starterPct: 85 });
    expect(r.titolarita).toBeCloseTo(0.04, 6);
  });

  it("titolarita: ballottaggio/ruota 40-79 → 0", () => {
    const r = computeTechnicalAdjustment({ ...base, starter: "ballottaggio", starterPct: 50 });
    expect(r.titolarita).toBe(0);
  });

  it("titolarita: riserva/out o starterPct<40 → -0.06", () => {
    expect(computeTechnicalAdjustment({ ...base, starter: "riserva", starterPct: 10 }).titolarita).toBeCloseTo(-0.06, 6);
    expect(computeTechnicalAdjustment({ ...base, starter: "out", starterPct: 0 }).titolarita).toBeCloseTo(-0.06, 6);
    expect(computeTechnicalAdjustment({ ...base, starter: "ballottaggio", starterPct: 30 }).titolarita).toBeCloseTo(-0.06, 6);
  });

  it("rigori: 1a scelta non priced-in → +0.05, 2a → +0.02, nessuno → 0", () => {
    expect(computeTechnicalAdjustment({ ...base, penalties: 1 }).rigori).toBeCloseTo(0.05, 6);
    expect(computeTechnicalAdjustment({ ...base, penalties: 2 }).rigori).toBeCloseTo(0.02, 6);
    expect(computeTechnicalAdjustment({ ...base, penalties: 0 }).rigori).toBe(0);
  });

  it("departureRisk: >=60 → -0.08, 30-59 → -0.03, <30/unknown → 0", () => {
    expect(computeTechnicalAdjustment({ ...base, departureRisk: 60 }).departure).toBeCloseTo(-0.08, 6);
    expect(computeTechnicalAdjustment({ ...base, departureRisk: 45 }).departure).toBeCloseTo(-0.03, 6);
    expect(computeTechnicalAdjustment({ ...base, departureRisk: 10 }).departure).toBe(0);
    expect(computeTechnicalAdjustment({ ...base, departureRisk: undefined }).departure).toBe(0);
  });

  it("pricedIn azzera il singolo correttore anche quando il segnale sarebbe forte", () => {
    const r = computeTechnicalAdjustment(
      { starter: "fisso", starterPct: 95, penalties: 1, departureRisk: 70 },
      { starter: true, penalties: true, departure: true },
    );
    expect(r.titolarita).toBe(0);
    expect(r.rigori).toBe(0);
    expect(r.departure).toBe(0);
    expect(r.value).toBe(1);
  });

  it("il tetto +0.12 non è mai raggiungibile con i 3 correttori attuali (max teorico +0.09)", () => {
    const r = computeTechnicalAdjustment({ starter: "fisso", starterPct: 100, penalties: 1, departureRisk: 0 });
    expect(r.rawAdj).toBeCloseTo(1.09, 6);
    expect(r.value).toBeCloseTo(1.09, 6); // nessun clamp applicato
  });

  it("il floor -0.12 (0.88) scatta con riserva/out + departure alto", () => {
    const r = computeTechnicalAdjustment({ starter: "out", starterPct: 0, penalties: 0, departureRisk: 80 });
    expect(r.rawAdj).toBeCloseTo(0.86, 6);
    expect(r.value).toBeCloseTo(0.88, 6); // clampato
  });
});

describe("isNewNoMarket", () => {
  it("true solo se isNew e manca market10x500", () => {
    expect(isNewNoMarket({ isNew: true }, {})).toBe(true);
    expect(isNewNoMarket({ isNew: true }, { market10x500: 50 })).toBe(false);
    expect(isNewNoMarket({ isNew: false }, {})).toBe(false);
  });
});

describe("computeConfidence — §2.10", () => {
  it("solo quota → 25", () => {
    expect(computeConfidence({ basis: "quota_only" })).toBe(25);
  });

  it("solo FVM o solo mercato → 45 (es. Malen: range, non 414)", () => {
    expect(computeConfidence({ basis: "fvm", fvm1000: 414 })).toBe(45);
    expect(computeConfidence({ basis: "fvm", fvm1000: 414 })).toBeLessThan(50);
  });

  it("entrambe le fonti divergenti (>25%) → 60", () => {
    expect(computeConfidence({ basis: "blend", market1000: 100, fvm1000: 200 })).toBe(60);
  });

  it("entrambe le fonti vicine → 75", () => {
    expect(computeConfidence({ basis: "blend", market1000: 200, fvm1000: 210 })).toBe(75);
  });

  it("+10 se >=4 comparabili live (cap 95)", () => {
    expect(computeConfidence({ basis: "blend", market1000: 200, fvm1000: 210, comparableCountInBucket: 4 })).toBe(85);
    expect(computeConfidence({ basis: "blend", market1000: 200, fvm1000: 210, comparableCountInBucket: 3 })).toBe(75);
  });

  it("-15 se departureRisk>=60 o titolarità out, con floor 15", () => {
    expect(computeConfidence({ basis: "quota_only", departureRisk: 60 })).toBe(15);
    expect(computeConfidence({ basis: "fvm", starter: "out" })).toBe(30);
  });

  it("-15 se newNoMarket, non abbassa il fair (verificato in isolamento dalla funzione fair_seed)", () => {
    expect(computeConfidence({ basis: "fvm", fvm1000: 100, newNoMarket: true })).toBe(30);
  });

  it("i due floor -15 si applicano in sequenza, entrambi con pavimento 15", () => {
    expect(
      computeConfidence({ basis: "quota_only", departureRisk: 90, newNoMarket: true }),
    ).toBe(15);
  });
});

describe("computeInflationForBucket — §2.4", () => {
  it("nessun comparabile → neutro (1x), confidence 0", () => {
    const r = computeInflationForBucket([]);
    expect(r.inflationLive).toBe(1);
    expect(r.nEff).toBe(0);
  });

  it("un solo comparabile: mediana di un elemento è l'elemento stesso, shrinkage 1/6", () => {
    const r = computeInflationForBucket([1.5]);
    expect(r.rawInflation).toBe(1.5);
    expect(r.nEff).toBe(1);
    expect(r.confidence).toBeCloseTo(1 / 6, 6);
    expect(r.inflationLive).toBeCloseTo(1 + (1 / 6) * 0.5, 6);
  });

  it("mediana robusta su più comparabili con shrinkage crescente", () => {
    const r = computeInflationForBucket([1.0, 1.2, 1.4, 1.6, 1.8]);
    expect(r.rawInflation).toBe(1.4);
    expect(r.nEff).toBe(5);
    expect(r.confidence).toBeCloseTo(5 / 10, 6);
    expect(r.inflationLive).toBeCloseTo(1 + 0.5 * 0.4, 6);
  });
});

describe("computeFairLive — §2.6 clamp 0.70x-1.35x del seed", () => {
  it("clampa in alto quando base_live × demand supera 1.35x seed", () => {
    const { fairLive } = computeFairLive(200, 2, 1.2); // baseLive=400, ×1.2=480 >> 1.35×200=270
    expect(fairLive).toBeCloseTo(270, 6);
  });

  it("clampa in basso quando base_live × demand è sotto 0.70x seed", () => {
    const { fairLive } = computeFairLive(200, 0.5, 0.9); // baseLive=100, ×0.9=90 << 0.70×200=140
    expect(fairLive).toBeCloseTo(140, 6);
  });

  it("nessun clamp quando il risultato è già nel range", () => {
    const { fairLive, baseLive } = computeFairLive(200, 1.1, 1.05);
    expect(baseLive).toBeCloseTo(220, 6);
    expect(fairLive).toBeCloseTo(220 * 1.05, 6);
  });
});
